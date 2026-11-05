"""Dettaglio architettonico degli edifici dell'Urban Expansion 3.0 (tech demo) — generatore Blender.

Il muro portante e i riempimenti attorno ai vani sono i pannelli fratturati del sistema di distruzione (runtime,
src/aaa/xdestruct.js). Questo generatore produce TUTTO il resto, con le stesse funzioni e la stessa qualità della casa
Blender normandy_house.py: mostre di pietra da taglio (stipiti a blocchi, architravi, davanzali con gocciolatoio),
finestre a due ante con traverse e vetri, scuri a doghe con controvento a Z e bandelle, porte a doghe con bandelle e
maniglia, cantonali, zoccolo, marcapiano, cornicione, tetto a ardesie (o tegole piane) posate una per una, colmo di coppi,
puntoni, frontalino, grondaie di ghisa e pluviali, bandinelle, comignoli.

Ogni pezzo appartiene a un GRUPPO, cioè al componente distruttibile che lo sostiene:
  p:<faccia>:<colonna>:<fila>   pannello di muro (cantonali, zoccolo, marcapiano, cornicione)
  o:<faccia>:<colonna>:<fila>   vano (mostra, infisso, vetro, porta aperta, gradino)
  a:<faccia>:<colonna>:<fila>   anta di legno del vano (scuri chiusi, porta chiusa)
  r:<lato>:<campata>            campata del tetto (ardesie, tavolato, puntoni, grondaia, colmo)
  g:<lato>                      timpano (comignolo)
A runtime il gruppo sparisce (e cade come detrito) quando il suo componente si rompe.
Le misure della griglia dei pannelli e dei vani sono le stesse di xdzHouse/xdzOpening (src/aaa/xdestruct.js).
Coordinate: Blender, origine al centro della pianta alla quota del pavimento; facciata 's' (+z nel gioco) verso -Y.
"""
import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
sys.path.insert(0, os.path.dirname(__file__))
from geo import Geo, cyl_bm, mat_at  # noqa: E402
import normandy_house as NH  # noqa: E402
from normandy_house import House, Wall, ALL, L01, L0  # noqa: E402

T, SH = .55, 3.0
WIN_W, WIN_SILL, WIN_TOP, DOOR_W, DOOR_H = .95, .3, .15, 1.05, 2.15


