"""Build one savanna animal as a smooth, skinned, textured GLB for the game.

Run headless:  ~/blender-venv/bin/python -I art/blender/build_animal.py <spec.json> <species> <out.glb> [preview.png]

<spec.json> is the anatomy the game itself uses (dumped from components/game/safari-animals.ts), so the Blender body
has exactly the game's proportions and its skeleton is the game's joint hierarchy (body, neck, head, ears, two tail
segments, three per leg). Steps:
  1. the game's reference parts (torso, neck, head, legs, tail...) plus a few anatomical masses (shoulder blades,
     haunches, cheeks) are fused into one watertight surface by voxel remeshing and relaxed into soft fillets, so the
     body reads as one animal rather than joined shapes;
  2. the coat is painted per vertex on that fine surface (continuous gradients, markings, fur-grain noise);
  3. a game mesh is decimated from it, unwrapped, and the coat colour and a normal map (muscle and fur detail) are
     baked from the fine surface onto it;
  4. each vertex is skinned to the joints of the parts it is nearest to, blended across the joints;
  5. a far level of detail and the extra hair (mane) cards are exported alongside.
Coordinates: the spec is three.js metres (x forward, y up, z right); Blender is z up, so (x, y, z) -> (x, -z, y).
"""
import bpy, bmesh, json, math, sys, os, random
import numpy as np
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SPEC_PATH, SPECIES, OUT = argv[0], argv[1], argv[2]
PREVIEW = argv[3] if len(argv) > 3 else None
spec = json.load(open(SPEC_PATH))[SPECIES]
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import coats  # noqa: E402  per-species coat painting, anatomy masses and hair

def tb(p):
    return Vector((p[0], -p[2], p[1]))

def fb(v):
    """Blender -> three.js metres"""
    return np.array([v[0], v[2], -v[1]])

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mesh_object(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob

def part_object(name, flat):
    a = np.array(flat, dtype=np.float64).reshape(-1, 3)
    verts = [tb(p) for p in a]
    faces = [(i, i + 1, i + 2) for i in range(0, len(verts), 3)]
    ob = mesh_object(name, verts, faces)
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    return ob

def ellipsoid(name, c, r, rot=(0, 0, 0), seg=24):
    """an ellipsoid in three.js coordinates (c, r in metres, rot = three.js Euler XYZ)"""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1)
    e = Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[2], 4, 'Z')
    verts = []
    for v in bm.verts:
        p = e @ Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
        verts.append(tb((p.x + c[0], p.y + c[1], p.z + c[2])))
    faces = [[v.index for v in f.verts] for f in bm.faces]; bm.free()
    return mesh_object(name, verts, faces)

def select_only(*obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]

def apply_mods(ob):
    select_only(ob)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

JOINT_OF = lambda part: 'body' if part.split('#')[0] == 'torso' else part.split('#')[0]

reset()
scene = bpy.context.scene
style = coats.STYLE[SPECIES]

# ---------------------------------------------------------------- 1. reference parts and the fused surface
parts = {}
for name, flat in spec['parts'].items():
    if name.split('#')[-1] in style.get('skip_parts', ()):
        continue
    parts[name] = part_object('ref_' + name, flat)
masses = [ellipsoid('mass_%d' % i, m['c'], m['r'], m.get('rot', (0, 0, 0))) for i, m in enumerate(style['masses'](spec))]
for i, m in enumerate(style['masses'](spec)):
    masses[i]['joint'] = m['joint']

# the fused surface depends only on the anatomy and the fusing settings, so it is cached between runs (remeshing and
# relaxing take minutes)
import hashlib
key = hashlib.sha1(json.dumps([spec['parts'], [dict(m, joint=None) for m in style['masses'](spec)], style['voxel'], style['relax'], style['soften']], sort_keys=True, default=str).encode()).hexdigest()[:16]
CACHE = os.path.join(os.environ.get('ANIMAL_CACHE', '/tmp/animal-chain-blender'), '%s-%s.npz' % (SPECIES, key))
if os.path.exists(CACHE):
    c = np.load(CACHE); me = bpy.data.meshes.new('hi'); me.vertices.add(len(c['v'])); me.vertices.foreach_set('co', c['v'].ravel())
    me.loops.add(len(c['f']) * 4); me.loops.foreach_set('vertex_index', c['f'].ravel()); me.polygons.add(len(c['f']))
    me.polygons.foreach_set('loop_start', np.arange(0, len(c['f']) * 4, 4)); me.update(); me.validate()
    hi = bpy.data.objects.new('hi', me); scene.collection.objects.link(hi)
