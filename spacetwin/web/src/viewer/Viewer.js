import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bestScanForRoom, bounds, centroid, normalizePolygon, pointInPolygon, polygonArea, roomMesh } from '../../../shared/geometry.js';
import { sfx } from '../sound.js';
import { configurePanoTexture, createProjectionMaterial, setProjection } from './projectionMaterial.js';

const DEG = Math.PI / 180;
const CLICK_SLOP = 5; // px a pointer may move and still count as a click
const WALK_MS = 900;
const FLY_MS = 1100;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Renders a space three ways — inside (walk between capture points), dollhouse
 * (orbit a cut-away model) and floor plan (top-down) — and turns pointer input
 * into navigation, measurements, tag placement and room tracing.
 */
export class Viewer {
  constructor(container, { panoUrl, ...callbacks } = {}) {
    this.container = container;
    this.panoUrl = panoUrl;
    this.cb = callbacks;
    this.space = null;
    this.mode = 'inside';
    this.tool = 'navigate';
    this.currentScanId = null;
    this.yaw = 0;
    this.pitch = -5 * DEG;
    this.textures = new Map(); // url -> { texture, promise }
    this.tweens = [];
    this.measurements = [];
    this.pendingMeasure = null;
    this.trace = null;
    this.transitioning = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'viewer-canvas';
    container.appendChild(this.renderer.domElement);

    this.overlay = document.createElement('div');
    this.overlay.className = 'viewer-overlay';
    container.appendChild(this.overlay);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1d1f24);
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.05, 500);
    this.ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 500);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = 85 * DEG;
    this.orbit.minDistance = 2;
    this.orbit.maxDistance = 80;
    this.orbit.enabled = false;

    this.planControls = new OrbitControls(this.ortho, this.renderer.domElement);
    this.planControls.enableRotate = false;
    this.planControls.screenSpacePanning = true;
    this.planControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.planControls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.planControls.enabled = false;

    this.rooms = new THREE.Group();
    this.wallCaps = new THREE.Group();
    this.markers = new THREE.Group();
    this.annotations = new THREE.Group();
    this.scene.add(this.rooms, this.wallCaps, this.markers, this.annotations);

    // Used when no room geometry exists yet: a big sphere around the eye shows the raw panorama.
    this.skyMaterial = createProjectionMaterial();
    this.skyMaterial.side = THREE.BackSide;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 32), this.skyMaterial);
    this.scene.add(this.sky);

    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.2, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }),
    );
    this.cursor.renderOrder = 10;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.clock = performance.now();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.orbit.dispose();
    this.planControls.dispose();
    window.removeEventListener('keydown', this.onKey);
    for (const { texture } of this.textures.values()) texture?.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  // ---------------------------------------------------------------- data

  setSpace(space) {
    const first = !this.space;
    this.space = space;
    if (!space.scans.some((s) => s.id === this.currentScanId)) this.currentScanId = space.scans[0]?.id ?? null;
    for (const scan of space.scans) this.loadTexture(scan);
    this.buildRooms();
    this.buildMarkers();
    this.buildTags();
    this.refreshProjections();
    if (first) {
      this.yaw = this.openingYaw();
      if (!this.currentScanId && space.rooms.length) this.setMode('dollhouse', { animate: false });
      else this.placeInsideCamera();
      this.fitPlan();
    } else if (this.mode === 'inside' && !this.transitioning) {
      this.placeInsideCamera();
    }
    this.cb.onScanChange?.(this.currentScanId);
  }

  /**
   * First view: look toward the farthest corner of the room you start in, so
   * the tour opens onto the depth of the room rather than the nearest wall.
   */
  openingYaw() {
    const scan = this.scanById(this.currentScanId);
    if (!scan) return 0;
    const p = [scan.position.x, scan.position.z];
    const room = this.space.rooms.find((r) => pointInPolygon(p, r.points)) ?? this.space.rooms[0];
    if (!room) return 0;
    const far = room.points.reduce((a, b) => (Math.hypot(b[0] - p[0], b[1] - p[1]) > Math.hypot(a[0] - p[0], a[1] - p[1]) ? b : a));
    return Math.atan2(-(far[0] - p[0]), -(far[1] - p[1]));
  }

  scanById(id) {
    return this.space?.scans.find((s) => s.id === id) ?? null;
  }

  eyeOf(scan) {
    return new THREE.Vector3(scan.position.x, scan.cameraHeight, scan.position.z);
  }

  projectionOf(scan) {
    if (!scan) return null;
    const entry = this.textures.get(this.panoUrl(scan));
    return { texture: entry?.ready ? entry.texture : null, origin: this.eyeOf(scan), heading: (scan.heading ?? 0) * DEG };
  }

  loadTexture(scan) {
    const url = this.panoUrl(scan);
    if (this.textures.has(url)) return this.textures.get(url).promise;
    const entry = { texture: null, ready: false };
    entry.promise = new THREE.TextureLoader().loadAsync(url).then((tex) => {
      entry.texture = configurePanoTexture(tex);
      entry.ready = true;
      this.refreshProjections();
      this.cb.onTextureLoaded?.(scan.id);
      return tex;
    }).catch((err) => {
      console.error('failed to load panorama', url, err);
    });
    this.textures.set(url, entry);
    return entry.promise;
  }

  buildRooms() {
    for (const g of [this.rooms, this.wallCaps]) {
      for (const m of g.children) {
        m.geometry.dispose();
        m.material.dispose();
      }
      g.clear();
    }
    for (const room of this.space.rooms) {
      const { positions } = roomMesh(room);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, createProjectionMaterial());
      mesh.userData.room = room;
      this.rooms.add(mesh);

      const caps = new THREE.Mesh(wallCapGeometry(room), new THREE.MeshBasicMaterial({ color: 0x2b2d33, side: THREE.DoubleSide }));
      caps.userData.room = room;
      this.wallCaps.add(caps);
    }
    this.sky.visible = this.mode === 'inside' && this.space.rooms.length === 0;
    this.wallCaps.visible = this.mode !== 'inside';
  }

  buildMarkers() {
    for (const m of this.markers.children) m.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    this.markers.clear();
    for (const scan of this.space.scans) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
      for (const m of [ring, disc]) {
        m.rotation.x = -Math.PI / 2;
        m.userData.scanId = scan.id;
        m.renderOrder = 2;
      }
      g.add(disc, ring);
      g.position.set(scan.position.x, 0.02, scan.position.z);
      g.userData.scanId = scan.id;
      this.markers.add(g);
    }
    this.updateMarkerVisibility();
  }

  updateMarkerVisibility() {
    for (const g of this.markers.children) {
      const isCurrent = g.userData.scanId === this.currentScanId;
      g.visible = this.mode !== 'inside' || !isCurrent;
      const color = this.mode !== 'inside' && isCurrent ? 0x4fb3ff : 0xffffff;
      g.children.forEach((m) => m.material.color.setHex(color));
    }
  }

  buildTags() {
    this.overlay.querySelectorAll('.tag-pin').forEach((el) => el.remove());
    this.tagEls = this.space.tags.map((tag) => {
      const el = document.createElement('button');
      el.className = 'tag-pin';
      el.innerHTML = `<span class="tag-dot"></span><span class="tag-label"></span>`;
      el.querySelector('.tag-label').textContent = tag.label;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cb.onTagOpen?.(tag, el);
      });
      this.overlay.appendChild(el);
      return { tag, el, pos: new THREE.Vector3(...tag.position), occluded: false };
    });
  }

  /** Point every room material at the right panorama for the current mode. */
  refreshProjections(transition) {
    if (!this.space) return;
    const current = this.projectionOf(this.scanById(this.currentScanId));
    if (transition) {
      const { from, to, blend } = transition;
      for (const m of this.rooms.children) setProjection(m.material, from, to, blend);
      setProjection(this.skyMaterial, from, to, blend);
      return;
    }
    for (const m of this.rooms.children) {
      const proj = this.mode === 'inside' ? current : this.projectionOf(bestScanForRoom(m.userData.room, this.space.scans));
      setProjection(m.material, proj);
    }
    setProjection(this.skyMaterial, current);
  }

  // ---------------------------------------------------------------- modes & camera

  lookDir(yaw = this.yaw, pitch = this.pitch) {
    return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  /** Point the inside view (used by the guided tour). */
  setLook(yaw, pitch = this.pitch) {
    this.yaw = yaw;
    this.pitch = THREE.MathUtils.clamp(pitch, -85 * DEG, 85 * DEG);
    if (this.mode === 'inside' && !this.transitioning) this.placeInsideCamera();
  }

  /** Resolves once any walk or fly animation has finished. */
  settled() {
    return new Promise((resolve) => {
      const check = () => (this.transitioning ? requestAnimationFrame(check) : resolve());
      check();
    });
  }

  placeInsideCamera() {
    const scan = this.scanById(this.currentScanId);
    if (!scan) return;
    const eye = this.eyeOf(scan);
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.clone().add(this.lookDir()));
    this.sky.position.copy(eye);
  }

  spaceCenterAndSize() {
    const pts = [...this.space.rooms.flatMap((r) => r.points), ...this.space.scans.map((s) => [s.position.x, s.position.z])];
    if (!pts.length) return { center: new THREE.Vector3(), size: 6 };
    const b = bounds(pts);
    return {
      center: new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2),
      size: Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 4),
    };
  }

  dollhousePose() {
    const { center, size } = this.spaceCenterAndSize();
    const dist = size * 1.25 + 3;
    const dir = new THREE.Vector3(0.55, 0.85, 1).normalize();
    return { position: center.clone().addScaledVector(dir, dist), target: center.clone().setY(0.8) };
  }

  fitPlan() {
    if (!this.space) return;
    const { center, size } = this.spaceCenterAndSize();
    // A hair of +z offset keeps lookAt/OrbitControls non-degenerate and puts -z (north) at the top.
    this.ortho.position.set(center.x, 60, center.z + 0.01);
    this.ortho.lookAt(center);
    this.planControls.target.copy(center);
    this.planHalf = size * 0.65 + 1;
    this.ortho.zoom = 1;
    this.resize();
    this.planControls.update();
  }

  setMode(mode, { animate = true } = {}) {
    if (mode === this.mode && !(mode === 'inside' && !this.currentScanId)) return;
    if (mode === 'inside' && !this.currentScanId) return;
    this.cancelTrace();
    const prev = this.mode;
    this.mode = mode;
    this.orbit.enabled = mode === 'dollhouse';
    this.planControls.enabled = mode === 'floorplan';
    this.sky.visible = mode === 'inside' && this.space.rooms.length === 0;
    this.wallCaps.visible = mode !== 'inside';
    this.cursor.visible = false;
    this.updateMarkerVisibility();
    this.refreshProjections();
    this.overlay.classList.toggle('show-room-labels', mode !== 'inside');
    if (animate) sfx.swoop();

    if (mode === 'dollhouse') {
      const pose = this.dollhousePose();
      this.orbit.target.copy(pose.target);
      if (animate && prev === 'inside') {
        const fromTarget = this.camera.position.clone().add(this.lookDir());
        this.flyCamera(this.camera.position.clone(), fromTarget, pose.position, pose.target, FLY_MS);
      } else {
        this.camera.position.copy(pose.position);
        this.camera.lookAt(pose.target);
      }
      this.orbit.update();
    } else if (mode === 'floorplan') {
      this.fitPlan();
    } else if (mode === 'inside') {
      const eye = this.eyeOf(this.scanById(this.currentScanId));
      if (animate && prev === 'dollhouse') {
        const fromTarget = this.orbit.target.clone();
        // look roughly the way we were facing when we dive in
        const flat = new THREE.Vector3().subVectors(eye, this.camera.position).setY(0);
        if (flat.lengthSq() > 1e-4) this.yaw = Math.atan2(-flat.x, -flat.z);
        this.pitch = -5 * DEG;
        this.flyCamera(this.camera.position.clone(), fromTarget, eye, eye.clone().add(this.lookDir()), FLY_MS);
      } else {
        this.placeInsideCamera();
      }
    }
    this.cb.onModeChange?.(mode);
  }

  flyCamera(fromPos, fromTarget, toPos, toTarget, ms, onDone) {
    this.transitioning = true;
    const pos = new THREE.Vector3(), target = new THREE.Vector3();
    this.tween(ms, (t) => {
      const k = ease(t);
      pos.lerpVectors(fromPos, toPos, k);
      target.lerpVectors(fromTarget, toTarget, k);
      this.camera.position.copy(pos);
      this.camera.lookAt(target);
    }, () => {
      this.transitioning = false;
      if (this.mode === 'dollhouse') this.orbit.update();
      if (this.mode === 'inside') this.placeInsideCamera();
      onDone?.();
    });
  }

  /** Move to a capture point; walks there in inside mode, dives in from the dollhouse/plan. */
  async goToScan(id) {
    const target = this.scanById(id);
    if (!target || this.transitioning) return;
    await this.loadTexture(target);
    if (this.mode !== 'inside') {
      this.currentScanId = id;
      if (this.mode === 'floorplan') {
        this.setMode('dollhouse', { animate: false });
      }
      this.setMode('inside');
      this.cb.onScanChange?.(id);
      return;
    }
    if (id === this.currentScanId) return;
    const fromScan = this.scanById(this.currentScanId);
    const from = this.projectionOf(fromScan), to = this.projectionOf(target);
    const fromEye = this.eyeOf(fromScan), toEye = this.eyeOf(target);
    this.transitioning = true;
    sfx.whoosh();
    this.cancelTrace();
    this.tween(WALK_MS, (t) => {
      const k = ease(t);
      this.camera.position.lerpVectors(fromEye, toEye, k);
      this.camera.lookAt(this.camera.position.clone().add(this.lookDir()));
      this.sky.position.copy(this.camera.position);
      this.refreshProjections({ from, to, blend: k });
    }, () => {
      this.transitioning = false;
      this.currentScanId = id;
      this.updateMarkerVisibility();
      this.refreshProjections();
      this.placeInsideCamera();
      this.cb.onScanChange?.(id);
    });
  }

  tween(ms, step, done) {
    this.tweens.push({ start: performance.now(), ms, step, done });
  }

  // ---------------------------------------------------------------- tools

  setTool(tool) {
    if (tool === this.tool) return;
    if (this.tool === 'trace') this.cancelTrace();
    this.tool = tool;
    this.pendingMeasure = null;
    this.container.dataset.tool = tool;
    if (tool === 'trace') {
      if (this.mode !== 'inside') this.setMode('inside', { animate: false });
      this.trace = { points: [], stage: 'floor', cursor: null };
      this.cb.onTraceProgress?.(this.trace);
    }
    this.updateAnnotations();
  }

  clearMeasurements() {
    this.measurements = [];
    this.pendingMeasure = null;
    this.updateAnnotations();
  }

  cancelTrace() {
    if (!this.trace) return;
    this.trace = null;
    this.updateAnnotations();
    this.cb.onTraceProgress?.(null);
  }

  /** Close the traced outline and move on to picking the ceiling height. */
  closeTrace() {
    if (!this.trace || this.trace.points.length < 3) return false;
    this.trace.stage = 'ceiling';
    this.updateAnnotations();
    this.cb.onTraceProgress?.(this.trace);
    return true;
  }

  finishTrace(height) {
    if (!this.trace || this.trace.points.length < 3) return;
    const points = this.trace.points.map((p) => [round(p.x), round(p.z)]);
    this.trace = null;
    this.updateAnnotations();
    this.cb.onTraceProgress?.(null);
    this.cb.onTraceComplete?.({ points, height: round(height) });
  }

  // ---------------------------------------------------------------- input

  bindInput() {
    const el = this.renderer.domElement;
    let down = null;
    const pointers = new Map(); // active touches, for pinch-to-zoom
    let pinch = null;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    el.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && this.mode === 'inside') {
        pinch = { dist: spread(), fov: this.camera.fov };
        down = null; // a pinch is neither a drag nor a click
        return;
      }
      down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, dragging: false };
      if (this.mode === 'inside') {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // best-effort: keep handling the drag without capture
        }
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        this.camera.fov = THREE.MathUtils.clamp(pinch.fov * (pinch.dist / Math.max(spread(), 1)), 30, 95);
        this.camera.updateProjectionMatrix();
        return;
      }
      if (down && this.mode === 'inside' && !this.transitioning) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > CLICK_SLOP) down.dragging = true;
        if (down.dragging) {
          const k = (this.camera.fov * DEG) / el.clientHeight;
          this.yaw = down.yaw + dx * k;
          this.pitch = THREE.MathUtils.clamp(down.pitch + dy * k, -85 * DEG, 85 * DEG);
          this.placeInsideCamera();
          return;
        }
      }
      if (e.pointerType === 'mouse') this.onHover(e);
    });
    const release = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
    };
    el.addEventListener('pointerup', (e) => {
      release(e);
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved <= CLICK_SLOP) {
        if (e.pointerType !== 'mouse') this.onHover(e); // touch has no hover: update measure/trace previews first
        this.onClick(e);
      }
    });
    el.addEventListener('pointercancel', (e) => {
      release(e);
      down = null;
    });
    el.addEventListener('pointerleave', () => { this.cursor.visible = false; });
    el.addEventListener('wheel', (e) => {
      if (this.mode !== 'inside') return;
      e.preventDefault();
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + e.deltaY * 0.05, 30, 95);
      this.camera.updateProjectionMatrix();
    }, { passive: false });
    this.onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'Escape') {
        if (this.trace) this.cancelTrace();
        this.pendingMeasure = null;
        this.updateAnnotations();
      }
      if (e.key === 'Enter' && this.trace?.stage === 'floor') this.closeTrace();
    };
    window.addEventListener('keydown', this.onKey);
  }

  activeCamera() {
    return this.mode === 'floorplan' ? this.ortho : this.camera;
  }

  setRay(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.activeCamera());
  }

  /** First surface under the pointer: a scan marker, a room surface, or the floor plane. */
  pick(e, { markers = true } = {}) {
    this.setRay(e);
    if (markers) {
      const hit = this.raycaster.intersectObjects(this.markers.children.filter((g) => g.visible), true)[0];
      if (hit) return { kind: 'marker', scanId: hit.object.userData.scanId, point: hit.point };
    }
    const hit = this.raycaster.intersectObjects(this.rooms.children, false)[0];
    if (hit) {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      return { kind: 'room', room: hit.object.userData.room, point: hit.point, normal };
    }
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, p)) return { kind: 'floor', point: p, normal: new THREE.Vector3(0, 1, 0) };
    return null;
  }

  floorPointUnder(e) {
    this.setRay(e);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, p) ? p : null;
  }

  onHover(e) {
    if (this.transitioning) return;
    if (this.tool === 'trace' && this.trace) {
      if (this.trace.stage === 'floor') {
        this.trace.cursor = this.floorPointUnder(e);
      } else {
        this.setRay(e);
        this.trace.cursor = { height: this.ceilingHeightFromRay() };
      }
      this.updateAnnotations();
      this.cursor.visible = false;
      return;
    }
    if (this.mode !== 'inside') {
      this.cursor.visible = false;
      return;
    }
    const hit = this.pick(e, { markers: false });
    if (!hit) {
      this.cursor.visible = false;
      return;
    }
    this.cursor.visible = true;
    this.cursor.position.copy(hit.point).addScaledVector(hit.normal, 0.01);
    this.cursor.lookAt(hit.point.clone().add(hit.normal));
    if (this.tool === 'measure' && this.pendingMeasure) {
      this.pendingMeasure.hover = hit.point.clone();
      this.updateAnnotations();
    }
  }

  onClick(e) {
    if (this.transitioning || !this.space) return;
    if (this.tool === 'trace') return this.traceClick(e);
    if (this.tool === 'measure') {
      const hit = this.pick(e, { markers: false });
      if (!hit) return;
      if (!this.pendingMeasure) {
        this.pendingMeasure = { a: hit.point.clone(), hover: null };
      } else {
        this.measurements.push({ a: this.pendingMeasure.a, b: hit.point.clone() });
        this.pendingMeasure = null;
        this.cb.onMeasure?.(this.measurements.at(-1));
      }
      this.updateAnnotations();
      return;
    }
    if (this.tool === 'tag') {
      const hit = this.pick(e, { markers: false });
      if (hit) this.cb.onTagPlace?.(hit.point.toArray().map(round), e);
      return;
    }
    const hit = this.pick(e);
    if (!hit) return;
    if (hit.kind === 'marker') return this.goToScan(hit.scanId);
    if (this.mode !== 'inside' && hit.kind === 'room') {
      const best = bestScanForRoom(hit.room, this.space.scans);
      if (best) return this.goToScan(best.id);
    }
    if (this.mode === 'inside' && hit.normal.y > 0.9) {
      // click on the floor: walk to the capture point nearest that spot
      const near = this.nearestScan(hit.point, this.currentScanId);
      if (near && near.dist < 3) this.goToScan(near.scan.id);
    }
  }

  nearestScan(point, excludeId) {
    let best = null;
    for (const s of this.space.scans) {
      if (s.id === excludeId) continue;
      const dist = Math.hypot(s.position.x - point.x, s.position.z - point.z);
      if (!best || dist < best.dist) best = { scan: s, dist };
    }
    return best;
  }

  traceClick(e) {
    const t = this.trace;
    if (!t) return;
    if (t.stage === 'ceiling') {
      this.setRay(e);
      const h = this.ceilingHeightFromRay();
      if (h) this.finishTrace(h);
      return;
    }
    const p = this.floorPointUnder(e);
    if (!p) return;
    if (t.points.length >= 3) {
      const first = this.toScreen(t.points[0]);
      if (first && Math.hypot(first.x - e.clientX, first.y - e.clientY) < 14) {
        this.closeTrace();
        return;
      }
    }
    t.points.push(p);
    this.updateAnnotations();
    this.cb.onTraceProgress?.(t);
  }

  /**
   * Ceiling height from a ray aimed at the wall/ceiling corner directly above the
   * first traced floor corner: we know how far away that corner is horizontally,
   * so the ray's slope gives the height.
   */
  ceilingHeightFromRay() {
    const c = this.trace?.points[0];
    if (!c) return null;
    const { origin, direction } = this.raycaster.ray;
    const horiz = Math.hypot(direction.x, direction.z);
    const dist = Math.hypot(c.x - origin.x, c.z - origin.z);
    if (horiz < 1e-3 || direction.y <= 0) return null;
    const h = origin.y + (direction.y / horiz) * dist;
    return h >= 1.5 && h <= 10 ? h : null;
  }

  // ---------------------------------------------------------------- annotations

  updateAnnotations() {
    for (const o of this.annotations.children) {
      o.geometry?.dispose();
      o.material?.dispose();
    }
    this.annotations.clear();
    this.overlay.querySelectorAll('.measure-label, .trace-label').forEach((el) => el.remove());
    this.labelEls = [];

    const segs = [...this.measurements];
    if (this.pendingMeasure?.hover) segs.push({ a: this.pendingMeasure.a, b: this.pendingMeasure.hover, pending: true });
    for (const m of segs) {
      this.annotations.add(line([m.a, m.b], 0xffd23f));
      this.annotations.add(dot(m.a, 0xffd23f), dot(m.b, 0xffd23f));
      this.addLabel('measure-label', m.a.clone().lerp(m.b, 0.5), `${m.a.distanceTo(m.b).toFixed(2)} m`);
    }
    if (this.pendingMeasure && !this.pendingMeasure.hover) this.annotations.add(dot(this.pendingMeasure.a, 0xffd23f));

    const t = this.trace;
    if (t) {
      const pts = t.points.map((p) => p.clone().setY(0.01));
      if (t.stage === 'floor' && t.cursor) pts.push(t.cursor.clone().setY(0.01));
      if (t.stage === 'ceiling' && pts.length) pts.push(pts[0]);
      if (pts.length >= 2) this.annotations.add(line(pts, 0x4fb3ff));
      t.points.forEach((p, i) => this.annotations.add(dot(p, i === 0 ? 0xff6b6b : 0x4fb3ff, 0.06)));
      for (let i = 1; i < pts.length; i++) {
        if (pts[i - 1].distanceTo(pts[i]) < 0.05) continue;
        this.addLabel('trace-label', pts[i - 1].clone().lerp(pts[i], 0.5), `${pts[i - 1].distanceTo(pts[i]).toFixed(2)} m`);
      }
      if (t.stage === 'ceiling' && t.cursor?.height) {
        const base = t.points[0];
        this.annotations.add(line([base.clone().setY(0), base.clone().setY(t.cursor.height)], 0xff6b6b));
        this.addLabel('trace-label', base.clone().setY(t.cursor.height), `ceiling ${t.cursor.height.toFixed(2)} m`);
      }
    }
    for (const o of this.annotations.children) o.renderOrder = 20;
  }

  addLabel(cls, pos, text) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    this.overlay.appendChild(el);
    this.labelEls.push({ el, pos });
  }

  toScreen(v) {
    const cam = this.activeCamera();
    cam.updateMatrixWorld();
    const p = v.clone().project(cam);
    if (p.z > 1 || p.z < -1) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  positionOverlay() {
    const r = this.renderer.domElement.getBoundingClientRect();
    const place = (el, v) => {
      const s = this.toScreen(v);
      if (!s) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      el.style.transform = `translate(${(s.x - r.left).toFixed(1)}px, ${(s.y - r.top).toFixed(1)}px)`;
    };
    for (const { el, pos } of this.labelEls ?? []) place(el, pos);

    // Tags hide when a wall is between them and the camera.
    this.occlusionTick = ((this.occlusionTick ?? 0) + 1) % 10;
    for (const t of this.tagEls ?? []) {
      if (this.occlusionTick === 0) {
        const cam = this.activeCamera();
        const from = cam.position.clone();
        const dir = t.pos.clone().sub(from);
        const dist = dir.length();
        this.raycaster.set(from, dir.normalize());
        const hit = this.raycaster.intersectObjects(this.rooms.children, false)[0];
        t.occluded = this.mode !== 'floorplan' && !!hit && hit.distance < dist - 0.05;
      }
      place(t.el, t.pos);
      if (t.occluded) t.el.style.display = 'none';
    }
    this.positionRoomLabels(place);
  }

  positionRoomLabels(place) {
    if (!this.roomLabelEls || this.roomLabelEls.space !== this.space) {
      this.overlay.querySelectorAll('.room-label').forEach((el) => el.remove());
      this.roomLabelEls = this.space.rooms.map((room) => {
        const el = document.createElement('div');
        el.className = 'room-label';
        el.innerHTML = '<strong></strong><span></span>';
        el.querySelector('strong').textContent = room.name;
        el.querySelector('span').textContent = `${polygonArea(room.points).toFixed(1)} m²`;
        this.overlay.appendChild(el);
        const [x, z] = centroid(normalizePolygon(room.points));
        return { el, pos: new THREE.Vector3(x, 0.05, z) };
      });
      this.roomLabelEls.space = this.space;
    }
    for (const { el, pos } of this.roomLabelEls) place(el, pos);
  }

  // ---------------------------------------------------------------- loop

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const half = this.planHalf ?? 6;
    const aspect = w / h;
    const hw = aspect >= 1 ? half * aspect : half, hh = aspect >= 1 ? half : half / aspect;
    Object.assign(this.ortho, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.ortho.updateProjectionMatrix();
  }

  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    if (this.tweens.length) {
      const live = [];
      for (const tw of this.tweens) {
        const t = Math.min(1, (now - tw.start) / tw.ms);
        tw.step(t);
        if (t < 1) live.push(tw);
        else tw.done?.();
      }
      this.tweens = this.tweens.filter((tw) => live.includes(tw));
    }
    if (this.orbit.enabled && !this.transitioning) this.orbit.update();
    if (this.planControls.enabled) this.planControls.update();
    if (this.space) this.positionOverlay();
    this.renderer.render(this.scene, this.activeCamera());
  }

  screenshot() {
    return this.renderer.domElement.toDataURL('image/jpeg', 0.9);
  }
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function line(points, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
}

function dot(p, color, r = 0.035) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
  m.position.copy(p);
  return m;
}

/** Dark ribbon along the top of each wall, so the dollhouse and plan read clearly. */
function wallCapGeometry(room) {
  const pts = normalizePolygon(room.points);
  const t = 0.1;
  const y = room.height + 0.005;
  const pos = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ox = ((q[1] - p[1]) / len) * t, oz = (-(q[0] - p[0]) / len) * t; // outward
    const a = [p[0], y, p[1]], b = [q[0], y, q[1]], c = [q[0] + ox, y, q[1] + oz], d = [p[0] + ox, y, p[1] + oz];
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}
