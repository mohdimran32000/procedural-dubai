// city.js - a generic Dubai grid that wraps around the hero plot(s). Clay massing, real streets.
import * as THREE from 'three';
import { Builder, rng, hash, clamp, TAU, makePalms, cylinder, UNIT_BOX } from './core.js';

export const DISTRICTS = {
  heritage: { block: 28, road: 7, walk: 0, N: 4, lanes: false, roadMat: 'sandPave', lots: [2, 4] },
  deira: { block: 46, road: 15, walk: 3.2, N: 3, lanes: true, roadMat: 'asphalt', lots: [1, 3] },
  marina: { block: 76, road: 21, walk: 4.5, N: 3, lanes: true, roadMat: 'asphalt', lots: [1, 2], canal: true },
};
const CAR_COLS = ['#f4f4f2', '#f4f4f2', '#f4f4f2', '#ececea', '#c9ccce', '#a9adb1', '#1c1d1f', '#2c3e57', '#7d1f1f', '#d8cfc0'];
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

export function buildCity({ district, seed, plots, clear = null }, M) {
  const S = DISTRICTS[district], R = rng(hash('city', district, seed)), b = new Builder();
  const N = S.N, nb = 2 * N + 1, rw = S.road, wk = S.walk;
  const colW = Array(nb).fill(S.block), rowD = Array(nb).fill(S.block);
  for (const p of plots) { colW[p.i + N] = Math.max(colW[p.i + N], p.w + 2 * wk); rowD[p.j + N] = Math.max(rowD[p.j + N], p.d + 2 * wk); }
  const xs = Array(nb), zs = Array(nb);
  xs[N] = 0; zs[N] = 0;
  for (let i = N + 1; i < nb; i++) { xs[i] = xs[i - 1] + colW[i - 1] / 2 + rw + colW[i] / 2; zs[i] = zs[i - 1] + rowD[i - 1] / 2 + rw + rowD[i] / 2; }
  for (let i = N - 1; i >= 0; i--) { xs[i] = xs[i + 1] - colW[i + 1] / 2 - rw - colW[i] / 2; zs[i] = zs[i + 1] - rowD[i + 1] / 2 - rw - rowD[i] / 2; }
  const X0 = xs[0] - colW[0] / 2 - rw, X1 = xs[nb - 1] + colW[nb - 1] / 2 + rw;
  const Z0 = zs[0] - rowD[0] / 2 - rw, Z1 = zs[nb - 1] + rowD[nb - 1] / 2 + rw;
  // road centre lines (between and around the blocks)
  const vx = [X0 + rw / 2], hz = [Z0 + rw / 2];
  for (let i = 0; i < nb; i++) { vx.push(xs[i] + colW[i] / 2 + rw / 2); hz.push(zs[i] + rowD[i] / 2 + rw / 2); }
  const jc = S.canal ? N - 2 : -99;
  const zc0 = S.canal ? zs[jc] - rowD[jc] / 2 : 0, zc1 = S.canal ? zs[jc] + rowD[jc] / 2 : 0;
  const isPlot = (i, j) => plots.findIndex(p => p.i + N === i && p.j + N === j);
  const fx = plots.reduce((a, p) => a + xs[p.i + N], 0) / plots.length, fz = plots.reduce((a, p) => a + zs[p.j + N], 0) / plots.length;
  const inWedge = (x, z) => { if (!clear) return false; const a = Math.atan2(x - fx, z - fz) * 180 / Math.PI; return a >= clear[0] && a <= clear[1]; };

  // ground: desert beyond, then the street surface
  b.box('sand', 9000, 0.1, 9000, 0, -0.16, 0);
  if (S.canal) {
    b.box(S.roadMat, X1 - X0, 0.1, zc0 - Z0, (X0 + X1) / 2, -0.05, (Z0 + zc0) / 2);
    b.box(S.roadMat, X1 - X0, 0.1, Z1 - zc1, (X0 + X1) / 2, -0.05, (zc1 + Z1) / 2);
    b.box('water', X1 - X0 + 600, 0.1, zc1 - zc0, (X0 + X1) / 2, -1.6, (zc0 + zc1) / 2);
    b.box('podiumClad', X1 - X0, 1.8, 0.6, (X0 + X1) / 2, -0.85, zc0 + 0.3);
    b.box('podiumClad', X1 - X0, 1.8, 0.6, (X0 + X1) / 2, -0.85, zc1 - 0.3);
    b.box('steel', X1 - X0, 0.06, 0.06, (X0 + X1) / 2, 1.05, zc0 + 0.25);
    b.box('steel', X1 - X0, 0.06, 0.06, (X0 + X1) / 2, 1.05, zc1 - 0.25);
    for (const x of vx) {
      b.box('asphalt', rw, 0.8, zc1 - zc0, x, -0.4, (zc0 + zc1) / 2);
      b.box('podiumClad', 0.5, 1.2, zc1 - zc0, x - rw / 2 + 0.25, 0.6, (zc0 + zc1) / 2);
      b.box('podiumClad', 0.5, 1.2, zc1 - zc0, x + rw / 2 - 0.25, 0.6, (zc0 + zc1) / 2);
    }
    // moored boats
    const hull = new THREE.Shape([new THREE.Vector2(-1.4, -5), new THREE.Vector2(1.4, -5), new THREE.Vector2(1.4, 2.5), new THREE.Vector2(0, 5), new THREE.Vector2(-1.4, 2.5)]);
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 1.3, bevelEnabled: false }); hg.rotateX(-Math.PI / 2);
    for (let k = 0; k < 14; k++) {
      const x = R.range(X0 + 20, X1 - 20), side = R.chance(0.5) ? 1 : -1, z = side > 0 ? zc1 - 5 : zc0 + 5;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, -1.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + R.range(-0.08, 0.08)), new THREE.Vector3(1, 1, R.range(0.8, 1.5)));
      b.geo('boat', hg, m);
      b.box('boat', 2.0, 1.1, 3.2, x - 0.6, -0.3 + 0.55, z, Math.PI / 2);
      b.box('carGlass', 2.05, 0.4, 3.0, x - 0.6, -0.3 + 0.7, z, Math.PI / 2);
    }
  } else {
    b.box(S.roadMat, X1 - X0, 0.1, Z1 - Z0, (X0 + X1) / 2, -0.05, (Z0 + Z1) / 2);
  }

  const palms = [], cars = [];
  let mosques = 0;
  const clay = (x0, z0, x1, z1, h, y = 0) => { if (x1 - x0 > 0.5 && z1 - z0 > 0.5 && h > 0.5) b.box('clay', x1 - x0, h, z1 - z0, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2); };
  const mosque = (cx, cz, s) => {
    clay(cx - s / 2, cz - s / 2, cx + s / 2, cz + s / 2, s * 0.55, 0.15);
    const dome = new THREE.SphereGeometry(s * 0.32, 24, 12, 0, TAU, 0, Math.PI / 2);
    b.geo('clay', dome, T(cx, 0.15 + s * 0.55, cz));
    b.geo('clay', cylinder(s * 0.08, s * 0.09, s * 1.9, 12), T(cx + s * 0.62, s * 0.95, cz + s * 0.62));
    b.geo('clay', cylinder(s * 0.11, s * 0.11, s * 0.12, 12), T(cx + s * 0.62, s * 1.6, cz + s * 0.62));
    b.geo('clay', new THREE.ConeGeometry(s * 0.09, s * 0.3, 12), T(cx + s * 0.62, s * 2.05, cz + s * 0.62));
    mosques++;
  };

  for (let i = 0; i < nb; i++) for (let j = 0; j < nb; j++) {
    if (j === jc) continue;
    const cx = xs[i], cz = zs[j], w = colW[i], d = rowD[j];
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    if (wk > 0) {
      b.box('pavers', w, 0.15, d, cx, 0.075, cz);
      b.box('curb', w, 0.17, 0.25, cx, 0.085, z1 - 0.125);
      b.box('curb', w, 0.17, 0.25, cx, 0.085, z0 + 0.125);
      b.box('curb', 0.25, 0.17, d - 0.5, x1 - 0.125, 0.085, cz);
      b.box('curb', 0.25, 0.17, d - 0.5, x0 + 0.125, 0.085, cz);
    }
    const pi = isPlot(i, j);
    if (pi >= 0) {
      if (district === 'marina' || plots[pi].kind === 'tower') {
        for (const [a, c] of [[x0 + 3, z1 - 3], [x1 - 3, z1 - 3], [x0 + 3, z0 + 3], [x1 - 3, z0 + 3]]) palms.push({ x: a, y: 0.15, z: c, h: R.range(7, 10), s: R.range(0.9, 1.1), rot: R() * TAU, lean: R.range(-0.05, 0.05) });
        for (let x = x0 + 8; x < x1 - 6; x += 9) palms.push({ x, y: 0.15, z: z1 - 1.6, h: R.range(7, 10.5), s: R.range(0.9, 1.15), rot: R() * TAU, lean: R.range(-0.05, 0.05) });
      }
      if (plots[pi].kind === 'house' || (district === 'heritage' && !plots[pi].kind)) {
        // a couple of neighbours' palms over the lane walls
        palms.push({ x: x0 + 2, y: 0, z: z0 + 2, h: 7, s: 0.9, rot: 1, lean: 0.06 });
      }
      continue;
    }
    // split the block into lots
    const ix0 = x0 + wk, ix1 = x1 - wk, iz0 = z0 + wk, iz1 = z1 - wk;
    let lots = [[ix0, iz0, ix1, iz1]];
    const nl = R.int(S.lots[0], S.lots[1]);
    if (nl >= 2) {
      const [a0, c0, a1, c1] = lots[0];
      if (a1 - a0 > c1 - c0) { const m = a0 + (a1 - a0) * R.range(0.4, 0.6); lots = [[a0, c0, m, c1], [m, c0, a1, c1]]; }
      else { const m = c0 + (c1 - c0) * R.range(0.4, 0.6); lots = [[a0, c0, a1, m], [a0, m, a1, c1]]; }
    }
    if (nl >= 3) {
      const nx = [];
      lots.forEach((L, idx) => {
        if (nl === 3 && idx === 1) { nx.push(L); return; }
        const [a0, c0, a1, c1] = L;
        if (a1 - a0 > c1 - c0) { const m = a0 + (a1 - a0) * R.range(0.4, 0.6); nx.push([a0, c0, m, c1], [m, c0, a1, c1]); }
        else { const m = c0 + (c1 - c0) * R.range(0.4, 0.6); nx.push([a0, c0, a1, m], [a0, m, a1, c1]); }
      });
      lots = nx;
    }
    const dist = Math.hypot(cx, cz);
    const ring = Math.min(...plots.map(p => Math.max(Math.abs(i - (p.i + N)), Math.abs(j - (p.j + N)))));
    let capH = district === 'marina' ? [0, 38, 90, 140][Math.min(ring, 3)] : district === 'deira' ? [0, 18, 32, 60][Math.min(ring, 3)] : 99;
    if (clear && ring >= 1 && inWedge(cx, cz)) capH = Math.min(capH, district === 'marina' ? 28 : district === 'deira' ? 14 : 99);
    const clayC = (x0, z0, x1, z1, h, y = 0) => clay(x0, z0, x1, z1, Math.min(h, Math.max(4, capH - y)), y);
    for (const [a0, c0, a1, c1] of lots) {
      const lw = a1 - a0, ld = c1 - c0, lx = (a0 + a1) / 2, lz = (c0 + c1) / 2, r = R();
      if (district === 'heritage') {
        const h = R.range(4.6, 8.5), g = 0.7;
        clayC(a0 + g, c0 + g, a1 - g, c1 - g, h);
        if (R.chance(0.3)) { const tx = R.chance(0.5) ? a0 + 2.6 : a1 - 2.6, tz = R.chance(0.5) ? c0 + 2.6 : c1 - 2.6; clayC(tx - 1.4, tz - 1.4, tx + 1.4, tz + 1.4, h + R.range(4, 7)); }
        if (R.chance(0.2)) palms.push({ x: lx + R.range(-2, 2), y: 0, z: lz + R.range(-2, 2), h: R.range(6, 9), s: 0.9, rot: R() * TAU, lean: R.range(-0.08, 0.08) });
        if (mosques < 1 && dist > 50 && r < 0.06 && lw > 14 && ld > 14) { mosque(lx, lz, Math.min(lw, ld) * 0.7); }
        continue;
      }
      if (district === 'deira') {
        if (r < 0.06) { // empty sand lot with a few parked cars
          b.box('sand', lw - 1, 0.04, ld - 1, lx, 0.17, lz);
          for (let k = 0; k < 4; k++) if (R.chance(0.6)) cars.push({ x: a0 + 3 + k * 3, z: lz + R.range(-ld / 3, ld / 3), ry: Math.PI / 2, y: 0.2 });
          continue;
        }
        if (mosques < 2 && dist > 60 && r < 0.11 && lw > 18 && ld > 18) { mosque(lx, lz, Math.min(lw, ld) * 0.62); continue; }
        const fl = R.int(3, 14), h = 4.6 + fl * 3.1, g = 0.4;
        clayC(a0 + g, c0 + g, a1 - g, c1 - g, h, 0.15);
        if (R.chance(0.6)) clayC(lx - 2.3, lz - 1.8, lx + 2.3, lz + 1.8, 3.2, 0.15 + h);
        if (R.chance(0.25) && fl > 8) clayC(a0 + g + 2, c0 + g + 2, a1 - g - 2, c1 - g - 2, R.range(3, 9), 0.15 + h);
        continue;
      }
      // marina
      if (r < 0.06) { for (let k = 0; k < 6; k++) palms.push({ x: lx + R.range(-lw / 3, lw / 3), y: 0.15, z: lz + R.range(-ld / 3, ld / 3), h: R.range(6, 10), s: 1, rot: R() * TAU }); b.box('grass', lw - 4, 0.05, ld - 4, lx, 0.17, lz); continue; }
      const ph = R.range(9, 18);
      clayC(a0 + 1.5, c0 + 1.5, a1 - 1.5, c1 - 1.5, ph, 0.15);
      if (r < 0.2) { clayC(a0 + 4, c0 + 4, a1 - 4, c1 - 4, R.range(20, 55), 0.15 + ph); continue; }
      const tw = Math.min(lw, ld) * R.range(0.42, 0.62), td = tw * R.range(0.75, 1.2), th = Math.min(55 + 200 * Math.pow(R(), 1.7), Math.max(6, capH - 0.15 - ph - 8));
      const ox = lx + R.range(-1, 1) * (lw - tw) * 0.25, oz = lz + R.range(-1, 1) * (ld - td) * 0.25;
      const y0 = 0.15 + ph;
      if (r < 0.38) { b.geo('clay', cylinder(tw / 2, tw / 2, th, 28), T(ox, y0 + th / 2, oz)); b.geo('clay', cylinder(tw / 2 - 1.5, tw / 2 - 1.5, 6, 28), T(ox, y0 + th + 3, oz)); }
      else if (r < 0.5) {
        const h1 = th * 0.55; clayC(ox - tw / 2, oz - td / 2, ox + tw / 2, oz + td / 2, h1, y0);
        clayC(ox - tw * 0.38, oz - td * 0.38, ox + tw * 0.38, oz + td * 0.38, th * 0.3, y0 + h1);
        clayC(ox - tw * 0.24, oz - td * 0.24, ox + tw * 0.24, oz + td * 0.24, th * 0.15, y0 + h1 + th * 0.3);
      } else {
        clayC(ox - tw / 2, oz - td / 2, ox + tw / 2, oz + td / 2, th, y0);
        clayC(ox - tw * 0.3, oz - td * 0.3, ox + tw * 0.3, oz + td * 0.3, R.range(4, 9), y0 + th);
      }
    }
  }

  // distant skyline: clusters of generic boxes in the haze, plus a low carpet so the grid has no hard edge
  const far = district === 'marina' ? [40, 280] : district === 'deira' ? [18, 110] : [14, 160];
  const ext = Math.max(X1 - X0, Z1 - Z0) / 2;
  for (let x = X0 - 160; x < X1 + 160; x += 38) for (let z = Z0 - 160; z < Z1 + 160; z += 38) {
    if (x > X0 - 10 && x < X1 + 10 && z > Z0 - 10 && z < Z1 + 10) continue;
    if (S.canal && z > zc0 - 30 && z < zc1 + 30) continue;
    if (R.chance(0.25)) continue;
    const s2 = R.range(16, 30), hh = Math.min(district === 'marina' ? R.range(12, 60) : R.range(6, 28), inWedge(x, z) ? 18 : 999);
    clay(x - s2 / 2, z - s2 / 2, x + s2 / 2, z + s2 / 2, hh);
  }
  const nCl = district === 'heritage' ? 7 : 9;
  for (let c = 0; c < nCl; c++) {
    let a = R() * TAU;
    if (district === 'heritage') a = -0.9 + R.range(-0.9, 0.9);
    const rad = ext + 420 + R() * 1100, ccx = Math.cos(a) * rad, ccz = Math.sin(a) * rad, n = R.int(8, 18);
    for (let k = 0; k < n; k++) {
      const x = ccx + R.range(-130, 130), z = ccz + R.range(-130, 130);
      const tall = district !== 'deira' && R.chance(district === 'marina' ? 0.55 : 0.4);
      const h = tall ? R.range(far[0] * 2, far[1]) : R.range(far[0], far[0] * 2.5), s2 = tall ? R.range(20, 36) : R.range(26, 60);
      clay(x - s2 / 2, z - s2 / 2, x + s2 / 2, z + s2 / 2, h);
    }
  }

  // street furniture: lane paint, crossings, lamps, palms, parked cars
  const inX = x => xs.some((c, i) => Math.abs(x - c) < colW[i] / 2 - 0.5);
  const inZ = z => zs.some((c, i) => Math.abs(z - c) < rowD[i] / 2 - 0.5);
  const near = (x, z, r) => Math.hypot(x, z) < r;
  const inCanal = z => S.canal && z > zc0 - 0.5 && z < zc1 + 0.5;
  if (S.lanes) {
    for (const x of vx) for (let z = Z0 + 3; z < Z1 - 3; z += 9) if (inZ(z) && !inCanal(z) && near(x, z, 700)) b.ibox('marking', 0.15, 0.02, 3, x, 0.012, z);
    for (const z of hz) for (let x = X0 + 3; x < X1 - 3; x += 9) if (inX(x) && near(x, z, 700)) b.ibox('marking', 0.15, 0.02, 3, x, 0.012, z, Math.PI / 2);
    for (const x of vx) for (const sgn of [-1, 1]) for (let z = Z0; z < Z1; z += 12) if (inZ(z) && !inCanal(z) && near(x, z, 700)) b.ibox('marking', 0.12, 0.02, 12, x + sgn * (rw / 2 - 0.7), 0.012, z + 6);
    for (const z of hz) for (const sgn of [-1, 1]) for (let x = X0; x < X1; x += 12) if (inX(x) && near(x, z, 700)) b.ibox('marking', 0.12, 0.02, 12, x + 6, 0.012, z + sgn * (rw / 2 - 0.7), Math.PI / 2);
    // zebra crossings at the corners of each hero plot
    for (const p of plots) {
      const pi = p.i + N, pj = p.j + N;
      const xl = vx[pi], xr = vx[pi + 1], zt = hz[pj], zb = hz[pj + 1];
      for (const xi of [xl, xr]) for (const zi of [zt, zb]) {
        for (let k = -rw / 2 + 1.2; k <= rw / 2 - 1.2; k += 1.0) {
          for (const s of [-1, 1]) {
            b.ibox('marking', 0.5, 0.02, 3.2, xi + k, 0.013, zi + s * (rw / 2 + 2.4));
            b.ibox('marking', 3.2, 0.02, 0.5, xi + s * (rw / 2 + 2.4), 0.013, zi + k);
          }
        }
      }
    }
    // lamps along roads near the centre
    const lamp = (x, z, dx, dz) => {
      const ry = Math.atan2(-dz, dx) + Math.PI / 2;
      b.ibox('lampPole', 0.16, 8.5, 0.16, x, 4.25 + 0.15, z);
      b.ibox('lampPole', 0.09, 0.09, 2.3, x + dx * 1.15, 8.55, z + dz * 1.15, ry);
      b.ibox('lampHead', 0.42, 0.16, 0.95, x + dx * 2.2, 8.45, z + dz * 2.2, ry);
    };
    for (const x of vx) for (let z = Z0 + 10; z < Z1; z += 28) if (inZ(z) && !inCanal(z) && near(x, z, 380)) { lamp(x - rw / 2 - 0.7, z, 1, 0); lamp(x + rw / 2 + 0.7, z + 14, -1, 0); }
    for (const z of hz) for (let x = X0 + 10; x < X1; x += 28) if (inX(x) && near(x, z, 380) && !inCanal(z)) { lamp(x, z - rw / 2 - 0.7, 0, 1); lamp(x + 14, z + rw / 2 + 0.7, 0, -1); }
    // street palms and parked cars
    for (const x of vx) for (let z = Z0 + 5; z < Z1; z += 11) if (inZ(z) && !inCanal(z) && near(x, z, 260) && R.chance(0.55)) palms.push({ x: x + (R.chance(0.5) ? 1 : -1) * (rw / 2 + wk * 0.55), y: 0.15, z, h: R.range(6.5, 10), s: R.range(0.85, 1.1), rot: R() * TAU, lean: R.range(-0.05, 0.05) });
    for (const z of hz) for (let x = X0 + 5; x < X1; x += 11) if (inX(x) && near(x, z, 260) && !inCanal(z) && R.chance(0.55)) palms.push({ x, y: 0.15, z: z + (R.chance(0.5) ? 1 : -1) * (rw / 2 + wk * 0.55), h: R.range(6.5, 10), s: R.range(0.85, 1.1), rot: R() * TAU, lean: R.range(-0.05, 0.05) });
    for (const x of vx) for (let z = Z0 + 4; z < Z1; z += 6.2) if (inZ(z) && !inCanal(z) && near(x, z, 300) && R.chance(0.42)) cars.push({ x: x + (R.chance(0.5) ? 1 : -1) * (rw / 2 - 1.6), z, ry: 0 });
    for (const z of hz) for (let x = X0 + 4; x < X1; x += 6.2) if (inX(x) && near(x, z, 300) && !inCanal(z) && R.chance(0.42)) cars.push({ x, z: z + (R.chance(0.5) ? 1 : -1) * (rw / 2 - 1.6), ry: Math.PI / 2 });
    for (const x of vx) for (let z = Z0 + 4; z < Z1; z += 17) if (!inCanal(z) && near(x, z, 300) && R.chance(0.35)) cars.push({ x: x + (R.chance(0.5) ? 1 : -1) * rw * 0.18, z, ry: 0 });
  } else {
    // old town lanes: a few low lamps on brackets, the odd car
    for (const x of vx) for (let z = Z0 + 6; z < Z1; z += 18) if (inZ(z) && near(x, z, 160)) { b.ibox('lampPole', 0.1, 3.6, 0.1, x - rw / 2 + 0.4, 1.8, z); b.ibox('lampHead', 0.3, 0.3, 0.3, x - rw / 2 + 0.4, 3.75, z); }
    for (const z of hz) for (let x = X0 + 6; x < X1; x += 22) if (inX(x) && near(x, z, 140) && R.chance(0.25)) cars.push({ x, z: z + 1.5, ry: Math.PI / 2 });
  }

  const group = b.build(M);
  group.add(makePalms(palms, M));
  if (cars.length) {
    const body = new THREE.InstancedMesh(UNIT_BOX, M.car, cars.length), cab = new THREE.InstancedMesh(UNIT_BOX, M.carGlass, cars.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    cars.forEach((k, i) => {
      q.setFromAxisAngle(up, k.ry); const y = k.y || 0;
      const fx = Math.sin(k.ry), fz = Math.cos(k.ry);
      m.compose(new THREE.Vector3(k.x, y + 0.62, k.z), q, new THREE.Vector3(1.82, 0.72, 4.5)); body.setMatrixAt(i, m);
      body.setColorAt(i, c.set(CAR_COLS[i % CAR_COLS.length]));
      m.compose(new THREE.Vector3(k.x - fx * 0.25, y + 1.22, k.z - fz * 0.25), q, new THREE.Vector3(1.6, 0.56, 2.3)); cab.setMatrixAt(i * 2, m);
      m.compose(new THREE.Vector3(k.x, y + 0.24, k.z), q, new THREE.Vector3(1.72, 0.36, 3.7)); cab.setMatrixAt(i * 2 + 1, m);
    });
    body.instanceColor.needsUpdate = true;
    body.castShadow = cab.castShadow = true; body.receiveShadow = cab.receiveShadow = true;
    body.computeBoundingSphere(); cab.computeBoundingSphere();
    group.add(body, cab);
  }
  return {
    group,
    plots: plots.map(p => ({ x: xs[p.i + N], z: zs[p.j + N], w: colW[p.i + N] - 2 * wk, d: rowD[p.j + N] - 2 * wk })),
    road: rw, walk: wk, vx, hz, ext: { X0, X1, Z0, Z1 },
  };
}
