// ui.js - boots the app and builds the control panel and the asset register.
import { createApp, FILM, MOBILE, MOODS, MOOD_ORDER } from './main.js';
import { TYPES } from './buildings.js';

const REPO = 'https://github.com/mohdimran32000/procedural-dubai';
const $ = (s, el = document) => el.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const fmt = v => (typeof v === 'number' ? Math.round(v).toLocaleString('en-US') : v);

const loader = $('#loader'), lbar = $('#loader .bar i'), ltext = $('#loader .status');
const progress = (msg, k) => { ltext.textContent = msg; lbar.style.width = Math.max(4, k * 100) + '%'; };

(async () => {
  progress('Loading fonts', 0.1);
  try {
    await Promise.race([Promise.all([document.fonts.load('700 40px "Noto Kufi Arabic"', 'بقالة'), document.fonts.load('800 40px Inter'), document.fonts.load('600 20px "JetBrains Mono"')]), new Promise(r => setTimeout(r, 3000))]);
  } catch (e) { /* fonts are optional */ }
  const app = await createApp($('#c'), { onProgress: progress });
  window.APP = app;
  if (FILM) {
    const { setupFilm } = await import('./film.js');
    document.body.classList.add('film');
    if (new URLSearchParams(location.search).has('clean')) document.body.classList.add('clean');
    setupFilm(app);
    loader.remove();
    window.__ready = true;
    return;
  }
  buildUI(app);
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 900);
  window.__ready = true;
})().catch(err => {
  console.error(err);
  ltext.textContent = 'Could not start: ' + (err && err.message ? err.message : err);
  window.__error = String(err && err.stack ? err.stack : err);
});

const TYPE_LIST = [['house', 'Courtyard house', 'Old Dubai'], ['deira', 'Mid-rise', '80s Deira'], ['tower', 'Tower', 'New Dubai'], ['all', 'All three', 'One street']];
const SHOTS = [['hero', 'Hero ¾'], ['street', 'Street'], ['worm', "Worm's-eye"], ['aerial', 'Aerial'], ['facade', 'Facade'], ['profile', 'Profile']];

