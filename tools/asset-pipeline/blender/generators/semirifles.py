"""Semiautomatici con ottica: Gewehr 43 con ZF4 (cilindro del gas sopra la canna, caricatore da 10) e SVT-40 con PU
(freno di bocca a sei feritoie, copricanna forato, bacchetta laterale, caricatore da 10). Origine sul grilletto."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, scope, scope_mount

BORE = .052
SPEC = {
    'g43': dict(L=1.13, butt=-.33, wood_end=.56, sc=(-.09, .16, .065, 0), gas=True, brake=False),
    'svt40': dict(L=1.226, butt=-.34, wood_end=.6, sc=(-.08, .17, .07, 0), gas=False, brake=True),
}


class SemiRifle(Weapon):
    MOVING = ('bolt', 'mag', 'trigger')

    def __init__(self, wid, lod='fp'):
        super().__init__(lod)
        self.wid, self.s = wid, SPEC[wid]
        S = self.s
        self.muzzle = S['butt'] + S['L']
        sx, sy, sz, sxl = S['sc']
        self.pivots = {'bolt': (-.02, .0, BORE + .012), 'mag': (0, .02, BORE - .06), 'trigger': (0, 0, -.002)}
        self.empties = {'muzzle': (0, self.muzzle + .002, BORE), 'port': (.012, .03, BORE + .016), 'rear_sight': (sxl, sx, BORE + sz), 'front_sight': (sxl, sy, BORE + sz),
                        'grip_r': (0, -.07, -.015), 'grip_l': (0, .3, -.012), 'charge': (-.03, .0, BORE + .012)}

    def build(self):
        S, b, k, s = self.s, self.b, self.k, self.seg
        bt, we, mz = S['butt'], S['wood_end'], self.muzzle
        loft(b, [(bt + .004, .036, -.09, .021, 2.8), (bt + .03, .037, -.088, .0215, 2.8), (-.25, .036, -.075, .021, 2.6), (-.18, .033, -.06, .0195, 2.5), (-.13, .029, -.053, .017, 2.3),
                 (-.1, .027, -.058, .016, 2.3), (-.075, .027, -.06, .0165, 2.4), (-.05, .028, -.04, .0175, 2.6), (-.02, .03, -.03, .019, 2.8), (.12, .032, -.03, .0195, 2.8),
                 (.25, .034, -.018, .018, 2.6), (we - .02, .039, -.006, .0158, 2.4), (we, .04, -.004, .015, 2.4)], 'wood', k=k)
        loft(b, [(bt, .037, -.091, .0215, 2.8), (bt + .004, .037, -.091, .0215, 2.8)], 'steel_blued', k=k)
        box(b, (.03, .19, .036), T((0, .02, BORE + .002)), 'steel_blued', .004)   # castello
        lathe(b, [(0, .11), (.0145, .11), (.0128, .2), (.0118, .5), (.0105, mz - .002), (.0042, mz), (0, mz - .01)], 'steel_blued', s, cz=BORE)
        if S['gas']:   # cilindro del gas e asta sopra la canna
            lathe(b, [(0, .12), (.009, .12), (.009, .52), (.007, .54), (0, .54)], 'steel_blued', 12, cz=BORE + .024)
        else:          # copricanna metallico forato sopra la canna
            lathe(b, [(0, .12), (.0165, .12), (.0165, .36), (0, .36)], 'steel_blued', s, cz=BORE + .004)
            if self.detail:
                for kk in range(6):
                    box(b, (.034, .016, .006), T((0, .15 + kk * .035, BORE + .006)), 'steel_dark', 0)
        if S['brake']:
            lathe(b, [(0, mz - .07), (.014, mz - .07), (.014, mz), (.006, mz), (0, mz - .005)], 'steel_blued', s, cz=BORE)
            if self.detail:
                for sd in (-1, 1):
                    for kk in range(3):
                        box(b, (.006, .007, .012), T((sd * .0125, mz - .055 + kk * .018, BORE)), 'steel_dark', 0)
        loft(b, [(we - .03, BORE + .02, -.008, .017, 3), (we - .014, BORE + .02, -.008, .017, 3)], 'steel_blued', k=k)
        self.blade_sight(mz - (.08 if S['brake'] else .02), BORE + .03, BORE + .012, ears=False, hood=True, mat='steel_blued')
        sx, sy, sz, sxl = S['sc']
        scope(self, sx, sy, BORE + sz, x=sxl)
        scope_mount(self, (sx + .05, sy - .05), BORE + .02, BORE + sz - .01)
        self.trigger_guard(.0, -.014, L=.07, H=.024, mat='steel_blued')
        self.trigger(.0, -.002)
        m = self.P('mag')
        box(m, (.028, .07, .085), T((0, .02, BORE - .065)), 'steel_blued', .003)
        p = self.P('bolt')
        box(p, (.022, .09, .014), T((0, .0, BORE + .012)), 'steel_bright', .002)
        lathe(p, [(0, 0), (.005, 0), (.005, .016), (0, .018)], 'steel_bright', 12, M=T((-.012, .01, BORE + .012)) @ R('Z', math.pi / 2))
        self.swivel(bt + .12, -.08)
        return self


def make(wid):
    return lambda lod='fp': SemiRifle(wid, lod).build()
