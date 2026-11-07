"""Build the low-poly cast of «Лунные дворники» and export glTF plus .blend sources.

Run:
  blender --background --python blender/build_models.py
"""
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
GLB_DIR = ROOT / "assets" / "models"
BLEND_DIR = ROOT / "blender" / "src"
GLB_DIR.mkdir(parents=True, exist_ok=True)
BLEND_DIR.mkdir(parents=True, exist_ok=True)

# Bright cartoon palette, linear-ish sRGB values Blender will store as the base color.
C = {
    "suit": (1.00, 0.82, 0.22, 1),
    "visor": (0.45, 0.90, 1.00, 1),
    "scarf": (1.00, 0.38, 0.40, 1),
    "ink": (0.14, 0.09, 0.22, 1),
    "white": (0.98, 0.96, 0.92, 1),
    "mint": (0.10, 0.78, 0.58, 1),
    "boot": (0.16, 0.12, 0.24, 1),
    "skin": (1.00, 0.78, 0.62, 1),
    "wood": (0.62, 0.40, 0.22, 1),
    "bristle": (0.55, 0.36, 0.18, 1),
    "blue": (0.28, 0.48, 1.00, 1),
    "orange": (1.00, 0.48, 0.22, 1),
    "pink": (1.00, 0.50, 0.68, 1),
    "cyan": (0.45, 0.92, 1.00, 1),
    "cream": (0.96, 0.86, 0.70, 1),
    "rock": (0.62, 0.55, 0.60, 1),
    "rock_dark": (0.42, 0.36, 0.42, 1),
    "sand": (0.93, 0.78, 0.52, 1),
    "leaf": (0.28, 0.72, 0.38, 1),
    "purple": (0.48, 0.36, 1.00, 1),
    "gold": (1.00, 0.82, 0.28, 1),
}


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"


