// The colour grade, applied to the finished frame.
//
// ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
// Look at any of the stylised games this one is aiming at and the thing they
// share is not polygon count, it is that every pixel has been pulled towards a
// single colour story. A scene lit correctly and left un-graded reads as a
// technical demo: accurate, and flat.
//
// Three operations, in the order they must happen:
//   1. VIGNETTE. Darkens the corners so the eye goes to the middle, where the
//      fight is. It is the cheapest focus tool there is.
//   2. TINT SPLIT. Shadows pushed toward the atmosphere's colour and highlights
//      pushed warm. This is what makes a picture feel lit by a PLACE rather
//      than by a lamp, and it is most of the reference look.
//   3. CONTRAST + SATURATION, last, so it acts on the graded image.
//
// ⚠ WORKS ON THE TONE-MAPPED IMAGE. It runs after OutputPass, so the values
// here are display-referred and 0..1. Applying a grade before tone mapping
// fights the tone curve and produces muddy corners.

import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface GradeOptions {
  /** Colour the shadows are pulled toward. The atmosphere's own colour. */
  shadowTint: THREE.Color;
  /** Colour the highlights are pulled toward. Usually the key light. */
  highlightTint: THREE.Color;
  strength: number;
  vignette: number;
  contrast: number;
  saturation: number;
}

export function createGradePass(o: GradeOptions): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uShadow: { value: o.shadowTint },
      uHighlight: { value: o.highlightTint },
      uStrength: { value: o.strength },
      uVignette: { value: o.vignette },
      uContrast: { value: o.contrast },
      uSaturation: { value: o.saturation },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec3 uShadow;
      uniform vec3 uHighlight;
      uniform float uStrength;
      uniform float uVignette;
      uniform float uContrast;
      uniform float uSaturation;
      varying vec2 vUv;

      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec3 c = texel.rgb;

        // Luminance decides which end of the split a pixel belongs to.
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 tint = mix(uShadow, uHighlight, smoothstep(0.15, 0.75, l));
        // Multiplied rather than added: adding washes blacks out to grey, and
        // a stylised look depends on the darks staying dark.
        c = mix(c, c * tint, uStrength);

        c = (c - 0.5) * uContrast + 0.5;
        c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSaturation);

        // Distance from centre, corrected so the falloff is round rather than
        // stretched with the aspect ratio.
        vec2 d = vUv - 0.5;
        float v = 1.0 - smoothstep(0.28, 0.78, length(d) * 1.32) * uVignette;
        c *= v;

        gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
      }
    `,
  });
}
