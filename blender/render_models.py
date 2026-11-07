"""Render two angles of every exported model so the silhouettes can be checked.

Run:
  blender --background --python blender/render_models.py
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BLEND_DIR = ROOT / "blender" / "src"
OUT_DIR = Path("/tmp/lunar-renders")
OUT_DIR.mkdir(parents=True, exist_ok=True)

ANGLES = (
    ("threequarter", 42, 28),
    ("side", 128, 16),
)


def bounds_of_scene():
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        found = True
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    if not found:
        return Vector((0, 0, 0.5)), 1.0
    center = (mins + maxs) * 0.5
    radius = max((maxs - mins).length * 0.5, 0.35)
    return center, radius


def look_at(obj, target):
    direction = (target - obj.location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def prepare_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 480
    scene.render.resolution_y = 360
    scene.render.film_transparent = False
    scene.eevee.taa_render_samples = 12
    world = bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.93, 0.89, 0.82, 1)
    bg.inputs[1].default_value = 1.0
    scene.world = world
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 3.2
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(48), math.radians(12), math.radians(30))
    fill_data = bpy.data.lights.new("Fill", "AREA")
    fill_data.energy = 250
    fill_data.size = 4
    fill = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (-2.5, -1.5, 2.2)
    look_at(fill, Vector((0, 0, 0.4)))
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    return cam


def render_blend(path: Path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    cam = prepare_scene()
    center, radius = bounds_of_scene()
    stem = path.stem
    for label, azimuth, elevation in ANGLES:
        az = math.radians(azimuth)
        el = math.radians(elevation)
        dist = radius * 3.3
        cam.location = center + Vector((
            math.cos(el) * math.cos(az),
            math.cos(el) * math.sin(az),
            math.sin(el),
        )) * dist
        look_at(cam, center + Vector((0, 0, radius * 0.05)))
        out = OUT_DIR / f"{stem}-{label}.png"
        bpy.context.scene.render.filepath = str(out)
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {out}")


def main():
    blends = sorted(BLEND_DIR.glob("*.blend"))
    if not blends:
        raise SystemExit("no blends in blender/src")
    for blend in blends:
        render_blend(blend)
    print("ALL_RENDERS_DONE")


if __name__ == "__main__":
    main()