def material(name, color, rough=0.48, emit=0.0, metal=0.0, emit_color=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    glow = emit_color or color
    emit_name = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
    if emit > 0 and emit_name in bsdf.inputs:
        bsdf.inputs[emit_name].default_value = glow
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit
    return mat


def shade(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def apply_transform(obj, location=True, rotation=True, scale=True):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=location, rotation=rotation, scale=scale)
    obj.select_set(False)


def primitive(kind, name, mat, **kwargs):
    ops = {
        "cube": bpy.ops.mesh.primitive_cube_add,
        "uv": bpy.ops.mesh.primitive_uv_sphere_add,
        "cyl": bpy.ops.mesh.primitive_cylinder_add,
        "cone": bpy.ops.mesh.primitive_cone_add,
        "torus": bpy.ops.mesh.primitive_torus_add,
    }[kind]
    ops(**kwargs)
    obj = bpy.context.active_object
    obj.name = name
    shade(obj, mat)
    obj.select_set(False)
    return obj


def empty(name, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def parent_to(child, parent):
    matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = matrix


def cube(name, mat, size=(1, 1, 1), loc=(0, 0, 0)):
    # primitive cube `size` is the edge length, so scale by the desired edges.
    obj = primitive("cube", name, mat, size=1, location=loc)
    obj.scale = size
    apply_transform(obj, location=False)
    return obj


def sphere(name, mat, radius=0.5, loc=(0, 0, 0), segments=10, rings=6, scale=(1, 1, 1)):
    obj = primitive("uv", name, mat, radius=radius, segments=segments, ring_count=rings, location=loc)
    obj.scale = scale
    apply_transform(obj, location=False)
    return obj


def cylinder(name, mat, radius=0.2, depth=0.5, loc=(0, 0, 0), vertices=10, rot=(0, 0, 0)):
    obj = primitive(
        "cyl", name, mat,
        radius=radius, depth=depth, vertices=vertices,
        location=loc, rotation=rot,
    )
    return obj


def cone(name, mat, radius=0.2, depth=0.4, loc=(0, 0, 0), vertices=10, rot=(0, 0, 0)):
    return primitive(
        "cone", name, mat,
        radius1=radius, depth=depth, vertices=vertices,
        location=loc, rotation=rot,
    )


def wheel(name, mat_tire, mat_hub, radius=0.22, width=0.12, loc=(0, 0, 0)):
    """Wheel standing upright, axle along local X, origin on the axle."""
    tire = cylinder(name, mat_tire, radius=radius, depth=width, loc=loc, vertices=12, rot=(0, math.radians(90), 0))
    apply_transform(tire)
    hub = cylinder(name + "_hub", mat_hub, radius=radius * 0.38, depth=width + 0.02, loc=loc, vertices=8, rot=(0, math.radians(90), 0))
    apply_transform(hub)
    parent_to(hub, tire)
    return tire


def move_origin_to_world(obj, point):
    """Keep the mesh where it is, put the object origin at a world-space point."""
    point = Vector(point)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR") if False else None
    local = obj.matrix_world.inverted() @ point
    obj.data.transform(bpy.mathutils.Matrix.Translation(-local) if False else __import__("mathutils").Matrix.Translation(-local))
    obj.location = point
    obj.select_set(False)


def tris_of(root):
    total = 0
    stack = [root]
    seen = set()
    while stack:
        obj = stack.pop()
        if obj in seen:
            continue
        seen.add(obj)
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
        stack.extend(list(obj.children))
    return total


def export_root(root, stem):
    count = tris_of(root)
    print(f"TRIS {stem}: {count}")
    if count > 2200:
        print(f"WARNING {stem} is over the triangle budget ({count})")
    blend_path = str(BLEND_DIR / f"{stem}.blend")
    glb_path = str(GLB_DIR / f"{stem}.glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.object.select_all(action="DESELECT")

    def select_tree(obj):
        obj.select_set(True)
        for child in obj.children:
            select_tree(child)

    select_tree(root)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_animations=False,
    )
    print(f"WROTE {glb_path}")


def link_children(parent, children):
    for child in children:
        parent_to(child, parent)
    return parent


# --- characters -----------------------------------------------------------

def shift_mesh(obj, offset):
    obj.data.transform(__import__("mathutils").Matrix.Translation(offset))


def build_janitor():
    """Cute Mars sweeper. Face looks along +Y so glTF forward (-Z) is the visor."""
    fresh()
    orange = material("orange", (0.72, 0.48, 0.30, 1), rough=1.0, metal=0.0)
    white = material("white", (0.86, 0.78, 0.66, 1), rough=1.0, metal=0.0)
    ink = material("ink", (0.28, 0.20, 0.16, 1), rough=1.0, metal=0.0)
    suit = material("suit", (0.70, 0.46, 0.30, 1), rough=1.0, metal=0.0)
    pad = material("pad", (0.82, 0.70, 0.52, 1), rough=1.0, metal=0.0)
    seam = material("seam", (0.45, 0.30, 0.22, 1), rough=1.0, metal=0.0)
    glove_m = material("glove", (0.90, 0.82, 0.68, 1), rough=1.0, metal=0.0)
    boot_m = material("boot", (0.55, 0.34, 0.22, 1), rough=1.0, metal=0.0)
    sole = material("sole", (0.24, 0.16, 0.12, 1), rough=1.0, metal=0.0)
    # Named "skin" so the facing test can find the visor. Flat teal, not chrome.
    visor_m = material("skin", (0.55, 0.70, 0.66, 1), rough=1.0, metal=0.0)
    lamp_m = material("lamp", (0.86, 0.62, 0.34, 1), rough=1.0, metal=0.0)
    teal = material("teal", (0.42, 0.62, 0.58, 1), rough=1.0, metal=0.0)
    pack_m = material("pack", (0.48, 0.34, 0.24, 1), rough=1.0, metal=0.0)
    root = empty("janitor")

    def hang_cyl(name, mat, radius, length, origin, verts=12):
        obj = cylinder(name, mat, radius=radius, depth=length, loc=origin, vertices=verts)
        shift_mesh(obj, (0, 0, -length / 2))
        return obj

    body = sphere("body", suit, 0.30, (0, 0.02, 0.96), 12, 8, (1.05, 0.82, 1.12))
    chest = sphere("chest", pad, 0.18, (0, 0.22, 1.02), 16, 10, (1.2, 0.62, 0.9))
    chest_l = sphere("chest_light_l", lamp_m, 0.028, (-0.06, 0.32, 1.04), 8, 6)
    chest_r = sphere("chest_light_r", teal, 0.028, (0.06, 0.32, 1.04), 8, 6)
    belly_seam = primitive("torus", "belly_seam", seam, major_radius=0.22, minor_radius=0.018, major_segments=18, minor_segments=6, location=(0, 0.02, 0.86))
    collar = primitive("torus", "collar", white, major_radius=0.16, minor_radius=0.028, major_segments=16, minor_segments=6, location=(0, 0.04, 1.22))
    shoulder_l = sphere("shoulder_l", orange, 0.09, (-0.28, 0.0, 1.16), 12, 8)
    shoulder_r = sphere("shoulder_r", orange, 0.09, (0.28, 0.0, 1.16), 12, 8)

    helmet = sphere("helmet", white, 0.34, (0, 0.02, 1.46), 12, 8)
    visor = sphere("visor", visor_m, 0.24, (0, 0.32, 1.44), 12, 8, (1.35, 0.72, 0.82))
    glow = primitive("torus", "visor_glow", teal, major_radius=0.2, minor_radius=0.02, major_segments=18, minor_segments=6, location=(0, 0.34, 1.44), rotation=(math.radians(90), 0, 0))
    ear_l = sphere("ear_l", white, 0.06, (-0.32, 0.0, 1.46), 10, 6)
    ear_r = sphere("ear_r", white, 0.06, (0.32, 0.0, 1.46), 10, 6)
    antenna = cylinder("antenna", ink, 0.012, 0.16, (0.12, -0.06, 1.84), 6)
    bulb = sphere("bulb", lamp_m, 0.035, (0.12, -0.06, 1.94), 8, 6)

    pack = sphere("backpack", pack_m, 0.22, (0, -0.34, 1.04), 10, 8, (0.95, 0.7, 1.1))
    pack_pad = cube("backpack_pad", pad, (0.26, 0.08, 0.32), (0, -0.46, 1.04))
    light_l = sphere("pack_light_l", lamp_m, 0.04, (-0.09, -0.52, 1.14), 8, 6)
    light_r = sphere("pack_light_r", teal, 0.04, (0.09, -0.52, 1.14), 8, 6)
    hose = cylinder("hose", ink, 0.018, 0.22, (0.16, -0.16, 1.18), 8, rot=(0, math.radians(70), math.radians(20)))

    def arm(name, side):
        shoulder = (side * 0.36, 0.04, 1.18)
        upper = hang_cyl(name, suit, 0.07, 0.30, shoulder, 8)
        seam_band = primitive("torus", name + "_seam", seam, major_radius=0.072, minor_radius=0.012, major_segments=12, minor_segments=6, location=(shoulder[0], shoulder[1], shoulder[2] - 0.16))
        parent_to(seam_band, upper)
        fore = hang_cyl(name + "_fore", teal, 0.055, 0.24, (shoulder[0] + side * 0.02, 0.08, shoulder[2] - 0.30), 8)
        parent_to(fore, upper)
        glove = sphere(name + "_glove", glove_m, 0.07, (shoulder[0] + side * 0.03, 0.14, shoulder[2] - 0.52), 12, 8)
        parent_to(glove, upper)
        if side > 0:
            for i, zoff in enumerate((0.045, 0.0, -0.045)):
                finger = cylinder(
                    name + f"_finger_{i}", glove_m, radius=0.012, depth=0.07,
                    loc=(glove.location.x + 0.01, glove.location.y + 0.055, glove.location.z + zoff),
                    vertices=6, rot=(math.radians(80), 0, math.radians(18 * side)),
                )
                parent_to(finger, upper)
        return upper, glove

    arm_l, _glove_l = arm("arm_l", -1)
    arm_r, glove_r = arm("arm_r", 1)
    bpy.context.view_layer.update()
    palm = glove_r.matrix_world.translation + Vector((0.0, 0.05, 0.0))
    socket = empty("tool_socket", palm)
    parent_to(socket, arm_r)

    def leg(name, side):
        hip = (side * 0.12, 0.0, 0.70)
        thigh = hang_cyl(name, suit, 0.09, 0.32, hip, 12)
        knee = sphere(name + "_knee", pad, 0.07, (hip[0], 0.02, hip[2] - 0.32), 10, 6)
        parent_to(knee, thigh)
        shin = hang_cyl(name + "_shin", orange, 0.07, 0.26, (hip[0], 0.02, hip[2] - 0.34), 10)
        parent_to(shin, thigh)
        boot = sphere(name + "_boot", boot_m, 0.09, (hip[0], 0.06, 0.08), 12, 8, (1.05, 1.35, 0.7))
        parent_to(boot, thigh)
        boot_sole = cube(name + "_sole", sole, (0.12, 0.18, 0.04), (hip[0], 0.07, 0.03))
        parent_to(boot_sole, thigh)
        return thigh

    leg_l = leg("leg_l", -1)
    leg_r = leg("leg_r", 1)

    for part in (
        body, chest, chest_l, chest_r, belly_seam, collar, shoulder_l, shoulder_r,
        helmet, visor, glow, ear_l, ear_r, antenna, bulb,
        pack, pack_pad, light_l, light_r, hose,
        arm_l, arm_r, leg_l, leg_r,
    ):
        parent_to(part, root)
    export_root(root, "janitor")


def build_tool_brush():
    fresh()
    white = material("white", C["white"])
    cyan = material("cyan", C["cyan"], 0.3, emit=0.15)
    ink = material("ink", C["ink"])
    root = empty("tool_brush")
    handle = cube("handle", white, (0.045, 0.32, 0.04), (0, 0.16, 0))
    neck = cylinder("neck", ink, 0.02, 0.05, (0, 0.34, 0), 6, rot=(math.radians(90), 0, 0))
    head = cube("head", cyan, (0.09, 0.07, 0.055), (0, 0.4, 0))
    link_children(root, (handle, neck, head))
    export_root(root, "tool_brush")


def build_tool_broom():
    fresh()
    wood = material("wood", C["wood"])
    bristle = material("bristle", C["bristle"])
    gold = material("gold", C["gold"])
    root = empty("tool_broom")
    stick = cylinder("stick", wood, 0.025, 0.9, (0, 0.15, 0.35), 8)
    collar = cylinder("collar", gold, 0.045, 0.06, (0, 0.15, 0.02), 8)
    parts = [stick, collar]
    for i, x in enumerate((-0.08, -0.04, 0, 0.04, 0.08)):
        br = cube(f"bristle_{i}", bristle, (0.025, 0.05, 0.22), (x, 0.18, -0.08))
        br.rotation_euler[0] = -0.15
        apply_transform(br)
        parts.append(br)
    link_children(root, parts)
    export_root(root, "tool_broom")


def build_tool_mop():
    fresh()
    wood = material("wood", C["wood"])
    cyan = material("cyan", C["cyan"], 0.35)
    root = empty("tool_mop")
    stick = cylinder("stick", wood, 0.022, 0.95, (0, 0.05, 0.4), 8)
    head = cube("head", cyan, (0.36, 0.1, 0.08), (0, 0.12, -0.02))
    link_children(root, (stick, head))
    export_root(root, "tool_mop")


def build_tool_vac(stem, body_color, scale=1.0, hose=True):
    fresh()
    body_m = material("body", body_color)
    ink = material("ink", C["ink"])
    white = material("white", C["white"])
    cyan = material("cyan", C["cyan"], 0.25, emit=0.2)
    root = empty(stem)
    body = cube("body", body_m, (0.34 * scale, 0.26 * scale, 0.36 * scale), (0, 0, 0.28 * scale))
    cap = sphere("cap", white, 0.11 * scale, (0, 0, 0.48 * scale), 10, 6)
    nozzle = cylinder("nozzle", ink, 0.045 * scale, 0.22 * scale, (0, 0.2 * scale, 0.22 * scale), 10, rot=(math.radians(78), 0, 0))
    mouth = cone("mouth", cyan, 0.07 * scale, 0.1 * scale, (0, 0.32 * scale, 0.16 * scale), 10, rot=(math.radians(78), 0, 0))
    parts = [body, cap, nozzle, mouth]
    if hose:
        hose_a = cylinder("hose_a", ink, 0.028 * scale, 0.16 * scale, (0.12 * scale, 0.02, 0.36 * scale), 8, rot=(0, math.radians(80), math.radians(20)))
        hose_b = cylinder("hose_b", ink, 0.026 * scale, 0.16 * scale, (0.08 * scale, 0.12 * scale, 0.26 * scale), 8, rot=(math.radians(55), 0, math.radians(18)))
        parts.extend((hose_a, hose_b))
    light = sphere("lamp", cyan, 0.04 * scale, (0, 0.14 * scale, 0.32 * scale), 8, 5)
    parts.append(light)
    link_children(root, parts)
    export_root(root, stem)


def build_tool_turbo():
    fresh()
    wood = material("wood", C["wood"])
    bristle = material("bristle", C["bristle"])
    gold = material("gold", C["gold"], 0.35, emit=0.15)
    ink = material("ink", C["ink"])
    root = empty("tool_turbo")
    stick = cylinder("stick", wood, 0.028, 0.85, (0, 0.1, 0.38), 8)
    motor = cube("motor", gold, (0.16, 0.12, 0.12), (0, 0.12, 0.08))
    fan = cylinder("fan", ink, 0.07, 0.03, (0, 0.2, 0.08), 8, rot=(math.radians(90), 0, 0))
    parts = [stick, motor, fan]
    for i, x in enumerate((-0.1, -0.05, 0, 0.05, 0.1)):
        parts.append(cube(f"bristle_{i}", bristle, (0.03, 0.05, 0.2), (x, 0.16, -0.08)))
    link_children(root, parts)
    export_root(root, "tool_turbo")


def build_tool_cyclone():
    fresh()
    blue = material("blue", C["blue"])
    white = material("white", C["white"])
    gold = material("gold", C["gold"])
    root = empty("tool_cyclone")
    cone_m = cone("cone", blue, 0.16, 0.42, (0, 0, 0.28), 10)
    band = cylinder("band", gold, 0.17, 0.05, (0, 0, 0.22), 10)
    handle = cylinder("handle", white, 0.02, 0.32, (0.18, 0, 0.3), 6)
    nozzle = cylinder("nozzle", white, 0.04, 0.2, (0, 0.18, 0.08), 8, rot=(math.radians(90), 0, 0))
    link_children(root, (cone_m, band, handle, nozzle))
    export_root(root, "tool_cyclone")


def build_tool_plasma():
    fresh()
    white = material("white", C["white"])
    purple = material("purple", C["purple"], 0.25, emit=0.8)
    root = empty("tool_plasma")
    stick = cylinder("stick", white, 0.02, 0.9, (0, 0.04, 0.4), 8)
    head = cube("head", purple, (0.4, 0.1, 0.06), (0, 0.12, 0.0))
    core = sphere("core", purple, 0.05, (0, 0.12, 0.05), 8, 5)
    link_children(root, (stick, head, core))
    export_root(root, "tool_plasma")


def build_tool_grav():
    fresh()
    ink = material("ink", C["ink"])
    cyan = material("cyan", C["cyan"], 0.2, emit=0.55)
    gold = material("gold", C["gold"])
    root = empty("tool_grav")
    disc = cylinder("disc", ink, 0.2, 0.06, (0, 0, 0.08), 14)
    ring = primitive("torus", "ring", cyan, major_radius=0.16, minor_radius=0.02, major_segments=14, minor_segments=6, location=(0, 0, 0.12))
    grip = cylinder("grip", gold, 0.025, 0.28, (0, -0.08, 0.22), 6, rot=(math.radians(25), 0, 0))
    link_children(root, (disc, ring, grip))
    export_root(root, "tool_grav")


def build_tool_comet():
    fresh()
    orange = material("orange", C["orange"])
    white = material("white", C["white"])
    gold = material("gold", C["gold"], 0.3, emit=0.4)
    root = empty("tool_comet")
    body = sphere("body", orange, 0.16, (0, 0, 0.16), 10, 7, (1.3, 0.8, 0.9))
    tail = cone("tail", gold, 0.1, 0.36, (0, -0.22, 0.2), 8, rot=(math.radians(-70), 0, 0))
    nozzle = cone("nozzle", white, 0.06, 0.14, (0, 0.2, 0.1), 8, rot=(math.radians(75), 0, 0))
    link_children(root, (body, tail, nozzle))
    export_root(root, "tool_comet")


def build_tool_aurora():
    fresh()
    white = material("white", C["white"])
    cyan = material("cyan", C["cyan"], 0.2, emit=0.9)
    purple = material("purple", C["purple"], 0.25, emit=0.4)
    root = empty("tool_aurora")
    pole = cylinder("pole", white, 0.035, 0.7, (0, 0, 0.4), 8)
    ring = primitive("torus", "ring", cyan, major_radius=0.18, minor_radius=0.025, major_segments=16, minor_segments=6, location=(0, 0, 0.72))
    gem = sphere("gem", purple, 0.08, (0, 0, 0.72), 8, 6)
    foot = cylinder("foot", white, 0.1, 0.04, (0, 0, 0.02), 10)
    link_children(root, (pole, ring, gem, foot))
    export_root(root, "tool_aurora")


# --- depot and rocket -----------------------------------------------------

def build_depot():
    fresh()
    mint = material("mint", C["mint"])
    white = material("white", C["white"])
    scarf = material("scarf", C["scarf"])
    ink = material("ink", C["ink"])
    gold = material("gold", C["gold"], 0.35, emit=0.6)
    root = empty("depot")
    pad = cylinder("pad", mint, 0.9, 0.08, (0, 0, 0.04), 20)
    rim = primitive("torus", "rim", white, major_radius=0.82, minor_radius=0.05, major_segments=20, minor_segments=6, location=(0, 0, 0.08))
    kiosk = cube("kiosk", white, (0.46, 0.36, 0.55), (0, -0.15, 0.4))
    roof = cone("roof", scarf, 0.32, 0.28, (0, -0.15, 0.78), 8)
    window = cube("window", C and material("glass", C["visor"], 0.15, 0.25), (0.22, 0.04, 0.16), (0, 0.04, 0.48))
    rocket = cone("rocket", white, 0.12, 0.55, (0.45, 0.2, 0.45), 10)
    fin_a = cube("fin_a", scarf, (0.04, 0.16, 0.14), (0.45, 0.2, 0.24))
    fin_b = cube("fin_b", scarf, (0.16, 0.04, 0.14), (0.45, 0.2, 0.24))
    parent_to(fin_a, rocket)
    parent_to(fin_b, rocket)
    flame = cone("flame", gold, 0.08, 0.22, (0.45, 0.2, 0.08), 8, rot=(math.radians(180), 0, 0))
    parent_to(flame, rocket)
    link_children(root, (pad, rim, kiosk, roof, window, rocket))
    export_root(root, "depot")


def build_rocket():
    fresh()
    white = material("white", C["white"])
    scarf = material("scarf", C["scarf"])
    gold = material("gold", C["gold"], 0.3, emit=0.7)
    cyan = material("cyan", C["cyan"], 0.2, emit=0.3)
    root = empty("rocket")
    body = cylinder("body", white, 0.16, 0.7, (0, 0, 0.5), 12)
    nose = cone("nose", scarf, 0.16, 0.28, (0, 0, 0.98), 12)
    window = sphere("window", cyan, 0.07, (0.12, 0, 0.62), 8, 5)
    fin1 = cube("fin_1", scarf, (0.05, 0.22, 0.18), (0, 0, 0.22))
    fin2 = cube("fin_2", scarf, (0.22, 0.05, 0.18), (0, 0, 0.22))
    flame = cone("flame", gold, 0.1, 0.28, (0, 0, 0.02), 8, rot=(math.radians(180), 0, 0))
    link_children(root, (body, nose, window, fin1, fin2, flame))
    export_root(root, "rocket")


# --- vehicles -------------------------------------------------------------

def build_pyh():
    fresh()
    yellow = material("yellow", C["suit"])
    ink = material("ink", C["ink"], 0.7)
    white = material("white", C["white"])
    cyan = material("cyan", C["cyan"], 0.2, emit=0.25)
    root = empty("vehicle_pyh")
    chassis = cube("chassis", yellow, (0.7, 1.15, 0.28), (0, 0.05, 0.38))
    cabin = cube("cabin", yellow, (0.55, 0.48, 0.32), (0, -0.12, 0.64))
    glass = cube("glass", cyan, (0.4, 0.08, 0.18), (0, 0.14, 0.68))
    roll = cylinder("rollbar", ink, 0.03, 0.7, (0, -0.05, 0.85), 6, rot=(0, math.radians(90), 0))
    bumper = cube("bumper", ink, (0.62, 0.08, 0.1), (0, 0.58, 0.32))
    light_l = sphere("headlight_l", white, 0.06, (-0.18, 0.58, 0.4), 8, 5)
    light_r = sphere("headlight_r", white, 0.06, (0.18, 0.58, 0.4), 8, 5)
    wheels = [
        wheel("wheel_fl", ink, white, 0.22, 0.12, (-0.38, 0.38, 0.22)),
        wheel("wheel_fr", ink, white, 0.22, 0.12, (0.38, 0.38, 0.22)),
        wheel("wheel_bl", ink, white, 0.22, 0.12, (-0.38, -0.38, 0.22)),
        wheel("wheel_br", ink, white, 0.22, 0.12, (0.38, -0.38, 0.22)),
    ]
    link_children(root, [chassis, cabin, glass, roll, bumper, light_l, light_r, *wheels])
    export_root(root, "vehicle_pyh")


def build_blin():
    fresh()
    pink = material("pink", C["pink"])
    ink = material("ink", C["ink"], 0.65)
    white = material("white", C["white"])
    root = empty("vehicle_blin")
    cab = cube("cab", pink, (0.7, 0.55, 0.4), (0, -0.25, 0.55))
    glass = cube("glass", material("glass", C["visor"], 0.2, 0.2), (0.5, 0.06, 0.18), (0, 0.04, 0.62))
    # Roller axle is local X, origin on the axle.
    roller = cylinder("roller", pink, 0.34, 1.15, (0, 0.45, 0.34), 16, rot=(0, math.radians(90), 0))
    apply_transform(roller)
    stripe = cylinder("roller_stripe", white, 0.35, 0.12, (0, 0.45, 0.34), 16, rot=(0, math.radians(90), 0))
    apply_transform(stripe)
    parent_to(stripe, roller)
    wheels = [
        wheel("wheel_bl", ink, white, 0.2, 0.12, (-0.4, -0.45, 0.2)),
        wheel("wheel_br", ink, white, 0.2, 0.12, (0.4, -0.45, 0.2)),
    ]
    link_children(root, [cab, glass, roller, *wheels])
    export_root(root, "vehicle_blin")


def build_iskra():
    fresh()
    cyan = material("cyan", C["cyan"])
    ink = material("ink", C["ink"], 0.55)
    white = material("white", C["white"])
    gold = material("gold", C["gold"], 0.3, emit=0.35)
    root = empty("vehicle_iskra")
    nose = cone("nose", cyan, 0.22, 0.7, (0, 0.55, 0.28), 10, rot=(math.radians(90), 0, 0))
    body = cube("body", cyan, (0.42, 0.9, 0.18), (0, -0.05, 0.28))
    spoiler = cube("spoiler", ink, (0.55, 0.06, 0.04), (0, -0.48, 0.48))
    strut_l = cube("strut_l", ink, (0.03, 0.03, 0.16), (-0.2, -0.48, 0.38))
    strut_r = cube("strut_r", ink, (0.03, 0.03, 0.16), (0.2, -0.48, 0.38))
    canopy = sphere("canopy", material("glass", C["visor"], 0.12, 0.3), 0.16, (0, 0.05, 0.4), 10, 6, (0.7, 1.1, 0.45))
    trail = cone("trail", gold, 0.08, 0.28, (0, -0.62, 0.26), 8, rot=(math.radians(-90), 0, 0))
    wheels = [
        wheel("wheel_fl", ink, white, 0.16, 0.1, (-0.28, 0.28, 0.16)),
        wheel("wheel_fr", ink, white, 0.16, 0.1, (0.28, 0.28, 0.16)),
        wheel("wheel_bl", ink, white, 0.18, 0.12, (-0.3, -0.32, 0.18)),
        wheel("wheel_br", ink, white, 0.18, 0.12, (0.3, -0.32, 0.18)),
    ]
    link_children(root, [nose, body, spoiler, strut_l, strut_r, canopy, trail, *wheels])
    export_root(root, "vehicle_iskra")


# --- robots ---------------------------------------------------------------

def build_chistik():
    fresh()
    mint = material("mint", C["mint"])
    ink = material("ink", C["ink"])
    white = material("white", C["white"])
    wood = material("wood", C["wood"])
    root = empty("robot_chistik")
    body = sphere("body", mint, 0.28, (0, 0, 0.36), 12, 8)
    eye_l = sphere("eye_l", ink, 0.045, (-0.08, 0.18, 0.42), 6, 4)
    eye_r = sphere("eye_r", ink, 0.045, (0.08, 0.18, 0.42), 6, 4)
    shine = sphere("shine", white, 0.03, (-0.1, 0.08, 0.54), 6, 4)
    foot_l = sphere("foot_l", ink, 0.07, (-0.1, 0, 0.06), 6, 4)
    foot_r = sphere("foot_r", ink, 0.07, (0.1, 0, 0.06), 6, 4)
    brush = cube("brush", wood, (0.16, 0.05, 0.08), (0.22, 0.12, 0.22))
    link_children(root, (body, eye_l, eye_r, shine, foot_l, foot_r, brush))
    export_root(root, "robot_chistik")


def build_beetle():
    fresh()
    orange = material("orange", C["orange"])
    ink = material("ink", C["ink"])
    cyan = material("cyan", C["cyan"], 0.25, emit=0.2)
    root = empty("robot_beetle")
    shell = sphere("shell", orange, 0.32, (0, 0, 0.28), 12, 8, (1.15, 1.4, 0.62))
    eye_l = sphere("eye_l", ink, 0.05, (-0.1, 0.28, 0.32), 6, 4)
    eye_r = sphere("eye_r", ink, 0.05, (0.1, 0.28, 0.32), 6, 4)
    nozzle = cone("nozzle", cyan, 0.06, 0.16, (0, 0.42, 0.18), 8, rot=(math.radians(90), 0, 0))
    parts = [shell, eye_l, eye_r, nozzle]
    for i, x in enumerate((-0.18, 0, 0.18)):
        for j, y in enumerate((-0.12, 0.16)):
            leg = cylinder(f"leg_{i}_{j}", ink, 0.025, 0.16, (x, y, 0.08), 5, rot=(math.radians(70), 0, 0))
            parts.append(leg)
    link_children(root, parts)
    export_root(root, "robot_beetle")


def build_drone():
    fresh()
    blue = material("blue", C["blue"])
    ink = material("ink", C["ink"])
    white = material("white", C["white"])
    wood = material("wood", C["wood"])
    root = empty("robot_drone")
    saucer = cylinder("saucer", blue, 0.28, 0.1, (0, 0, 0.42), 14)
    dome = sphere("dome", white, 0.12, (0, 0, 0.5), 8, 5, (1, 1, 0.6))
    eye = sphere("eye", ink, 0.035, (0, 0.1, 0.5), 6, 4)
    rotor = cube("rotor", ink, (0.46, 0.06, 0.03), (0, 0, 0.62))
    mast = cylinder("mast", ink, 0.02, 0.08, (0, 0, 0.56), 6)
    broom = cube("broom", wood, (0.16, 0.05, 0.1), (0, 0, 0.22))
    link_children(root, (saucer, dome, eye, rotor, mast, broom))
    export_root(root, "robot_drone")


def build_caravan():
    fresh()
    cream = material("cream", C["cream"])
    ink = material("ink", C["ink"], 0.6)
    white = material("white", C["white"])
    cyan = material("cyan", C["cyan"], 0.2, emit=0.15)
    root = empty("robot_caravan")
    body = cube("body", cream, (0.55, 1.35, 0.42), (0, 0, 0.42))
    cabin = cube("cabin", cream, (0.48, 0.4, 0.28), (0, 0.42, 0.72))
    glass = cube("glass", cyan, (0.32, 0.06, 0.14), (0, 0.62, 0.74))
    smile = cube("smile", ink, (0.16, 0.02, 0.03), (0, 0.68, 0.48))
    wheels = [
        wheel("wheel_fl", ink, white, 0.16, 0.1, (-0.28, 0.4, 0.16)),
        wheel("wheel_fr", ink, white, 0.16, 0.1, (0.28, 0.4, 0.16)),
        wheel("wheel_bl", ink, white, 0.16, 0.1, (-0.28, -0.45, 0.16)),
        wheel("wheel_br", ink, white, 0.16, 0.1, (0.28, -0.45, 0.16)),
    ]
    link_children(root, [body, cabin, glass, smile, *wheels])
    export_root(root, "robot_caravan")


# --- lunar props ----------------------------------------------------------

def build_rock():
    fresh()
    rock = material("rock", C["rock"], 0.75)
    dark = material("dark", C["rock_dark"], 0.8)
    root = empty("prop_rock")
    a = sphere("stone_a", rock, 0.45, (0, 0, 0.28), 8, 5, (1.2, 1.0, 0.75))
    b = sphere("stone_b", dark, 0.22, (0.28, 0.12, 0.16), 7, 4, (1.1, 0.8, 0.7))
    c = sphere("stone_c", rock, 0.16, (-0.26, 0.08, 0.12), 6, 4)
    link_children(root, (a, b, c))
    export_root(root, "prop_rock")


def build_crater():
    fresh()
    sand = material("sand", C["sand"], 0.7)
    dark = material("dark", C["rock_dark"], 0.85)
    root = empty("prop_crater")
    ring = primitive("torus", "rim", sand, major_radius=0.85, minor_radius=0.18, major_segments=16, minor_segments=6, location=(0, 0, 0.1))
    bowl = cylinder("bowl", dark, 0.62, 0.08, (0, 0, 0.04), 16)
    link_children(root, (ring, bowl))
    export_root(root, "prop_crater")


def build_airlock():
    fresh()
    white = material("white", C["white"])
    orange = material("orange", C["orange"])
    cyan = material("cyan", C["cyan"], 0.2, emit=0.25)
    ink = material("ink", C["ink"])
    root = empty("prop_airlock")
    base = cylinder("base", white, 0.7, 0.35, (0, 0, 0.18), 12)
    ring = primitive("torus", "hatch_ring", orange, major_radius=0.42, minor_radius=0.06, major_segments=14, minor_segments=6, location=(0, 0, 0.55))
    door = cylinder("door", cyan, 0.32, 0.08, (0, 0, 0.55), 12)
    bolt = sphere("knob", ink, 0.05, (0.18, 0, 0.55), 6, 4)
    link_children(root, (base, ring, door, bolt))
    export_root(root, "prop_airlock")


def build_cactus():
    fresh()
    leaf = material("leaf", C["leaf"])
    sand = material("pot", C["sand"])
    root = empty("prop_cactus")
    pot = cylinder("pot", sand, 0.22, 0.2, (0, 0, 0.1), 8)
    stem = cube("stem", leaf, (0.16, 0.16, 0.7), (0, 0, 0.55))
    arm_l = cube("arm_l", leaf, (0.34, 0.12, 0.12), (-0.16, 0, 0.62))
    arm_r = cube("arm_r", leaf, (0.12, 0.12, 0.28), (0.22, 0, 0.78))
    link_children(root, (pot, stem, arm_l, arm_r))
    export_root(root, "prop_cactus")


def build_dish():
    fresh()
    white = material("white", C["white"])
    ink = material("ink", C["ink"])
    orange = material("orange", C["orange"])
    root = empty("prop_dish")
    pole = cylinder("pole", ink, 0.04, 1.1, (0, 0, 0.55), 6)
    dish = sphere("dish", white, 0.38, (0, 0.05, 1.15), 10, 6, (1, 1, 0.28))
    dish.rotation_euler = (math.radians(-55), 0, 0)
    apply_transform(dish)
    feed = sphere("feed", orange, 0.06, (0, 0.22, 1.22), 6, 4)
    link_children(root, (pole, dish, feed))
    export_root(root, "prop_dish")


def build_dome():
    fresh()
    pink = material("pink", C["pink"], 0.25, emit=0.08)
    white = material("white", C["white"])
    cyan = material("cyan", C["cyan"], 0.15, emit=0.2)
    root = empty("prop_dome")
    base = cylinder("base", white, 0.55, 0.25, (0, 0, 0.12), 12)
    dome = sphere("glass", pink, 0.5, (0, 0, 0.45), 12, 8, (1, 1, 0.85))
    door = cube("door", cyan, (0.22, 0.06, 0.32), (0, 0.48, 0.28))
    link_children(root, (base, dome, door))
    export_root(root, "prop_dome")


def build_flag():
    fresh()
    ink = material("ink", C["ink"])
    gold = material("gold", C["gold"])
    mint = material("mint", C["mint"])
    root = empty("prop_flag")
    pole = cylinder("pole", ink, 0.025, 1.3, (0, 0, 0.65), 6)
    cloth = cube("cloth", gold, (0.02, 0.42, 0.24), (0, 0.22, 1.15))
    stripe = cube("stripe", mint, (0.03, 0.42, 0.06), (0, 0.22, 1.22))
    link_children(root, (pole, cloth, stripe))
    export_root(root, "prop_flag")


def build_hut():
    fresh()
    white = material("white", C["white"])
    scarf = material("roof", C["scarf"])
    cyan = material("window", C["cyan"], 0.2, emit=0.2)
    sand = material("step", C["sand"])
    root = empty("prop_hut")
    walls = cube("walls", white, (1.1, 0.9, 0.7), (0, 0, 0.45))
    roof = cone("roof", scarf, 0.78, 0.45, (0, 0, 1.0), 4)
    roof.rotation_euler[2] = math.radians(45)
    apply_transform(roof)
    win = cube("window", cyan, (0.28, 0.04, 0.22), (0, 0.46, 0.5))
    step = cube("step", sand, (0.4, 0.2, 0.08), (0, 0.5, 0.06))
    link_children(root, (walls, roof, win, step))
    export_root(root, "prop_hut")


def build_ship(stem, scale=1.0, legs=4):
    fresh()
    hull_m = material("hull", (0.93, 0.94, 0.96, 1), 0.42)
    belly = material("belly", (0.75, 0.32, 0.22, 1), 0.5)
    ink = material("ink", C["ink"], 0.55)
    glass = material("glass", C["cyan"], 0.12, emit=0.45)
    gold = material("gold", C["gold"], 0.35, emit=0.9)
    coral = material("coral", C["scarf"], 0.4)
    root = empty(stem)
    body = sphere("hull", hull_m, 0.82 * scale, (0, 0.05 * scale, 1.22 * scale), 14, 9, (1.05, 1.55, 0.5))
    stripe = cube("stripe", belly, (1.55 * scale, 2.15 * scale, 0.16 * scale), (0, 0.05 * scale, 0.95 * scale))
    cabin = sphere("cabin", glass, 0.34 * scale, (0, 0.55 * scale, 1.62 * scale), 12, 8, (1.05, 1.25, 0.62))
    window_l = cube("window_l", glass, (0.12 * scale, 0.42 * scale, 0.22 * scale), (-0.78 * scale, 0.15 * scale, 1.28 * scale))
    window_r = cube("window_r", glass, (0.12 * scale, 0.42 * scale, 0.22 * scale), (0.78 * scale, 0.15 * scale, 1.28 * scale))
    bay = cube("cargo_bay", ink, (0.85 * scale, 0.55 * scale, 0.48 * scale), (0, -0.95 * scale, 1.05 * scale))
    ramp = cube("ramp", belly, (0.72 * scale, 1.15 * scale, 0.08 * scale), (0, -1.55 * scale, 0.48 * scale))
    ramp.rotation_euler = (math.radians(28), 0, 0)
    apply_transform(ramp)
    parts = [body, stripe, cabin, window_l, window_r, bay, ramp]
    for i in range(legs):
        ang = (i / legs) * math.tau + 0.4
        fx = math.cos(ang) * 1.15 * scale
        fy = math.sin(ang) * 1.55 * scale
        leg = cylinder(f"leg_{i}", ink, 0.055 * scale, 0.95 * scale, (fx * 0.85, fy * 0.72, 0.48 * scale), 7, rot=(math.radians(24 * math.sin(ang)), 0, math.radians(24 * math.cos(ang))))
        foot = cylinder(f"foot_{i}", coral, 0.18 * scale, 0.07 * scale, (fx * 0.98, fy * 0.82, 0.05 * scale), 8)
        parent_to(foot, leg)
        parts.append(leg)
    engine_l = cylinder("engine_l", ink, 0.2 * scale, 0.48 * scale, (-0.48 * scale, -1.15 * scale, 0.95 * scale), 12)
    engine_r = cylinder("engine_r", ink, 0.2 * scale, 0.48 * scale, (0.48 * scale, -1.15 * scale, 0.95 * scale), 12)
    flame_l = cone("flame_l", gold, 0.14 * scale, 0.36 * scale, (-0.48 * scale, -1.15 * scale, 0.58 * scale), 10, rot=(math.radians(180), 0, 0))
    flame_r = cone("flame_r", gold, 0.14 * scale, 0.36 * scale, (0.48 * scale, -1.15 * scale, 0.58 * scale), 10, rot=(math.radians(180), 0, 0))
    antenna = cylinder("antenna", ink, 0.02 * scale, 0.7 * scale, (0.35 * scale, 0.2 * scale, 2.05 * scale), 6)
    dish = sphere("dish", hull_m, 0.16 * scale, (0.35 * scale, 0.28 * scale, 2.35 * scale), 8, 5, (1, 1, 0.35))
    light_a = sphere("light_a", gold, 0.06 * scale, (0, 1.55 * scale, 1.15 * scale), 8, 4)
    light_b = sphere("light_b", coral, 0.05 * scale, (-0.9 * scale, -0.2 * scale, 1.35 * scale), 8, 4)
    light_c = sphere("light_c", coral, 0.05 * scale, (0.9 * scale, -0.2 * scale, 1.35 * scale), 8, 4)
    parts.extend((engine_l, engine_r, flame_l, flame_r, antenna, dish, light_a, light_b, light_c))
    link_children(root, parts)
    export_root(root, stem)


def build_mars_ship():
    build_ship("ship", 1.05, 4)


def build_lander():
    build_ship("lander", 0.62, 3)


def main():
    # Character, vehicles, robots and most props come from the CC0 Kenney kit
    # via blender/import_cc0.py. These stay custom because no suitable CC0 model exists.
    builders = [
        build_tool_brush,
        build_tool_broom,
        build_tool_mop,
        lambda: build_tool_vac("tool_vac", C["blue"], 1.0),
        lambda: build_tool_vac("tool_ind", C["orange"], 1.35),
        build_tool_turbo,
        build_tool_cyclone,
        build_tool_plasma,
        build_tool_grav,
        build_tool_comet,
        build_tool_aurora,
        build_rocket,
        build_mars_ship,
        build_lander,
        build_drone,
        build_flag,
        build_cactus,
    ]
    for fn in builders:
        fn()
    print("CUSTOM_MODELS_DONE")


if __name__ == "__main__":
    main()
