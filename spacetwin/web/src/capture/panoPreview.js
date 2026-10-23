import * as THREE from 'three';
import { configurePanoTexture, createProjectionMaterial, setProjection } from '../viewer/projectionMaterial.js';

// A simple 360° look-around for a freshly stitched panorama: drag (or turn the
// phone) to look; it drifts slowly until touched. Uses the viewer's projection
// so it shows exactly what the tour will.

export class PanoPreview {
  constructor(container, url) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'pano-preview-canvas';
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b3036);
    this.camera = new THREE.PerspectiveCamera(85, 1, 0.1, 100);
    const material = createProjectionMaterial();
    material.side = THREE.BackSide;
    this.material = material;
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), material));
    this.yaw = 0;
    this.pitch = -0.08;
    this.drift = true;
    new THREE.TextureLoader().load(url, (tex) => {
      this.texture = configurePanoTexture(tex);
      setProjection(material, { texture: this.texture, origin: new THREE.Vector3(), heading: 0 });
      this.ready = true;
      this.onReady?.();
    });

    const el = this.renderer.domElement;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      this.drift = false;
      drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = (this.camera.fov * Math.PI) / 180 / (el.clientHeight || 1);
      this.yaw = drag.yaw + (e.clientX - drag.x) * k;
      this.pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * k, -1.4, 1.4);
    });
    const end = () => { drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    this.raf = requestAnimationFrame(this.frame);
    if (this.drift) this.yaw += 0.0012;
    const d = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.lookAt(d);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.texture?.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
