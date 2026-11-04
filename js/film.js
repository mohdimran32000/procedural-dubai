// film.js - the ~50 s LinkedIn cut. Every frame is a pure function of time t, so a headless
// browser can step through it frame by frame and the result is identical on every run.
import { clamp, lerp, easeInOut } from './core.js';

const D2R = Math.PI / 180;
export const DURATION = 50;
const FD = {
  house: { width: 24, depth: 22, towers: 2, towerHeight: 60, upper: 1, arcade: 'two', parapet: 'tri', yard: 'ghaf', seed: 7 },
  deira: { floors: 12, baysX: 6, baysY: 4, style: 'arches', balcony: 'solid', pattern: 'alt', ac: 60, arcade: true, signs: true, paint: 'seed', seed: 3 },
  tower: { floors: 80, width: 34, depth: 28, corners: 'round', twist: 0, taper: 8, podium: 4, glass: 'blue', fins: 'alt', crown: 'blades', seed: 11 },
};
const seg = (a, b, t) => clamp((t - a) / (b - a), 0, 1);
const E = x => easeInOut(x);
const stepI = (from, to, a, b, t) => Math.round(lerp(from, to, seg(a, b, t)));
const orbit = (f, az, el, dist, ty, fov) => {
  const a = az * D2R, e = el * D2R;
  return { pos: [f.x + Math.sin(a) * Math.cos(e) * dist, ty + Math.sin(e) * dist, f.z + Math.cos(a) * Math.cos(e) * dist], target: [f.x, ty, f.z], fov };
};

const CAPS = [
  [0.0, 2.1, 'These buildings weren’t <em>modelled.</em>'],
  [2.1, 4.25, 'They’re generated from <em>rules.</em>'],
  [4.35, 8.5, 'Change one number.<br>The rules <em>run again.</em>'],
  [8.75, 14.85, 'The same rules <em>count</em><br>what they place.'],
  [15.15, 19.05, 'Same rules.<br><em>New dice roll.</em>'],
  [19.35, 23.45, 'Old Dubai<br>courtyard house.'],
  [23.75, 27.45, 'Wind towers in.<br>AC units: <em>zero.</em>'],
  [27.75, 30.05, 'New Dubai tower.'],
  [30.35, 34.45, '20 floors to 80.<br>The register <em>keeps up.</em>'],
  [34.75, 37.25, 'Twist it 35°. The rules<br><em>re-place every panel.</em>'],
  [37.55, 44.4, 'Five light presets.<br><em>Shamal</em> included.'],
  [44.75, 46.95, 'Old Dubai. 80s Deira.<br>New Dubai.'],
];

