"""Kit di frattura: genera (fracture.py), valida (volume ricomposto, celle chiuse, pivot nel baricentro), esporta GLB.

    python tools/asset-pipeline/scripts/build_fracture.py

Uscite: assets/aaa/destruction/fracture_kit.glb, .json, .js (base64). Usato SOLO dalla tech demo (src/aaa/xdestruct.js).
I materiali sono quelli triplanari della demo (coordinate del mondo): il GLB porta solo geometria e normali.
"""
import base64
import json
import os
import struct
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'asset-pipeline', 'blender', 'generators'))
import bpy  # noqa: E402
import bmesh  # noqa: E402,I100

OUT = os.environ.get('FRAC_OUT') or os.path.join(ROOT, 'assets', 'aaa', 'destruction')


def check(sets):
    E, info = [], {}
    for name, objs in sets.items():
        vol, closed, n = 0.0, True, 0
        for ob in objs:
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            vol += bm.calc_volume(signed=False)
            if any(len(e.link_faces) != 2 for e in bm.edges):
                closed = False
            bm.verts.ensure_lookup_table()
            c = sum((v.co for v in bm.verts), bm.verts[0].co * 0) / len(bm.verts)
            if c.length > 1e-4:
                E.append('%s: pivot fuori dal baricentro' % ob.name)
            bm.free()
            n += 1
        info[name] = dict(celle=n, volume=round(vol, 4), chiuse=closed)
        if name != 'rubble':
            if abs(vol - 1.0) > .01:
                E.append('%s: le celle ricompongono %.3f del volume (atteso 1)' % (name, vol))
            if not closed:
                E.append('%s: celle non chiuse' % name)
    return E, info


def build():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import fracture
    sets = fracture.generate()
    E, info = check(sets)
    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, 'fracture_kit.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_texcoords=False,
                              export_normals=True, export_materials='NONE', export_animations=False)
    tri = sum(len(p.vertices) - 2 for o in bpy.data.objects for p in o.data.polygons)
    man = dict(id='fracture_kit', formato='omaha1944-fracture-1', blender=bpy.app.version_string, metodo='Voronoi (piani bisettori, celle convesse)',
               unita='cubo [-0,5; 0,5]^3 scalato a runtime; glTF Y in alto (asse y del pannello = altezza)', set=info, triangoli=tri, kb=round(os.path.getsize(glb) / 1024, 1),
               validazione=dict(errori=E), tempo_s=round(time.time() - t0, 1))
    json.dump(man, open(os.path.join(OUT, 'fracture_kit.json'), 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'fracture_kit.js'), 'w') as f:
        f.write('// Generato da tools/asset-pipeline/scripts/build_fracture.py (non modificare a mano)\n')
        f.write('window.FRAC_GLB = { manifest: %s, glb: "%s" };\n' % (json.dumps(man, ensure_ascii=False), base64.b64encode(open(glb, 'rb').read()).decode()))
    print('fracture_kit', json.dumps(info), '%d tri' % tri, '%.0f KB' % man['kb'], 'errori', len(E))
    for e in E:
        print('  ERRORE', e)
    return 1 if E else 0


if __name__ == '__main__':
    sys.exit(build())
