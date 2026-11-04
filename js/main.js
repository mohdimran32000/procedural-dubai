// main.js - renderer, light, sky, post-processing, cameras and the rebuild loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { makeTextures, makeMaterials, clamp, lerp, easeInOut, rng } from './core.js';
import { TYPES, defaults } from './buildings.js';
import { buildCity } from './city.js';

const D2R = Math.PI / 180;
export const Q = new URLSearchParams(location.search);
export const FILM = Q.has('film');
export const MOBILE = !FILM && (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 640);

// ---------- light presets ----------
export const MOODS = {
  noon: {
    label: 'Noon', sunEl: 66, sunAz: 335, sun: '#fff3df', sunI: 3.3, hemiSky: '#cfe0f2', hemiGround: '#d6c19c', hemiI: 0.95,
    top: '#2f6fb8', horizon: '#dfe7ec', bottom: '#cbb690', glow: 0.5, sunSize: 0.0012, haze: 0.55,
    fog: '#dde4e7', fogD: 0.00042, exposure: 0.8, env: 0.9, bloom: 0.1, win: 0, lamps: 0, crown: 0, dust: 0,
    grade: { sat: 1.03, con: 1.05, tint: [1.0, 0.995, 0.98], vig: 0.16 },
  },
  golden: {
    label: 'Golden hour', sunEl: 10, sunAz: 312, sun: '#ffb062', sunI: 3.8, hemiSky: '#8fb0d8', hemiGround: '#c59a6c', hemiI: 0.62,
    top: '#3e6aa8', horizon: '#ffc48e', bottom: '#a98762', glow: 1.6, sunSize: 0.002, haze: 0.42,
    fog: '#ecc7a2', fogD: 0.0006, exposure: 0.95, env: 0.9, bloom: 0.2, win: 0, lamps: 0, crown: 0, dust: 0,
    grade: { sat: 1.08, con: 1.06, tint: [1.0, 0.975, 0.94], vig: 0.22 },
  },
  shamal: {
    label: 'Shamal', sunEl: 30, sunAz: 318, sun: '#e8b27a', sunI: 1.7, hemiSky: '#d9b48a', hemiGround: '#a6845d', hemiI: 1.3,
    top: '#c49c72', horizon: '#dcb88d', bottom: '#b8956c', glow: 0.8, sunSize: 0.006, haze: 0.3,
    fog: '#d4ad82', fogD: 0.0017, exposure: 0.95, env: 0.55, bloom: 0.16, win: 0.28, lamps: 0.55, crown: 0.35, dust: 1,
    grade: { sat: 0.96, con: 1.06, tint: [1.0, 0.97, 0.92], vig: 0.3 },
  },
  blue: {
    label: 'Blue hour', sunEl: -3, sunAz: 300, lightEl: 38, lightAz: 330, sun: '#86a2d4', sunI: 0.38, hemiSky: '#5672aa', hemiGround: '#2a2833', hemiI: 0.6,
    top: '#0c2152', horizon: '#c98d7d', bottom: '#1e2029', glow: 0.9, sunSize: 0, haze: 0.55,
    fog: '#5b5f82', fogD: 0.001, exposure: 1.08, env: 1.0, bloom: 0.42, win: 1, lamps: 1, crown: 1, dust: 0,
    grade: { sat: 1.06, con: 1.06, tint: [0.97, 0.985, 1.0], vig: 0.28 },
  },
  night: {
    label: 'Night', sunEl: -20, sunAz: 120, lightEl: 42, lightAz: 340, sun: '#8ea6d8', sunI: 0.16, hemiSky: '#1e2c4c', hemiGround: '#151317', hemiI: 0.32,
    top: '#03060f', horizon: '#2b2024', bottom: '#0b0b0f', glow: 0, sunSize: 0, haze: 0.6,
    fog: '#1e1b22', fogD: 0.0011, exposure: 1.12, env: 0.6, bloom: 0.55, win: 1.1, lamps: 1.2, crown: 1.2, dust: 0,
    grade: { sat: 1.0, con: 1.08, tint: [0.98, 0.98, 1.0], vig: 0.32 },
  },
};
export const MOOD_ORDER = ['noon', 'golden', 'shamal', 'blue', 'night'];
const COLOR_KEYS = ['sun', 'hemiSky', 'hemiGround', 'top', 'horizon', 'bottom', 'fog'];
function normMood(m) { const o = { ...m, grade: { ...m.grade } }; for (const k of COLOR_KEYS) o[k] = new THREE.Color(m[k]); o.lightEl = m.lightEl ?? m.sunEl; o.lightAz = m.lightAz ?? m.sunAz; return o; }
const NM = Object.fromEntries(Object.entries(MOODS).map(([k, v]) => [k, normMood(v)]));
export function mixMood(a, b, k) {
  const A = NM[a], B = NM[b], o = { grade: {} };
  for (const key of Object.keys(A)) {
    if (key === 'grade' || key === 'label') continue;
    if (A[key] instanceof THREE.Color) o[key] = A[key].clone().lerp(B[key], k);
    else if (typeof A[key] === 'number') o[key] = lerp(A[key], B[key], k);
  }
  for (const g of ['sat', 'con', 'vig']) o.grade[g] = lerp(A.grade[g], B.grade[g], k);
  o.grade.tint = A.grade.tint.map((v, i) => lerp(v, B.grade.tint[i], k));
  o.label = k < 0.5 ? A.label : B.label;
  return o;
}

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform vec3 top, horizon, bottom, sunDir, sunColor; uniform float sunSize, glow, haze;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), haze)) : mix(horizon, bottom, pow(clamp(-h * 3.0, 0.0, 1.0), 0.5));
  vec3 sd = normalize(sunDir); float s = max(dot(d, sd), 0.0);
  float hb = smoothstep(-0.25, 0.15, h) * (1.0 - smoothstep(0.1, 0.7, h));
  col += sunColor * glow * (pow(s, 6.0) * 0.22 + pow(s, 48.0) * 0.5) * mix(0.6, 1.0, hb);
  col += sunColor * glow * 0.18 * pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), normalize(vec3(sd.x, 0.0, sd.z) + 1e-4)), 0.0), 3.0) * hb;
  if (sunSize > 0.0) col += sunColor * 14.0 * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.55, s);
  gl_FragColor = vec4(col, 1.0);
}`;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1 }, uCon: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0.2 }, uGrain: { value: 0.012 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1080, 1350) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig, uGrain, uTime; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat);
    c = (c - 0.5) * uCon + 0.5; c *= uTint;
    vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y; c *= mix(1.0 - uVig, 1.0, smoothstep(0.95, 0.25, length(d)));
    c += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`,
};