else:
    fuse = []
    for name, ob in parts.items():
        d = ob.copy(); d.data = ob.data.copy(); scene.collection.objects.link(d); fuse.append(d)
    for m in masses:
        d = m.copy(); d.data = m.data.copy(); scene.collection.objects.link(d); fuse.append(d)
    select_only(*fuse); bpy.ops.object.join(); hi = bpy.context.active_object; hi.name = 'hi'
    rm = hi.modifiers.new('remesh', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = style['voxel']; rm.adaptivity = 0
    sm = hi.modifiers.new('relax', 'CORRECTIVE_SMOOTH'); sm.iterations = style['relax']; sm.smooth_type = 'LENGTH_WEIGHTED'; sm.use_only_smooth = True; sm.scale = 1
    lp = hi.modifiers.new('soft', 'LAPLACIANSMOOTH'); lp.iterations = style['soften']; lp.lambda_factor = .6; lp.use_volume_preserve = True
    apply_mods(hi)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    v = np.empty(len(hi.data.vertices) * 3); hi.data.vertices.foreach_get('co', v)
    if all(len(p.vertices) == 4 for p in hi.data.polygons):
        f = np.array([p.vertices[:] for p in hi.data.polygons]); np.savez(CACHE, v=v.reshape(-1, 3), f=f)
print('fine surface', len(hi.data.vertices), 'verts', flush=True)

# ---------------------------------------------------------------- which part each point belongs to
# dense surface samples of every reference part, for nearest-part queries (coat regions and skin weights)
from scipy.spatial import cKDTree

def surface_samples(ob, spacing=.008):
    me = ob.data; me.calc_loop_triangles()
    V = np.array([v.co[:] for v in me.vertices]); T = np.array([t.vertices[:] for t in me.loop_triangles])
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2
    n = np.maximum(1, np.round(area / spacing ** 2).astype(int))
    rng = np.random.default_rng(3)
    tri = np.repeat(np.arange(len(T)), n)
    u, v = rng.random(len(tri)), rng.random(len(tri)); flip = u + v > 1; u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    pts = a[tri] + (b[tri] - a[tri]) * u[:, None] + (c[tri] - a[tri]) * v[:, None]
    return np.concatenate([pts, V])

LABELS = []; SAMPLES = []
for name, ob in parts.items():
    pts = surface_samples(ob); SAMPLES.append(pts); LABELS.append((name, len(pts)))
for m in masses:
    pts = surface_samples(m); SAMPLES.append(pts); LABELS.append(('mass:' + m.name, len(pts)))
ALL = np.concatenate(SAMPLES); OWNER = np.concatenate([np.full(n, k) for k, (_, n) in enumerate(LABELS)])
KD = cKDTree(ALL)
NAMES = [l[0] for l in LABELS]
print('reference samples', len(ALL), flush=True)

def part_distances(points, k=64):
    pts = np.array([p[:] for p in points])
    d, i = KD.query(pts, k=k, workers=-1)
    D = np.full((len(pts), len(NAMES)), 9.0)
    own = OWNER[i]; rows = np.arange(len(pts))
    for col in range(k):
        o = own[:, col]
        D[rows, o] = np.minimum(D[rows, o], d[:, col])
    return NAMES, D

def joint_name(n):
    if n.startswith('mass:'):
        return next(m['joint'] for m in masses if m.name == n[5:])
    return JOINT_OF(n)

# ---------------------------------------------------------------- 2. coat on the fine surface
hi_pts = [v.co.copy() for v in hi.data.vertices]
names, D = part_distances(hi_pts)
nearest = [names[i] for i in D.argmin(1)]
nearest = [n if not n.startswith('mass:') else 'mass:' + joint_name(n) for n in nearest]
hi.data.calc_normals_split() if hasattr(hi.data, 'calc_normals_split') else None
P = np.array([fb(v.co) for v in hi.data.vertices]); N = np.array([fb(v.normal) for v in hi.data.vertices])
cols, fur = coats.paint(SPECIES, P, N, nearest, spec)
HAIR_ROOTS = {'P': P, 'N': N, 'col': cols, 'part': nearest}
ca = hi.data.color_attributes.new('coat', 'FLOAT_COLOR', 'POINT')
ca.data.foreach_set('color', np.concatenate([cols, np.ones((len(cols), 1))], 1).astype(np.float32).ravel())
# fur grain and fine anatomy as real geometry on the fine surface, for the normal bake
disp = fur  # metres, along the normal

def offset(ob, amount):
    # read every normal first: touching a vertex invalidates the mesh's normals
    me = ob.data; n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); nm = np.empty(n * 3); me.vertices.foreach_get('normal', nm)
    me.vertices.foreach_set('co', (co.reshape(-1, 3) + nm.reshape(-1, 3) * np.asarray(amount)[:, None]).ravel()); me.update()
offset(hi, disp)

