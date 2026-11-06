#!/usr/bin/env python3
"""Multi-view experiment: does an AI-generated view sheet give a better 3D draft
than one real photo?

Three phases, each a separate run so the results can be checked before more is
spent. Every phase is a dry run (prints the cost) unless --yes is given, and
refuses to start if it would take the total spend past --stop (default $11).

  1. cutout  Bria guided ("only the <piece>") and SAM 3 cut-outs of the photo.
  2. sheets  4-panel turnaround sheets (front, left, back, right) from the chosen
             cut-out with Nano Banana 2 and Seedream 4.5, cropped into panels
             and checked for consistency.
  3. models  A: Hunyuan Pro, real cut-out only
             B: Hunyuan Pro, real cut-out + Nano Banana panels
             D: Tripo h3.1 multiview, Seedream panels (+ real cut-out as front)
             Each is post-processed like the app (simplify, symmetry, size) and
             exported as STL + 15k-face STEP, labelled X/Y/Z for a blind review.

  python scripts/mv_experiment.py cutout --name table1 --photo t.jpg --piece table --angle front
  python scripts/mv_experiment.py sheets --name table1 --use bria
  python scripts/mv_experiment.py models --name table1 --type table

Output: experiments/<name>/ (gitignored). Spend log: experiments/spend.csv.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import random
import sys
import urllib.request
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mesh_to_cad import load_mesh, simplify  # noqa: E402
from pilot import SYMMETRY_MAX_ERROR, load_fal_key, symmetrize, symmetry_error  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
EXP = ROOT / "experiments"
SPEND = EXP / "spend.csv"

# fal endpoints and prices, checked 2026-11-06 (model pages and pricing API).
BRIA = ("fal-ai/bria/background/remove", 0.03)  # with a prompt
SAM3 = ("fal-ai/sam-3/image", 0.005)
NANO = ("fal-ai/nano-banana-2/edit", 0.12 + 0.002)  # 2K = 1.5 x $0.08, + high thinking
NANO_PRO = ("fal-ai/nano-banana-pro/edit", 0.15)  # the model behind Gemini app "Pro" images
SEEDREAM = ("fal-ai/bytedance/seedream/v4.5/edit", 0.04)
SHEET_MODELS = {
    "nano": (NANO, lambda prompt, url, seed: {
        "prompt": prompt, "image_urls": [url], "aspect_ratio": "4:1", "resolution": "2K",
        "thinking_level": "high", "seed": seed, "output_format": "png", "num_images": 1}),
    "nanopro": (NANO_PRO, lambda prompt, url, seed: {
        "prompt": prompt, "image_urls": [url], "aspect_ratio": "21:9", "resolution": "2K",
        "seed": seed, "output_format": "png", "num_images": 1}),
    "seedream": (SEEDREAM, lambda prompt, url, seed: {
        "prompt": prompt, "image_urls": [url], "image_size": {"width": 4096, "height": 1024},
        "seed": seed, "num_images": 1, "max_images": 1}),
}
HUNYUAN = ("fal-ai/hunyuan-3d/v3.1/pro/image-to-3d", 0.375)
HUNYUAN_MULTIVIEW = 0.15
TRIPO = ("tripo3d/h3.1/multiview-to-3d", 0.20)  # texture and pbr off

TYPICAL_HEIGHT = {"dining_chair": 850, "lounge_chair": 750, "sofa": 850, "table": 750, "other": 800}
ANGLES = ("front", "left_front", "right_front")
SEED = 42

SHEET_PROMPT = """Look at the {piece} in the uploaded image. Do not create a new design. Keep the
exact shape, proportions, number and position of legs, panels, frame parts,
cushions, curves, materials and colours.

Generate a single wide image with 4 views of this exact {piece} side by side, left to
right: FRONT view, LEFT side view, BACK view, RIGHT side view. Each view at its
natural width, separated by clear white space. All views at the same scale and the
same height, standing on the same baseline, orthographic projection with zero
perspective distortion, camera at half the height of the piece.

If a part is hidden in the photo, assume it matches the visible symmetric part.{hint}

