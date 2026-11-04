"""Karabiner 98k (produzione di guerra) — generatore Blender.
Dati: lunghezza 1110 mm, canna 600 mm, cassa in noce/laminato con impugnatura semi-pistola, manubrio
dell'otturatore piegato con pomolo, alzo a ritto (tangente) a V, mirino a lama con cappuccio, fascetta superiore con
tenone della baionetta, fascetta inferiore, bacchetta di pulizia, dischetto di smontaggio nel calcio, serbatoio
interno da 5 con piastrina del fondello. Origine sul grilletto. Acciaio brunito."""
import math

from wcommon import R, T, Weapon, box, lathe, loft

BORE = .052
SIGHT = BORE + .03
MUZZLE = .78
BUTT = -.33


class Kar98k(Weapon):
    MOVING = ('bolt', 'mag', 'trigger')

    def __init__(self, lod='fp'):
        super().__init__(lod)
        self.pivots = {'bolt': (0, -.04, BORE), 'mag': (0, .05, BORE - .045), 'trigger': (0, .0, -.002)}
        self.empties = {'muzzle': (0, MUZZLE + .002, BORE), 'port': (.012, .04, BORE + .016), 'rear_sight': (0, .19, SIGHT), 'front_sight': (0, .758, SIGHT),
                        'grip_r': (0, -.07, -.015), 'grip_l': (0, .34, -.012), 'charge': (.05, -.035, BORE - .02)}

    def build(self):
        b, k, s = self.b, self.k, self.seg
        # cassa in noce: calcio con piega, collo semi-pistola, astina fino alla fascetta superiore
        loft(b, [(BUTT + .004, .036, -.09, .021, 2.8), (BUTT + .03, .037, -.088, .0215, 2.8), (-.25, .036, -.075, .021, 2.6), (-.18, .033, -.06, .0195, 2.5),
                 (-.13, .029, -.053, .017, 2.3), (-.1, .027, -.058, .016, 2.3), (-.075, .027, -.06, .0165, 2.4), (-.05, .028, -.04, .0175, 2.6), (-.02, .03, -.022, .019, 2.8),
                 (.12, .032, -.022, .0195, 2.8), (.2, .034, -.018, .018, 2.6), (.4, .038, -.01, .0165, 2.4), (.62, .041, -.004, .015, 2.4), (.66, .042, -.002, .0142, 2.4)], 'wood', k=k)
        loft(b, [(.21, BORE + .02, BORE - .006, .0152, 2.2), (.22, BORE + .022, BORE - .006, .0156, 2.2), (.44, BORE + .021, BORE - .006, .015, 2.2), (.45, BORE + .019, BORE - .006, .0145, 2.2)], 'wood', k=k)   # copricanna
        loft(b, [(BUTT, .037, -.091, .0215, 2.8), (BUTT + .004, .037, -.091, .0215, 2.8)], 'steel_blued', k=k)   # calciolo
        if self.detail:   # dischetto di smontaggio
            lathe(b, [(0, -.0215), (.013, -.0215), (.013, .0215), (0, .0215)], 'steel_blued', 16, M=T((0, -.22, -.03)) @ R('Z', math.pi / 2))
        # castello cilindrico con ponte posteriore, canna con rastremazioni a gradini
        lathe(b, [(0, -.07), (.0165, -.07), (.017, -.06), (.017, .15), (.0155, .16), (0, .16)], 'steel_blued', s, cz=BORE)
        lathe(b, [(0, .16), (.0145, .16), (.0145, .25), (.0128, .26), (.0118, .5), (.0105, .52), (.0102, MUZZLE - .002), (.0042, MUZZLE), (0, MUZZLE - .01)], 'steel_blued', s, cz=BORE)
        if self.detail:
            lathe(b, [(.004, MUZZLE + .0005), (.004, MUZZLE - .03)], 'steel_dark', 12, cz=BORE)
        # alzo a ritto con base e cursore
        box(b, (.026, .06, .012), T((0, .19, BORE + .016)), 'steel_blued', .002)
        box(b, (.022, .05, .004), T((0, .195, SIGHT - .009)), 'steel_blued', .001)
        self.notch_sight(.17, SIGHT, w=.022, mat='steel_blued')
        # fascette, tenone, bacchetta
        loft(b, [(.455, BORE + .024, -.012, .0175, 3), (.47, BORE + .024, -.012, .0175, 3)], 'steel_blued', k=k)
        loft(b, [(.64, BORE + .018, -.006, .016, 3), (.69, BORE + .018, -.006, .016, 3)], 'steel_blued', k=k)
        box(b, (.012, .05, .012), T((0, .7, BORE - .026)), 'steel_blued', .002)
        lathe(b, [(0, .63), (.003, .63), (.003, .79), (.0045, .792), (.0045, .8), (0, .8)], 'steel', 8, cz=BORE - .02)
        self.blade_sight(.758, SIGHT, BORE + .012, ears=False, hood=True, mat='steel_blued')
        # ponticello, piastrina del serbatoio, grilletto
        self.trigger_guard(.02, -.012, L=.07, H=.024, mat='steel_blued')
        self.trigger(.0, -.002)
        m = self.P('mag')
        box(m, (.026, .085, .006), T((0, .05, -.022)), 'steel_blued', .002)
        self.swivel(-.22, -.08)
        self.swivel(.455, -.018)
        # otturatore: corpo, manubrio piegato verso il basso con pomolo, sicura a bandiera
        p = self.P('bolt')
        lathe(p, [(0, -.11), (.009, -.11), (.0105, -.1), (.0105, .06), (0, .06)], 'steel_bright', s, cz=BORE)
        box(p, (.008, .014, .02), T((0, -.112, BORE + .008)), 'steel_bright', .002)   # sicura
        lathe(p, [(0, 0), (.004, 0), (.004, .045), (0, .045)], 'steel_bright', 10, M=T((.01, -.035, BORE - .002)) @ R('Z', -math.pi / 2) @ R('Y', 1.25))
        lathe(p, [(0, -.011), (.008, -.009), (.011, 0), (.008, .009), (0, .011)], 'steel_bright', 14, M=T((.045, -.035, BORE - .03)))
        return self


def generate(lod='fp'):
    return Kar98k(lod).build()
