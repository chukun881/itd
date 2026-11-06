#!/usr/bin/env python3
"""Proof of concept: the desk from experiments/desk1 rebuilt as clean CAD parts.

Hand-written from the Gemini view sheet and measurements of draft 2's mesh, to show
the factory what a parametric draft looks like (separate named solids, flat and
filleted faces, real mm) before trying to have an AI write this code by itself.

  .venv-cad/bin/python scripts/cad_desk_poc.py send/desk_cad_poc/desk_cad_draft.step
"""

import sys
from pathlib import Path

from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepFilletAPI import BRepFilletAPI_MakeFillet
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.gp import gp_Pnt
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.Quantity import Quantity_Color, Quantity_TOC_RGB
from OCP.STEPCAFControl import STEPCAFControl_Writer
from OCP.STEPControl import STEPControl_AsIs
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_EDGE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorSurf

# ---- Dimensions (mm). X = width, Y = depth (front at Y=0), Z = height. ----
W, D, H = 1400, 700, 750
PANEL_T = 180          # end panel thickness
PANEL_R = 80           # rounding of the panel's outer vertical edges
TOP_T = 25             # desk top thickness
TOP_Z = H - 25 - TOP_T  # top underside (raised edges add 25 above the top)
LIP_H, LIP_T, LIP_LEN = 25, 20, 220  # raised corner edges at the back
APRON_H = 100          # drawer box height under the top
DRAWER_GAP = 4
FRONT_T = 18           # drawer front thickness
SETBACK = 20           # drawer box set back from the front edge


def box(x, y, z, dx, dy, dz):
    return BRepPrimAPI_MakeBox(gp_Pnt(x, y, z), dx, dy, dz).Shape()


def fillet_edges(shape, radius, keep):
    """Fillet the straight edges for which keep(start, end) is true."""
    mk = BRepFilletAPI_MakeFillet(shape)
    exp = TopExp_Explorer(shape, TopAbs_EDGE)
    seen = set()
    while exp.More():
        edge = TopoDS.Edge(exp.Current())
        c = BRepAdaptor_Curve(edge)
        a, b = c.Value(c.FirstParameter()), c.Value(c.LastParameter())
        key = tuple(round(v, 3) for v in (a.X(), a.Y(), a.Z(), b.X(), b.Y(), b.Z()))
        if key not in seen and keep(a, b):
            mk.Add(radius, edge)
            seen.add(key)
        exp.Next()
    mk.Build()
    return mk.Shape()


def vertical_at(xs, ys):
    """Vertical edge whose X is in xs and Y in ys."""
    def keep(a, b):
        return (abs(a.X() - b.X()) < 1e-6 and abs(a.Y() - b.Y()) < 1e-6 and abs(a.Z() - b.Z()) > 1
                and round(a.X()) in xs and round(a.Y()) in ys)
    return keep


def end_panel(x0, outer_x):
    p = box(x0, 0, 0, PANEL_T, D, TOP_Z)
    # Round the two outer vertical edges (front and back), like the upholstered panels.
    return fillet_edges(p, PANEL_R, vertical_at({outer_x}, {0, D}))


def desk_top():
    t = box(0, 0, TOP_Z, W, D, TOP_T)
    return fillet_edges(t, 30, vertical_at({0, W}, {0, D}))


def corner_lip(left: bool):
    x0 = 0 if left else W - LIP_LEN
    back = box(x0, D - LIP_T, TOP_Z + TOP_T, LIP_LEN, LIP_T, LIP_H)
    side_x = 0 if left else W - LIP_T
    side = box(side_x, D - 150, TOP_Z + TOP_T, LIP_T, 150, LIP_H)
    from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse
    return BRepAlgoAPI_Fuse(back, side).Shape()


def drawer_box():
    inner = W - 2 * PANEL_T
    carcass = box(PANEL_T, SETBACK + FRONT_T, TOP_Z - APRON_H, inner, D - SETBACK - FRONT_T - 20, APRON_H)
    hollow = box(PANEL_T + 15, SETBACK + FRONT_T, TOP_Z - APRON_H + 15, inner - 30, D - SETBACK - FRONT_T - 35, APRON_H - 15)
    return BRepAlgoAPI_Cut(carcass, hollow).Shape()


def drawer_front(i):
    inner = W - 2 * PANEL_T
    w = (inner - DRAWER_GAP) / 2
    x = PANEL_T + i * (w + DRAWER_GAP)
    return box(x, SETBACK, TOP_Z - APRON_H + DRAWER_GAP, w, FRONT_T, APRON_H - DRAWER_GAP)


PARTS = [
    ("Top", desk_top(), (0.30, 0.27, 0.25)),
    ("End panel left", end_panel(0, 0), (0.80, 0.77, 0.70)),
    ("End panel right", end_panel(W - PANEL_T, W), (0.80, 0.77, 0.70)),
    ("Raised edge left", corner_lip(True), (0.30, 0.27, 0.25)),
    ("Raised edge right", corner_lip(False), (0.30, 0.27, 0.25)),
    ("Drawer box", drawer_box(), (0.35, 0.32, 0.30)),
    ("Drawer front left", drawer_front(0), (0.30, 0.27, 0.25)),
    ("Drawer front right", drawer_front(1), (0.30, 0.27, 0.25)),
]


def write(path: Path) -> None:
    doc = TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
    shapes = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    colors = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    for name, shape, rgb in PARTS:
        label = shapes.AddShape(shape, False)
        TDataStd_Name.Set_s(label, TCollection_ExtendedString(name))
        colors.SetColor(label, Quantity_Color(*rgb, Quantity_TOC_RGB), XCAFDoc_ColorSurf)
    Interface_Static.SetCVal_s("write.step.unit", "MM")
    Interface_Static.SetCVal_s("write.step.schema", "AP214IS")
    writer = STEPCAFControl_Writer()
    writer.SetNameMode(True)
    writer.SetColorMode(True)
    writer.Transfer(doc, STEPControl_AsIs)
    path.parent.mkdir(parents=True, exist_ok=True)
    if writer.Write(str(path)) != IFSelect_RetDone:
        sys.exit("STEP write failed")


if __name__ == "__main__":
    write(Path(sys.argv[1] if len(sys.argv) > 1 else "desk_cad_draft.step"))
