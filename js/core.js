// core.js - shared helpers: seeded random, the geometry builder, procedural textures, materials.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);

// ---------- seeded random (mulberry32) ----------
export function rng(seed) {
  let a = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => lo + Math.floor((hi - lo + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
  f.chance = p => f() < p;
  return f;
}
export function hash(...parts) {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- geometry builder ----------
// Collects boxes and shapes per material key, then merges each key into one mesh.
// Instanced boxes (ibox) are for very repetitive pieces: curtain wall panels, fins, balusters.
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_BOX_NI = UNIT_BOX.toNonIndexed();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class Builder {
  constructor() { this.lists = new Map(); this.inst = new Map(); this.objects = []; }
  push(key, g) { let l = this.lists.get(key); if (!l) this.lists.set(key, (l = [])); l.push(g); return g; }
  box(key, sx, sy, sz, x, y, z, ry = 0, rx = 0, rz = 0) {
    if (!(sx > 0 && sy > 0 && sz > 0)) return null;
    const g = UNIT_BOX_NI.clone();
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    return this.push(key, g);
  }
  ibox(key, sx, sy, sz, x, y, z, ry = 0, rx = 0, col = null) {
    if (!(sx > 0 && sy > 0 && sz > 0)) return;
    let l = this.inst.get(key); if (!l) this.inst.set(key, (l = []));
    _e.set(rx, ry, 0, 'YXZ'); _q.setFromEuler(_e);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(sx, sy, sz));
    if (col != null) m.col = col;
    l.push(m);
  }
  geo(key, g, m) {
    let c = g.index ? g.toNonIndexed() : g.clone();
    if (m) c.applyMatrix4(m);
    for (const name of Object.keys(c.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') c.deleteAttribute(name);
    if (!c.attributes.normal) c.computeVertexNormals();
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    c.clearGroups();
    return this.push(key, c);
  }
  add(obj) { this.objects.push(obj); return obj; }
  build(mats) {
    const group = new THREE.Group();
    for (const [key, list] of this.lists) {
      const mat = mats[key];
      if (!mat) { console.warn('missing material', key); continue; }
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) { console.warn('merge failed', key); continue; }
      if ((mat.userData.uv || 'world') === 'world') worldUV(merged, mat.userData.tile || 2, mat.userData.roofConst);
      merged.computeBoundingSphere(); merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = mat.userData.cast !== false;
      mesh.receiveShadow = mat.userData.receive !== false;
      mesh.name = key;
      group.add(mesh);
    }
    for (const [key, list] of this.inst) {
      const mat = mats[key];
      if (!mat) { console.warn('missing material', key); continue; }
      const im = new THREE.InstancedMesh(UNIT_BOX, mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      if (list.some(m => m.col != null)) { const c = new THREE.Color(); list.forEach((m, i) => im.setColorAt(i, c.setScalar(m.col ?? 1))); im.instanceColor.needsUpdate = true; }
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = mat.userData.cast !== false; im.receiveShadow = true;
      im.name = key + '#inst';
      group.add(im);
    }
    for (const o of this.objects) group.add(o);
    return group;
  }
}

// World-space UVs so every texture tiles at real scale regardless of box size.
export function worldUV(g, tile, roofConst) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
  const inv = 1 / tile;
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    const ax = Math.abs(n[i]), ay = Math.abs(n[i + 1]), az = Math.abs(n[i + 2]);
    if (ay > ax && ay > az) {
      if (roofConst) { uv[j] = 0.004; uv[j + 1] = 0.004; } else { uv[j] = p[i] * inv; uv[j + 1] = p[i + 2] * inv; }
    } else if (ax > az) { uv[j] = p[i + 2] * inv; uv[j + 1] = p[i + 1] * inv; }
    else { uv[j] = p[i] * inv; uv[j + 1] = p[i + 1] * inv; }
  }
  g.attributes.uv.needsUpdate = true;
}

// A facade plane: origin at ground level on the left end (seen from outside), tangent along the facade.
// Local coords: u along the facade, v up, w outward. Box sizes: su along u, sv up, sw outward.
export class Face {
  constructor(b, ox, oz, tx, tz, len) {
    this.b = b; this.ox = ox; this.oz = oz; this.tx = tx; this.tz = tz; this.len = len;
    this.nx = -tz; this.nz = tx; this.ry = Math.atan2(-tz, tx);
  }
  pt(u, w) { return [this.ox + this.tx * u + this.nx * w, this.oz + this.tz * u + this.nz * w]; }
  box(key, u, v, w, su, sv, sw, rx = 0) { const [x, z] = this.pt(u, w); return this.b.box(key, su, sv, sw, x, v, z, this.ry, rx); }
  ibox(key, u, v, w, su, sv, sw) { const [x, z] = this.pt(u, w); this.b.ibox(key, su, sv, sw, x, v, z, this.ry); }
  // g is built in face-local space: x along the facade, y up, z outward.
  geo(key, g, u, v, w, sx = 1, sy = 1, sz = 1, local) {
    const [x, z] = this.pt(u, w);
    _q.setFromAxisAngle(Y_AXIS, this.ry);
    _m.compose(_p.set(x, v, z), _q, _s.set(sx, sy, sz));
    if (local) _m.multiply(local);
    return this.b.geo(key, g, _m);
  }
}

// ---------- reusable shapes (cached) ----------
const shapeCache = new Map();
function cached(k, make) { let g = shapeCache.get(k); if (!g) shapeCache.set(k, (g = make())); return g; }

// Region above a semicircular arch: width w, height h (>= w/2), extruded depth d, centred on z.
export function archFill(w, h, d) {
  return cached(`af${w.toFixed(3)}|${h.toFixed(3)}|${d}`, () => {
    const r = w / 2, s = new THREE.Shape();
    s.moveTo(-r, 0); s.lineTo(-r, h); s.lineTo(r, h); s.lineTo(r, 0);
    s.absarc(0, 0, r, 0, Math.PI, false);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 14 });
    g.translate(0, 0, -d / 2); return g;
  });
}
// Thin arch moulding: ring between r and r+t over the top half.
export function archRing(r, t, d) {
  return cached(`ar${r.toFixed(3)}|${t}|${d}`, () => {
    const s = new THREE.Shape();
    s.moveTo(r + t, 0); s.absarc(0, 0, r + t, 0, Math.PI, false);
    s.lineTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(r + t, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 14 });
    g.translate(0, 0, -d / 2); return g;
  });
}
export function halfDisc(r) { return cached(`hd${r.toFixed(3)}`, () => new THREE.CircleGeometry(r, 18, 0, Math.PI)); }
// A wall of length L and height H with n pointed arches, extruded depth d. x from 0..L.
export function arcadeWall(L, H, n, d, pier = 0.55, spring = 2.3) {
  return cached(`aw${L.toFixed(2)}|${H}|${n}|${d}|${pier}|${spring}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L, H); s.lineTo(0, H); s.lineTo(0, 0);
    const span = (L - pier * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const x0 = pier + i * (span + pier), x1 = x0 + span, xc = (x0 + x1) / 2;
      const top = Math.min(H - 0.35, spring + span * 0.62);
      const h = new THREE.Path();
      h.moveTo(x0, 0); h.lineTo(x1, 0); h.lineTo(x1, spring);
      h.quadraticCurveTo(x1, spring + (top - spring) * 0.72, xc, top);
      h.quadraticCurveTo(x0, spring + (top - spring) * 0.72, x0, spring);
      h.lineTo(x0, 0);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -d / 2); return g;
  });
}
// Crenellation strip along x (0..L): triangles ("sharafat") or stepped merlons.
export function crenels(L, tw, th, d, kind = 'tri') {
  return cached(`cr${L.toFixed(2)}|${tw}|${th}|${d}|${kind}`, () => {
    const n = Math.max(1, Math.round(L / tw)), w = L / n, s = new THREE.Shape();
    s.moveTo(0, 0);
    for (let i = 0; i < n; i++) {
      const x0 = i * w;
      if (kind === 'tri') { s.lineTo(x0 + w * 0.12, 0); s.lineTo(x0 + w * 0.5, th); s.lineTo(x0 + w * 0.88, 0); }
      else {
        s.lineTo(x0 + w * 0.1, 0); s.lineTo(x0 + w * 0.1, th * 0.45); s.lineTo(x0 + w * 0.25, th * 0.45); s.lineTo(x0 + w * 0.25, th * 0.75);
        s.lineTo(x0 + w * 0.38, th * 0.75); s.lineTo(x0 + w * 0.38, th); s.lineTo(x0 + w * 0.62, th); s.lineTo(x0 + w * 0.62, th * 0.75);
        s.lineTo(x0 + w * 0.75, th * 0.75); s.lineTo(x0 + w * 0.75, th * 0.45); s.lineTo(x0 + w * 0.9, th * 0.45); s.lineTo(x0 + w * 0.9, 0);
      }
    }
    s.lineTo(L, 0); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2); return g;
  });
}
export function cylinder(rt, rb, h, seg = 12) { return cached(`cy${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)); }
export function dishGeo() {
  return cached('dish', () => { const g = new THREE.SphereGeometry(0.5, 16, 5, 0, TAU, 0, 0.72); g.scale(1, 0.55, 1); return g; });
}

