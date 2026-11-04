"""Primitive per le armi: loft di sezioni (calci, castelli), torniti (canne, cilindri), scatole smussate,
con UV lungo l'asse dell'arma (venatura del legno lungo la lunghezza) e normali lisce dove la forma è curva.

Coordinate Blender: Y = avanti (verso la volata), Z = alto, X = destra. Metri. Dopo l'esportazione glTF la canna
punta verso -Z e l'alto è +Y, come i modelli del gioco (src/guns.js).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


class Part:
    """Una parte (mesh) dell'arma con più materiali. Ogni faccia ha le sue UV."""

    def __init__(self, name):
        self.name = name
        self.v, self.f, self.m, self.uv, self.sm = [], [], [], [], []

    def face(self, pts, mat, uvs, smooth=False):
        b = len(self.v)
        self.v.extend(tuple(p) for p in pts)
        self.f.append(tuple(range(b, b + len(pts))))
        self.m.append(mat)
        self.uv.append(uvs)
        self.sm.append(smooth)

    def tris(self):
        return sum(len(f) - 2 for f in self.f)

    def add_bm(self, bm, mat, M=Matrix.Identity(4), uvscale=1.0, smooth=False, grain=1):
        """bmesh trasformato; UV planari in metri. grain: asse locale della venatura/spazzolatura (0=X,1=Y,2=Z)."""
        R = M.to_3x3()
        NR = R.inverted_safe().transposed()
        mir = R.determinant() < 0
        for fc in bm.faces:
            pts = [M @ v.co for v in fc.verts]
            loc = [v.co for v in fc.verts]
            if mir:
                pts.reverse()
                loc = list(reversed(loc))
            n = fc.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            others = [i for i in range(3) if i != ax]
            # U lungo l'asse della venatura quando possibile
            if grain in others:
                u_ax, v_ax = grain, [i for i in others if i != grain][0]
            else:
                u_ax, v_ax = others
            uvs = [(p[u_ax] * uvscale, p[v_ax] * uvscale) for p in loc]
            self.face(pts, mat, uvs, smooth)

    def to_object(self, mats, pivot=Vector((0, 0, 0))):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(Vector(p) - pivot) for p in self.v], [], self.f)
        me.update()
        assert len(me.polygons) == len(self.f)
        used = []
        for m in self.m:
            if m not in used:
                used.append(m)
        for m in used:
            me.materials.append(mats(m))
        uvl = me.uv_layers.new(name='UVMap')
        for pi, poly in enumerate(me.polygons):
            poly.material_index = used.index(self.m[pi])
            poly.use_smooth = self.sm[pi]
            for k, li in enumerate(poly.loop_indices):
                uvl.data[li].uv = self.uv[pi][k]
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00005)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(self.name, me)
        ob.location = pivot
        bpy.context.scene.collection.objects.link(ob)
        return ob


def superellipse(w, top, bot, n, k, cx=0.0):
    """Punto k-esimo di una sezione chiusa: semilarghezza w, sopra 'top', sotto 'bot' (quote assolute), esponente n."""
    out = []
    zc = (top + bot) / 2
    h = (top - bot) / 2
    for i in range(k):
        a = 2 * math.pi * i / k
        c, s = math.cos(a), math.sin(a)
        x = cx + w * math.copysign(abs(c) ** (2 / n), c)
        z = zc + h * math.copysign(abs(s) ** (2 / n), s)
        out.append((x, z))
    return out


def loft(part, stations, mat, k=24, n=2.6, cap0=True, cap1=True, uvscale=1.0, smooth=True):
    """stations: lista di (y, top, bot, halfwidth[, n[, cx]]). Sezioni chiuse collegate da quadrilateri lisci.
    UV: U = posizione lungo Y (venatura lungo l'arma), V = lunghezza d'arco della sezione."""
    rings = []
    for st in stations:
        y, top, bot, w = st[:4]
        nn = st[4] if len(st) > 4 else n
        cx = st[5] if len(st) > 5 else 0.0
        rings.append([Vector((x, y, z)) for x, z in superellipse(w, top, bot, nn, k, cx)])
    arcs = []
    for r in rings:
        acc, a = [0.0], 0.0
        for i in range(k):
            a += (r[(i + 1) % k] - r[i]).length
            acc.append(a)
        arcs.append(acc)
    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        for i in range(k):
            i2 = (i + 1) % k
            pts = [A[i], A[i2], B[i2], B[i]]
            uvs = [(A[i].y * uvscale, arcs[j][i] * uvscale), (A[i2].y * uvscale, arcs[j][i + 1] * uvscale),
                   (B[i2].y * uvscale, arcs[j + 1][i + 1] * uvscale), (B[i].y * uvscale, arcs[j + 1][i] * uvscale)]
            # normale verso l'esterno: l'ordine dipende dal verso delle sezioni; si controlla col centro
            c = sum(pts, Vector()) / 4
            ctr = Vector((stations[j][5] if len(stations[j]) > 5 else 0, c.y, (stations[j][1] + stations[j][2]) / 2))
            nrm = (pts[1] - pts[0]).cross(pts[3] - pts[0])
            if nrm.dot(c - ctr) < 0:
                pts.reverse()
                uvs.reverse()
            part.face(pts, mat, uvs, smooth)
    for idx, cap, sgn in ((0, cap0, -1), (len(rings) - 1, cap1, 1)):
        if not cap:
            continue
        r = rings[idx]
        pts = list(r) if sgn > 0 else list(reversed(r))
        nrm = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if nrm.y * sgn < 0:
            pts.reverse()
        part.face(pts, mat, [(p.x * uvscale, p.z * uvscale) for p in pts], False)


