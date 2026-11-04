"""Pipeline delle armi: genera i tre modelli (prima persona, terza persona, mondo) con Blender, applica i materiali
PBR, aggiunge i punti di riferimento, esporta UN GLB con texture incorporate, valida e impacchetta per il runtime.

    python tools/asset-pipeline/scripts/build_weapon.py [m1garand]

Uscite: assets/weapons/<id>.glb, <id>.json (manifest), <id>.js (base64 per file://).
Texture: noce CC0 di Poly Haven (american_walnut_veneer, 1k) in tools/asset-pipeline/textures/; acciaio fosfatato
procedurale generato qui (nessuna texture CC0 adatta: le lamiere disponibili hanno bugnature, rivetti o ruggine).
"""
import base64
import math
import importlib
import json
import os
import sys
import time

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PIPE = os.path.join(ROOT, 'tools', 'asset-pipeline')
for d in ('lib', 'generators', 'validators'):
    sys.path.insert(0, os.path.join(PIPE, 'blender', d))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

OUT = os.environ.get('WPN_OUT') or os.path.join(ROOT, 'assets', 'weapons')
TEXD = os.path.join(PIPE, 'textures')
TMP = os.environ.get('WPN_TMP') or os.path.join(PIPE, '.cache')   # texture intermedie (non versionate)

MATS = {
    # nome: (texture, tinta base RGB lineare, rugosità, metallicità, scala UV in ripetizioni per metro)
    'wood': ('walnut', (0.46, 0.27, 0.15), 0.6, 0.0, 2.6),
    'steel': ('park', (0.42, 0.43, 0.41), 0.78, 0.75, 22.0),
    'steel_bright': ('park', (0.7, 0.71, 0.7), 0.42, 0.9, 22.0),
    'steel_dark': ('park', (0.12, 0.12, 0.12), 0.85, 0.4, 22.0),
    'steel_blued': ('park', (0.16, 0.17, 0.2), 0.55, 0.85, 22.0),
    'bakelite': (None, (0.055, 0.022, 0.011), 0.4, 0.0, 1.0),
    'skin': ('skin', (0.92, 0.66, 0.52), 0.55, 0.0, 30.0),
    'cloth': ('wool', (0.17, 0.16, 0.1), 0.95, 0.0, 9.0),
    'brass': (None, (0.78, 0.56, 0.24), 0.32, 1.0, 1.0),
    'copper': (None, (0.72, 0.4, 0.25), 0.36, 1.0, 1.0),
}


