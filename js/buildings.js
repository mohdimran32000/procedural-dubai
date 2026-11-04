// buildings.js - the three rule sets. Each build() turns a handful of numbers into a building
// and counts what it placed, so the asset register comes from the same rules as the geometry.
import * as THREE from 'three';
import {
  Builder, Face, rng, hash, clamp, lerp, TAU, archFill, archRing, halfDisc, arcadeWall, crenels,
  cylinder, dishGeo, blobGeo, makePalms, drawSigns, signPlane, TRADES, Y_AXIS,
} from './core.js';

const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = a => new THREE.Matrix4().makeRotationX(a);
const RZ = a => new THREE.Matrix4().makeRotationZ(a);
const S3 = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);
const mul = (...ms) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4());
const FAN = new THREE.CircleGeometry(0.19, 16);
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// =====================================================================================
// 1. OLD DUBAI COURTYARD HOUSE
// =====================================================================================
export const HOUSE = {
  id: 'house', name: 'Courtyard house', era: 'Old Dubai', district: 'heritage',
  schema: [
    { key: 'width', label: 'Plot width', type: 'range', min: 14, max: 32, step: 1, def: 24, unit: 'm' },
    { key: 'depth', label: 'Plot depth', type: 'range', min: 14, max: 32, step: 1, def: 22, unit: 'm' },
    { key: 'towers', label: 'Wind towers', type: 'range', min: 0, max: 4, step: 1, def: 2 },
    { key: 'towerHeight', label: 'Tower height', type: 'range', min: 0, max: 100, step: 5, def: 60, unit: '%' },
    { key: 'upper', label: 'Upper rooms', type: 'range', min: 0, max: 3, step: 1, def: 1 },
    { key: 'arcade', label: 'Courtyard arcade', type: 'choice', options: [['none', 'None'], ['two', 'Two sides'], ['all', 'All sides']], def: 'two' },
    { key: 'parapet', label: 'Parapet', type: 'choice', options: [['tri', 'Crenellated'], ['step', 'Stepped'], ['plain', 'Plain']], def: 'tri' },
    { key: 'yard', label: 'Courtyard', type: 'choice', options: [['ghaf', 'Ghaf tree'], ['palms', 'Date palms'], ['open', 'Open']], def: 'ghaf' },
    { key: 'seed', label: 'Seed', type: 'seed', def: 7 },
  ],
  build(P, ctx) {
    const R = rng(hash('house', P.seed)), b = new Builder(), M = ctx.mats;
    const W = P.width, D = P.depth, base = 0.35, hg = 4.3, t = 0.6, rd = 4.6;
    const roofY = base + hg + 0.35, wallTop = roofY - 0.01, wh = wallTop - base;
    const cx = Math.max(1.6, W / 2 - rd), cz = Math.max(1.6, D / 2 - rd);
    const st = { doors: 0, shutters: 0, roof: W * D - 4 * cx * cz, plaster: 0, trees: 0, upper: 0 };
    const palms = [];
    const kind = P.parapet === 'step' ? 'step' : 'tri';

    const door = (F, u, w) => {
      F.box('plasterTrim', u - w / 2 - 0.15, base + 1.6, 0.06, 0.26, 3.2, 0.14);
      F.box('plasterTrim', u + w / 2 + 0.15, base + 1.6, 0.06, 0.26, 3.2, 0.14);
      F.box('plasterTrim', u, base + 3.32, 0.06, w + 0.56, 0.32, 0.15);
      F.box('teak', u, base + 1.42, 0.02, w, 2.84, 0.08);
      F.box('mangrove', u, base + 1.42, 0.064, 0.06, 2.84, 0.02);
      for (let y = 0.45; y < 2.8; y += 0.6) F.box('mangrove', u, base + y, 0.064, w - 0.12, 0.05, 0.02);
      st.doors++;
    };
    const win = F => u => {
      F.box('void', u, base + 1.8, 0.005, 0.92, 1.2, 0.01);
      if (R.chance(0.72)) {
        F.box('teak', u - 0.235, base + 1.8, 0.03, 0.44, 1.16, 0.05);
        F.box('teak', u + 0.235, base + 1.8, 0.03, 0.44, 1.16, 0.05);
        F.box('mangrove', u, base + 1.8, 0.058, 0.03, 1.16, 0.01);
        st.shutters++;
      } else {
        for (let k = -2; k <= 2; k++) F.box('steel', u + k * 0.17, base + 1.8, 0.03, 0.026, 1.18, 0.026);
      }
      F.box('plasterTrim', u, base + 2.52, 0.06, 1.22, 0.16, 0.13);
      F.box('plasterTrim', u, base + 1.15, 0.06, 1.16, 0.09, 0.14);
    };
    // Roof edge kit: cornice, mangrove pole ends, parapet and crenels along one face.
    const roofEdge = (F, yRoof, inset, ph = 0.7) => {
      const L = F.len;
      F.box('plasterTrim', L / 2, yRoof - 0.42, 0.07, L + 0.14, 0.2, 0.14);
      for (let u = 0.35; u < L - 0.2; u += 0.55) F.geo('mangrove', cylinder(0.06, 0.06, 0.42, 6), u, yRoof - 0.72, 0.12, 1, 1, 1, RX(Math.PI / 2));
      const u0 = inset ? 0.3 : 0, Lp = L - 2 * u0;
      F.box('plaster', u0 + Lp / 2, yRoof + ph / 2, -0.15, Lp, ph, 0.3);
      if (P.parapet !== 'plain') F.geo('plaster', crenels(Lp, 0.62, 0.42, 0.3, kind), u0, yRoof + ph, -0.15);
    };

    // plinth, courtyard paving
    b.box('plasterTrim', W + 0.6, base, D + 0.6, 0, base / 2, 0);
    b.box('flags', 2 * cx, 0.03, 2 * cz, 0, base + 0.015, 0);
    // outer and courtyard walls
    b.box('plaster', W, wh, t, 0, base + wh / 2, D / 2 - t / 2);
    b.box('plaster', W, wh, t, 0, base + wh / 2, -D / 2 + t / 2);
    b.box('plaster', t, wh, D - 2 * t, W / 2 - t / 2, base + wh / 2, 0);
    b.box('plaster', t, wh, D - 2 * t, -W / 2 + t / 2, base + wh / 2, 0);
    b.box('plaster', 2 * cx + 2 * t, wh, t, 0, base + wh / 2, cz + t / 2);
    b.box('plaster', 2 * cx + 2 * t, wh, t, 0, base + wh / 2, -cz - t / 2);
    b.box('plaster', t, wh, 2 * cz, cx + t / 2, base + wh / 2, 0);
    b.box('plaster', t, wh, 2 * cz, -cx - t / 2, base + wh / 2, 0);
    st.plaster += 2 * (W + D) * (hg + 1) + 4 * (cx + cz) * hg;
    // roof ring
    const ry0 = roofY - 0.175, fz = (D / 2 + cz) / 2, fd = D / 2 - cz - 0.04, sx = (W / 2 + cx) / 2, sw = W / 2 - cx - 0.04;
    b.box('roofHouse', W - 0.04, 0.35, fd, 0, ry0, fz);
    b.box('roofHouse', W - 0.04, 0.35, fd, 0, ry0, -fz);
    b.box('roofHouse', sw, 0.35, 2 * cz, sx, ry0, 0);
    b.box('roofHouse', sw, 0.35, 2 * cz, -sx, ry0, 0);

    // outer faces
    const outer = [new Face(b, -W / 2, D / 2, 1, 0, W), new Face(b, W / 2, D / 2, 0, -1, D), new Face(b, W / 2, -D / 2, -1, 0, W), new Face(b, -W / 2, -D / 2, 0, 1, D)];
    outer.forEach((F, fi) => {
      const L = F.len, n = Math.max(2, Math.round(L / 2.0)), pitch = L / n;
      for (let k = 1; k < n; k++) F.box('plasterTrim', k * pitch, base + 0.25 + (hg - 0.8) / 2, 0.05, 0.3, hg - 0.8, 0.1);
      roofEdge(F, roofY, fi % 2 === 1);
      const w = win(F);
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) * pitch;
        if (fi === 0 && k === Math.floor(n / 2)) { door(F, u, 1.7); continue; }
        if (fi === 1 && k === 1 && n > 2) { door(F, u, 1.2); continue; }
        if (R.chance(0.62)) w(u);
        if (R.chance(0.45)) F.box('void', u, base + 3.5, 0.004, 0.3, 0.42, 0.01);
      }
    });

    // courtyard faces (normals point into the courtyard)
    const inner = [new Face(b, cx, cz, -1, 0, 2 * cx), new Face(b, -cx, cz, 0, -1, 2 * cz), new Face(b, -cx, -cz, 1, 0, 2 * cx), new Face(b, cx, -cz, 0, 1, 2 * cz)];
    const ad = 2.3;
    const want = P.arcade === 'all' ? [0, 1, 2, 3] : P.arcade === 'two' ? [0, 2] : [];
    const canFB = 2 * cz - 2 * ad >= 3, canLR = 2 * cx - 2 * ad >= 3;
    const arc = [0, 1, 2, 3].map(k => want.includes(k) && (k % 2 === 0 ? canFB : canLR));
    inner.forEach((F, k) => {
      const L = F.len, n = Math.max(1, Math.round(L / 3.2)), w = win(F);
      for (let i = 0; i < n; i++) { const u = (i + 0.5) * L / n; if (i % 2 === 0) door(F, u, 1.2); else w(u); }
      F.box('plasterTrim', L / 2, roofY - 0.42, 0.07, L, 0.2, 0.14);
      if (arc[k]) {
        const u0 = k % 2 === 1 && (arc[0] || arc[2]) ? ad : 0, La = L - 2 * u0, na = Math.max(1, Math.round(La / 2.7));
        F.geo('plaster', arcadeWall(La, wh, na, 0.45, 0.5, 2.2), u0, base, ad);
        F.box('roofHouse', La, 0.35, ad - 0.02, u0 + La / 2, ry0, ad / 2);
        F.box('flags', La, 0.12, ad, u0 + La / 2, base + 0.06, ad / 2);
        F.box('plaster', La, 0.5, 0.25, u0 + La / 2, roofY + 0.25, ad + 0.1);
        F.box('plasterTrim', La, 0.18, 0.14, u0 + La / 2, roofY - 0.42, ad + 0.3);
        st.roof += La * ad;
      } else {
        F.box('plaster', L, 0.5, 0.25, L / 2, roofY + 0.25, -0.125);
      }
    });
    const ox0 = -cx + (arc[1] ? ad : 0), ox1 = cx - (arc[3] ? ad : 0), oz0 = -cz + (arc[2] ? ad : 0), oz1 = cz - (arc[0] ? ad : 0);
    const ocx = (ox0 + ox1) / 2, ocz = (oz0 + oz1) / 2, ohx = (ox1 - ox0) / 2, ohz = (oz1 - oz0) / 2;

    // courtyard planting
    if (P.yard === 'ghaf') {
      const rc = clamp(Math.min(ohx, ohz) * 0.85, 1.4, 3.4);
      b.geo('mangrove', cylinder(0.13, 0.22, 2.8, 7), mul(T(ocx, base + 1.4, ocz), RZ(0.12)));
      b.geo('mangrove', cylinder(0.08, 0.13, 2.4, 6), mul(T(ocx + 0.45, base + 3.2, ocz + 0.1), RZ(-0.55)));
      b.geo('mangrove', cylinder(0.08, 0.13, 2.2, 6), mul(T(ocx - 0.35, base + 3.1, ocz - 0.2), RX(0.5), RZ(0.4)));
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + R.range(-0.3, 0.3), d = k === 0 ? 0 : rc * R.range(0.35, 0.75), r = rc * R.range(0.42, 0.62);
        b.geo('foliage', blobGeo(k % 5), mul(T(ocx + Math.cos(a) * d, base + 4.3 + R.range(-0.4, 0.6), ocz + Math.sin(a) * d), S3(r, r * 0.55, r)));
      }
      st.trees = 1;
    } else if (P.yard === 'palms') {
      const n = ohx * ohz > 10 ? 3 : 2;
      for (let k = 0; k < n; k++) palms.push({ x: ocx + R.range(-ohx, ohx) * 0.55, y: base, z: ocz + R.range(-ohz, ohz) * 0.55, h: R.range(5.5, 8.6), s: R.range(0.8, 1), rot: R() * TAU, lean: R.range(-0.09, 0.09), lean2: R.range(-0.09, 0.09) });
      st.trees = n;
    }
    if (P.yard !== 'ghaf' || Math.min(ohx, ohz) > 3.2) {
      const wx = ocx + ohx * 0.55, wz = ocz - ohz * 0.5;
      b.geo('plasterTrim', cylinder(0.7, 0.76, 0.75, 18), T(wx, base + 0.37, wz));
      b.geo('void', cylinder(0.55, 0.55, 0.02, 18), T(wx, base + 0.76, wz));
    }

    // upper rooms on the roof ring (middle of a strip, clear of the corner towers)
    const order = shuffle([0, 1, 2, 3], R);
    let topY = roofY + 1.2;
    for (const s of order.slice(0, P.upper)) {
      const c = s % 2 === 0 ? cx : cz;
      const Lr = clamp(2 * c * R.range(0.65, 0.95), 3, 2 * c), dr = rd - 0.5, hr = 3.3;
      const off = R.range(-1, 1) * (c - Lr / 2);
      let x, z, wx, wz;
      if (s === 0) { x = off; z = (D / 2 + cz) / 2; wx = Lr; wz = dr; }
      else if (s === 2) { x = off; z = -(D / 2 + cz) / 2; wx = Lr; wz = dr; }
      else if (s === 1) { x = (W / 2 + cx) / 2; z = off; wx = dr; wz = Lr; }
      else { x = -(W / 2 + cx) / 2; z = off; wx = dr; wz = Lr; }
      b.box('plaster', wx, hr, wz, x, roofY + hr / 2, z);
      b.box('roofHouse', wx - 0.04, 0.3, wz - 0.04, x, roofY + hr + 0.14, z);
      const ry = roofY + hr + 0.3;
      const fs = [new Face(b, x - wx / 2, z + wz / 2, 1, 0, wx), new Face(b, x + wx / 2, z + wz / 2, 0, -1, wz), new Face(b, x + wx / 2, z - wz / 2, -1, 0, wx), new Face(b, x - wx / 2, z - wz / 2, 0, 1, wz)];
      fs.forEach((F, fi) => {
        roofEdge(F, ry, fi % 2 === 1, 0.6);
        const nw = Math.max(1, Math.round(F.len / 2.6));
        for (let i = 0; i < nw; i++) {
          const u = (i + 0.5) * F.len / nw, yb = roofY + 0.55;
          F.box('void', u, yb + 0.75, 0.005, 0.85, 1.25, 0.01);
          if (R.chance(0.7)) { F.box('teak', u - 0.215, yb + 0.75, 0.03, 0.4, 1.2, 0.05); F.box('teak', u + 0.215, yb + 0.75, 0.03, 0.4, 1.2, 0.05); st.shutters++; }
          F.box('plasterTrim', u, yb + 1.46, 0.06, 1.12, 0.15, 0.13);
        }
      });
      st.roof += wx * wz; st.plaster += 2 * (wx + wz) * hr; st.upper++;
      topY = Math.max(topY, ry + 1.1);
    }

    // wind towers (barjeel) on the corner rooms
    const corners = shuffle([[1, 1], [-1, 1], [1, -1], [-1, -1]], R);
    const hp = P.towerHeight / 100, Ht = lerp(7.5, 12.5, hp), oh = lerp(2.8, 4.4, hp), s = 3.1;
    for (let k = 0; k < P.towers; k++) {
      const [sxn, szn] = corners[k], x = sxn * (W / 2 - rd / 2), z = szn * (D / 2 - rd / 2), y0 = roofY, yl = y0 + Ht - oh;
      b.box('plaster', s, Ht - oh, s, x, y0 + (Ht - oh) / 2, z);
      const tf = [new Face(b, x - s / 2, z + s / 2, 1, 0, s), new Face(b, x + s / 2, z + s / 2, 0, -1, s), new Face(b, x + s / 2, z - s / 2, -1, 0, s), new Face(b, x - s / 2, z - s / 2, 0, 1, s)];
      tf.forEach(F => {
        F.box('plasterTrim', s * 0.3, y0 + 0.4 + (Ht - oh - 0.8) / 2, 0.04, 0.22, Ht - oh - 0.8, 0.08);
        F.box('plasterTrim', s * 0.7, y0 + 0.4 + (Ht - oh - 0.8) / 2, 0.04, 0.22, Ht - oh - 0.8, 0.08);
        F.box('plaster', s / 3, yl + oh / 2, -0.16, 0.2, oh, 0.32);
        F.box('plaster', (2 * s) / 3, yl + oh / 2, -0.16, 0.2, oh, 0.32);
      });
      b.box('plasterTrim', s + 0.18, 0.28, s + 0.18, x, yl, z);
      for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.box('plaster', 0.5, oh, 0.5, x + px * (s / 2 - 0.25), yl + oh / 2, z + pz * (s / 2 - 0.25));
      b.box('plasterShade', s * 1.28, oh, 0.12, x, yl + oh / 2, z, Math.PI / 4);
      b.box('plasterShade', s * 1.28, oh, 0.12, x, yl + oh / 2, z, -Math.PI / 4);
      b.box('void', s - 0.4, 0.05, s - 0.4, x, yl + 0.16, z);
      const yc = yl + oh;
      b.box('plasterTrim', s + 0.32, 0.34, s + 0.32, x, yc + 0.17, z);
      const cs = s + 0.32;
      const cf = [new Face(b, x - cs / 2, z + cs / 2, 1, 0, cs), new Face(b, x + cs / 2, z + cs / 2, 0, -1, cs), new Face(b, x + cs / 2, z - cs / 2, -1, 0, cs), new Face(b, x - cs / 2, z - cs / 2, 0, 1, cs)];
      cf.forEach((F, fi) => { const u0 = fi % 2 ? 0.16 : 0; F.geo('plasterTrim', crenels(cs - 2 * u0, 0.44, 0.38, 0.16, kind), u0, yc + 0.34, -0.08); });
      b.geo('mangrove', cylinder(0.055, 0.055, s + 0.9, 6), mul(T(x, yl + oh * 0.34, z + s * 0.2), RZ(Math.PI / 2)));
      b.geo('mangrove', cylinder(0.055, 0.055, s + 0.9, 6), mul(T(x, yl + oh * 0.34, z - s * 0.2), RZ(Math.PI / 2)));
      b.geo('mangrove', cylinder(0.055, 0.055, s + 0.9, 6), mul(T(x + s * 0.2, yl + oh * 0.7, z), RX(Math.PI / 2)));
      b.geo('mangrove', cylinder(0.055, 0.055, s + 0.9, 6), mul(T(x - s * 0.2, yl + oh * 0.7, z), RX(Math.PI / 2)));
      st.plaster += 4 * s * Ht;
      topY = Math.max(topY, yc + 0.8);
    }

    const group = b.build(M);
    group.add(makePalms(palms, M));
    const ringRooms = Math.max(4, Math.round((2 * (W - rd) + 2 * (D - rd)) / 4.6));
    return {
      group,
      bounds: { w: W + 0.6, d: D + 0.6, h: topY },
      plot: { w: W + 10, d: D + 10 },
      reg: [
        { key: 'towers', label: 'Wind towers', value: P.towers, rule: 'one per corner room you ask for' },
        { key: 'ac', label: 'AC units', value: 0, rule: 'wind towers and 60 cm walls do the cooling', hl: true },
        { key: 'rooms', label: 'Rooms', value: ringRooms + st.upper, rule: 'one per 4.6 m of the ring, plus upper rooms' },
        { key: 'teak', label: 'Teak doors and shutters', value: st.doors + st.shutters, rule: 'counted as they are placed' },
        { key: 'roof', label: 'Flat roof to re-seal', value: Math.round(st.roof), unit: 'm²', rule: 'roof ring, arcades and upper rooms' },
        { key: 'plaster', label: 'Lime plaster walls', value: Math.round(st.plaster), unit: 'm²', rule: 'outer, courtyard and tower walls' },
        { key: 'yard', label: 'Courtyard', value: Math.round(4 * cx * cz), unit: 'm²', rule: 'open to the sky' },
      ],
    };
  },
};

