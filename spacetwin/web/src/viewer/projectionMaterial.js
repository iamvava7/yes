import * as THREE from 'three';

// Projects equirectangular panoramas onto arbitrary geometry from the point they
// were captured. When the geometry matches the real room the result looks
// exactly like the photo from the capture point and stays geometrically correct
// from anywhere else, which is what makes walk transitions and the dollhouse work.
// Two panoramas (A, B) can be blended during a move between scans.
//
// Convention (shared with scripts/make_sample.py): a world direction d is rotated
// by -heading about y, then u = 0.5 + atan2(d.x, -d.z) / 2π, v = 0.5 + asin(d.y) / π.

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D panoA;
  uniform sampler2D panoB;
  uniform vec3 originA;
  uniform vec3 originB;
  uniform float headingA;
  uniform float headingB;
  uniform float blend;
  uniform float hasPano;
  uniform vec3 fallback;
  uniform float opacity;
  varying vec3 vWorld;

  const float PI = 3.141592653589793;

  vec3 sampleFrom(sampler2D tex, vec3 origin, float heading) {
    vec3 d = normalize(vWorld - origin);
    float c = cos(heading), s = sin(heading);
    vec3 l = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
    vec2 uv = vec2(0.5 + atan(l.x, -l.z) / (2.0 * PI), 0.5 + asin(clamp(l.y, -1.0, 1.0)) / PI);
    return texture2D(tex, uv).rgb;
  }

  void main() {
    vec3 color = fallback;
    if (hasPano > 0.5) {
      vec3 a = sampleFrom(panoA, originA, headingA);
      color = blend > 0.001 ? mix(a, sampleFrom(panoB, originB, headingB), blend) : a;
    }
    gl_FragColor = vec4(color, opacity);
    #include <colorspace_fragment>
  }
`;

export function createProjectionMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      panoA: { value: null },
      panoB: { value: null },
      originA: { value: new THREE.Vector3() },
      originB: { value: new THREE.Vector3() },
      headingA: { value: 0 },
      headingB: { value: 0 },
      blend: { value: 0 },
      hasPano: { value: 0 },
      fallback: { value: new THREE.Color(0xd8d6d0) },
      opacity: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });
}

/** Point a projection material at one scan (or blend between two). */
export function setProjection(material, from, to = null, blend = 0) {
  const u = material.uniforms;
  if (!from?.texture) {
    u.hasPano.value = 0;
    return;
  }
  u.hasPano.value = 1;
  u.panoA.value = from.texture;
  u.originA.value.copy(from.origin);
  u.headingA.value = from.heading;
  const b = to?.texture ? to : from;
  u.panoB.value = b.texture;
  u.originB.value.copy(b.origin);
  u.headingB.value = b.heading;
  u.blend.value = to?.texture ? blend : 0;
}

export function configurePanoTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  // atan() jumps at the seam, which would select the smallest mip there and
  // draw a visible line; sampling the base level only avoids it.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
