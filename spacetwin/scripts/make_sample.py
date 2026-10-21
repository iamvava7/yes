"""Render synthetic equirectangular panoramas of box rooms with known dimensions.

The output doubles as demo content and as ground truth for measurement tests:
floor tiles are exactly 1 m, so distances measured in the viewer can be checked
by eye. Projection convention matches web/src/viewer/projectionMaterial.js:
u = 0.5 + atan2(d.x, -d.z) / 2pi, v (up) = 0.5 + asin(d.y) / pi.

Usage: python3 scripts/make_sample.py <out_dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 4096, 2048
SS = 2  # supersampling factor; edges are rendered at SS× and averaged down
STRIP = 128  # output rows rendered per pass, to bound memory

ROOMS = [
    {
        "name": "Living room",
        "box": (0.0, 5.0, 0.0, 4.0),  # x0, x1, z0, z1
        "height": 2.7,
        "scan": {"name": "Living room", "x": 2.0, "z": 2.2, "cameraHeight": 1.5},
        "walls": {"x0": (0.93, 0.89, 0.80), "x1": (0.86, 0.90, 0.93), "z0": (0.91, 0.86, 0.84), "z1": (0.88, 0.91, 0.85)},
        "floor": ((0.62, 0.45, 0.30), (0.55, 0.39, 0.25)),
    },
    {
        "name": "Bedroom",
        "box": (5.0, 8.5, 0.0, 4.0),
        "height": 2.7,
        "scan": {"name": "Bedroom", "x": 6.8, "z": 1.8, "cameraHeight": 1.5},
        "walls": {"x0": (0.80, 0.86, 0.92), "x1": (0.92, 0.88, 0.94), "z0": (0.85, 0.92, 0.88), "z1": (0.94, 0.90, 0.82)},
        "floor": ((0.70, 0.70, 0.72), (0.62, 0.62, 0.65)),
    },
]

# Features painted on walls: (wall, u_from, u_to, y_from, y_to, rgb) where u is
# the horizontal world coordinate along the wall (x for z-walls, z for x-walls).
FEATURES = {
    "Living room": [
        ("z0", 1.2, 3.6, 0.9, 2.2, (0.62, 0.80, 0.95)),   # window
        ("x1", 2.5, 3.4, 0.0, 2.1, (0.55, 0.38, 0.24)),   # door to bedroom
        ("z1", 0.6, 2.6, 0.0, 0.8, (0.30, 0.36, 0.48)),   # sofa
        ("x0", 1.0, 2.6, 1.3, 2.0, (0.85, 0.55, 0.35)),   # painting
    ],
    "Bedroom": [
        ("x0", 2.5, 3.4, 0.0, 2.1, (0.55, 0.38, 0.24)),   # door to living room
        ("z1", 0.6, 2.4, 0.0, 0.6, (0.92, 0.92, 0.95)),   # bed
        ("x1", 1.0, 3.0, 1.0, 2.1, (0.62, 0.80, 0.95)),   # window
        ("z0", 2.4, 3.3, 0.0, 1.9, (0.65, 0.52, 0.40)),   # wardrobe
    ],
}


def render(room):
    rows = []
    for r0 in range(0, H, STRIP):
        rows.append(render_rows(room, r0, min(H, r0 + STRIP)))
    img = np.concatenate(rows, axis=0)
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def render_rows(room, r0, r1):
    """Render output rows [r0, r1) at SS× resolution and box-filter them down."""
    x0, x1, z0, z1 = room["box"]
    h = room["height"]
    s = room["scan"]
    cx, cy, cz = s["x"], s["cameraHeight"], s["z"]

    u = (np.arange(W * SS) + 0.5) / (W * SS)
    v = 1.0 - (np.arange(r0 * SS, r1 * SS) + 0.5) / (H * SS)
    uu, vv = np.meshgrid(u, v)
    lon = (uu - 0.5) * 2 * np.pi
    lat = (vv - 0.5) * np.pi
    dx = np.cos(lat) * np.sin(lon)
    dy = np.sin(lat)
    dz = -np.cos(lat) * np.cos(lon)

    def exit_t(d, c, lo, hi):
        with np.errstate(divide="ignore"):
            t = np.where(d > 0, (hi - c) / d, (lo - c) / d)
        return np.where(np.abs(d) < 1e-9, np.inf, t)

    tx = exit_t(dx, cx, x0, x1)
    ty = exit_t(dy, cy, 0.0, h)
    tz = exit_t(dz, cz, z0, z1)
    t = np.minimum(np.minimum(tx, ty), tz)
    px, py, pz = cx + dx * t, cy + dy * t, cz + dz * t

    img = np.zeros(uu.shape + (3,))
    hit_floor = (t == ty) & (dy < 0)
    hit_ceil = (t == ty) & (dy > 0)
    hit_x = (t == tx) & ~hit_floor & ~hit_ceil
    hit_z = (t == tz) & ~hit_floor & ~hit_ceil & ~hit_x

    # Floor: 1 m checkerboard with grout lines.
    fa, fb = (np.array(c) for c in room["floor"])
    checker = ((np.floor(px) + np.floor(pz)) % 2 == 0)[..., None]
    img = np.where(hit_floor[..., None], np.where(checker, fa, fb), img)
    grout = (np.minimum(px % 1, 1 - px % 1) < 0.01) | (np.minimum(pz % 1, 1 - pz % 1) < 0.01)
    img = np.where((hit_floor & grout)[..., None], fa * 0.6, img)

    # Ceiling with a round lamp in the middle.
    lamp = (px - (x0 + x1) / 2) ** 2 + (pz - (z0 + z1) / 2) ** 2 < 0.25 ** 2
    img = np.where(hit_ceil[..., None], np.array([0.97, 0.97, 0.96]), img)
    img = np.where((hit_ceil & lamp)[..., None], np.array([1.0, 0.95, 0.75]), img)

    walls = room["walls"]
    xwall = np.where(dx > 0, 1, 0)
    zwall = np.where(dz > 0, 1, 0)
    for side, color in walls.items():
        if side[0] == "x":
            mask = hit_x & (xwall == (1 if side == "x1" else 0))
            along = pz - z0
        else:
            mask = hit_z & (zwall == (1 if side == "z1" else 0))
            along = px - x0
        img = np.where(mask[..., None], np.array(color), img)
        for wall, a0, a1, y0, y1, rgb in FEATURES[room["name"]]:
            if wall != side:
                continue
            fmask = mask & (along >= a0) & (along <= a1) & (py >= y0) & (py <= y1)
            img = np.where(fmask[..., None], np.array(rgb), img)

    # Darken edges where surfaces meet so corners are easy to trace.
    near = sum(
        ((np.abs(c - lo) < 0.012) | (np.abs(c - hi) < 0.012)).astype(int)
        for c, lo, hi in ((px, x0, x1), (pz, z0, z1), (py, 0.0, h))
    )
    img = np.where((near >= 2)[..., None], img * 0.45, img)

    # Soft distance shading for depth cues.
    img = img * (1.0 - np.clip(t / 25.0, 0, 0.25))[..., None]
    n = r1 - r0
    return img.reshape(n, SS, W, SS, 3).mean(axis=(1, 3))


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/sample")
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"name": "Sample apartment", "scans": [], "rooms": []}
    for i, room in enumerate(ROOMS):
        fname = f"scan-{i + 1}.jpg"
        render(room).save(out / fname, quality=88)
        s = room["scan"]
        manifest["scans"].append({
            "file": fname, "name": s["name"], "position": {"x": s["x"], "z": s["z"]},
            "cameraHeight": s["cameraHeight"], "heading": 0,
        })
        x0, x1, z0, z1 = room["box"]
        manifest["rooms"].append({
            "name": room["name"], "height": room["height"],
            "points": [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
        })
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"wrote {len(ROOMS)} panoramas to {out}")


if __name__ == "__main__":
    main()
