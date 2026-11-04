"""Mani e avambracci in prima persona (soldato USA, giacca M1941 color oliva) — generatore Blender.

Parti (coordinate dell'arma: Y avanti, Z alto, X destra; metri):
- hand_r: mano destra chiusa attorno al collo del calcio, indice verso il grilletto; origine sul punto di presa.
- hand_l: mano sinistra sotto l'astina, palmo in alto, dita che salgono sul lato sinistro; origine sul punto di presa.
- arm: avambraccio di lunghezza 1 lungo +Y (polso a y = -0.5, gomito a y = +0.5) con manica e polsino; il gioco lo
  scala tra polso e gomito come i cilindri di src/weapons.js.
Proporzioni da una mano maschile adulta media: palmo 10 x 8,5 cm, dita 7-8,5 cm (medio), pollice 6 cm.
"""
import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from wgeo import Part, lathe, loft  # noqa: E402


def seg(part, a, b, r0, r1, mat, s=10):
    """Falange: tronco di cono con calotte arrotondate da a a b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    q = Vector((0, 1, 0)).rotation_difference(d.normalized())
    M = Matrix.Translation(a) @ q.to_matrix().to_4x4()
    prof = [(0, -r0)]
    for k in range(1, 4):
        t = k / 4 * math.pi / 2
        prof.append((r0 * math.sin(t), -r0 * math.cos(t)))
    prof += [(r0, 0), (r1, L)]
    for k in range(1, 4):
        t = k / 4 * math.pi / 2
        prof.append((r1 * math.cos(t), L + r1 * math.sin(t)))
    prof.append((0, L + r1))
    lathe(part, prof, mat, s, M=M)


def chain(part, pts, radii, mat, s=10):
    for i in range(len(pts) - 1):
        seg(part, pts[i], pts[i + 1], radii[i], radii[i + 1], mat, s)


class Arms:
    MOVING = ('hand_r', 'hand_l', 'arm')

    def __init__(self, lod='fp'):
        self.lod = lod
        self.parts = {'body': Part('body')}
        for n in self.MOVING:
            self.parts[n] = Part(n)
        self.pivots = {'hand_r': (0, 0, 0), 'hand_l': (0, 0, 0), 'arm': (0, 0, 0)}
        self.empties = {}
        self.s = 12 if lod == 'fp' else 6

    def palm(self, p, side, up):
        """Palmo e dorso: loft a sezione ovale schiacciata. side = +1 destra; up = direzione del dorso."""
        k = 18
        # stazioni dal polso (y negativo) alle nocche (y positivo), centrate su x = side*.018
        st = [(-.07, .0, -.018, .019, 2.2), (-.045, .004, -.017, .025, 2.3), (-.01, .006, -.016, .03, 2.4), (.02, .006, -.014, .031, 2.4), (.028, .004, -.011, .029, 2.4)]
        tmp = Part('tmp')
        loft(tmp, st, 'skin', k=k)
        return tmp

    def hand(self, part, side, mode):
        s = self.s
        # palmo: costruito in uno spazio locale e poi ruotato nella posa
        tmp = self.palm(part, side, None)
        if mode == 'r':   # mano destra sul collo del calcio: dorso sul lato destro, dita che girano sotto e salgono a sinistra
            Mp = Matrix.Translation((.03, -.01, .0)) @ Matrix.Rotation(-math.pi / 2 + .15, 4, 'Y') @ Matrix.Rotation(.35, 4, 'X')
        else:             # mano sinistra sotto l'astina: palmo verso l'alto, dorso in basso
            Mp = Matrix.Translation((-.006, -.01, -.032)) @ Matrix.Rotation(math.pi + .2, 4, 'Y') @ Matrix.Rotation(-.1, 4, 'X')
        for i, f in enumerate(tmp.f):
            pts = [Mp @ Vector(tmp.v[j]) for j in f]
            part.face(pts, 'skin', tmp.uv[i], tmp.sm[i])
        R = 1.0
        if mode == 'r':
            # dita (indice, medio, anulare, mignolo): partono dalle nocche sul lato destro-alto, girano sotto il collo
            bases = [(.026, .032, -.004), (.027, .014, -.006), (.026, -.004, -.008), (.023, -.02, -.011)]
            lens = [.026, .028, .026, .02]
            rad = [.0092, .0095, .009, .008]
            for k, (bx, by, bz) in enumerate(bases):
                L = lens[k]
                if k == 0:   # indice verso il grilletto, piegato
                    pts = [(bx, by, bz), (bx - .004, by + .02, bz - .02), (bx - .018, by + .03, bz - .036), (bx - .026, by + .034, bz - .04)]
                else:
                    pts = [(bx, by, bz), (bx - .006, by + .002, bz - L * .95), (bx - .028, by + .001, bz - L * 1.45), (bx - .045, by, bz - L * 1.2)]
                chain(part, pts, [rad[k], rad[k] * .92, rad[k] * .85, rad[k] * .78], 'skin', s)
            # pollice sopra il collo, verso il lato sinistro
            chain(part, [(.026, -.05, .012), (.016, -.03, .03), (-.004, -.012, .036), (-.016, .002, .03)], [.011, .0105, .0095, .0085], 'skin', s)
        else:
            bases = [(-.03, .03, -.03), (-.031, .012, -.031), (-.03, -.006, -.031), (-.027, -.022, -.029)]
            lens = [.024, .026, .024, .019]
            rad = [.0088, .009, .0086, .0076]
            for k, (bx, by, bz) in enumerate(bases):
                L = lens[k]
                pts = [(bx, by, bz), (bx - .01, by + .004, bz + L * .7), (bx - .006, by + .005, bz + L * 1.6), (bx + .006, by + .004, bz + L * 2.1)]
                chain(part, pts, [rad[k], rad[k] * .92, rad[k] * .85, rad[k] * .78], 'skin', s)
            chain(part, [(.012, -.045, -.034), (.03, -.025, -.022), (.034, -.004, -.004), (.03, .01, .008)], [.0105, .01, .009, .0082], 'skin', s)

    def arm(self, part):
        """Avambraccio lungo 1 su Y (polso -0.5, gomito +0.5): polso nudo, poi polsino e manica di lana con pieghe."""
        k = 22 if self.lod == 'fp' else 10
        loft(part, [(-.5, .021, -.021, .025, 2.1), (-.47, .023, -.023, .027, 2.1), (-.44, .025, -.025, .029, 2.1)], 'skin', k=k)
        st = []
        for i in range(14):
            y = -.45 + i * .07
            r = .041 + .012 * (i / 13) + (.004 if i % 3 == 1 else 0) * (1 if i > 1 else 0)
            st.append((min(y, .5), r * .96, -r * .96, r, 2.15))
        st[0] = (-.452, .036, -.036, .039, 2.15)
        loft(part, st, 'cloth', k=k)
        loft(part, [(-.456, .044, -.044, .047, 2.2), (-.43, .045, -.045, .048, 2.2)], 'cloth', k=k)   # polsino

    def build(self):
        self.hand(self.parts['hand_r'], 1, 'r')
        self.hand(self.parts['hand_l'], -1, 'l')
        tmp = Part('tmp')
        self.arm(tmp)
        # l'avambraccio va lungo l'asse verticale di Blender (= +Y in glTF, l'asse che il gioco allunga):
        # rotazione di 90° attorno a X, (x, y, z) -> (x, -z, y)
        a = self.parts['arm']
        for i, f in enumerate(tmp.f):
            a.face([Vector((tmp.v[j][0], -tmp.v[j][2], tmp.v[j][1])) for j in f], tmp.m[i], tmp.uv[i], tmp.sm[i])
        return self


def generate(lod='fp'):
    return Arms(lod).build()
