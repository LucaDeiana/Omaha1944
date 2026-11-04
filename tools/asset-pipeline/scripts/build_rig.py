"""Braccia FPS con scheletro: genera (fp_rig.py), UV, materiali PBR, esporta un GLB con due SkinnedMesh e valida.

    python tools/asset-pipeline/scripts/build_rig.py

Uscite: assets/aaa/arms/fp_arms_rig.glb, .json, .js (base64). Usato SOLO dalla tech demo (src/aaa/fparms.js).
Texture: pelle e lana procedurali (build_weapon.make_skin / make_fabric): nessuna texture CC0 adatta disponibile.
"""
import base64
import json
import os
import struct
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PIPE = os.path.join(ROOT, 'tools', 'asset-pipeline')
for d in ('lib', 'generators', 'validators'):
    sys.path.insert(0, os.path.join(PIPE, 'blender', d))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import build_weapon as BW  # noqa: E402

OUT = os.environ.get('RIG_OUT') or os.path.join(ROOT, 'assets', 'aaa', 'arms')


def mat(name, tex, col, rough, uv_scale):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = 0
    if not tex:
        bsdf.inputs['Base Color'].default_value = (*col, 1)
        return m
    c, n, a = tex
    def img(p, nc):
        im = bpy.data.images.load(p, check_existing=True)
        if nc:
            im.colorspace_settings.name = 'Non-Color'
        x = nt.nodes.new('ShaderNodeTexImage')
        x.image = im
        return x
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (uv_scale, uv_scale, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    ic, inn, ia = img(c, False), img(n, True), img(a, True)
    for x in (ic, inn, ia):
        nt.links.new(mp.outputs['Vector'], x.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    nt.links.new(ic.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = (*col, 1)
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(inn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(ia.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    return m


def validate(glb, man):
    E, W = [], []
    b = open(glb, 'rb').read()
    ln = struct.unpack_from('<I', b, 12)[0]
    js = json.loads(b[20:20 + ln])
    skins = js.get('skins', [])
    if len(skins) != 2:
        E.append('attese 2 armature (destra e sinistra), trovate %d' % len(skins))
    names = {n.get('name') for n in js['nodes']}
    for side in ('FPA_R', 'FPA_L'):
        if side not in names:
            E.append('armatura %s mancante' % side)
    for s in skins:
        if len(s['joints']) < 22:
            E.append('scheletro con %d ossa (attese ≥ 22)' % len(s['joints']))
    need = ['upperarm', 'forearm', 'hand'] + ['%s_%d' % (f, k) for f in ('index', 'middle', 'ring', 'pinky') for k in range(4)] + ['thumb_0', 'thumb_1', 'thumb_2']
    for n in need:
        if n not in names and not any((x or '').endswith(n) for x in names):
            E.append('osso %s mancante' % n)
    meshes = [m for m in js['meshes']]
    for m in meshes:
        for pr in m['primitives']:
            at = pr['attributes']
            if 'JOINTS_0' not in at or 'WEIGHTS_0' not in at:
                E.append('mesh %s senza pesi di skinning' % m.get('name'))
    if not js.get('images'):
        E.append('nessuna texture incorporata')
    if man['triangoli'] > 40000:
        W.append('oltre 40.000 triangoli per due braccia')
    return dict(errori=E, avvisi=W, kb=round(len(b) / 1024, 1), skins=len(skins), ossa=[len(s['joints']) for s in skins])


def build():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import fp_rig
    os.makedirs(BW.TMP, exist_ok=True)
    skin_t = BW.make_skin(*(os.path.join(BW.TMP, 'rskin_' + k + '.jpg') for k in ('c', 'n', 'orm')))
    wool_t = BW.make_fabric(*(os.path.join(BW.TMP, 'rwool_' + k + '.jpg') for k in ('c', 'n', 'orm')))
    M = {
        'skin': mat('skin', skin_t, (.86, .6, .47), .52, 6),
        'cloth': mat('cloth', wool_t, (.19, .18, .115), .95, 14),
        'nail': mat('nail', None, (.78, .6, .55), .35, 1),
        'button': mat('button', None, (.13, .12, .08), .45, 1),
    }
    res = fp_rig.generate()
    tri = 0
    bones = {}
    for side, (ao, parts, joints) in res.items():
        bones[side] = len(ao.data.bones)
        for k, ob in parts.items():
            ob.data.materials.clear()
            ob.data.materials.append(M['skin' if k == 'skin' else 'nail' if k == 'nails' else 'cloth' if k == 'sleeve' else 'button'])
            bpy.ops.object.select_all(action='DESELECT')
            bpy.context.view_layer.objects.active = ob
            ob.select_set(True)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.01)
            bpy.ops.object.mode_set(mode='OBJECT')
            tri += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, 'fp_arms_rig.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_skins=True,
                              export_all_influences=False, export_animations=False, export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=88)
    man = dict(id='fp_arms_rig', formato='omaha1944-arms-1', blender=bpy.app.version_string, triangoli=tri, ossa=bones,
               proporzioni=dict(braccio=fp_rig.UPPER, avambraccio=fp_rig.FORE), assi='glTF: Y in alto; braccio a riposo lungo -Z dalla spalla',
               texture='pelle e lana procedurali (nessuna texture CC0 adatta)', tempo_s=round(time.time() - t0, 1))
    man['validazione'] = validate(glb, man)
    json.dump(man, open(os.path.join(OUT, 'fp_arms_rig.json'), 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'fp_arms_rig.js'), 'w') as f:
        f.write('// Generato da tools/asset-pipeline/scripts/build_rig.py (non modificare a mano)\n')
        f.write('window.FPA_GLB = { manifest: %s, glb: "%s" };\n' % (json.dumps(man, ensure_ascii=False), base64.b64encode(open(glb, 'rb').read()).decode()))
    v = man['validazione']
    print('fp_arms_rig  %d tri  ossa %s  %.0f KB  errori %d  avvisi %d' % (tri, bones, v['kb'], len(v['errori']), len(v['avvisi'])))
    for e in v['errori']:
        print('  ERRORE', e)
    return 1 if v['errori'] else 0


if __name__ == '__main__':
    sys.exit(build())
