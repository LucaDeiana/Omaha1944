"""Braccia e mani in prima persona con scheletro (soldato USA, Normandia 1944) — generatore Blender.

Metodo (topologia deformabile, non primitive): uno «scheletro di vertici» con raggi ellittici per ogni punto (spalla,
gomito, avambraccio, polso, metacarpi, nocche, falangi) diventa una superficie continua con il modificatore Skin,
arrotondata da Subdivision Surface (2 livelli) e applicata. L'armatura ha le stesse articolazioni; i pesi sono calcolati
da Blender con il metodo automatico a diffusione di calore (parent ARMATURE_AUTO) e corretti dove serve (unghie
rigide sulle falangette, manica sugli omeri e avambracci).

Posa di riposo (Blender): spalla nell'origine, braccio lungo +Y, palmo verso -Z, dorso verso +Z, pollice verso -X
(mano destra). La sinistra è lo specchio (x -> -x) ricostruito con la sua armatura (niente scale negative).
Ossa (22 per braccio): upperarm, forearm, hand, thumb_0..2, index_0..3, middle_0..3, ring_0..3, pinky_0..3 (lo 0 è il
metacarpo). Assi delle ossa: Y lungo l'osso, Z verso il dorso: le dita si flettono ruotando attorno all'asse X locale.
Proporzioni: braccio 30 cm, avambraccio 26 cm, mano 19 cm (polso–punta del medio), larghezza del palmo 8,5 cm.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

UPPER, FORE = .30, .26
WRIST = Vector((0, UPPER + FORE, 0))
# dita: (nome, base del metacarpo rispetto al polso, nocca MCP, lunghezze delle falangi, raggi alla base e alla punta)
FINGERS = [
    ('index', (-.016, .012, -.002), (-.024, .094, .0), (.042, .025, .021), (.0095, .0072)),
    ('middle', (-.004, .012, -.002), (-.004, .097, .002), (.046, .028, .023), (.0098, .0074)),
    ('ring', (.008, .012, -.003), (.015, .092, .0), (.043, .027, .022), (.0092, .007)),
    ('pinky', (.018, .01, -.004), (.031, .082, -.004), (.034, .02, .019), (.0082, .0062)),
]
THUMB = ('thumb', (-.02, .018, -.012), (-.045, .05, -.026), (.034, .03), (.0118, .0085))


def finger_points(base, mcp, lens, spread=0.0, curl=(.12, .1, .08)):
    """Punti delle articolazioni di un dito in posa di riposo con una leggera flessione naturale."""
    pts = [WRIST + Vector(base), WRIST + Vector(mcp)]
    d = (pts[1] - pts[0]).normalized()
    d.z = 0
    d.normalize()
    a = 0.0
    p = pts[1]
    for i, L in enumerate(lens):
        a += curl[i]
        v = Vector((d.x, d.y * math.cos(a), -math.sin(a)))
        p = p + v.normalized() * L
        pts.append(p)
    return pts


def build_side(side, name):
    """Crea mesh della pelle, manica, unghie e armatura per un lato (side = +1 destra, -1 sinistra)."""
    X = lambda v: Vector((v.x * side, v.y, v.z))
    # --- scheletro di vertici con raggi (x = larghezza, y = spessore) per il modificatore Skin
    verts, edges, radii, roots = [], [], [], []
    def add(p, r):
        verts.append(X(p))
        radii.append(r)
        return len(verts) - 1
    sh = add(Vector((0, -.02, 0)), (.05, .05))
    up1 = add(Vector((0, .1, 0)), (.047, .045))
    up2 = add(Vector((0, .2, -.002)), (.042, .04))
    el = add(Vector((0, UPPER, 0)), (.036, .034))       # gomito
    f1 = add(Vector((0, UPPER + .06, .002)), (.04, .036))   # massa muscolare dell'avambraccio
    f2 = add(Vector((0, UPPER + .16, 0)), (.031, .026))
    wr = add(WRIST, (.026, .018))                         # polso: ellittico
    for a, b in ((sh, up1), (up1, up2), (up2, el), (el, f1), (f1, f2), (f2, wr)):
        edges.append((a, b))
    joints = {'shoulder': X(Vector((0, -.02, 0))), 'elbow': X(Vector((0, UPPER, 0))), 'wrist': X(WRIST)}
    # dita: catene separate che partono poco dentro il palmo (il palmo è un volume a parte, unito prima dei pesi)
    for fname, base, mcp, lens, (r0, r1) in FINGERS:
        pts = finger_points(base, mcp, lens)
        rs = [(r0 * 1.05, r0 * .95)] + [(r0 + (r1 - r0) * (k + 1) / 3, (r0 + (r1 - r0) * (k + 1) / 3) * .9) for k in range(3)]
        start = pts[1] - (pts[2] - pts[1]).normalized() * .018
        prev = add(start, (r0 * 1.05, r0 * .9))
        roots.append(prev)
        for k, p in enumerate(pts[1:], 0):
            i = add(p, rs[k])
            edges.append((prev, i))
            prev = i
        joints[fname] = [X(p) for p in pts]
    # pollice: CMC vicino al polso, metacarpo verso avanti-sinistra-basso, due falangi
    tb, tm, (l1, l2), (r0, r1) = THUMB[1], THUMB[2], THUMB[3], THUMB[4]
    p0 = WRIST + Vector(tb)
    p1 = WRIST + Vector(tm)
    dth = (p1 - p0).normalized()
    p2 = p1 + (dth + Vector((0, .25, -.1))).normalized() * l1
    p3 = p2 + (dth + Vector((.15, .5, -.15))).normalized() * l2
    prev = add(WRIST + Vector((-.006, .01, -.006)), (.016, .013))   # eminenza tenar: radice grossa del pollice
    roots.append(prev)
    for p, r in ((p0, (r0 * 1.7, r0 * 1.35)), (p1, (r0 * 1.15, r0 * 1.05)), (p2, (r0, r0 * .9)), (p3, (r1, r1 * .85))):
        i = add(p, r)
        edges.append((prev, i))
        prev = i
    joints['thumb'] = [X(p) for p in (p0, p1, p2, p3)]

    me = bpy.data.meshes.new(name + '_skin')
    me.from_pydata([tuple(v) for v in verts], edges, [])
    ob = bpy.data.objects.new(name + '_skin', me)
    bpy.context.scene.collection.objects.link(ob)
    sk = ob.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = .7
    for i, sv in enumerate(me.skin_vertices[0].data):
        sv.radius = radii[i]
    me.skin_vertices[0].data[0].use_root = True
    for r in roots:   # ogni catena isolata (dita, pollice) ha bisogno della sua radice
        me.skin_vertices[0].data[r].use_root = True
    ss = ob.modifiers.new('subsurf', 'SUBSURF')
    ss.levels = 2
    ss.render_levels = 2
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='skin')
    bpy.ops.object.modifier_apply(modifier='subsurf')
    bpy.ops.object.shade_smooth()
    # palmo: loft a sezioni ovali schiacciate dal polso alle nocche (dorso arcuato, palmo più pieno verso il mignolo)
    pb = bmesh.new()
    K = 24
    st = [(-.025, .024, .013, .012, 0), (-.008, .027, .012, .011, -.001), (.012, .033, .012, .011, -.002), (.04, .039, .0115, .011, -.004), (.068, .042, .011, .0105, -.004), (.088, .042, .0098, .009, -.004), (.1, .037, .0075, .0068, -.004), (.108, .026, .005, .0045, -.004)]
    rings = []
    for dy, w, top, bot, cx in st:
        ring = []
        for k in range(K):
            a = 2 * math.pi * k / K
            c, s = math.cos(a), math.sin(a)
            x = cx + w * c
            z = (top if s > 0 else bot) * s
            ring.append(pb.verts.new(X(WRIST + Vector((x, dy, z)))))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(K):
            pb.faces.new((rings[i][k], rings[i][(k + 1) % K], rings[i + 1][(k + 1) % K], rings[i + 1][k]))
    pb.faces.new(rings[0])
    pb.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(pb, faces=pb.faces)
    bmesh.ops.subdivide_edges(pb, edges=pb.edges[:], cuts=1, use_grid_fill=True, smooth=1.0)
    pme = bpy.data.meshes.new(name + '_palm')
    pb.to_mesh(pme)
    pb.free()
    po = bpy.data.objects.new(name + '_palm', pme)
    bpy.context.scene.collection.objects.link(po)
    for p in pme.polygons:
        p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    po.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()

    # --- armatura con le stesse articolazioni
    arm = bpy.data.armatures.new(name + '_rig')
    ao = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    E = arm.edit_bones
    def bone(n, h, t, parent=None, up=Vector((0, 0, 1))):
        b = E.new(n)
        b.head, b.tail = h, t
        b.align_roll(up)
        if parent:
            b.parent = E[parent]
        return b
    J = joints
    bone('upperarm', J['shoulder'], J['elbow'])
    bone('forearm', J['elbow'], J['wrist'], 'upperarm')
    bone('hand', J['wrist'], J['wrist'] + Vector((0, .07, 0)), 'forearm')
    for f in ('index', 'middle', 'ring', 'pinky'):
        p = J[f]
        bone(f + '_0', p[0], p[1], 'hand')
        for k in range(3):
            bone('%s_%d' % (f, k + 1), p[k + 1], p[k + 2], '%s_%d' % (f, k))
    p = J['thumb']
    bone('thumb_0', p[0], p[1], 'hand', up=Vector((side * -.5, 0, 1)))
    bone('thumb_1', p[1], p[2], 'thumb_0', up=Vector((side * -.7, 0, .7)))
    bone('thumb_2', p[2], p[3], 'thumb_1', up=Vector((side * -.7, 0, .7)))
    bpy.ops.object.mode_set(mode='OBJECT')

    # --- pelle: pesi automatici (calore)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    ao.select_set(True)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # --- unghie: piccole lamine curve sulle falangette, peso 1 sull'osso
    parts = [ob]
    nb = bmesh.new()
    nail_groups = []
    for f in ('index', 'middle', 'ring', 'pinky', 'thumb'):
        p = J[f]
        a, b = p[-2], p[-1]
        d = (b - a).normalized()
        up = Vector((0, 0, 1)) if f != 'thumb' else Vector((side * -.5, 0, .8)).normalized()
        sideV = d.cross(up).normalized()
        upV = sideV.cross(d).normalized()
        r = .0072 if f != 'thumb' else .0085
        c = b - d * (r * 1.5) + upV * (r * .92)
        w, l = r * .82, r * 1.4
        vs = []
        for i in range(5):
            for j in range(3):
                u = (i / 4 - .5) * 2
                v = j / 2
                q = c + sideV * (u * w) + d * ((v - .5) * l) - upV * (u * u * r * .35)
                vs.append(nb.verts.new(q))
        for i in range(4):
            for j in range(2):
                nb.faces.new((vs[i * 3 + j], vs[(i + 1) * 3 + j], vs[(i + 1) * 3 + j + 1], vs[i * 3 + j + 1]))
        nail_groups.append(('%s_%d' % (f, 3 if f != 'thumb' else 2), len(vs)))
    nme = bpy.data.meshes.new(name + '_nails')
    nb.to_mesh(nme)
    nb.free()
    no = bpy.data.objects.new(name + '_nails', nme)
    bpy.context.scene.collection.objects.link(no)
    k0 = 0
    for g, n in nail_groups:
        vg = no.vertex_groups.new(name=g)
        vg.add(list(range(k0, k0 + n)), 1.0, 'REPLACE')
        k0 += n
    no.parent = ao
    m = no.modifiers.new('arm', 'ARMATURE')
    m.object = ao
    parts.append(no)

    # --- manica della giacca M1941 (lana oliva): dalla spalla al polsino, con pieghe; polsino abbottonato
    sb = bmesh.new()
    K, rings = 28, []
    stations = []
    for i in range(22):
        t = i / 21
        y = -.03 + t * (UPPER + FORE - .055)
        base = .062 - .016 * t
        if y > UPPER - .06 and y < UPPER + .07:
            base += .011   # sacca di tessuto al gomito (spazio per la piega del braccio)
        stations.append((y, base))
    stations.append((UPPER + FORE - .04, .036))   # polsino
    stations.append((UPPER + FORE - .022, .036))
    for i, (y, r) in enumerate(stations):
        ring = []
        for k in range(K):
            a = 2 * math.pi * k / K
            fold = .0035 * math.sin(a * 3 + i * 1.7) + .0025 * math.sin(a * 5 - i * .9) * (1 if i % 3 else 0) + (.004 if (i in (8, 9, 13, 14) and math.sin(a) < 0) else 0)
            rr = r + fold
            ring.append(sb.verts.new(X(Vector((math.cos(a) * rr, y, math.sin(a) * rr * .92)))))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(K):
            f = (rings[i][k], rings[i][(k + 1) % K], rings[i + 1][(k + 1) % K], rings[i + 1][k])
            sb.faces.new(f if side > 0 else tuple(reversed(f)))
    # bordo del polsino rivoltato verso l'interno (spessore visibile)
    inner = [sb.verts.new(v.co * Vector((1, 1, 1)) - (v.co - Vector((0, v.co.y, 0))) * .18) for v in rings[-1]]
    for k in range(K):
        f = (rings[-1][k], rings[-1][(k + 1) % K], inner[(k + 1) % K], inner[k])
        sb.faces.new(f if side > 0 else tuple(reversed(f)))
    bmesh.ops.recalc_face_normals(sb, faces=sb.faces)
    sme = bpy.data.meshes.new(name + '_sleeve')
    sb.to_mesh(sme)
    sb.free()
    so = bpy.data.objects.new(name + '_sleeve', sme)
    bpy.context.scene.collection.objects.link(so)
    for p in sme.polygons:
        p.use_smooth = True
    gu, gf = so.vertex_groups.new(name='upperarm'), so.vertex_groups.new(name='forearm')
    for v in sme.vertices:   # pesi della manica: transizione morbida al gomito
        y = v.co.y
        w = min(1, max(0, (y - (UPPER - .05)) / .1))
        if w < 1:
            gu.add([v.index], 1 - w, 'REPLACE')
        if w > 0:
            gf.add([v.index], w, 'REPLACE')
    so.parent = ao
    m = so.modifiers.new('arm', 'ARMATURE')
    m.object = ao
    parts.append(so)
    # bottone del polsino
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.0055, depth=.003, location=tuple(X(Vector((.03, UPPER + FORE - .033, .012)))), rotation=(0, math.pi / 2 * side, 0))
    btn = bpy.context.object
    btn.name = name + '_button'
    vg = btn.vertex_groups.new(name='forearm')
    vg.add([v.index for v in btn.data.vertices], 1.0, 'REPLACE')
    btn.parent = ao
    btn.matrix_parent_inverse = ao.matrix_world.inverted()
    m = btn.modifiers.new('arm', 'ARMATURE')
    m.object = ao
    parts.append(btn)
    return ao, {'skin': ob, 'nails': no, 'sleeve': so, 'button': btn}, joints


def generate():
    out = {}
    for side, nm in ((1, 'FPA_R'), (-1, 'FPA_L')):
        out[nm] = build_side(side, nm)
    return out
