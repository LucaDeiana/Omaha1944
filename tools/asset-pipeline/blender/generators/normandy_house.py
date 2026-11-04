"""Casa rurale normanna (Bessin/Cotentin, anni '40) — generatore parametrico per Blender (bpy).

Uso (dalla radice del repository):
    python tools/asset-pipeline/scripts/build.py normandy_house_01
oppure con Blender installato:
    blender --background --python tools/asset-pipeline/scripts/build.py -- normandy_house_01

Riferimenti architettonici seguiti (longère del Bessin): pianta rettangolare 10–14 × 6–7 m, un piano più sottotetto,
muri portanti in pietrame calcareo spessi 50–60 cm, cantonali e mostre delle aperture in pietra da taglio chiara
(pietra di Caen), architravi monolitici, davanzali sporgenti con gocciolatoio, tetto a due falde molto inclinato
(45–55°) in ardesia con colmo in coppi di terracotta, comignoli sui timpani, finestre a due ante con scuri di legno
a doghe verticali e traverse a «Z», porta a doghe con bandelle di ferro, pavimento a lastre di pietra, solaio a
travetti di quercia a vista, camino con cappa intonacata e trave di quercia.

Convenzioni: metri, Z in alto in Blender (Y in alto dopo l'esportazione glTF), origine al centro della pianta a quota
del terreno (0 = piano di campagna davanti alla porta), facciata principale verso -Y in Blender (+Z in glTF).
Stesso seme e stessi parametri => stessa casa (tutto il caso passa da random.Random(seed) e dal rumore Noise(seed)).
"""
import math
import random
import sys
import os

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from geo import Geo, Noise, box_bm, cyl_bm, mat_at  # noqa: E402

ALL = ('LOD0', 'LOD1', 'LOD2')
L01 = ('LOD0', 'LOD1')
L0 = ('LOD0',)

DEFAULTS = dict(
    seed=1944,
    width=12.4,          # lunghezza lungo la facciata (m)
    depth=6.6,           # profondità (m)
    wall=0.55,           # spessore dei muri
    eave=3.35,           # quota della gronda (sommità dei muri)
    floor=0.25,          # quota del pavimento interno (gradino d'ingresso)
    ceiling=2.80,        # intradosso del tavolato del solaio
    pitch=50.0,          # inclinazione delle falde (gradi)
    overhang=0.32,       # sporto di gronda
    verge=0.14,          # sporto sui timpani
    front_windows=3,     # finestre sulla facciata (oltre alla porta)
    back_windows=2,
    door_slot=1,         # posizione della porta fra le aperture della facciata (0 = prima a sinistra)
    chimneys='both',     # 'both' | 'left' | 'right'
    wear=0.45,           # 0 = ben tenuta, 1 = molto degradata
    shutters_open=0.8,   # frazione di scuri aperti
    slate_exposure=0.165,
)


class Wall:
    """Muro rettilineo. a = coordinata lungo il muro, d = profondità dalla faccia esterna (0) verso l'interno (T)."""

    def __init__(self, axis, fixed, out, a0, a1, T):
        self.axis, self.fixed, self.out, self.a0, self.a1, self.T = axis, fixed, out, a0, a1, T

    def w(self, a, d, z):
        p = self.fixed - self.out * d
        return Vector((a, p, z)) if self.axis == 'x' else Vector((p, a, z))

    def n_out(self):
        return Vector((0, self.out, 0)) if self.axis == 'x' else Vector((self.out, 0, 0))

    def along(self):
        return Vector((1, 0, 0)) if self.axis == 'x' else Vector((0, 1, 0))

    def rz(self):
        """Rotazione attorno a Z che porta l'asse X locale lungo il muro e -Y locale verso l'esterno."""
        if self.axis == 'x':
            return 0.0 if self.out < 0 else math.pi
        return -math.pi / 2 if self.out > 0 else math.pi / 2

    def aabb(self, a0, a1, d0, d1, z0, z1):
        p, q = self.w(a0, d0, z0), self.w(a1, d1, z1)
        return (min(p.x, q.x), min(p.y, q.y), min(p.z, q.z)), (max(p.x, q.x), max(p.y, q.y), max(p.z, q.z))


