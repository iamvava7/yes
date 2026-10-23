"""Render a realistic hand-held phone capture of the sample living room.

Unlike the browser capture test, which cuts photos out of a finished panorama
(so every photo is taken from exactly the same point), these photos are ray
traced from where a phone's lens really is while someone turns it in their
hand: a few centimetres in front of the turning point, plus a little wobble.
A floor lamp stands 0.9 m away, so overlapping photos disagree about where it
is (parallax), exactly what makes real stitches ghost.

Writes <out>/frame-NN.jpg, <out>/meta.json (poses in the /captures format) and
<out>/truth.jpg (the panorama seen from the turning point).

Usage: python3 scripts/bench_frames.py <out_dir> [--seed N] [--lens-offset M]
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

from make_sample import ROOMS, shade

FW, FH = 1080, 1440  # portrait phone photo
VFOV = 65.0
SS = 2
LAMP = {"x": 2.6, "z": 1.5, "r": 0.06, "h": 1.7, "rgb": (0.15, 0.15, 0.17)}


def scene(origin, d):
    room = ROOMS[0]
    img = shade(room, origin, d[..., 0], d[..., 1], d[..., 2])
    # vertical cylinder (the lamp pole) with a shade on top
    ox, oy, oz = origin
    a = d[..., 0] ** 2 + d[..., 2] ** 2
    bx, bz = ox - LAMP["x"], oz - LAMP["z"]
    b = 2 * (bx * d[..., 0] + bz * d[..., 2])
    c = bx * bx + bz * bz - LAMP["r"] ** 2
    disc = b * b - 4 * a * c
    with np.errstate(invalid="ignore", divide="ignore"):
        t = (-b - np.sqrt(disc)) / (2 * a)
    y = oy + t * d[..., 1]
    hit = (disc > 0) & (t > 0) & (y > 0) & (y < LAMP["h"])
    stripe = (np.floor(y / 0.25) % 2 == 0)[..., None]
    pole = np.where(stripe, np.array(LAMP["rgb"]), np.array((0.85, 0.35, 0.2)))
    return np.where(hit[..., None], pole, img)


def targets():
    out = [(yaw, 0.0) for yaw in range(0, 360, 30)]
    for pitch in (48.0, -48.0):
        out += [(yaw + 22.5, pitch) for yaw in range(0, 360, 45)]
    return out + [(0.0, 78.0), (180.0, -78.0)]


def rotation(yaw, pitch, roll):
    y, p, r = (math.radians(v) for v in (yaw, pitch, roll))
    fwd = np.array([math.cos(p) * math.sin(y), math.sin(p), -math.cos(p) * math.cos(y)])
    right = np.array([math.cos(y), 0.0, math.sin(y)])
    up = np.cross(right, fwd)
    # roll about the viewing axis
    right, up = right * math.cos(r) + up * math.sin(r), up * math.cos(r) - right * math.sin(r)
    return np.stack([right, up, -fwd], axis=1)  # columns: camera x, y, z in world


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--lens-offset", type=float, default=0.07)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(args.seed)
    s = ROOMS[0]["scan"]
    centre = np.array([s["x"], s["cameraHeight"], s["z"]])
    fy = (FH / 2) / math.tan(math.radians(VFOV) / 2)
    fx = fy
    cx, cy = FW / 2 - 0.5, FH / 2 - 0.5
    jj, ii = np.meshgrid((np.arange(FW * SS) + 0.5) / SS - 0.5, (np.arange(FH * SS) + 0.5) / SS - 0.5)
    cam = np.stack([(jj - cx) / fx, -(ii - cy) / fy, -np.ones_like(jj)], axis=-1)
    cam /= np.linalg.norm(cam, axis=-1, keepdims=True)
    frames = []
    for n, (yaw, pitch) in enumerate(targets()):
        R = rotation(yaw + rng.normal(0, 2), pitch + rng.normal(0, 2), rng.normal(0, 1.5))
        lens = centre + R @ np.array([0, 0, -args.lens_offset]) + rng.normal(0, 0.015, 3)
        img = scene(tuple(lens), cam @ R.T).reshape(FH, SS, FW, SS, 3).mean(axis=(1, 3))
        name = f"frame-{n:02d}.jpg"
        Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out / name, quality=92)
        m = np.eye(4)
        m[:3, :3] = R
        m[:3, 3] = lens
        k = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]])
        frames.append({"file": name, "transform": m.T.flatten().tolist(), "intrinsics": k.T.flatten().tolist()})
    (out / "meta.json").write_text(json.dumps({"frames": frames}, indent=1))
    # ground truth from the turning point, 2048 wide
    W, H = 2048, 1024
    u = (np.arange(W * SS) + 0.5) / (W * SS)
    v = (np.arange(H * SS) + 0.5) / (H * SS)
    uu, vv = np.meshgrid(u, v)
    lon, lat = (uu - 0.5) * 2 * np.pi, (0.5 - vv) * np.pi
    d = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), -np.cos(lat) * np.cos(lon)], axis=-1)
    truth = scene(tuple(centre), d).reshape(H, SS, W, SS, 3).mean(axis=(1, 3))
    Image.fromarray((np.clip(truth, 0, 1) * 255).astype(np.uint8)).save(out / "truth.jpg", quality=95)
    print(f"wrote {len(frames)} photos to {out}")


if __name__ == "__main__":
    main()