Pure solid white background. No shadows, no floor line, no text, no labels, no
borders, no divider lines, no other objects."""


# ---------- bookkeeping ----------

def spent() -> float:
    if not SPEND.exists():
        return 0.0
    with SPEND.open() as f:
        return sum(float(r["usd"]) for r in csv.DictReader(f))


def log_spend(name: str, item: str, usd: float) -> None:
    new = not SPEND.exists()
    with SPEND.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["time", "name", "item", "usd"])
        w.writerow([dt.datetime.now().isoformat(timespec="seconds"), name, item, f"{usd:.3f}"])


def gate(phase: str, items: list[tuple[str, float]], a: argparse.Namespace) -> None:
    """Print the plan and cost; exit unless --yes and the budget allows it."""
    cost = sum(c for _, c in items)
    total = spent()
    print(f"[{phase}] {a.name}")
    for label, c in items:
        print(f"  {label:<45} ${c:.3f}")
    print(f"  phase total ${cost:.3f} | spent so far ${total:.2f} | stop at ${a.stop:.2f}")
    if total + cost > a.stop:
        sys.exit("  STOP: this phase would pass the spending limit.")
    if not a.yes:
        sys.exit("  Dry run. Add --yes to spend.")


def call(name: str, item: str, endpoint: tuple[str, float], arguments: dict, extra_usd: float = 0.0) -> dict:
    import fal_client

    result = fal_client.subscribe(endpoint[0], arguments=arguments)
    log_spend(name, item, endpoint[1] + extra_usd)
    return result


def download(url: str, target: Path) -> Path:
    with urllib.request.urlopen(url) as response:
        target.write_bytes(response.read())
    return target


def upload(path: Path) -> str:
    import fal_client

    return fal_client.upload_file(str(path))


def state_path(name: str) -> Path:
    return EXP / name / "state.json"


def load_state(name: str) -> dict:
    p = state_path(name)
    if not p.exists():
        sys.exit(f"No experiment called {name}. Run the cutout phase first.")
    return json.loads(p.read_text())


def save_state(name: str, state: dict) -> None:
    state_path(name).write_text(json.dumps(state, indent=2))


# ---------- images ----------

def content_box(img: Image.Image) -> tuple[int, int, int, int] | None:
    """Bounding box of the non-background pixels (alpha, or not near-white)."""
    arr = np.asarray(img.convert("RGBA")).astype(int)
    mask = (arr[..., 3] > 20) & (arr[..., :3].min(axis=2) < 235)
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def pad_square(img: Image.Image, fill: float = 0.85, background=(0, 0, 0, 0)) -> Image.Image:
    """Crop to the piece and centre it on a square canvas, filling `fill` of it."""
    img = img.convert("RGBA")
    box = content_box(img)
    if box:
        img = img.crop(box)
    side = int(max(img.size) / fill)
    canvas = Image.new("RGBA", (side, side), background)
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas


def foreground(img: Image.Image) -> np.ndarray:
    """Pixels that differ from their row's background, taken from the left and right
    margins of the sheet, so white, grey floor gradients and dark bands all drop out."""
    arr = np.asarray(img.convert("RGB")).astype(int)
    m = max(2, arr.shape[1] // 100)
    background = np.median(np.concatenate([arr[:, :m], arr[:, -m:]], axis=1), axis=1, keepdims=True)
    return np.abs(arr - background).max(axis=2) > 30


def clean_background(img: Image.Image) -> Image.Image:
    """Paint every background pixel (see foreground) pure white."""
    arr = np.asarray(img.convert("RGB")).copy()
    arr[~foreground(img)] = 255
    return Image.fromarray(arr)


def panel_boxes(img: Image.Image) -> list[tuple[int, int, int, int]] | None:
    """Find the 4 views by the white gaps between them (views may have different widths).
    Thin divider lines and stray marks are ignored; a horizontal floor line is too thin
    per column to count as content."""
    dark = foreground(img)
    h, w = dark.shape
    content = dark.sum(axis=0) > 0.02 * h
    runs, start = [], None
    for x, c in enumerate(list(content) + [False]):
        if c and start is None:
            start = x
        elif not c and start is not None:
            runs.append([start, x])
            start = None
    # merge runs separated by tiny gaps (texture inside one view)
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 0.01 * w:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    views = [r for r in merged if r[1] - r[0] > 0.04 * w]
    if len(views) != 4:
        return None
    boxes = []
    for x0, x1 in views:
        rows = np.nonzero(dark[:, x0:x1].sum(axis=1) > 0.02 * (x1 - x0))[0]
        boxes.append((x0, int(rows.min()), x1, int(rows.max()) + 1))
    return boxes


def split_panels(sheet: Path, out_dir: Path) -> list[Path]:
    """Cut a 4-view sheet into white square panels: front, left, back, right."""
    img = clean_background(Image.open(sheet))
    boxes = panel_boxes(img)
    if boxes is None:  # equal quarters as a last resort; check_sheet reports the failure
        w, h = img.size
        boxes = [(i * w // 4, 0, (i + 1) * w // 4, h) for i in range(4)]
    # One canvas size for all views so they keep the same scale, piece on a shared baseline.
    side = int(max(max(b[2] - b[0], b[3] - b[1]) for b in boxes) / 0.85)
    paths = []
    for label, box in zip(("front", "left", "back", "right"), boxes):
        view = img.crop(box)
        canvas = Image.new("RGB", (side, side), "white")
        canvas.paste(view, ((side - view.width) // 2, side - int(side * 0.075) - view.height))
        p = out_dir / f"{sheet.stem}_{label}.png"
        canvas.save(p)
        paths.append(p)
    return paths


def check_sheet(sheet: Path, cutout: Path, angle: str) -> list[str]:
    """Consistency checks: 4 separate views, same piece height in every view, and
    (for a front photo) the front view's width/height close to the photo's."""
    img = Image.open(sheet).convert("RGB")
    boxes = panel_boxes(img)
    if boxes is None:
        return ["could not find 4 separate views"]
    problems = []
    heights = [b[3] - b[1] for b in boxes]
    spread = (max(heights) - min(heights)) / max(heights)
    if spread > 0.05:
        problems.append(f"view heights differ by {spread:.0%} (limit 5%)")
    if angle == "front":
        cb = content_box(Image.open(cutout))
        photo_ratio = (cb[2] - cb[0]) / (cb[3] - cb[1])
        ratio = (boxes[0][2] - boxes[0][0]) / heights[0]
        diff = abs(ratio - photo_ratio) / photo_ratio
        if diff > 0.10:
            problems.append(f"front view width/height {ratio:.2f} vs photo {photo_ratio:.2f} ({diff:.0%}, limit 10%)")
    return problems


# ---------- meshes ----------

def _real(x: float) -> str:
    s = repr(float(f"{x:.9g}"))
    if "e" in s:
        m, e = s.split("e")
        return f"{m if '.' in m else m + '.'}E{int(e)}"
    return s if "." in s else s + "."


def write_step_faceted(mesh: trimesh.Trimesh, path: Path, name: str) -> None:
    """Python port of src/lib/mesh/step.ts, so test files match what the app delivers."""
    v, f = mesh.vertices, mesh.faces
    lines: list[str] = []

    def add(e: str) -> int:
        lines.append(f"#{len(lines) + 1}={e};")
        return len(lines)

    def point(p) -> int:
        return add(f"CARTESIAN_POINT('',({','.join(_real(c) for c in p)}))")

    def direction(d) -> int:
        return add(f"DIRECTION('',({','.join(_real(c) for c in d)}))")

    tris = []
    for a, b, c in f:
        if a == b or b == c or a == c:
            continue
        n = np.cross(v[b] - v[a], v[c] - v[a])
        ln = np.linalg.norm(n)
        if ln > 1e-9:
            tris.append((int(a), int(b), int(c), n / ln))
    directed: dict = {}
    for a, b, c, _ in tris:
        for e in ((a, b), (b, c), (c, a)):
            directed[e] = directed.get(e, 0) + 1
    solid = bool(tris) and all(n == 1 and directed.get((e[1], e[0])) == 1 for e, n in directed.items())

    nm = "".join(ch if 32 <= ord(ch) < 127 else "_" for ch in name).replace("'", "''")[:80] or "model"
    app = add("APPLICATION_CONTEXT('automotive design')")
    add(f"APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#{app})")
    pc = add(f"PRODUCT_CONTEXT('',#{app},'mechanical')")
    prod = add(f"PRODUCT('{nm}','{nm}','',(#{pc}))")
    add(f"PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#{prod}))")
    form = add(f"PRODUCT_DEFINITION_FORMATION('','',#{prod})")
    dc = add(f"PRODUCT_DEFINITION_CONTEXT('part definition',#{app},'design')")
    pd = add(f"PRODUCT_DEFINITION('design','',#{form},#{dc})")
    shape = add(f"PRODUCT_DEFINITION_SHAPE('','',#{pd})")
    mm = add("(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))")
    rad = add("(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))")
    sr = add("(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())")
    tol = add(f"UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#{mm},'distance_accuracy_value','')")
    ctx = add(f"(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#{tol}))"
              f"GLOBAL_UNIT_ASSIGNED_CONTEXT((#{mm},#{rad},#{sr}))REPRESENTATION_CONTEXT('',''))")
    origin = add(f"AXIS2_PLACEMENT_3D('',#{point((0, 0, 0))},#{direction((0, 0, 1))},#{direction((1, 0, 0))})")

    pts: dict = {}
    verts: dict = {}

    def vertex(i: int) -> int:
        if i not in verts:
            pts[i] = point(v[i])
            verts[i] = add(f"VERTEX_POINT('',#{pts[i]})")
        return verts[i]

    edges: dict = {}

    def edge(s: int, e: int) -> str:
        lo, hi = min(s, e), max(s, e)
        if (lo, hi) not in edges:
            vlo, vhi = vertex(lo), vertex(hi)
            d = v[hi] - v[lo]
            ln = float(np.linalg.norm(d)) or 1.0
            dr = direction(d / ln)
            vec_id = add(f"VECTOR('',#{dr},{_real(ln)})")
            line = add(f"LINE('',#{pts[lo]},#{vec_id})")
            edges[(lo, hi)] = add(f"EDGE_CURVE('',#{vlo},#{vhi},#{line},.T.)")
        sense = ".T." if s < e else ".F."
        return "#" + str(add(f"ORIENTED_EDGE('',*,*,#{edges[(lo, hi)]},{sense})"))

    faces = []
    for a, b, c, n in tris:
        loop = add(f"EDGE_LOOP('',({','.join([edge(a, b), edge(b, c), edge(c, a)])}))")
        bound = add(f"FACE_OUTER_BOUND('',#{loop},.T.)")
        r = v[b] - v[a]
        r = r / (np.linalg.norm(r) or 1.0)
        axis = add(f"AXIS2_PLACEMENT_3D('',#{pts[a]},#{direction(n)},#{direction(r)})")
        plane = add(f"PLANE('',#{axis})")
        faces.append("#" + str(add(f"ADVANCED_FACE('',(#{bound}),#{plane},.T.)")))

    if solid:
        shell = add(f"CLOSED_SHELL('',({','.join(faces)}))")
        body = add(f"MANIFOLD_SOLID_BREP('{nm}',#{shell})")
        rep = add(f"ADVANCED_BREP_SHAPE_REPRESENTATION('',(#{origin},#{body}),#{ctx})")
    else:
        shell = add(f"OPEN_SHELL('',({','.join(faces)}))")
        body = add(f"SHELL_BASED_SURFACE_MODEL('{nm}',(#{shell}))")
        rep = add(f"MANIFOLD_SURFACE_SHAPE_REPRESENTATION('',(#{origin},#{body}),#{ctx})")
    add(f"SHAPE_DEFINITION_REPRESENTATION(#{shape},#{rep})")
    header = ["ISO-10303-21;", "HEADER;", "FILE_DESCRIPTION(('Furniture 3D draft, faceted'),'2;1');",
              f"FILE_NAME('{nm}.step','{dt.datetime.now().isoformat(timespec='seconds')}',(''),(''),"
              "'furniture-3d-draft','furniture-3d-draft','');",
              "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));", "ENDSEC;", "DATA;"]
    path.write_text("\n".join(header + lines + ["ENDSEC;", "END-ISO-10303-21;", ""]))

def scale_uniform_to_height(mesh: trimesh.Trimesh, height_mm: float) -> None:
    lo, hi = mesh.bounds
    mesh.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    mesh.apply_scale(height_mm / mesh.extents[1])


def size_mesh(mesh: trimesh.Trimesh, a: argparse.Namespace) -> str:
    """Same rules as the app: all three sizes stretch, one or two scale evenly, none uses the typical height."""
    if a.w and a.d and a.h:
        ex, ey, ez = mesh.extents
        mesh.apply_scale([a.w / ex, a.h / ey, a.d / ez])
        lo, hi = mesh.bounds
        mesh.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
        return "stretched"
    if a.h or a.w or a.d:
        axis, mm = (1, a.h) if a.h else (0, a.w) if a.w else (2, a.d)
        scale_uniform_to_height(mesh, mm / mesh.extents[axis] * mesh.extents[1])
        return "scaled"
    scale_uniform_to_height(mesh, TYPICAL_HEIGHT[a.type])
    return "typical"


def render(mesh: trimesh.Trimesh, target: Path, title: str) -> None:
    """Front, 3/4, side and top views (glTF Y-up) as one PNG."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    m = mesh if len(mesh.faces) <= 40000 else simplify(mesh.copy(), 40000)
    tri = m.vertices[m.faces][:, :, [0, 2, 1]].copy()  # Y-up to Z-up
    tri[:, :, 1] *= -1
    light = np.array([0.4, 0.8, 0.5]) / np.linalg.norm([0.4, 0.8, 0.5])
    shade = 0.35 + 0.65 * np.clip(m.face_normals @ light, 0, 1)
    lo, hi = tri.reshape(-1, 3).min(0), tri.reshape(-1, 3).max(0)
    c, r = (lo + hi) / 2, (hi - lo).max() / 2
    fig = plt.figure(figsize=(16, 4.4))
    for i, (label, elev, azim) in enumerate([("front", 5, -90), ("3/4", 15, -60), ("side", 5, 0), ("top", 89, -90)]):
        ax = fig.add_subplot(1, 4, i + 1, projection="3d")
        ax.add_collection3d(Poly3DCollection(tri, facecolors=plt.cm.Greys(1 - shade * 0.8), edgecolor="none"))
        ax.set_xlim(c[0] - r, c[0] + r)
        ax.set_ylim(c[1] - r, c[1] + r)
        ax.set_zlim(c[2] - r, c[2] + r)
        ax.view_init(elev, azim)
        ax.set_axis_off()
        ax.set_title(label)
    fig.suptitle(title, fontsize=16)
    fig.tight_layout()
    fig.savefig(target, dpi=70)
    plt.close(fig)


