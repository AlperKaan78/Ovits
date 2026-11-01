// ============================================================
// src/world3d.js  —  SAHİBİ: Kişi 1  (ES modülü, Three.js r180: assets/vendor/three.module.js)
// 3D dünya: zemin (yükselti, renk, doku), ışık, gün-gece, strateji kamerası, ekrandan kare seçme.
// Nesneleri bu dosya çizmez; src/oyun3d.js bu zeminin üstüne yerleştirir.
//
// Koordinat: 1 kare = 1 birim. Kare (x, y) -> dünya (X = x - w/2, Y = yükselti, Z = y - h/2).
// Harita kuzeyi -Z. Kamera güneybatıdan bakar (şehir önde solda, sarmaşık ormanı arkada sağda);
// güneş kuzeyden vurur: ışık ekranda sol üstten gelir, gölgeler sağ alta düşer. Tema: brandbook v0.1.
//
// createWorld(container, { map, world }) şunu döner:
//   heightAt(x, y)            kare koordinatında zemin yüksekliği
//   toWorld(x, y, lift)       THREE.Vector3
//   toScreen(x, y, lift)      { x, y, visible } ekran pikseli
//   pick(cx, cy)              ekran pikselinden { wx, wy, tx, ty } ya da null (harita dışı)
//   groundAt(cx, cy)          pick gibi ama harita dışında da nokta döner (küçük harita çerçevesi için)
//   terrainType(tx)           'rock' | 'plain' | 'forest' (core.js bant kuralı)
//   focus(x, y), rotate(dir), setNight(k), update(dt), render(), scene, camera, renderer
//   edgeScroll                false iken ekran kenarı kaydırması durur (kutu seçimi sırasında)
// ============================================================
import * as THREE from '../assets/vendor/three.module.js';
export { THREE };

const DEF = {
  seed: 9,               // Zeyra-9
  margin: 18,            // harita dışında görünen kenar (kare)
  detail: 3,             // kare başına zemin bölmesi
  rockEnd: 12, forestStart: 42, // core.js: x < 12 kayalık, x < 42 düzlük, sonrası orman
  plateauH: 2.2, plainRelief: 1.1, basinH: -0.45,
  rampY: 20.5, rampHalf: 3.5, // Merkez'den düzlüğe inen rampa
  craters: 6,
  colors: {
    regolit: '#b9ad97', regolitLight: '#d3c8b1', regolitDark: '#9b8f7a',
    rock: '#8c877f', rockLight: '#aaa398', cliff: '#7b7166',
    forestSoil: '#3e2f45', forestSoilLight: '#4f3d55',
    craterFloor: '#8a7d69', craterRim: '#dacfb8', rim: '#978d7f',
    daySky: '#d8d0e4', dayGround: '#b9ad97', daySun: '#ffe2b6', dayFog: '#bfb4a6',
    nightSky: '#5a55a8', nightGround: '#2c2444', nightSun: '#9fb0ff', nightFog: '#171338',
    border: '#3a3229',
  },
  light: { sunDay: 2.9, sunNight: 1.1, hemiDay: 1.15, hemiNight: 1.0, exposure: 1.0 },
  camera: { fov: 30, pitch: 52, yaw: -45, dist: 34, minDist: 10, maxDist: 100 },
  sun: { x: -18, y: 32, z: -42 },
};

function merge(a, b) {
  const out = Object.assign({}, a);
  if (!b) return out;
  Object.keys(b).forEach((k) => {
    out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? Object.assign({}, a[k], b[k]) : b[k];
  });
  return out;
}

