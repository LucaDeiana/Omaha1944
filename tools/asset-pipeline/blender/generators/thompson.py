"""Pistola mitragliatrice Thompson M1A1 (1942-44) — generatore Blender.
Dati: lunghezza 811 mm, canna 267 mm liscia (senza alette né compensatore sull'M1A1), castello squadrato fresato,
leva d'armamento a destra, diottra fissa con orecchie (M1A1), mirino a lama, impugnatura a pistola e astina
orizzontale in noce, calcio fisso, caricatore a stecca da 30 colpi. Origine sul grilletto."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, torus, vloft

BORE = .062
SIGHT = BORE + .036
MUZZLE = .48
BUTT = -.331


class Thompson(Weapon):
    MOVING = ('bolt', 'mag', 'trigger')

    def __init__(self, lod='fp'):
        super().__init__(lod)
        self.pivots = {'bolt': (.022, .02, BORE + .02), 'mag': (0, .1, BORE - .06), 'trigger': (0, .002, .0)}
        self.empties = {'muzzle': (0, MUZZLE + .002, BORE), 'port': (.014, .02, BORE + .02), 'rear_sight': (0, -.07, SIGHT), 'front_sight': (0, .465, SIGHT),
                        'grip_r': (0, -.025, -.04), 'grip_l': (0, .26, BORE - .055), 'charge': (.03, .02, BORE + .02)}

    def build(self):
        b, k = self.b, self.k
        # calcio fisso in noce (piega, nasello), collo verso il castello
        loft(b, [(BUTT + .003, .062, -.085, .019, 3), (BUTT + .03, .062, -.083, .02, 3), (-.22, .058, -.06, .0195, 2.8), (-.15, .056, -.032, .017, 2.6),
                 (-.105, .057, .022, .015, 2.6), (-.095, .058, .03, .0145, 2.6)], 'wood', k=k)
        loft(b, [(BUTT, .062, -.086, .0192, 3), (BUTT + .004, .062, -.086, .0192, 3)], 'steel', k=k)    # calciolo
        # castello squadrato con spigoli smussati e canale superiore
        box(b, (.032, .2, .052), T((0, .005, BORE - .004)), 'steel', .004)
        box(b, (.022, .19, .006), T((0, .005, BORE + .025)), 'steel', .002)
        box(b, (.028, .07, .03), T((0, -.06, BORE - .036)), 'steel', .003)   # scatola del grilletto
        # canna liscia
        lathe(b, [(0, .1), (.0145, .1), (.0145, .12), (.0118, .13), (.0112, MUZZLE - .004), (.0042, MUZZLE), (0, MUZZLE - .01)], 'steel', self.seg, cz=BORE)
        if self.detail:
            lathe(b, [(.004, MUZZLE + .0005), (.004, MUZZLE - .03)], 'steel_dark', 12, cz=BORE)
        # impugnatura a pistola in noce
        vloft(b, [(BORE - .03, -.03, .02, .0145, 2.4), (.0, -.042, .021, .0152, 2.3), (-.04, -.056, .022, .0158, 2.3), (-.075, -.066, .022, .0156, 2.3), (-.098, -.071, .02, .015, 2.4), (-.104, -.072, .016, .0135, 2.6)], 'wood', k=k)
        # astina orizzontale in noce sotto la canna
        loft(b, [(.105, BORE - .016, BORE - .052, .018, 2.6), (.13, BORE - .014, BORE - .056, .0195, 2.6), (.3, BORE - .014, BORE - .056, .0195, 2.6), (.325, BORE - .016, BORE - .05, .018, 2.6)], 'wood', k=k)
        self.trigger_guard(.0, -.006, L=.056, H=.022)
        self.trigger(.002, .0)
        # caricatore a stecca da 30 (parte mobile)
        m = self.P('mag')
        box(m, (.024, .034, .2), T((0, .1, BORE - .075 - .07)), 'steel', .002)
        box(m, (.026, .036, .006), T((0, .1, BORE - .075 - .17)), 'steel', .0015)
        if self.detail:
            for sx in (-1, 1):
                box(m, (.001, .022, .15), T((sx * .0122, .1, BORE - .14)), 'steel_dark', 0)
        box(b, (.03, .045, .03), T((0, .1, BORE - .045)), 'steel', .003)   # pozzetto del caricatore
        # diottra fissa con orecchie, mirino a lama
        box(b, (.022, .02, .01), T((0, -.07, BORE + .03)), 'steel', .002)
        for sx in (-1, 1):
            box(b, (.003, .018, .022), T((sx * .0095, -.07, SIGHT - .002)), 'steel', .001)
        lathe(b, [(.0028, -.0012), (.0075, -.0012), (.0075, .0012), (.0028, .0012), (.0028, -.0012)], 'steel', 20, M=T((0, -.07, SIGHT)), caps=False)
        self.blade_sight(.465, SIGHT, BORE + .013, ears=False)
        # leva d'armamento a destra (otturatore)
        p = self.P('bolt')
        box(p, (.006, .03, .012), T((.0185, .02, BORE + .02)), 'steel_bright', .002)
        lathe(p, [(0, 0), (.0062, 0), (.0062, .008), (.004, .012), (0, .012)], 'steel_bright', 14, M=T((.021, .02, BORE + .02)) @ R('Z', -math.pi / 2))
        # magliette e viti
        self.swivel(-.24, -.07)
        self.screw(.016, -.06, BORE - .03)
        self.screw(-.016, -.06, BORE - .03)
        if self.detail:
            box(b, (.004, .012, .008), T((-.0175, -.02, BORE - .01)), 'steel', .001)   # selettore
            box(b, (.004, .012, .008), T((-.0175, .01, BORE - .01)), 'steel', .001)    # sicura
        return self


def generate(lod='fp'):
    return Thompson(lod).build()
