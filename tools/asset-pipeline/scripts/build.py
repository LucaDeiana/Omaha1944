"""Pipeline asset di Omaha1944: genera -> esporta GLB -> valida -> impacchetta per il runtime.

    python tools/asset-pipeline/scripts/build.py [id_asset ...]        (modulo bpy: pip install bpy==5.2.3)
    blender --background --python tools/asset-pipeline/scripts/build.py -- [id_asset ...]

Gli asset sono descritti in tools/asset-pipeline/manifests/assets.json (generatore, parametri, seme, LOD).
Uscite (runtime, versionate): assets/aaa/pipeline/<id>.glb, <id>.json (manifest runtime), <id>.js (GLB+manifest in
base64 per il caricamento anche da file://). Rapporto di validazione: tools/asset-pipeline/reports/<id>.json.
"""
import json
import os
import sys
import time
import base64
import importlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PIPE = os.path.join(ROOT, 'tools', 'asset-pipeline')
sys.path.insert(0, os.path.join(PIPE, 'blender', 'lib'))
sys.path.insert(0, os.path.join(PIPE, 'blender', 'generators'))
sys.path.insert(0, os.path.join(PIPE, 'blender', 'validators'))

import bpy  # noqa: E402

OUT = os.environ.get('PIPE_OUT') or os.path.join(ROOT, 'assets', 'aaa', 'pipeline')   # PIPE_OUT: cartella alternativa (test)
REP = os.environ.get('PIPE_REP') or os.path.join(PIPE, 'reports')


def to_gltf_box(mn, mx):
    """Blender (Z in alto) -> glTF (Y in alto): (x, y, z) -> (x, z, -y)."""
    return [mn[0], mn[2], -mx[1]], [mx[0], mx[2], -mn[1]]


def mat_lib_factory(lib):
    cache = {}

    def get(name):
        if name in cache:
            return cache[name]
        m = bpy.data.materials.new(name)
        d = lib.get(name, {})
        col = d.get('color') or [min(1, c * .55) for c in d.get('tint', [.6, .6, .6])]
        m.use_nodes = True
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (*col, 1)
            bsdf.inputs['Roughness'].default_value = d.get('rough', .8)
            bsdf.inputs['Metallic'].default_value = d.get('metal', 0)
        m['omaha_slot'] = name
        cache[name] = m
        return m
    return get


def build(asset_id, spec, lib):
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    gen = importlib.import_module(spec['generator'])
    tiles = {k: v['tile'] for k, v in lib.items() if isinstance(v, dict) and 'tile' in v}
    h = gen.generate(seed=spec['seed'], _tiles=tiles, **spec.get('params', {}))
    h.p.pop('_tiles', None)
    get = mat_lib_factory(lib)
    root = bpy.data.objects.new(asset_id, None)
    bpy.context.scene.collection.objects.link(root)
    lod_info = {}
    for lod in ('LOD0', 'LOD1', 'LOD2'):
        ob = h.g.to_object(lod, '%s_%s' % (asset_id, lod), get)
        ob.parent = root
        lod_info[lod] = dict(triangoli=sum(len(p.vertices) - 2 for p in ob.data.polygons), materiali=len(ob.data.materials))
    gen_s = time.time() - t0
    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, asset_id + '.glb')
    for o in bpy.context.scene.objects:
        o.select_set(True)
    t1 = time.time()
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT', export_extras=True,
                              export_cameras=False, export_lights=False, export_animations=False, export_tangents=False)
    exp_s = time.time() - t1
    cols = []
    for c in h.col:
        mn, mx = to_gltf_box(c['min'], c['max'])
        cols.append(dict(min=[round(v, 4) for v in mn], max=[round(v, 4) for v in mx], tag=c['tag'], walk=c['walk']))
    rooms = []
    for r in h.rooms:
        mn, mx = to_gltf_box(r['min'], r['max'])
        rooms.append(dict(min=mn, max=mx))
    floors = []
    for f in h.floors:   # Blender (x, y) -> glTF (x, -y); quota Z -> Y
        g = dict(x0=round(f['x0'], 4), x1=round(f['x1'], 4), z0=round(-f['y1'], 4), z1=round(-f['y0'], 4), y=round(f['z'], 4))
        if 'ramp' in f:
            r = f['ramp']
            g['ramp'] = dict(axis='x', c0=round(r['c0'], 4), c1=round(r['c1'], 4), y0=round(r['z0'], 4), y1=round(r['z1'], 4))
        floors.append(g)
    P = h.p
    man = dict(
        id=asset_id, formato='omaha1944-asset-1', generatore=spec['generator'], seme=spec['seed'], parametri=P,
        blender=bpy.app.version_string, unita='metri', assi='glTF: Y in alto, facciata principale verso +Z, origine al centro della pianta a quota del terreno',
        lod=lod_info, distanzeLod=spec['lod_distances'], collisioni=cols, pavimenti=floors, interni=rooms,
        materiali=sorted(set(h.g.mats)), statistiche=h.stats,
        dimensioni=dict(larghezza=P['width'], profondita=P['depth'], colmo=round(h.zr + .16, 3), comignoli=round(h.zr + .95 + .4, 3)),
        edera=[dict(muro='facciata', a0=-P['width'] / 2 + .3, a1=-P['width'] / 2 + 2.6, top=P['eave'] - .2)],
        tempi=dict(generazione_s=round(gen_s, 2), esportazione_s=round(exp_s, 2)),
    )
    with open(os.path.join(OUT, asset_id + '.json'), 'w') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    import validate_glb  # noqa: E402
    rep = validate_glb.validate(glb, man, lib, spec.get('budget', {}))
    os.makedirs(REP, exist_ok=True)
    with open(os.path.join(REP, asset_id + '.json'), 'w') as f:
        json.dump(rep, f, ensure_ascii=False, indent=1)
    data = open(glb, 'rb').read()
    with open(os.path.join(OUT, asset_id + '.js'), 'w') as f:
        f.write('// Generato da tools/asset-pipeline (non modificare a mano): GLB e manifest dell\'asset «%s»\n' % asset_id)
        f.write('(window.AAA_PIPE = window.AAA_PIPE || {})[%s] = { manifest: %s, glb: "%s" };\n' % (
            json.dumps(asset_id), json.dumps(man, ensure_ascii=False), base64.b64encode(data).decode()))
    return man, rep


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    specs = json.load(open(os.environ.get('PIPE_SPECS') or os.path.join(PIPE, 'manifests', 'assets.json')))
    lib = json.load(open(os.path.join(PIPE, 'manifests', 'materials.json')))
    ids = argv or [k for k in specs if not k.startswith('_')]
    bad = 0
    for i in ids:
        man, rep = build(i, specs[i], lib)
        print('%-22s LOD0 %6d  LOD1 %6d  LOD2 %5d tri  %7.0f KB  errori %d  avvisi %d' % (
            i, man['lod']['LOD0']['triangoli'], man['lod']['LOD1']['triangoli'], man['lod']['LOD2']['triangoli'],
            rep['file']['kb'], len(rep['errori']), len(rep['avvisi'])))
        for e in rep['errori']:
            print('   ERRORE', e)
        for w in rep['avvisi']:
            print('   avviso', w)
        bad += len(rep['errori'])
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
