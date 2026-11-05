"""Pilot pipeline: photo(s) + real size -> Inventor-ready reference mesh.

Steps: optional background removal (Bria) -> Hunyuan 3D v3.1 Pro, geometry only
-> symmetry -> stretch to W x D x H -> measurement checks -> GLB/STL/OBJ (+STEP)
-> preview -> one row in pilot-jobs.csv.

Usage:
  .venv-cad/bin/python scripts/pilot.py --name lounge01 --front a.jpg \
      [--back b.jpg --left c.jpg --right d.jpg] --w 800 --d 850 --h 780 \
      [--seat 420 --arm 600] [--background] [--no-symmetry] [--step] \
      [--variants 2] [--yes]

Without --yes it only prints the estimated cost. Billable runs need --yes.
Outputs go to send/<name>/. Coordinates: Y up, X = width, Z = depth, mm.
"""
import argparse
import csv
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import trimesh

sys.path.insert(0, str(Path(__file__).parent))
from mesh_to_cad import load_mesh, simplify, write_step  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "pilot-jobs.csv"
BG_ENDPOINT = "fal-ai/bria/background/remove"
MODEL_ENDPOINT = "fal-ai/hunyuan-3d/v3.1/pro/image-to-3d"
# Prices from fal model pages, checked 2026-11-05.
PRICE_BG, PRICE_MODEL, PRICE_MULTIVIEW = 0.018, 0.375, 0.15
STRETCH_WARN = 0.10  # warn when an axis needs more than 10% stretch


def load_fal_key() -> None:
    """Read FAL_KEY from .env.local into the environment without printing it."""
    if os.environ.get("FAL_KEY"):
        return
    env_file = ROOT / ".env.local"
    for line in env_file.read_text().splitlines():
        if line.startswith("FAL_KEY="):
            os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip("'\"")
            return
    sys.exit("FAL_KEY is absent from .env.local")


def download(url: str, target: Path) -> Path:
    with urllib.request.urlopen(url) as response:
        target.write_bytes(response.read())
    return target


SYMMETRY_MAX_ERROR = 0.02  # mean mirror mismatch as a fraction of the largest size


def symmetry_error(mesh: trimesh.Trimesh) -> float:
    """How far the mesh is from left/right (X) mirror symmetry, relative to its size."""
    from scipy.spatial import cKDTree

    v = mesh.vertices - mesh.bounds.mean(axis=0)
    mirrored = v * [-1, 1, 1]
    return float(cKDTree(v).query(mirrored)[0].mean() / mesh.extents.max())