function spec(t) {
  // ---- 80s Deira ----
  if (t < 8.6) {
    const floors = stepI(3, 12, 0.35, 3.5, t), baysX = stepI(6, 9, 4.7, 6.3, t), style = t < 7.25 ? 'arches' : 'grid';
    const k = E(seg(0, 8.6, t)), fl = lerp(3, 12, E(seg(0.2, 3.7, t))), Hh = 4.6 + fl * 3.1 + 4, k2 = E(seg(4.2, 8.6, t));
    const dist = t < 4.2 ? 30 + Hh * 1.45 : lerp(30 + 45.8 * 1.45, 108, k2), ty = t < 4.2 ? Hh * 0.45 : lerp(45.8 * 0.45, 20, k2);
    return {
      type: 'deira', params: { deira: { floors, baysX, style } }, mood: 'golden',
      cam: f => orbit(f, lerp(14, 46, k), lerp(13, 18, k), dist, ty, 36),
      param: t < 4.2 ? { group: '80s Deira · mid-rise', label: 'Floors above shops', value: floors, frac: (floors - 2) / 12 }
        : t < 7.0 ? { group: '80s Deira · mid-rise', label: 'Bays, front', value: baysX, frac: (baysX - 3) / 7 }
          : { group: '80s Deira · mid-rise', label: 'Facade style', value: style === 'grid' ? 'Grid' : 'Arches', frac: null },
    };
  }
  if (t < 15.0) {
    const ac = 10 * stepI(1, 10, 9.3, 13.6, t), k = E(seg(8.6, 15.0, t));
    return {
      type: 'deira', params: { deira: { baysX: 8, ac } }, mood: 'golden',
      cam: f => ({ pos: [f.x + lerp(15, 7, k), 24.5, f.z + f.fd + 15.5], target: [f.x + lerp(2, -5, k), 21.2, f.z + f.fd], fov: 40 }),
      param: { group: '80s Deira · mid-rise', label: 'AC units on facade', value: `${ac}%`, frac: ac / 100 },
      reg: ['ac', 'windows', 'balc', 'tanks', 'lifts'],
    };
  }
  if (t < 19.2) {
    const seed = 3 + stepI(0, 6, 15.4, 18.6, t), k = E(seg(15.0, 19.2, t));
    return {
      type: 'deira', params: { deira: { baysX: 8, ac: 70, pattern: 'random', seed } }, mood: 'golden',
      cam: f => orbit(f, lerp(40, 33, k), 15, lerp(100, 92, k), 18, 36),
      param: { group: '80s Deira · mid-rise', label: 'Seed', value: seed, frac: null },
      reg: ['ac', 'balc', 'shops', 'tanks', 'paint'],
    };
  }
  // ---- Old Dubai courtyard house ----
  if (t < 23.6) {
    const towers = stepI(0, 4, 19.6, 22.6, t), k = E(seg(19.2, 23.6, t));
    return {
      type: 'house', params: { house: { towers } }, mood: 'golden',
      cam: f => orbit(f, lerp(28, 44, k), lerp(52, 38, k), lerp(66, 54, k), 3.5, 36),
      param: { group: 'Old Dubai · courtyard house', label: 'Wind towers', value: towers, frac: towers / 4 },
      reg: ['towers', 'ac', 'rooms', 'teak', 'yard'],
    };
  }
  if (t < 27.6) {
    const th = 5 * stepI(6, 20, 23.9, 25.9, t), k = E(seg(23.6, 27.6, t));
    return {
      type: 'house', params: { house: { towers: 4, towerHeight: th } }, mood: 'golden',
      cam: f => ({ pos: [f.x + lerp(19, 15, k), lerp(2.0, 2.9, k), f.z + lerp(21, 23, k)], target: [f.x + 3, 7.5, f.z + 2], fov: 46 }),
      param: { group: 'Old Dubai · courtyard house', label: 'Tower height', value: `${th}%`, frac: th / 100 },
      reg: ['towers', 'ac', 'rooms', 'teak', 'yard'],
    };
  }
  // ---- New Dubai tower ----
  if (t < 30.2) {
    const k = E(seg(27.6, 30.2, t));
    return {
      type: 'tower', params: { tower: { floors: 40 } }, mood: 'noon',
      cam: f => ({ pos: [f.x + lerp(30, 26, k), 1.6, f.z + f.d / 2 + lerp(10, 13, k)], target: [f.x - 4, lerp(68, 92, k), f.z], fov: 70 }),
      param: { group: 'New Dubai · tower', label: 'Floors', value: 40, frac: 20 / 70 },
      reg: ['floors', 'fcu', 'lifts', 'panels', 'bmu'],
    };
  }
  if (t < 34.6) {
    const floors = stepI(20, 80, 30.45, 34.0, t), k = E(seg(30.2, 34.6, t));
    return {
      type: 'tower', params: { tower: { floors } }, mood: 'noon',
      cam: f => orbit(f, lerp(28, 38, k), lerp(11, 15, k), lerp(300, 560, k), lerp(45, 135, k), 36),
      param: { group: 'New Dubai · tower', label: 'Floors', value: floors, frac: (floors - 20) / 70 },
      reg: ['floors', 'fcu', 'lifts', 'panels', 'bmu'],
    };
  }
  if (t < 37.4) {
    const twist = stepI(0, 35, 34.8, 37.0, t), k = E(seg(34.6, 37.4, t));
    return {
      type: 'tower', params: { tower: { twist } }, mood: 'noon',
      cam: f => orbit(f, lerp(38, 58, k), lerp(15, 18, k), 560, 135, 36),
      param: { group: 'New Dubai · tower', label: 'Twist', value: `${twist}°`, frac: twist / 45 },
      reg: ['floors', 'fcu', 'lifts', 'panels', 'bmu'],
    };
  }
  if (t < 44.6) {
    const k = E(seg(37.4, 44.6, t));
    let mood = 'golden';
    if (t >= 39.0 && t < 39.4) mood = ['golden', 'shamal', E(seg(39.0, 39.4, t))];
    else if (t >= 39.4 && t < 40.8) mood = 'shamal';
    else if (t >= 40.8 && t < 41.2) mood = ['shamal', 'blue', E(seg(40.8, 41.2, t))];
    else if (t >= 41.2 && t < 42.6) mood = 'blue';
    else if (t >= 42.6 && t < 43.0) mood = ['blue', 'night', E(seg(42.6, 43.0, t))];
    else if (t >= 43.0) mood = 'night';
    return {
      type: 'tower', params: { tower: { twist: 35 } }, mood,
      cam: f => orbit(f, lerp(58, 96, k), lerp(14, 9, k), lerp(600, 500, k), lerp(125, 112, k), 38),
      param: { group: 'Light preset', label: 'Light', value: null, frac: null, mood: true },
    };
  }
  // ---- all three on one street ----
  const k = E(seg(44.6, 50, t));
  return {
    type: 'all', params: { house: { towers: 4 }, deira: { floors: 10, baysX: 7 }, tower: { twist: 35 } }, mood: 'blue',
    cam: f => { const P = f.plots; return orbit({ x: (P[0].x + P[1].x) / 2 + 10, z: 0 }, lerp(-56, -46, k), lerp(20, 16, k), lerp(250, 225, k), lerp(34, 40, k), 40); },
    end: true,
  };
}