function buildUI(app) {
  const panel = $('#panel'), reg = $('#reg');
  const scroll = h('div', { class: 'scroll' });
  const handle = h('button', { class: 'handle', onclick: () => panel.classList.toggle('min') }, h('span', {}, 'Rules and light'), h('i'));
  panel.append(handle, scroll);
  if (MOBILE || innerWidth <= 860) panel.classList.add('min');

  // building type
  const types = h('div', { class: 'types' });
  const typeBtns = TYPE_LIST.map(([k, name, era]) => {
    const b = h('button', { onclick: () => app.setType(k) }, h('b', {}, name), h('span', {}, era));
    b.dataset.k = k; types.append(b); return b;
  });
  const syncTypes = () => typeBtns.forEach(b => b.classList.toggle('on', b.dataset.k === app.state.type));
  scroll.append(types);

  // parameters
  const params = h('div', { class: 'sec' });
  scroll.append(params);
  let pending = null;
  const schedule = fn => { pending = fn; requestAnimationFrame(() => { if (pending) { const f = pending; pending = null; f(); } }); };
  function renderParams() {
    params.innerHTML = '';
    const t = app.state.type;
    if (t === 'all') {
      params.append(h('h3', {}, 'Rules'), h('p', { class: 'note' }, 'All three buildings on one street, each with the rules it has now. Pick one above to change its rules.'));
      return;
    }
    const T = TYPES[t], P = app.state.params[t];
    params.append(h('h3', {}, `Rules · ${T.era}`, h('small', { class: 'ms' }, '')));
    for (const f of T.schema) {
      if (f.type === 'range') {
        const out = h('output', {}, `${P[f.key]}${f.unit || ''}`);
        const inp = h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: P[f.key] });
        const paint = () => inp.style.setProperty('--p', `${((inp.value - f.min) / (f.max - f.min)) * 100}%`);
        paint();
        inp.addEventListener('input', () => { out.textContent = `${inp.value}${f.unit || ''}`; paint(); const v = Number(inp.value); schedule(() => app.setParam(f.key, v)); });
        params.append(h('div', { class: 'ctl' }, h('div', { class: 'lab' }, h('span', {}, f.label), out), inp));
      } else if (f.type === 'choice') {
        const seg = h('div', { class: 'seg' });
        f.options.forEach(([v, lab]) => {
          const b = h('button', { onclick: () => { app.setParam(f.key, v); [...seg.children].forEach(c => c.classList.toggle('on', c === b)); } }, lab);
          if (P[f.key] === v) b.classList.add('on');
          seg.append(b);
        });
        params.append(h('div', { class: 'ctl' }, h('div', { class: 'lab' }, h('span', {}, f.label)), seg));
      } else if (f.type === 'toggle') {
        const sw = h('button', { class: 'sw' + (P[f.key] ? ' on' : ''), 'aria-label': f.label, onclick: () => { const v = !app.state.params[t][f.key]; sw.classList.toggle('on', v); app.setParam(f.key, v); } });
        params.append(h('div', { class: 'row' }, h('span', {}, f.label), sw));
      } else if (f.type === 'seed') {
        const val = h('b', {}, String(P.seed));
        const set = v => { v = ((v - 1 + 999) % 999) + 1; val.textContent = v; app.setParam('seed', v); };
        params.append(h('div', { class: 'ctl' }, h('div', { class: 'lab' }, h('span', {}, 'Seed'), h('output', {}, 'same seed, same building')),
          h('div', { class: 'seed' }, h('button', { class: 'btn', onclick: () => set(app.state.params[t].seed - 1) }, '‹'), val,
            h('button', { class: 'btn', onclick: () => set(app.state.params[t].seed + 1) }, '›'),
            h('button', { class: 'btn gold', onclick: () => set(1 + Math.floor(Math.random() * 999)) }, 'Roll'))));
      }
    }
  }
  renderParams(); syncTypes();
  app.on('type', () => { syncTypes(); renderParams(); });

  // light
  const light = h('div', { class: 'sec' }, h('h3', {}, 'Light'));
  const moodSeg = h('div', { class: 'seg' });
  MOOD_ORDER.forEach(k => { const b = h('button', { onclick: () => app.setMood(k) }, MOODS[k].label); b.dataset.k = k; moodSeg.append(b); });
  const syncMood = () => [...moodSeg.children].forEach(b => b.classList.toggle('on', b.dataset.k === app.state.mood));
  app.on('mood', syncMood); syncMood();
  const expOut = h('output', {}, '1.00');
  const exp = h('input', { type: 'range', min: 0.5, max: 1.6, step: 0.01, value: 1 });
  const paintExp = () => exp.style.setProperty('--p', `${((exp.value - 0.5) / 1.1) * 100}%`); paintExp();
  exp.addEventListener('input', () => { expOut.textContent = Number(exp.value).toFixed(2); paintExp(); app.setExposure(Number(exp.value)); });
  light.append(moodSeg, h('div', { class: 'ctl', style: 'margin-top:12px' }, h('div', { class: 'lab' }, h('span', {}, 'Exposure'), expOut), exp));
  scroll.append(light);

  // camera
  const cam = h('div', { class: 'sec' }, h('h3', {}, 'Camera'));
  const shotSeg = h('div', { class: 'seg' });
  SHOTS.forEach(([k, lab]) => shotSeg.append(h('button', { onclick: () => app.flyTo(k) }, lab)));
  const orbit = h('button', { class: 'sw', 'aria-label': 'Auto orbit', onclick: () => { app.setOrbit(!app.state.orbit); orbit.classList.toggle('on', app.state.orbit); } });
  cam.append(shotSeg, h('div', { class: 'row', style: 'margin-top:12px' }, h('span', {}, 'Auto orbit'), orbit));
  scroll.append(cam);

  // city + quality
  const cityOn = h('button', { class: 'sw on', 'aria-label': 'Show city', onclick: () => { app.setCity(!app.state.cityOn); cityOn.classList.toggle('on', app.state.cityOn); } });
  const hq = h('button', { class: 'sw' + (app.state.quality ? ' on' : ''), 'aria-label': 'Ambient occlusion', onclick: () => { app.setQuality(!app.state.quality); hq.classList.toggle('on', app.state.quality); } });
  const clearV = h('button', { class: 'sw on', 'aria-label': 'Clear the view', onclick: () => { app.setClear(!app.state.clear); clearV.classList.toggle('on', app.state.clear); } });
  scroll.append(h('div', { class: 'sec' }, h('h3', {}, 'City'),
    h('div', { class: 'row' }, h('span', {}, 'Show the city'), cityOn),
    h('div', { class: 'row' }, h('span', {}, 'Clear the view (keep the front low)'), clearV),
    h('div', { class: 'row' }, h('span', {}, 'Ambient occlusion'), hq),
    h('button', { class: 'btn', style: 'width:100%', onclick: () => app.newCity() }, 'New city around it')));

  scroll.append(h('div', { class: 'about', html:
    `<b>What this is.</b> Nobody modelled these buildings. Each one is a set of rules written in JavaScript: how wide a bay is, where a balcony goes, how a wind tower is built. Change a number and the rules run again.<br><br>` +
    `<b>The register.</b> The same rules count what they place, so the asset list updates with the building. The counts are rule-of-thumb and illustrative, not a design.<br><br>` +
    `Original, generic buildings, not real ones. Made by Mohamed Imran with Claude Code. Rendered live with three.js. <a href="${REPO}" target="_blank" rel="noopener">Source on GitHub</a>.` }));

  // asset register
  const rows = h('div', { class: 'r-rows' }), ms = h('span', { class: 'ms' }, '');
  const body = h('div', { class: 'r-body' }, h('div', { class: 'r-sub' }, 'Counted by the same rules that drew the building'), rows,
    h('div', { class: 'r-foot' }, h('span', {}, 'Rule-of-thumb counts. Illustrative, not a design.'), ms));
  const toggle = h('button', { class: 'btn r-toggle', onclick: () => reg.classList.toggle('min') }, 'Show');
  const csv = h('button', { class: 'btn', onclick: () => exportCSV(app) }, 'CSV');
  reg.append(h('div', { class: 'r-head' }, h('span', {}, h('i'), 'ASSET REGISTER'), h('div', { style: 'display:flex;gap:6px' }, toggle, csv)), body);
  if (MOBILE || innerWidth <= 860) reg.classList.add('min');
  const prev = new Map();
  const drawReg = ({ register, ms: t }) => {
    const visible = register.slice(0, MOBILE ? 6 : 9);
    rows.innerHTML = '';
    for (const r of visible) {
      const id = (r.tag || '') + r.key;
      const v = h('div', { class: 'v' }, fmt(r.value), r.unit ? h('small', {}, r.unit) : null);
      const row = h('div', { class: 'rr' + (r.hl ? ' hl' : '') }, h('div', { class: 'l' }, r.tag ? h('span', { class: 'tag' }, r.tag) : null, r.label, h('small', {}, r.rule)), v);
      rows.append(row);
      const p = prev.get(id);
      if (p !== undefined && p !== r.value && typeof r.value === 'number') {
        v.classList.add('flash');
        const from = p, to = r.value, t0 = performance.now();
        const step = now => { const k = Math.min(1, (now - t0) / 380); v.firstChild.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); else setTimeout(() => v.classList.remove('flash'), 200); };
        requestAnimationFrame(step);
      }
      prev.set(id, r.value);
    }
    ms.textContent = `rebuilt in ${Math.max(1, Math.round(t))} ms`;
    const pm = params.querySelector('h3 .ms'); if (pm) pm.textContent = `${Math.max(1, Math.round(t))} ms`;
  };
  app.on('built', drawReg);
  drawReg({ register: app.register, ms: app.state.lastMs });
  toggle.addEventListener('click', () => { toggle.textContent = reg.classList.contains('min') ? 'Show' : 'Hide'; });
}

function exportCSV(app) {
  const t = app.state.type, name = t === 'all' ? 'all-three' : t;
  const lines = [['building', 'item', 'count', 'unit', 'rule'].join(',')];
  for (const r of app.register) lines.push([r.tag || (TYPES[t] ? TYPES[t].era : ''), r.label, r.value, r.unit || '', `"${r.rule}"`].join(','));
  if (t !== 'all') lines.push('', `parameters,"${Object.entries(app.state.params[t]).map(([k, v]) => `${k}=${v}`).join('; ')}"`);
  lines.push('', '"Rule-of-thumb counts from a procedural generator. Illustrative, not a design."');
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `procedural-dubai-${name}-register.csv` });
  document.body.append(a); a.click(); a.remove();
}
