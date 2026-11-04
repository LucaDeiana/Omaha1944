"""Accumulatore di geometria per la pipeline Blender di Omaha1944.

Coordinate di Blender: Z in alto, metri. Ogni pezzo viene aggiunto a un livello di dettaglio (LOD) con un nome di
materiale; alla fine ogni LOD diventa UNA mesh con più slot materiale (una draw call per materiale a runtime).
UV planari in metri, calcolate dalla posizione nel mondo e dalla normale della faccia: densità dei texel uguale su
tutto l'edificio (la scala delle texture è decisa dal manifest dei materiali, non dalla mesh) e niente stiramenti.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector


class Noise:
    """Rumore di valore 3D deterministico (stesso seme = stesso risultato), continuo nello spazio del mondo."""

    def __init__(self, seed):
        r = random.Random(seed)
        self.p = [r.random() for _ in range(512)]

    def _h(self, x, y, z):
        return self.p[(x * 73856093 ^ y * 19349663 ^ z * 83492791) & 511]

    def __call__(self, x, y, z):
        xi, yi, zi = math.floor(x), math.floor(y), math.floor(z)
        fx, fy, fz = x - xi, y - yi, z - zi
        fx, fy, fz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
        def L(a, b, t):
            return a + (b - a) * t
        c = [[[self._h(xi + i, yi + j, zi + k) for k in (0, 1)] for j in (0, 1)] for i in (0, 1)]
        return L(L(L(c[0][0][0], c[0][0][1], fz), L(c[0][1][0], c[0][1][1], fz), fy),
                 L(L(c[1][0][0], c[1][0][1], fz), L(c[1][1][0], c[1][1][1], fz), fy), fx) * 2 - 1


class Geo:
    def __init__(self, lods=('LOD0', 'LOD1', 'LOD2'), tiles=None):
        self.tiles = tiles or {}
        self.grain_u = {'oak_beam': True}   # tavole_fienile ha le tavole orizzontali (venatura lungo U)   # metri per ripetizione di texture, per materiale: la scala va nelle UV (nessuna copia di texture a runtime)
        self.lods = {k: {'v': [], 'f': [], 'm': [], 'uv': [], 'smooth': []} for k in lods}
        self.mats = []

    def _mi(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    # --- aggiunta di poligoni già in coordinate del mondo ---
    def poly(self, lods, mat, pts, uvoff=(0.0, 0.0), uvrot=0.0, uvscale=1.0, smooth=False):
        """pts: lista di Vector in coordinate del mondo (ordine antiorario visto dall'esterno)."""
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-12:
            return
        n.normalize()
        uvs = planar_uv(pts, n, uvoff, uvrot, uvscale / self.tiles.get(mat, 1.0))
        for k in (lods if isinstance(lods, (list, tuple)) else (lods,)):
            L = self.lods[k]
            b = len(L['v'])
            L['v'].extend(tuple(p) for p in pts)
            L['f'].append(tuple(range(b, b + len(pts))))
            L['m'].append(self._mi(mat))
            L['uv'].append(uvs)
            L['smooth'].append(smooth)

    def bm(self, lods, bm, mat, M=Matrix.Identity(4), uvoff=None, mats=None, smooth=False, rng=None, uvscale=1.0, grain=None):
        """Aggiunge un bmesh trasformato con la matrice M. mats: funzione (normale nel mondo) -> nome del materiale."""
        off = uvoff if uvoff is not None else ((rng.random() * 7.0, rng.random() * 7.0) if rng else (0.0, 0.0))
        rot3 = M.to_3x3()
        mirrored = rot3.determinant() < 0          # matrice speculare (scuri sinistri): l'ordine dei vertici va invertito
        nrm3 = rot3.inverted_safe().transposed()
        for f in bm.faces:
            pts = [M @ v.co for v in f.verts]
            if mirrored:
                pts.reverse()
            n = (nrm3 @ f.normal).normalized()
            m = mats(n) if mats else mat
            rot = 0.0
            if grain is not None:   # venatura del legno lungo l'asse lungo del pezzo: U della texture allineata alla venatura
                ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
                g = grain
                # le texture di legno del progetto hanno la venatura lungo V: si ruota quando il pezzo corre lungo U
                if az >= ax and az >= ay:
                    rot = math.pi / 2 if abs(g.x) > abs(g.y) else 0.0
                else:
                    rot = 0.0 if abs(g.z) > max(abs(g.x), abs(g.y)) else math.pi / 2
                if self.grain_u.get(m):   # texture con la venatura lungo U (tavole orizzontali): rotazione opposta
                    rot = math.pi / 2 - rot
            self.poly(lods, m, pts, off, rot, uvscale, smooth)

    def to_object(self, lod, name, mat_lib):
        L = self.lods[lod]
        me = bpy.data.meshes.new(name)
        me.from_pydata(L['v'], [], L['f'])
        me.update()
        used = sorted(set(L['m']))                 # solo i materiali usati da questo LOD: nessuno slot vuoto nel GLB
        remap = {old: new for new, old in enumerate(used)}
        for old in used:
            me.materials.append(mat_lib(self.mats[old]))
        assert len(me.polygons) == len(L['f']), 'facce perse in from_pydata'
        uvl = me.uv_layers.new(name='UVMap')
        for pi, poly in enumerate(me.polygons):
            poly.material_index = remap[L['m'][pi]]
            poly.use_smooth = L['smooth'][pi]
            for k, loop_index in enumerate(poly.loop_indices):
                uvl.data[loop_index].uv = L['uv'][pi][k]
        # saldatura dei vertici coincidenti (le UV restano per angolo di faccia)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob

    def tris(self, lod):
        return sum(len(f) - 2 for f in self.lods[lod]['f'])


def planar_uv(pts, n, off=(0.0, 0.0), rot=0.0, scale=1.0):
    """Proiezione planare in metri lungo l'asse dominante della normale; V verso l'alto sulle facce verticali."""
    ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
    out = []
    for p in pts:
        if az >= ax and az >= ay:            # orizzontale
            u, v = p.x, p.y
        elif ax >= ay:                       # parete con normale X
            u, v = (p.y if n.x > 0 else -p.y), p.z
        else:                                # parete con normale Y
            u, v = (-p.x if n.y > 0 else p.x), p.z
        if rot:
            c, s = math.cos(rot), math.sin(rot)
            u, v = u * c - v * s, u * s + v * c
        out.append((u * scale + off[0], v * scale + off[1]))
    return out


def box_bm(sx, sy, sz, bevel=0.0, seg=1):
    """Scatola centrata nell'origine; bevel > 0 smussa tutti gli spigoli (spigoli vivi a un segmento)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if bevel > 0:
        b = min(bevel, sx * .45, sy * .45, sz * .45)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=b, segments=seg, affect='EDGES', profile=.5, clamp_overlap=True)
    bm.normal_update()
    return bm


def cyl_bm(r, h, seg=10, r2=None, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bm.normal_update()
    return bm


def mat_at(loc, rz=0.0, rx=0.0, ry=0.0):
    return Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