// Organic blob for tree canopies: displaced icosphere; displacement keyed on position so no cracks.
export function blobGeo(seed) {
  return cached(`blob${seed}`, () => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = hash(seed, Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)) / 4294967296;
      const s = 0.82 + k * 0.32;
      p.setXYZ(i, x * s, y * s, z * s);
    }
    g.computeVertexNormals(); return g;
  });
}

// Date palm crown: fronds as curved ribs with leaflet triangles. Built once, instanced everywhere.
export function palmCrownGeo() {
  return cached('palmCrown', () => {
    const pos = [], R = rng(77);
    const fronds = 17;
    for (let f = 0; f < fronds; f++) {
      const az = (f / fronds) * TAU + R.range(-0.15, 0.15);
      const lift = f % 3 === 0 ? 0.85 : f % 3 === 1 ? 0.35 : -0.05;
      const L = R.range(2.6, 3.3);
      const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
      const pt = s => { const th = lift - s * s * 1.9; return new THREE.Vector3(dir.x * Math.cos(th) * L * s, Math.sin(th) * L * s + 0.0, dir.z * Math.cos(th) * L * s); };
      const N = 12;
      for (let i = 1; i <= N; i++) {
        const s = i / (N + 1), p0 = pt(s), p1 = pt(s + 0.06);
        const fwd = p1.clone().sub(p0).normalize();
        const len = (Math.sin(Math.PI * Math.min(1, s * 1.15)) * 0.85 + 0.2) * (L / 3);
        for (const sg of [-1, 1]) {
          const tip = p0.clone().addScaledVector(side, sg * len).addScaledVector(fwd, len * 0.35).add(new THREE.Vector3(0, -len * 0.32, 0));
          const b2 = p0.clone().addScaledVector(fwd, 0.16);
          pos.push(p0.x, p0.y, p0.z, tip.x, tip.y, tip.z, b2.x, b2.y, b2.z);
        }
        // rib segment as a thin triangle
        const ps = pt(s - 1 / (N + 1));
        pos.push(ps.x, ps.y, ps.z, p0.x, p0.y + 0.05, p0.z, p0.x, p0.y - 0.04, p0.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    return g;
  });
}

// ---------- procedural textures ----------
function fbm(S, f0, oct, seed, gain = 0.5) {
  const out = new Float32Array(S * S), r = rng(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < oct; o++) {
    const f = f0 << o, lat = new Float32Array(f * f);
    for (let i = 0; i < f * f; i++) lat[i] = r();
    for (let y = 0; y < S; y++) {
      const fy = (y / S) * f, yi = Math.floor(fy), ty = fy - yi, sy = ty * ty * (3 - 2 * ty), y0 = yi % f, y1 = (yi + 1) % f;
      for (let x = 0; x < S; x++) {
        const fx = (x / S) * f, xi = Math.floor(fx), tx = fx - xi, sx = tx * tx * (3 - 2 * tx), x0 = xi % f, x1 = (xi + 1) % f;
        const a = lat[y0 * f + x0], b = lat[y0 * f + x1], c = lat[y1 * f + x0], d = lat[y1 * f + x1];
        const top = a + (b - a) * sx, bot = c + (d - c) * sx;
        out[y * S + x] += amp * (top + (bot - top) * sy);
      }
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function canvasTex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
function pixelTex(S, fill, opts) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
  fill(img.data, S); ctx.putImageData(img, 0, 0);
  return canvasTex(c, opts);
}
function mixFill(S, field, cA, cB, shade) {
  const A = hexRGB(cA), B = hexRGB(cB);
  return (d) => {
    for (let i = 0; i < S * S; i++) {
      const t = clamp(field[i], 0, 1), k = shade ? shade[i] : 1;
      d[i * 4] = (A[0] + (B[0] - A[0]) * t) * k; d[i * 4 + 1] = (A[1] + (B[1] - A[1]) * t) * k; d[i * 4 + 2] = (A[2] + (B[2] - A[2]) * t) * k; d[i * 4 + 3] = 255;
    }
  };
}

export function makeTextures() {
  const S = 512, T = {};
  // Coral stone and gypsum plaster: soft blotches plus grain.
  {
    const a = fbm(S, 4, 5, 11), b = fbm(S, 48, 2, 12);
    const f = a.map((v, i) => 0.55 + (v - 0.5) * 0.9 + (b[i] - 0.5) * 0.25), sh = b.map(v => 0.95 + v * 0.05);
    T.plaster = pixelTex(S, mixFill(S, f, '#c8ad86', '#ead9bb', sh));
    const bump = fbm(S, 24, 4, 13);
    T.plasterBump = pixelTex(S, d => { for (let i = 0; i < S * S; i++) { const v = bump[i] * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } }, { srgb: false });
  }
  // Painted render with dust streaks running down from the window line (multiplied by the paint colour).
  {
    const n = fbm(S, 8, 4, 21), R = rng(22), v = n.map(x => 0.93 + x * 0.07);
    for (let k = 0; k < 110; k++) {
      const x0 = R() * S, w = 2 + R() * 9, y0 = R() * S, len = 40 + R() * 240, a = 0.015 + R() * 0.05;
      for (let y = 0; y < len; y++) {
        const yy = Math.floor(y0 + y) % S, fall = 1 - y / len;
        for (let x = -w; x <= w; x++) { const xx = ((Math.floor(x0 + x) % S) + S) % S, edge = 1 - Math.abs(x) / w; v[yy * S + xx] -= a * fall * edge; }
      }
    }
    T.paint = pixelTex(S, d => { for (let i = 0; i < S * S; i++) { const c = clamp(v[i], 0, 1) * 255; d[i * 4] = c; d[i * 4 + 1] = c * 0.985; d[i * 4 + 2] = c * 0.96; d[i * 4 + 3] = 255; } });
  }
  { const n = fbm(S, 8, 5, 31); T.concrete = pixelTex(S, mixFill(S, n.map(x => (x - 0.3) * 1.6), '#a9a49b', '#cbc6bc')); }
  { const n = fbm(S, 16, 5, 41), m = fbm(S, 3, 3, 42); T.asphalt = pixelTex(S, mixFill(S, n.map((x, i) => (x - 0.35) * 1.4 + (m[i] - 0.5) * 0.5), '#2c2e31', '#4a4c4f')); }
  { const n = fbm(S, 6, 5, 51), g = fbm(S, 64, 2, 52); T.sand = pixelTex(S, mixFill(S, n.map((x, i) => (x - 0.3) * 1.5 + (g[i] - 0.5) * 0.25), '#c9ad7e', '#e6d2a8')); }
  // Interlocking pavers (2 m tile).
  {
    const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = rng(61);
    x.fillStyle = '#8f877c'; x.fillRect(0, 0, S, S);
    const bw = S / 10, bh = S / 20, tones = ['#c2b8a8', '#c9bfb0', '#bbb09f', '#c4b39f', '#cfc7b9'];
    for (let r = 0; r < 20; r++) for (let k = -1; k < 11; k++) {
      x.fillStyle = R.pick(tones); const ox = (r % 2) * bw * 0.5;
      x.fillRect(k * bw + ox + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
    T.pavers = canvasTex(c);
  }
  // Courtyard flagstones (4 m tile).
  {
    const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = rng(62);
    x.fillStyle = '#8c7d66'; x.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) { const h = R.range(60, 110); let xx = 0; while (xx < S) { const w = R.range(70, 150); x.fillStyle = `hsl(${R.range(34, 42)},${R.range(22, 32)}%,${R.range(66, 76)}%)`; x.fillRect(xx + 2, y + 2, Math.min(w, S - xx) - 4, Math.min(h, S - y) - 4); xx += w; } y += h; }
    T.flags = canvasTex(c);
  }
  // Painted kerb: diagonal stripes so it reads along both road directions.
  {
    T.curb = pixelTex(256, (d, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const k = Math.floor(((x + (s - y)) / s) * 2) % 2; const c = k ? 238 : 32; const i = (y * s + x) * 4; d[i] = c; d[i + 1] = c; d[i + 2] = k ? 232 : 32; d[i + 3] = 255; } });
  }
  // Teak grain.
  {
    const n = fbm(S, 4, 4, 71);
    T.teak = pixelTex(S, d => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; const g = 0.5 + 0.5 * Math.sin((x + n[i] * 60) * 0.22); const k = 0.75 + 0.25 * g; d[i * 4] = 104 * k; d[i * 4 + 1] = 70 * k; d[i * 4 + 2] = 43 * k; d[i * 4 + 3] = 255; } });
  }
  // Deck planks (podium roof).
  {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = rng(72);
    for (let i = 0; i < 16; i++) { x.fillStyle = `hsl(${R.range(28, 34)},${R.range(18, 26)}%,${R.range(60, 68)}%)`; x.fillRect(0, i * 16, 256, 15); }
    T.deck = canvasTex(c);
  }
  // Night windows for the clay city: 32 x 32 cells, cell (0,0) always dark (roofs sample it).
  {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), R = rng(81);
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      if ((i === 0 && j === 31) || !R.chance(0.34)) continue;
      const warm = R.chance(0.72), b = R.range(0.45, 1);
      x.fillStyle = warm ? `rgba(255,${190 + R() * 30},${120 + R() * 40},${b})` : `rgba(200,225,255,${b})`;
      x.fillRect(i * 16 + 3, j * 16 + 4, 10, 8);
    }
    T.cityWin = canvasTex(c);
  }
  // Date palm trunk: overlapping leaf bases.
  {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#6d5a43'; x.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 5; k++) {
      const cx = k * 32 + (r % 2) * 16, cy = r * 16;
      x.fillStyle = r % 2 ? '#8a7356' : '#7c664b'; x.beginPath(); x.moveTo(cx - 16, cy); x.lineTo(cx, cy + 15); x.lineTo(cx + 16, cy); x.closePath(); x.fill();
      x.strokeStyle = '#4e3f2e'; x.lineWidth = 1.5; x.stroke();
    }
    T.trunk = canvasTex(c);
  }
  // AC drip stain: dark at top, fading down, transparent.
  {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(60,48,36,0.75)'); g.addColorStop(0.35, 'rgba(70,56,42,0.35)'); g.addColorStop(1, 'rgba(70,56,42,0)');
    x.fillStyle = g; x.fillRect(8, 0, 48, 256);
    T.stain = canvasTex(c, { repeat: false });
  }
  // Awnings.
  T.awnings = ['#2f6b45', '#a8322f', '#2a4f86'].map(col => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#efe9de' : col; x.fillRect(i * 32, 0, 32, 64); }
    return canvasTex(c, { repeat: false });
  });
  // Shop sign atlas: 4 x 8 slots of 512 x 128, redrawn per build.
  {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    T.signCanvas = c; T.signs = canvasTex(c, { repeat: false }); T.signs.anisotropy = 8;
  }
  return T;
}

