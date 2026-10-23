#!/usr/bin/env python3
"""Professional-grade panorama blending for posed photos, with OpenCV.

The JavaScript stitchers average overlapping photos. That is fine when every
photo was taken from exactly the same point, but a hand-held phone moves a few
centimetres between shots, so nearby objects (a chair, a door frame) land in
slightly different places in neighbouring photos and averaging them leaves
ghosts. This script does what desktop stitchers (Hugin, PTGui) and OpenCV's
stitching pipeline do instead:

  1. exposure: block-wise gain compensation, so brightness matches across
     overlaps without flattening the room's real light
  2. seams: a graph cut finds, in every overlap, the path where the two photos
     agree best, so each object comes from one photo only (no ghosts)
  3. blending: multi-band (Laplacian pyramid) blending across those seams, which
     hides the joins at every scale without blurring detail

The poses are already known (from ARKit, or from the browser's alignment), so
no feature matching is needed; each photo is projected straight into the
equirectangular panorama.

Input (JSON on stdin):
  { "width": 4096, "out": "/path/raw.rgba",
    "frames": [{ "path": "a.jpg", "transform": [16, column-major camera→world],
                 "intrinsics": [9, column-major, fx 0 0, 0 fy 0, cx cy 1] }] }
  Camera convention: looks down -z, x right, y up; pixel v grows downward.
Output: raw RGBA bytes (width × width/2) at "out"; alpha 0 marks pixels no photo
covered. Prints {"ok": true, ...} as JSON.

Panorama convention (shared with the viewer): row 0 looks straight up and
column x looks toward longitude ((x + 0.5) / W - 0.5) * 2π, where longitude 0 is
world -z and +π/2 is world +x.
"""
import json
import math
import sys

import cv2
import numpy as np

SEAM_WIDTH = 1024  # graph cut runs on a canvas about this wide (full size takes minutes)
GRID = 8  # footprint search step, canvas pixels


def load_frame(spec, target_px_per_rad):
    img = cv2.imread(spec["path"], cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"cannot read {spec['path']}")
    m = np.asarray(spec["transform"], dtype=np.float64).reshape(4, 4).T  # column-major → row-major
    k = np.asarray(spec["intrinsics"], dtype=np.float64).reshape(3, 3).T
    fx, fy, cx, cy = k[0, 0], k[1, 1], k[0, 2], k[1, 2]
    if not (fx > 0 and fy > 0):
        raise ValueError("intrinsics need positive focal lengths")
    # Shrink photos that are much sharper than the panorama with area
    # averaging first; remapping alone would alias (shimmering edges, moiré).
    scale = min(1.0, 1.25 * target_px_per_rad / fx)
    if scale < 0.999:
        h, w = img.shape[:2]
        nw, nh = max(2, round(w * scale)), max(2, round(h * scale))
        img = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
        sx, sy = nw / w, nh / h
        fx, cx, fy, cy = fx * sx, (cx + 0.5) * sx - 0.5, fy * sy, (cy + 0.5) * sy - 0.5
    return {"img": img, "R": m[:3, :3], "fx": fx, "fy": fy, "cx": cx, "cy": cy}


def directions(xs, ys, width, height):
    """World unit vectors for canvas pixel centres (xs relative to panorama column 0)."""
    lon = ((xs + 0.5) / width - 0.5) * 2 * math.pi
    lat = (0.5 - (ys + 0.5) / height) * math.pi
    cl = np.cos(lat)
    return np.stack([cl * np.sin(lon), np.sin(lat) * np.ones_like(lon), -cl * np.cos(lon)], axis=-1)


def project(f, d):
    """Pixel coordinates of world directions in a frame; NaN where the frame does not see them."""
    c = d @ f["R"]  # world → camera is R^T, applied to row vectors
    h, w = f["img"].shape[:2]
    with np.errstate(divide="ignore", invalid="ignore"):
        u = f["cx"] + f["fx"] * c[..., 0] / -c[..., 2]
        v = f["cy"] - f["fy"] * c[..., 1] / -c[..., 2]
    ok = (c[..., 2] < -1e-6) & (u >= 0) & (v >= 0) & (u <= w - 1) & (v <= h - 1)
    return np.where(ok, u, np.nan).astype(np.float32), np.where(ok, v, np.nan).astype(np.float32)


