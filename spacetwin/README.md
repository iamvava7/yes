# SpaceTwin

> **Testing it for someone?** Start with [TESTING.md](TESTING.md).

Turn 360° panoramas into a walkable, measurable 3D tour, the way Matterport does,
using only a photo per capture point and a few clicks to trace each room.

```
npm install
npm run dev          # API on :3000 + Vite on :5173 (open http://localhost:5173)
npm run build && npm start   # production: one server on :3000
npm test             # geometry + API tests
npm run build && npm run test:e2e   # headless browser walkthrough, screenshots in test-e2e/screenshots/
npm run build && npm run test:capture   # simulated phone capture + stitching accuracy
npm run build && npm run test:tour      # tour page: listing, minimap, guided tour, share, phone sheet
```

## Best quality: the pro stitcher (optional, recommended)

With Python 3 and OpenCV installed, the server re-stitches every phone capture
the way desktop stitchers do: exposure compensation, a graph cut that routes
each seam around objects (so a chair or a door frame comes from one photo, not
a ghost of two), and multi-band blending. The phone still aligns the photos;
the server does the blending, which takes about a minute per spot on a laptop.

```
pip install opencv-python-headless numpy      # Windows: py -m pip install opencv-python-headless numpy
```

The server prints `Pro stitcher ready` when it finds it. Without it, everything
works with the built-in stitcher. `SPACETWIN_PYTHON` points at a specific
Python; `SPACETWIN_PRO_STITCH=0` turns it off. To compare the two stitchers on
a ray-traced hand-held capture with real parallax:
`python3 scripts/bench_frames.py /tmp/bench` (writes photos, poses and the true
panorama).

## Put a tour on a VerifiCasa listing

Open a tour, tap **Share** and copy **Link for a VerifiCasa listing**
(`https://<server>/3D/<id>`). Paste it into the listing's **Link Tur 3D**
field: the listing's "Tur 3D" tab shows the tour (360°, dollhouse, floor plan,
measuring) without repeating the listing details. The tour speaks Romanian on
Romanian phones and browsers; add `?lang=en` or `?lang=ro` to force one.

## Use it on your iPhone

Capture needs the camera and motion sensors, which iPhones only allow on
`https://` pages.

**Same Wi-Fi (quickest):**

```
npm install
npm run phone
```

Open the `https://192.168.…:5173` address it prints in Safari on your iPhone.
The certificate is self-signed, so Safari warns once: tap *Show Details* →
*visit this website*. Then use **Share → Add to Home Screen** to get an app
icon that opens full-screen.

**From anywhere:** run `npm run build && npm start`, then expose port 3000
with an HTTPS tunnel, e.g. `npx cloudflared tunnel --url http://localhost:3000`,
and open the `https://….trycloudflare.com` link on the phone.

### Capturing a spot

1. In a space, tap **Capture** and allow camera and motion access.
2. Aim the centre ring at each white dot and hold still; it shoots
   automatically (30 shots: a ring at eye level, one above, one below, then
   straight up and down).
3. The phone stitches the panorama, about half a minute, and shows a quality
   score. Save it, move 1.5–3 m, and capture the next spot.
4. In the editor, drag each spot to where it was taken, then trace rooms.

What makes captures good (the same rules Matterport's app enforces):

- **Rotate around the lens, not your body.** A tripod is best. Handheld,
  keep the phone in one place and step around it. Parallax from moving the
  lens is the main cause of seams.
- **Light everything evenly.** Turn on all lights and open the blinds. Avoid
  aiming at bright lamps.
- **Keep spots 1.5–3 m apart**, closer in hallways and doorways, and use the
  same phone height at each one.

Have a 360° camera (Insta360, Ricoh Theta…)? Export equirectangular photos
and use **Upload** instead; quality will be higher than phone capture.

## What's in a tour

- **Walk-through** with blended moves between spots, a floor-plan minimap with a view cone, and a room sign as you enter each room
- **Dollhouse and floor plan** views, true measurements, notes pinned to surfaces
- **Guided tour** that walks every spot and looks around on its own
- **Listing** beside the tour, like a property site: price, beds/baths, area from the measured rooms, description, rooms, floor plan, contact. It becomes a slide-up sheet on phones
- **Snapshots**, share link and embed code, quiet sound effects (can be muted)

Capture quality (phone only, no 360° camera needed):

- **No blur:** each dot grabs a 5-frame burst and keeps the sharpest (variance of the Laplacian); warns when turning too fast or holding the phone tilted
- **Accurate stitching:** lens field of view calibrated from the overlaps; every photo's rotation refined against its neighbours, anchored to the gyroscope
- **No visible seams:** exposure gain compensation, then two-band (multi-band) blending, the same techniques as OpenCV's stitcher
- **Natural finish:** gentle levels, white balance from white surfaces only, light sharpening

## How it works

| Matterport | SpaceTwin (phase 1) |
| --- | --- |
| Capture app drives a camera, one scan per spot | Guided phone capture: aim at dots, auto-shoot, align on the phone, blend with OpenCV on the server when installed (`web/src/capture/`, `server/pro_stitch.py`). Or upload one 2:1 panorama per spot from any 360° camera |
| On-site alignment of each scan | Drag scans onto the 2D plan, rotate with the heading handle |
| Cortex AI infers depth and room shape | **Trace room**: click the floor corners in the panorama. With the camera height known, each click is a ray hitting the floor plane, giving exact positions. One click on the ceiling corner gives the height |
| Textured 3D mesh | Room polygons are extruded into meshes and painted by projecting each panorama from its capture point (`web/src/viewer/projectionMaterial.js`) |
| Showcase: inside, dollhouse, floor plan | Same three modes, walk transitions that blend two panoramas, tags, measuring |
| Exports (E57/OBJ/floor plans) | OBJ mesh, dimensioned floor plan SVG, JSON |

Layout:

- `shared/geometry.js`: polygon maths, triangulation and room meshes (used by both server and browser)
- `server/`: Express API with file-based storage under `data/` (`DATA_DIR` to change), uploads, validation and exports
- `web/src/viewer/`: three.js viewer (modes, picking, transitions, measure, trace)
- `web/src/editor/PlanEditor.js`: 2D layout editor (place scans, draw and reshape rooms, snapping)
- `web/src/capture/`: phone capture. `geometry.js` converts gyroscope readings to camera orientation and defines the 30 shot targets. `stitch.js` calibrates the lens, aligns photos, balances exposure and blends on the GPU
- `scripts/make_sample.py`: renders the synthetic sample apartment, which also serves as measurement ground truth

Coordinates are metres with y up. Rooms are `[x, z]` polygons. Panorama u=0.5 looks toward −z, rotated by the scan's `heading`.

## Native iPhone app

`ios/` contains a SwiftUI app that captures with ARKit, so spots place
themselves on the plan, and scans rooms with Apple RoomPlan on LiDAR iPhones.
It talks to these server endpoints:

- `POST /api/spaces/:id/roomplan`: a RoomPlan `CapturedRoom` (JSON), converted to rooms
- `POST /api/spaces/:id/captures`: photos with ARKit poses, stitched on the server into a placed scan

See [ios/README.md](ios/README.md) to build it (needs a Mac with Xcode).
