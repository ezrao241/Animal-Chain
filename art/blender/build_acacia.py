"""Build the three umbrella-thorn acacias as smooth, textured GLBs.

Run headless:  ~/blender-venv/bin/python -I art/blender/build_acacia.py <acacia.json> <outdir> [preview]

<acacia.json> is lib/acacia.ts's acaciaShape() for each seed (the same trunk and limb data the climbing rules use), so
the bark that is drawn is exactly the bark a leopard climbs: the trunk and every limb follow their centrelines and
radii, fused into one smoothly branching surface. Fine twigs fan out from the limb tips into flat, layered canopy pads
of alpha-cut leaf sprays (the umbrella-thorn's flat top). Each tree ships a near and a far cut.
Model space: metres for a size-1 tree, three.js axes (x, y up, z); Blender is z up, so (x, y, z) -> (x, -z, y).
"""
import bpy, bmesh, json, math, sys, os
import numpy as np
from mathutils import Vector, Matrix, noise

argv = sys.argv[1:]
SHAPES = json.load(open(argv[0])); OUTDIR = argv[1]; PREVIEW = len(argv) > 2
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import textures  # noqa: E402

def tb(p): return Vector((p[0], -p[2], p[1]))

def select_only(*obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]

def apply_mods(ob):
    select_only(ob)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def tube(name, pts, radii, sides=16, caps=True):
    """a tapered tube through points (three.js metres) with a radius per point, sampled finely"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = sides // 4
    cu.use_fill_caps = caps
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, r, q in zip(sp.points, radii, pts):
        v = tb(q); p.co = (v.x, v.y, v.z, 1); p.radius = r
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    select_only(ob); bpy.ops.object.convert(target='MESH'); return bpy.context.active_object

def tri_count(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def mesh_object(name, verts, faces, uvs=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if uvs is not None:
        uvl = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices: uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    return ob

def material(name, diff, nor=None, alpha=False, rough=.9):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(diff, check_existing=True)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    if alpha: nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    if nor:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(nor, check_existing=True); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m

os.makedirs(OUTDIR, exist_ok=True)
TEX = textures.acacia_textures(OUTDIR)

for seed, shape in SHAPES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = np.random.default_rng(int(seed))
    # ---------------------------------------------------------------- bark: trunk and limbs fused
    pieces = [tube('trunk', [t['c'] for t in shape['trunk']] + [[shape['trunk'][-1]['c'][0], shape['trunk'][-1]['c'][1] + .25, 0]],
                   [t['r'] for t in shape['trunk']] + [.12])]
    # root flare: a few buttresses where the trunk meets the soil
    for k in range(5):
        a = k / 5 * 6.283 + rng.random(); pieces.append(tube('root%d' % k, [[0, .25, 0], [math.cos(a) * .32, -.05, math.sin(a) * .32], [math.cos(a) * .55, -.25, math.sin(a) * .55]], [.11, .06, .02]))
    twigs = []
    for li, limb in enumerate(shape['limbs']):
        pieces.append(tube('limb%d' % li, limb['path'], limb['radii']))
        # branchlets from the outer limb, reaching up and out into the canopy pad, forking twice
        tip = np.array(limb['path'][-1]); mid = np.array(limb['path'][1]); d = tip - mid; d /= np.linalg.norm(d)
        for b in range(5 if not limb['rest'] else 3):
            t = .45 + .55 * rng.random(); start = mid + (tip - mid) * t
            dirn = d * .6 + np.array([0, .7, 0]) + rng.normal(0, .35, 3); dirn /= np.linalg.norm(dirn)
            L = .7 + .9 * rng.random(); end = start + dirn * L
            twigs.append(tube('tw', [start.tolist(), ((start + end) / 2 + rng.normal(0, .06, 3)).tolist(), end.tolist()], [.035, .022, .01], sides=6))
            for f in range(2):
                d2 = dirn + rng.normal(0, .5, 3); d2[1] = abs(d2[1]) * .5; d2 /= np.linalg.norm(d2)
                e2 = end + d2 * (.4 + .5 * rng.random())
                twigs.append(tube('tw', [end.tolist(), e2.tolist()], [.012, .005], sides=4))
    select_only(*pieces); bpy.ops.object.join(); bark = bpy.context.active_object; bark.name = 'bark'
    rm = bark.modifiers.new('r', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = .012
    sm = bark.modifiers.new('s', 'CORRECTIVE_SMOOTH'); sm.iterations = 8; sm.use_only_smooth = True
    apply_mods(bark)
    # bark ridges: fissures running along the wood
    me = bark.data; n = len(me.vertices); co = np.empty(n * 3); nm = np.empty(n * 3)
    me.vertices.foreach_get('co', co); me.vertices.foreach_get('normal', nm); co = co.reshape(-1, 3); nm = nm.reshape(-1, 3)
    f = np.array([noise.noise(Vector((p[0] * 9, p[1] * 9, p[2] * 1.2))) * .5 + noise.noise(Vector((p[0] * 30, p[1] * 30, p[2] * 4))) * .25 for p in co])
    me.vertices.foreach_set('co', (co + nm * f[:, None] * .012).ravel()); me.update()
    select_only(*twigs); bpy.ops.object.join(); tw = bpy.context.active_object
    select_only(bark, tw); bpy.ops.object.join(); bark = bpy.context.active_object; bark.name = 'bark'
    dec = bark.modifiers.new('d', 'DECIMATE'); dec.ratio = min(1, 2600 / tri_count(bark)); apply_mods(bark)
    for p in bark.data.polygons: p.use_smooth = True
    select_only(bark); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=1.2); bpy.ops.object.mode_set(mode='OBJECT')
    bark.data.materials.append(material('bark', TEX['bark'], TEX['bark_n'], rough=.95))

    # ---------------------------------------------------------------- leaves: flat layered sprays in each canopy pad
    def sprays(count_scale, size_scale):
        V, F, UV = [], [], []
        for ci, c in enumerate(shape['canopy']):
            cx, cy, cz = c['c']; rx, ry, rz = c['r']; rot = c['rot']
            n = int(count_scale * (rx * rz) * 34)
            for k in range(n):
                # points fill the flattened pad, denser and higher towards its top
                while True:
                    u = rng.uniform(-1, 1, 3)
                    if (u ** 2).sum() < 1: break
                u[1] = abs(u[1]) ** .6 * (1 if rng.random() < .8 else -1)
                lx, ly, lz = u[0] * rx, u[1] * ry, u[2] * rz
                x = cx + lx * math.cos(rot) - lz * math.sin(rot); z = cz + lx * math.sin(rot) + lz * math.cos(rot); y = cy + ly
                s = (.38 + .3 * rng.random()) * size_scale; a = rng.random() * 6.283
                tilt = rng.normal(0, .25); col = rng.integers(4)
                # a near-horizontal spray, gently tilted, quad corners in the spray's own frame
                ax = np.array([math.cos(a), math.sin(tilt) * .6, math.sin(a)]); ax /= np.linalg.norm(ax)
                bz = np.cross(ax, [0, 1, 0]); bz /= np.linalg.norm(bz); bz = bz + np.array([0, rng.normal(0, .3), 0]); bz /= np.linalg.norm(bz)
                base = len(V); centre = np.array([x, y, z])
                for (i, j) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                    V.append(tb(centre + ax * i * s + bz * j * s * .75)); UV.append(((col + (i + 1) / 2) / 4, (j + 1) / 2))
                F.append((base, base + 1, base + 2, base + 3))
        return V, F, UV
    V, F, UV = sprays(1, 1)
    leaves = mesh_object('leaves', V, F, UV)
    lm = material('leaves', TEX['leaf'], alpha=True, rough=.8)
    leaves.data.materials.append(lm)
    for p in leaves.data.polygons: p.use_smooth = True
    # leaf normals point up (sky lit canopy, no dark backfaces)
    leaves.data.update()
    # ---------------------------------------------------------------- far cut
    far = bark.copy(); far.data = bark.data.copy(); bpy.context.scene.collection.objects.link(far); far.name = 'bark_far'
    dec = far.modifiers.new('d', 'DECIMATE'); dec.ratio = 500 / tri_count(far); apply_mods(far)
    V, F, UV = sprays(.12, 2.2)
    lfar = mesh_object('leaves_far', V, F, UV); lfar.data.materials.append(lm)
    for p in lfar.data.polygons: p.use_smooth = True
    print('acacia', seed, 'bark', tri_count(bark), 'leaves', len(leaves.data.polygons), 'far', tri_count(far), len(lfar.data.polygons), flush=True)
    out = os.path.join(OUTDIR, 'acacia-%s.glb' % seed)
    select_only(bark, leaves, far, lfar)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_materials='EXPORT')
    print('wrote', out, os.path.getsize(out) // 1024, 'KB', flush=True)
    if PREVIEW:
        import preview
        far.hide_render = True; lfar.hide_render = True
        preview.render(os.path.join(OUTDIR, 'acacia-%s.png' % seed), [bark, leaves], samples=24)

# ---------------------------------------------------------------- thicket bushes (unit size, scaled by the game)
# Dense rounded scrub: a few woody stems from the ground, and leaf sprays filling the same overlapping masses as the
# procedural bushes (savanna-world.ts shrub()), so hiding spots keep their footprint. Variant 1 is the sparser,
# grey-olive thorn scrub.
BUSHES = [[((0, .55, 0), (1.1, .75, 1.1)), ((.6, .4, .3), (.7, .5, .7)), ((-.55, .45, -.35), (.65, .55, .6))],
          [((0, .55, 0), (1.1, .75, 1.1)), ((.6, .4, .3), (.7, .5, .7)), ((-.55, .45, -.35), (.65, .55, .6)), ((.1, .95, -.2), (.5, .45, .5))]]
for k, masses in enumerate(BUSHES):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = np.random.default_rng(100 + k)
    stems = []
    for s in range(7):
        a = rng.random() * 6.283; r = .15 * rng.random(); top = np.array([math.cos(a) * .7, .9 + .3 * rng.random(), math.sin(a) * .7]) * rng.uniform(.5, 1)
        stems.append(tube('st', [[math.cos(a) * r, -.05, math.sin(a) * r], (top * .5 + rng.normal(0, .05, 3)).tolist(), top.tolist()], [.045, .03, .012], sides=6))
    select_only(*stems); bpy.ops.object.join(); wood = bpy.context.active_object; wood.name = 'wood'
    for p in wood.data.polygons: p.use_smooth = True
    select_only(wood); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=.6); bpy.ops.object.mode_set(mode='OBJECT')
    wood.data.materials.append(material('bark', TEX['bark'], TEX['bark_n'], rough=.95))
    def fill(density, size):
        V, F, UV = [], [], []
        for (c, r) in masses:
            for i in range(int(density * r[0] * r[2] * 4)):
                while True:
                    u = rng.uniform(-1, 1, 3)
                    if (u ** 2).sum() < 1: break
                # sprays sit mostly on the outside of each mass, facing out
                u = u / np.linalg.norm(u) * (.7 + .3 * rng.random())
                centre = np.array(c) + u * np.array(r)
                if centre[1] < .08: continue
                out = u / np.linalg.norm(u); ax = np.cross(out, rng.normal(0, 1, 3)); ax /= np.linalg.norm(ax); bz = np.cross(out, ax)
                s = size * (.8 + .4 * rng.random()); col = rng.integers(4); base = len(V)
                for (i2, j2) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                    V.append(tb(centre + ax * i2 * s + bz * j2 * s * .8)); UV.append(((col + (i2 + 1) / 2) / 4, (j2 + 1) / 2))
                F.append((base, base + 1, base + 2, base + 3))
        return V, F, UV
    lm = material('leaves', TEX['leaf'], alpha=True, rough=.85)
    V, F, UV = fill(70, .32); leaves = mesh_object('leaves', V, F, UV); leaves.data.materials.append(lm)
    V, F, UV = fill(14, .6); lfar = mesh_object('leaves_far', V, F, UV); lfar.data.materials.append(lm)
    for o in (leaves, lfar):
        for p in o.data.polygons: p.use_smooth = True
    out = os.path.join(OUTDIR, 'bush-%d.glb' % k)
    select_only(wood, leaves, lfar)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_materials='EXPORT')
    print('wrote', out, len(leaves.data.polygons), len(lfar.data.polygons), os.path.getsize(out) // 1024, 'KB', flush=True)
    if PREVIEW and k == 0:
        import preview
        lfar.hide_render = True
        preview.render(os.path.join(OUTDIR, 'bush.png'), [wood, leaves], samples=24)
