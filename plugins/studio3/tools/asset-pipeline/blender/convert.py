"""Studio3 asset import: convert FBX / OBJ / DAE / BLEND / USD(Z) / STL / PLY to GLB.

Run by `studio3 assets import` as:
    blender -b -P convert.py -- <input> <output.glb>

The input file is only read. The scene is exported with materials, animations,
skins, morph targets, vertex colours and custom properties (as glTF extras);
object names are kept because viewers select parts by name.

NOTE: this script could not be executed in the environment where Studio3 was
built (Blender was not installed there). It targets Blender 3.6 LTS – 4.x and
guards the operators whose names changed between those versions.
"""
import os
import sys

import bpy


def fail(message, code=1):
    print("studio3-import: ERROR: " + message, file=sys.stderr)
    sys.exit(code)


def has_op(module, name):
    return hasattr(module, name)


def import_file(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
        return
    # Start from an empty scene so the default cube/light/camera are not exported.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        if has_op(bpy.ops.wm, "obj_import"):  # Blender >= 3.3
            bpy.ops.wm.obj_import(filepath=path)
        else:
            bpy.ops.import_scene.obj(filepath=path)
    elif ext == ".dae":
        if not has_op(bpy.ops.wm, "collada_import"):
            fail("this Blender build has no COLLADA importer (removed in recent versions); use Blender 4.x LTS or convert to FBX/OBJ first", 4)
        bpy.ops.wm.collada_import(filepath=path)
    elif ext in (".usdz", ".usd", ".usda", ".usdc"):
        bpy.ops.wm.usd_import(filepath=path)
    elif ext == ".stl":
        if has_op(bpy.ops.wm, "stl_import"):
            bpy.ops.wm.stl_import(filepath=path)
        else:
            bpy.ops.import_mesh.stl(filepath=path)
    elif ext == ".ply":
        if has_op(bpy.ops.wm, "ply_import"):
            bpy.ops.wm.ply_import(filepath=path)
        else:
            bpy.ops.import_mesh.ply(filepath=path)
    else:
        fail("unsupported input extension: " + ext, 2)


def export_glb(path):
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        export_apply=False,          # keep modifiers unapplied -> shape keys survive
        export_extras=True,          # custom properties -> glTF extras
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    # Only pass options this Blender version actually knows.
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs = {k: v for k, v in kwargs.items() if k in props}
    bpy.ops.export_scene.gltf(**kwargs)


def main():
    argv = sys.argv
    if "--" not in argv:
        fail("usage: blender -b -P convert.py -- <input> <output.glb>", 2)
    args = argv[argv.index("--") + 1:]
    if len(args) != 2:
        fail("expected exactly two arguments: <input> <output.glb>", 2)
    src, dst = os.path.abspath(args[0]), os.path.abspath(args[1])
    if not os.path.isfile(src):
        fail("input not found: " + src, 2)
    if os.path.abspath(src) == os.path.abspath(dst):
        fail("output must differ from input (sources are never overwritten)", 2)
    out_dir = os.path.dirname(dst)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir)
    import_file(src)
    export_glb(dst)
    if not os.path.isfile(dst):
        fail("export produced no file", 1)
    print("studio3-import: wrote " + dst)


if __name__ == "__main__":
    main()
