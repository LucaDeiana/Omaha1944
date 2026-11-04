"""Fucili a otturatore girevole con ottica: Springfield M1903A4 (M73B1), Kar98k ZF39, Lee-Enfield No.4 Mk I (T)
con No.32, Mosin-Nagant 91/30 PU. Un generatore parametrico unico (cassa, canna, otturatore, ottica), con i dati
storici di ciascuna arma nella tabella SPEC. Origine sul grilletto; acciaio brunito; cassa in noce/betulla."""
import math

from wcommon import R, T, Weapon, box, lathe, loft, scope, scope_mount

BORE = .052
SPEC = {
    # lunghezza totale, calcio (m dietro il grilletto), volata, copricanna, astina fino a, impugnatura (0 dritta, 1 semi-pistola),
    # serbatoio (interno/cassetta), ottica: (oculare, obiettivo, quota sopra l'asse, x laterale), pomolo dritto o piegato
    'springfield': dict(L=1.098, butt=-.335, wood_end=.6, hg=(.2, .45), grip=0, mag='floor', sc=(-.11, .19, .062, 0), bolt_bent=True, bands=(.45, .58)),
    'kar98zf': dict(L=1.11, butt=-.33, wood_end=.66, hg=(.21, .45), grip=1, mag='floor', sc=(-.12, .17, .07, 0), bolt_bent=True, bands=(.455, .64)),
    'enfield': dict(L=1.13, butt=-.33, wood_end=.74, hg=(.17, .74), grip=1, mag='box', sc=(-.1, .18, .058, -.012), bolt_bent=False, bands=(.42, .7), cheek=True),
    'mosin': dict(L=1.232, butt=-.34, wood_end=.78, hg=(.24, .5), grip=0, mag='floor', sc=(-.1, .17, .05, .045), bolt_bent=True, bands=(.52, .74)),
}


class BoltRifle(Weapon):
    MOVING = ('bolt', 'mag', 'trigger')

    def __init__(self, wid, lod='fp'):
        super().__init__(lod)
        self.wid, self.s = wid, SPEC[wid]
        S = self.s
        self.muzzle = S['butt'] + S['L']
        sx, sy, sz, sxl = S['sc']
        self.sight_z = BORE + sz
        self.pivots = {'bolt': (0, -.04, BORE), 'mag': (0, .05, BORE - .045), 'trigger': (0, 0, -.002)}
        self.empties = {'muzzle': (0, self.muzzle + .002, BORE), 'port': (.012, .04, BORE + .016), 'rear_sight': (sxl, sx, BORE + sz), 'front_sight': (sxl, sy, BORE + sz),
                        'grip_r': (0, -.07, -.015), 'grip_l': (0, .34, -.012), 'charge': (.05, -.035, BORE - .02)}

    def build(self):
        S, b, k, s = self.s, self.b, self.k, self.seg
        bt, we = S['butt'], S['wood_end']
        wrist = [(-.13, .029, -.053, .017, 2.3), (-.1, .027, -.058, .016, 2.3), (-.075, .027, -.06, .0165, 2.4)] if S['grip'] else [(-.13, .029, -.045, .0165, 2.3), (-.09, .028, -.038, .0165, 2.4), (-.06, .028, -.034, .017, 2.5)]
        st = [(bt + .004, .036, -.09, .021, 2.8), (bt + .03, .037, -.088, .0215, 2.8), (-.25, .036, -.075, .021, 2.6), (-.18, .033, -.06, .0195, 2.5)] + wrist + \
             [(-.05, .028, -.04, .0175, 2.6), (-.02, .03, -.022, .019, 2.8), (.12, .032, -.022, .0195, 2.8), (.2, .034, -.018, .018, 2.6), (we * .6, .038, -.01, .0165, 2.4), (we - .02, .041, -.004, .015, 2.4), (we, .042, -.002, .0142, 2.4)]
        loft(b, st, 'wood', k=k)
        if S.get('cheek'):   # appoggiaguancia di legno avvitato (Enfield T)
            loft(b, [(-.25, .06, .03, .014, 2.4, -.004), (-.14, .056, .03, .013, 2.4, -.004)], 'wood', k=k)
        h0, h1 = S['hg']
        loft(b, [(h0, BORE + .02, BORE - .006, .0152, 2.2), (h0 + .01, BORE + .022, BORE - .006, .0156, 2.2), (h1 - .01, BORE + .021, BORE - .006, .015, 2.2), (h1, BORE + .019, BORE - .006, .0145, 2.2)], 'wood', k=k)
        loft(b, [(bt, .037, -.091, .0215, 2.8), (bt + .004, .037, -.091, .0215, 2.8)], 'steel_blued', k=k)
        lathe(b, [(0, -.07), (.0165, -.07), (.017, -.06), (.017, .15), (.0155, .16), (0, .16)], 'steel_blued', s, cz=BORE)
        mz = self.muzzle
        lathe(b, [(0, .16), (.0145, .16), (.0145, .25), (.0128, .26), (.0118, .5), (.0105, .52), (.0102, mz - .002), (.0042, mz), (0, mz - .01)], 'steel_blued', s, cz=BORE)
        if self.detail:
            lathe(b, [(.004, mz + .0005), (.004, mz - .03)], 'steel_dark', 12, cz=BORE)
        for yb in S['bands']:
            loft(b, [(yb, BORE + .022, -.01, .0172, 3), (yb + .016, BORE + .022, -.01, .0172, 3)], 'steel_blued', k=k)
        self.blade_sight(mz - .02, BORE + .03, BORE + .012, ears=False, hood=True, mat='steel_blued')
        # ottica sull'asse di mira, con attacchi
        sx, sy, sz, sxl = S['sc']
        scope(self, sx, sy, BORE + sz, x=sxl)
        scope_mount(self, (sx + .05, sy - .06), BORE + .012, BORE + sz - .01, x=sxl * .6)
        self.trigger_guard(.02, -.012, L=.07, H=.024, mat='steel_blued')
        self.trigger(.0, -.002)
        m = self.P('mag')
        if S['mag'] == 'box':   # cassetta staccabile da 10 (Enfield)
            box(m, (.028, .07, .06), T((0, .05, -.035)), 'steel_blued', .003)
        else:
            box(m, (.026, .085, .006), T((0, .05, -.022)), 'steel_blued', .002)
        self.swivel(bt + .12, -.08)
        self.swivel(S['bands'][0], -.018)
        p = self.P('bolt')
        lathe(p, [(0, -.11), (.009, -.11), (.0105, -.1), (.0105, .06), (0, .06)], 'steel_bright', s, cz=BORE)
        ang = 1.25 if S['bolt_bent'] else .3
        lathe(p, [(0, 0), (.004, 0), (.004, .045), (0, .045)], 'steel_bright', 10, M=T((.01, -.035, BORE - .002)) @ R('Z', -math.pi / 2) @ R('Y', ang))
        kx, kz = (.045, BORE - .03) if S['bolt_bent'] else (.054, BORE - .015)
        lathe(p, [(0, -.011), (.008, -.009), (.011, 0), (.008, .009), (0, .011)], 'steel_bright', 14, M=T((kx, -.035, kz)))
        return self


def make(wid):
    return lambda lod='fp': BoltRifle(wid, lod).build()