function buildHud(root) {
  root.innerHTML = `
  <div class="f-scrim"></div>
  <div class="f-brand"><i></i><b>PROCEDURAL DUBAI</b><span>rules &rarr; three.js · live</span></div>
  <div class="f-mood">LIGHT<b></b></div>
  <div class="f-cap"><div></div></div>
  <div class="f-param"><div class="fp-top"><i></i><span class="fp-group"></span></div><div class="fp-row"><span class="fp-label"></span><b class="fp-val"></b></div><div class="fp-track"><div class="fp-fill"></div><div class="fp-knob"></div></div></div>
  <div class="f-reg"><div class="fr-top"><span>ASSET REGISTER</span><em>same rules</em></div><div class="fr-rows"></div></div>
  <div class="f-end">
    <div class="eb">PROCEDURAL DUBAI</div>
    <h2>Three buildings.<br>Made from rules.</h2>
    <p>Running live in your browser, with an asset register that counts what the rules place.</p>
    <div class="cta">Live demo + code: link in the post</div>
    <div class="tools">three.js · rules in JavaScript · built with Claude Code</div>
  </div>`;
  const q = s => root.querySelector(s);
  return { scrim: q('.f-scrim'), brand: q('.f-brand'), mood: q('.f-mood'), moodB: q('.f-mood b'), cap: q('.f-cap'), capT: q('.f-cap div'), param: q('.f-param'), pg: q('.fp-group'), pl: q('.fp-label'), pv: q('.fp-val'), track: q('.fp-track'), fill: q('.fp-fill'), knob: q('.fp-knob'), reg: q('.f-reg'), rows: q('.fr-rows'), end: q('.f-end'), endH: q('.f-end h2'), endP: q('.f-end p'), endC: q('.f-end .cta'), endT: q('.f-end .tools') };
}
const fade = (t, a, b, fi = 0.25, fo = 0.2) => (t < a || t > b ? 0 : Math.min(1, (t - a) / fi, (b - t) / fo));
const fmt = v => (typeof v === 'number' ? Math.round(v).toLocaleString('en-US') : v);