def lathe(part, prof, mat, seg=20, cx=0.0, cz=0.0, uvscale=1.0, smooth=True, M=None, caps=True):
    """Tornito lungo Y: prof = [(raggio, y)] dall'indietro in avanti; raggio 0 = punta chiusa.
    Le normali sono ricalcolate verso l'esterno; lisce sui fianchi, piane sulle facce frontali."""
    bm = bmesh.new()
    rings = []
    for r, y in prof:
        if r < 1e-7:
            rings.append([bm.verts.new((cx, y, cz))])
        else:
            rings.append([bm.verts.new((cx + r * math.cos(2 * math.pi * i / seg), y, cz + r * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    for A, B in zip(rings, rings[1:]):
        if len(A) == 1 and len(B) == 1:
            continue
        for i in range(seg):
            if len(A) == 1:
                bm.faces.new((A[0], B[i], B[(i + 1) % seg]))
            elif len(B) == 1:
                bm.faces.new((A[i], A[(i + 1) % seg], B[0]))
            else:
                bm.faces.new((A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]))
    if caps and len(rings[0]) > 1:
        bm.faces.new(rings[0])
    if caps and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    M = M or Matrix.Identity(4)
    R = M.to_3x3()
    for fc in bm.faces:
        pts = [M @ v.co for v in fc.verts]
        n = fc.normal
        sm = smooth and abs(n.y) < .75
        if abs(n.y) < .75:   # fianco: U lungo l'asse, V lungo la circonferenza
            uvs = [(v.co.y * uvscale, math.atan2(v.co.z - cz, v.co.x - cx) * .02 * uvscale) for v in fc.verts]
        else:
            uvs = [(v.co.x * uvscale, v.co.z * uvscale) for v in fc.verts]
        part.face(pts, mat, uvs, sm)
    bm.free()


def box(part, size, M, mat, bevel=0.0, seg=1, uvscale=1.0, smooth=False, grain=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0:
        b = min(bevel, size[0] * .45, size[1] * .45, size[2] * .45)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=b, segments=seg, affect='EDGES', profile=.5, clamp_overlap=True)
    bm.normal_update()
    part.add_bm(bm, mat, M, uvscale, smooth, grain)
    bm.free()


def torus(part, R, r, M, mat, seg=24, sseg=8, uvscale=1.0):
    bm = bmesh.new()
    verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(sseg):
            b = 2 * math.pi * j / sseg
            ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        verts.append(ring)
    for i in range(seg):
        for j in range(sseg):
            bm.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % sseg], verts[i][(j + 1) % sseg]))
    bm.normal_update()
    part.add_bm(bm, mat, M, uvscale, True)
    bm.free()


def extrude_profile(part, pts2d, thick, M, mat, uvscale=1.0, smooth_side=False):
    """Profilo 2D chiuso (x, y) nel piano XY locale estruso lungo Z locale per 'thick' (centrato)."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -thick / 2)) for x, y in pts2d]
    hi = [bm.verts.new((x, y, thick / 2)) for x, y in pts2d]
    n = len(pts2d)
    try:
        bm.faces.new(list(reversed(lo)))
        bm.faces.new(hi)
    except ValueError:
        pass
    for i in range(n):
        bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    part.add_bm(bm, mat, M, uvscale, smooth_side, 1)
    bm.free()


# matrice che porta il piano di disegno XY (X = avanti, Y = alto) nel piano verticale dell'arma (Y avanti, Z alto),
# con l'estrusione lungo X (spessore laterale)
SIDE = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def vloft(part, stations, mat, k=24, n=2.4, uvscale=1.0):
    """Loft verticale (impugnature a pistola, caricatori sagomati): stations = (z, y_centro, semiprofondità lungo Y,
    semilarghezza lungo X[, esponente]). Le sezioni sono orizzontali, quindi la forma segue l'inclinazione dell'impugnatura."""
    rings = []
    for st in stations:
        z, yc, d, w = st[:4]
        nn = st[4] if len(st) > 4 else n
        ring = []
        for i in range(k):
            a = 2 * math.pi * i / k
            c, s = math.cos(a), math.sin(a)
            ring.append(Vector((w * math.copysign(abs(c) ** (2 / nn), c), yc + d * math.copysign(abs(s) ** (2 / nn), s), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        ca = sum(A, Vector()) / k
        for i in range(k):
            i2 = (i + 1) % k
            pts = [A[i], A[i2], B[i2], B[i]]
            uvs = [(p.z * uvscale, (math.atan2(p.y - ca.y, p.x) * .03) * uvscale) for p in pts]
            nrm = (pts[1] - pts[0]).cross(pts[3] - pts[0])
            mid = sum(pts, Vector()) / 4
            if nrm.dot(Vector((mid.x - ca.x, mid.y - ca.y, 0))) < 0:
                pts.reverse()
                uvs.reverse()
            part.face(pts, mat, uvs, True)
    for idx, sgn in ((0, 1), (len(rings) - 1, -1)):
        r = list(rings[idx])
        nrm = (r[1] - r[0]).cross(r[2] - r[0])
        z_out = -1 if (idx == 0) == (stations[0][0] > stations[-1][0]) else 1
        z_out = 1 if stations[idx][0] == max(s[0] for s in (stations[0], stations[-1])) else -1
        if nrm.z * z_out < 0:
            r.reverse()
        part.face(r, mat, [(p.x * uvscale, p.y * uvscale) for p in r], False)
