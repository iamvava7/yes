# SpaceTwin for iPhone (native)

A native capture app for SpaceTwin. It does what the Safari capture does, plus
two things only a native app can:

- **Spots place themselves.** ARKit tracks where the phone is, not just which
  way it points, so every 360° spot is uploaded with its position. No dragging
  scans around the plan.
- **Rooms measure themselves** on iPhones with LiDAR (Pro models since the
  iPhone 12 Pro). Apple RoomPlan scans walls, doors and windows, and the
  server turns them into rooms. On other iPhones you trace rooms in the web
  editor as before.

Room scans and spots captured from the same space screen share one ARKit
session and therefore one coordinate system, so they line up automatically.
Capture a whole space in one visit: closing the app starts a new coordinate
system.

## Build and install

You need a Mac with Xcode 15 or newer and an iPhone on iOS 17 or newer.

```
brew install xcodegen
cd ios
xcodegen            # creates SpaceTwin.xcodeproj from project.yml
open SpaceTwin.xcodeproj
```

In Xcode, select the **SpaceTwin** target → *Signing & Capabilities*, choose
your team (a free Apple ID works for testing; apps signed that way expire after
7 days, a paid developer account lasts a year), and change the bundle
identifier if Xcode asks. Plug in the iPhone, pick it as the run destination,
and press Run. The first time, approve the developer on the phone under
*Settings → General → VPN & Device Management*.

> This code was written without access to Xcode, so it has not been compiled
> yet. If the first build reports errors, they are likely small API signature
> details; paste them back and they can be fixed quickly.

## Use it

1. On a computer on the same Wi-Fi, start the server: `npm run build && npm start`
   (from the `spacetwin` folder). Note the computer's local IP address.
2. In the app, enter `http://<that-ip>:3000` and pick or create a space.
3. **Scan a room** (LiDAR iPhones): walk the room slowly pointing at the walls,
   then tap Done. Repeat for each room.
4. Without leaving the space screen, **Capture a 360° spot**: aim the ring at
   each dot and hold still; it shoots automatically, 30 shots. It uploads when
   done, and the server stitches the panorama and places the spot.
5. **Open tour and editor** to walk through, measure and share.

## How it fits together

| File | Role |
| --- | --- |
| `SharedSession.swift` | The one ARKit session per visit; finds the floor level for camera height |
| `RoomScanView.swift` | RoomPlan scan on the shared session; uploads `CapturedRoom` JSON to `POST /api/spaces/:id/roomplan` |
| `SpotCaptureView.swift` | Aim-at-dots capture; each photo keeps `ARCamera.transform` and `.intrinsics`; uploads to `POST /api/spaces/:id/captures` |
| `CaptureTargets.swift` | The 30 shot directions, the same pattern as the web capture |
| `APIClient.swift` | HTTP calls and multipart upload |

The server side (`server/roomplan.js`, `server/stitch.js`) is covered by tests
in `test/roomplan.test.js` and `test/captures.test.js`, which feed it data in
exactly the formats this app sends.
