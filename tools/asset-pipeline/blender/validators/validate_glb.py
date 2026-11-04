"""Validatore degli asset GLB della pipeline (solo libreria standard: gira anche senza Blender).

    python tools/asset-pipeline/blender/validators/validate_glb.py assets/aaa/pipeline/normandy_house_01.glb

Errori = bloccanti (file corrotto, accessor fuori dai limiti, normali/UV mancanti o non valide, LOD assenti,
materiali sconosciuti al runtime, collisioni fuori dall'asset). Avvisi = raccomandazioni (budget, rapporti fra LOD).
"""
import json
import math
import os
import struct
import sys

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    b = open(path, 'rb').read()
    if len(b) < 20:
        raise ValueError('file troppo corto')
    magic, ver, length = struct.unpack_from('<4sII', b, 0)
    if magic != b'glTF':
        raise ValueError('firma glTF assente')
    if ver != 2:
        raise ValueError('versione glTF %d (attesa 2)' % ver)
    if length != len(b):
        raise ValueError('lunghezza dichiarata %d, reale %d' % (length, len(b)))
    off, js, binc = 12, None, None
    while off < len(b):
        cl, ct = struct.unpack_from('<I4s', b, off)
        chunk = b[off + 8: off + 8 + cl]
        if ct == b'JSON':
            js = json.loads(chunk.decode('utf-8'))
        elif ct == b'BIN\x00':
            binc = chunk
        off += 8 + cl
    if js is None:
        raise ValueError('chunk JSON assente')
    return js, binc or b'', len(b)