def finish_model(raw_glb: Path, out: Path, label: str, a: argparse.Namespace, rotate_y_deg: float = 0) -> dict:
    mesh = simplify(load_mesh(raw_glb), 50000)
    if rotate_y_deg:  # Tripo returns the piece turned 90 degrees (width along Z)
        mesh.apply_transform(trimesh.transformations.rotation_matrix(np.radians(rotate_y_deg), [0, 1, 0]))
    err = symmetry_error(mesh)
    if err <= SYMMETRY_MAX_ERROR:
        mesh = symmetrize(mesh)
    mode = size_mesh(mesh, a)
    mesh.export(out / f"{label}.stl")
    write_step_faceted(simplify(mesh.copy(), 15000), out / f"{label}.step", f"draft_{label}")
    render(mesh, out / f"{label}.png", f"Draft {label}")
    w, h, d = (round(x) for x in mesh.extents)
    return {"symmetry_error": round(err, 4), "symmetry": err <= SYMMETRY_MAX_ERROR, "size_mode": mode, "size_mm": [w, d, h]}


# ---------- phases ----------

def phase_cutout(a: argparse.Namespace) -> None:
    photo = Path(a.photo)
    if not photo.exists():
        sys.exit(f"Photo not found: {photo}")
    gate("cutout", [(f"Bria guided: only the {a.piece}", BRIA[1]), (f"SAM 3: {a.piece}", SAM3[1])], a)
    load_fal_key()
    out = EXP / a.name
    out.mkdir(parents=True, exist_ok=True)
    (out / f"photo{photo.suffix.lower()}").write_bytes(photo.read_bytes())
    url = upload(photo)

    bria = call(a.name, "bria", BRIA, {"image_url": url, "prompt": f"only the {a.piece}"})
    pad_square(Image.open(download(bria["image"]["url"], out / "bria_raw.png"))).save(out / "cutout_bria.png")

    sam = call(a.name, "sam3", SAM3, {
        "image_url": url, "prompt": a.piece, "apply_mask": False,
        "return_multiple_masks": True, "max_masks": 3, "include_scores": True,
    })
    scores = sam.get("scores") or [m.get("score", 0) for m in sam.get("metadata", [])] or [0]
    best = int(np.argmax(scores)) if sam.get("masks") else None
    if best is None:
        print("  SAM 3 found nothing.")
    else:
        mask = Image.open(download(sam["masks"][best]["url"], out / "sam_mask.png")).convert("L")
        rgba = Image.open(photo).convert("RGBA")
        rgba.putalpha(mask.resize(rgba.size).point(lambda v: 255 if v > 127 else 0))
        pad_square(rgba).save(out / "cutout_sam.png")

    save_state(a.name, {"piece": a.piece, "angle": a.angle, "photo": str(out / f"photo{photo.suffix.lower()}")})
    print(f"  Done. Compare {out}/cutout_bria.png and cutout_sam.png, then run the sheets phase with --use.")


