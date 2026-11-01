// ============================================================
// src/vines.js  —  SAHİBİ: Kişi 2
// Mor sarmaşığın yayılması, binalara hasarı, budama, Sarmaşık Öfkesi, gece-gündüz,
// meteor tozu ve Kök Zehri. Tasarım: GDD bölüm 2 ve 7.
// Veri: G.map.vine (Uint8Array; 0 = boş, 1 = sarmaşık, 2 = kök). Sözleşme: docs/CONTRACT.md
// ============================================================
// Yayılma hızı = spreadChance × öfke çarpanı × gece çarpanı × (meteor tozu yakınındaysa toz çarpanı)
//  - Öfke: her budama ve Kök Zehri öfkeyi artırır, zamanla söner (GDD "Sarmaşık Öfkesi").
//  - Gece: sarmaşık daha hızlı büyür, yaprakları karanlıkta parlar (GDD bölüm 2).
//  - Meteor tozu: kristallerin ve Çekim Kulesi'nin çevresinde daha hızlı büyür (GDD bölüm 7).
//  - Kök Zehri (araştırma): köke tıklanınca kök ve ondan büyüyen dallar sırayla kurur.
(function () {
  const Vines = (window.Vines = {});
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let timer = 0, cover = 0, anger = 0, angryWarned = false;
  let born = null;   // her karenin sarmaşıkla kaplandığı an (büyüme animasyonu için)
  let parent = null; // her karenin büyüdüğü komşu kare (dallar bu bağla çizilir; -1 = yok)
  let wither = null; // Kök Zehri: karenin kuruyup yok olacağı an (0 = kurumuyor)
  let lastGlow = null; // son çizilen yaprak ışıltıları (gece katmanında yeniden parlatılır)

  Vines.has = (G, tx, ty) => Game.inMap(G, tx, ty) && G.map.vine[Game.idx(G, tx, ty)] > 0;
  Vines.isRoot = (G, tx, ty) => Game.inMap(G, tx, ty) && G.map.vine[Game.idx(G, tx, ty)] === 2;

  // 0..1 arası öfke ve gece değerleri (arayüz G.flags.vineAnger / G.flags.night olarak da okuyabilir)
  Vines.anger = (G) => anger / G.cfg.vines.anger.max;
  Vines.night = function (G) {
    const n = G.cfg.vines.night, t = G.time % n.cycle, start = n.cycle * (1 - n.part);
    if (t < start) return 0;
    const a = Math.min(1, (t - start) / n.ramp), b = Math.min(1, (n.cycle - t) / n.ramp);
    return Math.min(a, b);
  };
  function addAnger(G, v) {
    const a = G.cfg.vines.anger;
    anger = Math.min(a.max, anger + v);
    if (!angryWarned && anger >= a.max * a.warnAt) {
      angryWarned = true;
      Game.msg(G, 'Sarmaşık öfkelendi! Bir süre çok daha hızlı yayılacak.', '#c08ae0');
    }
  }

  // Bir binanın üstündeki ya da bitişiğindeki sarmaşık karesi var mı
  Vines.touches = function (G, b) {
    for (let y = b.y - 1; y <= b.y + b.size; y++)
      for (let x = b.x - 1; x <= b.x + b.size; x++)
        if (Vines.has(G, x, y)) return true;
    return false;
  };

  function grow(G, i, from) { G.map.vine[i] = 1; born[i] = G.time; parent[i] = from; wither[i] = 0; cover++; }
  function removeTile(G, i) { if (G.map.vine[i]) { G.map.vine[i] = 0; wither[i] = 0; cover--; } }

  // Meteor tozunun bulunduğu noktalar: yerdeki kristaller ve Çekim Kuleleri
  function dustSpots(G) {
    const out = G.crystals.map((c) => ({ x: c.x, y: c.y }));
    G.buildings.forEach((b) => { if (b.type === 'kule' && b.hp > 0) out.push(Game.center(b)); });
    return out;
  }

  function spread(G) {
    const vc = G.cfg.vines, w = G.map.w, h = G.map.h, max = Math.floor(w * h * vc.maxCover);
    if (cover >= max) return;
    const base = vc.spreadChance * (1 + Vines.anger(G) * vc.anger.spreadMul) * (1 + Vines.night(G) * (vc.night.spreadMul - 1));
    const dust = dustSpots(G), r2 = vc.dust.radius * vc.dust.radius;
    const tiles = [];
    for (let i = 0; i < G.map.vine.length; i++) if (G.map.vine[i] && !wither[i]) tiles.push(i);
    for (const i of tiles) {
      if (cover >= max) break;
      const tx = (i % w) + 0.5, ty = Math.floor(i / w) + 0.5;
      const dusty = dust.some((d) => (d.x - tx) * (d.x - tx) + (d.y - ty) * (d.y - ty) <= r2);
      if (Math.random() >= base * (dusty ? vc.dust.spreadMul : 1)) continue;
      // Sarmaşık şehre (batıya) doğru ilerlemeyi sever
      const d = Math.random() < vc.westBias ? DIRS[1] : [DIRS[0], DIRS[2], DIRS[3]][Math.floor(Math.random() * 3)];
      const nx = (i % w) + d[0], ny = Math.floor(i / w) + d[1];
      if (!Game.inMap(G, nx, ny)) continue;
      const j = Game.idx(G, nx, ny);
      if (G.map.vine[j] || Game.buildingAt(G, nx, ny)) continue; // binanın içine girmez, yanına dayanır
      grow(G, j, i);
    }
  }

  // Budanabilir mi? { ok, reason }
  // opts.worker: işçi yerinde budar, yakında bina gerekmez
  Vines.canPrune = function (G, tx, ty, opts) {
    const vc = G.cfg.vines;
    if (!Vines.has(G, tx, ty)) return { ok: false, reason: '' };
    if (Vines.isRoot(G, tx, ty)) return { ok: false, reason: 'Kök budanamaz' };
    const near = (opts && opts.worker) || G.buildings.some((b) => {
      if (b.hp <= 0) return false;
      const c = Game.center(b);
      return Game.dist(c.x, c.y, tx + 0.5, ty + 0.5) <= vc.pruneRange;
    });
    if (!near) return { ok: false, reason: `${vc.pruneRange} kare yakında bina gerekli` };
    if (!Game.canAfford(G, vc.pruneCost)) return { ok: false, reason: `${Game.costText(vc.pruneCost)} gerekli` };
    return { ok: true, reason: '' };
  };

  Vines.prune = function (G, tx, ty, opts) {
    const c = Vines.canPrune(G, tx, ty, opts);
    if (!c.ok) { if (c.reason) Game.msg(G, 'Budanamıyor: ' + c.reason + '.', '#e67e22'); return false; }
    Game.pay(G, G.cfg.vines.pruneCost);
    removeTile(G, Game.idx(G, tx, ty));
    cuts.push({ x: tx + 0.5, y: ty + 0.5, t: G.time });
    addAnger(G, G.cfg.vines.anger.perPrune);
    return true;
  };

  // Bedelsiz temizleme (ör. sarmaşık yiyen Yaprakçı böcekler). Köke dokunmaz, öfke artırmaz.
  Vines.clear = function (G, tx, ty) {
    if (!Vines.has(G, tx, ty) || Vines.isRoot(G, tx, ty)) return false;
    removeTile(G, Game.idx(G, tx, ty));
    cuts.push({ x: tx + 0.5, y: ty + 0.5, t: G.time });
    return true;
  };

  // Bir noktada hızlı sarmaşık filizlenmesi (ör. Kişi 1'in "kara meteor"u için): r kare yarıçapında boş karelere
  Vines.seed = function (G, x, y, r) {
    let n = 0;
    for (let ty = Math.floor(y - r); ty <= Math.ceil(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.ceil(x + r); tx++) {
        if (!Game.inMap(G, tx, ty) || Game.dist(tx + 0.5, ty + 0.5, x, y) > r) continue;
        const i = Game.idx(G, tx, ty);
        if (G.map.vine[i] || Game.buildingAt(G, tx, ty)) continue;
        grow(G, i, -1); born[i] = G.time + Math.random() * 0.8; n++;
      }
    return n;
  };

  // ---------- Kök Zehri ----------
  Vines.canPoison = function (G, tx, ty) {
    const p = G.cfg.vines.poison;
    if (!Vines.isRoot(G, tx, ty)) return { ok: false, reason: '' };
    if (!G.research.done.kokZehri) return { ok: false, reason: 'Kök Zehri araştırılmalı' };
    if (!Game.canAfford(G, p.cost)) return { ok: false, reason: `${Game.costText(p.cost)} gerekli` };
    return { ok: true, reason: '' };
  };

  // Kökü ve ondan büyüyen dalları (parent zinciri bu köke çıkan kareler) uzaklık sırasıyla kurutur
  Vines.poison = function (G, tx, ty) {
    const c = Vines.canPoison(G, tx, ty);
    if (!c.ok) { if (c.reason) Game.msg(G, 'Zehirlenemiyor: ' + c.reason + '.', '#e67e22'); return false; }
    const vc = G.cfg.vines, V = G.map.vine, root = Game.idx(G, tx, ty);
    Game.pay(G, vc.poison.cost);
    const depth = new Int32Array(V.length).fill(-2); // -2 bilinmiyor, -1 bu köke bağlı değil
    depth[root] = 0;
    const find = (i) => {
      const chain = [];
      let k = i, d = -1;
      while (k >= 0 && V[k] && chain.length < 4000) {
        if (depth[k] !== -2) { d = depth[k]; break; }
        chain.push(k); k = parent[k];
      }
      for (let j = chain.length - 1; j >= 0; j--) { if (d >= 0) d++; depth[chain[j]] = d; }
      return depth[i];
    };
    let n = 0;
    for (let i = 0; i < V.length; i++) {
      if (!V[i]) continue;
      const d = find(i);
      if (d >= 0) { wither[i] = G.time + 0.5 + d * vc.poison.witherStep; n++; }
    }
    addAnger(G, vc.anger.perPoison);
    Game.msg(G, `Kök zehirlendi: ${n} kare sarmaşık kuruyacak. Sarmaşık öfkelendi!`, '#9be7a1');
    return true;
  };

  // ---------- Çizim yardımcıları ----------
  // Kareye özgü, her karede aynı kalan sözde rastgele sayı (0..1)
  function rnd(x, y, k) {
    let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  const cuts = []; // budama sonrası kısa yaprak saçılması efekti

  function leafPath(p, x, y, len, ang) {
    // damla biçimli yaprak
    const ca = Math.cos(ang), sa = Math.sin(ang), wd = len * 0.45;
    const tipX = x + ca * len, tipY = y + sa * len;
    const mx = x + ca * len * 0.5, my = y + sa * len * 0.5;
    p.moveTo(x, y);
    p.quadraticCurveTo(mx - sa * wd, my + ca * wd, tipX, tipY);
    p.quadraticCurveTo(mx + sa * wd, my - ca * wd, x, y);
  }

  function drawVines(ctx, G) {
    const T = G.map.tile, c = G.cfg.colors, cv = ctx.canvas, V = G.map.vine, w = G.map.w;
    const anim = G.cfg.vines.growAnim;
    const x0 = Math.max(0, Math.floor(G.cam.x / T) - 1), y0 = Math.max(0, Math.floor(G.cam.y / T) - 1);
    const x1 = Math.min(G.map.w, Math.ceil((G.cam.x + cv.width) / T) + 1), y1 = Math.min(G.map.h, Math.ceil((G.cam.y + cv.height) / T) + 1);
    const g = (x, y) => {
      const i = y * w + x;
      let k = anim > 0 ? smooth(Math.min(1, Math.max(0, (G.time - born[i]) / anim))) : 1;
      if (wither[i]) k = Math.min(k, smooth(Math.min(1, Math.max(0, (wither[i] - G.time) / 0.8)))); // kururken büzülür
      return k;
    };

    // Her karenin dal düğümü kare ortasından biraz kaymış durur (ızgara görüntüsünü kırar)
    const nodeX = (x, y) => (x + 0.5 + (rnd(x, y, 1) - 0.5) * 0.6) * T;
    const nodeY = (x, y) => (y + 0.5 + (rnd(x, y, 2) - 0.5) * 0.6) * T;

    // 1) Zemin gölgesi: kareler yerine yumuşak, birbirine kaynayan lekeler
    const under = new Path2D(), core = new Path2D();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!V[y * w + x]) continue;
      const k = g(x, y), cx = nodeX(x, y), cy = nodeY(x, y);
      under.moveTo(cx + T * 0.82 * k, cy); under.arc(cx, cy, T * 0.82 * k, 0, Math.PI * 2);
      core.moveTo(cx + T * 0.58 * k, cy); core.arc(cx, cy, T * 0.58 * k, 0, Math.PI * 2);
    }
    ctx.fillStyle = c.vineUnder; ctx.fill(under); ctx.fill(core);

    // 2) Gövdeler: her kare büyüdüğü kareye kıvrık bir dalla bağlanır (ağaç gibi dallanır).
    //    Ara sıra bir yan komşuya da bağlanır, böylece ağ biraz sıklaşır.
    const stems = new Path2D(), thin = new Path2D();
    const link = (x, y, px, py) => {
      const k = g(x, y);
      if (k <= 0) return;
      const ax = nodeX(px, py), ay = nodeY(px, py), ex = nodeX(x, y), ey = nodeY(x, y);
      const bx = ax + (ex - ax) * k, by = ay + (ey - ay) * k;
      const dx = bx - ax, dy = by - ay, off = (rnd(x, y, 3) - 0.5) * 0.9;
      const mx = (ax + bx) / 2 - dy * off, my = (ay + by) / 2 + dx * off;
      stems.moveTo(ax, ay); stems.quadraticCurveTo(mx, my, bx, by);
    };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      if (!V[i]) continue;
      const ax = nodeX(x, y), ay = nodeY(x, y);
      let p = parent[i];
      if (p < 0 || !V[p]) { // bağlı olduğu kare budandıysa komşulardan birine tutunur
        p = -1;
        for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (Game.inMap(G, nx, ny) && V[ny * w + nx]) { p = ny * w + nx; break; } }
      }
      if (p >= 0) link(x, y, p % w, Math.floor(p / w));
      if (rnd(x, y, 4) < 0.18 && x + 1 < G.map.w && V[i + 1] && parent[i + 1] !== i && p !== i + 1) link(x + 1, y, x, y);
      // kıvrık filiz (sülük) — bazı karelerde
      if (rnd(x, y, 7) < 0.45) {
        const k = g(x, y), a0 = rnd(x, y, 8) * Math.PI * 2, r = T * 0.16 * k;
        const sx = ax + Math.cos(a0) * T * 0.25, sy = ay + Math.sin(a0) * T * 0.25;
        thin.moveTo(ax, ay); thin.lineTo(sx, sy);
        for (let s = 0; s <= 10; s++) {
          const t = s / 10, a = a0 + t * Math.PI * 2.4, rr = r * (1 - t * 0.75);
          thin.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
      }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = c.vineStemDark; ctx.lineWidth = 6; ctx.stroke(stems);
    ctx.strokeStyle = c.vineStem; ctx.lineWidth = 3.5; ctx.stroke(stems);
    ctx.strokeStyle = c.vineStemLight; ctx.lineWidth = 1; ctx.stroke(stems);
    ctx.strokeStyle = c.vineStem; ctx.lineWidth = 1.6; ctx.stroke(thin);

    // 3) Yapraklar: üç gruba ayrılır, her grup farklı zamanda hafifçe parlar
    const glow = [new Path2D(), new Path2D(), new Path2D()], leaves = new Path2D(), veins = new Path2D(), buds = new Path2D();
    const dead = new Path2D(); // kuruyan yapraklar
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!V[y * w + x]) continue;
      const k = g(x, y);
      if (k < 0.3) continue;
      if (wither[y * w + x]) {
        for (let i = 0; i < 3; i++) leafPath(dead, (x + 0.15 + rnd(x, y, 10 + i) * 0.7) * T, (y + 0.15 + rnd(x, y, 20 + i) * 0.7) * T, T * 0.25 * k, rnd(x, y, 30 + i) * 6.3);
        continue;
      }
      const n = 2 + Math.floor(rnd(x, y, 9) * 3);
      for (let i = 0; i < n; i++) {
        const lx = (x + 0.15 + rnd(x, y, 10 + i) * 0.7) * T, ly = (y + 0.15 + rnd(x, y, 20 + i) * 0.7) * T;
        const ang = rnd(x, y, 30 + i) * Math.PI * 2 + Math.sin(G.time * 1.3 + x * 0.7 + y + i) * 0.12; // rüzgârda hafif salınım
        const len = T * (0.2 + rnd(x, y, 40 + i) * 0.14) * k;
        const gi = (x + y + i) % 3;
        glow[gi].moveTo(lx + len, ly); glow[gi].arc(lx, ly, len, 0, Math.PI * 2);
        leafPath(leaves, lx, ly, len, ang);
        veins.moveTo(lx, ly); veins.lineTo(lx + Math.cos(ang) * len * 0.8, ly + Math.sin(ang) * len * 0.8);
      }
      if (rnd(x, y, 50) < 0.12) { // ışık saçan tomurcuk
        const bx = (x + 0.2 + rnd(x, y, 51) * 0.6) * T, by = (y + 0.2 + rnd(x, y, 52) * 0.6) * T;
        buds.moveTo(bx + 2.5, by); buds.arc(bx, by, 2.5 * k, 0, Math.PI * 2);
      }
    }
    for (let gi = 0; gi < 3; gi++) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(G.time * 1.6 + gi * 2.1);
      ctx.fillStyle = c.vineGlow; ctx.fill(glow[gi]);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.vineLeaf; ctx.fill(leaves);
    ctx.strokeStyle = c.vineLeafDark; ctx.lineWidth = 0.8; ctx.stroke(leaves);
    ctx.strokeStyle = c.vineLeafVein; ctx.lineWidth = 0.7; ctx.stroke(veins);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.time * 3);
    ctx.fillStyle = c.vineBud; ctx.fill(buds);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.vineDead; ctx.fill(dead);
    lastGlow = { glow, buds };

    // 4) Kök düğümleri: nabız gibi atan iri yumru
    G.cfg.vines.roots.forEach((r, i) => {
      if (!Vines.isRoot(G, r.x, r.y)) return;
      const px = (r.x + 0.5) * T, py = (r.y + 0.5) * T, pulse = 1 + Math.sin(G.time * 2 + i) * 0.06;
      const halo = ctx.createRadialGradient(px, py, T * 0.2, px, py, T * 1.6);
      halo.addColorStop(0, c.vineRootGlow); halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, T * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.vineStemDark; ctx.lineWidth = 4;
      for (let k = 0; k < 6; k++) { // kalın kök kolları
        const a = (k / 6) * Math.PI * 2 + rnd(r.x, r.y, k) * 0.6;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a + 0.5) * T * 0.6, py + Math.sin(a + 0.5) * T * 0.6, px + Math.cos(a) * T * 1.1, py + Math.sin(a) * T * 1.1);
        ctx.stroke();
      }
      const body = ctx.createRadialGradient(px - T * 0.12, py - T * 0.12, T * 0.05, px, py, T * 0.45 * pulse);
      body.addColorStop(0, c.vineStemLight); body.addColorStop(0.5, c.vineStem); body.addColorStop(1, c.vineRoot);
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(px, py, T * 0.45 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.vineLeaf; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = c.vineBud; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.time * 2 + i);
      ctx.beginPath(); ctx.arc(px, py, T * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // 5) Budama efekti: savrulan yaprak parçaları
    for (let i = cuts.length - 1; i >= 0; i--) {
      const e = cuts[i], t = G.time - e.t;
      if (t > 0.8 || t < 0) { cuts.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - t / 0.8; ctx.fillStyle = c.vineLeaf;
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + e.x, d = T * (0.2 + t * 1.2);
        const p = new Path2D(); leafPath(p, e.x * T + Math.cos(a) * d, e.y * T + Math.sin(a) * d, T * 0.18, a + t * 6);
        ctx.fill(p);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHover(ctx, G) {
    const m = G.ui.mouse, T = G.map.tile;
    if (G.ui.buildMode || G.ui.tool !== 'prune' || !Vines.has(G, m.tx, m.ty)) return;
    const root = Vines.isRoot(G, m.tx, m.ty);
    const c = root ? Vines.canPoison(G, m.tx, m.ty) : Vines.canPrune(G, m.tx, m.ty);
    const col = c.ok ? G.cfg.colors.pruneOk : G.cfg.colors.pruneNo;
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -G.time * 12;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(m.tx * T + 2, m.ty * T + 2, T - 4, T - 4, 6) : ctx.rect(m.tx * T + 2, m.ty * T + 2, T - 4, T - 4);
    ctx.stroke(); ctx.setLineDash([]);
    const text = root
      ? (c.ok ? '☠ Kök Zehri: ' + Game.costText(G.cfg.vines.poison.cost) : 'Sarmaşık kökü · ' + c.reason)
      : (c.ok ? '✂ Buda: ' + Game.costText(G.cfg.vines.pruneCost) : c.reason);
    ctx.font = '12px sans-serif';
    const tw = ctx.measureText(text).width + 12, bx = m.tx * T + T / 2 - tw / 2, by = m.ty * T - 24;
    ctx.fillStyle = G.cfg.colors.panel; ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, tw, 19, 5) : ctx.rect(bx, by, tw, 19); ctx.fill();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(text, m.tx * T + T / 2, by + 13.5); ctx.textAlign = 'left';
  }

  // Ekran katmanı: gece karartması, karanlıkta parlayan yapraklar ve küçük öfke / gece göstergesi
  function drawOverlay(ctx, G) {
    const c = G.cfg.colors, cv = ctx.canvas, night = Vines.night(G);
    if (night > 0) {
      ctx.globalAlpha = night; ctx.fillStyle = c.nightTint; ctx.fillRect(0, 0, cv.width, cv.height);
      if (lastGlow) { // sarmaşık karanlıkta ışıldar
        ctx.save(); ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
        ctx.globalCompositeOperation = 'lighter';
        lastGlow.glow.forEach((p, gi) => { ctx.globalAlpha = night * (0.25 + 0.2 * Math.sin(G.time * 1.6 + gi * 2.1)); ctx.fillStyle = c.vineGlow; ctx.fill(p); });
        ctx.globalAlpha = night; ctx.fillStyle = c.vineBud; ctx.fill(lastGlow.buds);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // gösterge (sağ üst, üst çubuğun altında)
    const a = Vines.anger(G), W = 150, x = cv.width - W - 12, y = (G.ui.hudTop || 0) + 8;
    ctx.fillStyle = c.panel; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, W, 40, 6); else ctx.rect(x, y, W, 40);
    ctx.fill();
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = c.text;
    ctx.fillText(night > 0.5 ? '☾ Gece · sarmaşık hızlı' : '☀ Gündüz', x + 8, y + 14);
    ctx.fillStyle = c.vineStemLight; ctx.fillText('Sarmaşık Öfkesi', x + 8, y + 29);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 100, y + 22, 42, 7);
    ctx.fillStyle = a > G.cfg.vines.anger.warnAt ? c.bocekDusman : c.vineStem; ctx.fillRect(x + 100, y + 22, 42 * a, 7);
  }

  Game.register({
    name: 'vines',
    init(G) {
      timer = 0; cover = 0; anger = 0; angryWarned = false; cuts.length = 0; lastGlow = null;
      born = new Float32Array(G.map.w * G.map.h).fill(-1e6);
      parent = new Int32Array(G.map.w * G.map.h).fill(-1);
      wither = new Float32Array(G.map.w * G.map.h);
      G.cfg.vines.roots.forEach((r) => {
        const ri = Game.idx(G, r.x, r.y);
        G.map.vine[ri] = 2; cover++;
        // köklerin çevresinde küçük bir başlangıç öbeği
        DIRS.forEach((d) => {
          const x = r.x + d[0], y = r.y + d[1];
          if (Game.inMap(G, x, y) && !G.map.vine[Game.idx(G, x, y)]) { grow(G, Game.idx(G, x, y), ri); born[Game.idx(G, x, y)] = -1e6; }
        });
      });
    },
    update(G, dt) {
      const vc = G.cfg.vines;
      timer += dt;
      while (timer >= vc.spreadEvery) { timer -= vc.spreadEvery; spread(G); }
      // Öfke zamanla söner
      anger = Math.max(0, anger - vc.anger.decayPerSec * dt);
      if (anger < vc.anger.max * vc.anger.warnAt * 0.5) angryWarned = false;
      // Kök Zehri: süresi gelen kareler kurur
      for (let i = 0; i < wither.length; i++) if (wither[i] && G.time >= wither[i]) removeTile(G, i);
      G.flags.vineAnger = Vines.anger(G);
      G.flags.night = Vines.night(G);
      // Sarmaşığa değen binalar çürür
      for (const b of G.buildings) {
        if (b.hp <= 0 || !Vines.touches(G, b)) { if (b.data) b.data.vineWarned = false; continue; }
        b.hp -= vc.damagePerSec * dt;
        if (!b.data.vineWarned) {
          b.data.vineWarned = true;
          Game.msg(G, `${G.cfg.buildings[b.type].ad} sarmaşık tarafından sarılıyor! Çevresini buda.`, '#b07fe0');
        }
      }
      G.flags.vineCover = cover / (G.map.w * G.map.h);
    },
    draw(ctx, G) {
      drawVines(ctx, G);
      // Sarılan binaların üstünde mor çatlak uyarısı
      const T = G.map.tile;
      G.buildings.forEach((b) => {
        if (b.hp <= 0 || !b.data || !b.data.vineWarned) return;
        ctx.strokeStyle = G.cfg.colors.vineStem; ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.time * 4);
        ctx.strokeRect(b.x * T + 1, b.y * T + 1, b.size * T - 2, b.size * T - 2);
        ctx.globalAlpha = 1;
      });
      drawHover(ctx, G);
    },
    drawUI(ctx, G) { drawOverlay(ctx, G); },
    onKey(G, key) { if (key.toLowerCase() === 'b') { G.ui.tool = G.ui.tool === 'prune' ? null : 'prune'; G.ui.buildMode = null; } },
    // Budama aracı (arayüzdeki "Buda" düğmesi ya da B tuşu): sol tık budar / köke zehir, sağ tık araçtan çıkar.
    // Araç kapalıyken sarmaşığa işçilerle sağ tıklanır (city.js işçileri budamaya gönderir).
    onClick(G, info) {
      if (G.ui.tool !== 'prune' || G.ui.buildMode) return false;
      if (info.button === 2) { G.ui.tool = null; return true; }
      if (info.button !== 0) return false;
      if (!Vines.has(G, info.tx, info.ty)) return true;
      if (Vines.isRoot(G, info.tx, info.ty)) Vines.poison(G, info.tx, info.ty);
      else Vines.prune(G, info.tx, info.ty);
      return true;
    },
  });
})();