def accessor(js, binc, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    n = NCOMP[a['type']]
    stride = bv.get('byteStride', size * n)
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    end = start + stride * (a['count'] - 1) + size * n
    if end > bv.get('byteOffset', 0) + bv['byteLength'] or end > len(binc):
        raise ValueError('accessor %d fuori dai limiti del buffer' % i)
    out = []
    for k in range(a['count']):
        out.append(struct.unpack_from('<' + fmt * n, binc, start + k * stride))
    return a, out


def validate(path, manifest=None, lib=None, budget=None):
    budget = budget or {}
    E, W = [], []
    rep = dict(file=dict(percorso=os.path.relpath(path), kb=0), mesh={}, errori=E, avvisi=W)
    if not os.path.exists(path):
        E.append('file inesistente: %s' % path)
        return rep
    try:
        js, binc, size = read_glb(path)
    except Exception as e:  # noqa: BLE001
        E.append('GLB non valido: %s' % e)
        return rep
    rep['file']['kb'] = round(size / 1024, 1)
    rep['materiali'] = [m.get('name') for m in js.get('materials', [])]
    rep['texture'] = len(js.get('textures', []))
    rep['immagini'] = len(js.get('images', []))
    if rep['texture']:
        W.append('il GLB contiene %d texture: la pipeline usa la libreria condivisa a runtime' % rep['texture'])
    for img in js.get('images', []):
        if 'uri' in img and not img['uri'].startswith('data:') and not os.path.exists(os.path.join(os.path.dirname(path), img['uri'])):
            E.append('texture mancante: %s' % img['uri'])
    gmin, gmax = [1e9] * 3, [-1e9] * 3
    for mi, mesh in enumerate(js.get('meshes', [])):
        name = mesh.get('name', 'mesh%d' % mi)
        tri, prims = 0, 0
        for p in mesh['primitives']:
            prims += 1
            at = p['attributes']
            for need in ('POSITION', 'NORMAL', 'TEXCOORD_0'):
                if need not in at:
                    E.append('%s: attributo %s mancante' % (name, need))
            try:
                a, pos = accessor(js, binc, at['POSITION'])
                for v in pos:
                    if not all(math.isfinite(c) for c in v):
                        E.append('%s: posizione non finita' % name)
                        break
                for k in range(3):
                    gmin[k] = min(gmin[k], a['min'][k])
                    gmax[k] = max(gmax[k], a['max'][k])
                if 'NORMAL' in at:
                    _, nr = accessor(js, binc, at['NORMAL'])
                    badn = sum(1 for v in nr if abs(math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) - 1) > .02)
                    if badn:
                        E.append('%s: %d normali non unitarie' % (name, badn))
                if 'TEXCOORD_0' in at:
                    _, uv = accessor(js, binc, at['TEXCOORD_0'])
                    if any(not (math.isfinite(u) and math.isfinite(v)) for u, v in uv):
                        E.append('%s: UV non finite' % name)
                    if len(uv) > 3 and max(u for u, _ in uv) - min(u for u, _ in uv) < 1e-6:
                        E.append('%s: UV degeneri (tutte uguali)' % name)
                if 'indices' in p:
                    ia, idx = accessor(js, binc, p['indices'])
                    t = len(idx) // 3
                    if any(i[0] >= len(pos) for i in idx):
                        E.append('%s: indice di vertice fuori dai limiti' % name)
                else:
                    t = len(pos) // 3
                tri += t
            except Exception as e:  # noqa: BLE001
                E.append('%s: %s' % (name, e))
        rep['mesh'][name] = dict(triangoli=tri, primitive=prims)
    rep['bbox'] = dict(min=[round(v, 3) for v in gmin], max=[round(v, 3) for v in gmax], dimensioni=[round(gmax[k] - gmin[k], 3) for k in range(3)])
    # LOD
    lods = {k: v for k, v in rep['mesh'].items() if '_LOD' in k}
    for k in ('LOD0', 'LOD1', 'LOD2'):
        if not any(n.endswith(k) for n in lods):
            E.append('livello di dettaglio %s assente' % k)
    t = [next((v['triangoli'] for n, v in lods.items() if n.endswith(k)), 0) for k in ('LOD0', 'LOD1', 'LOD2')]
    if all(t):
        if not (t[0] > t[1] > t[2]):
            E.append('i LOD non riducono i triangoli: %s' % t)
        if t[1] > t[0] * .6:
            W.append('LOD1 riduce poco (%d%% di LOD0)' % (100 * t[1] // t[0]))
        if t[2] > t[1] * .6:
            W.append('LOD2 riduce poco (%d%% di LOD1)' % (100 * t[2] // t[1]))
    rep['lod_triangoli'] = t
    if budget.get('lod0_tri') and t[0] > budget['lod0_tri']:
        W.append('LOD0 %d triangoli, budget %d' % (t[0], budget['lod0_tri']))
    if budget.get('kb') and rep['file']['kb'] > budget['kb']:
        W.append('file %.0f KB, budget %d KB' % (rep['file']['kb'], budget['kb']))
    # materiali noti al runtime
    if lib is not None:
        for m in rep['materiali']:
            if m not in lib:
                E.append('materiale «%s» sconosciuto alla libreria runtime' % m)
    if budget.get('materials') and len(rep['materiali']) > budget['materials']:
        W.append('%d materiali, budget %d' % (len(rep['materiali']), budget['materials']))
    # scala plausibile e collisioni coerenti
    if manifest:
        dims = rep['bbox']['dimensioni']
        if manifest['parametri'].get('width') and abs(dims[0] - manifest['parametri']['width']) > 1.2:
            E.append('larghezza %.2f m lontana dal parametro %.2f m: scala sbagliata?' % (dims[0], manifest['parametri']['width']))
        if dims[1] < 2 or dims[1] > 20:
            E.append('altezza %.2f m non plausibile per un edificio' % dims[1])
        cols = manifest.get('collisioni', [])
        if not cols:
            E.append('nessuna collisione definita')
        for c in cols:
            if any(c['min'][k] < gmin[k] - .6 or c['max'][k] > gmax[k] + .6 for k in range(3)):
                E.append('collisione «%s» fuori dall\'asset' % c['tag'])
            if any(c['max'][k] - c['min'][k] <= 0 for k in range(3)):
                E.append('collisione «%s» degenere' % c['tag'])
        rep['collisioni'] = len(cols)
    return rep


if __name__ == '__main__':
    p = sys.argv[1]
    man = None
    mp = os.path.splitext(p)[0] + '.json'
    if os.path.exists(mp):
        man = json.load(open(mp))
    here = os.path.dirname(os.path.abspath(__file__))
    lib = json.load(open(os.path.join(here, '..', '..', 'manifests', 'materials.json')))
    r = validate(p, man, lib)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(1 if r['errori'] else 0)