// =====================================================================================
// 2. 80s DEIRA MID-RISE
// =====================================================================================
const PAINTS = {
  sand: ['#dcc49b', '#f3e9d5'], white: ['#e9e5dc', '#ffffff'], blue: ['#bcd0dc', '#f2f1ec'],
  salmon: ['#dfb39a', '#f6ece2'], mint: ['#c5d8bd', '#f3f1e8'], ivory: ['#e6dcc6', '#fbf7ee'],
};
const GLASS = ['#8a7a68', '#6f8798', '#6f8a80', '#8c949a'];

export const DEIRA = {
  id: 'deira', name: 'Mid-rise', era: '80s Deira', district: 'deira',
  schema: [
    { key: 'floors', label: 'Floors above shops', type: 'range', min: 2, max: 14, step: 1, def: 8 },
    { key: 'baysX', label: 'Bays, front', type: 'range', min: 3, max: 10, step: 1, def: 6 },
    { key: 'baysY', label: 'Bays, side', type: 'range', min: 2, max: 6, step: 1, def: 4 },
    { key: 'style', label: 'Facade style', type: 'choice', options: [['arches', 'Arches'], ['bands', 'Bands'], ['grid', 'Grid']], def: 'arches' },
    { key: 'balcony', label: 'Balconies', type: 'choice', options: [['none', 'None'], ['solid', 'Solid'], ['rail', 'Railing']], def: 'solid' },
    { key: 'pattern', label: 'Balcony pattern', type: 'choice', options: [['all', 'Every bay'], ['alt', 'Alternate'], ['floors', 'Every 2nd floor'], ['random', 'Random']], def: 'alt' },
    { key: 'ac', label: 'AC units on facade', type: 'range', min: 0, max: 100, step: 5, def: 60, unit: '%' },
    { key: 'arcade', label: 'Shop arcade', type: 'toggle', def: true },
    { key: 'signs', label: 'Shop signs', type: 'toggle', def: true },
    { key: 'paint', label: 'Paint', type: 'choice', options: [['seed', 'Seed'], ['sand', 'Sand'], ['white', 'White'], ['blue', 'Blue'], ['salmon', 'Salmon'], ['mint', 'Mint']], def: 'seed' },
    { key: 'seed', label: 'Seed', type: 'seed', def: 3 },
  ],
  build(P, ctx) {
    const R = rng(hash('deira', P.seed)), M = ctx.mats, b = new Builder();
    const bw = 3.6, g = 4.6, fh = 3.1, nf = P.floors, nx = P.baysX, nz = P.baysY;
    const W = nx * bw, D = nz * bw, H = g + nf * fh;
    const pk = P.paint === 'seed' ? R.pick(Object.keys(PAINTS)) : P.paint;
    M.deiraPaint.color.set(PAINTS[pk][0]); M.deiraTrim.color.set(PAINTS[pk][1]);
    const gt = R.pick(GLASS); M.glass.color.set(gt); M.glassLit.color.set(gt);
    const st = { ac: 0, windows: 0, balconies: 0, tanks: 0, shops: 0, open: 0 };
    const arcade = P.arcade, ad = arcade ? 2.8 : 0.3;
    const balOn = (i, j) => {
      if (P.balcony === 'none') return false;
      if (P.pattern === 'all') return true;
      if (P.pattern === 'alt') return (i % 2) === 1;
      if (P.pattern === 'floors') return (j % 2) === 0;
      return hash(P.seed, i, j) % 3 === 0;
    };
    const paneKey = () => { const r = R(); return r < 0.4 ? 'glassLit' : r < 0.7 ? 'curtain' + R.int(0, 3) : 'glass'; };

    // cores (upper floors, and the ground floor set back behind the arcade)
    b.box('deiraPaint', W - 0.6, H - g, D - 0.6, 0, g + (H - g) / 2, 0);
    b.box('podiumDark', W - 0.6, g, D - 0.3 - ad, 0, g / 2, (0.3 - ad) / 2);

    const faces = [
      { F: new Face(b, -W / 2, D / 2, 1, 0, W), n: nx, role: 'main', shops: true },
      { F: new Face(b, W / 2, D / 2, 0, -1, D), n: nz, role: 'side', shops: true },
      { F: new Face(b, W / 2, -D / 2, -1, 0, W), n: nx, role: 'main', shops: false },
      { F: new Face(b, -W / 2, -D / 2, 0, 1, D), n: nz, role: 'party', shops: false },
    ];
    const bay = (fc, i, j, v0) => {
      const F = fc.F, u0 = i * bw, uc = u0 + bw / 2;
      if (fc.role === 'party') {
        F.box('deiraPaint', uc, v0 + fh / 2, -0.15, bw, fh, 0.3);
        if ((i + j) % 2 === 0) { F.box('glass', uc, v0 + 2.0, 0.01, 0.6, 0.55, 0.02); F.box('deiraTrim', uc, v0 + 1.69, 0.04, 0.78, 0.07, 0.1); st.windows++; }
        return;
      }
      const isDoor = fc.role === 'main' && balOn(i, j);
      const ww = isDoor ? 2.1 : 1.7, sill = isDoor ? 0 : 0.9;
      const arch = P.style === 'arches' && !isDoor, r = ww / 2;
      const wh = isDoor ? 2.35 : arch ? 1.95 : 1.55, hr = arch ? wh - r : wh, top = sill + wh, pw = (bw - ww) / 2;
      F.box('deiraPaint', u0 + pw / 2, v0 + fh / 2, -0.15, pw, fh, 0.3);
      F.box('deiraPaint', u0 + bw - pw / 2, v0 + fh / 2, -0.15, pw, fh, 0.3);
      if (sill > 0) F.box('deiraPaint', uc, v0 + sill / 2, -0.15, ww, sill, 0.3);
      if (fh - top > 0.01) F.box('deiraPaint', uc, v0 + top + (fh - top) / 2, -0.15, ww, fh - top, 0.3);
      if (arch) {
        F.geo('deiraPaint', archFill(ww, r, 0.3), uc, v0 + sill + hr, -0.15);
        F.geo('deiraTrim', archRing(r, 0.13, 0.1), uc, v0 + sill + hr, 0.04);
      }
      const pane = ww / 2 - 0.05, k1 = paneKey(), k2 = paneKey();
      F.box(k1, uc - ww / 4, v0 + sill + hr / 2, -0.2, pane, hr - 0.04, 0.04);
      F.box(k2, uc + ww / 4, v0 + sill + hr / 2, -0.2, pane, hr - 0.04, 0.04);
      if (arch) F.geo(k1 === 'glassLit' || k2 === 'glassLit' ? 'glassLit' : 'glass', halfDisc(r - 0.02), uc, v0 + sill + hr, -0.2);
      F.box('frame', uc - ww / 2 + 0.03, v0 + sill + hr / 2, -0.17, 0.06, hr, 0.06);
      F.box('frame', uc + ww / 2 - 0.03, v0 + sill + hr / 2, -0.17, 0.06, hr, 0.06);
      F.box('frame', uc, v0 + sill + 0.03, -0.17, ww, 0.06, 0.06);
      F.box('frame', uc, v0 + sill + hr - 0.03, -0.17, ww, 0.06, 0.06);
      F.box('frame', uc, v0 + sill + hr / 2, -0.165, 0.07, hr, 0.07);
      st.windows++; st.open += ww * wh;
      if (!isDoor) {
        F.box('deiraTrim', uc, v0 + sill - 0.035, 0.06, ww + 0.26, 0.07, 0.2);
        if (R.chance(P.ac / 100)) {
          if (R.chance(0.62)) {
            const uu = uc + R.range(-0.35, 0.35), vv = v0 + sill - 0.34;
            F.box('ac', uu, vv, 0.12, 0.68, 0.42, 0.55);
            F.box('acGrille', uu, vv, 0.395, 0.6, 0.32, 0.02);
            const sl = R.range(0.8, 2.3);
            F.box('stain', uu, vv - 0.21 - sl / 2, 0.006, 0.5, sl, 0.004);
          } else {
            const uu = R.chance(0.5) ? u0 + pw / 2 : u0 + bw - pw / 2, vv = v0 + R.range(0.9, 1.7);
            F.box('ac', uu, vv, 0.2, 0.78, 0.55, 0.3);
            F.geo('acGrille', FAN, uu - 0.1, vv, 0.352);
            F.box('steel', uu, vv - 0.3, 0.2, 0.7, 0.04, 0.34);
            F.box('frame', uu + 0.28, vv + 0.6, 0.06, 0.05, 1.0, 0.05);
          }
          st.ac++;
        }
      } else {
        const bwid = bw - 0.15, dep = 1.35;
        F.box('deiraTrim', uc, v0 + 0.09, dep / 2, bwid, 0.18, dep);
        if (P.balcony === 'solid') {
          F.box('deiraPaint', uc, v0 + 0.68, dep - 0.07, bwid, 1.0, 0.14);
          F.box('deiraPaint', u0 + 0.145, v0 + 0.68, dep / 2 - 0.07, 0.14, 1.0, dep - 0.14);
          F.box('deiraPaint', u0 + bw - 0.145, v0 + 0.68, dep / 2 - 0.07, 0.14, 1.0, dep - 0.14);
          F.box('deiraTrim', uc, v0 + 1.21, dep - 0.07, bwid + 0.06, 0.06, 0.22);
        } else {
          F.box('steel', uc, v0 + 1.12, dep - 0.04, bwid, 0.05, 0.06);
          F.box('steel', u0 + 0.1, v0 + 1.12, dep / 2, 0.05, 0.05, dep);
          F.box('steel', u0 + bw - 0.1, v0 + 1.12, dep / 2, 0.05, 0.05, dep);
          for (let k = 0.12; k < bwid - 0.06; k += 0.14) F.ibox('steel', u0 + 0.075 + k, v0 + 0.65, dep - 0.04, 0.025, 0.94, 0.025);
        }
        st.balconies++;
        if (R.chance(P.ac / 100)) {
          F.box('ac', u0 + bw - 0.62, v0 + 0.46, dep - 0.4, 0.8, 0.56, 0.3);
          F.geo('acGrille', FAN, u0 + bw - 0.72, v0 + 0.46, dep - 0.248);
          st.ac++;
        }
      }
    };

    for (const fc of faces) {
      const F = fc.F, L = F.len;
      for (let j = 0; j < nf; j++) {
        const v0 = g + j * fh;
        for (let i = 0; i < fc.n; i++) bay(fc, i, j, v0);
        if (fc.role === 'party') continue;
        if (P.style === 'bands') F.box('deiraTrim', L / 2, v0 + 0.45, 0.05, L + 0.1, 0.3, 0.1);
        if (P.style === 'grid') F.box('deiraTrim', L / 2, v0 + 0.2, 0.08, L + 0.4, 0.4, 0.16);
      }
      if (P.style === 'grid' && fc.role !== 'party') for (let i = 0; i <= fc.n; i++) F.box('deiraTrim', clamp(i * bw, 0.21, L - 0.21), g + (H - g) / 2, 0.09, 0.42, H - g, 0.18);

      // ground floor
      if (fc.role === 'party') { F.box('deiraPaint', L / 2, g / 2, -0.15, L, g, 0.3); continue; }
      if (!fc.shops) {
        for (let i = 0; i < fc.n; i++) {
          const uc = i * bw + bw / 2;
          F.box('deiraPaint', uc, g / 2, -0.15, bw, g, 0.3);
          if (i % 2 === 0) F.box('shutter', uc, 1.35, 0.02, 1.5, 2.7, 0.05);
          else { F.box('glass', uc, 2.6, 0.01, 0.9, 0.7, 0.02); }
        }
        continue;
      }
      const front = fc === faces[0], ws = front && arcade ? -ad : -0.3;
      if (front && arcade) {
        for (let i = 0; i <= fc.n; i++) F.box('deiraPaint', clamp(i * bw, 0.28, L - 0.28), (g - 1.0) / 2, -0.3, 0.55, g - 1.0, 0.55);
        F.box('deiraTrim', L / 2, g - 0.5, -0.15, L, 1.0, 0.3);
      }
      for (let i = 0; i < fc.n; i++) {
        const u0 = i * bw, uc = u0 + bw / 2;
        if (!front && arcade && i === 0) {
          F.box('deiraPaint', 0.28, (g - 1.0) / 2, -0.3, 0.55, g - 1.0, 0.55);
          F.box('deiraTrim', ad / 2, g - 0.5, -0.15, ad, 1.0, 0.3);
          F.box('deiraPaint', (ad + bw) / 2, g / 2, -0.15, bw - ad, g, 0.3);
          continue;
        }
        F.box('deiraPaint', u0 + 0.15, g / 2, ws + 0.15, 0.3, g, 0.3);
        F.box('deiraPaint', u0 + bw - 0.15, g / 2, ws + 0.15, 0.3, g, 0.3);
        F.box('shopGlass', uc, 0.15 + 1.45, ws + 0.12, bw - 0.6, 2.9, 0.05);
        F.box('frame', uc, 3.08, ws + 0.17, bw - 0.6, 0.08, 0.08);
        F.box('frame', uc, 1.6, ws + 0.17, 0.06, 2.9, 0.06);
        F.box('shutter', uc, 3.32, ws + 0.3, bw - 0.5, 0.36, 0.3);
        const topWall = front && arcade ? g - 1.0 : g;
        if (topWall > 3.52) F.box('deiraPaint', uc, (3.5 + topWall) / 2, ws + 0.15, bw - 0.6, topWall - 3.5, 0.3);
        st.shops++;
        if (P.signs) {
          const slot = ctx.signs.length;
          ctx.signs.push({ en: TRADES[(hash(P.seed, fc.role, i) >>> 3) % TRADES.length][0], ar: '', style: hash(P.seed, 'c', fc.role, i) % 7 });
          ctx.signs[slot].ar = TRADES.find(t => t[0] === ctx.signs[slot].en)[1];
          if (front && arcade) F.geo('sign', signPlane(slot), uc, g - 0.5, 0.012, bw - 0.7, 0.78, 1);
          else { F.box('steel', uc, 3.98, ws + 0.32, bw - 0.3, 0.92, 0.05); F.geo('sign', signPlane(slot), uc, 3.98, ws + 0.35, bw - 0.4, 0.82, 1); }
        }
        if (!(front && arcade) && R.chance(0.45)) F.box('awning' + R.int(0, 2), uc, 3.0, ws + 0.3 + 0.55, bw - 0.4, 0.04, 1.2, 0.34);
      }
    }

    // roof
    b.box('roofConcrete', W - 0.02, 0.3, D - 0.02, 0, H + 0.15, 0);
    const pp = 1.1, yR = H + 0.3;
    b.box('deiraPaint', W, pp, 0.22, 0, yR + pp / 2, D / 2 - 0.11);
    b.box('deiraPaint', W, pp, 0.22, 0, yR + pp / 2, -D / 2 + 0.11);
    b.box('deiraPaint', 0.22, pp, D - 0.44, W / 2 - 0.11, yR + pp / 2, 0);
    b.box('deiraPaint', 0.22, pp, D - 0.44, -W / 2 + 0.11, yR + pp / 2, 0);
    b.box('deiraTrim', W + 0.06, 0.08, 0.3, 0, yR + pp + 0.04, D / 2 - 0.11);
    b.box('deiraTrim', W + 0.06, 0.08, 0.3, 0, yR + pp + 0.04, -D / 2 + 0.11);
    b.box('deiraTrim', 0.3, 0.08, D - 0.5, W / 2 - 0.11, yR + pp + 0.04, 0);
    b.box('deiraTrim', 0.3, 0.08, D - 0.5, -W / 2 + 0.11, yR + pp + 0.04, 0);
    // stair and lift head
    const hx = clamp(R.range(-W / 4, W / 4), -W / 2 + 3, W / 2 - 3), hz = -D / 2 + 2.6;
    b.box('deiraPaint', 4.6, 3.2, 3.6, hx, yR + 1.6, hz);
    b.box('roofConcrete', 4.8, 0.25, 3.8, hx, yR + 3.32, hz);
    b.box('shutter', hx + 1.2, yR + 1.1, hz + 1.81, 1.0, 2.1, 0.04);
    b.geo('steel', cylinder(0.04, 0.05, 4.5, 6), T(hx - 1.6, yR + 3.45 + 2.25, hz - 1.0));
    // water tanks: one per 4 apartments, as many as fit
    const apts = nf * Math.max(1, Math.floor((W * D * 0.78) / 85));
    const want = clamp(Math.ceil(apts / 4), 2, 40);
    const spots = [];
    for (let z = D / 2 - 1.6; z > -D / 2 + 1.4; z -= 2.2) for (let x = -W / 2 + 1.6; x < W / 2 - 1.4; x += 2.2) {
      if (Math.abs(x - hx) < 3.6 && Math.abs(z - hz) < 3.2) continue;
      if (z > D / 2 - 4.5 && Math.abs(x) < 2.4) continue;
      spots.push([x, z]);
    }
    for (const [x, z] of spots.slice(0, want)) {
      b.box('steel', 1.7, 0.45, 1.7, x, yR + 0.225, z);
      b.geo('tank', cylinder(0.8, 0.8, 1.55, 18), T(x, yR + 0.45 + 0.775, z));
      b.geo('tank', cylinder(0.26, 0.26, 0.12, 10), T(x, yR + 2.06, z));
      st.tanks++;
    }
    // satellite dishes, all pointing the same way
    const nd = R.int(3, 8), daz = 0.6 + R.range(-0.1, 0.1);
    for (let k = 0; k < nd; k++) {
      const x = R.range(-W / 2 + 0.9, W / 2 - 0.9), z = D / 2 - 0.85 - R.range(0, 1.4);
      const el = 0.62, dir = new THREE.Vector3(Math.sin(daz) * Math.cos(el), Math.sin(el), Math.cos(daz) * Math.cos(el));
      b.geo('steel', cylinder(0.035, 0.035, 1.3, 6), T(x, yR + 0.65, z));
      const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().negate());
      const dm = new THREE.Matrix4().compose(new THREE.Vector3(x, yR + 1.45, z), q, new THREE.Vector3(1.05, 1.05, 1.05));
      b.geo('dish', dishGeo(), dm);
    }
    const nrac = R.int(1, 3);
    for (let k = 0; k < nrac; k++) { b.box('ac', 0.9, 0.7, 0.4, -W / 2 + 1.2 + k * 1.1, yR + 0.35, -D / 2 + 0.6); st.ac++; }

    drawSigns(ctx.tex, ctx.signs);
    const group = b.build(M);
    const perim = 2 * (W + D);
    return {
      group,
      bounds: { w: W, d: D, h: yR + 3.6 },
      plot: { w: W + 2, d: D + 2 },
      reg: [
        { key: 'ac', label: 'Split and window AC units', value: st.ac, rule: 'one per fitted window or balcony, plus roof units', hl: true },
        { key: 'apts', label: 'Apartments', value: apts, rule: '1 per 85 m² of floor at 78% net' },
        { key: 'windows', label: 'Windows', value: st.windows, rule: 'one per facade bay per floor' },
        { key: 'balc', label: 'Balconies', value: st.balconies, rule: 'from the balcony pattern' },
        { key: 'lifts', label: 'Lifts', value: nf <= 4 ? 1 : 2, rule: '1 up to G+4, 2 above' },
        { key: 'tanks', label: 'Roof water tanks', value: st.tanks, rule: '1 per 4 apartments, as many as fit' },
        { key: 'fhr', label: 'Fire hose reels', value: nf + 1, rule: '1 per floor at the stair' },
        { key: 'shops', label: 'Shop units', value: st.shops, rule: 'one per street bay' },
        { key: 'paint', label: 'Facade to repaint', value: Math.round(perim * H - st.open - st.shops * 2.9 * 3), unit: 'm²', rule: 'wall area minus openings' },
      ],
    };
  },
};

