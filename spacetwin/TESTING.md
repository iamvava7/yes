# Testing SpaceTwin

Thanks for helping. SpaceTwin turns phone photos of a home into a walkable 3D
tour with a floor plan, measurements and a property listing. You'll run it on
a computer and use it from an iPhone (or any phone) on the same Wi-Fi.

## What you need

- A computer (Windows, Mac or Linux) and a phone **on the same Wi-Fi**
  (not a guest network)
- [Node.js](https://nodejs.org) **20 or newer** (choose "LTS")
- [Git](https://git-scm.com/downloads)

## Start it (5 minutes)

Open a terminal and run these lines one at a time.

**Windows (PowerShell):**

```
cd $HOME
git clone -b spacetwin https://github.com/iamvava7/yes
cd yes\spacetwin
npm.cmd install
npm.cmd run phone
```

`cd $HOME` matters: PowerShell often opens in `C:\Windows\system32`, where
nothing can be saved ("Permission denied"). `npm.cmd` instead of `npm` avoids
the "running scripts is disabled on this system" error.

**Mac (Terminal):**

```
cd ~
git clone -b spacetwin https://github.com/iamvava7/yes
cd yes/spacetwin
npm install
npm run phone
```

It prints an address like `https://192.168.1.23:5173`. On the phone, open that
address in **Safari** (iPhone) or **Chrome** (Android).

The certificate is self-made, so the browser warns once:
- iPhone Safari: **Show Details → visit this website → Visit Website**
- Chrome: **Advanced → Proceed**

If the phone can't load the page: on Windows, allow Node.js on **Private
networks** when the firewall asks (the pop-up appears the first time), and
check that both devices are on the same Wi-Fi. If you missed the pop-up, search
Windows for "Allow an app through Windows Firewall" and tick Node.js.

To stop the app, press **Ctrl + C** in the terminal.

## What to try

Please note anything confusing, slow, broken or ugly, with the phone model.

**1. Look at a finished tour**
- Tap **Open sample**. Drag to look around; pinch to zoom.
- Tap the spot thumbnails, or the small floor-plan map at the top left, to move
  between rooms. A room name should slide in when you enter a room.
- Try **Dollhouse** and **Floor plan**, the **Tour** (play) button,
  **Snapshot**, **Share**, and **Measure** (tap two points).
- Pull up the white panel at the bottom: price, rooms, floor plan, contact.

**2. Capture a real room with the phone camera**
- Go back to the home page → **New property** → **Capture**.
- Allow camera and motion access.
- Stand in the middle of a room. Put the white ring on the orange dot and
  hold still until it shoots. Each photo appears in place around you. Turn
  around the phone rather than walking around. 28 dots, about a minute.
- At the end it offers the ceiling and the floor (optional); or tap **✓**.
  **↶** undoes the last photo.
- Watch it build the 360°, look around the result, and tap **Save spot**.
- Tap **Outline this room**: turn until the crosshair is on each floor corner
  and tap **Add corner**, then **Close room**, then aim at the ceiling above
  the first corner and tap **Set height**. You then see the 3D model and floor
  plan.
- Tell us: did it shoot easily? Did it ever get stuck? Are there visible
  seams, blur or ghosting? What did the quality chip say?

**3. Build the floor plan** (easier on the computer, at
`https://localhost:5173`)
- Open the property. Drag each spot on the plan to where it was taken.
- Stand in a room in the 3D view, pick **Trace room**, and tap each floor
  corner, then the ceiling above the first corner.
- Add **Listing details** (address, price…) and open **View tour**.

## Reporting

For each problem: what you did, what you expected, what happened, the phone
and browser, and a screenshot if you can. If something errors, copy what the
terminal printed.

## For developers

```
npm test                                   # unit and API tests
npm run build && npm run test:e2e          # browser walkthrough
npm run build && npm run test:tour         # tour page features
npm run build && npm run test:capture      # simulated phone capture + stitching accuracy
```

The browser tests use Chromium via `playwright-core`; set `CHROMIUM_PATH` to
your Chrome/Chromium executable if it isn't found.