# ---------------------------------------------------------------- eyes (not fused: a glossy ball set in the head)
def eye_ball(side):
    e = spec['eye']; c = list(e['c']); c[2] *= side; r = e['r']; s = max(r) * 1.3
    # set a little proud of the face so the eye reads (the reference head surface sits over its centre)
    c[0] += s * .25; c[2] += side * s * .3
    ob = ellipsoid('eye%d' % side, c, (s, s, s * .9), (0, -.35 * side, 0), seg=20)
    P = np.array([fb(v.co) for v in ob.data.vertices]); cen = np.array(c)
    d = P - cen; d /= np.linalg.norm(d, axis=1, keepdims=True)
    # gaze: forward and a little outward
    g = np.array([math.cos(.35), 0, math.sin(.35) * side]); t = d @ g
    col = np.zeros((len(P), 3)); iris = np.array(coats.hexc(style['iris']))
    col[:] = iris * .25
    ring = np.clip((t - .55) / .1, 0, 1)
    col = col * (1 - ring[:, None]) + iris * ring[:, None]
    col *= (1 + .25 * np.sin(np.arctan2(d[:, 1], d[:, 2]) * 23))[:, None] * (t > .6)[:, None] + (t <= .6)[:, None]
    pupil = np.clip((t - style.get('pupil', .9)) / .02, 0, 1)
    col = col * (1 - pupil[:, None]) + np.array([.02, .015, .01]) * pupil[:, None]
    a = ob.data.color_attributes.new('coat', 'FLOAT_COLOR', 'POINT')
    a.data.foreach_set('color', np.concatenate([col, np.ones((len(col), 1))], 1).astype(np.float32).ravel())
    return ob
eyes = [eye_ball(1), eye_ball(-1)]

# ---------------------------------------------------------------- 3. the game mesh
lo = hi.copy(); lo.data = hi.data.copy(); scene.collection.objects.link(lo); lo.name = 'lo'
# rebuild from the un-displaced surface: undo the fur offset before decimating
offset(lo, -disp)
tri = lo.modifiers.new('tri', 'TRIANGULATE'); apply_mods(lo)
dec = lo.modifiers.new('dec', 'DECIMATE'); dec.ratio = style['tris'] / max(1, len(lo.data.polygons)); apply_mods(lo)
eyes_lo = []
for e in eyes:
    d = e.copy(); d.data = e.data.copy(); scene.collection.objects.link(d); eyes_lo.append(d)
select_only(lo, *eyes_lo); bpy.ops.object.join(); lo = bpy.context.active_object
select_only(hi, *eyes); bpy.ops.object.join(); hi = bpy.context.active_object
for p in lo.data.polygons: p.use_smooth = True
for p in hi.data.polygons: p.use_smooth = True
print('game mesh', len(lo.data.polygons), 'tris', flush=True)

select_only(lo); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=.006, area_weight=.6)
bpy.ops.uv.pack_islands(margin=.004)
bpy.ops.object.mode_set(mode='OBJECT')

RES = style['tex']
def bake_image(name, colorspace):
    im = bpy.data.images.new(name, RES, RES, alpha=False); im.colorspace_settings.name = colorspace; return im
albedo = bake_image(SPECIES + '_albedo', 'sRGB'); normal = bake_image(SPECIES + '_normal', 'Non-Color')