// ---------- materials ----------
export function makeMaterials(T) {
  const std = (o, ud = {}) => { const m = new THREE.MeshStandardMaterial(o); Object.assign(m.userData, ud); return m; };
  const M = {
    clay: std({ color: 0xe9e4dc, roughness: 0.93, emissive: 0xffffff, emissiveMap: T.cityWin, emissiveIntensity: 0 }, { tile: 96, roofConst: true }),
    // Old Dubai house
    plaster: std({ color: 0xffffff, map: T.plaster, bumpMap: T.plasterBump, bumpScale: 2.0, roughness: 0.95 }, { tile: 3 }),
    plasterTrim: std({ color: 0xf3eadb, map: T.plaster, roughness: 0.9 }, { tile: 3 }),
    plasterShade: std({ color: 0xcdbb9e, map: T.plaster, roughness: 0.95 }, { tile: 3 }),
    roofHouse: std({ color: 0xf2e8d6, map: T.plaster, roughness: 0.96 }, { tile: 4 }),
    sandPave: std({ color: 0xe9dcc4, map: T.sand, roughness: 1 }, { tile: 6, cast: false }),
    teak: std({ color: 0xffffff, map: T.teak, roughness: 0.7 }, { tile: 1.2 }),
    mangrove: std({ color: 0x5b4632, roughness: 0.9 }),
    void: std({ color: 0x17120e, roughness: 1 }, { cast: false }),
    flags: std({ color: 0xffffff, map: T.flags, roughness: 0.9 }, { tile: 4 }),
    foliage: std({ color: 0x4f6234, roughness: 0.9, flatShading: true }),
    trunk: std({ color: 0xffffff, map: T.trunk, roughness: 0.95 }, { uv: 'keep' }),
    palm: std({ color: 0x6a7d3b, roughness: 0.85, side: THREE.DoubleSide }, { uv: 'keep' }),
    // 80s Deira
    deiraPaint: std({ color: 0xe9dcc3, map: T.paint, roughness: 0.88 }, { tile: 6 }),
    deiraTrim: std({ color: 0xf6f1e8, map: T.paint, roughness: 0.85 }, { tile: 6 }),
    roofConcrete: std({ color: 0xffffff, map: T.concrete, roughness: 0.95 }, { tile: 6 }),
    glass: std({ color: 0x8a7a68, metalness: 0.75, roughness: 0.07, envMapIntensity: 1.2 }, { cast: false }),
    glassLit: std({ color: 0x8a7a68, metalness: 0.75, roughness: 0.07, envMapIntensity: 1.2, emissive: 0xffc98a, emissiveIntensity: 0 }, { cast: false }),
    frame: std({ color: 0xcfcac2, metalness: 0.5, roughness: 0.4 }),
    ac: std({ color: 0xe6e3dc, roughness: 0.55 }),
    acGrille: std({ color: 0x77736c, roughness: 0.7 }),
    stain: std({ color: 0xffffff, map: T.stain, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }, { uv: 'keep', cast: false }),
    steel: std({ color: 0x77797b, metalness: 0.6, roughness: 0.45 }),
    tank: std({ color: 0xf1efe9, roughness: 0.45 }),
    dish: std({ color: 0xeeeeea, roughness: 0.5, side: THREE.DoubleSide }),
    shopGlass: std({ color: 0x1a1d20, metalness: 0.4, roughness: 0.15, emissive: 0xffe2b8, emissiveIntensity: 0 }, { cast: false }),
    shutter: std({ color: 0xb8b9b6, metalness: 0.5, roughness: 0.5 }),
    sign: std({ color: 0xffffff, map: T.signs, emissive: 0xffffff, emissiveMap: T.signs, emissiveIntensity: 0, roughness: 0.6 }, { uv: 'keep' }),
    awning0: std({ map: T.awnings[0], roughness: 0.9, side: THREE.DoubleSide }, { uv: 'keep' }),
    awning1: std({ map: T.awnings[1], roughness: 0.9, side: THREE.DoubleSide }, { uv: 'keep' }),
    awning2: std({ map: T.awnings[2], roughness: 0.9, side: THREE.DoubleSide }, { uv: 'keep' }),
    curtain0: std({ color: 0xcfc3ab, roughness: 0.35, metalness: 0.25 }, { cast: false }),
    curtain1: std({ color: 0x7c5048, roughness: 0.35, metalness: 0.25 }, { cast: false }),
    curtain2: std({ color: 0x5b726c, roughness: 0.35, metalness: 0.25 }, { cast: false }),
    curtain3: std({ color: 0xa88f5e, roughness: 0.35, metalness: 0.25 }, { cast: false }),
    // Marina tower
    tglass: std({ color: 0x3a6a8c, metalness: 1.0, roughness: 0.05, envMapIntensity: 1.0 }, { uv: 'keep' }),
    tglassLit: std({ color: 0x3a6a8c, metalness: 0.6, roughness: 0.1, emissive: 0xffd2a0, emissiveIntensity: 0 }, { uv: 'keep' }),
    tglassLit2: std({ color: 0x3a6a8c, metalness: 0.6, roughness: 0.1, emissive: 0xdbe9ff, emissiveIntensity: 0 }, { uv: 'keep' }),
    tspandrel: std({ color: 0x2b3238, metalness: 0.6, roughness: 0.3 }, { uv: 'keep' }),
    tfin: std({ color: 0xd9dbdc, metalness: 0.75, roughness: 0.3 }, { uv: 'keep' }),
    crownLight: std({ color: 0xe8f0ff, emissive: 0xcfe2ff, emissiveIntensity: 0, roughness: 0.4 }, { uv: 'keep' }),
    aviation: std({ color: 0x661111, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.5 }, { uv: 'keep', cast: false }),
    podiumClad: std({ color: 0xd8d3ca, map: T.concrete, roughness: 0.7 }, { tile: 8 }),
    podiumDark: std({ color: 0x23272b, roughness: 0.9 }),
    louver: std({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 }, { uv: 'keep' }),
    deck: std({ color: 0xffffff, map: T.deck, roughness: 0.8 }, { tile: 4 }),
    pool: std({ color: 0x23a3c4, metalness: 0.1, roughness: 0.04, emissive: 0x2cc7e8, emissiveIntensity: 0 }, { cast: false }),
    bmu: std({ color: 0xe9e6de, metalness: 0.3, roughness: 0.5 }, { uv: 'keep' }),
    // City
    asphalt: std({ color: 0xffffff, map: T.asphalt, roughness: 0.95 }, { tile: 8, cast: false }),
    pavers: std({ color: 0xffffff, map: T.pavers, roughness: 0.9 }, { tile: 2, cast: false }),
    curb: std({ color: 0xffffff, map: T.curb, roughness: 0.8 }, { tile: 2 }),
    sand: std({ color: 0xffffff, map: T.sand, roughness: 1 }, { tile: 12, cast: false }),
    marking: std({ color: 0xf2f0ea, roughness: 0.7 }, { uv: 'keep', cast: false }),
    lampPole: std({ color: 0x8e9396, metalness: 0.6, roughness: 0.4 }, { uv: 'keep' }),
    lampHead: std({ color: 0xf4f0e6, emissive: 0xffd9a6, emissiveIntensity: 0, roughness: 0.4 }, { uv: 'keep' }),
    car: std({ color: 0xffffff, metalness: 0.5, roughness: 0.3 }, { uv: 'keep' }),
    carGlass: std({ color: 0x15191d, metalness: 0.7, roughness: 0.1 }, { uv: 'keep' }),
    water: std({ color: 0x0f3a4a, metalness: 0.9, roughness: 0.06 }, { uv: 'keep', cast: false }),
    boat: std({ color: 0xf6f6f2, roughness: 0.35 }, { uv: 'keep' }),
    grass: std({ color: 0x6f8a45, roughness: 1 }, { tile: 4, cast: false }),
  };
  T.awnings.forEach(t => { t.wrapS = THREE.RepeatWrapping; });
  M.clay.emissiveMap.repeat.set(1, 96 / 112);
  T.trunk.repeat.set(3, 9);
  // Lit variants share the base look so daylight shows no checkerboard; only the glow differs at night.
  M.glassLit.metalness = M.glass.metalness; M.glassLit.roughness = M.glass.roughness;
  for (const k of ['tglassLit', 'tglassLit2']) { M[k].metalness = 1.0; M[k].roughness = 0.05; }
  return M;
}

