"""Lanciarazzi M1A1 «Bazooka» — generatore Blender. Dati: tubo da 2,36 pollici (60 mm) lungo 1,37 m, calcio di
legno sulla spalla, impugnatura a pistola con grilletto, impugnatura anteriore, mirino a telaio a sinistra, alzo,
scatola delle batterie, bocca svasata posteriore. Razzo M6A1 (parte mobile 'mag'). Origine sul grilletto."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, vloft

AX = .06   # asse del tubo sopra il grilletto


class Bazooka(Weapon):
    MOVING = ('mag', 'trigger')

    def __init__(self, lod='fp'):
        super().__init__(lod)
        self.pivots = {'mag': (0, -.2, AX), 'trigger': (0, 0, .0)}
        self.empties = {'muzzle': (0, .82, AX), 'port': (0, -.55, AX), 'rear_sight': (-.066, -.1, AX + .04), 'front_sight': (-.066, .4, AX + .04),
                        'grip_r': (0, -.02, -.05), 'grip_l': (0, .3, -.03), 'charge': (0, -.5, AX)}

    def build(self):
        b, k, s = self.b, self.k, self.seg
        lathe(b, [(.03, -.5), (.0305, -.5), (.0305, .82), (.03, .82)], 'olive', s + 8, cz=AX, caps=False)
        lathe(b, [(.03, .82), (.028, .82), (.028, -.5), (.03, -.5)], 'steel_dark', s + 8, cz=AX, caps=False)   # interno scuro
        lathe(b, [(.0305, -.5), (.045, -.545), (.046, -.55), (.031, -.505)], 'olive', s + 8, cz=AX, caps=False)   # bocca posteriore svasata
        for yy in (-.4, .05, .45):
            lathe(b, [(.031, yy), (.034, yy), (.034, yy + .02), (.031, yy + .02)], 'olive', s + 8, cz=AX)
        loft(b, [(-.48, AX - .02, AX - .095, .02, 3), (-.36, AX - .02, AX - .1, .022, 3), (-.25, AX - .02, AX - .07, .02, 3)], 'wood', k=k)   # calcio a spalla
        vloft(b, [(AX - .03, -.02, .02, .014, 2.4), (-.03, -.03, .022, .015, 2.3), (-.09, -.04, .02, .0145, 2.5)], 'wood', k=k)
        vloft(b, [(AX - .03, .3, .02, .014, 2.4), (-.03, .29, .022, .015, 2.3), (-.08, .28, .02, .0145, 2.5)], 'wood', k=k)
        box(b, (.04, .1, .045), T((0, -.2, AX - .055)), 'olive', .005)   # batterie
        self.trigger_guard(.0, AX - .03, L=.05, H=.02, mat='olive')
        self.trigger(.0, AX - .03)
        # mire a sinistra: alzo a tacca e mirino a telaio con reticolo
        box(b, (.012, .012, .03), T((-.045, -.1, AX + .03)), 'olive', .002)
        box(b, (.008, .004, .01), T((-.066, -.1, AX + .036)), 'olive', .001)
        box(b, (.012, .012, .03), T((-.045, .4, AX + .03)), 'olive', .002)
        for dx, dz, w, h in ((0, .02, .04, .003), (0, -.02, .04, .003), (.02, 0, .003, .04), (-.02, 0, .003, .04), (0, 0, .03, .0015), (0, 0, .0015, .03)):
            box(b, (w, .003, h), T((-.066 + dx, .4, AX + .04 + dz)), 'steel_dark', 0)
        m = self.P('mag')
        lathe(m, [(0, -.47), (.012, -.47), (.012, -.43), (.022, -.43), (.022, -.3), (.027, -.2), (.0275, -.12), (.024, -.02), (.012, .04), (0, .06)], 'olive', s, cz=AX)
        return self


def generate(lod='fp'):
    return Bazooka(lod).build()
