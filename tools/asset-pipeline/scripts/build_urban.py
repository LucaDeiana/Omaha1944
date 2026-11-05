"""Dettaglio Blender degli edifici dell'Urban Expansion 3.0: genera (urban_house.py), esporta un GLB per edificio, valida.

    python tools/asset-pipeline/scripts/build_urban.py [id ...]

Ingresso: assets/aaa/urban/urban_defs.json (le stesse definizioni lette dal gioco).
Uscite: assets/aaa/urban/<id>.glb, <id>.js (base64, caricabile da file://), manifest con gruppi, triangoli e materiali.
Ogni nodo del GLB si chiama «<gruppo con _ al posto di :>@<LOD>»: il runtime unisce per materiale e nasconde i gruppi dei componenti rotti.
"""
import base64
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PIPE = os.path.join(ROOT, 'tools', 'asset-pipeline')
for d in ('lib', 'generators', 'validators'):
    sys.path.insert(0, os.path.join(PIPE, 'blender', d))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from build import mat_lib_factory  # noqa: E402

OUT = os.environ.get('URBAN_OUT') or os.path.join(ROOT, 'assets', 'aaa', 'urban')
GROUP_RE = __import__('re').compile(r'^(p:[snoe]:\d+:\d+|o:[snoe]:\d+:\d+|a:[snoe]:\d+:\d+|r:-?1:\d+|g:-?1|b)$')


def buildings(defs):
    out = []
    for d in defs['isolato1']['items']:
        out.append(dict(d))
    for R in defs['file']:
        for i, d in enumerate(R['items']):
            e = dict(d)
            e['id'] = '%s_%s' % (R['id'], chr(97 + i))
            e['fronte'] = R['fronte']
            out.append(e)
    return out


def build_one(cfg, lib, tiles):
    import importlib
    import urban_house
    importlib.reload(urban_house)
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    h = urban_house.generate(cfg, seed=abs(hash(cfg['id'])) % 100000 if False else sum(map(ord, cfg['id'])) * 37, tiles=tiles)
    get = mat_lib_factory(lib)
    root = bpy.data.objects.new(cfg['id'], None)
    bpy.context.scene.collection.objects.link(root)
    info = {'LOD0': 0}
    groups = h.g.groups('LOD0')
    for lod in ('LOD0',):   # da lontano basta il volume del runtime
        for g in h.g.groups(lod):
            ob = h.g.to_group_object(lod, g, '%s@%s' % (g.replace(':', '_'), lod), get)   # i due punti non sopravvivono al caricatore glTF di three.js
            ob.parent = root
            info[lod] += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, cfg['id'] + '.glb')
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_texcoords=True,
                              export_normals=True, export_materials='EXPORT', export_extras=True, export_cameras=False, export_lights=False, export_animations=False)
    E = [g for g in groups if not GROUP_RE.match(g)]
    man = dict(id=cfg['id'], formato='omaha1944-urban-detail-1', generatore='urban_house', blender=bpy.app.version_string, cfg=cfg,
               gruppi=groups, triangoli=info, materiali=sorted(set(h.g.mats)), kb=round(os.path.getsize(glb) / 1024, 1),
               validazione=dict(errori=['gruppo non valido: ' + g for g in E] + (['LOD0 oltre 120.000 triangoli'] if info['LOD0'] > 120000 else [])), tempo_s=round(time.time() - t0, 1))
    with open(os.path.join(OUT, cfg['id'] + '.json'), 'w') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, cfg['id'] + '.js'), 'w') as f:
        f.write('// Generato da tools/asset-pipeline/scripts/build_urban.py (non modificare a mano)\n')
        f.write('(window.URBAN_GLB = window.URBAN_GLB || {})[%s] = { manifest: %s, glb: "%s" };\n' % (json.dumps(cfg['id']), json.dumps(man, ensure_ascii=False), base64.b64encode(open(glb, 'rb').read()).decode()))
    return man


def main():
    ids = sys.argv[1:]
    defs = json.load(open(os.path.join(ROOT, 'assets', 'aaa', 'urban', 'urban_defs.json')))
    lib = json.load(open(os.path.join(PIPE, 'manifests', 'materials.json')))
    tiles = {k: v['tile'] for k, v in lib.items() if isinstance(v, dict) and 'tile' in v}
    bad = 0
    for cfg in buildings(defs):
        if ids and cfg['id'] not in ids:
            continue
        m = build_one(cfg, lib, tiles)
        print('%-12s gruppi %3d  LOD0 %6d tri  %6.0f KB  %4.1f s  errori %d' % (m['id'], len(m['gruppi']), m['triangoli']['LOD0'], m['kb'], m['tempo_s'], len(m['validazione']['errori'])))
        for e in m['validazione']['errori']:
            print('   ERRORE', e)
        bad += len(m['validazione']['errori'])
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
