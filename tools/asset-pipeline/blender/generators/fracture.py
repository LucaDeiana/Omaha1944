"""Kit di frattura per il Dynamic Destruction Lab (solo tech demo).

Fratture di Voronoi vere: per ogni seme, il volume di partenza viene tagliato con i piani bisettori verso tutti gli
altri semi (bmesh.bisect_plane + chiusura del taglio); la cella che resta è convessa, le celle insieme ricompongono
esattamente il volume (verificato dal validatore). Ogni cella ha il pivot nel proprio baricentro.

Modelli (cubo unitario [-0,5; 0,5]^3, scalato a runtime alle dimensioni del pannello):
  frac_stone  muro in pietra: 18 celle che attraversano tutto lo spessore (semi con z quasi nulla)
  frac_wood   tavolato: 18 celle allungate in verticale (semi a colonne, come tavole che si spezzano)
  frac_beam   trave o pilastro: 6 celle lungo l'asse, tagli obliqui (rottura a becco di flauto)
  rubble_*    4 sassi di maceria irregolari
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector


def _cube(bm, sx=1.0, sy=1.0, sz=1.0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r['verts']:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))


def cell(seeds, i, size=(1, 1, 1)):
    bm = bmesh.new()
    _cube(bm, *size)
    si = seeds[i]
    for j, sj in enumerate(seeds):
        if j == i:
            continue
        n = (sj - si).normalized()
        mid = (si + sj) * .5
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=mid, plane_no=n, clear_outer=True)
        cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if cut:
            bmesh.ops.holes_fill(bm, edges=cut, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def volume(bm):
    return bm.calc_volume(signed=False)


def make_set(name, seeds, size=(1, 1, 1)):
    objs = []
    for i in range(len(seeds)):
        bm = cell(seeds, i, size)
        if len(bm.verts) < 4:
            bm.free()
            continue
        c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        for v in bm.verts:
            v.co -= c
        me = bpy.data.meshes.new('%s_%02d' % (name, i))
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(me.name, me)
        ob.location = c
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    return objs


def rubble(name, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=.5)
    for v in bm.verts:
        v.co *= .75 + rnd.random() * .45
        v.co.z *= .65
    bmesh.ops.convex_hull(bm, input=bm.verts[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for v in bm.verts:
        v.co -= c
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def generate(seed=7):
    rnd = random.Random(seed)
    sets = {}
    # pietra: 18 semi distribuiti sul piano del muro (x, y), quasi tutti a metà spessore
    s = []
    while len(s) < 18:
        p = Vector((rnd.uniform(-.47, .47), rnd.uniform(-.47, .47), rnd.uniform(-.06, .06)))
        if all((p - q).length > .14 for q in s):
            s.append(p)
    sets['frac_stone'] = make_set('frac_stone', s)
    # legno: 6 colonne (tavole) × 3 rotture lungo la tavola
    s = []
    for c in range(6):
        x = -.5 + (c + .5) / 6
        for k in range(3):
            s.append(Vector((x + rnd.uniform(-.02, .02), -.5 + (k + rnd.uniform(.2, .8)) / 3, rnd.uniform(-.03, .03))))
    sets['frac_wood'] = make_set('frac_wood', s)
    # trave lungo x: 6 celle con semi sfalsati in y (tagli obliqui)
    s = [Vector((-.5 + (k + .5) / 6, rnd.uniform(-.3, .3), rnd.uniform(-.2, .2))) for k in range(6)]
    sets['frac_beam'] = make_set('frac_beam', s)
    sets['rubble'] = [rubble('rubble_%d' % k, seed + k) for k in range(4)]
    return sets
