import type { Forecast, Regime } from '../types';

// FNV-1a 32-bit string hash. Deterministic, fast, good enough for seed derivation.
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Hash a (gx, gy, seed) integer lattice point to a value in [0, 1).
function latticeHash(gx: number, gy: number, seed: number): number {
  let h = seed >>> 0;
  h ^= Math.imul(gx | 0, 0x27d4eb2d);
  h = (h ^ (h >>> 15)) >>> 0;
  h ^= Math.imul(gy | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xffffff) / 0x1000000; // [0, 1)
}

// Smooth interpolation curve (smootherstep).
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Single-octave value noise: bilinear interpolation of latticeHash with a smooth fade curve.
function octave(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const v00 = latticeHash(x0,     y0,     seed);
  const v10 = latticeHash(x0 + 1, y0,     seed);
  const v01 = latticeHash(x0,     y0 + 1, seed);
  const v11 = latticeHash(x0 + 1, y0 + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}

// 4-octave fractal value noise, normalized to [0, 1].
// persistence 0.5, lacunarity 2.0. Sum of weights: 1 + 0.5 + 0.25 + 0.125 = 1.875.
export function valueNoise(x: number, y: number, seed: number): number {
  let total = 0;
  let amp = 1;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    total += octave(x * freq, y * freq, (seed + o * 0x9e3779b1) >>> 0) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / 1.875;
}

export type CloudTheme = 'light' | 'dark';

interface ColorStop {
  t: number;          // intensity threshold (0..1)
  r: number; g: number; b: number;
  a: number;          // alpha 0..1
}

// Stops from spec §7. The leading transparent stop ensures intensity <0.10 fades to nothing.
const LIGHT_STOPS: ColorStop[] = [
  { t: 0.00, r: 232, g: 238, b: 245, a: 0.00 },
  { t: 0.10, r: 232, g: 238, b: 245, a: 0.35 },
  { t: 0.35, r: 185, g: 197, b: 214, a: 0.55 },
  { t: 0.60, r: 111, g: 127, b: 153, a: 0.70 },
  { t: 0.80, r:  52, g:  64, b:  90, a: 0.85 },
  { t: 1.00, r:  52, g:  64, b:  90, a: 0.85 },
];

const DARK_STOPS: ColorStop[] = [
  { t: 0.00, r: 203, g: 213, b: 225, a: 0.00 },
  { t: 0.10, r: 203, g: 213, b: 225, a: 0.35 },
  { t: 0.35, r: 148, g: 163, b: 184, a: 0.55 },
  { t: 0.60, r:  71, g:  85, b: 105, a: 0.70 },
  { t: 0.80, r:  30, g:  41, b:  59, a: 0.85 },
  { t: 1.00, r:  30, g:  41, b:  59, a: 0.85 },
];

function sampleStops(stops: ColorStop[], t: number): [number, number, number, number] {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (!a || !b) continue;
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const f = (t - a.t) / span;
      return [
        a.r + (b.r - a.r) * f,
        a.g + (b.g - a.g) * f,
        a.b + (b.b - a.b) * f,
        a.a + (b.a - a.a) * f,
      ];
    }
  }
  const last = stops[stops.length - 1];
  if (!last) return [0, 0, 0, 0];
  return [last.r, last.g, last.b, last.a];
}

// 256-entry RGBA LUT, non-premultiplied. Compositing onto the basemap is done by the
// GridLayer's `opacity` option, which Leaflet multiplies into the canvas's alpha at draw time.
export function buildColorLUT(theme: CloudTheme): Uint8ClampedArray {
  const stops = theme === 'dark' ? DARK_STOPS : LIGHT_STOPS;
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const [r, g, b, a] = sampleStops(stops, t);
    const base = i * 4;
    lut[base + 0] = Math.round(r);
    lut[base + 1] = Math.round(g);
    lut[base + 2] = Math.round(b);
    lut[base + 3] = Math.round(a * 255);
  }
  return lut;
}

const COVERAGE_BIAS: Record<Regime, number> = {
  stable:     0.15,
  partial:    0.45,
  convective: 0.70,
  severe:     0.88,
};

const NOISE_SCALE = 12;       // lat/lon → noise-space scale; smaller = larger features
const BUMP_SIGMA = 0.18;      // gaussian width along cloud-vector path, in degrees lat
const BUMP_PEAK = 0.35;       // peak additive intensity at the vector's centerline

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Smoothstep from edge0 to edge1.
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Perpendicular distance (in degrees) from point P to segment AB.
function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp01(t);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

export function intensityAt(lat: number, lon: number, forecast: Forecast): number {
  const seed = hash32(forecast.issuedAt);
  const base = valueNoise(lat * NOISE_SCALE, lon * NOISE_SCALE, seed); // [0, 1]
  const bias = COVERAGE_BIAS[forecast.regime];
  let shifted = clamp01((base - 0.5) + bias);

  for (const v of forecast.cloudVectors) {
    // forecast.cloudVectors uses [lat, lon] tuples per types.ts
    const d = distToSegment(lat, lon, v.from[0], v.from[1], v.to[0], v.to[1]);
    const bump = Math.exp(-(d / BUMP_SIGMA) * (d / BUMP_SIGMA)) * BUMP_PEAK;
    shifted = Math.max(shifted, shifted * 0.6 + bump);
  }

  return smoothstep(0.05, 0.95, clamp01(shifted));
}