// ---------- palms (instanced: one trunk + one crown per palm) ----------
export function makePalms(list, M) {
  const g = new THREE.Group();
  if (!list.length) return g;
  const trunkG = cached('trunkG', () => { const c = new THREE.CylinderGeometry(0.17, 0.27, 1, 9, 1, true); c.translate(0, 0.5, 0); return c; });
  const tr = new THREE.InstancedMesh(trunkG, M.trunk, list.length), cr = new THREE.InstancedMesh(palmCrownGeo(), M.palm, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), base = new THREE.Vector3(), top = new THREE.Vector3();
  list.forEach((p, i) => {
    e.set(p.lean || 0, p.rot || 0, p.lean2 || 0, 'YXZ'); q.setFromEuler(e);
    base.set(p.x, p.y, p.z);
    m.compose(base, q, new THREE.Vector3(p.r || 1, p.h, p.r || 1)); tr.setMatrixAt(i, m);
    top.set(0, p.h - 0.1, 0).applyQuaternion(q).add(base);
    const s = p.s || 1;
    m.compose(top, new THREE.Quaternion().setFromAxisAngle(Y_AXIS, (p.rot || 0) * 3.7), new THREE.Vector3(s, s, s)); cr.setMatrixAt(i, m);
  });
  tr.castShadow = cr.castShadow = true; tr.receiveShadow = cr.receiveShadow = true;
  tr.computeBoundingSphere(); cr.computeBoundingSphere();
  g.add(tr, cr);
  return g;
}

