"""Maschinenpistole 40 — generatore Blender.
Dati: lunghezza 833 mm a calcio aperto, canna 251 mm con poggiacanna sotto la volata, castello tubolare con
scanalature, telaio inferiore e impugnatura in bachelite, calcio metallico pieghevole (qui aperto), leva
d'armamento a sinistra, tacca di mira ribaltabile, mirino a lama con cappuccio, caricatore MP 38/40 da 32 colpi.
Origine sul grilletto. Acciaio brunito."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, vloft

BORE = .052
SIGHT = BORE + .03
MUZZLE = .43
BUTT = -.40


class MP40(Weapon):
    MOVING = ('bolt', 'mag', 'trigger')

    def __init__(self, lod='fp'):
        super().__init__(lod)
        self.pivots = {'bolt': (-.025, .02, BORE), 'mag': (0, .12, BORE - .05), 'trigger': (0, .0, .0)}
        self.empties = {'muzzle': (0, MUZZLE + .002, BORE), 'port': (.016, .07, BORE + .012), 'rear_sight': (0, -.085, SIGHT), 'front_sight': (0, .41, SIGHT),
                        'grip_r': (0, -.03, -.045), 'grip_l': (0, .12, BORE - .1), 'charge': (-.03, .02, BORE)}

    def build(self):
        b, k, s = self.b, self.k, self.seg
        # castello tubolare con anelli di rinforzo, tappo posteriore
        lathe(b, [(0, -.1), (.019, -.1), (.0205, -.094), (.0205, .16), (.016, .17), (0, .17)], 'steel_blued', s, cz=BORE)
        if self.detail:
            for kk in range(7):
                lathe(b, [(.0207, .0 + kk * .02), (.0212, .002 + kk * .02), (.0212, .012 + kk * .02), (.0207, .014 + kk * .02)], 'steel_blued', s, cz=BORE, caps=False)
        # canna con poggiacanna
        lathe(b, [(0, .16), (.012, .16), (.0105, .18), (.0105, MUZZLE - .02), (.0128, MUZZLE - .018), (.0128, MUZZLE), (.004, MUZZLE), (0, MUZZLE - .01)], 'steel_blued', s, cz=BORE)
        box(b, (.016, .018, .022), T((0, MUZZLE - .05, BORE - .02)), 'steel_blued', .002)
        box(b, (.012, .06, .007), T((0, MUZZLE - .065, BORE - .033)), 'steel_blued', .002)
        # telaio inferiore e impugnatura in bachelite
        box(b, (.028, .2, .03), T((0, .0, BORE - .035)), 'steel_blued', .003)
        vloft(b, [(BORE - .05, -.03, .02, .0155, 2.4), (.0, -.042, .022, .016, 2.3), (-.045, -.056, .023, .0165, 2.3), (-.085, -.066, .022, .016, 2.3), (-.105, -.07, .018, .0145, 2.6)], 'bakelite', k=k)
        loft(b, [(.03, BORE - .045, BORE - .062, .016, 2.6), (.1, BORE - .045, BORE - .062, .016, 2.6)], 'bakelite', k=k)   # guardamano in bachelite
        self.trigger_guard(.0, BORE - .05, L=.05, H=.02)
        self.trigger(.0, BORE - .052)
        # pozzetto e caricatore da 32
        box(b, (.03, .05, .05), T((0, .12, BORE - .055)), 'steel_blued', .003)
        m = self.P('mag')
        box(m, (.021, .036, .25), T((0, .12, BORE - .085 - .1)), 'steel_blued', .002)
        if self.detail:
            for kk in range(4):
                box(m, (.0012, .02, .006), T((.0112, .12, BORE - .13 - kk * .04)), 'steel_dark', 0)
        # calcio pieghevole (aperto): due aste, calciolo
        for sx in (-1, 1):
            lathe(b, [(0, BUTT + .01), (.005, BUTT + .01), (.005, -.095), (0, -.095)], 'steel_blued', 8, cx=sx * .014, cz=BORE - .02)
        box(b, (.034, .012, .085), T((0, BUTT + .005, BORE - .045)), 'steel_blued', .004)
        box(b, (.03, .02, .012), T((0, -.11, BORE - .03)), 'steel_blued', .002)
        # tacca ribaltabile e mirino con cappuccio
        box(b, (.02, .02, .008), T((0, -.085, BORE + .022)), 'steel_blued', .002)
        self.notch_sight(-.085, SIGHT, w=.02, mat='steel_blued')
        self.blade_sight(.41, SIGHT, BORE + .014, ears=False, hood=True, mat='steel_blued')
        # leva d'armamento a sinistra
        p = self.P('bolt')
        box(p, (.014, .008, .008), T((-.027, .02, BORE)), 'steel_bright', .002)
        lathe(p, [(0, 0), (.0055, 0), (.006, .006), (0, .008)], 'steel_bright', 12, M=T((-.034, .02, BORE)) @ R('Z', math.pi / 2))
        self.screw(-.016, .0, BORE - .035)
        return self


def generate(lod='fp'):
    return MP40(lod).build()