// =====================================================================================
// 3. NEW DUBAI TOWER
// =====================================================================================
const TINTS = {
  blue: { c: '#8fb3d2', s: '#2a3a48' }, green: { c: '#94c4b8', s: '#24403a' },
  silver: { c: '#c8d0d6', s: '#454c52' }, bronze: { c: '#bda184', s: '#3a2f26' },
};
function footprint(W, D, corners) {
  const r = corners === 'square' ? 0 : Math.min(W, D) * (corners === 'round' ? 0.24 : 0.17);
  const segs = corners === 'round' ? 5 : 1, pts = [];
  const C = [[W / 2 - r, D / 2 - r, 0], [W / 2 - r, -D / 2 + r, Math.PI / 2], [-W / 2 + r, -D / 2 + r, Math.PI], [-W / 2 + r, D / 2 - r, 1.5 * Math.PI]];
  for (const [cx, cz, a0] of C) {
    if (r === 0) { pts.push([cx, cz]); continue; }
    for (let k = 0; k <= segs; k++) { const a = a0 + (k / segs) * (Math.PI / 2); pts.push([cx + r * Math.sin(a), cz + r * Math.cos(a)]); }
  }
  return pts;
}
const polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2; };
const polyPerim = p => p.reduce((s, q, i) => s + Math.hypot(p[(i + 1) % p.length][0] - q[0], p[(i + 1) % p.length][1] - q[1]), 0);

