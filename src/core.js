// ============================================================
// src/core.js  —  SAHİBİ: Kişi 1
// Oyun durumu (G), modül kaydı, oyun döngüsü, kamera, girdi ve
// herkesin kullandığı yardımcı fonksiyonlar. Sözleşme: docs/CONTRACT.md
// Diğer kişiler bu dosyayı DEĞİŞTİRMEZ; bir yardımcıya ihtiyaç varsa Kişi 1'e söyler.
// Girdi (AoE tarzı): sol tık / sürükle = seç, sağ tık = emir (modüllerin onClick'i button 2 ile),
// modül onMouseDown(G, info) true dönerse fareyi yakalar (onMouseDrag / onMouseUp alır; ör. mini harita).
// ============================================================
(function () {
  const Game = (window.Game = { modules: [], G: null });
  let nextId = 1;

  // ---------- Modül kaydı ----------
  // Her modül: { name, init(G), update(G, dt), draw(ctx, G), drawUI(ctx, G), onClick(G, info), onKey(G, key) }
  // Hepsi isteğe bağlıdır. onClick true dönerse tıklama başka modüle geçmez.
  Game.register = function (mod) { Game.modules.push(mod); };
  Game.newId = function () { return nextId++; };

  // ---------- Durum ----------
  Game.newState = function () {
    const c = window.CONFIG, m = c.map;
    const G = {
      cfg: c, time: 0, speed: 1, paused: false, over: null,
      res: { oz: c.start.oz, tas: c.start.tas, kitin: c.start.kitin },
      map: { w: m.w, h: m.h, tile: m.tile, terrain: [], vine: new Uint8Array(m.w * m.h) },
      buildings: [], units: [], enemies: [], colonies: [],
      meteors: [], crystals: [],
      research: { done: {}, queue: [], current: null, progress: 0 },
      messages: [],
      // selection: seçili oyuncu birimleri; tool: 'prune' gibi geçici araç; drag: kutu seçimi; hudTop/hudBottom: arayüzün kapladığı yükseklik
      ui: { buildMode: null, selected: null, selection: [], tool: null, drag: null, hudTop: 0, hudBottom: 0, mouse: { sx: 0, sy: 0, wx: 0, wy: 0, tx: 0, ty: 0 } },
      cam: { x: 0, y: 0 },
      flags: {}, // modüllerin paylaştığı küçük bayraklar (ör. flags.nextWaveIn)
    };
    // Zemin: sol kayalık, orta düzlük, sağ orman
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      G.map.terrain.push(x < 12 ? 'rock' : x < 42 ? 'plain' : 'forest');
    }
    return G;
  };

  // ---------- Yardımcılar ----------
  Game.idx = (G, tx, ty) => ty * G.map.w + tx;
  Game.inMap = (G, tx, ty) => tx >= 0 && ty >= 0 && tx < G.map.w && ty < G.map.h;
  Game.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  Game.center = (b) => ({ x: b.x + b.size / 2, y: b.y + b.size / 2 });
  Game.merkez = (G) => G.buildings.find((b) => b.type === 'merkez' && b.hp > 0);

  Game.canAfford = function (G, cost) {
    if (!cost) return true;
    return Object.keys(cost).every((k) => (G.res[k] || 0) >= cost[k]);
  };
  Game.pay = function (G, cost) {
    if (!Game.canAfford(G, cost)) return false;
    if (cost) Object.keys(cost).forEach((k) => (G.res[k] -= cost[k]));
    return true;
  };
  Game.gain = function (G, res) { Object.keys(res).forEach((k) => (G.res[k] = (G.res[k] || 0) + res[k])); };
  Game.costText = function (cost) {
    if (!cost) return '';
    const n = { oz: 'Öz', tas: 'Taş', kitin: 'Kitin' };
    return Object.keys(cost).map((k) => cost[k] + ' ' + (n[k] || k)).join(' + ');
  };

  // Karenin bina tarafından dolu olup olmadığı
  Game.buildingAt = function (G, tx, ty) {
    return G.buildings.find((b) => b.hp > 0 && tx >= b.x && ty >= b.y && tx < b.x + b.size && ty < b.y + b.size);
  };
  Game.isFree = function (G, tx, ty, size) {
    for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) {
      if (!Game.inMap(G, x, y) || Game.buildingAt(G, x, y)) return false;
    }
    return true;
  };

  Game.addBuilding = function (G, type, tx, ty) {
    const d = G.cfg.buildings[type];
    const b = { id: Game.newId(), type, x: tx, y: ty, size: d.size, hp: d.hp, maxHp: d.hp, data: {} };
    G.buildings.push(b);
    return b;
  };
  // u: { kind, x, y, hp, ... }  kind örnekleri: 'yumurta','yavru','isci','asker','bilimci'
  Game.addUnit = function (G, u) {
    u.id = Game.newId();
    if (u.maxHp == null) u.maxHp = u.hp;
    G.units.push(u);
    return u;
  };

  // list içinden (x,y)'ye en yakın, filter'ı geçen öğe. Binalar için merkez noktası kullanılır.
  Game.nearest = function (list, x, y, filter) {
    let best = null, bd = Infinity;
    for (const e of list) {
      if (filter && !filter(e)) continue;
      const p = e.size ? Game.center(e) : e;
      const d = Game.dist(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  // Bir noktaya doğru yürü; vardıysa true döner
  Game.moveTo = function (e, tx, ty, speed, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) { e.x = tx; e.y = ty; return true; }
    e.x += (dx / d) * step; e.y += (dy / d) * step;
    return false;
  };

  // Alan hasarı: binalar, oyuncu birimleri, düşmanlar ve koloni bireyleri
  Game.damageArea = function (G, x, y, r, dmg, opts) {
    opts = opts || {};
    G.buildings.forEach((b) => {
      if (opts.skip && opts.skip(b)) return;
      const c = Game.center(b);
      if (Game.dist(c.x, c.y, x, y) <= r + b.size / 2) b.hp -= dmg;
    });
    G.units.forEach((u) => { if (Game.dist(u.x, u.y, x, y) <= r) u.hp -= dmg; });
    G.enemies.forEach((e) => { if (Game.dist(e.x, e.y, x, y) <= r) e.hp -= dmg; });
    G.colonies.forEach((col) => col.members.forEach((m) => { if (Game.dist(m.x, m.y, x, y) <= r) m.hp -= dmg; }));
  };

  Game.msg = function (G, text, color) {
    G.messages.push({ text, color: color || '#fff', t: G.time });
    if (G.messages.length > 6) G.messages.shift();
  };

  // ---------- Oyun döngüsü ----------
  let canvas, ctx, last = 0, mouseIn = false, capture = null;
  const keys = {};

  Game.start = function () {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();

    const G = (Game.G = Game.newState());
    Game.modules.forEach((m) => m.init && m.init(G));
    // Kamerayı Merkez'e odakla
    const mk0 = Game.merkez(G);
    if (mk0) Game.centerOn(G, mk0.x + mk0.size / 2, mk0.y + mk0.size / 2);
    Game.msg(G, 'Mor Sarmaşık başladı. İlk meteor dalgası 60 saniye sonra.', '#f2c14e');

    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      keys[e.key.toLowerCase()] = true;
      const G = Game.G;
      if (e.key === ' ') { G.paused = !G.paused; e.preventDefault(); }
      else if (e.key === '1') G.speed = 1;
      else if (e.key === '2') G.speed = 2;
      else if (e.key === '3') G.speed = 3;
      else if (e.key === 'Escape') { G.ui.buildMode = null; G.ui.tool = null; G.ui.selected = null; G.ui.selection = []; }
      Game.modules.forEach((m) => { try { m.onKey && m.onKey(G, e.key, e); } catch (err) { reportError(m, err); } });
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => (keys[k] = false)); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mouseenter', () => (mouseIn = true));
    canvas.addEventListener('mouseleave', () => (mouseIn = false));

    // Fare: sol tık seçer (sürükleyince kutu seçimi), sağ tık emir verir. Arayüz (onMouseDown) önce sorulur.
    canvas.addEventListener('mousedown', (e) => {
      const G = Game.G; updateMouse(e); mouseIn = true;
      const mm = G.ui.mouse;
      const info = { sx: mm.sx, sy: mm.sy, wx: mm.wx, wy: mm.wy, tx: mm.tx, ty: mm.ty, button: e.button, shift: e.shiftKey };
      for (let i = Game.modules.length - 1; i >= 0; i--) {
        const m = Game.modules[i];
        if (m.onMouseDown && m.onMouseDown(G, info)) { capture = m; return; }
      }
      if (e.button === 0) { G.ui.drag = { x0: mm.sx, y0: mm.sy, x1: mm.sx, y1: mm.sy, active: false, shift: e.shiftKey }; return; }
      dispatchClick(G, info);
    });
    window.addEventListener('mousemove', (e) => {
      const G = Game.G; updateMouse(e);
      const mm = G.ui.mouse;
      if (capture && capture.onMouseDrag) { capture.onMouseDrag(G, { sx: mm.sx, sy: mm.sy }); return; }
      const d = G.ui.drag;
      if (d) { d.x1 = mm.sx; d.y1 = mm.sy; if (Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) > 8) d.active = true; }
    });
    window.addEventListener('mouseup', (e) => {
      const G = Game.G; updateMouse(e);
      if (capture) { if (capture.onMouseUp) capture.onMouseUp(G); capture = null; return; }
      const d = G.ui.drag;
      if (!d) return;
      G.ui.drag = null;
      const mm = G.ui.mouse;
      if (d.active) boxSelect(G, d);
      else dispatchClick(G, { sx: mm.sx, sy: mm.sy, wx: mm.wx, wy: mm.wy, tx: mm.tx, ty: mm.ty, button: 0, shift: d.shift });
    });
    requestAnimationFrame(loop);
  };

  // Tıklamayı modüllere sırayla sor (önce arayüz, en son dünya). Kimse kullanmazsa seçimi bırak.
  function dispatchClick(G, info) {
    let used = false;
    for (let i = Game.modules.length - 1; i >= 0 && !used; i--) {
      const m = Game.modules[i];
      try { if (m.onClick && m.onClick(G, info)) used = true; } catch (err) { reportError(m, err); }
    }
    if (!used && info.button === 0) { G.ui.selected = null; G.ui.selection = []; }
    syncSelection(G);
  }

  // G.ui.selection: seçili oyuncu birimleri (çoklu). G.ui.selected: seçimin ilki ya da tek seçilen bina / koloni bireyi.
  function syncSelection(G) {
    const s = G.ui.selected;
    if (!s || !s.kind || s.owner !== 'player') { if (!s || !s.kind) G.ui.selection = []; return; }
    if (!G.ui.selection.includes(s)) G.ui.selection = [s];
  }

  function boxSelect(G, d) {
    const T = G.map.tile;
    const x0 = (Math.min(d.x0, d.x1) + G.cam.x) / T, x1 = (Math.max(d.x0, d.x1) + G.cam.x) / T;
    const y0 = (Math.min(d.y0, d.y1) + G.cam.y) / T, y1 = (Math.max(d.y0, d.y1) + G.cam.y) / T;
    let list = G.units.filter((u) => u.owner === 'player' && u.hp > 0 && u.kind !== 'yumurta' && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
    // Savaşçı varsa yavruları seçime katma (AoE'deki gibi askerler öncelikli)
    if (list.some((u) => u.kind !== 'yavru')) list = list.filter((u) => u.kind !== 'yavru');
    G.ui.selection = d.shift ? Array.from(new Set(G.ui.selection.concat(list))) : list;
    G.ui.selected = G.ui.selection[0] || null;
  }

  // Ekranı bir dünya noktasına (kare) ortala
  Game.centerOn = function (G, x, y) {
    const T = G.map.tile;
    G.cam.x = x * T - canvas.width / 2;
    G.cam.y = y * T - (canvas.height - (G.ui.hudBottom || 0) + (G.ui.hudTop || 0)) / 2;
    clampCam(G);
  };
  Game.viewSize = () => ({ w: canvas ? canvas.width : 0, h: canvas ? canvas.height : 0 });
  Game.keyDown = (k) => !!keys[k];

  function clampCam(G) {
    const T = G.map.tile, top = G.ui.hudTop || 0, bottom = G.ui.hudBottom || 0;
    G.cam.x = Math.max(0, Math.min(G.map.w * T - canvas.width, G.cam.x));
    G.cam.y = Math.max(-top - 20, Math.min(G.map.h * T - canvas.height + bottom + 20, G.cam.y));
  }

  function updateMouse(e) {
    const G = Game.G, r = canvas.getBoundingClientRect(), T = G.map.tile;
    const mm = G.ui.mouse;
    mm.sx = e.clientX - r.left; mm.sy = e.clientY - r.top;
    mm.wx = (mm.sx + G.cam.x) / T; mm.wy = (mm.sy + G.cam.y) / T; // kare cinsinden dünya koordinatı
    mm.tx = Math.floor(mm.wx); mm.ty = Math.floor(mm.wy);
  }

  function loop(ts) {
    const G = Game.G;
    let dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;

    // Kamera: WASD / oklar ve ekran kenarına götürülen fare
    const T = G.map.tile, pan = 700 * dt, mm = G.ui.mouse, edge = 14;
    const ctrl = keys['control'] || keys['meta'];
    if (!ctrl && (keys['a'] || keys['arrowleft'])) G.cam.x -= pan;
    if (!ctrl && (keys['d'] || keys['arrowright'])) G.cam.x += pan;
    if (!ctrl && (keys['w'] || keys['arrowup'])) G.cam.y -= pan;
    if (!ctrl && (keys['s'] || keys['arrowdown'])) G.cam.y += pan;
    if (mouseIn && !G.ui.drag && !capture && document.hasFocus()) {
      if (mm.sx < edge) G.cam.x -= pan; else if (mm.sx > canvas.width - edge) G.cam.x += pan;
      if (mm.sy < edge) G.cam.y -= pan; else if (mm.sy > canvas.height - edge) G.cam.y += pan;
    }
    clampCam(G);
    mm.wx = (mm.sx + G.cam.x) / T; mm.wy = (mm.sy + G.cam.y) / T; mm.tx = Math.floor(mm.wx); mm.ty = Math.floor(mm.wy);

    if (!G.paused && !G.over) {
      const sdt = dt * G.speed;
      G.time += sdt;
      Game.modules.forEach((m) => {
        try { m.update && m.update(G, sdt); } catch (err) { reportError(m, err); }
      });
      // Ölüleri temizle
      G.buildings = G.buildings.filter((b) => b.hp > 0 || b.type === 'merkez');
      G.units = G.units.filter((u) => u.hp > 0);
      G.enemies = G.enemies.filter((e) => e.hp > 0);
      G.ui.selection = G.ui.selection.filter((u) => u.hp > 0 && G.units.includes(u));
      // Kazanma / kaybetme
      const mk = G.buildings.find((b) => b.type === 'merkez');
      if (!mk || mk.hp <= 0) G.over = 'lose';
      else if (G.res.oz >= G.cfg.win.oz) G.over = 'win';
    }
    draw(G);
    requestAnimationFrame(loop);
  }

  // Zemin bir kez ayrı bir tuvale çizilir (doku, taşlar, yumuşak geçişler), her karede yalnızca kopyalanır
  let ground = null;
  function hash(x, y, k) {
    let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function buildGround(G) {
    const T = G.map.tile, W = G.map.w, H = G.map.h, c = G.cfg.colors;
    const cv = document.createElement('canvas'); cv.width = W * T; cv.height = H * T;
    const g = cv.getContext('2d');
    const ter = (x, y) => G.map.terrain[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
    // 1) taban renkleri, hafif ton oynamasıyla
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = shadeHex(c[ter(x, y)], (hash(x, y, 1) - 0.5) * 0.08);
      g.fillRect(x * T, y * T, T, T);
    }
    // 2) bölge sınırlarını yumuşat: komşu bölgenin rengi düzensiz lekelerle taşar
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ter(x, y);
      [[1, 0], [-1, 0]].forEach(([dx]) => {
        const n = ter(x + dx, y);
        if (n === t) return;
        for (let k = 0; k < 4; k++) {
          g.fillStyle = c[n]; g.globalAlpha = 0.4;
          const r = T * (0.2 + hash(x, y, 10 + k) * 0.3);
          g.beginPath(); g.arc((x + (dx > 0 ? 1 : 0)) * T - dx * hash(x, y, 20 + k) * T * 0.7, (y + hash(x, y, 30 + k)) * T, r, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      });
    }
    // 3) doku: çakıl, çatlak, yosun
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ter(x, y), base = c[t], px = x * T, py = y * T;
      const n = t === 'forest' ? 6 : t === 'rock' ? 5 : 4;
      for (let k = 0; k < n; k++) {
        const sx = px + hash(x, y, 40 + k) * T, sy = py + hash(x, y, 50 + k) * T, r = 1 + hash(x, y, 60 + k) * (t === 'rock' ? 3.5 : 2.2);
        g.fillStyle = shadeHex(base, hash(x, y, 70 + k) < 0.5 ? -0.18 : 0.12);
        g.globalAlpha = 0.7;
        g.beginPath(); g.ellipse(sx, sy, r, r * 0.75, hash(x, y, 80 + k) * 3, 0, Math.PI * 2); g.fill();
      }
      if (t === 'rock' && hash(x, y, 90) < 0.35) { // çatlak
        g.strokeStyle = shadeHex(base, -0.3); g.lineWidth = 1; g.globalAlpha = 0.6;
        g.beginPath(); g.moveTo(px + hash(x, y, 91) * T, py);
        g.lineTo(px + hash(x, y, 92) * T, py + T * 0.5); g.lineTo(px + hash(x, y, 93) * T, py + T); g.stroke();
      }
      if (t === 'plain' && hash(x, y, 94) < 0.025) { // eski krater izi: halka
        g.globalAlpha = 0.22; g.strokeStyle = shadeHex(base, -0.35); g.lineWidth = 3;
        g.beginPath(); g.arc(px + T / 2, py + T / 2, T * (0.4 + hash(x, y, 95) * 0.5), 0, Math.PI * 2); g.stroke();
      }
      if (t === 'forest' && hash(x, y, 96) < 0.25) { // koyu yosun öbekleri
        g.globalAlpha = 0.35; g.fillStyle = shadeHex(base, -0.35);
        g.beginPath(); g.arc(px + hash(x, y, 97) * T, py + hash(x, y, 98) * T, T * 0.5, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    // 4) harita kenarında hafif karartma
    const vg = g.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.45, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vg; g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  function draw(G) {
    const T = G.map.tile;
    ctx.fillStyle = '#0d0b10'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
    // Zemin
    if (!ground) ground = buildGround(G);
    const sx = Math.max(0, Math.round(G.cam.x)), sy = Math.max(0, Math.round(G.cam.y));
    const sw = Math.min(ground.width - sx, canvas.width), sh = Math.min(ground.height - sy, canvas.height);
    if (sw > 0 && sh > 0) ctx.drawImage(ground, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, G.map.w * T, G.map.h * T);
    // Modüllerin dünya çizimleri
    Game.modules.forEach((m) => { try { m.draw && m.draw(ctx, G); } catch (err) { reportError(m, err); } });
    ctx.restore();
    // Ekran (arayüz) çizimleri
    Game.modules.forEach((m) => { try { m.drawUI && m.drawUI(ctx, G); } catch (err) { reportError(m, err); } });
    if (!Game.modules.some((m) => m.name === 'ui')) fallbackHud(G);
  }

  // ui.js henüz yokken bile kaynakları görelim
  function fallbackHud(G) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, 28);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(`Öz ${Math.floor(G.res.oz)}   Taş ${Math.floor(G.res.tas)}   Kitin ${G.res.kitin}   Süre ${Math.floor(G.time)} sn` +
      (G.paused ? '   [DURAKLATILDI]' : '') + (G.over ? `   OYUN BİTTİ: ${G.over}` : ''), 10, 19);
  }

  const reported = {};
  function reportError(m, err) {
    if (reported[m.name]) return; reported[m.name] = true;
    console.error('[' + m.name + ']', err);
    Game.msg(Game.G, 'Hata: ' + m.name + ' modülü (konsola bakın)', '#e74c3c');
  }
})();
