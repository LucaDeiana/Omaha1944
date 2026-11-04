"""Fucile semiautomatico U.S. Rifle, Cal. .30, M1 (Garand) — generatore Blender.

Misure dai dati del manuale TM 9-1275 / FM 23-5 e da fotografie di esemplari del 1943-44:
lunghezza 1107 mm, canna 610 mm, lunghezza di piega (grilletto–calciolo) ~ 335 mm, linea di mira 33 mm sopra
l'asse della canna (diottra sul castello, mirino a lama con orecchie sul cilindro del gas), clip en-bloc da 8
cartucce .30-06 (bossolo 63 mm, cartuccia 84,8 mm). Cassa in noce, metallo fosfatato (parkerizzato) grigio-verde.

Coordinate Blender: Y avanti, Z alto, X destra; origine sul grilletto. Parti mobili separate con il perno nella
posizione di riposo: 'bolt' (otturatore), 'oprod' (asta di manovra con manetta), 'clip' (clip con 8 cartucce),
'trigger' (grilletto). Punti di riferimento (empty): muzzle, port, rear_sight, front_sight, grip_r, grip_l, charge.
"""
import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
from wgeo import Part, box, extrude_profile, lathe, loft, torus  # noqa: E402

BORE = 0.058            # asse della canna sopra il grilletto
SIGHT = BORE + 0.033    # linea di mira
MUZZLE = 0.765
BUTT = -0.342           # 1107 mm in tutto

T = Matrix.Translation


def R(ax, a):
    return Matrix.Rotation(a, 4, ax)