def emit_material(ob):
    m = bpy.data.materials.new('emit'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'coat'
    em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(a.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs[0])
    ob.data.materials.clear(); ob.data.materials.append(m)
emit_material(hi)
lm = bpy.data.materials.new('target'); lm.use_nodes = True; tex = lm.node_tree.nodes.new('ShaderNodeTexImage')
lo.data.materials.clear(); lo.data.materials.append(lm)

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 1
scene.render.bake.use_selected_to_active = True; scene.render.bake.cage_extrusion = .012; scene.render.bake.max_ray_distance = .04
scene.render.bake.margin = 6
select_only(lo, hi); lo.select_set(True); hi.select_set(True); bpy.context.view_layer.objects.active = lo
tex.image = albedo; lm.node_tree.nodes.active = tex
bpy.ops.object.bake(type='EMIT')
tex.image = normal; lm.node_tree.nodes.active = tex
bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
print('baked', flush=True)

# ---------------------------------------------------------------- 4. skinning
JOINTS = spec['joints']

def skin(ob):
    pts = [v.co.copy() for v in ob.data.vertices]
    names, D = part_distances(pts)
    jn = [joint_name(n) for n in names]
    joints = [j[0] for j in JOINTS]
    groups = {j: ob.vertex_groups.new(name=j) for j in joints}
    sigma = style['blend']
    for i in range(len(pts)):
        d = D[i]; w = np.exp(-(d - d.min()) / sigma)
        acc = {}
        for k, wk in enumerate(w):
            if wk > .02: acc[jn[k]] = max(acc.get(jn[k], 0), wk)
        # an eye moves with the head
        top = sorted(acc.items(), key=lambda x: -x[1])[:4]; s = sum(x[1] for x in top)
        for j, wk in top: groups[j].add([i], wk / s, 'REPLACE')
skin(lo)

arm_data = bpy.data.armatures.new('rig'); arm = bpy.data.objects.new('rig', arm_data); scene.collection.objects.link(arm)
select_only(arm); bpy.ops.object.mode_set(mode='EDIT')
children = {}
for name, parent, pivot in JOINTS: children.setdefault(parent, []).append(name)
piv = {name: Vector(tb(p)) for name, parent, p in JOINTS}
for name, parent, pivot in JOINTS:
    b = arm_data.edit_bones.new(name); b.head = piv[name]
    kids = children.get(name, [])
    tail = sum((piv[k] for k in kids), Vector()) / len(kids) if kids and name != 'body' else piv[name] + Vector((0, 0, .1))
    if (tail - b.head).length < .02: tail = b.head + Vector((0, 0, .06))
    b.tail = tail
for name, parent, pivot in JOINTS:
    if parent: arm_data.edit_bones[name].parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
lo.parent = arm; mod = lo.modifiers.new('rig', 'ARMATURE'); mod.object = arm

# ---------------------------------------------------------------- 5. far level of detail and hair cards
far = lo.copy(); far.data = lo.data.copy(); scene.collection.objects.link(far); far.name = SPECIES + '_far'
far.modifiers.clear()
dec = far.modifiers.new('dec', 'DECIMATE'); dec.ratio = style['far_tris'] / len(far.data.polygons); apply_mods(far)
far.parent = arm; mod = far.modifiers.new('rig', 'ARMATURE'); mod.object = arm
lo.name = SPECIES

final = bpy.data.materials.new(SPECIES + '_coat'); final.use_nodes = True; nt = final.node_tree
bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = .85
ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = albedo; nt.links.new(ta.outputs['Color'], bsdf.inputs['Base Color'])
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal; nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
for o in (lo, far): o.data.materials.clear(); o.data.materials.append(final)

# hair cards (a lion's mane): strands of alpha-cut cards rooted on the painted surface, skinned like the body
hair_obs = []
cards = coats.hair(SPECIES, HAIR_ROOTS, spec)
if cards:
    verts, faces, uvs, vcols = cards
    ho = mesh_object(SPECIES + '_hair', [tb(v) for v in verts], faces)
    uvl = ho.data.uv_layers.new(name='UVMap')
    for poly in ho.data.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[ho.data.loops[li].vertex_index]
    ca = ho.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set('color', np.concatenate([vcols, np.ones((len(vcols), 1))], 1).astype(np.float32).ravel())
    ho.data.color_attributes.active_color = ca
    for poly in ho.data.polygons: poly.use_smooth = True
    skin(ho)
    hm = bpy.data.materials.new(SPECIES + '_hair'); hm.use_nodes = True; hn = hm.node_tree; hb = hn.nodes['Principled BSDF']
    hi_img = bpy.data.images.load(coats.hair_texture(os.path.join(os.path.dirname(os.path.abspath(OUT)), SPECIES + '_hair_tex.png')))
    ht = hn.nodes.new('ShaderNodeTexImage'); ht.image = hi_img
    vc = hn.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    mul = hn.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
    hn.links.new(ht.outputs['Color'], mul.inputs['A']); hn.links.new(vc.outputs['Color'], mul.inputs['B'])
    hn.links.new(mul.outputs['Result'], hb.inputs['Base Color']); hn.links.new(ht.outputs['Alpha'], hb.inputs['Alpha'])
    hb.inputs['Roughness'].default_value = .9
    hm.blend_method = 'CLIP' if hasattr(hm, 'blend_method') else None
    ho.data.materials.append(hm)
    ho.parent = arm; mod = ho.modifiers.new('rig', 'ARMATURE'); mod.object = arm
    hair_obs.append(ho)
    print('hair cards', len(faces), 'quads', flush=True)

for o in (lo, far):
    for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)
# keep only what ships
for o in list(scene.objects):
    if o not in (arm, lo, far, *hair_obs): bpy.data.objects.remove(o, do_unlink=True)

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
select_only(arm, lo, far, *hair_obs)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
                          export_image_format='JPEG', export_jpeg_quality=88, export_apply=False, export_yup=True,
                          export_texcoords=True, export_normals=True, export_vertex_color='ACTIVE', export_tangents=False, export_materials='EXPORT')
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB', flush=True)

if PREVIEW:
    import preview
    preview.render(PREVIEW, [lo, *hair_obs])
