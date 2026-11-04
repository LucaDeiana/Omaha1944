"""Colt M1911A1 — generatore Blender. Dati: lunghezza 216 mm, canna 127 mm, carrello con zigrinature posteriori,
cane a sperone, sicura dorsale, guancette zigrinate marroni, caricatore da 7. Origine sul grilletto."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, vloft, extrude_profile, SIDE

BORE = .045
SIGHT = BORE + .019


class Colt(Weapon):
    MOVING = ('slide', 'mag', 'trigger')

    def __init__(self, lod='fp'):
        super().__init__(lod)
        self.pivots = {'slide': (0, 0, 0), 'mag': (0, -.025, -.03), 'trigger': (0, 0, .0)}
        self.empties = {'muzzle': (0, .147, BORE), 'port': (.012, .035, BORE + .01), 'rear_sight': (0, -.055, SIGHT), 'front_sight': (0, .14, SIGHT),
                        'grip_r': (0, -.035, -.03), 'grip_l': (-.012, -.04, -.04), 'charge': (0, -.05, BORE)}

    def build(self):
        b, k, s = self.b, self.k, self.seg
        # carrello (parte mobile)
        p = self.P('slide')
        box(p, (.0235, .2, .03), T((0, .045, BORE + .002)), 'steel_blued', .003)
        if self.detail:
            for kk in range(8):
                box(p, (.0245, .002, .022), T((0, -.045 + kk * .004, BORE + .002)), 'steel_dark', 0)
            box(p, (.004, .03, .012), T((.012, .035, BORE + .01)), 'steel_dark', 0)   # finestra di espulsione
        box(p, (.012, .006, .008), T((0, -.052, SIGHT - .004)), 'steel_blued', .001)
        box(p, (.003, .006, .008), T((0, .14, SIGHT - .004)), 'steel_blued', .0006)
        lathe(p, [(.0045, .147), (.0075, .147), (.0075, .14), (.0045, .14)], 'steel_blued', 16, cz=BORE, caps=False)
        # castello: telaio, ponticello, impugnatura inclinata, guancette
        box(b, (.022, .14, .014), T((0, .07, BORE - .02)), 'steel_blued', .002)
        vloft(b, [(BORE - .028, -.03, .026, .0115, 2.6), (-.01, -.04, .027, .012, 2.6), (-.06, -.054, .027, .012, 2.6), (-.085, -.06, .026, .0115, 2.8)], 'steel_blued', k=k)
        for sd in (-1, 1):
            vloft(b, [(BORE - .032, -.03, .022, .0035, 2.2, ), (-.075, -.058, .022, .0035, 2.2)], 'bakelite', k=12) if False else None
            box(b, (.003, .03, .06), T((sd * .0128, -.045, -.02)) @ R('X', -.2), 'bakelite', .002)
        self.trigger_guard(.008, BORE - .028, L=.035, H=.02, w=.007, mat='steel_blued')
        self.trigger(.0, BORE - .03)
        lathe(b, [(0, 0), (.004, 0), (.004, .006), (0, .007)], 'steel_blued', 10, M=T((0, -.064, BORE + .01)) @ R('X', -.6))   # cane
        m = self.P('mag')
        box(m, (.02, .03, .012), T((0, -.06, -.085)), 'steel_blued', .002)
        return self


def generate(lod='fp'):
    return Colt(lod).build()