def make_parkerized(path_c, path_n, path_orm, size=512, seed=7):
    """Acciaio fosfatato: grana fine, chiazze, graffi lucidi sottili; normale dalla grana; ORM (occlusione, rugosità, metallo)."""
    from PIL import Image
    r = np.random.default_rng(seed)
    def smooth(a, k):
        f = np.fft.rfft2(a)
        fy = np.fft.fftfreq(a.shape[0])[:, None]
        fx = np.fft.rfftfreq(a.shape[1])[None, :]
        return np.fft.irfft2(f * np.exp(-(fx ** 2 + fy ** 2) * k), s=a.shape)
    g = r.random((size, size))
    grain = smooth(g, 2e3) * .6 + smooth(g, 2e4) * .4
    mott = smooth(r.random((size, size)), 4e5)
    grain = (grain - grain.mean()) / grain.std()
    mott = (mott - mott.mean()) / mott.std()
    scr = np.zeros((size, size))
    for _ in range(140):     # graffi: segmenti sottili quasi paralleli alla lunghezza
        x0, y0 = r.integers(0, size, 2)
        L = r.integers(8, 70)
        ang = r.normal(0, .25)
        for t in range(L):
            x = int(x0 + t * np.cos(ang)) % size
            y = int(y0 + t * np.sin(ang)) % size
            scr[y, x] = max(scr[y, x], r.uniform(.4, 1))
    base = .5 + grain * .02 + mott * .012 + scr * .035
    col = np.stack([base * .99, base * 1.0, base * .97], -1)
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(path_c, quality=88)
    h = grain * .5 + mott * .2 - scr * .6
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    n = np.stack([-dx * .25, dy * .25, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Image.fromarray(((n * .5 + .5) * 255).astype(np.uint8)).save(path_n, quality=92)
    rough = np.clip(.8 + mott * .06 + grain * .03 - scr * .45, .2, 1)
    orm = np.stack([np.clip(.92 + mott * .04, 0, 1), rough, np.clip(.85 + scr * .15, 0, 1)], -1)
    Image.fromarray((orm * 255).astype(np.uint8)).save(path_orm, quality=90)


def prep_textures():
    from PIL import Image
    os.makedirs(TMP, exist_ok=True)
    out = {}
    w = os.path.join(TEXD, 'american_walnut_veneer')
    c, n, a = (os.path.join(TMP, 'walnut_' + k + '.jpg') for k in ('c', 'n', 'orm'))
    Image.open(os.path.join(w, 'diff_1k.jpg')).convert('RGB').resize((512, 512), Image.LANCZOS).save(c, quality=86)
    Image.open(os.path.join(w, 'nor_gl_1k.jpg')).convert('RGB').resize((512, 512), Image.LANCZOS).save(n, quality=90)
    Image.open(os.path.join(w, 'arm_1k.jpg')).convert('RGB').resize((512, 512), Image.LANCZOS).save(a, quality=88)
    out['walnut'] = (c, n, a)
    pc, pn, pa = (os.path.join(TMP, 'park_' + k + '.jpg') for k in ('c', 'n', 'orm'))
    make_parkerized(pc, pn, pa)
    out['park'] = (pc, pn, pa)
    out['wool'] = make_fabric(*(os.path.join(TMP, 'wool_' + k + '.jpg') for k in ('c', 'n', 'orm')))
    out['skin'] = make_skin(*(os.path.join(TMP, 'skin_' + k + '.jpg') for k in ('c', 'n', 'orm')))
    return out


def make_fabric(pc, pn, pa, size=256, seed=3):
    """Lana di serge (giacca M1941): trama diagonale 2/2, variazioni di filo, peluria; procedurale."""
    from PIL import Image
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size]
    tw = np.sin((x + y) * 2 * np.pi / 8) * .5 + .5
    thr = np.sin(x * 2 * np.pi / 4) * .25 + .5
    h = tw * .7 + thr * .3 + r.random((size, size)) * .25
    base = .5 + (h - h.mean()) * .18
    Image.fromarray((np.clip(np.stack([base] * 3, -1), 0, 1) * 255).astype(np.uint8)).save(pc, quality=88)
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    n = np.stack([-dx * .8, dy * .8, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Image.fromarray(((n * .5 + .5) * 255).astype(np.uint8)).save(pn, quality=92)
    Image.fromarray((np.stack([np.clip(.75 + h * .25, 0, 1), np.full_like(h, .95), np.zeros_like(h)], -1) * 255).astype(np.uint8)).save(pa, quality=90)
    return pc, pn, pa


def make_skin(pc, pn, pa, size=256, seed=5):
    """Pelle: pori e micro-rughe (normale), lieve variazione di colore e di rugosità; procedurale."""
    from PIL import Image
    r = np.random.default_rng(seed)
    def smooth(a, k):
        f = np.fft.rfft2(a)
        fy = np.fft.fftfreq(a.shape[0])[:, None]
        fx = np.fft.rfftfreq(a.shape[1])[None, :]
        return np.fft.irfft2(f * np.exp(-(fx ** 2 + fy ** 2) * k), s=a.shape)
    pores = smooth(r.random((size, size)), 900)
    blot = smooth(r.random((size, size)), 2e4)
    pores = (pores - pores.mean()) / pores.std()
    blot = (blot - blot.mean()) / blot.std()
    base = .5 + blot * .03
    col = np.stack([base * 1.0, base * .97 - blot * .01, base * .95], -1)
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(pc, quality=88)
    h = pores * .4
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    n = np.stack([-dx * .5, dy * .5, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Image.fromarray(((n * .5 + .5) * 255).astype(np.uint8)).save(pn, quality=92)
    Image.fromarray((np.stack([np.ones_like(h), np.clip(.55 + pores * .05 + blot * .05, 0, 1), np.zeros_like(h)], -1) * 255).astype(np.uint8)).save(pa, quality=90)
    return pc, pn, pa


def make_material(name, tex):
    t, col, rough, metal, _ = MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if not t:
        bsdf.inputs['Base Color'].default_value = (*col, 1)
        return m
    c, n, a = tex[t]
    def img(p, non_color):
        im = bpy.data.images.load(p, check_existing=True)
        if non_color:
            im.colorspace_settings.name = 'Non-Color'
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = im
        return node
    ic = img(c, False)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    nt.links.new(ic.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = (*col, 1)
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    inn = img(n, True)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(inn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    ia = img(a, True)
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(ia.outputs['Color'], sep.inputs['Color'])
    mr = nt.nodes.new('ShaderNodeMath')
    mr.operation = 'MULTIPLY'
    nt.links.new(sep.outputs['Green'], mr.inputs[0])
    mr.inputs[1].default_value = 1.0
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    if metal > 0:
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    return m


BAKE = int(os.environ.get('WPN_BAKE', '1024'))


def bake_fp(objs, wid):
    """Cottura con Cycles sul modello in prima persona: occlusione ambientale (R) e maschera degli spigoli convessi (G)
    su un secondo set di UV senza sovrapposizioni (TEXCOORD_1). Restituisce il percorso del JPEG combinato."""
    from PIL import Image
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.render.bake.margin = 6
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        uv = o.data.uv_layers.new(name='Bake')
        o.data.uv_layers.active = uv
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    imgs = {}
    mats = {m for o in objs for m in o.data.materials}
    for kind in ('AO', 'EDGE'):
        im = bpy.data.images.new('bake_' + kind, BAKE, BAKE, alpha=False, float_buffer=False)
        im.colorspace_settings.name = 'Non-Color'
        added = []
        for m in mats:
            nt = m.node_tree
            n = nt.nodes.new('ShaderNodeTexImage')
            n.image = im
            nt.nodes.active = n
            added.append((m, n))
            if kind == 'EDGE':   # emissione temporanea = spigolosità (pointiness) rimappata
                out = next(x for x in nt.nodes if x.type == 'OUTPUT_MATERIAL')
                old = [l.from_socket for l in out.inputs['Surface'].links]
                geo = nt.nodes.new('ShaderNodeNewGeometry')
                mr = nt.nodes.new('ShaderNodeMapRange')
                mr.inputs['From Min'].default_value = .52
                mr.inputs['From Max'].default_value = .62
                em = nt.nodes.new('ShaderNodeEmission')
                nt.links.new(geo.outputs['Pointiness'], mr.inputs['Value'])
                nt.links.new(mr.outputs['Result'], em.inputs['Color'])
                nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
                added.append((m, (geo, mr, em, out, old)))
        bpy.ops.object.bake(type='AO' if kind == 'AO' else 'EMIT')
        for m, n in added:
            nt = m.node_tree
            if isinstance(n, tuple):
                geo, mr, em, out, old = n
                for x in (geo, mr, em):
                    nt.nodes.remove(x)
                for s in old:
                    nt.links.new(s, out.inputs['Surface'])
            else:
                nt.nodes.remove(n)
        p = os.path.join(TMP, '%s_%s.png' % (wid, kind))
        im.filepath_raw = p
        im.file_format = 'PNG'
        im.save()
        imgs[kind] = p
    for o in objs:   # le UV di cottura restano come secondo set; quelle delle texture tornano attive
        o.data.uv_layers.active = o.data.uv_layers['UVMap']
        o.data.uv_layers['UVMap'].active_render = True
    a = np.asarray(Image.open(imgs['AO']).convert('L'), dtype=np.float32)
    e = np.asarray(Image.open(imgs['EDGE']).convert('L'), dtype=np.float32)
    out = np.stack([a, e, np.full_like(a, 255)], -1).astype(np.uint8)
    path = os.path.join(TMP, wid + '_bake.jpg')
    Image.fromarray(out).save(path, quality=90)
    return path


def build(wid):
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tex = prep_textures()
    cache = {}
    def mats(n):
        if n not in cache:
            cache[n] = make_material(n, tex)
        return cache[n]
    gen = importlib.import_module(wid)
    root = bpy.data.objects.new(wid, None)
    bpy.context.scene.collection.objects.link(root)
    info = {}
    for lod, tag in ((('fp', 'FP'),) if wid == 'fp_arms' else (('fp', 'FP'), ('tp', 'TP'), ('wd', 'WD'))):
        g = gen.generate(lod)
        grp = bpy.data.objects.new(tag, None)
        bpy.context.scene.collection.objects.link(grp)
        grp.parent = root
        info[tag] = {}
        for pname, part in g.parts.items():
            if not part.f:
                continue
            # UV in metri -> ripetizioni per materiale
            for i, mname in enumerate(part.m):
                sc = MATS[mname][4]
                part.uv[i] = [(u * sc, v * sc) for u, v in part.uv[i]]
            pv = Vector(g.pivots.get(pname, (0, 0, 0))) if lod == 'fp' else Vector((0, 0, 0))
            ob = part.to_object(mats, pivot=Vector(pv))
            ob.name = '%s_%s' % (tag, pname)
            ob.data.name = ob.name
            ob.parent = grp
            info[tag][pname] = part.tris()
        if lod == 'fp':
            for en, pos in g.empties.items():
                e = bpy.data.objects.new('PT_' + en, None)
                e.location = Vector(pos)
                bpy.context.scene.collection.objects.link(e)
                e.parent = grp
            empties = {k: [round(v, 5) for v in (p[0], p[2], -p[1])] for k, p in g.empties.items()}
            pivots = {k: [round(v, 5) for v in (p[0], p[2], -p[1])] for k, p in g.pivots.items()}
    fp_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('FP_')]
    bake_path = bake_fp(fp_objs, wid) if BAKE else None
    lenm = 0.0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o.name.startswith('WD_'):
            ys = [(o.matrix_world @ v.co).y for v in o.data.vertices]
            lenm = max(ys) - min(ys)
    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, wid + '.glb')
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
                              export_jpeg_quality=88, export_extras=True, export_cameras=False, export_lights=False, export_animations=False)
    man = dict(id=wid, formato='omaha1944-weapon-1', blender=bpy.app.version_string, unita='metri',
               assi='glTF: canna verso -Z, alto +Y, origine sul grilletto (stesso sistema di src/guns.js)',
               triangoli={k: sum(v.values()) for k, v in info.items()}, lunghezza_m=round(lenm, 3), parti=info, punti=empties, perni=pivots,
               materiali=list(MATS.keys()), texture=dict(legno='Poly Haven american_walnut_veneer (CC0, Jenelle van Heerden)', acciaio='procedurale (build_weapon.py)'),
               tempo_s=round(time.time() - t0, 2))
    import validate_glb  # noqa: E402
    rep = validate_glb.validate_weapon(glb, man) if wid != 'fp_arms' else validate_glb.validate(glb)
    if wid == 'fp_arms':
        rep['errori'] = [e for e in rep['errori'] if 'livello' not in e and 'LOD' not in e]
        rep['avvisi'] = [w for w in rep['avvisi'] if 'texture' not in w]
    man['validazione'] = dict(errori=rep['errori'], avvisi=rep['avvisi'], kb=rep['file']['kb'])
    json.dump(man, open(os.path.join(OUT, wid + '.json'), 'w'), ensure_ascii=False, indent=1)
    data = open(glb, 'rb').read()
    with open(os.path.join(OUT, wid + '.js'), 'w') as f:
        f.write("// Generato da tools/asset-pipeline/scripts/build_weapon.py (non modificare a mano)\n")
        bk = ('data:image/jpeg;base64,' + base64.b64encode(open(bake_path, 'rb').read()).decode()) if bake_path else ''
        f.write('(window.WPN_GLB = window.WPN_GLB || {})[%s] = { manifest: %s, glb: "%s", bake: "%s" };\n' % (json.dumps(wid), json.dumps(man, ensure_ascii=False), base64.b64encode(data).decode(), bk))
    return man, rep


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('-')] or ['m1garand', 'thompson', 'mp40', 'kar98k', 'fp_arms']
    bad = 0
    for w in ids:
        man, rep = build(w)
        print('%-10s FP %6d  TP %5d  WD %4d tri  %6.0f KB  errori %d  avvisi %d' % (w, man['triangoli']['FP'], man['triangoli'].get('TP', 0), man['triangoli'].get('WD', 0), rep['file']['kb'], len(rep['errori']), len(rep['avvisi'])))
        for e in rep['errori']:
            print('   ERRORE', e)
        for e in rep['avvisi']:
            print('   avviso', e)
        bad += len(rep['errori'])
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