def phase_sheets(a: argparse.Namespace) -> None:
    state = load_state(a.name)
    out = EXP / a.name
    cutout = out / f"cutout_{a.use}.png"
    if not cutout.exists():
        sys.exit(f"Missing {cutout}")
    seed = SEED + a.retry
    items = [(f"{m} sheet (seed {seed})", SHEET_MODELS[m][0][1]) for m in a.models]
    if a.import_sheet:
        items.append((f"import {Path(a.import_sheet).name} as sheet_{a.import_label}", 0.0))
    gate("sheets", items, a)
    hint = f" Note from the user: {a.hint.strip()}" if a.hint else ""
    prompt = SHEET_PROMPT.format(piece=state["piece"], hint=hint)
    print(f"  Prompt:\n{prompt}\n")

    sheets = {}
    if a.import_sheet:
        target = out / f"sheet_{a.import_label}.png"
        Image.open(a.import_sheet).convert("RGB").save(target)
        sheets[a.import_label] = target
    if a.models:
        load_fal_key()
        url = upload(cutout)
        for m in a.models:
            endpoint, build = SHEET_MODELS[m]
            result = call(a.name, f"{m} sheet", endpoint, build(prompt, url, seed))
            sheets[m] = download(result["images"][0]["url"], out / f"sheet_{m}.png")

    checks = state.setdefault("sheet_checks", {})
    for label, sheet in sheets.items():
        split_panels(sheet, out)
        checks[label] = check_sheet(sheet, cutout, state["angle"])
        print(f"  {label}: {'OK' if not checks[label] else '; '.join(checks[label])}")
    state.update({"cutout": a.use, "prompt": prompt})
    save_state(a.name, state)
    print("  Look at the sheets and panels before running models.")