export async function createApp(canvas, { onProgress = () => {} } = {}) {
  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach(f => f(data));
  const W0 = () => (FILM ? 1080 : innerWidth), H0 = () => (FILM ? 1350 : innerHeight);
  const PR = FILM ? parseFloat(Q.get('pr') || '1.5') : Math.min(devicePixelRatio || 1, MOBILE ? 1.3 : 1.75);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: FILM });
  renderer.setPixelRatio(PR);
  renderer.setSize(W0(), H0());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xdddddd, 0.0006);
  const camera = new THREE.PerspectiveCamera(36, W0() / H0(), 0.3, 9000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.94;
  controls.minDistance = 3; controls.maxDistance = 2600; controls.autoRotateSpeed = 0.6;
  if (FILM) controls.enabled = false;

  // sky -> background cube + image-based light
  const skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunSize: { value: 0.002 }, glow: { value: 1 }, haze: { value: 0.5 } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false });
  const skyScene = new THREE.Scene();
  skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), skyMat));
  const cubeRT = new THREE.WebGLCubeRenderTarget(FILM ? 1024 : 512, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.1, 200, cubeRT);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  const updateSky = () => {
    cubeCam.update(renderer, skyScene);
    scene.background = cubeRT.texture;
    const old = envRT; envRT = pmrem.fromScene(skyScene, 0.02, 0.1, 100);
    scene.environment = envRT.texture; if (old) old.dispose();
  };

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const SM = MOBILE ? 2048 : 4096;
  sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.6);
  scene.add(hemi);
  const sunDir = new THREE.Vector3(0, 1, 0);

  // sand haze particles for the shamal preset
  const DUST = 7000, dustBase = new Float32Array(DUST * 3), dustGeo = new THREE.BufferGeometry();
  { const r = rng(5); for (let i = 0; i < DUST; i++) { dustBase[i * 3] = r() * 400 - 200; dustBase[i * 3 + 1] = r() * 120; dustBase[i * 3 + 2] = r() * 400 - 200; } }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe0bb8a, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: true }));
  dust.frustumCulled = false; dust.visible = false; scene.add(dust);

  // post
  const rt = new THREE.WebGLRenderTarget(W0() * PR, H0() * PR, { type: THREE.HalfFloatType, samples: MOBILE ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(PR); composer.setSize(W0(), H0());
  const gtao = new GTAOPass(scene, camera, W0() * PR, H0() * PR);
  gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({ radius: 2, distanceExponent: 1.4, thickness: 2, distanceFallOff: 1, scale: 1.25, samples: FILM ? 24 : 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(W0(), H0()), 0.3, 0.55, 0.92);
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uRes.value.set(W0(), H0());
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(gtao);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(grade);

  onProgress('Making textures', 0.25);
  await new Promise(r => setTimeout(r, 0));
  const TX = makeTextures(), M = makeMaterials(TX);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  for (const t of Object.values(TX)) if (t && t.isTexture) t.anisotropy = Math.min(8, maxAniso);
  const ctx = { mats: M, tex: TX, signs: [] };

  const state = {
    type: TYPES[Q.get('b')] || Q.get('b') === 'all' ? Q.get('b') : 'deira',
    params: { house: defaults('house'), deira: defaults('deira'), tower: defaults('tower') },
    mood: MOODS[Q.get('mood')] ? Q.get('mood') : 'golden', moodObj: null,
    cityOn: true, citySeed: 1, clear: true, quality: !MOBILE, orbit: false, lastMs: 0,
  };
  const world = new THREE.Group(); scene.add(world);
  let heroes = [], city = null, cityKey = '';
  let focus = { x: 0, z: 0, w: 20, d: 20, h: 30, fd: 10 };
  let register = [];

  const dispose = g => g.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh && o.geometry) o.geometry.dispose(); });
  const q8 = v => Math.ceil(v / 8) * 8;

  function rebuild() {
    const t0 = performance.now();
    for (const h of heroes) { world.remove(h); dispose(h); }
    heroes = [];
    ctx.signs = [];
    let outs, district;
    if (state.type === 'all') {
      outs = ['house', 'deira', 'tower'].map(k => ({ k, o: TYPES[k].build(state.params[k], ctx) }));
      district = 'deira';
    } else {
      outs = [{ k: state.type, o: TYPES[state.type].build(state.params[state.type], ctx) }];
      district = TYPES[state.type].district;
    }
    const plots = outs.map((x, n) => ({ i: outs.length === 1 ? 0 : n - 1, j: 0, w: q8(x.o.plot.w), d: q8(x.o.plot.d), kind: x.k }));
    const key = JSON.stringify([district, state.citySeed, state.clear, plots.map(p => [p.i, p.w, p.d, p.kind])]);
    if (key !== cityKey) {
      if (city) { world.remove(city.group); dispose(city.group); }
      city = buildCity({ district, seed: state.citySeed, plots, clear: state.clear ? [-70, 115] : null }, M);
      world.add(city.group); cityKey = key;
    }
    city.group.visible = state.cityOn;
    const y0 = city.walk > 0 ? 0.15 : 0;
    outs.forEach((x, n) => { x.o.group.position.set(city.plots[n].x, y0, city.plots[n].z); world.add(x.o.group); heroes.push(x.o.group); });
    if (outs.length === 1) {
      const o = outs[0].o, p = city.plots[0];
      focus = { x: p.x, z: p.z, w: o.bounds.w, d: o.bounds.d, h: o.bounds.h, fd: (o.bounds.td || o.bounds.d) / 2, fw: (o.bounds.tw || o.bounds.w) / 2, podium: o.bounds.podium || 0 };
      register = o.reg;
    } else {
      const xs = city.plots.map((p, n) => [p.x - outs[n].o.bounds.w / 2, p.x + outs[n].o.bounds.w / 2]);
      const x0 = Math.min(...xs.map(v => v[0])), x1 = Math.max(...xs.map(v => v[1]));
      focus = { x: (x0 + x1) / 2, z: 0, w: x1 - x0, d: 60, h: Math.max(...outs.map(x => x.o.bounds.h)), fd: 30, fw: (x1 - x0) / 2, plots: city.plots.map((p, n) => ({ ...p, b: outs[n].o.bounds, k: outs[n].k })) };
      const pick = (o, ks) => o.reg.filter(r => ks.includes(r.key));
      register = [
        ...pick(outs[0].o, ['towers', 'ac']).map(r => ({ ...r, tag: 'Old Dubai' })),
        ...pick(outs[1].o, ['ac', 'tanks']).map(r => ({ ...r, tag: '80s Deira' })),
        ...pick(outs[2].o, ['fcu', 'bmu']).map(r => ({ ...r, tag: 'New Dubai' })),
      ];
    }
    state.lastMs = performance.now() - t0;
    emit('built', { register, ms: state.lastMs, type: state.type });
  }

  // ---------- moods ----------
  function applyMood(m) {
    if (typeof m === 'string') m = NM[m];
    state.moodObj = m;
    const el = m.sunEl * D2R, az = m.sunAz * D2R, lel = m.lightEl * D2R, laz = m.lightAz * D2R;
    skyU.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sunDir.set(Math.sin(laz) * Math.cos(lel), Math.sin(lel), Math.cos(laz) * Math.cos(lel));
    sun.color.copy(m.sun); sun.intensity = m.sunI;
    hemi.color.copy(m.hemiSky); hemi.groundColor.copy(m.hemiGround); hemi.intensity = m.hemiI;
    skyU.top.value.copy(m.top); skyU.horizon.value.copy(m.horizon); skyU.bottom.value.copy(m.bottom);
    skyU.sunColor.value.copy(m.sun); skyU.sunSize.value = m.sunSize; skyU.glow.value = m.glow; skyU.haze.value = m.haze;
    scene.fog.color.copy(m.fog); scene.fog.density = m.fogD;
    renderer.toneMappingExposure = m.exposure * (state.exposure || 1);
    scene.environmentIntensity = m.env;
    bloom.strength = m.bloom;
    M.glassLit.emissiveIntensity = m.win * 1.15;
    M.tglassLit.emissiveIntensity = m.win * 0.95; M.tglassLit2.emissiveIntensity = m.win * 0.8;
    M.clay.emissiveIntensity = m.win * 0.8;
    M.shopGlass.emissiveIntensity = m.lamps * 0.55;
    M.sign.emissiveIntensity = m.lamps * 1.25;
    M.lampHead.emissiveIntensity = m.lamps * 7;
    M.crownLight.emissiveIntensity = m.crown * 6;
    M.aviation.emissiveIntensity = m.lamps * 9;
    M.pool.emissiveIntensity = m.lamps * 0.9;
    grade.uniforms.uSat.value = m.grade.sat; grade.uniforms.uCon.value = m.grade.con; grade.uniforms.uVig.value = m.grade.vig;
    grade.uniforms.uTint.value.set(...m.grade.tint);
    dust.material.opacity = m.dust * 0.5; dust.visible = m.dust > 0.01;
    updateSky();
  }
  function setMood(name) { state.mood = name; applyMood(name); emit('mood', name); }

  // ---------- cameras ----------
  function shotPose(name) {
    const f = focus, aspect = camera.aspect, r = 0.5 * Math.hypot(f.w, f.d, f.h);
    const fit = (fov, k = 1.06) => { const vf = fov * D2R, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect); return (r * k) / Math.sin(Math.min(vf, hf) / 2); };
    const orbitAt = (azd, eld, dist, fov, ty) => { const a = azd * D2R, e = eld * D2R, t = new THREE.Vector3(f.x, ty, f.z); return { pos: new THREE.Vector3(t.x + Math.sin(a) * Math.cos(e) * dist, t.y + Math.sin(e) * dist, t.z + Math.cos(a) * Math.cos(e) * dist), target: t, fov }; };
    switch (name) {
      case 'aerial': return orbitAt(28, 56, fit(36, 1.15), 36, f.h * 0.22);
      case 'street': return { pos: new THREE.Vector3(f.x + f.w * 0.42, 1.65, f.z + f.d / 2 + clamp(f.h * 0.3, 14, 70)), target: new THREE.Vector3(f.x, clamp(f.h * 0.5, 4, 70), f.z), fov: 56 };
      case 'worm': return { pos: new THREE.Vector3(f.x + f.w * 0.5 + 3, 0.9, f.z + f.d * 0.5 + 5), target: new THREE.Vector3(f.x - f.w * 0.08, f.h * 0.72, f.z - f.d * 0.08), fov: 74 };
      case 'facade': { const ty = clamp(f.h * 0.42, 2.6, 140); return { pos: new THREE.Vector3(f.x + f.fw * 0.75, ty + 1.2, f.z + f.fd + clamp(f.h * 0.22, 9, 46)), target: new THREE.Vector3(f.x - f.fw * 0.1, ty, f.z + f.fd), fov: 34 }; }
      case 'profile': return orbitAt(90, 4, fit(30, 1.04), 30, f.h * 0.45);
      default: return orbitAt(36, 17, fit(36), 36, f.h * 0.42);
    }
  }
  let tween = null;
  function flyTo(name, dur = 1.6) {
    const p = shotPose(name);
    tween = { from: { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }, to: p, t0: performance.now() / 1000, dur };
    emit('shot', name);
  }
  function setPose(p) { camera.position.copy(p.pos); controls.target.copy(p.target); camera.fov = p.fov; camera.lookAt(p.target); camera.updateProjectionMatrix(); }

  // ---------- per-frame upkeep ----------
  const _v = new THREE.Vector3();
  function upkeep(time) {
    const dist = camera.position.distanceTo(controls.target);
    const near = clamp(dist * 0.004, 0.08, 4);
    if (Math.abs(camera.near - near) / near > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
    const R = clamp(dist * 0.85, 22, 560);
    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).addScaledVector(sunDir, 2000);
    const c = sun.shadow.camera;
    if (c.right !== R) { c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 4200; c.updateProjectionMatrix(); }
    const ar = clamp(dist * 0.022, 0.35, 7);
    gtao.updateGtaoMaterial({ radius: ar, thickness: ar * 1.2 });
    gtao.enabled = state.quality;
    if (dust.visible) {
      const p = dustGeo.attributes.position.array, cx = controls.target.x, cz = controls.target.z;
      for (let i = 0; i < DUST; i++) {
        const x = ((dustBase[i * 3] + time * 9 + 200) % 400 + 400) % 400 - 200;
        const z = ((dustBase[i * 3 + 2] + time * 3.5 + 200) % 400 + 400) % 400 - 200;
        p[i * 3] = cx + x; p[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(time * 0.7 + i) * 0.6; p[i * 3 + 2] = cz + z;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }
    grade.uniforms.uTime.value = time;
  }
  function render(time) { upkeep(time); composer.render(); }

  function resize() {
    if (FILM) return;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    grade.uniforms.uRes.value.set(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  onProgress('Laying out the city', 0.5);
  await new Promise(r => setTimeout(r, 0));
  applyMood(state.mood);
  rebuild();
  setPose(shotPose('hero'));
  onProgress('Compiling shaders', 0.8);
  await new Promise(r => setTimeout(r, 0));
  renderer.compile(scene, camera);
  render(0);

  const app = {
    THREE, scene, camera, controls, renderer, composer, state, M, TX, MOODS, MOOD_ORDER,
    get register() { return register; }, get focus() { return focus; }, get cityInfo() { return city; },
    on(ev, f) { (listeners[ev] ||= []).push(f); },
    setType(t) { if (t === state.type) return; state.type = t; rebuild(); flyTo('hero', 1.4); emit('type', t); },
    setParam(k, v, type = state.type) { state.params[type][k] = v; rebuild(); },
    setParams(type, obj) { Object.assign(state.params[type], obj); },
    rebuild, setMood, applyMood, mixMood, flyTo, shotPose, setPose,
    setOrbit(on) { state.orbit = on; controls.autoRotate = on; },
    setQuality(on) { state.quality = on; },
    setCity(on) { state.cityOn = on; if (city) city.group.visible = on; },
    setClear(on) { state.clear = on; rebuild(); },
    newCity() { state.citySeed = (state.citySeed % 9973) + 1 + Math.floor(Math.random() * 50); rebuild(); },
    setExposure(e) { state.exposure = e; renderer.toneMappingExposure = (state.moodObj?.exposure || 1) * e; },
    render,
    // film hooks: drive everything explicitly
    filmRender(time) { render(time); },
  };

  if (!FILM) {
    const loop = now => {
      requestAnimationFrame(loop);
      const t = now / 1000;
      if (tween) {
        const k = clamp((t - tween.t0) / tween.dur, 0, 1), e = easeInOut(k);
        camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
        controls.target.lerpVectors(tween.from.target, tween.to.target, e);
        camera.fov = lerp(tween.from.fov, tween.to.fov, e); camera.updateProjectionMatrix();
        if (k >= 1) tween = null;
      }
      controls.update();
      if (camera.position.y < 0.6) { camera.position.y = 0.6; }
      render(t);
    };
    requestAnimationFrame(loop);
  }
  onProgress('Ready', 1);
  return app;
}