def symmetrize(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Keep the +X half and mirror it to -X. Assumes left/right symmetry about X=0."""
    centre_x = (mesh.bounds[0][0] + mesh.bounds[1][0]) / 2
    mesh.apply_translation([-centre_x, 0, 0])
    half = mesh.slice_plane(plane_origin=[0, 0, 0], plane_normal=[1, 0, 0])
    mirrored = half.copy()
    # trimesh already reverses the face winding for a mirror transform, so the
    # normals stay outward; do not invert() again.
    mirrored.apply_transform(np.diag([-1.0, 1.0, 1.0, 1.0]))
    return trimesh.util.concatenate([half, mirrored])


def stretch_to_size(mesh: trimesh.Trimesh, w: float, d: float, h: float) -> dict:
    """Scale each axis to the real size; report stretch relative to a height-only scale."""
    ex, ey, ez = mesh.extents
    uniform = h / ey
    sx, sy, sz = w / ex, h / ey, d / ez
    mesh.apply_scale([sx, sy, sz])
    lo, hi = mesh.bounds
    mesh.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    return {"stretch_w": sx / uniform - 1, "stretch_d": sz / uniform - 1}


def upward_surface_heights(mesh: trimesh.Trimesh, bin_mm: float = 10.0) -> list:
    """Heights (mm) of the largest upward-facing surfaces, biggest first."""
    up = mesh.face_normals[:, 1] > 0.9
    heights = mesh.triangles_center[up][:, 1]
    areas = mesh.area_faces[up]
    if len(heights) == 0:
        return []
    bins = np.floor(heights / bin_mm).astype(int)
    totals = {}
    for b, a in zip(bins, areas):
        totals[b] = totals.get(b, 0.0) + a
    return [(b + 0.5) * bin_mm for b, _ in sorted(totals.items(), key=lambda kv: -kv[1])]


def check_measurements(mesh: trimesh.Trimesh, seat: float | None, arm: float | None) -> dict:
    """Estimate seat and arm heights from flat upward surfaces and compare to real values."""
    h = mesh.extents[1]
    candidates = [y for y in upward_surface_heights(mesh) if 0.05 * h < y < 0.95 * h]
    result = {}
    if seat and candidates:
        est = min(candidates[:5], key=lambda y: abs(y - seat))
        result["seat_est_mm"] = round(est)
        result["seat_err_mm"] = round(est - seat)
    if arm and candidates:
        above = [y for y in candidates[:8] if y > (seat or 0) + 50]
        if above:
            est = min(above, key=lambda y: abs(y - arm))
            result["arm_est_mm"] = round(est)
            result["arm_err_mm"] = round(est - arm)
    return result


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--front", required=True, type=Path)
    p.add_argument("--back", type=Path)
    p.add_argument("--left", type=Path)
    p.add_argument("--right", type=Path)
    p.add_argument("--w", type=float, required=True, help="width mm")
    p.add_argument("--d", type=float, required=True, help="depth mm")
    p.add_argument("--h", type=float, required=True, help="height mm")
    p.add_argument("--seat", type=float, help="real seat height mm (check only)")
    p.add_argument("--arm", type=float, help="real arm height mm (check only)")
    p.add_argument("--background", action="store_true", help="photos have a background to remove")
    p.add_argument("--no-symmetry", action="store_true")
    p.add_argument("--step", action="store_true", help="also write a faceted STEP")
    p.add_argument("--variants", type=int, default=1)
    p.add_argument("--faces", type=int, default=50000)
    p.add_argument("--yes", action="store_true")
    a = p.parse_args()

    views = {k: v for k, v in {"front": a.front, "back": a.back, "left": a.left, "right": a.right}.items() if v}
    multiview = len(views) > 1
    per_variant = PRICE_MODEL + (PRICE_MULTIVIEW if multiview else 0)
    cost = a.variants * per_variant + (PRICE_BG * len(views) if a.background else 0)
    print(f"{a.name}: {len(views)} view(s), {a.variants} variant(s), estimated ${cost:.2f}")
    if not a.yes:
        print("Dry run. Add --yes to spend the credits.")
        return

    load_fal_key()
    import fal_client  # imported after FAL_KEY is set

    out = ROOT / "send" / a.name
    out.mkdir(parents=True, exist_ok=True)
    started = time.time()

    urls = {}
    for view, path in views.items():
        url = fal_client.upload_file(str(path))
        if a.background:
            url = fal_client.subscribe(BG_ENDPOINT, arguments={"image_url": url})["image"]["url"]
            download(url, out / f"{view}_cutout.png")
        urls[view] = url

    arguments = {"input_image_url": urls["front"], "generate_type": "Geometry"}
    for view in ("back", "left", "right"):
        if view in urls:
            arguments[f"{view}_image_url"] = urls[view]

    rows = []
    for v in range(1, a.variants + 1):
        tag = a.name if a.variants == 1 else f"{a.name}_v{v}"
        handle = fal_client.submit(MODEL_ENDPOINT, arguments=arguments)
        result = handle.get()
        raw = download(result["model_glb"]["url"], out / f"{tag}_raw.glb")
        if result.get("thumbnail"):
            download(result["thumbnail"]["url"], out / f"{tag}_preview.png")

        mesh = simplify(load_mesh(raw), a.faces)
        sym_err = symmetry_error(mesh)
        symmetric = not a.no_symmetry and sym_err <= SYMMETRY_MAX_ERROR
        if symmetric:
            mesh = symmetrize(mesh)
        elif not a.no_symmetry:
            print(f"Symmetry skipped: piece looks asymmetric (error {sym_err:.3f}).")
        stretch = stretch_to_size(mesh, a.w, a.d, a.h)
        checks = check_measurements(mesh, a.seat, a.arm)

        mesh.export(out / f"{tag}.glb")
        mesh.export(out / f"{tag}.stl")
        mesh.export(out / f"{tag}.obj")
        if a.step:
            write_step(mesh, out / f"{tag}.step")
        raw.unlink()  # keep the folder small; the raw model stays on fal

        warn = [k for k, s in stretch.items() if abs(s) > STRETCH_WARN]
        row = {
            "date": dt.date.today().isoformat(), "name": tag, "views": len(views),
            "background_removed": a.background, "symmetry": symmetric, "symmetry_error": round(sym_err, 4),
            "w": a.w, "d": a.d, "h": a.h,
            "stretch_w_pct": round(stretch["stretch_w"] * 100, 1),
            "stretch_d_pct": round(stretch["stretch_d"] * 100, 1),
            **checks, "faces": len(mesh.faces), "request_id": handle.request_id,
            "cost_usd": round(per_variant + (PRICE_BG * len(views) if a.background and v == 1 else 0), 3),
            "minutes": round((time.time() - started) / 60, 1),
            "feedback_rating": "", "feedback_hours_saved": "", "feedback_comment": "",
        }
        rows.append(row)
        print(json.dumps(row))
        if warn:
            print(f"WARNING: big stretch on {', '.join(warn)}; the AI may have misread the shape.")

    fields = list(dict.fromkeys(k for r in rows for k in r))
    existing = list(csv.DictReader(LOG.open())) if LOG.exists() else []
    fields = list(dict.fromkeys([*(existing[0].keys() if existing else []), *fields]))
    with LOG.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows([*existing, *rows])

    budget = float(os.environ.get("FAL_BUDGET_USD", "0") or 0)
    spent = sum(float(r.get("cost_usd") or 0) for r in [*existing, *rows])
    print(f"Logged to {LOG.name}. Pilot spend so far: ${spent:.2f}")
    if budget and budget - spent < 3:
        print(f"WARNING: under $3 left of FAL_BUDGET_USD=${budget:.2f}. Top up at https://fal.ai/dashboard/usage-billing/credits")
    print(f"Files in {out}")


if __name__ == "__main__":
    main()
