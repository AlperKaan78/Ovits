// ============================================================
// src/world3d.js  —  SAHİBİ: Kişi 1
// 3D dünya: zemin (yükselti, renk, doku), ışık, gün-gece, kamera ve fareyle kare seçme.
// Nesneler (bina, birim, sarmaşık, meteor) sonra bu zeminin üstüne eklenir.
//
// Koordinat: 1 kare = 1 birim. Kare (x, y) -> dünya (X = x - w/2, Y = yükselti, Z = y - h/2).
// Harita kuzeyi -Z, güneyi +Z. Kamera güneybatıdan bakar (şehir önde solda, sarmaşık ormanı arkada sağda);
// güneş kuzeyden vurur, böylece ışık ekranda sol üstten gelir ve gölgeler sağ alta düşer.
//
// Dışarıya açılanlar (window.World3D):
//   World3D.start(container)       sahneyi kurar ve döngüyü başlatır
//   World3D.heightAt(x, y)         kare koordinatında zemin yüksekliği (nesneleri zemine oturtmak için)
//   World3D.toWorld(x, y)          THREE.Vector3, zeminin üstünde
//   World3D.pick(sx, sy)           ekran pikselinden { wx, wy, tx, ty } ya da null (harita dışı)
//   World3D.terrainType(tx, ty)    'rock' | 'plain' | 'forest' (core.js'deki bant kuralıyla aynı)
//   World3D.setNight(k)            0 gündüz .. 1 gece; çağrılmazsa CONFIG.vines.night döngüsü kullanılır
//   World3D.scene, .camera, .renderer
// Tema: Mor Sarmaşık brandbook v0.1. Ayarlar aşağıdaki DEF'te; CONFIG.world varsa onun değerleri geçerlidir.
// ============================================================
(function () {
  const World3D = (window.World3D = {});

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
      signal: '#5fd4e0', grid: '#f4ecdc', border: '#3a3229',
    },
    light: { sunDay: 2.9, sunNight: 1.1, hemiDay: 1.15, hemiNight: 1.0, exposure: 1.0 },
    camera: { fov: 30, pitch: 52, yaw: -45, dist: 72, minDist: 14, maxDist: 100 },
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
  const CFG = window.CONFIG || {};
  const W = merge(DEF, CFG.world);
  const MAP = CFG.map || { w: 60, h: 40 };

  // ---------- Gürültü ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(W.seed * 7919);
  const PERM = new Uint8Array(512);
  (function () {
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Eski kraterler (zemin şekli; oyun kuralını etkilemez) ----------
  const CRATERS = [];
  for (let i = 0, tries = 0; i < W.craters && tries < 200; tries++) {
    const c = { x: W.rockEnd + 5 + rand() * (W.forestStart - W.rockEnd - 9), y: 4 + rand() * (MAP.h - 8), r: 1.8 + rand() * 1.6 };
    if (c.x < W.rockEnd + 7 && Math.abs(c.y - W.rampY) < 6) continue; // rampanın ağzını boş bırak
    if (CRATERS.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + 3)) continue;
    c.depth = 0.35 + rand() * 0.3; c.rimH = 0.14 + rand() * 0.12;
    CRATERS.push(c); i++;
  }

  // ---------- Zemin alanları ----------
  World3D.terrainType = (tx) => (tx < W.rockEnd ? 'rock' : tx < W.forestStart ? 'plain' : 'forest');

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
  const M = W.margin, D = W.detail;
  const GX = (MAP.w + 2 * M) * D + 1, GY = (MAP.h + 2 * M) * D + 1;
  const HGRID = new Float32Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) HGRID[j * GX + i] = rawHeight(i / D - M, j / D - M);

  World3D.heightAt = function (x, y) {
    const gx = clamp((x + M) * D, 0, GX - 1.001), gy = clamp((y + M) * D, 0, GY - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const a = HGRID[j * GX + i], b = HGRID[j * GX + i + 1], c = HGRID[(j + 1) * GX + i], d = HGRID[(j + 1) * GX + i + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  };

  // ---------- Sahne ----------
  let renderer, scene, camera, terrain, hemi, sun, hover, hoverLine, grid, info, container;
  const cam = { target: null, yaw: 0, yawGoal: 0, pitch: 0, dist: 0, distGoal: 0 };
  const keys = {};
  const mouse = { x: -1, y: -1, inside: false, drag: null };
  let nightOverride = null, nightMode = 'auto', clock = 0, last = 0, hoverTile = null;
  const col = (hex) => new THREE.Color(hex);

  function buildTerrain() {
    const C = W.colors;
    const geo = new THREE.PlaneGeometry(MAP.w + 2 * M, MAP.h + 2 * M, GX - 1, GY - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + MAP.w / 2, y = pos.getZ(k) + MAP.h / 2;
      const i = Math.round((x + M) * D), j = Math.round((y + M) * D);
      pos.setY(k, HGRID[j * GX + i]);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), t = new THREE.Color();
    const P = {};
    Object.keys(C).forEach((k) => (P[k] = col(C[k])));
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + MAP.w / 2, y = pos.getZ(k) + MAP.h / 2, f = fields(x, y);
      const v = fbm(x * 0.6 + 11, y * 0.6 + 3, 3), big = fbm(x * 0.12 + 40, y * 0.12, 3);
      // düzlük: regolit, açık-koyu lekelerle
      c.copy(P.regolit).lerp(v > 0.5 ? P.regolitLight : P.regolitDark, Math.abs(v - 0.5) * 1.6);
      c.lerp(P.regolitDark, smooth(0.55, 0.75, big) * 0.35);
      // kayalık plato
      t.copy(P.rock).lerp(P.rockLight, smooth(0.45, 0.75, v) * 0.6); c.lerp(t, f.rockK);
      // sarmaşık havzası: mor toprak
      t.copy(P.forestSoil).lerp(P.forestSoilLight, smooth(0.45, 0.8, v) * 0.7); c.lerp(t, f.forestK * 0.9);
      // kraterler
      if (f.crater > 0) c.lerp(P.craterFloor, clamp(f.crater * 1.8, 0, 0.8));
      if (f.rim > 0) c.lerp(P.craterRim, clamp(f.rim * 3, 0, 0.6));
      // dik yamaç: katman çizgili kaya
      const steep = 1 - nrm.getY(k);
      t.copy(P.cliff).multiplyScalar(0.85 + 0.3 * vnoise(x * 0.7, pos.getY(k) * 6));
      c.lerp(t, smooth(0.12, 0.45, steep) * 0.9);
      // çukurlar koyulaşır (sahte ortam gölgesi)
      const h0 = pos.getY(k);
      const around = (World3D.heightAt(x - 1.5, y) + World3D.heightAt(x + 1.5, y) + World3D.heightAt(x, y - 1.5) + World3D.heightAt(x, y + 1.5)) / 4;
      c.multiplyScalar(1 - clamp((around - h0) * 0.5, 0, 0.3));
      // harita dışı sırtlar
      if (f.out > 0) { c.lerp(P.rim, smooth(0, 3, f.out) * 0.7); c.multiplyScalar(1 - smooth(6, 18, f.out) * 0.12); }
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // İnce taneli regolit dokusu (renk çarpanı)
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g2 = cv.getContext('2d'), img = g2.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // döşenebilsin diye dört köşeden örneklenip karıştırılır
      const fx = x / S, fy = y / S;
      const n = (vnoise(x * 0.11, y * 0.11) * (1 - fx) * (1 - fy) + vnoise((x - S) * 0.11, y * 0.11) * fx * (1 - fy) +
        vnoise(x * 0.11, (y - S) * 0.11) * (1 - fx) * fy + vnoise((x - S) * 0.11, (y - S) * 0.11) * fx * fy);
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

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.96, metalness: 0 });
    terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true; terrain.castShadow = false; // kenar tepeleri haritaya gölge düşürmesin; gölgeyi nesneler düşürür
    scene.add(terrain);
  }

  // Zemini izleyen çizgi: (x0,y0)'dan (x1,y1)'e step aralıkla
  function pushPath(arr, x0, y0, x1, y1, lift) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * D));
    for (let s = 0; s < n; s++) {
      const a = s / n, b = (s + 1) / n;
      const ax = lerp(x0, x1, a), ay = lerp(y0, y1, a), bx = lerp(x0, x1, b), by = lerp(y0, y1, b);
      arr.push(ax - MAP.w / 2, World3D.heightAt(ax, ay) + lift, ay - MAP.h / 2, bx - MAP.w / 2, World3D.heightAt(bx, by) + lift, by - MAP.h / 2);
    }
  }

  function buildOverlays() {
    const C = W.colors;
    // Kare ızgarası (G ile açılır)
    const gp = [];
    for (let y = 0; y <= MAP.h; y++) pushPath(gp, 0, y, MAP.w, y, 0.03);
    for (let x = 0; x <= MAP.w; x++) pushPath(gp, x, 0, x, MAP.h, 0.03);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.16, depthWrite: false }));
    grid.visible = false; scene.add(grid);
    // Oynanabilir alanın sınırı
    const bp = [];
    pushPath(bp, 0, 0, MAP.w, 0, 0.05); pushPath(bp, MAP.w, 0, MAP.w, MAP.h, 0.05);
    pushPath(bp, MAP.w, MAP.h, 0, MAP.h, 0.05); pushPath(bp, 0, MAP.h, 0, 0, 0.05);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    scene.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: C.border, transparent: true, opacity: 0.55 })));
    // Fare altındaki kare
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(25 * 3), 3));
    const idx = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const a = j * 5 + i; idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
    hg.setIndex(idx);
    hover = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: C.signal, transparent: true, opacity: 0.22, depthWrite: false }));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3), 3));
    hoverLine = new THREE.LineLoop(lg, new THREE.LineBasicMaterial({ color: C.signal }));
    hover.visible = hoverLine.visible = false;
    scene.add(hover, hoverLine);
  }

  function placeHover(tx, ty) {
    const p = hover.geometry.attributes.position, l = hoverLine.geometry.attributes.position;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
      const x = tx + i / 4, y = ty + j / 4;
      p.setXYZ(j * 5 + i, x - MAP.w / 2, World3D.heightAt(x, y) + 0.05, y - MAP.h / 2);
    }
    const ring = [];
    for (let i = 0; i < 4; i++) ring.push([i, 0]);
    for (let j = 0; j < 4; j++) ring.push([4, j]);
    for (let i = 4; i > 0; i--) ring.push([i, 4]);
    for (let j = 4; j > 0; j--) ring.push([0, j]);
    ring.forEach(([i, j], k) => { const x = tx + i / 4, y = ty + j / 4; l.setXYZ(k, x - MAP.w / 2, World3D.heightAt(x, y) + 0.07, y - MAP.h / 2); });
    p.needsUpdate = l.needsUpdate = true;
    hover.geometry.computeBoundingSphere(); hoverLine.geometry.computeBoundingSphere();
  }

  World3D.toWorld = (x, y) => new THREE.Vector3(x - MAP.w / 2, World3D.heightAt(x, y), y - MAP.h / 2);

  // Ekran pikselinden kare: ışını yükseklik ızgarasında yürüt (büyük ağda üçgen taraması yapmadan)
  World3D.pick = function (sx, sy) {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
    const o = rc.ray.origin, d = rc.ray.direction;
    const below = (t) => o.y + d.y * t - World3D.heightAt(o.x + d.x * t + MAP.w / 2, o.z + d.z * t + MAP.h / 2);
    let t0 = 0, t = 0;
    for (let s = 0; s < 800; s++) {
      const gap = below(t);
      if (gap <= 0) {
        for (let b = 0; b < 12; b++) { const m = (t0 + t) / 2; if (below(m) > 0) t0 = m; else t = m; }
        const wx = o.x + d.x * t + MAP.w / 2, wy = o.z + d.z * t + MAP.h / 2;
        if (wx < 0 || wy < 0 || wx >= MAP.w || wy >= MAP.h) return null;
        return { wx, wy, tx: Math.floor(wx), ty: Math.floor(wy) };
      }
      t0 = t; t += Math.max(0.15, gap * 0.5);
      if (t > 600) break;
    }
    return null;
  };

  // ---------- Gün-gece ----------
  function autoNight(time) {
    const n = (CFG.vines && CFG.vines.night) || { cycle: 240, part: 0.35, ramp: 15 };
    const tt = time % n.cycle, start = n.cycle * (1 - n.part);
    return Math.min(smooth(start - n.ramp, start, tt), 1 - smooth(n.cycle - n.ramp, n.cycle, tt));
  }
  World3D.setNight = (k) => { nightOverride = k == null ? null : clamp(k, 0, 1); };
  World3D.night = 0;

  function applyLight(k) {
    const C = W.colors, L = W.light;
    World3D.night = k;
    sun.color.copy(col(C.daySun)).lerp(col(C.nightSun), k);
    sun.intensity = lerp(L.sunDay, L.sunNight, k);
    hemi.color.copy(col(C.daySky)).lerp(col(C.nightSky), k);
    hemi.groundColor.copy(col(C.dayGround)).lerp(col(C.nightGround), k);
    hemi.intensity = lerp(L.hemiDay, L.hemiNight, k);
    const fogC = col(C.dayFog).lerp(col(C.nightFog), k);
    scene.fog.color.copy(fogC); scene.background.copy(fogC);
  }

  // ---------- Kamera ----------
  function resetCamera() {
    const K = W.camera;
    cam.target = new THREE.Vector3(0, 0, 0);
    cam.yaw = cam.yawGoal = (K.yaw * Math.PI) / 180;
    cam.pitch = (K.pitch * Math.PI) / 180;
    cam.dist = cam.distGoal = K.dist;
  }
  function updateCamera(dt) {
    cam.yaw += (cam.yawGoal - cam.yaw) * Math.min(1, dt * 8);
    cam.dist += (cam.distGoal - cam.dist) * Math.min(1, dt * 10);
    // kaydırma: kameranın baktığı yöne göre
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const sp = cam.dist * 0.9 * dt;
    let mx = 0, mz = 0;
    if (keys.w || keys.arrowup) mz += 1;
    if (keys.s || keys.arrowdown) mz -= 1;
    if (keys.a || keys.arrowleft) mx -= 1;
    if (keys.d || keys.arrowright) mx += 1;
    if (mouse.inside && !mouse.drag) {
      const e = 10, wv = window.innerWidth, hv = window.innerHeight;
      if (mouse.x < e) mx -= 1; else if (mouse.x > wv - e) mx += 1;
      if (mouse.y < e) mz += 1; else if (mouse.y > hv - e) mz -= 1;
    }
    cam.target.addScaledVector(fwd, mz * sp).addScaledVector(right, mx * sp);
    cam.target.x = clamp(cam.target.x, -MAP.w / 2, MAP.w / 2);
    cam.target.z = clamp(cam.target.z, -MAP.h / 2, MAP.h / 2);
    const gy = World3D.heightAt(cam.target.x + MAP.w / 2, cam.target.z + MAP.h / 2);
    cam.target.y += (gy - cam.target.y) * Math.min(1, dt * 4);
    const cp = Math.cos(cam.pitch) * cam.dist;
    camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp);
    camera.lookAt(cam.target);
    scene.fog.near = cam.dist * 1.05; scene.fog.far = cam.dist * 2.7;
  }

  // ---------- Girdi ----------
  function bindInput() {
    const el = renderer.domElement, K = W.camera;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase(); keys[k] = true;
      if (k === 'q') cam.yawGoal -= Math.PI / 2;
      if (k === 'e') cam.yawGoal += Math.PI / 2;
      if (k === 'g') grid.visible = !grid.visible;
      if (k === 'r') resetCamera();
      if (k === 'n') nightMode = nightMode === 'auto' ? 'day' : nightMode === 'day' ? 'night' : 'auto';
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => (keys[k] = false)); mouse.inside = false; });
    el.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
      if (mouse.drag) {
        const dx = e.clientX - mouse.drag.x, dy = e.clientY - mouse.drag.y;
        mouse.drag.x = e.clientX; mouse.drag.y = e.clientY;
        const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const s = cam.dist * 0.0016;
        cam.target.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s * 1.4);
      }
    });
    el.addEventListener('mouseleave', () => { mouse.inside = false; });
    el.addEventListener('mousedown', (e) => { if (e.button === 1) { mouse.drag = { x: e.clientX, y: e.clientY }; e.preventDefault(); } });
    window.addEventListener('mouseup', (e) => { if (e.button === 1) mouse.drag = null; });
    el.addEventListener('wheel', (e) => {
      cam.distGoal = clamp(cam.distGoal * (1 + Math.sign(e.deltaY) * 0.12), K.minDist, K.maxDist);
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const TYPE_NAME = { rock: 'Kayalık plato', plain: 'Regolit düzlüğü', forest: 'Sarmaşık havzası' };
  function updateInfo() {
    if (!info) return;
    const p = mouse.inside ? World3D.pick(mouse.x, mouse.y) : null;
    const key = p ? p.tx + ',' + p.ty : null;
    if (key !== hoverTile) {
      hoverTile = key;
      hover.visible = hoverLine.visible = !!p;
      if (p) placeHover(p.tx, p.ty);
    }
    const k = World3D.night;
    const tod = nightMode === 'auto' ? (k > 0.5 ? 'Gece' : 'Gündüz') + ' · döngü' : nightMode === 'day' ? 'Gündüz · sabit' : 'Gece · sabit';
    info.innerHTML = (p
      ? `<b>Kare ${p.tx}, ${p.ty}</b> · ${TYPE_NAME[World3D.terrainType(p.tx, p.ty)]} · yükselti ${World3D.heightAt(p.wx, p.wy).toFixed(2)}`
      : '<b>Harita dışı</b>') + `<br>${tod}`;
  }

  function loop(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts; clock += dt;
    const k = nightOverride != null ? nightOverride : nightMode === 'day' ? 0 : nightMode === 'night' ? 1 : autoNight(clock);
    applyLight(k);
    updateCamera(dt);
    updateInfo();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  World3D.start = function (el, infoEl) {
    container = el; info = infoEl || null;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = W.light.exposure;
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = col(W.colors.dayFog);
    scene.fog = new THREE.Fog(col(W.colors.dayFog), 60, 160);
    camera = new THREE.PerspectiveCamera(W.camera.fov, el.clientWidth / el.clientHeight, 0.5, 600);

    hemi = new THREE.HemisphereLight(W.colors.daySky, W.colors.dayGround, W.light.hemiDay);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(W.colors.daySun, W.light.sunDay);
    sun.position.set(W.sun.x, W.sun.y, W.sun.z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -62; sc.right = 62; sc.top = 52; sc.bottom = -52; sc.near = 1; sc.far = 200;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    World3D.scene = scene; World3D.camera = camera; World3D.renderer = renderer;
    buildTerrain();
    buildOverlays();
    resetCamera();
    bindInput();
    // Bağlantıyla paylaşmak için: world3d.html#gece ya da #gunduz
    if (location.hash === '#gece') nightMode = 'night';
    else if (location.hash === '#gunduz') nightMode = 'day';
    window.addEventListener('resize', () => {
      camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    requestAnimationFrame(loop);
  };
})();
