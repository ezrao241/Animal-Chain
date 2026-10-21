"""Cycles preview renders of a built animal: a three-quarter front view and a side view, in warm savanna light."""
import bpy, math
from mathutils import Vector


def render(path, obs, size=(900, 600), samples=48):
    scene = bpy.context.scene
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in obs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    centre = (lo + hi) / 2; span = (hi - lo).length
    world = bpy.data.worlds.new('sky'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.55, .68, .85, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun)
    sun.data.energy = 4.5; sun.data.color = (1, .9, .75); sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
    ground = bpy.data.meshes.new('ground'); ground.from_pydata([(-9, -9, 0), (9, -9, 0), (9, 9, 0), (-9, 9, 0)], [], [(0, 1, 2, 3)])
    g = bpy.data.objects.new('ground', ground); scene.collection.objects.link(g)
    gm = bpy.data.materials.new('soil'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.45, .34, .2, 1)
    ground.materials.append(gm)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.lens = 50
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.device = 'CPU'
    try: scene.cycles.use_denoising = True
    except Exception: pass
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [i.name for i in type(scene.view_settings).bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    for i, (az, el, dist) in enumerate(((35, 12, 1.5), (90, 6, 1.6), (160, 20, 1.6))):
        a, e = math.radians(az), math.radians(el)
        # +x is the animal's front, -y its right side in Blender
        cam.location = centre + Vector((math.cos(a) * math.cos(e), -math.sin(a) * math.cos(e), math.sin(e))) * span * dist
        d = centre - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = path.replace('.png', '-%d.png' % i)
        bpy.ops.render.render(write_still=True)
