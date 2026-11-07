"""Import CC0 Kenney Space Kit models, recolor them, and export game-ready glTF.

The source pack is downloaded separately (see assets/CREDITS.md). This script
expects the extracted glTF files under /tmp/cc0/space or ./third_party/kenney-space-kit.

Run:
  blender --background --python blender/import_cc0.py
"""
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
GLB_DIR = ROOT / "assets" / "models"
BLEND_DIR = ROOT / "blender" / "src"
CANDIDATES = [
    Path("/tmp/cc0/space/package/assets/Models/GLTF format"),
    ROOT / "third_party" / "kenney-space-kit" / "Models" / "GLTF format",
]
SRC = next((p for p in CANDIDATES if p.is_dir()), None)
if SRC is None:
    raise SystemExit("Kenney Space Kit GLBs not found. Extract the CC0 pack first.")

GLB_DIR.mkdir(parents=True, exist_ok=True)
BLEND_DIR.mkdir(parents=True, exist_ok=True)

YELLOW = (1.0, 0.78, 0.18, 1)
CORAL = (1.0, 0.38, 0.38, 1)
CYAN = (0.35, 0.88, 1.0, 1)
INK = (0.16, 0.14, 0.26, 1)
WHITE = (0.96, 0.95, 0.92, 1)
MINT = (0.25, 0.82, 0.62, 1)
PINK = (1.0, 0.55, 0.72, 1)
ORANGE = (1.0, 0.5, 0.22, 1)
CREAM = (0.96, 0.86, 0.68, 1)


def fresh_import(filename):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SRC / filename))
    for obj in list(bpy.context.scene.objects):
        if obj.parent and obj.parent.name.startswith("tmp"):
            matrix = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = matrix
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("tmp"):
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()


def set_base(mat, color, rough=0.55, emit=0.0):
    if not mat.use_nodes:
        return
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        return
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    emit_name = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
    if emit_name in bsdf.inputs and emit > 0:
        bsdf.inputs[emit_name].default_value = color
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit


def recolor(mapping):
    for mat in bpy.data.materials:
        base = mat.name.split(".")[0]
        if base in mapping:
            set_base(mat, mapping[base])


def mesh_bounds(objects=None):
    objects = objects or [o for o in bpy.context.scene.objects if o.type == "MESH"]
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins = Vector((min(mins.x, world.x), min(mins.y, world.y), min(mins.z, world.z)))
            maxs = Vector((max(maxs.x, world.x), max(maxs.y, world.y), max(maxs.z, world.z)))
    return mins, maxs


def parent_keep(child, parent):
    matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = matrix


def empty(name):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.15
    bpy.context.collection.objects.link(obj)
    return obj


def make_wheel(name, radius, loc):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=radius, depth=radius * 0.55,
        location=loc, rotation=(0, math.radians(90), 0),
    )
    tire = bpy.context.active_object
    tire.name = name
    mat = bpy.data.materials.get("tire") or bpy.data.materials.new("tire")
    set_base(mat, INK, 0.7)
    if not tire.data.materials:
        tire.data.materials.append(mat)
    else:
        tire.data.materials[0] = mat
    bpy.ops.object.transform_apply(rotation=True)
    hub_mat = bpy.data.materials.get("hub") or bpy.data.materials.new("hub")
    set_base(hub_mat, WHITE, 0.4)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=radius * 0.38, depth=radius * 0.7,
        location=loc, rotation=(0, math.radians(90), 0),
    )
    hub = bpy.context.active_object
    hub.name = name + "_hub"
    if not hub.data.materials:
        hub.data.materials.append(hub_mat)
    bpy.ops.object.transform_apply(rotation=True)
    parent_keep(hub, tire)
    return tire


def add_wheels(root, radius):
    mins, maxs = mesh_bounds()
    span_x = maxs.x - mins.x
    span_y = maxs.y - mins.y
    xs = (mins.x + span_x * 0.22, maxs.x - span_x * 0.22)
    ys = (mins.y + span_y * 0.25, maxs.y - span_y * 0.25)
    names = ["wheel_bl", "wheel_br", "wheel_fl", "wheel_fr"]
    index = 0
    for y in ys:
        for x in xs:
            wheel = make_wheel(names[index], radius, (x, y, mins.z + radius))
            parent_keep(wheel, root)
            index += 1


def wrap_root(name):
    root = empty(name)
    for obj in list(bpy.context.scene.objects):
        if obj is root or obj.parent is not None:
            continue
        parent_keep(obj, root)
    return root


def fit_height(root, height):
    bpy.context.view_layer.update()
    mins, maxs = mesh_bounds()
    root.location.x -= (mins.x + maxs.x) * 0.5
    root.location.y -= (mins.y + maxs.y) * 0.5
    root.location.z -= mins.z
    bpy.context.view_layer.update()
    mins, maxs = mesh_bounds()
    current = max(maxs.z - mins.z, 0.001)
    root.scale = (height / current, height / current, height / current)
    bpy.context.view_layer.update()


def export_root(root, stem):
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
    )
    print("WROTE", glb_path)


