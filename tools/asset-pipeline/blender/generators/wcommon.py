"""Base comune dei generatori di armi: tre livelli (fp/tp/wd), parti mobili, punti di riferimento, pezzi ricorrenti
(ponticello, magliette, viti, mirini). Coordinate: Y avanti, Z alto, X destra; origine sul grilletto."""
import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from wgeo import SIDE, Part, box, extrude_profile, lathe, loft, torus, vloft  # noqa: E402,F401

T = Matrix.Translation


def R(ax, a):
    return Matrix.Rotation(a, 4, ax)


class Weapon:
    MOVING = ()

    def __init__(self, lod='fp'):
        self.lod = lod
        fp, tp = lod == 'fp', lod == 'tp'
        self.detail = fp
        self.k = 32 if fp else 14 if tp else 8
        self.seg = 24 if fp else 10 if tp else 6
        self.parts = {'body': Part('body')}
        if fp:
            for n in self.MOVING:
                self.parts[n] = Part(n)
        self.pivots, self.empties = {}, {}

    def P(self, name):
        return self.parts.get(name) if self.lod == 'fp' else self.parts['body']

    @property
    def b(self):
        return self.parts['body']

    # ---- pezzi ricorrenti
    def trigger_guard(self, y, z, L=.068, H=.026, w=.008, mat='steel'):
        pts = []
        for i in range(25):
            a = math.pi * i / 24
            pts.append((L / 2 * math.cos(a), -H * math.sin(a)))
        for i in range(25):
            a = math.pi - math.pi * i / 24
            pts.append(((L / 2 - .004) * math.cos(a), -(H - .005) * math.sin(a)))
        extrude_profile(self.b, pts, w, T((0, y, z)) @ SIDE, mat)

    def trigger(self, y, z, part='trigger', mat='steel'):
        p = self.P(part) if part in self.parts or self.lod != 'fp' else self.b
        pts = [(0, 0), (.004, 0), (.006, -.01), (.0045, -.02), (.0005, -.021), (.0015, -.01), (-.001, 0)]
        extrude_profile(p, pts, .005, T((0, y, z)) @ SIDE, mat)

    def swivel(self, y, z, axis='Y'):
        if self.detail:
            torus(self.b, .009, .0017, T((0, y, z)) @ R(axis, math.pi / 2), 'steel', 14, 6)

    def screw(self, x, y, z, r=.0042):
        if self.detail:
            lathe(self.b, [(0, 0), (r, 0), (r, .002), (0, .0026)], 'steel', 12, M=T((x, y, z)) @ R('Z', -math.copysign(math.pi / 2, x) if x else 0))

    def blade_sight(self, y, top, base, ears=True, hood=False, w=.0032, mat='steel'):
        box(self.b, (w, .005, top - base), T((0, y, (top + base) / 2)), 'steel_dark', .0004)
        box(self.b, (.014, .014, .008), T((0, y, base - .002)), mat, .0015)
        if ears:
            for sx in (-1, 1):
                box(self.b, (.0024, .012, top - base + .004), T((sx * .0065, y, (top + base) / 2 + .002)), mat, .0008)
        if hood:   # cappuccio del mirino (Kar98k, MP 40)
            pts = [(math.cos(a) * .0105, math.sin(a) * .0105) for a in [math.pi * i / 16 for i in range(17)]]
            pts += [(math.cos(a) * .0088, math.sin(a) * .0088) for a in [math.pi - math.pi * i / 16 for i in range(17)]]
            extrude_profile(self.b, pts, .016, T((0, y, base)) @ R('X', math.pi / 2), mat)

    def notch_sight(self, y, top, w=.022, mat='steel'):
        """Tacca di mira a V/U: due denti con il fondo della tacca alla quota 'top' (linea di mira)."""
        for sx in (-1, 1):
            box(self.b, (w / 2 - .0018, .004, .007), T((sx * (w / 4 + .0009), y, top - .0005)), mat, .0006)
        box(self.b, (w, .004, .006), T((0, y, top - .0065)), mat, .0006)

    def build(self):
        raise NotImplementedError


def scope(w, y0, y1, z, x=0.0, tube=.0115, obj=.019, eye=.0175, turret=True, mat='steel_blued'):
    """Cannocchiale: oculare (y0) e obiettivo (y1) a campana, tubo, torretta di alzo/deriva, lenti scure.
    Restituisce (oculare, obiettivo) per i punti di mira: l'asse ottico è la linea di mira."""
    b = w.b
    L = y1 - y0
    prof = [(0, y0 - .002), (eye - .002, y0 - .002), (eye, y0 + .004), (eye, y0 + .05), (tube, y0 + .075), (tube, y1 - .07), (obj, y1 - .03), (obj, y1), (0, y1)]
    lathe(b, prof, mat, w.seg + 4, cx=x, cz=z)
    for yy, r in ((y0 - .0025, eye - .004), (y1 + .0005, obj - .004)):
        lathe(b, [(0, yy), (r, yy), (r, yy + .001), (0, yy + .001)], 'lens', 20, cx=x, cz=z)
    if turret and w.detail:
        ym = y0 + L * .5
        lathe(b, [(0, 0), (.009, 0), (.009, .014), (0, .015)], mat, 16, M=T((x, ym, z + tube - .002)) @ R('X', -math.pi / 2))
        lathe(b, [(0, 0), (.009, 0), (.009, .014), (0, .015)], mat, 16, M=T((x + tube - .002, ym, z)) @ R('Z', -math.pi / 2))
    return (x, y0, z), (x, y1, z)


def scope_mount(w, ys, z_from, z_to, x=0.0, mat='steel_blued'):
    for y in ys:
        box(w.b, (.018, .016, z_to - z_from), T((x, y, (z_from + z_to) / 2)), mat, .002)