class GGeo(Geo):
    """Geo con un gruppo per faccia (componente distruttibile)."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.grp = 'b'
        for L in self.lods.values():
            L['g'] = []

    def poly(self, lods, mat, pts, uvoff=(0.0, 0.0), uvrot=0.0, uvscale=1.0, smooth=False):
        before = {k: len(self.lods[k]['f']) for k in self.lods}
        super().poly(lods, mat, pts, uvoff, uvrot, uvscale, smooth)
        for k, L in self.lods.items():
            L['g'].extend([self.grp] * (len(L['f']) - before[k]))

    def groups(self, lod):
        return sorted(set(self.lods[lod]['g']))

    def to_group_object(self, lod, grp, name, mat_lib):
        """Un oggetto con le sole facce del gruppo (per l'esportazione: un nodo per gruppo e LOD)."""
        L = self.lods[lod]
        keep = [i for i, g in enumerate(L['g']) if g == grp]
        sub = {'v': [], 'f': [], 'm': [], 'uv': [], 'smooth': []}
        for i in keep:
            f = L['f'][i]
            b = len(sub['v'])
            sub['v'].extend(L['v'][j] for j in f)
            sub['f'].append(tuple(range(b, b + len(f))))
            sub['m'].append(L['m'][i])
            sub['uv'].append(L['uv'][i])
            sub['smooth'].append(L['smooth'][i])
        saved = self.lods[lod]
        self.lods[lod] = sub
        try:
            return Geo.to_object(self, lod, name, mat_lib)
        finally:
            self.lods[lod] = saved


class UrbanHouse(House):
    def __init__(self, cfg, seed=1944, tiles=None):
        piani = cfg.get('piani', 2)
        self.cfg = cfg
        self.H = piani * SH + .35
        self.nr = piani * 2
        self.ph = self.H / self.nr
        self.top = piani * SH                        # gronda (sommità del muro) sopra il pavimento
        pitch = cfg.get('pitch', .8)
        super().__init__(seed=seed, width=cfg['w'], depth=cfg['d'], wall=T, eave=self.top - .05, floor=0.0, pitch=math.degrees(pitch),
                         overhang=.35, verge=.14, wear=.35 if not cfg.get('danni') else .6, shutters_open=0.0 if cfg.get('persiane') else 1.0, _tiles=tiles)
        self.g = GGeo(lods=('LOD0', 'LOD1', 'LOD2'), tiles=tiles or {})   # LOD2 non esportato (sagoma lontana = volume del runtime)
        self.roof_mat = 'clay' if cfg.get('tetto') == 'tegole' else 'slate'
        self.wall_mat = cfg.get('mat', 'pietra').split(':')[0]

    # ------------------------------------------------------------------ geometria comune con il runtime
    def faces(self):
        W, D = self.W, self.D
        return {
            's': (Wall('x', -D / 2, -1, -W / 2, W / 2, T), lambda a: a),
            'n': (Wall('x', D / 2, 1, -W / 2, W / 2, T), lambda a: a),
            'o': (Wall('y', -W / 2, -1, -D / 2 + T, D / 2 - T, T), lambda a: -a),
            'e': (Wall('y', W / 2, 1, -D / 2 + T, D / 2 - T, T), lambda a: -a),
        }

    def grid(self, k):
        """Colonne della facciata k nell'ordine del runtime: centro lungo il muro (coordinata del Wall) e larghezza."""
        W, D = self.W, self.D
        if k in ('s', 'n'):
            a0, L = -W / 2, W
            nc = max(2, round(L / 1.9))
            pw = L / nc
            return [(a0 + (c + .5) * pw, pw) for c in range(nc)]
        L = D - 2 * T
        nc = max(2, round(L / 1.9))
        pw = L / nc
        # runtime: z del gioco cresce da -D/2+T; in Blender y = -z
        return [(-(-D / 2 + T + (c + .5) * pw), pw) for c in range(nc)]

    def holes(self, k):
        C = self.cfg
        h = set(tuple(x) for x in C.get('fori', {}).get(k, []))
        if k == C.get('fronte', 's'):
            for c in C.get('porta', []):
                h.add((c, 0))
                h.add((c, 1))
        return h

    # ------------------------------------------------------------------ elementi
    def wall_details(self):
        """Cantonali, zoccolo, marcapiano, cornicione: ciascun pezzo nel gruppo del pannello su cui poggia."""
        y0 = -.35
        for k, (F, _) in self.faces().items():
            cols = self.grid(k)
            hs = self.holes(k)
            for c, (a, pw) in enumerate(cols):
                for r in range(self.nr):
                    if (c, r) in hs:
                        continue
                    self.g.grp = 'p:%s:%d:%d' % (k, c, r)
                    zb, zt = y0 + r * self.ph, y0 + (r + 1) * self.ph
                    a0, a1 = a - pw / 2, a + pw / 2
                    if r == 0:   # zoccolo di pietra umida
                        lo, hi = (a0, a1) if k in ('s', 'n') else (a1, a0)
                        p, q = F.w(min(a0, a1) - (.05 if c == 0 and k in ('s', 'n') else 0), -.05, -.6), F.w(max(a0, a1) + (.05 if c == len(cols) - 1 and k in ('s', 'n') else 0), .12, .22)
                        mn, mx = Vector((min(p.x, q.x), min(p.y, q.y), -.6)), Vector((max(p.x, q.x), max(p.y, q.y), .22))
                        self.bevbox(ALL, tuple(mx - mn), Matrix.Translation((mn + mx) / 2), 'stone_wet', .02)
                    if r % 2 == 0 and r > 0:   # marcapiano fra i piani (fascia di pietra da taglio)
                        self.bevbox(L01, (pw + .01, .12, .16), mat_at(F.w(a, -.04, zb), rz=F.rz()), 'quoin', .01)
                    if r == self.nr - 1:     # cornicione sotto la gronda
                        self.bevbox(L01, (pw + .01, .2, .14), mat_at(F.w(a, -.06, zt - .1), rz=F.rz()), 'quoin', .012)
                        self.bevbox(L0, (pw + .01, .12, .07), mat_at(F.w(a, -.1, zt - .2), rz=F.rz()), 'quoin', .008)
                    if self.wall_mat != 'mattoni' and (c == 0 or c == len(cols) - 1) and k in ('s', 'n'):   # cantonali
                        sx = -1 if c == 0 else 1
                        z, i = zb, 0
                        while z < zt - .05:
                            h = min(self.r.uniform(.28, .36), zt - z)
                            longf = (i + r) % 2 == 0
                            Lx = .56 if longf else .30
                            cx = sx * (self.W / 2 - Lx / 2) + sx * .022
                            yy = (-1 if k == 's' else 1) * (self.D / 2 + .022 - .14)
                            self.bevbox(L01, (Lx + .044, .28, h - .012), mat_at((cx, yy, z + h / 2)), 'quoin', .014)
                            Ly = .30 if longf else .56
                            cy = (-1 if k == 's' else 1) * (self.D / 2 - Ly / 2) + (-1 if k == 's' else 1) * .022
                            self.bevbox(L01, (.28, Ly + .044, h - .012), mat_at((sx * (self.W / 2 + .022 - .14), cy, z + h / 2)), 'quoin', .014)
                            z += h
                            i += 1

    def openings(self):
        C = self.cfg
        y0 = -.35
        for k, (F, _) in self.faces().items():
            cols = self.grid(k)
            for (c, r) in sorted(self.holes(k)):
                if c >= len(cols) or r >= self.nr:   # come il runtime: fori fuori dalla griglia ignorati
                    continue
                a, pw = cols[c]
                door = k == C.get('fronte', 's') and c in C.get('porta', []) and r <= 1
                if door and r == 1:
                    continue
                key = '%s:%d:%d' % (k, c, r)
                if door:
                    w = min(DOOR_W, pw - .5)
                    o = dict(c=a, w=w, z0=0.0, z1=DOOR_H, kind='door')
                    self.g.grp = 'o:' + key
                    self.surround(F, o, 'door')
                    if C.get('aperta', True):
                        self.door(F, o)
                    else:
                        self.door_frame(F, o)
                        self.g.grp = 'a:' + key
                        self.door_leaf_closed(F, o)
                else:
                    w = min(WIN_W, pw - .6)
                    zb = y0 + r * self.ph
                    o = dict(c=a, w=w, z0=zb + WIN_SILL, z1=zb + self.ph - WIN_TOP, kind='window')
                    self.g.grp = 'o:' + key
                    self.surround(F, o, 'window')
                    self.window_only(F, o)
                    self.g.grp = 'a:' + key if C.get('persiane') else 'o:' + key
                    self.shutters(F, o)

    def window_only(self, F, o):
        """Finestra della casa Blender senza gli scuri (che vanno nel gruppo dell'anta)."""
        sh = self.shutters
        self.shutters = lambda *a: None
        try:
            self.window(F, o)
        finally:
            self.shutters = sh

    def door_frame(self, F, o):
        c, w, z0, z1 = o['c'], o['w'], o['z0'], o['z1']
        for s in (-1, 1):
            self.bevbox(L01, (.1, .14, z1 - z0), mat_at(F.w(c + s * (w / 2 - .05), T - .09, (z0 + z1) / 2), rz=F.rz()), 'oak_beam', .005)
        self.bevbox(L01, (w, .14, .12), mat_at(F.w(c, T - .09, z1 - .06), rz=F.rz()), 'oak_beam', .005)

    def door_leaf_closed(self, F, o):
        """Porta chiusa a doghe con traverse, bandelle e maniglia, nel vano (filo esterno arretrato)."""
        c, w, z0, z1 = o['c'], o['w'], o['z0'], o['z1']
        lw, lh = w - .12, z1 - z0 - .08
        M0 = mat_at(F.w(c - lw / 2, .2, z0 + lh / 2 + .02), rz=F.rz())
        nb = 5
        bw = lw / nb
        for i in range(nb):
            self.bevbox(L0, (bw - .004, .045, lh + self.r.uniform(-.004, .004)), M0 @ Matrix.Translation((bw / 2 + i * bw, 0, 0)), 'wood_paint', .004)
        self.bevbox(('LOD1',), (lw, .045, lh), M0 @ Matrix.Translation((lw / 2, 0, 0)), 'wood_paint', 0)
        for zz in (-lh / 2 + .2, lh / 2 - .2):
            self.bevbox(L0, (lw * .8, .008, .05), M0 @ Matrix.Translation((lw * .4, -.027, zz)), 'iron', .002)
        bm = cyl_bm(.03, .012, 10)
        self.g.bm(L0, bm, 'iron', M0 @ Matrix.Translation((lw - .12, -.03, 0)) @ Matrix.Rotation(math.pi / 2, 4, 'X'), rng=self.r)
        bm.free()

    def roof_bays(self):
        """Tetto della casa Blender, diviso nelle campate del runtime (nb = max(2, round(w / 2.8)))."""
        P, W, D = self.p, self.W, self.D
        nb = max(2, round(W / 2.8))
        tp, ov, gv = self.tp, P['overhang'], P['verge']
        pitch = math.radians(P['pitch'])
        cs, sn = math.cos(pitch), math.sin(pitch)
        zE = P['eave'] + .05
        deck = .2
        for sy in (-1, 1):
            ye, ze = sy * (D / 2 + ov), zE - ov * tp
            yr, zr = 0.0, self.zr
            s_len = math.hypot(ye - yr, ze - zr)
            up = Vector((0, -sy * cs, sn))
            nrm = Vector((0, sy * sn, cs))
            E0 = Vector((0, ye, ze))
            Mr = Matrix((Vector((1, 0, 0)), up, nrm)).transposed().to_4x4()
            for k in range(nb):
                u0 = -W / 2 - .3 + k * (W + .6) / nb
                u1 = u0 + (W + .6) / nb
                x0, x1 = max(u0, -W / 2 - gv), min(u1, W / 2 + gv)
                self.g.grp = 'r:%d:%d' % (1 if sy < 0 else -1, k)   # lato del runtime: +1 = verso +z del gioco (facciata 's' = -Y)
                top = [Vector((x0, ye, ze)), Vector((x1, ye, ze)), Vector((x1, yr, zr)), Vector((x0, yr, zr))]
                bot = [p - nrm * deck for p in top]
                self.quad(ALL, 'oak_beam', bot, -nrm)
                self.quad(ALL, 'oak_beam', [top[0], top[1], bot[1], bot[0]], Vector((0, sy, -.3)))
                if k in (0, nb - 1):
                    a, b = (0, 3) if k == 0 else (1, 2)
                    self.quad(ALL, 'oak_beam', [top[a], top[b], bot[b], bot[a]], Vector((-1 if k == 0 else 1, 0, 0)))
                ex = P['slate_exposure'] * (1.25 if self.roof_mat == 'clay' else 1)
                n_course = int(s_len / ex) + 1
                for i in range(n_course):
                    s0 = i * ex
                    if s0 > s_len - .02:
                        break
                    L = min(ex * 2.1, s_len - s0 + .02)
                    tilt = math.atan2(.011, L)
                    lift = .012 if i else .02
                    c1 = E0 + up * (s0 + L / 2) + nrm * (lift * .5 + .004)
                    c1.x = (x0 + x1) / 2
                    self.bevbox(('LOD1',), (x1 - x0, L, .012), Matrix.Translation(c1) @ Mr @ Matrix.Rotation(tilt, 4, 'X'), self.roof_mat, 0)
                    x = x0 - (self.r.uniform(.05, .14) if i % 2 else 0)
                    while x < x1 - .02:
                        sw = self.r.uniform(.22, .3) if self.roof_mat == 'slate' else self.r.uniform(.17, .2)
                        xa, xb = max(x, x0), min(x + sw, x1)
                        x += sw + .006
                        if xb - xa < .04:
                            continue
                        if self.r.random() < P['wear'] * .012 and 2 < i < n_course - 3:
                            continue
                        cc = E0 + up * (s0 + L / 2) + nrm * (lift * .5 + self.r.uniform(-.002, .002))
                        cc.x = (xa + xb) / 2
                        M = Matrix.Translation(cc) @ Mr @ Matrix.Rotation(self.r.uniform(-.02, .02), 4, 'Z') @ Matrix.Rotation(tilt + self.r.uniform(-.01, .01), 4, 'X')
                        self.slate_m(M, xb - xa, L + self.r.uniform(-.01, .005), .009 if self.roof_mat == 'slate' else .014)
                nrr = max(2, int((x1 - x0) / .55))
                for j in range(nrr + 1):
                    xx = x0 + .15 + j * (x1 - x0 - .3) / nrr
                    c = Vector((xx, sy * (D / 2 + ov / 2), zE - ov / 2 * tp)) - nrm * (deck * .5 + .03)
                    self.bevbox(L0, (.075, ov / cs + .05, .13), Matrix.Translation(c) @ Mr, 'oak_beam', .008)
                fc = E0 - nrm * (deck * .5)
                fc.x = (x0 + x1) / 2
                self.bevbox(L01, (x1 - x0, .03, deck + .02), Matrix.Translation(fc) @ Mr @ Matrix.Rotation(-math.pi / 2 + pitch, 4, 'X'), 'wood', .004)
                self.gutter_seg(sy, x0 + .02, x1 - .02, Vector((0, ye + sy * .06, ze - .1)), pipe=(sy < 0 and k == nb - 1))
                if sy > 0:   # colmo di coppi sulla campata
                    n = max(1, int((x1 - x0) / .38))
                    for j in range(n):
                        xx = x0 + .19 + j * (x1 - x0 - .38) / max(1, n - 1) if n > 1 else (x0 + x1) / 2
                        bm = cyl_bm(.125, .42, 10, r2=.11)
                        self.g.bm(L0, bm, 'clay', Matrix.Translation((xx, 0, self.zr + .035)) @ Matrix.Rotation(math.pi / 2 + self.r.uniform(-.03, .03), 4, 'Y'), rng=self.r, smooth=True)
                        bm.free()
                    bm = cyl_bm(.12, x1 - x0, 6)
                    self.g.bm(('LOD1',), bm, 'clay', Matrix.Translation(((x0 + x1) / 2, 0, self.zr + .035)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'), rng=self.r)
                    bm.free()
                if k in (0, nb - 1):   # bandinella sul timpano
                    sx = -1 if k == 0 else 1
                    a = Vector((sx * (W / 2 + gv + .01), sy * (D / 2 + .05), zE - .05 * tp + .02))
                    b = Vector((sx * (W / 2 + gv + .01), 0, self.zr + .02))
                    self.bevbox(L01, (.035, (b - a).length, .2), Matrix.Translation((a + b) / 2) @ Matrix.Rotation(-sy * pitch, 4, 'X'), 'wood', .006)

    def gutter_seg(self, sy, xa, xb, c, pipe=False):
        """Grondaia di ghisa (profilo semicircolare) su un tratto; pluviale solo dove richiesto."""
        r, t, seg = .065, .006, 8
        prof = [(math.cos(math.pi + math.pi * i / seg) * r, math.sin(math.pi + math.pi * i / seg) * r) for i in range(seg + 1)]
        loop = prof + list(reversed([(x * (r - t) / r, z * (r - t) / r) for x, z in prof]))
        for i in range(len(loop)):
            (y0, z0), (y1, z1) = loop[i], loop[(i + 1) % len(loop)]
            pts = [Vector((xa, c.y + y0 * sy, c.z + z0)), Vector((xb, c.y + y0 * sy, c.z + z0)), Vector((xb, c.y + y1 * sy, c.z + z1)), Vector((xa, c.y + y1 * sy, c.z + z1))]
            mid = Vector((0, (y0 + y1) / 2 * sy, (z0 + z1) / 2))
            want = mid if i < seg else -mid
            self.quad(L01, 'iron', pts, want if want.length > 1e-6 else Vector((0, 0, 1)))
        if pipe:
            px, py = xb - .12, c.y + .02 * sy
            bm = cyl_bm(.042, c.z - .2, 8)
            self.g.bm(L01, bm, 'iron', Matrix.Translation((px, py, (c.z + .2) / 2 - .02)), rng=self.r, smooth=True)
            bm.free()

    def slate_m(self, M, sx, sy, sz):
        mat = self.roof_mat
        x, y, z = sx / 2, sy / 2, sz / 2
        V = lambda a, b, c: M @ Vector((a, b, c))
        off = (self.r.random() * 8, self.r.random() * 8)
        R = M.to_3x3()
        for f in (((-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z), (0, 0, 1)), ((-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z), (0, -1, 0)),
                  ((-x, -y, -z), (-x, y, -z), (-x, y, z), (-x, -y, z), (-1, 0, 0)), ((x, -y, -z), (x, y, -z), (x, y, z), (x, -y, z), (1, 0, 0))):
            self.quad(L0, mat, [V(*q) for q in f[:4]], R @ Vector(f[4]), uvoff=off)

    def chimneys(self):
        C = self.cfg
        side = C.get('comignolo', 1 if (len(C.get('id', 'x')) + int(self.W * 10)) % 2 else -1)
        if C.get('piani', 2) < 1 or C.get('tipo', '').startswith(('fienile', 'rimessa', 'magazzino', 'officina', 'stalla')):
            return
        self.g.grp = 'g:%d' % side
        self.chimney(side)

    def build(self):
        self.wall_details()
        self.openings()
        if self.cfg.get('tetto_blender'):   # di norma il tetto lo genera il runtime (stessa logica delle ardesie, legato ai crolli)
            self.roof_bays()
        self.chimneys()
        return self


def generate(cfg, seed=1944, tiles=None):
    return UrbanHouse(cfg, seed=seed, tiles=tiles).build()
