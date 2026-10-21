"""Kopje boulders: weathered granite, as the savanna's inselbergs are. Granite breaks along sheet joints and weathers into
smooth rounded domes, so each boulder is sculpted as a rounded mass with broad undulations, softened joint grooves and
fine grain, coloured from a photographed CC0 lichen-spotted rock (Poly Haven) and baked down to a game mesh.

Run headless:  ~/blender-venv/bin/python -I art/blender/build_rocks.py <outdir> [preview]
Unit boulder: radius 1 across, base 15 % below y=0 (the game scales and sinks it); four variants plus far cuts."""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector, noise

OUTDIR = sys.argv[1]; PREVIEW = len(sys.argv) > 2
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import textures  # noqa: E402

def select_only(*obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]

def apply_mods(ob):
    select_only(ob)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def tris(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)

os.makedirs(OUTDIR, exist_ok=True)
tex = textures.rock_textures(OUTDIR)
SHAPES = [(1, 1, .78, 3), (1.15, .85, .7, 7), (.9, 1.05, .95, 11), (1.2, .95, .62, 19)]  # x, y, height (Blender axes), seed
for k, (sx, sy, sz, seed) in enumerate(SHAPES):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=6, radius=1)
    me = bpy.data.meshes.new('hi'); bm.to_mesh(me); bm.free()
    hi = bpy.data.objects.new('hi', me); bpy.context.scene.collection.objects.link(hi)
    V = np.array([v.co[:] for v in me.vertices]); s = Vector((seed * 3.1, seed * 1.7, seed * .9))
    out = []
    for p in V:
        q = Vector(p)
        broad = noise.noise(q * .9 + s) * .16 + noise.noise(q * 2.1 + s * 2) * .06
        # sheet joints: a couple of softened grooves where the granite has split
        joint = -.035 * math.exp(-((q.z * .9 + q.x * .25 + .25 + noise.noise(q * 3 + s) * .05) ** 2) / .004)
        joint += -.025 * math.exp(-((q.x * .8 - q.y * .55 + noise.noise(q * 2.5 + s * 3) * .06 - .1) ** 2) / .003)
        grain = noise.noise(q * 9 + s) * .012 + noise.noise(q * 26 + s) * .004
        r = 1 + broad + joint + grain
        out.append((p[0] * r * sx, p[1] * r * sy, p[2] * r * sz))
    out = np.array(out)
    # rest it on the ground: flatten the underside
    zb = out[:, 2].min() + (out[:, 2].max() - out[:, 2].min()) * .12
    out[:, 2] = np.maximum(out[:, 2], zb)
    lo_, hi_ = out.min(0), out.max(0); c = (lo_ + hi_) / 2; r = max(hi_[0] - lo_[0], hi_[1] - lo_[1]) / 2
    out = (out - [c[0], c[1], lo_[2]]) / r; out[:, 2] -= .15 * (hi_[2] - lo_[2]) / r
    me.vertices.foreach_set('co', out.ravel()); me.update()
    for p in me.polygons: p.use_smooth = True
    # colour on the fine surface: the photographed rock, box-mapped at about a metre a tile for a 3 m boulder
    select_only(hi); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=.7); bpy.ops.object.mode_set(mode='OBJECT')
    em = bpy.data.materials.new('src'); em.use_nodes = True; nt = em.node_tree; nt.nodes.clear()
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex['diff'], check_existing=True)
    # darker in the joints and underneath, paler on the sun-bleached tops
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -.6; mr.inputs['From Max'].default_value = .9; mr.inputs['To Min'].default_value = .62; mr.inputs['To Max'].default_value = 1.12
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = .15
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
    nt.links.new(t.outputs['Color'], mul.inputs['A']); nt.links.new(mr.outputs[0], mul.inputs['B'])
    mul2 = nt.nodes.new('ShaderNodeMix'); mul2.data_type = 'RGBA'; mul2.blend_type = 'MULTIPLY'; mul2.inputs['Factor'].default_value = .7
    nt.links.new(mul.outputs['Result'], mul2.inputs['A']); nt.links.new(ao.outputs['Color'], mul2.inputs['B'])
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(mul2.outputs['Result'], e.inputs['Color']); nt.links.new(e.outputs[0], o.inputs[0])
    hi.data.materials.append(em)
    # game meshes
    lo = hi.copy(); lo.data = hi.data.copy(); bpy.context.scene.collection.objects.link(lo); lo.name = 'rock'; lo.data.materials.clear()
    d = lo.modifiers.new('d', 'DECIMATE'); d.ratio = 1500 / tris(lo); apply_mods(lo)
    select_only(lo); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.01); bpy.ops.object.mode_set(mode='OBJECT')
    albedo = bpy.data.images.new('rock_%d' % k, 1024, 1024); normal = bpy.data.images.new('rock_n_%d' % k, 1024, 1024); normal.colorspace_settings.name = 'Non-Color'
    m = bpy.data.materials.new('granite'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = .9
    ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = albedo; tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal
    lo.data.materials.append(m)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 8
    sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = .04; sc.render.bake.max_ray_distance = .1; sc.render.bake.margin = 8
    select_only(lo, hi); bpy.context.view_layer.objects.active = lo
    nt.nodes.active = ta; bpy.ops.object.bake(type='EMIT')
    nt.nodes.active = tn; bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
    nt.links.new(ta.outputs['Color'], b.inputs['Base Color'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    # the far cut is the game mesh reduced further, keeping its UVs and baked texture
    far = lo.copy(); far.data = lo.data.copy(); bpy.context.scene.collection.objects.link(far); far.name = 'rock_far'
    d = far.modifiers.new('d', 'DECIMATE'); d.ratio = 260 / tris(far); apply_mods(far)
    out_path = os.path.join(OUTDIR, 'rock-%d.glb' % k)
    select_only(lo, far)
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=86, export_yup=True)
    print('wrote', out_path, tris(lo), tris(far), os.path.getsize(out_path) // 1024, 'KB', flush=True)
    if PREVIEW and k == 0:
        import preview
        far.hide_render = True; hi.hide_render = True
        preview.render(os.path.join(OUTDIR, 'rock.png'), [lo], samples=24)
