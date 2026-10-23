import * as THREE from 'three';

// The capture screen's 3D view (like Google's Photo Sphere or Teleport): you
// stand at the centre of a sphere, the camera turns with the phone, and every
// photo you take is placed as a tile exactly where it was aimed, so you watch
// the room fill in around you. Afterwards the camera pulls back and slowly
// orbits the ball of photos while they are stitched.

const TILE_SIDE = 384; // px: tiles are previews; the full photos go to the stitcher

export class Mosaic {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'mosaic-canvas';
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b3036);
    this.camera = new THREE.PerspectiveCamera(100, 1, 0.01, 50);
    this.tiles = new THREE.Group();
    this.scene.add(this.tiles);

    // faint latitude/longitude lines give a sense of the sphere before any photo lands
    const grid = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(14, 24, 12)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 }),
    );
    this.scene.add(grid);

    this.intr = { tx: 0.42, ty: 0.64 }; // replaced by setIntrinsics
    this.orbit = null;
    this.animations = [];
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    for (const t of this.tiles.children) {
      t.material.map.dispose();
      t.material.dispose();
      t.geometry.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Field of view of the photos (tan of half-angles), which sets tile size and the live frame. */
  setIntrinsics(intr) {
    this.intr = intr;
    this.resize();
  }

  /**
   * Choose a wide view so the live photo frame takes up about 72% of the
   * screen width (or 58% of the height), leaving room to see tiles around it.
   */
  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const tanV = Math.max(this.intr.ty / 0.58, this.intr.tx / 0.72 / aspect);
    this.camera.fov = (2 * Math.atan(tanV) * 180) / Math.PI;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.frameRect = {
      width: (this.intr.tx / (tanV * aspect)) * w,
      height: (this.intr.ty / tanV) * h,
    };
    this.onResize?.(this.frameRect);
  }

  /** Point the view the way the phone points (inside the sphere). */
  setOrientation(q) {
    if (this.orbit) return;
    this.camera.position.set(0, 0, 0);
    this.camera.quaternion.copy(q);
  }

  /** Place a photo tile where it was taken. `source` is a canvas or video frame. */
  addTile(source, q) {
    const scale = Math.min(1, TILE_SIDE / Math.max(source.width, source.height));
    const c = document.createElement('canvas');
    c.width = Math.round(source.width * scale);
    c.height = Math.round(source.height * scale);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * this.intr.tx, 2 * this.intr.ty),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false }),
    );
    mesh.quaternion.copy(q);
    mesh.position.set(0, 0, -1).applyQuaternion(q);
    mesh.renderOrder = this.tiles.children.length;
    mesh.scale.setScalar(1.12);
    this.tiles.add(mesh);
    // land: fade in while settling into place
    this.animate(320, (t) => {
      const k = 1 - (1 - t) ** 3;
      mesh.material.opacity = k;
      mesh.scale.setScalar(1.12 - 0.12 * k);
    });
    return mesh;
  }

  removeTile(mesh) {
    this.tiles.remove(mesh);
    mesh.material.map.dispose();
    mesh.material.dispose();
    mesh.geometry.dispose();
  }

  /** Screen position (px) of a world direction, or null when behind the view. */
  project(dir) {
    const p = dir.clone().add(this.camera.position).project(this.camera);
    if (p.z > 1) return null;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, inFront: dir.clone().applyQuaternion(this.camera.quaternion.clone().invert()).z < 0 };
  }

  /** Pull back and orbit the ball of photos (while stitching). */
  startOrbit() {
    const start = performance.now();
    this.orbit = { start };
    // from outside, nearer tiles must hide farther ones
    for (const t of this.tiles.children) {
      t.material.depthTest = true;
      t.material.depthWrite = true;
    }
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
  }

  animate(ms, step) {
    this.animations.push({ start: performance.now(), ms, step });
  }

  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    this.animations = this.animations.filter((a) => {
      const t = Math.min(1, (now - a.start) / a.ms);
      a.step(t);
      return t < 1;
    });
    if (this.orbit) {
      // pull back until the whole ball of photos fits the narrower side of the
      // screen, then orbit slowly; the ball sits in the upper part of the
      // screen, above the progress card
      const t = (now - this.orbit.start) / 1000;
      const pull = Math.min(1, t / 1.6);
      const vfov = (this.camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
      const fit = 1.35 / Math.sin(Math.min(vfov, hfov) / 2);
      const r = 0.01 + fit * (1 - (1 - pull) ** 3);
      const a = t * 0.35;
      this.camera.position.set(Math.sin(a) * r, 0.35 * r * pull, Math.cos(a) * r);
      this.camera.lookAt(0, -0.55 * pull, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