def hand_point(arm):
    coords = [arm.matrix_world @ Vector(corner) for corner in arm.bound_box]
    coords.sort(key=lambda v: v.z)
    sample = coords[: max(1, len(coords) // 3)]
    total = Vector((0, 0, 0))
    for item in sample:
        total += item
    return total / len(sample)


def build_janitor():
    fresh_import("astronautA.glb")
    recolor({
        "metal": YELLOW,
        "metalRed": CORAL,
        "metalDark": INK,
        "dark": (0.22, 0.22, 0.28, 1),
        "skin": CYAN,
        "rock": (0.95, 0.78, 0.2, 1),
        "rockDark": (0.75, 0.55, 0.12, 1),
    })
    renames = {
        "legLeft": "leg_l",
        "legRight": "leg_r",
        "armLeft": "arm_l",
        "armRight": "arm_r",
        "head": "helmet",
    }
    for obj in bpy.context.scene.objects:
        if obj.name in renames:
            obj.name = renames[obj.name]
    arm = bpy.data.objects.get("arm_r")
    root = wrap_root("janitor")
    if arm is not None:
        socket = empty("tool_socket")
        bpy.context.collection.objects.link(socket) if socket.name not in bpy.context.scene.objects else None
        # empty() already linked
        socket.parent = arm
        socket.matrix_world = Matrix.Translation(hand_point(arm))
    fit_height(root, 1.7)
    export_root(root, "janitor")


def build_vehicle(filename, stem, colors, height, wheel_radius):
    fresh_import(filename)
    recolor(colors)
    root = wrap_root(stem)
    add_wheels(root, wheel_radius)
    fit_height(root, height)
    export_root(root, stem)


def build_prop(filename, stem, height, colors=None):
    fresh_import(filename)
    if colors:
        recolor(colors)
    root = wrap_root(stem)
    fit_height(root, height)
    export_root(root, stem)


def build_robot_from_alien():
    fresh_import("alien.glb")
    recolor({
        "metal": MINT,
        "metalRed": CORAL,
        "metalDark": INK,
        "dark": INK,
        "skin": MINT,
        "rock": WHITE,
        "rockDark": (0.15, 0.45, 0.38, 1),
    })
    for obj in bpy.context.scene.objects:
        obj.name = {
            "legLeft": "leg_l",
            "legRight": "leg_r",
            "armLeft": "arm_l",
            "armRight": "arm_r",
        }.get(obj.name, obj.name)
    root = wrap_root("robot_chistik")
    fit_height(root, 0.85)
    export_root(root, "robot_chistik")


def build_beetle():
    fresh_import("rover.glb")
    recolor({"metal": ORANGE, "metalRed": CORAL, "metalDark": INK, "dark": INK})
    root = wrap_root("robot_beetle")
    add_wheels(root, 0.05)
    fit_height(root, 0.7)
    export_root(root, "robot_beetle")


def build_caravan():
    fresh_import("craft_cargoA.glb")
    recolor({"metal": CREAM, "metalRed": CORAL, "metalDark": INK, "dark": INK})
    root = wrap_root("robot_caravan")
    add_wheels(root, 0.12)
    fit_height(root, 0.9)
    export_root(root, "robot_caravan")


def build_depot():
    fresh_import("platform_large.glb")
    recolor({"metal": MINT, "metalRed": WHITE, "metalDark": INK, "dark": INK, "rock": MINT})
    pad = wrap_root("pad")
    fit_height(pad, 0.35)
    # Widen the pad into a landing circle about 2.4 m across.
    bpy.context.view_layer.update()
    mins, maxs = mesh_bounds()
    span = max(maxs.x - mins.x, maxs.y - mins.y, 0.001)
    widen = 2.4 / span
    pad.scale = (pad.scale.x * widen, pad.scale.y * widen, pad.scale.z)
    bpy.context.view_layer.update()
    mins, maxs = mesh_bounds()
    pad.location.z -= mins.z

    rocket = empty("rocket")
    parent_keep(rocket, pad)
    white = bpy.data.materials.new("rocket_white")
    set_base(white, WHITE, 0.4)
    coral = bpy.data.materials.new("rocket_coral")
    set_base(coral, CORAL, 0.4)
    gold = bpy.data.materials.new("rocket_gold")
    set_base(gold, YELLOW, 0.3, emit=0.8)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.12, depth=0.55, location=(0.75, 0.0, 0.45))
    body = bpy.context.active_object
    body.name = "rocket_body"
    body.data.materials.append(white)
    parent_keep(body, rocket)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.12, depth=0.28, location=(0.75, 0.0, 0.84))
    nose = bpy.context.active_object
    nose.name = "rocket_nose"
    nose.data.materials.append(coral)
    parent_keep(nose, rocket)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.08, depth=0.22, location=(0.75, 0.0, 0.1), rotation=(math.pi, 0, 0))
    flame = bpy.context.active_object
    flame.name = "flame"
    flame.data.materials.append(gold)
    parent_keep(flame, rocket)
    export_root(pad, "depot")


def main():
    build_janitor()
    build_vehicle("rover.glb", "vehicle_pyh", {
        "metal": YELLOW, "metalRed": CORAL, "metalDark": INK, "dark": INK,
    }, 1.15, 0)
    build_vehicle("craft_miner.glb", "vehicle_blin", {
        "metal": PINK, "metalRed": WHITE, "metalDark": INK, "dark": INK,
    }, 1.05, 0.16)
    build_vehicle("craft_racer.glb", "vehicle_iskra", {
        "metal": CYAN, "metalRed": WHITE, "metalDark": INK, "dark": (0.25, 0.3, 0.38, 1),
    }, 0.85, 0.14)
    build_robot_from_alien()
    build_beetle()
    build_caravan()
    build_prop("rock_largeA.glb", "prop_rock", 0.7)
    build_prop("craterLarge.glb", "prop_crater", 0.28)
    build_prop("satelliteDish.glb", "prop_dish", 1.5)
    build_prop("hangar_roundA.glb", "prop_dome", 1.6)
    build_prop("hangar_smallA.glb", "prop_hut", 1.3)
    build_prop("structure.glb", "prop_airlock", 1.8)
    build_prop("rock_crystals.glb", "prop_crystals", 0.9)
    build_depot()
    print("CC0_IMPORT_DONE")


if __name__ == "__main__":
    main()
