"""Convert an AI-generated GLB mesh into CAD exchange files (STL, OBJ, faceted STEP).

The STEP is a faceted solid: every triangle becomes a flat face. It opens in CAD
tools such as Autodesk Inventor but is not a parametric, editable model.

Usage:
  python scripts/mesh_to_cad.py <in.glb> <out_dir> <name> --height-mm 850 --faces 20000
"""
import argparse
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh
from OCP.BRep import BRep_Builder
from OCP.BRepBuilderAPI import (
    BRepBuilderAPI_MakePolygon,
    BRepBuilderAPI_MakeFace,
    BRepBuilderAPI_MakeSolid,
    BRepBuilderAPI_Sewing,
)
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.STEPControl import STEPControl_AsIs, STEPControl_Writer
from OCP.TopAbs import TopAbs_SHELL
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS, TopoDS_Compound
from OCP.gp import gp_Pnt


def load_mesh(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(path, force="scene")
    mesh = loaded.to_geometry() if hasattr(loaded, "to_geometry") else loaded.dump(concatenate=True)
    return trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=True)


def simplify(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    if len(mesh.faces) <= target_faces:
        return mesh
    ratio = 1 - target_faces / len(mesh.faces)
    verts, faces = fast_simplification.simplify(
        mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), target_reduction=ratio
    )
    return trimesh.Trimesh(vertices=verts, faces=faces, process=True)


def scale_to_height(mesh: trimesh.Trimesh, height_mm: float) -> trimesh.Trimesh:
    # glTF is Y-up; scale so the Y extent equals the real height in mm,
    # then put the base on Y=0 and centre X/Z on the origin.
    extent_y = mesh.extents[1]
    mesh.apply_scale(height_mm / extent_y)
    lo, hi = mesh.bounds
    mesh.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    return mesh


def write_step(mesh: trimesh.Trimesh, path: Path) -> str:
    sewing = BRepBuilderAPI_Sewing(1e-3)
    for tri in mesh.vertices[mesh.faces]:
        poly = BRepBuilderAPI_MakePolygon(
            *(gp_Pnt(*map(float, v)) for v in tri), True
        )
        face = BRepBuilderAPI_MakeFace(poly.Wire(), True)
        if face.IsDone():
            sewing.Add(face.Face())
    sewing.Perform()
    sewn = sewing.SewedShape()

    # Make a solid from each closed shell; keep open shells as surfaces.
    compound = TopoDS_Compound()
    builder = BRep_Builder()
    builder.MakeCompound(compound)
    solids = 0
    explorer = TopExp_Explorer(sewn, TopAbs_SHELL)
    while explorer.More():
        shell = TopoDS.Shell(explorer.Current())
        maker = BRepBuilderAPI_MakeSolid(shell)
        if shell.Closed() and maker.IsDone():
            builder.Add(compound, maker.Solid())
            solids += 1
        else:
            builder.Add(compound, shell)
        explorer.Next()

    Interface_Static.SetCVal_s("write.step.unit", "MM")
    writer = STEPControl_Writer()
    writer.Transfer(compound, STEPControl_AsIs)
    if writer.Write(str(path)) != IFSelect_RetDone:
        raise RuntimeError("STEP write failed")
    return f"{solids} closed solid(s)"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("glb", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("name")
    parser.add_argument("--height-mm", type=float, required=True)
    parser.add_argument("--faces", type=int, default=20000)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    mesh = load_mesh(args.glb)
    print(f"loaded {len(mesh.faces)} faces")
    mesh = scale_to_height(simplify(mesh, args.faces), args.height_mm)
    w, h, d = mesh.extents
    print(f"simplified to {len(mesh.faces)} faces; size W{w:.0f} x H{h:.0f} x D{d:.0f} mm")

    mesh.export(args.out_dir / f"{args.name}.stl")
    mesh.export(args.out_dir / f"{args.name}.obj")
    info = write_step(mesh, args.out_dir / f"{args.name}.step")
    print(f"wrote STL, OBJ, STEP ({info})")


if __name__ == "__main__":
    main()