class House:
    def __init__(self, **kw):
        self.p = dict(DEFAULTS, **kw)
        P = self.p
        self.r = random.Random(P['seed'])
        self.noise = Noise(P['seed'])
        self.g = Geo(tiles=self.p.get('_tiles'))
        self.col = []          # collisioni: dict(min, max, tag, walk)
        self.rooms = []        # volumi interni (luce indiretta ridotta a runtime)
        self.floors = []       # superfici calpestabili: dict(x0, x1, y0, y1, z[, ramp]) in coordinate Blender
        self.stats = {}
        W, D, T = P['width'], P['depth'], P['wall']
        self.W, self.D, self.T = W, D, T
        self.tp = math.tan(math.radians(P['pitch']))
        self.zr = P['eave'] + 0.05 + (D / 2) * self.tp        # intradosso del colmo sulla faccia esterna

    # ------------------------------------------------------------------ utilità
    def quad(self, lods, mat, pts, want, smooth=False, uvoff=(0, 0)):
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.dot(want) < 0:
            pts = list(reversed(pts))
        self.g.poly(lods, mat, pts, uvoff, smooth=smooth)

    def box(self, lods, mn, mx, mat, skip=()):
        """Scatola allineata agli assi; mat: nome o funzione(normale) -> nome."""
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        V = lambda x, y, z: Vector((x, y, z))
        faces = {
            '-x': ([V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), V(x0, y0, z1)], V(-1, 0, 0)),
            '+x': ([V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1)], V(1, 0, 0)),
            '-y': ([V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)], V(0, -1, 0)),
            '+y': ([V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)], V(0, 1, 0)),
            '-z': ([V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)], V(0, 0, -1)),
            '+z': ([V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)], V(0, 0, 1)),
        }
        off = (self.r.random() * 5, self.r.random() * 5)
        for k, (pts, n) in faces.items():
            if k in skip:
                continue
            m = mat(n) if callable(mat) else mat
            self.quad(lods, m, pts, n, uvoff=off)

    def bevbox(self, lods, size, M, mat, bevel, uvoff=None):
        bm = box_bm(*size, bevel=bevel)
        grain = None
        if mat in ('wood', 'oak_beam', 'wood_paint'):
            k = max(range(3), key=lambda i: size[i])
            grain = (M.to_3x3() @ Vector([1.0 if i == k else 0.0 for i in range(3)])).normalized()
        self.g.bm(lods, bm, mat, M, uvoff=uvoff, rng=self.r, grain=grain)
        bm.free()

    def solid(self, mn, mx, tag, walk=False):
        self.col.append(dict(min=[round(v, 4) for v in mn], max=[round(v, 4) for v in mx], tag=tag, walk=walk))

    # ------------------------------------------------------------------ muri
    def wall_block(self, F, a0, a1, z0, z1, lod_detail=True, inner='plaster_int', outer='stone', walk=False):
        """Blocco di muratura da faccia esterna (spostata dal rumore: muro non perfettamente piano) a faccia interna."""
        T, wear = F.T, self.p['wear']
        if a1 - a0 < 0.01 or z1 - z0 < 0.01:
            return
        N = F.n_out()
        amp = 0.010 + wear * 0.018
        def disp(a, z):
            pw = F.w(a, 0, z)
            fade = min(1.0, (a - a0) / .05, (a1 - a) / .05, (z - z0) / .05, (z1 - z) / .05)
            fade = max(0.0, fade)
            n = self.noise(pw.x * .9, pw.y * .9, pw.z * .9) * .6 + self.noise(pw.x * 3.1, pw.y * 3.1, pw.z * 3.1) * .4
            return N * (n * amp * fade)
        # faccia esterna: griglia spostata (LOD0), piana (LOD1/LOD2)
        na, nz = max(1, round((a1 - a0) / .35)), max(1, round((z1 - z0) / .35))
        for i in range(na):
            for j in range(nz):
                A0, A1 = a0 + (a1 - a0) * i / na, a0 + (a1 - a0) * (i + 1) / na
                Z0, Z1 = z0 + (z1 - z0) * j / nz, z0 + (z1 - z0) * (j + 1) / nz
                pts = [F.w(A0, 0, Z0) + disp(A0, Z0), F.w(A1, 0, Z0) + disp(A1, Z0), F.w(A1, 0, Z1) + disp(A1, Z1), F.w(A0, 0, Z1) + disp(A0, Z1)]
                self.quad(L0, outer, pts, N, smooth=True)
        self.quad(('LOD1', 'LOD2'), outer, [F.w(a0, 0, z0), F.w(a1, 0, z0), F.w(a1, 0, z1), F.w(a0, 0, z1)], N)
        # faccia interna e spalle
        self.quad(ALL, inner, [F.w(a0, T, z0), F.w(a1, T, z0), F.w(a1, T, z1), F.w(a0, T, z1)], -N)
        A = F.along()
        self.quad(ALL, 'stone', [F.w(a0, 0, z0), F.w(a0, T, z0), F.w(a0, T, z1), F.w(a0, 0, z1)], -A)
        self.quad(ALL, 'stone', [F.w(a1, 0, z0), F.w(a1, T, z0), F.w(a1, T, z1), F.w(a1, 0, z1)], A)
        self.quad(ALL, 'stone', [F.w(a0, 0, z1), F.w(a1, 0, z1), F.w(a1, T, z1), F.w(a0, T, z1)], Vector((0, 0, 1)))
        self.quad(ALL, 'stone', [F.w(a0, 0, z0), F.w(a1, 0, z0), F.w(a1, T, z0), F.w(a0, T, z0)], Vector((0, 0, -1)))
        mn, mx = F.aabb(a0, a1, 0, T, z0, z1)
        self.solid(mn, mx, 'soglia' if walk else 'muro', walk=walk)

    def wall_with_openings(self, F, z0, z1, openings):
        """openings: lista di dict(c, w, z0, z1). Il muro viene diviso in blocchi attorno alle aperture."""
        ops = sorted(openings, key=lambda o: o['c'])
        a = F.a0
        for o in ops:
            l, r = o['c'] - o['w'] / 2, o['c'] + o['w'] / 2
            self.wall_block(F, a, l, z0, z1)
            self.wall_block(F, l, r, z0, o['z0'], walk=o.get('kind') == 'door')   # sotto la porta si cammina
            self.wall_block(F, l, r, o['z1'], z1)
            a = r
        self.wall_block(F, a, F.a1, z0, z1)

    # ------------------------------------------------------------------ pietra da taglio
    def quoins(self):
        """Cantonali: blocchi alternati lunghi/corti sulle due facce di ogni spigolo, leggermente sporgenti."""
        P, W, D = self.p, self.W, self.D
        z, k = P['floor'] - 0.05, 0
        heights = []
        while z < P['eave'] - 0.12:
            h = min(self.r.uniform(.28, .36), P['eave'] - z)
            heights.append((z, h))
            z += h
        for sx in (-1, 1):
            for sy in (-1, 1):
                for k, (z, h) in enumerate(heights):
                    long_x = (k % 2 == 0) ^ (sx * sy > 0)
                    Lx, Ly = (.56, .30) if long_x else (.30, .56)
                    pr = .022 + self.r.uniform(-.004, .006)
                    zc, hh = z + h / 2, h - .012
                    rot = self.r.uniform(-.006, .006)
                    # blocco sulla faccia ±Y (facciata/retro)
                    cx = sx * (W / 2 - Lx / 2) + sx * pr
                    cy = sy * (D / 2 + pr - .14)
                    self.bevbox(L01, (Lx + pr * 2, .28, hh), mat_at((cx, cy, zc), rz=rot), 'quoin', .014)
                    # blocco sulla faccia ±X (timpano)
                    cx2 = sx * (W / 2 + pr - .14)
                    cy2 = sy * (D / 2 - Ly / 2) + sy * pr
                    self.bevbox(L01, (.28, Ly + pr * 2, hh), mat_at((cx2, cy2, zc), rz=rot), 'quoin', .014)

    def surround(self, F, o, kind):
        """Mostra di pietra: stipiti a blocchi alternati, architrave monolitico, davanzale con gocciolatoio."""
        c, w, z0, z1 = o['c'], o['w'], o['z0'], o['z1']
        rz = F.rz()
        pr = .02
        def put(a, d, z, sa, sd, sz, bev=.012, lods=L01):
            M = mat_at(F.w(a, d, z), rz=rz)
            self.bevbox(lods, (sa, sd, sz), M, 'quoin', bev)
        # stipiti
        z, k = z0 if kind == 'window' else z0, 0
        while z < z1 - .05:
            h = min(self.r.uniform(.26, .34), z1 - z)
            wa = .30 if k % 2 == 0 else .20
            for s in (-1, 1):
                a = c + s * (w / 2 + wa / 2 - .01)
                put(a, .13 - pr, z + h / 2, wa, .26 + pr * 2, h - .01)
            z += h
            k += 1
        # architrave (leggermente arcuato sul bordo inferiore in LOD0: smusso più ampio)
        lh = .30
        put(c, .14 - pr, z1 + lh / 2, w + .62, .28 + pr * 2, lh, bev=.018)
        mn, mx = F.aabb(c - w / 2 - .31, c + w / 2 + .31, -pr, .28, z1, z1 + lh)
        if kind == 'window':
            # davanzale sporgente con gocciolatoio
            put(c, .14 - .07, z0 - .045, w + .22, .28 + .14, .09, bev=.012, lods=ALL)
            M = mat_at(F.w(c, -.05, z0 - .095), rz=rz)
            self.bevbox(L0, (w + .2, .04, .012), M, 'quoin', .004)
        else:
            # soglia di pietra nel vano della porta
            put(c, F.T / 2, self.p['floor'] / 2, w + .02, F.T + .02, self.p['floor'], bev=.01, lods=ALL)

    # ------------------------------------------------------------------ serramenti
    def window(self, F, o):
        c, w, z0, z1 = o['c'], o['w'], o['z0'], o['z1']
        rz, T = F.rz(), F.T
        d0 = .11                                    # infisso arretrato rispetto al filo esterno
        def put(lods, a, d, z, sa, sd, sz, mat, bev=.004):
            self.bevbox(lods, (sa, sd, sz), mat_at(F.w(a, d, z), rz=rz), mat, bev)
        fw = .065
        # telaio fisso
        for s in (-1, 1):
            put(L01, c + s * (w / 2 - fw / 2), d0 + .035, (z0 + z1) / 2, fw, .07, z1 - z0, 'wood_paint')
        put(L01, c, d0 + .035, z1 - fw / 2, w, .07, fw, 'wood_paint')
        put(L01, c, d0 + .035, z0 + fw / 2, w, .07, fw, 'wood_paint')
        # due ante con traverse: tre lastre per anta
        lw = (w - 2 * fw) / 2
        for s in (-1, 1):
            ac = c + s * lw / 2
            for t in (-1, 1):
                put(L0, ac + t * (lw / 2 - .025), d0 + .05, (z0 + z1) / 2, .05, .045, z1 - z0 - 2 * fw, 'wood_paint', .003)
            gz0, gz1 = z0 + fw, z1 - fw
            for i in range(1, 3):
                put(L0, ac, d0 + .05, gz0 + (gz1 - gz0) * i / 3, lw - .05, .035, .028, 'wood_paint', .003)
            put(L0, ac, d0 + .05, gz0 + .025, lw, .045, .05, 'wood_paint', .003)
            put(L0, ac, d0 + .05, gz1 - .025, lw, .045, .05, 'wood_paint', .003)
        # vetro (una lastra sottile per apertura; doppia faccia a runtime)
        N = F.n_out()
        gd = d0 + .05
        gpts = [F.w(c - w / 2 + fw, gd, z0 + fw), F.w(c + w / 2 - fw, gd, z0 + fw), F.w(c + w / 2 - fw, gd, z1 - fw), F.w(c - w / 2 + fw, gd, z1 - fw)]
        self.quad(L01, 'glass', gpts, N)
        # da lontano: vano scuro al posto di vetro e infisso
        self.quad(('LOD2',), 'glass_far', [F.w(c - w / 2, .06, z0), F.w(c + w / 2, .06, z0), F.w(c + w / 2, .06, z1), F.w(c - w / 2, .06, z1)], N)
        # tavola interna del davanzale
        put(L01, c, (d0 + .08 + T + .03) / 2, z0 - .02, w + .04, T + .03 - d0 - .08, .04, 'wood')
        # collisione del vano (non si passa dalla finestra)
        mn, mx = F.aabb(c - w / 2, c + w / 2, 0, T, z0, z1)
        self.solid(mn, mx, 'finestra')
        self.shutters(F, o)

    def shutters(self, F, o):
        """Scuri a doghe verticali con traverse e controvento a Z, bandelle di ferro; aperti contro il muro."""
        c, w, z0, z1 = o['c'], o['w'], o['z0'], o['z1']
        P = self.p
        h = z1 - z0 + .02
        sw = w / 2 + .03
        for s in (-1, 1):
            if self.r.random() > P['shutters_open']:
                state = 'closed'
            else:
                state = 'open'
            if P['wear'] > .55 and self.r.random() < (P['wear'] - .5) * .5:
                state = 'missing'
            if state == 'missing':
                continue
            hinge_a = c + s * (w / 2)
            if state == 'open':
                ang = math.radians(self.r.uniform(6, 22))        # quasi aderenti al muro
                sag = math.radians(self.r.uniform(0, 3.5) * P['wear'])
            else:
                ang, sag = math.pi - math.radians(self.r.uniform(0, 4)), 0.0
            # matrice: origine sulla cerniera (filo esterno, -4.5 cm), asse X locale lungo lo scuro verso l'esterno dell'apertura
            base = mat_at(F.w(hinge_a, -.045, z0 + h / 2 - .01), rz=F.rz())
            flip = Matrix.Scale(-1, 4, Vector((1, 0, 0))) if s < 0 else Matrix.Identity(4)
            M = base @ flip @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Rotation(sag, 4, 'Y')
            nb, gap = 4, .004
            bw = (sw - gap * (nb - 1)) / nb
            for i in range(nb):
                x = bw / 2 + i * (bw + gap)
                dz = self.r.uniform(-.006, .006)
                self.bevbox(L0, (bw, .024, h + dz), M @ Matrix.Translation((x, 0, dz / 2)), 'wood_paint', .003)
            self.bevbox(('LOD1', 'LOD2'), (sw, .024, h), M @ Matrix.Translation((sw / 2, 0, 0)), 'wood_paint', 0)
            # traverse e controvento (sulla faccia rivolta all'apertura quando chiuso, quindi verso l'esterno quando aperto)
            for zz in (-h / 2 + .14, 0, h / 2 - .14):
                self.bevbox(L0, (sw - .04, .026, .1), M @ Matrix.Translation((sw / 2, -.024, zz)), 'wood_paint', .004)
            for zl, zh in ((-h / 2 + .14, 0), (0, h / 2 - .14)):
                L = math.hypot(sw - .1, zh - zl)
                a = math.atan2(zh - zl, sw - .1)
                self.bevbox(L0, (L, .024, .085), M @ Matrix.Translation((sw / 2, -.024, (zl + zh) / 2)) @ Matrix.Rotation(-a, 4, 'Y'), 'wood_paint', .004)
            # bandelle di ferro e cardini
            for zz in (-h / 2 + .14, h / 2 - .14):
                self.bevbox(L0, (sw * .7, .01, .04), M @ Matrix.Translation((sw * .35, -.04, zz)), 'iron', .002)
                bm = cyl_bm(.012, .07, 6)
                self.g.bm(L0, bm, 'iron', M @ Matrix.Translation((0, -.01, zz)), rng=self.r)
                bm.free()

    def door(self, F, o):
        c, w, z0, z1 = o['c'], o['w'], o['z0'], o['z1']
        T, rz = F.T, F.rz()
        # telaio di quercia sul filo interno
        def put(lods, a, d, z, sa, sd, sz, mat, bev=.005, M0=None):
            M = mat_at(F.w(a, d, z), rz=rz)
            self.bevbox(lods, (sa, sd, sz), M, mat, bev)
        for s in (-1, 1):
            put(L01, c + s * (w / 2 - .05), T - .09, (z0 + z1) / 2, .1, .14, z1 - z0, 'oak_beam')
        put(L01, c, T - .09, z1 - .06, w, .14, .12, 'oak_beam')
        # anta a doghe aperta verso l'interno di ~100°, incernierata sullo stipite sinistro
        lw, lh = w - .16, z1 - z0 - .12
        hinge = F.w(c - w / 2 + .1, T - .16, z0 + lh / 2 + .005)
        ang = math.radians(self.r.uniform(95, 108))
        M = mat_at(hinge, rz=rz) @ Matrix.Rotation(-ang, 4, 'Z')
        nb = 5
        bw = lw / nb
        for i in range(nb):
            self.bevbox(L0, (bw - .004, .045, lh + self.r.uniform(-.004, .004)), M @ Matrix.Translation((bw / 2 + i * bw, 0, 0)), 'wood', .004)
        self.bevbox(('LOD1',), (lw, .045, lh), M @ Matrix.Translation((lw / 2, 0, 0)), 'wood', 0)
        for zz in (-lh / 2 + .2, 0, lh / 2 - .2):
            self.bevbox(L0, (lw - .06, .03, .12), M @ Matrix.Translation((lw / 2, .037, zz)), 'wood', .005)
        for zz in (-lh / 2 + .2, lh / 2 - .2):           # bandelle sul lato esterno
            self.bevbox(L0, (lw * .75, .008, .05), M @ Matrix.Translation((lw * .375, -.027, zz)), 'iron', .002)
        bm = cyl_bm(.035, .012, 10)                       # piastra e anello della maniglia
        self.g.bm(L0, bm, 'iron', M @ Matrix.Translation((lw - .1, -.03, 0)) @ Matrix.Rotation(math.pi / 2, 4, 'X'), rng=self.r)
        bm.free()
        # gradino esterno di pietra
        st = F.aabb(c - w / 2 - .25, c + w / 2 + .25, -.42, 0, 0, .13)
        self.bevbox(ALL, (st[1][0] - st[0][0], st[1][1] - st[0][1], .13), Matrix.Translation(((st[0][0] + st[1][0]) / 2, (st[0][1] + st[1][1]) / 2, .065)), 'stone_wet', .015)
        self.solid(st[0], (st[1][0], st[1][1], .13), 'gradino', walk=True)
        self.floors.append(dict(x0=st[0][0], x1=st[1][0], y0=st[0][1], y1=st[1][1], z=.13))
        mn, mx = F.aabb(c - w / 2, c + w / 2, 0, T, 0, z0)
        self.solid(mn, mx, 'soglia', walk=True)
        self.floors.append(dict(x0=mn[0], x1=mx[0], y0=mn[1], y1=mx[1], z=z0))

    # ------------------------------------------------------------------ tetto
    def roof(self):
        P, W, D = self.p, self.W, self.D
        tp, ov, gv = self.tp, P['overhang'], P['verge']
        pitch = math.radians(P['pitch'])
        cs, sn = math.cos(pitch), math.sin(pitch)
        x0, x1 = -W / 2 - gv, W / 2 + gv
        zE = P['eave'] + .05
        deck = .2                                     # puntoni + tavolato
        for sy in (-1, 1):
            # piano della falda: punto all'altezza della gronda sulla faccia esterna, salita verso y=0
            ye = sy * (D / 2 + ov)
            ze = zE - ov * tp
            yr, zr = 0.0, self.zr
            s_len = math.hypot(ye - yr, ze - zr)
            up = Vector((0, -sy * cs, sn))          # lungo la falda verso il colmo
            nrm = Vector((0, sy * sn, cs))          # normale verso l'esterno/alto
            E0 = Vector((0, ye, ze))
            # tavolato (spessore deck sotto il piano delle ardesie)
            pts_top = [Vector((x0, ye, ze)), Vector((x1, ye, ze)), Vector((x1, yr, zr)), Vector((x0, yr, zr))]
            pts_bot = [p - nrm * deck for p in pts_top]
            self.quad(ALL, 'oak_beam', pts_bot, -nrm)
            self.quad(ALL, 'oak_beam', [pts_top[0], pts_top[1], pts_bot[1], pts_bot[0]], Vector((0, sy, -.3)))
            for i, sx in ((0, -1), (1, 1)):
                a, b = (0, 3) if sx < 0 else (1, 2)
                self.quad(ALL, 'oak_beam', [pts_top[a], pts_top[b], pts_bot[b], pts_bot[a]], Vector((sx, 0, 0)))
            self.quad(('LOD2',), 'slate_far', pts_top, nrm)
            # corsi di ardesia
            ex = P['slate_exposure']
            n_course = int(s_len / ex) + 1
            slates = 0
            for i in range(n_course):
                s0 = i * ex
                if s0 > s_len - .02:
                    break
                L = min(ex * 2.1, s_len - s0 + .02)
                tilt = math.atan2(.011, L)
                lift = .012 if i else .02
                # LOD1: un listello per corso
                c1 = E0 + up * (s0 + L / 2) + nrm * (lift * .5 + .004)
                Mr = Matrix((Vector((1, 0, 0)), up, nrm)).transposed().to_4x4()
                Mc = Matrix.Translation(c1) @ Mr @ Matrix.Rotation(tilt, 4, 'X')
                self.bevbox(('LOD1',), (x1 - x0, L, .012), Mc, 'slate', 0)
                # LOD0: ardesie singole con larghezza, rotazione e quota variabili; qualcuna mancante se usurata
                x = x0 - (self.r.uniform(.05, .14) if i % 2 else 0)
                while x < x1 - .02:
                    sw = self.r.uniform(.22, .3)
                    xa, xb = max(x, x0), min(x + sw, x1)
                    x += sw + .006
                    if xb - xa < .04:
                        continue
                    if self.r.random() < P['wear'] * .012 and 2 < i < n_course - 3:
                        continue
                    cc = E0 + up * (s0 + L / 2) + nrm * (lift * .5 + self.r.uniform(-.002, .002))
                    cc.x = (xa + xb) / 2
                    M = Matrix.Translation(cc) @ Mr @ Matrix.Rotation(self.r.uniform(-.02, .02), 4, 'Z') @ Matrix.Rotation(tilt + self.r.uniform(-.01, .01), 4, 'X')
                    self.slate(M, xb - xa, L + self.r.uniform(-.01, .005), .009)
                    slates += 1
            self.stats['ardesie_falda_%s' % ('anteriore' if sy < 0 else 'posteriore')] = slates
            # puntoni a vista sotto lo sporto di gronda
            nr = int((W) / .55)
            for k in range(nr + 1):
                xx = -W / 2 + .2 + k * (W - .4) / nr
                c = Vector((xx, sy * (D / 2 + ov / 2), zE - ov / 2 * tp)) - nrm * (deck * .5 + .03)
                M = Matrix.Translation(c) @ Mr
                self.bevbox(L0, (.075, ov / cs + .05, .13), M, 'oak_beam', .008)
            # tavola di bordo (frontalino) e grondaia
            fc = E0 - nrm * (deck * .5)
            self.bevbox(L01, (x1 - x0, .03, deck + .02), Matrix.Translation(fc) @ Mr @ Matrix.Rotation(-math.pi / 2 + pitch, 4, 'X'), 'wood', .004)
            self.gutter(sy, x0 + .05, x1 - .05, Vector((0, ye + sy * .06, ze - .1)))
        # colmo: coppi di terracotta allettati con malta
        n = int((x1 - x0) / .38) + 1
        for k in range(n):
            xx = x0 + .19 + k * (x1 - x0 - .38) / max(1, n - 1)
            bm = cyl_bm(.125, .42, 10, r2=.11)
            M = Matrix.Translation((xx, 0, self.zr + .035)) @ Matrix.Rotation(math.pi / 2 + self.r.uniform(-.03, .03), 4, 'Y')
            self.g.bm(L0, bm, 'clay', M, rng=self.r, smooth=True)
            bm.free()
        bm = cyl_bm(.12, x1 - x0, 6)
        self.g.bm(('LOD1', 'LOD2'), bm, 'clay', Matrix.Translation((0, 0, self.zr + .035)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'), rng=self.r)
        bm.free()
        # bandinelle sui timpani
        for sx in (-1, 1):
            for sy in (-1, 1):
                ye, ze = sy * (D / 2 + .05), zE - .05 * tp
                a = Vector((sx * (x1 + .01), ye, ze + .02))
                b = Vector((sx * (x1 + .01), 0, self.zr + .02))
                c = (a + b) / 2
                L = (b - a).length
                ang = math.atan2(b.z - a.z, -(b.y - a.y) * -sy) if sy else 0
                M = Matrix.Translation(c) @ Matrix.Rotation(-sy * pitch, 4, 'X')
                self.bevbox(L01, (.035, L, .2), M, 'wood', .006)

    def gutter(self, sy, xa, xb, c):
        """Grondaia semicircolare di ghisa (profilo estruso) su cicogne, pluviale su un angolo."""
        r, t, seg = .065, .006, 8
        prof = []
        for i in range(seg + 1):
            a = math.pi + math.pi * i / seg
            prof.append((math.cos(a) * r, math.sin(a) * r))
        inner = [(x * (r - t) / r, z * (r - t) / r) for x, z in prof]
        loop = prof + list(reversed(inner))
        for i in range(len(loop)):
            (y0, z0), (y1, z1) = loop[i], loop[(i + 1) % len(loop)]
            pts = [Vector((xa, c.y + y0 * sy, c.z + z0)), Vector((xb, c.y + y0 * sy, c.z + z0)), Vector((xb, c.y + y1 * sy, c.z + z1)), Vector((xa, c.y + y1 * sy, c.z + z1))]
            mid = Vector((0, (y0 + y1) / 2 * sy, (z0 + z1) / 2))
            want = mid if i < seg else -mid
            self.quad(L01, 'iron', pts, want if want.length > 1e-6 else Vector((0, 0, 1)))
        if sy < 0:
            # pluviale sull'angolo destro della facciata
            px, py = xb - .12, c.y + .02
            bm = cyl_bm(.042, c.z - .2, 8)
            self.g.bm(L01, bm, 'iron', Matrix.Translation((px, py, (c.z + .2) / 2 - .02)), rng=self.r, smooth=True)
            bm.free()
            for zz in (.8, 1.9, 2.9):
                self.bevbox(L0, (.03, .1, .025), Matrix.Translation((px, py + .05 * -sy * -1, zz)), 'iron', .003)
            self.solid((px - .05, py - .05, 0), (px + .05, py + .05, c.z), 'pluviale')

    def gables(self):
        P, W, D, T = self.p, self.W, self.D, self.T
        zE = P['eave']
        for sx in (-1, 1):
            xo, xi = sx * W / 2, sx * (W / 2 - T)
            def zt(y):
                return zE + .05 + (D / 2 - abs(y)) * self.tp - .02
            ys = [-D / 2 + k * D / 12 for k in range(13)]
            for xx, want in ((xo, Vector((sx, 0, 0))), (xi, Vector((-sx, 0, 0)))):
                pts = [Vector((xx, D / 2, zE)), Vector((xx, -D / 2, zE))] + [Vector((xx, y, zt(y))) for y in ys]
                mat = 'stone' if want.x * sx > 0 else 'stone_attic'
                self.quad(ALL, mat, pts, want)
            for i in range(len(ys) - 1):
                a, b = ys[i], ys[i + 1]
                self.quad(ALL, 'stone', [Vector((xo, a, zt(a))), Vector((xo, b, zt(b))), Vector((xi, b, zt(b))), Vector((xi, a, zt(a)))], Vector((0, 0, 1)))

    def chimney(self, sx):
        P, W, T = self.p, self.W, self.T
        cx = sx * (W / 2 - T / 2 - .05)
        top = self.zr + .95
        z0 = P['eave'] + .3
        sxs, sys_ = .62, .92
        self.bevbox(ALL, (sxs, sys_, top - .35 - z0), Matrix.Translation((cx, 0, (z0 + top - .35) / 2)), 'stone', .01)
        self.bevbox(L01, (sxs + .02, sys_ + .02, .3), Matrix.Translation((cx, 0, top - .2)), 'brick', .008)
        self.bevbox(ALL, (sxs + .1, sys_ + .1, .07), Matrix.Translation((cx, 0, top - .02)), 'quoin', .01)
        for k, yy in enumerate((-.22, .22)):
            bm = cyl_bm(.1, .34 + k * .06, 10, r2=.085)
            self.g.bm(L01, bm, 'clay', Matrix.Translation((cx, yy, top + .17 + k * .03)), rng=self.r, smooth=True)
            bm.free()

    # ------------------------------------------------------------------ interno
    def interior(self):
        P, W, D, T = self.p, self.W, self.D, self.T
        xi0, xi1, yi0, yi1 = -W / 2 + T, W / 2 - T, -D / 2 + T, D / 2 - T
        fz, cz = P['floor'], P['ceiling']
        # massetto (nascosto) e lastre di pietra
        self.box(('LOD1', 'LOD2'), (xi0, yi0, 0), (xi1, yi1, fz), 'floor', skip=('-z',))
        self.box(L0, (xi0, yi0, 0), (xi1, yi1, fz - .035), 'stone', skip=('-z',))
        y = yi0
        while y < yi1 - .02:
            rw = min(self.r.uniform(.42, .62), yi1 - y)
            x = xi0 - self.r.uniform(0, .3)
            while x < xi1 - .02:
                fl = self.r.uniform(.45, .8)
                xa, xb = max(x, xi0), min(x + fl, xi1)
                if xb - xa > .05:
                    hz = fz - .018 + self.r.uniform(-.003, .002)
                    self.bevbox(L0, (xb - xa - .008, rw - .008, .036), Matrix.Translation(((xa + xb) / 2, y + rw / 2, hz)) @ Matrix.Rotation(self.r.uniform(-.004, .004), 4, 'Z'),
                                'floor', .006, uvoff=(self.r.random() * 6, self.r.random() * 6))
                x += fl
            y += rw
        self.solid((xi0, yi0, 0), (xi1, yi1, fz), 'pavimento', walk=True)
        self.floors.append(dict(x0=xi0, x1=xi1, y0=yi0, y1=yi1, z=fz))
        # tramezzo a telaio intonacato con vano porta
        xp = xi0 + (xi1 - xi0) * .58
        tp = .14
        dy, dw, dh = yi0 + .55, .86, 2.02
        F = Wall('y', xp - tp / 2, -1, yi0, yi1, tp)
        for a0, a1, z0, z1 in ((yi0, dy - dw / 2, fz, cz), (dy + dw / 2, yi1, fz, cz), (dy - dw / 2, dy + dw / 2, fz + dh, cz)):
            mn, mx = (xp - tp / 2, a0, z0), (xp + tp / 2, a1, z1)
            self.box(L01, mn, mx, 'plaster_int')
            self.solid(mn, mx, 'tramezzo')
        for s in (-1, 1):
            self.bevbox(L0, (tp + .03, .09, dh), Matrix.Translation((xp, dy + s * (dw / 2 - .045), fz + dh / 2)), 'oak_beam', .006)
        self.bevbox(L0, (tp + .03, dw, .1), Matrix.Translation((xp, dy, fz + dh - .05)), 'oak_beam', .006)
        lw = dw - .1
        M = Matrix.Translation((xp + tp / 2 + .02, dy - dw / 2 + .05, fz + (dh - .06) / 2)) @ Matrix.Rotation(math.radians(self.r.uniform(70, 85)), 4, 'Z')
        for i in range(4):
            self.bevbox(L0, (lw / 4 - .004, .035, dh - .08), M @ Matrix.Translation((lw / 8 + i * lw / 4, 0, 0)), 'wood', .003)
        for zz in (-.6, .6):
            self.bevbox(L0, (lw - .04, .025, .1), M @ Matrix.Translation((lw / 2, .03, zz)), 'wood', .004)
        # solaio: travetti di quercia a vista e tavolato; botola sopra la scala
        jb, jh, sp = .12, .17, .56
        nj = int((xi1 - xi0) / sp)
        # botola sopra la scala: lunga quanto basta per avere 1.75 m d'altezza libera sui gradini (scala ripida: 13 alzate su 2.93 m)
        hx0, hx1, hy0, hy1 = xi1 - .5 - 13 * .225 - .02, xi1 - .5 - .72, yi1 - .86, yi1 - .02
        for k in range(nj + 1):
            xx = xi0 + .1 + k * (xi1 - xi0 - .2) / nj
            rz = Matrix.Rotation(self.r.uniform(-.004, .004), 4, 'Z')
            if hx0 - jb / 2 < xx < hx1 + jb / 2:      # travetto interrotto dal vano: poggia sul trave di bordo
                self.bevbox(L01, (jb, hy0 - yi0, jh), Matrix.Translation((xx, (yi0 + hy0) / 2, cz - jh / 2)) @ rz, 'oak_beam', .012)
            else:
                self.bevbox(L01, (jb, yi1 - yi0, jh), Matrix.Translation((xx, (yi0 + yi1) / 2, cz - jh / 2)) @ rz, 'oak_beam', .012)
        self.hatch = (hx0, hx1, hy0, hy1)
        # sottotetto: dove la falda scende sotto 1.8 m dal tavolato non si passa (collisione lungo le gronde)
        under = lambda yy: P['eave'] + .05 + (D / 2 - abs(yy)) * self.tp - .2 / math.cos(math.radians(P['pitch']))
        ylim = D / 2 - (cz + .035 + 1.8 - (P['eave'] + .05 - .2 / math.cos(math.radians(P['pitch'])))) / self.tp
        if 0 < ylim < yi1:
            for s in (-1, 1):
                a, b = sorted((s * ylim, s * yi1))
                self.solid((xi0, a, cz + .035), (xi1, b, under(ylim) + .1), 'falda')
        for (a0, a1, b0, b1) in ((xi0, hx0, yi0, yi1), (hx1, xi1, yi0, yi1), (hx0, hx1, yi0, hy0)):
            self.box(L01, (a0, b0, cz), (a1, b1, cz + .035), 'wood')
            self.solid((a0, b0, cz - .2), (a1, b1, cz + .035), 'solaio', walk=True)
            self.floors.append(dict(x0=a0, x1=a1, y0=b0, y1=b1, z=cz + .035))
        self.box(('LOD2',), (xi0, yi0, cz), (xi1, yi1, cz + .035), 'wood')
        for (a, b) in ((hx0, hy0), (hx1, hy0)):
            pass
        self.bevbox(L0, (hx1 - hx0 + .1, .1, .12), Matrix.Translation(((hx0 + hx1) / 2, hy0 - .05, cz - .06)), 'oak_beam', .01)
        self.interior_fireplace(xi0, fz, cz)
        self.stairs(xi1, yi1, fz, cz)
        self.rooms.append(dict(min=[xi0, yi0, 0], max=[xi1, yi1, cz]))
        self.rooms.append(dict(min=[xi0, yi0, cz], max=[xi1, yi1, self.zr]))
        self.xp = xp

    def interior_fireplace(self, xw, fz, cz):
        """Camino sul timpano sinistro: focolare, stipiti di pietra, trave di quercia, cappa intonacata."""
        hw, dep = .95, .5
        self.bevbox(ALL, (dep + .1, hw * 2 + .2, .05), Matrix.Translation((xw + (dep + .1) / 2, 0, fz + .025)), 'quoin', .01)
        self.solid((xw, -hw - .1, 0), (xw + dep + .1, hw + .1, fz + .05), 'focolare', walk=True)
        self.floors.append(dict(x0=xw, x1=xw + dep + .1, y0=-hw - .1, y1=hw + .1, z=fz + .05))
        for s in (-1, 1):
            self.bevbox(L01, (dep, .26, 1.28), Matrix.Translation((xw + dep / 2, s * (hw - .13), fz + .05 + .64)), 'quoin', .015)
            self.solid((xw, s * (hw - .13) - .13, 0), (xw + dep, s * (hw - .13) + .13, fz + 1.33), 'camino')
        self.bevbox(L01, (dep + .06, hw * 2 + .1, .28), Matrix.Translation((xw + (dep + .06) / 2, 0, fz + 1.33 + .14)), 'oak_beam', .02)
        # cappa: tronco di piramide dalla trave al soffitto
        z0, z1 = fz + 1.61, cz - .17
        a = [Vector((xw, -hw, z0)), Vector((xw + dep, -hw, z0)), Vector((xw + dep, hw, z0)), Vector((xw, hw, z0))]
        b = [Vector((xw, -hw * .7, z1)), Vector((xw + dep * .62, -hw * .7, z1)), Vector((xw + dep * .62, hw * .7, z1)), Vector((xw, hw * .7, z1))]
        for i in range(3):
            j = i + 1
            mid = (a[i] + a[j]) / 2
            want = Vector((mid.x - xw - .01, mid.y, 0)).normalized() if i != 1 else Vector((1, 0, .3))
            if i == 0:
                want = Vector((0, -1, 0))
            if i == 2:
                want = Vector((0, 1, 0))
            self.quad(L01, 'plaster_int', [a[i], a[j], b[j], b[i]], want)
        self.solid((xw, -hw, z0), (xw + dep, hw, z1), 'cappa')
        # fondo annerito dal fumo
        self.quad(L01, 'soot', [Vector((xw + .002, -hw + .26, fz + .05)), Vector((xw + .002, hw - .26, fz + .05)), Vector((xw + .002, hw - .26, fz + 1.33)), Vector((xw + .002, -hw + .26, fz + 1.33))], Vector((1, 0, 0)))

    def stairs(self, xi1, yi1, fz, cz):
        """Scala ripida di legno addossata al muro posteriore, sale verso la botola (verso -X)."""
        rise_total = cz + .035 - fz
        n = 13
        rh, go, sw = rise_total / n, .225, .82
        x_start = xi1 - .5
        yc = yi1 - sw / 2 - .02
        for i in range(n):
            xa = x_start - (i + 1) * go
            ztop = fz + (i + 1) * rh
            self.bevbox(L01, (go + .03, sw - .1, .04), Matrix.Translation((xa + go / 2 - .015, yc, ztop - .02)), 'wood', .006)
            self.solid((xa, yc - sw / 2, 0), (xa + go, yc + sw / 2, ztop), 'scala', walk=True)
        self.floors.append(dict(x0=x_start - n * go, x1=x_start, y0=yc - sw / 2, y1=yc + sw / 2, z=fz, ramp=dict(axis='x', c0=x_start, c1=x_start - n * go, z0=fz, z1=cz + .035)))
        L = math.hypot(n * go, rise_total)
        ang = math.atan2(rise_total, n * go)
        for s in (-1, 1):
            c = Vector((x_start - n * go / 2, yc + s * (sw / 2 - .025), fz + rise_total / 2 - .03))
            self.bevbox(L01, (L + .1, .05, .26), Matrix.Translation(c) @ Matrix.Rotation(ang, 4, 'Y'), 'oak_beam', .006)

    def slate(self, M, sx, sy, sz):
        """Lastra di ardesia: scatola senza faccia inferiore (appoggiata sul corso sotto), 10 triangoli."""
        x, y, z = sx / 2, sy / 2, sz / 2
        V = lambda a, b, c: M @ Vector((a, b, c))
        off = (self.r.random() * 8, self.r.random() * 8)
        R = M.to_3x3()
        faces = [((-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z), (0, 0, 1)), ((-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z), (0, -1, 0)),
                 ((-x, y, -z), (x, y, -z), (x, y, z), (-x, y, z), (0, 1, 0)), ((-x, -y, -z), (-x, y, -z), (-x, y, z), (-x, -y, z), (-1, 0, 0)),
                 ((x, -y, -z), (x, y, -z), (x, y, z), (x, -y, z), (1, 0, 0))]
        for f in faces:
            self.quad(L0, 'slate', [V(*q) for q in f[:4]], R @ Vector(f[4]), uvoff=off)

    # ------------------------------------------------------------------ muschio
    def moss(self):
        """Ciuffi di muschio sulle ardesie dei corsi bassi della falda posteriore (più umida) e sui davanzali."""
        P = self.p
        n = int(8 + P['wear'] * 40)
        D, W = self.D, self.W
        pitch = math.radians(P['pitch'])
        for k in range(n):
            sy = 1 if self.r.random() < .75 else -1
            s = self.r.uniform(.1, 1.6) ** 1.3
            x = self.r.uniform(-W / 2, W / 2)
            ye = sy * (D / 2 + P['overhang'])
            ze = P['eave'] + .05 - P['overhang'] * self.tp
            c = Vector((x, ye - sy * math.cos(pitch) * s, ze + math.sin(pitch) * s)) + Vector((0, sy * math.sin(pitch), math.cos(pitch))) * .022
            bm = cyl_bm(self.r.uniform(.05, .12), .008, 8, r2=.03)
            M = Matrix.Translation(c) @ Matrix.Rotation(-sy * pitch, 4, 'X') @ Matrix.Scale(self.r.uniform(.7, 1.3), 4, Vector((1, 0, 0)))
            self.g.bm(L0, bm, 'moss', M, rng=self.r, smooth=True)
            bm.free()

    # ------------------------------------------------------------------ assemblaggio
    def build(self):
        P, W, D, T = self.p, self.W, self.D, self.T
        fz = P['floor']
        zb, zE = -.6, P['eave']
        # aperture di facciata: finestre e porta distribuite con passo regolare
        nf = P['front_windows'] + 1
        span = W - 2 * (T + .9)
        slots = [-span / 2 + span * (i + .5) / nf for i in range(nf)]
        win = lambda c: dict(c=c, w=.92, z0=fz + .92, z1=fz + .92 + 1.32, kind='window')
        front = []
        for i, c in enumerate(slots):
            if i == P['door_slot']:
                front.append(dict(c=c, w=1.02, z0=fz, z1=fz + 2.05, kind='door'))
            else:
                front.append(win(c))
        nb = P['back_windows']
        back = [win(-span / 2 + span * (i + .5) / nb + .4) for i in range(nb)]
        self.front_openings = front
        Ff = Wall('x', -D / 2, -1, -W / 2, W / 2, T)
        Fb = Wall('x', D / 2, 1, -W / 2, W / 2, T)
        Fl = Wall('y', -W / 2, -1, -D / 2 + T, D / 2 - T, T)
        Fr = Wall('y', W / 2, 1, -D / 2 + T, D / 2 - T, T)
        self.walls = dict(front=Ff, back=Fb, left=Fl, right=Fr)
        self.wall_with_openings(Ff, zb, zE, [dict(o) for o in front])
        self.wall_with_openings(Fb, zb, zE, back)
        side = [dict(c=.0, w=.55, z0=fz + 1.05, z1=fz + 1.75, kind='window')]
        self.wall_with_openings(Fr, zb, zE, side)
        self.wall_with_openings(Fl, zb, zE, [])
        for o in front:
            self.surround(Ff, o, o['kind'])
            if o['kind'] == 'window':
                self.window(Ff, o)
            else:
                self.door(Ff, o)
        for o in back:
            self.surround(Fb, o, 'window')
            self.window(Fb, o)
        for o in side:
            self.surround(Fr, o, 'window')
            self.window(Fr, o)
        self.quoins()
        # zoccolo di pietra umida (fondazione a vista)
        for F in (Ff, Fb):
            self.plinth(F, F.a0 - .05, F.a1 + .05, [o for o in (front if F is Ff else back) if o['kind'] == 'door'])
        for F in (Fl, Fr):
            self.plinth(F, F.a0 - T - .05, F.a1 + T + .05, [])
        self.gables()
        if P['chimneys'] in ('both', 'left'):
            self.chimney(-1)
        if P['chimneys'] in ('both', 'right'):
            self.chimney(1)
        self.roof()
        self.interior()
        # muschio: dato dallo shader dei materiali (base dei muri, zoccolo) a runtime; i ciuffi di geometria sul tetto sembravano palline e sono stati tolti
        return self

    def plinth(self, F, a0, a1, doors):
        z0, z1 = -.6, .22
        cuts = sorted((o['c'] - o['w'] / 2, o['c'] + o['w'] / 2) for o in doors)
        a = a0
        segs = []
        for l, r in cuts:
            segs.append((a, l))
            a = r
        segs.append((a, a1))
        for s0, s1 in segs:
            if s1 - s0 < .05:
                continue
            p, q = F.w(s0, -.05, z0), F.w(s1, .12, z1)
            mn = (min(p.x, q.x), min(p.y, q.y), z0)
            mx = (max(p.x, q.x), max(p.y, q.y), z1)
            c = Vector(((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (z0 + z1) / 2))
            self.bevbox(ALL, (mx[0] - mn[0], mx[1] - mn[1], z1 - z0), Matrix.Translation(c), 'stone_wet', .02)


def generate(**params):
    return House(**params).build()

