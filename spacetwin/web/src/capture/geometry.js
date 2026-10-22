import * as THREE from 'three';

// Camera-capture geometry shared by the capture screen and the stitcher.
//
// World frame: y up, the panorama's centre (u = 0.5) looks toward -z — the same
// convention as the viewer (see viewer/projectionMaterial.js). A camera
// orientation is a quaternion taking camera-space directions (camera looks
// down -z, x right, y up the image) into world space.

const DEG = Math.PI / 180;
const zee = new THREE.Vector3(0, 0, 1);
const backCamera = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° about x

/**
 * Orientation of the rear camera from a W3C deviceorientation reading
 * (alpha, beta, gamma in degrees) and the screen rotation (0, 90, -90, 180).
 * Same construction as three.js's former DeviceOrientationControls.
 */
export function deviceQuaternion(alpha, beta, gamma, screenAngle = 0, out = new THREE.Quaternion()) {
  const euler = new THREE.Euler(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ');
  out.setFromEuler(euler);
  out.multiply(backCamera);
  out.multiply(new THREE.Quaternion().setFromAxisAngle(zee, -screenAngle * DEG));
  return out;
}

export function forwardOf(q, out = new THREE.Vector3()) {
  return out.set(0, 0, -1).applyQuaternion(q);
}

/** Yaw/pitch (radians) of a direction; yaw 0 = -z, positive yaw turns toward -x (left). */
export function yawPitchOf(d) {
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) };
}

export function dirFromYawPitch(yaw, pitch, out = new THREE.Vector3()) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

/** Rotation about y that makes `yaw` the new zero. */
export function headingCorrection(yaw) {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
}

/**
 * Shots needed for a full sphere with a phone held upright (portrait, ~50°×65°
 * field of view): a horizon ring, a ring above and below, then straight up and
 * down. Neighbouring shots overlap by roughly a third, which the stitcher needs
 * to align and blend them. Order: horizon first (the easiest, and what fixes
 * the heading), then up, down, zenith, nadir.
 */
export function captureTargets() {
  const targets = [];
  const ring = (pitchDeg, count, offsetDeg = 0) => {
    for (let i = 0; i < count; i++) {
      targets.push({ yaw: -(i * 360 / count + offsetDeg) * DEG, pitch: pitchDeg * DEG });
    }
  };
  ring(0, 12);
  ring(48, 8, 22.5);
  ring(-48, 8, 22.5);
  targets.push({ yaw: 0, pitch: 89.9 * DEG }, { yaw: 0, pitch: -89.9 * DEG });
  return targets.map((t, i) => ({ ...t, id: i, dir: dirFromYawPitch(t.yaw, t.pitch) }));
}

/** Pinhole intrinsics from a vertical field of view and the frame's width/height ratio. */
export function intrinsics(vfovDeg, aspect) {
  const ty = Math.tan((vfovDeg * DEG) / 2);
  return { tx: ty * aspect, ty, vfov: vfovDeg, aspect };
}

/**
 * Project a world direction into a camera. Returns normalised image
 * coordinates (0..1, origin top-left) or null when outside the frame.
 */
export function projectToFrame(dir, qInv, intr, tmp = new THREE.Vector3()) {
  const c = tmp.copy(dir).applyQuaternion(qInv);
  if (c.z >= -1e-6) return null;
  const x = c.x / -c.z, y = c.y / -c.z;
  const u = 0.5 + x / (2 * intr.tx), v = 0.5 - y / (2 * intr.ty);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}

/** World direction through normalised image coordinates (0..1, origin top-left). */
export function rayFromFrame(u, v, q, intr, out = new THREE.Vector3()) {
  return out.set((u - 0.5) * 2 * intr.tx, (0.5 - v) * 2 * intr.ty, -1).normalize().applyQuaternion(q);
}

export function angleBetween(a, b) {
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}