def phase_models(a: argparse.Namespace) -> None:
    state = load_state(a.name)
    out = EXP / a.name
    cutout = out / f"cutout_{state['cutout']}.png"
    angle = state["angle"]
    runs = [p for p in ("A", "B", "D") if p not in a.skip]
    items = []
    if "A" in runs:
        items.append(("A: Hunyuan Pro, real cut-out only", HUNYUAN[1]))
    if "B" in runs:
        items.append((f"B: Hunyuan Pro multi-view ({a.b_sheet} panels)", HUNYUAN[1] + HUNYUAN_MULTIVIEW))
    if "D" in runs:
        items.append((f"D: Tripo multiview ({a.d_sheet} panels)", TRIPO[1]))
    gate("models", items, a)
    load_fal_key()
    import fal_client

    cut_url = upload(cutout)
    panel = lambda sheet, view: upload(out / f"sheet_{sheet}_{view}.png")  # noqa: E731
    jobs = {}
    if "A" in runs:
        jobs["A"] = (HUNYUAN, {"input_image_url": cut_url, "generate_type": "Geometry"}, 0.0)
    if "B" in runs:
        sb = a.b_sheet
        args = {"generate_type": "Geometry", "left_image_url": panel(sb, "left"),
                "back_image_url": panel(sb, "back"), "right_image_url": panel(sb, "right")}
        if angle == "front":
            args["input_image_url"] = cut_url
        else:  # keep the real 3/4 photo in its true 45-degree slot
            args["input_image_url"] = panel(sb, "front")
            args[f"{angle}_image_url"] = cut_url
        jobs["B"] = (HUNYUAN, args, HUNYUAN_MULTIVIEW)
    if "D" in runs:
        sd = a.d_sheet
        front = cut_url if angle == "front" else panel(sd, "front")
        jobs["D"] = (TRIPO, {
            "image_urls": [front, panel(sd, "left"), panel(sd, "back"), panel(sd, "right")],
            "texture": False, "pbr": False, "geometry_quality": "standard", "model_seed": SEED,
        }, 0.0)

    # Submit all, then collect, so they run in parallel on fal.
    handles = {k: fal_client.submit(ep[0], arguments=args) for k, (ep, args, _) in jobs.items()}
    for k, (ep, _, extra) in jobs.items():
        log_spend(a.name, f"model {k}", ep[1] + extra)

    key_path = out / "blind_key.json"
    key = json.loads(key_path.read_text()) if key_path.exists() else {}
    free = [x for x in ("X", "Y", "Z", "W", "V", "U") if x not in key]
    labels = random.Random(a.name + str(len(key))).sample(free, len(handles))
    results = state.get("models", {})
    for (k, handle), label in zip(handles.items(), labels):
        res = handle.get()
        mesh_url = (res.get("model_glb") or res.get("model_mesh") or {}).get("url")
        if not mesh_url:
            print(f"  {k}: no mesh in result: {list(res)}")
            continue
        raw = download(mesh_url, out / f"raw_{k}.glb")
        results[label] = finish_model(raw, out, label, a, rotate_y_deg=90 if k == "D" else 0)
        key[label] = f"{k} ({a.b_sheet if k == 'B' else a.d_sheet if k == 'D' else 'photo only'})"
        print(f"  draft {label}: {results[label]}")
    key_path.write_text(json.dumps(key, indent=2))  # do not show the reviewer
    state["models"] = results
    save_state(a.name, state)
    print(f"  Done. Send {out}/X|Y|Z .step/.stl/.png for the blind review. Key in blind_key.json.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="phase", required=True)

    def common(sp):
        sp.add_argument("--name", required=True, help="experiment folder name, e.g. table1")
        sp.add_argument("--yes", action="store_true", help="actually spend fal credits")
        sp.add_argument("--stop", type=float, default=11.0, help="refuse to pass this total spend (USD)")

    c = sub.add_parser("cutout")
    common(c)
    c.add_argument("--photo", required=True)
    c.add_argument("--piece", required=True, help='what to keep, e.g. "table"')
    c.add_argument("--angle", choices=ANGLES, default="front", help="angle of the photo")

    s = sub.add_parser("sheets")
    common(s)
    s.add_argument("--use", choices=("bria", "sam"), required=True, help="which cut-out to use")
    s.add_argument("--retry", type=int, default=0, help="seed offset for a second try")
    s.add_argument("--models", nargs="*", default=[], choices=tuple(SHEET_MODELS), help="image models to run")
    s.add_argument("--hint", help='what the photo does not show, e.g. "right end same as left"')
    s.add_argument("--import-sheet", help="use an existing sheet image (no cost)")
    s.add_argument("--import-label", default="imported")

    m = sub.add_parser("models")
    common(m)
    m.add_argument("--type", choices=tuple(TYPICAL_HEIGHT), required=True)
    m.add_argument("--w", type=float)
    m.add_argument("--d", type=float)
    m.add_argument("--h", type=float)
    m.add_argument("--skip", nargs="*", default=[], choices=("A", "B", "D"), help="pipelines to skip")
    m.add_argument("--b-sheet", default="nanopro", help="sheet label whose panels B uses")
    m.add_argument("--d-sheet", default="nanopro", help="sheet label whose panels D uses")

    a = p.parse_args()
    EXP.mkdir(exist_ok=True)
    {"cutout": phase_cutout, "sheets": phase_sheets, "models": phase_models}[a.phase](a)


if __name__ == "__main__":
    main()
