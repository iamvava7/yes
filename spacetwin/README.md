# SpaceTwin

Turn 360° panoramas into a walkable, measurable 3D tour, the way Matterport does,
using only a photo per capture point and a few clicks to trace each room.

```
npm install
npm run dev          # API on :3000 + Vite on :5173 (open http://localhost:5173)
npm run build && npm start   # production: one server on :3000
npm test             # geometry + API tests
npm run build && npm run test:e2e   # headless browser walkthrough, screenshots in test-e2e/screenshots/
npm run build && npm run test:capture   # simulated phone capture + stitching accuracy
```

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

## How it works

| Matterport | SpaceTwin (phase 1) |
| --- | --- |
| Capture app drives a camera, one scan per spot | Guided phone capture: aim at dots, auto-shoot, stitch on the phone (`web/src/capture/`). Or upload one 2:1 panorama per spot from any 360° camera |
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

## Phase 2: iOS capture app

The API is shaped so a native app can feed it:

1. **Capture (Swift, ARKit + RoomPlan, LiDAR iPhones/iPads).** `RoomCaptureSession` produces a `CapturedRoom` with walls, doors, windows and objects in metres. At each spot the app also captures a 360° panorama (either a stitched ARKit frame sweep or a connected Insta360/Ricoh camera) together with the ARKit camera pose. That gives position and heading automatically, with no manual placement.
2. **Upload.** `POST /api/spaces/:id/scans` with the panorama, then `PATCH` the scan with the pose from ARKit.
3. **Geometry.** A new `POST /api/spaces/:id/roomplan` endpoint converts `CapturedRoom` walls (dimensions plus 4×4 transforms) into room polygons and heights, and stores doors and windows for the plan.
4. Everything downstream (viewer, dollhouse, exports) works unchanged.