export function setupFilm(app) {
  const THREE = app.THREE;
  const H = buildHud(document.getElementById('film'));
  let lastKey = '', lastMood = '';
  function apply(t) {
    const s = spec(t);
    app.state.type = s.type;
    for (const k of Object.keys(FD)) app.state.params[k] = { ...FD[k], ...((s.params || {})[k] || {}) };
    const key = JSON.stringify([s.type, s.type === 'all' ? app.state.params : app.state.params[s.type]]);
    if (key !== lastKey) { app.rebuild(); lastKey = key; }
    const mk = typeof s.mood === 'string' ? s.mood : `${s.mood[0]}>${s.mood[1]}@${s.mood[2].toFixed(4)}`;
    if (mk !== lastMood) { app.applyMood(typeof s.mood === 'string' ? s.mood : app.mixMood(s.mood[0], s.mood[1], s.mood[2])); lastMood = mk; }
    const p = s.cam(app.focus, app);
    app.setPose({ pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), fov: p.fov });
    hud(t, s);
  }
  function hud(t, s) {
    H.scrim.style.opacity = s.end ? Math.max(0, 1 - (t - 46.9) / 0.4) : 1;
    H.brand.style.opacity = s.end ? Math.max(0, 1 - (t - 46.8) / 0.4) : 1;
    // caption
    const c = CAPS.find(([a, b]) => t >= a && t <= b);
    if (c) {
      const [a, b, txt] = c, o = a === 0 ? Math.min(1, (b - t) / 0.2) : fade(t, a, b);
      if (H.capT.dataset.t !== txt) { H.capT.innerHTML = txt; H.capT.dataset.t = txt; }
      H.cap.style.opacity = o; H.cap.style.transform = `translateY(${(1 - Math.min(1, (t - a) / 0.3)) * (a === 0 ? 0 : 18)}px)`;
    } else H.cap.style.opacity = 0;
    // light chip
    const label = app.state.moodObj ? app.state.moodObj.label : '';
    H.moodB.textContent = label; H.mood.style.opacity = s.end ? 0 : 1;
    // parameter card
    if (s.param) {
      H.param.style.opacity = t < 0.15 ? 0 : Math.min(1, (t - 0.15) / 0.25);
      H.pg.textContent = s.param.group;
      H.pl.textContent = s.param.label;
      H.pv.textContent = s.param.mood ? label : fmt(s.param.value);
      const hasTrack = s.param.frac != null;
      H.track.style.display = hasTrack ? 'block' : 'none';
      if (hasTrack) { const f = clamp(s.param.frac, 0, 1) * 100; H.fill.style.width = f + '%'; H.knob.style.left = f + '%'; }
    } else H.param.style.opacity = 0;
    // register card
    if (s.reg) {
      const win = s.type === 'deira' ? [9.0, 19.2] : s.type === 'house' ? [19.45, 27.6] : [27.85, 37.4];
      H.reg.style.opacity = fade(t, win[0], win[1], 0.3, 0.001);
      H.reg.style.transform = `translateY(${(1 - Math.min(1, (t - win[0]) / 0.3)) * 24}px)`;
      const rows = s.reg.map(k => app.register.find(r => r.key === k)).filter(Boolean);
      const html = rows.map(r => `<div class="fr${r.hl ? ' hl' : ''}"><span>${r.label}</span><b>${fmt(r.value)}${r.unit ? `<small>${r.unit}</small>` : ''}</b></div>`).join('');
      if (H.rows.dataset.h !== html) { H.rows.innerHTML = html; H.rows.dataset.h = html; }
    } else H.reg.style.opacity = 0;
    // end card
    if (s.end) {
      const e = clamp((t - 47.0) / 0.6, 0, 1);
      H.end.style.opacity = e;
      const rise = (d, x) => `translateY(${(1 - clamp((t - 47.0 - d) / 0.5, 0, 1)) * x}px)`;
      H.endH.style.transform = rise(0.1, 30); H.endP.style.transform = rise(0.25, 24); H.endC.style.transform = rise(0.4, 20); H.endT.style.transform = rise(0.5, 16);
      H.endC.style.opacity = clamp((t - 47.4) / 0.4, 0, 1); H.endT.style.opacity = clamp((t - 47.5) / 0.4, 0, 1);
    } else H.end.style.opacity = 0;
  }
  window.__filmDuration = DURATION;
  window.__filmFrame = t => { apply(t); app.filmRender(t); return true; };
  window.__filmApply = t => { apply(t); return true; };
  apply(0); app.filmRender(0);
}