def warp(f, width, height, pad):
    """Project a frame onto the padded canvas; returns (corner, image, mask) or None."""
    wc = width + 2 * pad
    gy, gx = np.mgrid[0:height:GRID, 0:wc:GRID]
    u, _ = project(f, directions(gx - pad, gy, width, height))
    hit = ~np.isnan(u)
    if not hit.any():
        return None
    rows, cols = np.where(hit.any(axis=1))[0], np.where(hit.any(axis=0))[0]
    y0, y1 = max(0, rows[0] * GRID - GRID), min(height, rows[-1] * GRID + 2 * GRID)
    x0, x1 = max(0, cols[0] * GRID - GRID), min(wc, cols[-1] * GRID + 2 * GRID)
    ys, xs = np.mgrid[y0:y1, x0:x1]
    u, v = project(f, directions((xs - pad).astype(np.float64), ys.astype(np.float64), width, height))
    mask = ~np.isnan(u)
    if mask.sum() < 64:
        return None
    u[~mask] = -1
    v[~mask] = -1
    img = cv2.remap(f["img"], u, v, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    # keep a one-pixel margin off the photo's border, where cubic sampling smears
    mask8 = cv2.erode(mask.astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
    return (int(x0), int(y0)), extend(img, mask8 > 0), mask8


def extend(img, valid):
    """Fill pixels outside `valid` with a smooth continuation of the photo.

    Multi-band blending builds image pyramids over each photo's whole bounding
    box; black outside the photo would bleed into the coarse bands and show up
    as bright or dark halos along the seams. Push-pull: average down to coarse
    levels using only valid pixels, then fill each level's gaps from the level
    below it.
    """
    levels = [(img.astype(np.float32) * valid[..., None], valid.astype(np.float32))]
    while min(levels[-1][1].shape) > 4:
        c, w = levels[-1]
        levels.append((cv2.pyrDown(c), cv2.pyrDown(w)))
    c, w = levels[-1]
    filled = c / np.maximum(w, 1e-6)[..., None]
    filled[w <= 1e-6] = (c.reshape(-1, 3).sum(0) / max(w.sum(), 1e-6))
    for c, w in reversed(levels[:-1]):
        up = cv2.resize(filled, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_LINEAR)
        own = c / np.maximum(w, 1e-6)[..., None]
        a = np.clip(w, 0, 1)[..., None]
        filled = own * a + up * (1 - a)
    out = img.copy()
    out[~valid] = np.clip(filled[~valid] + 0.5, 0, 255).astype(np.uint8)
    return out


def stitch(spec):
    width = int(spec.get("width", 4096))
    height = width // 2
    px_per_rad = width / (2 * math.pi)
    frames = [load_frame(f, px_per_rad) for f in spec["frames"]]
    # canvas padding: enough for the widest photo, so seams and pyramids near
    # longitude ±180° see their neighbours on both sides
    pad = min(width // 4, max(64, int(max(f["img"].shape[1] * px_per_rad / f["fx"] for f in frames))))
    warped = [w for w in (warp(f, width, height, pad) for f in frames) if w is not None]
    if len(warped) < 2:
        raise ValueError("fewer than two photos land in the panorama")
    corners = [w[0] for w in warped]
    images = [w[1] for w in warped]
    masks = [w[2] for w in warped]

    # 1. exposure
    # one gain per photo: phones change exposure between shots; block-wise gains
    # also "correct" real light falloff on plain walls into blotches
    comp = cv2.detail.ExposureCompensator_createDefault(cv2.detail.ExposureCompensator_GAIN)
    comp.feed(corners=corners, images=[cv2.UMat(i) for i in images], masks=[cv2.UMat(m) for m in masks])
    images = [comp.apply(i, corners[i], images[i], masks[i]) for i in range(len(images))]
    images = [i.get() if isinstance(i, cv2.UMat) else i for i in images]

    # 2. seams, on a small copy (graph cuts are expensive), then scaled back up
    s = min(1.0, SEAM_WIDTH / (width + 2 * pad))
    small_imgs, small_masks, small_corners = [], [], []
    for (x, y), img, m in zip(corners, images, masks):
        sw, sh = max(1, round(img.shape[1] * s)), max(1, round(img.shape[0] * s))
        small_imgs.append(cv2.resize(img, (sw, sh), interpolation=cv2.INTER_AREA).astype(np.float32))
        small_masks.append(cv2.UMat(cv2.resize(m, (sw, sh), interpolation=cv2.INTER_NEAREST)))
        small_corners.append((round(x * s), round(y * s)))
    finder = cv2.detail_GraphCutSeamFinder("COST_COLOR_GRAD")
    seam_masks = finder.find(small_imgs, small_corners, small_masks)
    # 3. multi-band blending
    blend_width = math.sqrt(width * height) * 0.05
    bands = max(1, int(math.ceil(math.log2(blend_width))) - 1)
    blender = cv2.detail_MultiBandBlender(0, bands)
    blender.prepare((0, 0, width + 2 * pad, height))
    kernel = np.ones((3, 3), np.uint8)
    for i, ((x, y), img, m) in enumerate(zip(corners, images, masks)):
        seam = seam_masks[i].get() if isinstance(seam_masks[i], cv2.UMat) else seam_masks[i]
        seam = cv2.resize(cv2.dilate(seam, kernel), (m.shape[1], m.shape[0]), interpolation=cv2.INTER_LINEAR)
        blender.feed(img.astype(np.int16), cv2.bitwise_and(seam, m), (x, y))
    result, result_mask = blender.blend(None, None)
    result = np.clip(result, 0, 255).astype(np.uint8)

    # crop the padding; cross-fade the last columns into the left pad (the same
    # longitudes, computed next to column 0) so the panorama wraps seamlessly
    out = result[:, pad:pad + width].astype(np.float32)
    covered = (result_mask[:, pad:pad + width] > 0).astype(np.float32)
    fade = pad // 2
    for k in range(fade):
        x, left = width - fade + k, pad - fade + k
        has_left = (result_mask[:, left] > 0).astype(np.float32)
        # where only one of the two copies saw anything, take that one
        a = np.where(covered[:, x] > 0, (k + 0.5) / fade * has_left, has_left)
        out[:, x] = out[:, x] * (1 - a[:, None]) + result[:, left].astype(np.float32) * a[:, None]
        covered[:, x] = np.maximum(covered[:, x], has_left)

    rgba = np.empty((height, width, 4), np.uint8)
    rgba[..., :3] = cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_BGR2RGB)
    rgba[..., 3] = (covered > 0) * 255
    rgba[rgba[..., 3] == 0, :3] = 0
    with open(spec["out"], "wb") as fh:
        fh.write(rgba.tobytes())
    return {"ok": True, "width": width, "height": height, "photos": len(warped), "coverage": float(covered.mean())}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        print(json.dumps({"ok": True, "opencv": cv2.__version__}))
        return
    try:
        print(json.dumps(stitch(json.load(sys.stdin))))
    except Exception as err:  # reported to the caller, which falls back to the JS stitcher
        print(json.dumps({"ok": False, "error": f"{type(err).__name__}: {err}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
