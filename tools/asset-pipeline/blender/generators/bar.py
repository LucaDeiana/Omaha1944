"""Browning Automatic Rifle M1918A2 — generatore Blender.
Dati: lunghezza 1214 mm, canna 610 mm con rompifiamma conico, bipiede sul rompifiamma, cilindro del gas sotto la
canna, castello squadrato con finestra di espulsione e leva d'armamento a sinistra, calcio in noce con
appoggio, astina in noce, caricatore da 20 colpi. Origine sul grilletto."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, vloft

BORE = .062
SIGHT = BORE + .035
MUZZLE = .79
BUTT = -.424


class BAR(Weapon):
    MOVING = ('bolt', 'mag', 'trigger')

    def __init__(self, lod='fp'):
        super().__init__(lod)
        self.pivots = {'bolt': (-.024, .02, BORE), 'mag': (0, .06, BORE - .07), 'trigger': (0, 0, .0)}
        self.empties = {'muzzle': (0, MUZZLE + .002, BORE), 'port': (.017, .04, BORE + .01), 'rear_sight': (0, -.04, SIGHT), 'front_sight': (0, MUZZLE - .02, SIGHT),
                        'grip_r': (0, -.06, -.04), 'grip_l': (0, .32, BORE - .05), 'charge': (-.03, .02, BORE)}

    def build(self):
        b, k, s = self.b, self.k, self.seg
        loft(b, [(BUTT + .004, .06, -.09, .02, 3), (BUTT + .03, .06, -.088, .021, 3), (-.3, .058, -.065, .0205, 2.8), (-.2, .055, -.035, .018, 2.6), (-.12, .055, .01, .016, 2.6), (-.1, .056, .02, .016, 2.6)], 'wood', k=k)
        loft(b, [(BUTT - .006, .062, -.09, .021, 3), (BUTT + .004, .062, -.09, .021, 3)], 'steel_blued', k=k)
        vloft(b, [(BORE - .03, -.05, .018, .015, 2.4), (.0, -.06, .02, .0155, 2.3), (-.04, -.072, .021, .016, 2.3), (-.075, -.08, .02, .0155, 2.3), (-.09, -.083, .016, .014, 2.5)], 'wood', k=k)
        box(b, (.036, .27, .056), T((0, .02, BORE - .006)), 'steel_blued', .004)
        if self.detail:
            box(b, (.002, .05, .016), T((.0182, .04, BORE + .01)), 'steel_dark', 0)
        lathe(b, [(0, .155), (.017, .155), (.0155, .2), (.0135, .6), (.0125, MUZZLE - .06), (.0165, MUZZLE - .055), (.019, MUZZLE), (.008, MUZZLE), (0, MUZZLE - .01)], 'steel_blued', s, cz=BORE)
        lathe(b, [(0, .16), (.011, .16), (.011, .55), (0, .55)], 'steel_blued', 12, cz=BORE - .03)
        loft(b, [(.16, BORE - .012, BORE - .055, .02, 2.6), (.2, BORE - .01, BORE - .06, .022, 2.6), (.42, BORE - .01, BORE - .06, .022, 2.6), (.45, BORE - .014, BORE - .05, .02, 2.6)], 'wood', k=k)
        for sd in (-1, 1):   # bipiede ripiegato
            lathe(b, [(0, .3), (.005, .3), (.005, MUZZLE - .07), (0, MUZZLE - .07)], 'steel_blued', 8, cx=sd * .014, cz=BORE - .022)
            box(b, (.012, .02, .016), T((sd * .014, .3, BORE - .022)), 'steel_blued', .002)
        box(b, (.02, .04, .03), T((0, MUZZLE - .06, BORE - .015)), 'steel_blued', .003)
        box(b, (.02, .04, .012), T((0, -.04, BORE + .03)), 'steel_blued', .002)
        lathe(b, [(.0028, -.0012), (.0072, -.0012), (.0072, .0012), (.0028, .0012), (.0028, -.0012)], 'steel_blued', 20, M=T((0, -.04, SIGHT)), caps=False)
        self.blade_sight(MUZZLE - .02, SIGHT, BORE + .016, ears=True, mat='steel_blued')
        self.trigger_guard(.0, -.012, L=.06, H=.024, mat='steel_blued')
        self.trigger(.0, .0)
        m = self.P('mag')
        box(m, (.03, .085, .1), T((0, .06, BORE - .085)), 'steel_blued', .003)
        p = self.P('bolt')
        box(p, (.008, .02, .012), T((-.022, .02, BORE)), 'steel_bright', .002)
        lathe(p, [(0, 0), (.006, 0), (.006, .012), (0, .014)], 'steel_bright', 12, M=T((-.026, .02, BORE)) @ R('Z', math.pi / 2))
        self.swivel(-.3, -.08)
        return self


def generate(lod='fp'):
    return BAR(lod).build()