// ---------- Gürültü ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createWorld(container, opts) {
  opts = opts || {};
  const CFG = window.CONFIG || {};
  const W = merge(DEF, opts.world || CFG.world);
  const MAP = opts.map || CFG.map || { w: 60, h: 40 };
  const M = W.margin, D = W.detail;

  const rand = mulberry32(W.seed * 7919);
  const PERM = new Uint8Array(512);
  {
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  }
  const hash = (ix, iy) => PERM[(PERM[ix & 255] + (iy & 255)) & 511] / 255;
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < (oct || 4); i++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  }

  // ---------- Eski kraterler (zemin şekli; oyun kuralını etkilemez) ----------
  const CRATERS = [];
  for (let i = 0, tries = 0; i < W.craters && tries < 200; tries++) {
    const c = { x: W.rockEnd + 5 + rand() * (W.forestStart - W.rockEnd - 9), y: 4 + rand() * (MAP.h - 8), r: 1.8 + rand() * 1.6 };
    if (c.x < W.rockEnd + 7 && Math.abs(c.y - W.rampY) < 6) continue; // rampanın ağzını boş bırak
    if (CRATERS.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + 3)) continue;
    c.depth = 0.35 + rand() * 0.3; c.rimH = 0.14 + rand() * 0.12;
    CRATERS.push(c); i++;
  }

  const terrainType = (tx) => (tx < W.rockEnd ? 'rock' : tx < W.forestStart ? 'plain' : 'forest');
  function outside(x, y) {
    const dx = Math.max(0, -x, x - MAP.w), dy = Math.max(0, -y, y - MAP.h);
    return Math.hypot(dx, dy);
  }
  function fields(x, y) {
    const ramp = smooth(W.rampHalf + 1.5, W.rampHalf, Math.abs(y - W.rampY));
    const edge = W.rockEnd + (fbm(y * 0.25, 7.7, 3) - 0.5) * 0.8;
    const a = lerp(edge - 0.35, W.rockEnd - 2.2, ramp), b = lerp(edge + 0.35, W.rockEnd + 2.6, ramp);
    const rockK = 1 - smooth(a, b, x);
    const fEdge = W.forestStart + (fbm(y * 0.18, 3.3, 3) - 0.5) * 3;
    const forestK = smooth(fEdge - 2.5, fEdge + 1.5, x);
    let crater = 0, rim = 0;
    for (const c of CRATERS) {
      const d = Math.hypot(x - c.x, y - c.y) / c.r;
      if (d > 1.8) continue;
      crater = Math.max(crater, Math.max(0, 1 - d * d) * c.depth);
      rim = Math.max(rim, Math.exp(-Math.pow((d - 1) * 4, 2)) * c.rimH);
    }
    return { rockK, forestK, crater, rim, out: outside(x, y) };
  }
  function rawHeight(x, y) {
    const f = fields(x, y);
    const n = fbm(x * 0.06, y * 0.06);
    const plateau = W.plateauH + (n - 0.5) * 0.3 + (fbm(x * 0.5, y * 0.5, 3) - 0.5) * 0.3;
    const low = lerp((n - 0.5) * W.plainRelief, W.basinH + (n - 0.5) * W.plainRelief * 0.7, f.forestK);
    let h = lerp(low, plateau, f.rockK);
    h += (fbm(x * 0.35 + 50, y * 0.35 + 50, 3) - 0.5) * 0.06;
    h += -f.crater + f.rim;
    if (f.out > 2) h += (f.out - 2) * 0.22 + smooth(2, 9, f.out) * fbm(x * 0.15 + 20, y * 0.15 + 20) * 2.5;
    return h;
  }

  // Yükseklik ızgarası: zemin ağı ve heightAt aynı veriden okur
  const GX = (MAP.w + 2 * M) * D + 1, GY = (MAP.h + 2 * M) * D + 1;
  const HGRID = new Float32Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) HGRID[j * GX + i] = rawHeight(i / D - M, j / D - M);
  function heightAt(x, y) {
    const gx = clamp((x + M) * D, 0, GX - 1.001), gy = clamp((y + M) * D, 0, GY - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const a = HGRID[j * GX + i], b = HGRID[j * GX + i + 1], c = HGRID[(j + 1) * GX + i], d = HGRID[(j + 1) * GX + i + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  // ---------- Sahne ----------
  const col = (hex) => new THREE.Color(hex);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = W.light.exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = col(W.colors.dayFog);
  scene.fog = new THREE.Fog(col(W.colors.dayFog), 60, 160);
  const camera = new THREE.PerspectiveCamera(W.camera.fov, container.clientWidth / container.clientHeight, 0.3, 600);
  const hemi = new THREE.HemisphereLight(W.colors.daySky, W.colors.dayGround, W.light.hemiDay);
  const sun = new THREE.DirectionalLight(W.colors.daySun, W.light.sunDay);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);

  // Zemin ağı
  {
    const C = W.colors;
    const geo = new THREE.PlaneGeometry(MAP.w + 2 * M, MAP.h + 2 * M, GX - 1, GY - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + MAP.w / 2, y = pos.getZ(k) + MAP.h / 2;
      pos.setY(k, HGRID[Math.round((y + M) * D) * GX + Math.round((x + M) * D)]);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), t = new THREE.Color(), P = {};
    Object.keys(C).forEach((k) => (P[k] = col(C[k])));
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + MAP.w / 2, y = pos.getZ(k) + MAP.h / 2, f = fields(x, y);
      const v = fbm(x * 0.6 + 11, y * 0.6 + 3, 3), big = fbm(x * 0.12 + 40, y * 0.12, 3);
      c.copy(P.regolit).lerp(v > 0.5 ? P.regolitLight : P.regolitDark, Math.abs(v - 0.5) * 1.6);
      c.lerp(P.regolitDark, smooth(0.55, 0.75, big) * 0.35);
      t.copy(P.rock).lerp(P.rockLight, smooth(0.45, 0.75, v) * 0.6); c.lerp(t, f.rockK);
      t.copy(P.forestSoil).lerp(P.forestSoilLight, smooth(0.45, 0.8, v) * 0.7); c.lerp(t, f.forestK * 0.9);
      if (f.crater > 0) c.lerp(P.craterFloor, clamp(f.crater * 1.8, 0, 0.8));
      if (f.rim > 0) c.lerp(P.craterRim, clamp(f.rim * 3, 0, 0.6));
      // dik yamaç: katman çizgili kaya
      const steep = 1 - nrm.getY(k), h0 = pos.getY(k);
      t.copy(P.cliff).multiplyScalar(0.85 + 0.3 * vnoise(x * 0.7, h0 * 6));
      c.lerp(t, smooth(0.12, 0.45, steep) * 0.9);
      // çukurlar koyulaşır (sahte ortam gölgesi)
      const around = (heightAt(x - 1.5, y) + heightAt(x + 1.5, y) + heightAt(x, y - 1.5) + heightAt(x, y + 1.5)) / 4;
      c.multiplyScalar(1 - clamp((around - h0) * 0.5, 0, 0.3));
      if (f.out > 0) { c.lerp(P.rim, smooth(0, 3, f.out) * 0.7); c.multiplyScalar(1 - smooth(6, 18, f.out) * 0.12); }
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // İnce taneli regolit dokusu (renk çarpanı, döşenebilir)
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g2 = cv.getContext('2d'), img = g2.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = x / S, fy = y / S;
      const n = vnoise(x * 0.11, y * 0.11) * (1 - fx) * (1 - fy) + vnoise((x - S) * 0.11, y * 0.11) * fx * (1 - fy) +
        vnoise(x * 0.11, (y - S) * 0.11) * (1 - fx) * fy + vnoise((x - S) * 0.11, (y - S) * 0.11) * fx * fy;
      const speck = rand() < 0.03 ? -16 : rand() < 0.04 ? 8 : 0;
      const val = clamp(232 + (n - 0.5) * 22 + speck + (rand() - 0.5) * 8, 0, 255);
      const o = (y * S + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = val; img.data[o + 3] = 255;
    }
    g2.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((MAP.w + 2 * M) / 5, (MAP.h + 2 * M) / 5);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.96, metalness: 0 }));
    terrain.receiveShadow = true; terrain.castShadow = false; // kenar tepeleri haritaya gölge düşürmesin; gölgeyi nesneler düşürür
    scene.add(terrain);

    // Oynanabilir alanın sınırı (zemini izleyen ince çizgi)
    const bp = [];
    const path = (x0, y0, x1, y1) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * D);
      for (let s = 0; s < n; s++) {
        const a = s / n, b = (s + 1) / n, ax = lerp(x0, x1, a), ay = lerp(y0, y1, a), bx = lerp(x0, x1, b), by = lerp(y0, y1, b);
        bp.push(ax - MAP.w / 2, heightAt(ax, ay) + 0.05, ay - MAP.h / 2, bx - MAP.w / 2, heightAt(bx, by) + 0.05, by - MAP.h / 2);
      }
    };
    path(0, 0, MAP.w, 0); path(MAP.w, 0, MAP.w, MAP.h); path(MAP.w, MAP.h, 0, MAP.h); path(0, MAP.h, 0, 0);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    scene.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: C.border, transparent: true, opacity: 0.55 })));
  }

  // ---------- Kamera ----------
  const K = W.camera;
  const cam = {
    target: new THREE.Vector3(0, 0, 0),
    yaw: (K.yaw * Math.PI) / 180, yawGoal: (K.yaw * Math.PI) / 180,
    pitch: (K.pitch * Math.PI) / 180, dist: K.dist, distGoal: K.dist,
  };
  const keys = {}, mouse = { x: -1, y: -1, inside: false, drag: null };
  const world = { scene, camera, renderer, heightAt, terrainType, edgeScroll: true, night: 0, map: MAP };

  world.toWorld = (x, y, lift) => new THREE.Vector3(x - MAP.w / 2, heightAt(x, y) + (lift || 0), y - MAP.h / 2);
  world.focus = (x, y) => { cam.target.set(x - MAP.w / 2, heightAt(x, y), y - MAP.h / 2); };
  world.rotate = (dir) => { cam.yawGoal += (dir || 1) * Math.PI / 2; };
  world.zoomBy = (f) => { cam.distGoal = clamp(cam.distGoal * f, K.minDist, K.maxDist); };
  const tmp = new THREE.Vector3();
  world.toScreen = (x, y, lift) => {
    tmp.set(x - MAP.w / 2, heightAt(x, y) + (lift || 0), y - MAP.h / 2).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((tmp.x + 1) * r.width) / 2, y: r.top + ((1 - tmp.y) * r.height) / 2, visible: tmp.z > -1 && tmp.z < 1 };
  };

  // Ekran pikselinden kare: ışını yükseklik ızgarasında yürüt (büyük ağda üçgen taraması yapmadan)
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function castRay(cx, cy, clampToMap) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const below = (t) => o.y + d.y * t - heightAt(o.x + d.x * t + MAP.w / 2, o.z + d.z * t + MAP.h / 2);
    let t0 = 0, t = 0;
    for (let s = 0; s < 900; s++) {
      const gap = below(t);
      if (gap <= 0) {
        for (let b = 0; b < 12; b++) { const m = (t0 + t) / 2; if (below(m) > 0) t0 = m; else t = m; }
        const wx = o.x + d.x * t + MAP.w / 2, wy = o.z + d.z * t + MAP.h / 2;
        if (clampToMap && (wx < 0 || wy < 0 || wx >= MAP.w || wy >= MAP.h)) return null;
        return { wx, wy, tx: Math.floor(wx), ty: Math.floor(wy) };
      }
      t0 = t; t += Math.max(0.15, gap * 0.5);
      if (t > 700) break;
    }
    if (clampToMap || d.y >= 0) return null;
    const tp = -o.y / d.y; // ufka bakan köşeler için y = 0 düzlemi
    return { wx: o.x + d.x * tp + MAP.w / 2, wy: o.z + d.z * tp + MAP.h / 2 };
  }
  world.pick = (cx, cy) => castRay(cx, cy, true);
  world.groundAt = (cx, cy) => castRay(cx, cy, false);
  world.raycaster = raycaster;
  world.rayFrom = (cx, cy) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
  };

  // ---------- Gün-gece ----------
  world.setNight = (k) => {
    k = clamp(k || 0, 0, 1);
    if (Math.abs(k - world.night) < 0.002 && world.lightReady) return;
    world.night = k; world.lightReady = true;
    const C = W.colors, L = W.light;
    sun.color.copy(col(C.daySun)).lerp(col(C.nightSun), k);
    sun.intensity = lerp(L.sunDay, L.sunNight, k);
    hemi.color.copy(col(C.daySky)).lerp(col(C.nightSky), k);
    hemi.groundColor.copy(col(C.dayGround)).lerp(col(C.nightGround), k);
    hemi.intensity = lerp(L.hemiDay, L.hemiNight, k);
    const fogC = col(C.dayFog).lerp(col(C.nightFog), k);
    scene.fog.color.copy(fogC); scene.background.copy(fogC);
  };
  world.setNight(0);

  // ---------- Girdi (yalnız kamera; oyun girdisi oyun3d.js'de) ----------
  const el = renderer.domElement;
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === 'q' && !e.ctrlKey && !e.metaKey) world.rotate(e.shiftKey ? 1 : -1);
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => (keys[k] = false)); mouse.inside = false; mouse.drag = null; });
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (mouse.drag) {
      const dx = e.clientX - mouse.drag.x, dy = e.clientY - mouse.drag.y;
      mouse.drag.x = e.clientX; mouse.drag.y = e.clientY;
      const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const s = cam.dist * 0.0016;
      cam.target.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s * 1.4);
    }
  });
  document.addEventListener('mouseleave', () => { mouse.inside = false; });
  document.addEventListener('mouseenter', () => { mouse.inside = true; });
  el.addEventListener('mousemove', () => { mouse.inside = true; });
  el.addEventListener('mousedown', (e) => { if (e.button === 1) { mouse.drag = { x: e.clientX, y: e.clientY }; e.preventDefault(); } });
  window.addEventListener('mouseup', (e) => { if (e.button === 1) mouse.drag = null; });
  el.addEventListener('wheel', (e) => { world.zoomBy(1 + Math.sign(e.deltaY) * 0.12); e.preventDefault(); }, { passive: false });

  world.update = (dt) => {
    cam.yaw += (cam.yawGoal - cam.yaw) * Math.min(1, dt * 8);
    cam.dist += (cam.distGoal - cam.dist) * Math.min(1, dt * 10);
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const sp = cam.dist * 0.9 * dt, ctrl = keys.control || keys.meta;
    let mx = 0, mz = 0;
    if (!ctrl) {
      if (keys.w || keys.arrowup) mz += 1;
      if (keys.s || keys.arrowdown) mz -= 1;
      if (keys.a || keys.arrowleft) mx -= 1;
      if (keys.d || keys.arrowright) mx += 1;
    }
    if (world.edgeScroll && mouse.inside && !mouse.drag && document.hasFocus()) {
      const e = 10, wv = window.innerWidth, hv = window.innerHeight;
      if (mouse.x < e) mx -= 1; else if (mouse.x > wv - e) mx += 1;
      if (mouse.y < e) mz += 1; else if (mouse.y > hv - e) mz -= 1;
    }
    cam.target.addScaledVector(fwd, mz * sp).addScaledVector(right, mx * sp);
    cam.target.x = clamp(cam.target.x, -MAP.w / 2, MAP.w / 2);
    cam.target.z = clamp(cam.target.z, -MAP.h / 2, MAP.h / 2);
    const gy = heightAt(cam.target.x + MAP.w / 2, cam.target.z + MAP.h / 2);
    cam.target.y += (gy - cam.target.y) * Math.min(1, dt * 4);
    const cp = Math.cos(cam.pitch) * cam.dist;
    camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp);
    camera.lookAt(cam.target);
    scene.fog.near = cam.dist * 1.6; scene.fog.far = cam.dist * 4.2 + 40;
    // Gölge kamerası görünen alanı izler: yakında keskin gölge
    const ext = cam.dist * 0.75 + 8, sc = sun.shadow.camera;
    sun.target.position.copy(cam.target);
    sun.position.set(cam.target.x + W.sun.x, cam.target.y + W.sun.y, cam.target.z + W.sun.z);
    if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 160; sc.updateProjectionMatrix(); }
  };
  world.render = () => renderer.render(scene, camera);

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  world.update(0);
  return world;
}