export const TOWER = {
  id: 'tower', name: 'Tower', era: 'New Dubai', district: 'marina',
  schema: [
    { key: 'floors', label: 'Floors', type: 'range', min: 20, max: 90, step: 1, def: 52 },
    { key: 'width', label: 'Floor plate width', type: 'range', min: 24, max: 44, step: 1, def: 34, unit: 'm' },
    { key: 'depth', label: 'Floor plate depth', type: 'range', min: 20, max: 40, step: 1, def: 28, unit: 'm' },
    { key: 'corners', label: 'Corners', type: 'choice', options: [['square', 'Square'], ['chamfer', 'Chamfered'], ['round', 'Rounded']], def: 'round' },
    { key: 'twist', label: 'Twist', type: 'range', min: 0, max: 45, step: 1, def: 0, unit: '°' },
    { key: 'taper', label: 'Taper', type: 'range', min: 0, max: 40, step: 1, def: 8, unit: '%' },
    { key: 'podium', label: 'Podium levels', type: 'range', min: 2, max: 7, step: 1, def: 4 },
    { key: 'glass', label: 'Glass', type: 'choice', options: [['blue', 'Blue'], ['green', 'Green'], ['silver', 'Silver'], ['bronze', 'Bronze']], def: 'blue' },
    { key: 'fins', label: 'Fins', type: 'choice', options: [['none', 'None'], ['all', 'Every panel'], ['alt', 'Every 2nd']], def: 'alt' },
    { key: 'crown', label: 'Crown', type: 'choice', options: [['parapet', 'Glass parapet'], ['blades', 'Blades'], ['spire', 'Spire']], def: 'blades' },
    { key: 'seed', label: 'Seed', type: 'seed', def: 11 },
  ],
  build(P, ctx) {
    const R = rng(hash('tower', P.seed)), M = ctx.mats, b = new Builder();
    const fh = 3.4, nf = P.floors, W = P.width, D = P.depth, lv = P.podium;
    const Hp = 5.2 + (lv - 1) * 3.2;
    const tint = TINTS[P.glass];
    for (const k of ['tglass', 'tglassLit', 'tglassLit2']) M[k].color.set(tint.c);
    M.tspandrel.color.set(tint.s);
    const poly = footprint(W, D, P.corners), tw = (P.twist * Math.PI) / 180, tp = P.taper / 100;
    const xf = i => { const k = nf > 1 ? i / (nf - 1) : 0, s = 1 - tp * k, th = tw * k, c = Math.cos(th), sn = Math.sin(th); return { s, th, p: poly.map(([x, z]) => [x * s * c + z * s * sn, -x * s * sn + z * s * c]) }; };
    let panels = 0, glass = 0, area = 0;
    const R2 = rng(hash('towerlights', P.seed));
    for (let i = 0; i < nf; i++) {
      const y0 = Hp + i * fh, { p } = xf(i);
      area += polyArea(p);
      const occ = R2.chance(0.15) ? R2.range(0.5, 0.75) : R2.range(0.03, 0.38), warm = R2.chance(0.72);
      for (let e = 0; e < p.length; e++) {
        const [ax, az] = p[e], [bx, bz] = p[(e + 1) % p.length];
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
        if (L < 0.05) continue;
        const tx = dx / L, tz = dz / L, nx = -tz, nz = tx, ry = Math.atan2(-tz, tx);
        b.ibox('tspandrel', L + 0.03, 0.6, 0.14, (ax + bx) / 2 + nx * 0.03, y0 + 0.3, (az + bz) / 2 + nz * 0.03, ry);
        const nm = Math.max(1, Math.round(L / 1.5)), mw = L / nm;
        for (let m = 0; m < nm; m++) {
          const c = (m + 0.5) * mw, px = ax + tx * c, pz = az + tz * c;
          const key = R2() < occ ? (warm ? 'tglassLit' : 'tglassLit2') : 'tglass';
          b.ibox(key, mw - 0.03, fh - 0.6, 0.08, px, y0 + 0.6 + (fh - 0.6) / 2, pz, ry, 0, 0.78 + 0.3 * R2());
          panels++; glass += mw * fh;
          if (P.fins === 'all' || (P.fins === 'alt' && m % 2 === 0)) b.ibox('tfin', 0.09, fh, 0.5, ax + tx * m * mw + nx * 0.28, y0 + fh / 2, az + tz * m * mw + nz * 0.28, ry);
        }
      }
    }
    // roof slab at the top floor's outline
    const top = xf(nf - 1), yT = Hp + nf * fh;
    const shape = new THREE.Shape(top.p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const slab = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
    slab.rotateX(-Math.PI / 2);
    b.geo('roofConcrete', slab, T(0, yT, 0));
    // crown
    let crownH = 4;
    const edgeIter = (pts, fn) => { for (let e = 0; e < pts.length; e++) { const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % pts.length]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue; const tx = (bx - ax) / L, tz = (bz - az) / L; fn(ax, az, bx, bz, L, tx, tz, -tz, tx, Math.atan2(-tz, tx), e); } };
    if (P.crown === 'parapet') {
      edgeIter(top.p, (ax, az, bx, bz, L, tx, tz, nx, nz, ry) => {
        const nm = Math.max(1, Math.round(L / 1.5)), mw = L / nm;
        for (let m = 0; m < nm; m++) { const c = (m + 0.5) * mw; b.ibox('tglass', mw - 0.03, 4.2, 0.08, ax + tx * c, yT + 0.7 + 2.1, az + tz * c, ry); }
        b.ibox('crownLight', L, 0.22, 0.2, (ax + bx) / 2, yT + 5.0, (az + bz) / 2, ry);
      });
      crownH = 5.4;
    } else if (P.crown === 'blades') {
      let k = 0;
      edgeIter(top.p, (ax, az, bx, bz, L, tx, tz, nx, nz, ry) => {
        const nm = Math.max(1, Math.round(L / 3));
        for (let m = 0; m < nm; m++) {
          const c = (m + 0.5) * (L / nm), hb = 4 + 7.5 * (0.5 + 0.5 * Math.sin(k++ * 0.7));
          const px = ax + tx * c + nx * 0.35, pz = az + tz * c + nz * 0.35;
          b.ibox('tfin', 0.32, hb, 1.1, px, yT + 0.7 + hb / 2, pz, ry);
          b.ibox('crownLight', 0.34, 0.25, 1.12, px, yT + 0.7 + hb + 0.12, pz, ry);
          crownH = Math.max(crownH, hb + 1.2);
        }
      });
    } else {
      const hs = clamp(nf * fh * 0.16, 16, 52);
      b.geo('tfin', cylinder(0.22, 1.5, hs, 14), T(0, yT + 0.7 + hs / 2, 0));
      for (let k = 1; k <= 4; k++) b.geo('crownLight', cylinder(lerp(1.4, 0.4, k / 5) + 0.06, lerp(1.4, 0.4, k / 5) + 0.06, 0.28, 14), T(0, yT + 0.7 + hs * (k / 5), 0));
      b.ibox('aviation', 0.5, 0.5, 0.5, 0, yT + 0.7 + hs + 0.3, 0);
      crownH = hs + 1.5;
      edgeIter(top.p, (ax, az, bx, bz, L, tx, tz, nx, nz, ry) => b.ibox('crownLight', L, 0.22, 0.2, (ax + bx) / 2, yT + 0.85, (az + bz) / 2, ry));
    }
    // roof plant, BMU track, machine, jib and a cradle on the facade
    const th = top.th, s = top.s, cs = Math.cos(th), sn = Math.sin(th);
    const rot = (x, z) => [x * cs + z * sn, -x * sn + z * cs];
    { const [x, z] = rot(-W * s * 0.12, -D * s * 0.12); b.box('podiumClad', W * s * 0.36, 3.6, D * s * 0.3, x, yT + 0.7 + 1.8, z, th); }
    const tr = 0.5 * Math.min(W, D) * s - 3.2;
    for (const [x0, z0, x1, z1] of [[-tr, tr, tr, tr], [tr, tr, tr, -tr], [tr, -tr, -tr, -tr], [-tr, -tr, -tr, tr]]) {
      const [ax, az] = rot(x0, z0), [bx, bz] = rot(x1, z1);
      b.box('steel', Math.hypot(bx - ax, bz - az) + 0.3, 0.25, 0.3, (ax + bx) / 2, yT + 0.82, (az + bz) / 2, Math.atan2(-(bz - az), bx - ax));
    }
    const mz = tr, [mx, mzr] = rot(tr * 0.35, mz);
    b.box('bmu', 3.2, 2.5, 2.4, mx, yT + 0.95 + 1.25, mzr, th);
    const front = D / 2 * s, armL = front - mz + 1.8;
    const [jx, jz] = rot(tr * 0.35, mz + armL / 2);
    b.box('bmu', 0.42, 0.42, armL, jx, yT + 3.1, jz, th);
    const ic = Math.max(0, nf - 1 - R.int(2, 6)), cf = xf(ic), cfr = cf.th, cosr = Math.cos(cfr), sinr = Math.sin(cfr);
    const cxl = tr * 0.35 * (cf.s / s), czl = D / 2 * cf.s + 1.0;
    const cx = cxl * cosr + czl * sinr, cz = -cxl * sinr + czl * cosr, cy = Hp + ic * fh + 1.0;
    b.box('bmu', 3.6, 0.9, 0.8, cx, cy, cz, cfr);
    const [tx2, tz2] = rot(tr * 0.35, front + 1.0);
    for (const o of [-1.3, 1.3]) {
      const ox = Math.cos(th) * o, oz = -Math.sin(th) * o;
      const ax = cx + ox, az = cz + oz, bx = tx2 + ox, bz = tz2 + oz, ay = cy + 0.45, by = yT + 2.9;
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const dir = new THREE.Vector3(bx - ax, by - ay, bz - az).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir);
      b.geo('steel', cylinder(0.025, 0.025, 1, 4), new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(1, len, 1)));
    }
    // aviation lights on the top corners
    for (const q of [0, Math.floor(top.p.length / 4), Math.floor(top.p.length / 2), Math.floor((3 * top.p.length) / 4)]) { const [x, z] = top.p[q]; b.ibox('aviation', 0.35, 0.35, 0.35, x * 0.97, yT + 1.0, z * 0.97); }

    // podium
    const Wp = Math.ceil((W + 18) / 2) * 2, Dp = Math.ceil((D + 17) / 2) * 2;
    b.box('podiumDark', Wp - 1.4, 5.2, Dp - 1.4, 0, 2.6, 0);
    b.box('podiumDark', Wp - 0.8, Hp - 5.2, Dp - 0.8, 0, 5.2 + (Hp - 5.2) / 2, 0);
    const pf = [new Face(b, -Wp / 2, Dp / 2, 1, 0, Wp), new Face(b, Wp / 2, Dp / 2, 0, -1, Dp), new Face(b, Wp / 2, -Dp / 2, -1, 0, Wp), new Face(b, -Wp / 2, -Dp / 2, 0, 1, Dp)];
    pf.forEach((F, fi) => {
      const L = F.len;
      F.box('shopGlass', L / 2, 2.45, -0.62, L - 1.4, 4.5, 0.06);
      const nc = Math.max(2, Math.round(L / 7.5));
      for (let k = 0; k <= nc; k++) F.box('podiumClad', clamp((k * L) / nc, 0.35, L - 0.35), 2.6, -0.35, 0.7, 5.2, 0.7);
      F.box('podiumClad', L / 2, 5.0, -0.2, L + (fi % 2 ? -0.02 : 0.02), 0.6, 0.5);
      F.box('podiumClad', 0.7, 5.2 + (Hp - 5.2) / 2, -0.35, 1.4, Hp - 5.2, 0.7);
      F.box('podiumClad', L - 0.7, 5.2 + (Hp - 5.2) / 2, -0.35, 1.4, Hp - 5.2, 0.7);
      for (let k = 1; k < lv; k++) F.box('podiumClad', L / 2, 5.2 + k * 3.2, -0.15, L - 2.8, 0.45, 0.3);
      for (let v = 5.75; v < Hp - 0.2; v += 0.42) F.ibox('louver', L / 2, v, 0.04, L - 2.8, 0.09, 0.28);
    });
    b.box('podiumClad', Wp, 0.5, Dp, 0, Hp + 0.25, 0);
    b.box('deck', Wp - 2, 0.06, Dp - 2, 0, Hp + 0.53, 0);
    b.box('podiumClad', Wp, 1.1, 0.3, 0, Hp + 1.05, Dp / 2 - 0.15);
    b.box('podiumClad', Wp, 1.1, 0.3, 0, Hp + 1.05, -Dp / 2 + 0.15);
    b.box('podiumClad', 0.3, 1.1, Dp - 0.6, Wp / 2 - 0.15, Hp + 1.05, 0);
    b.box('podiumClad', 0.3, 1.1, Dp - 0.6, -Wp / 2 + 0.15, Hp + 1.05, 0);
    // pool deck in front of the tower
    const pz0 = D / 2 + 1.5, pz1 = Dp / 2 - 1.8, pd = pz1 - pz0, pw = Wp * 0.42, px = -Wp / 2 + 2 + pw / 2;
    if (pd > 3) {
      b.box('podiumClad', pw + 0.6, 0.12, pd + 0.6, px, Hp + 0.6, (pz0 + pz1) / 2);
      b.box('pool', pw, 0.06, pd, px, Hp + 0.64, (pz0 + pz1) / 2);
      for (let k = 0; k < Math.floor(pw / 1.6); k++) b.ibox('bmu', 0.7, 0.35, 1.9, px - pw / 2 + 0.8 + k * 1.6, Hp + 0.75, pz1 + 0.15 + 0.0);
    }
    const palms = [];
    const pl = Wp / 2 - 2.5;
    for (let k = 0; k < 6; k++) {
      const x = pl - k * 3.2, z = Dp / 2 - 2.2;
      if (x < -Wp / 2 + 2) break;
      if (x > px - pw / 2 - 1 && x < px + pw / 2 + 1) continue;
      b.box('podiumClad', 1.6, 0.7, 1.6, x, Hp + 0.9, z);
      palms.push({ x, y: Hp + 1.2, z, h: R.range(4.5, 6.5), s: R.range(0.75, 0.9), rot: R() * TAU, lean: R.range(-0.06, 0.06) });
    }
    // entrance canopy
    b.box('podiumClad', 14, 0.45, 7, 0, 5.6, Dp / 2 + 3.4);
    b.box('tfin', 0.3, 5.4, 0.3, -6.6, 2.7, Dp / 2 + 6.6);
    b.box('tfin', 0.3, 5.4, 0.3, 6.6, 2.7, Dp / 2 + 6.6);

    const group = b.build(M);
    group.add(makePalms(palms, M));
    const apts = Math.floor((area * 0.78) / 115), perimTop = polyPerim(top.p);
    return {
      group,
      bounds: { w: Wp, d: Dp, h: yT + 0.7 + crownH, tw: W, td: D, podium: Hp },
      plot: { w: Wp + 12, d: Dp + 18 },
      reg: [
        { key: 'floors', label: 'Floors', value: nf, rule: `above a ${lv}-level podium` },
        { key: 'fcu', label: 'Fan coil units', value: apts * 3, rule: '3 per apartment: living room + 2 bedrooms', hl: true },
        { key: 'apts', label: 'Apartments', value: apts, rule: '1 per 115 m² of floor at 78% net' },
        { key: 'lifts', label: 'Lifts', value: Math.max(4, Math.ceil(apts / 70)), rule: '1 per 70 apartments, never below 4' },
        { key: 'panels', label: 'Curtain wall panels', value: panels, rule: 'one per 1.5 m module per floor' },
        { key: 'glass', label: 'Glass to clean', value: Math.round(glass), unit: 'm²', rule: 'every panel, outside face' },
        { key: 'bmu', label: 'BMU drops per clean', value: Math.ceil(perimTop / 3.6), rule: 'top perimeter / 3.6 m cradle' },
        { key: 'spr', label: 'Sprinkler heads', value: Math.ceil(area / 12), rule: '1 per 12 m² of floor' },
        { key: 'fhr', label: 'Fire hose reels', value: nf * 2, rule: '2 per floor, one per stair' },
        { key: 'park', label: 'Parking bays', value: Math.floor((Wp * Dp * 0.85 * (lv - 1)) / 30), rule: '30 m² per bay on the parking levels' },
      ],
    };
  },
};

export const TYPES = { house: HOUSE, deira: DEIRA, tower: TOWER };
export function defaults(type) { const o = {}; for (const f of TYPES[type].schema) o[f.key] = f.def; return o; }
