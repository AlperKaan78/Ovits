// ============================================================
// src/core.js  —  SAHİBİ: Kişi 1
// Oyun durumu (G), modül kaydı, oyun döngüsü, kamera, girdi ve
// herkesin kullandığı yardımcı fonksiyonlar. Sözleşme: docs/CONTRACT.md
// Diğer kişiler bu dosyayı DEĞİŞTİRMEZ; bir yardımcıya ihtiyaç varsa Kişi 1'e söyler.
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
      ui: { buildMode: null, selected: null, mouse: { sx: 0, sy: 0, wx: 0, wy: 0, tx: 0, ty: 0 } },
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
  let canvas, ctx, last = 0;
  const keys = {};

  Game.start = function () {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();

    const G = (Game.G = Game.newState());
    G.cam.x = 0; G.cam.y = Math.max(0, (G.map.h * G.map.tile - canvas.height) / 2);
    Game.modules.forEach((m) => m.init && m.init(G));
    Game.msg(G, 'Mor Sarmaşık başladı. İlk meteor dalgası 60 saniye sonra.', '#f2c14e');

    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      const G = Game.G;
      if (e.key === ' ') { G.paused = !G.paused; e.preventDefault(); }
      else if (e.key === '1') G.speed = 1;
      else if (e.key === '2') G.speed = 2;
      else if (e.key === 'Escape') { G.ui.buildMode = null; G.ui.selected = null; }
      Game.modules.forEach((m) => m.onKey && m.onKey(G, e.key));
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', (e) => updateMouse(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      const G = Game.G; updateMouse(e);
      const mm = G.ui.mouse;
      const info = { sx: mm.sx, sy: mm.sy, wx: mm.wx, wy: mm.wy, tx: mm.tx, ty: mm.ty, button: e.button };
      // Önce arayüz (en son kaydolan modüller), sonra dünya
      for (let i = Game.modules.length - 1; i >= 0; i--) {
        const m = Game.modules[i];
        if (m.onClick && m.onClick(G, info)) return;
      }
      G.ui.selected = null; // boş yere tıklandı
    });
    requestAnimationFrame(loop);
  };

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

    // Kamera
    const T = G.map.tile, pan = 600 * dt;
    if (keys['a'] || keys['arrowleft']) G.cam.x -= pan;
    if (keys['d'] || keys['arrowright']) G.cam.x += pan;
    if (keys['w'] || keys['arrowup']) G.cam.y -= pan;
    if (keys['s'] || keys['arrowdown']) G.cam.y += pan;
    G.cam.x = Math.max(0, Math.min(G.map.w * T - canvas.width, G.cam.x));
    G.cam.y = Math.max(0, Math.min(G.map.h * T - canvas.height, G.cam.y));

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
      // Kazanma / kaybetme
      const mk = G.buildings.find((b) => b.type === 'merkez');
      if (!mk || mk.hp <= 0) G.over = 'lose';
      else if (G.res.oz >= G.cfg.win.oz) G.over = 'win';
    }
    draw(G);
    requestAnimationFrame(loop);
  }

  function draw(G) {
    const T = G.map.tile, c = G.cfg.colors;
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
    // Zemin
    const x0 = Math.max(0, Math.floor(G.cam.x / T)), y0 = Math.max(0, Math.floor(G.cam.y / T));
    const x1 = Math.min(G.map.w, Math.ceil((G.cam.x + canvas.width) / T)), y1 = Math.min(G.map.h, Math.ceil((G.cam.y + canvas.height) / T));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      ctx.fillStyle = c[G.map.terrain[Game.idx(G, x, y)]];
      ctx.fillRect(x * T, y * T, T, T);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    for (let x = x0; x <= x1; x++) { ctx.beginPath(); ctx.moveTo(x * T, y0 * T); ctx.lineTo(x * T, y1 * T); ctx.stroke(); }
    for (let y = y0; y <= y1; y++) { ctx.beginPath(); ctx.moveTo(x0 * T, y * T); ctx.lineTo(x1 * T, y * T); ctx.stroke(); }
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