// ---------- shop signs ----------
export const TRADES = [
  ['GROCERY', 'بقالة'], ['TAILORING', 'خياط'], ['PHARMACY', 'صيدلية'], ['RESTAURANT', 'مطعم'],
  ['LAUNDRY', 'مغسلة'], ['MOBILE PHONES', 'هواتف متحركة'], ['TEXTILES', 'أقمشة'], ['CAFETERIA', 'كافتيريا'],
  ['SPICES', 'بهارات'], ['PERFUMES', 'عطور'], ['ELECTRONICS', 'إلكترونيات'], ['SWEETS', 'حلويات'],
  ['BARBER', 'حلاق'], ['TRAVEL', 'سفريات'], ['HARDWARE', 'أدوات'], ['GENERAL TRADING', 'تجارة عامة'],
];
const SIGN_STYLES = [['#b4262b', '#ffffff'], ['#1d5e38', '#ffffff'], ['#1b4a8c', '#ffffff'], ['#f4f0e6', '#1b2a44'], ['#f1bf2c', '#1a1a1a'], ['#171717', '#f1bf2c'], ['#ffffff', '#b4262b']];
export function drawSigns(T, list) {
  const c = T.signCanvas, x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  list.forEach((s, i) => {
    const col = i % 4, row = Math.floor(i / 4) % 8, X = col * 512, Yp = row * 128;
    const [bg, fg] = SIGN_STYLES[s.style % SIGN_STYLES.length];
    x.fillStyle = bg; x.fillRect(X, Yp, 512, 128);
    x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 4; x.strokeRect(X + 8, Yp + 8, 496, 112); x.globalAlpha = 1;
    x.fillStyle = fg; x.textBaseline = 'middle';
    x.textAlign = 'left';
    let fs = 50; x.font = `800 ${fs}px Inter, "Segoe UI", Arial, sans-serif`;
    while (x.measureText(s.en).width > 238 && fs > 22) { fs -= 2; x.font = `800 ${fs}px Inter, "Segoe UI", Arial, sans-serif`; }
    x.fillText(s.en, X + 22, Yp + 66);
    x.textAlign = 'right'; x.direction = 'rtl';
    let fa = 58; x.font = `700 ${fa}px "Noto Kufi Arabic", "Segoe UI", Tahoma, "Geeza Pro", sans-serif`;
    while (x.measureText(s.ar).width > 220 && fa > 24) { fa -= 2; x.font = `700 ${fa}px "Noto Kufi Arabic", "Segoe UI", Tahoma, "Geeza Pro", sans-serif`; }
    x.fillText(s.ar, X + 492, Yp + 62); x.direction = 'ltr';
    x.globalAlpha = 0.35; x.fillRect(X + 256, Yp + 26, 2, 76); x.globalAlpha = 1;
  });
  T.signs.needsUpdate = true;
}
export function signPlane(slot) {
  const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv, col = slot % 4, row = Math.floor(slot / 4) % 8;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, (7 - row + uv.getY(i)) / 8);
  return g;
}