class Garand:
    def __init__(self, lod='fp'):
        self.lod = lod
        fp, tp = lod == 'fp', lod == 'tp'
        self.k = 32 if fp else 14 if tp else 8          # suddivisione delle sezioni
        self.seg = 24 if fp else 10 if tp else 6         # suddivisione dei torniti
        self.detail = fp
        self.parts = {'body': Part('body')}
        if fp:
            for n in ('bolt', 'oprod', 'clip', 'trigger'):
                self.parts[n] = Part(n)
        self.pivots = {'bolt': Vector((0, 0.0, BORE)), 'oprod': Vector((0.024, 0.12, BORE + 0.004)), 'clip': Vector((0, 0.035, BORE - 0.02)), 'trigger': Vector((0, 0.004, -0.004))}
        self.empties = {
            'muzzle': (0, MUZZLE + .002, BORE), 'port': (0.012, 0.035, BORE + 0.022),
            'rear_sight': (0, -0.058, SIGHT), 'front_sight': (0, 0.742, SIGHT),
            'grip_r': (0, -0.072, -0.012), 'grip_l': (0, 0.33, -0.018), 'charge': (0.03, 0.125, BORE + 0.006),
            'clip_top': (0, 0.035, BORE + 0.03),
        }

    def P(self, name):
        return self.parts.get(name) if self.lod == 'fp' else self.parts['body']

    # ---------------------------------------------------------------- legno
    def stock(self):
        b, k = self.parts['body'], self.k
        # cassa: calciolo → impugnatura semi-pistola → zona del castello → astina; (y, sopra, sotto, semilarghezza, esponente)
        st = [
            (BUTT + .004, .040, -.086, .0205, 2.8), (BUTT + .03, .041, -.084, .0215, 2.8), (-.27, .041, -.075, .0215, 2.6),
            (-.21, .039, -.064, .0205, 2.5), (-.16, .035, -.054, .019, 2.4), (-.125, .031, -.052, .0172, 2.3),
            (-.098, .029, -.058, .0165, 2.3), (-.074, .029, -.064, .0168, 2.4), (-.055, .029, -.058, .017, 2.4),
            (-.04, .030, -.034, .018, 2.6), (-.02, .031, -.022, .0188, 2.8), (.08, .031, -.022, .0195, 2.8),
            (.14, .033, -.019, .0195, 2.7), (.2, .035, -.016, .0185, 2.6), (.3, .037, -.012, .0175, 2.5),
            (.42, .040, -.008, .0165, 2.4), (.52, .042, -.004, .0158, 2.4), (.555, .043, -.002, .0150, 2.4),
        ]
        loft(b, st, 'wood', k=k)
        # copricanna superiori (posteriore fino alla fascetta, anteriore fino al cilindro del gas)
        hg = lambda y0, y1: [(y0, BORE + .021, BORE - .006, .0158, 2.2), (y0 + .01, BORE + .023, BORE - .006, .0162, 2.2), (y1 - .01, BORE + .022, BORE - .006, .0158, 2.2), (y1, BORE + .02, BORE - .006, .015, 2.2)]
        loft(b, hg(.172, .375), 'wood', k=k)
        loft(b, hg(.398, .598), 'wood', k=k)

    # ---------------------------------------------------------------- metallo
    def barrel(self):
        b, s = self.parts['body'], self.seg
        lathe(b, [(0, .155), (.0172, .155), (.0172, .175), (.0148, .18), (.0138, .4), (.0118, .61), (.011, MUZZLE - .002), (.0042, MUZZLE), (0, MUZZLE - .01)], 'steel', s, cz=BORE)
        if self.detail:   # anima visibile alla volata
            lathe(b, [(.0039, MUZZLE + .0005), (.0039, MUZZLE - .03)], 'steel_dark', 12, cz=BORE)
        # fascetta inferiore (tiene astina e copricanna) con maglietta della cinghia
        loft(b, [(.375, BORE + .026, -.012, .0182, 3), (.398, BORE + .026, -.012, .0182, 3)], 'steel', k=self.k)
        if self.detail:
            torus(b, .009, .0018, T((0, .386, -.022)) @ R('Y', math.pi / 2), 'steel', 14, 6)
        # cilindro del gas con mirino, tappo di bloccaggio e attacco per baionetta
        lathe(b, [(0, .6), (.0168, .6), (.0168, .735), (.0155, .742), (.0155, .757), (.0142, .767), (0, .767)], 'steel', s, cz=BORE - .002)
        box(b, (.024, .034, .012), T((0, .618, BORE - .016)), 'steel', .002)
        box(b, (.012, .028, .011), T((0, .708, BORE - .02)), 'steel', .002)       # tenone della baionetta
        # mirino: base, orecchie di protezione, lama
        box(b, (.016, .02, .016), T((0, .742, BORE + .018)), 'steel', .002)
        for sx in (-1, 1):   # orecchie di protezione del mirino, leggermente rastremate
            box(b, (.0026, .016, .022), T((sx * .0068, .742, BORE + .033)) @ R('X', .06), 'steel', .0009)
        box(b, (.0034, .006, .016), T((0, .742, SIGHT - .008)), 'steel_dark', .0004)

    def receiver(self):
        b, k = self.parts['body'], self.k
        # tallone posteriore con la base della diottra
        loft(b, [(-.08, BORE + .02, BORE - .03, .0148, 3.2), (-.075, BORE + .022, BORE - .03, .0152, 3.2), (-.025, BORE + .021, BORE - .03, .0152, 3.2), (-.018, BORE + .016, BORE - .03, .0152, 3.2)], 'steel', k=k)
        # fianchi del castello (sopra aperto: si vedono otturatore e clip)
        # corpo del castello raccordato al tallone e all'anello: fianchi lisci, sopra aperto sull'otturatore e sulla clip
        loft(b, [(-.026, BORE + .012, BORE - .03, .0152, 3.4), (-.01, BORE + .011, BORE - .03, .0152, 3.6), (.09, BORE + .011, BORE - .03, .0152, 3.6), (.1, BORE + .013, BORE - .03, .0158, 3.4)], 'steel', k=k)
        for sx in (-1, 1):
            box(b, (.0028, .112, .0075), T((sx * .0136, .042, BORE + .0128)), 'steel', .0009)   # binari dell'otturatore
        # anello anteriore attorno alla canna
        lathe(b, [(0, .098), (.0175, .098), (.0178, .104), (.0178, .158), (.016, .162), (0, .162)], 'steel', self.seg, cz=BORE)
        # fondo del castello e scatola del grilletto sotto
        box(b, (.024, .11, .024), T((0, .015, .006)), 'steel', .002)
        # diottra: base, tamburi di alzo (sinistra) e deriva (destra), orecchie, disco con foro
        box(b, (.024, .03, .012), T((0, -.058, BORE + .026)), 'steel', .002)
        for sx in (-1, 1):   # orecchie di protezione della diottra
            box(b, (.003, .026, .026), T((sx * .0098, -.058, BORE + .036)), 'steel', .0012)
        # disco della diottra con foro passante (foro di 4 mm: leggibile in mira)
        lathe(b, [(.0032, -.0015), (.0085, -.0015), (.0085, .0015), (.0032, .0015), (.0032, -.0015)], 'steel', 24, M=T((0, -.058, SIGHT)), caps=False)
        torus(b, .0033, .00045, T((0, -.0595, SIGHT)) @ R('X', math.pi / 2), 'steel_dark', 20, 6)
        for sx, ln in ((-1, .013), (1, .011)):
            lathe(b, [(0, 0), (.0085, 0), (.0085, ln), (.006, ln + .002), (0, ln + .002)], 'steel', 18, M=T((sx * .013, -.052, BORE + .022)) @ R('Z', -sx * math.pi / 2))
            if self.detail:
                for kk in range(18):   # zigrinatura dei tamburi
                    a = 2 * math.pi * kk / 18
                    box(b, (.0012, .0015, .009), T((sx * (.013 + ln * .5), -.052 + math.cos(a) * .0088, BORE + .022 + math.sin(a) * .0088)) @ R('X', a), 'steel', 0)
        # fermo della clip (bottone a sinistra) e grilletto/ponticello
        lathe(b, [(0, 0), (.004, 0), (.004, .004), (0, .004)], 'steel', 12, M=T((-.016, .062, BORE + .002)) @ R('Z', math.pi / 2))
        # ponticello: anello sotto la scatola del grilletto, a sezione rettangolare arrotondata
        pts = []
        for i in range(25):
            a = math.pi * i / 24
            pts.append((.034 * math.cos(a), -.026 * math.sin(a)))
        for i in range(25):
            a = math.pi - math.pi * i / 24
            pts.append((.03 * math.cos(a), -.021 * math.sin(a)))
        extrude_profile(b, pts, .009, T((0, .018, -.004)) @ R('Y', math.pi / 2) @ R('Z', math.pi / 2) @ R('X', 0), 'steel')
        # sicura (davanti al ponticello)
        box(b, (.008, .012, .016), T((0, .056, -.012)), 'steel', .0015)
        # calciolo con sportellino
        loft(b, [(BUTT, .041, -.087, .0215, 2.8), (BUTT + .004, .041, -.087, .0215, 2.8)], 'steel', k=self.k)
        if self.detail:
            box(b, (.026, .0012, .05), T((0, BUTT - .0006, -.02)), 'steel_dark', 0)
        # magliette della cinghia
        if self.detail:
            torus(b, .01, .0018, T((0, -.21, -.07)) @ R('Y', math.pi / 2), 'steel', 14, 6)
            box(b, (.012, .02, .008), T((0, -.21, -.06)), 'steel', .0015)
        # fascetta del copricanna posteriore
        loft(b, [(.168, BORE + .024, BORE - .008, .0168, 3), (.176, BORE + .024, BORE - .008, .0168, 3)], 'steel', k=self.k)

    def bolt(self):
        p = self.P('bolt')
        lathe(p, [(0, .0), (.0105, .0), (.0112, .006), (.0112, .085), (.0098, .095), (0, .095)], 'steel_bright', self.seg, cz=BORE + .004)
        box(p, (.008, .02, .008), T((.012, .02, BORE + .01)), 'steel_bright', .0015)       # rullo/aletta verso l'asta
        if self.detail:
            box(p, (.004, .06, .002), T((0, .03, BORE + .0152)), 'steel_dark', 0)     # scanalatura superiore

    def oprod(self):
        p = self.P('oprod')
        # manetta d'armamento e asta che corre in avanti sotto il copricanna, a destra della canna
        box(p, (.013, .02, .016), T((.026, .125, BORE + .004)), 'steel', .003)
        lathe(p, [(0, 0), (.0065, 0), (.0065, .012), (0, .012)], 'steel', 14, M=T((.031, .125, BORE + .006)) @ R('Z', -math.pi / 2))
        box(p, (.006, .07, .01), T((.02, .155, BORE - .004)), 'steel', .0015)
        lathe(p, [(0, .19), (.0045, .19), (.0045, .6), (0, .6)], 'steel', 10, cx=.015, cz=BORE - .012)

    def clip(self):
        p = self.P('clip')
        # clip en-bloc di lamiera con 8 cartucce .30-06 sfalsate in due colonne; si vedono le due in alto
        L = .084
        if self.lod == 'wd':
            return            # a terra la clip non si vede
        for i in range(8 if self.detail else 2):   # in terza persona solo le due cartucce in vista
            col = -1 if i % 2 == 0 else 1
            zc = BORE + .012 - (i // 2) * .0098 - (.0049 if col > 0 else 0)
            xc = col * .0049
            y0 = -.012
            prof = [(0, y0), (.0059, y0), (.0059, y0 + .002), (.0052, y0 + .003), (.0059, y0 + .004), (.0059, y0 + .047), (.0051, y0 + .052),
                    (.0044, y0 + .056), (.0044, y0 + .063)]
            lathe(p, prof, 'brass', 14 if self.detail else 8, cx=xc, cz=zc)
            lathe(p, [(.0039, y0 + .063), (.0039, y0 + .07), (.0032, y0 + .078), (.0016, y0 + .0835), (0, y0 + L)], 'copper', 14 if self.detail else 8, cx=xc, cz=zc)
        for sx in (-1, 1):
            box(p, (.0012, .068, .03), T((sx * .0112, .02, BORE - .004)), 'steel', .0004)
            box(p, (.004, .066, .0016), T((sx * .0098, .02, BORE + .0108)), 'steel', .0004)   # labbri piegati

    def trigger(self):
        p = self.P('trigger')
        pts = [(0, 0), (.004, 0), (.006, -.01), (.0045, -.02), (.0005, -.021), (.0015, -.01), (-.001, 0)]
        extrude_profile(p, pts, .005, T((0, .004, -.004)) @ R('Z', math.pi / 2) @ R('X', math.pi / 2) @ R('Z', math.pi / 2), 'steel')

    def build(self):
        self.stock()
        self.barrel()
        self.receiver()
        self.bolt()
        self.oprod()
        self.clip()
        self.trigger()
        return self


def generate(lod='fp'):
    return Garand(lod).build()
