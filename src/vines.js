// ============================================================
// src/vines.js  —  SAHİBİ: Kişi 2
// Mor sarmaşığın yayılması, binalara hasarı ve budama. Tasarım: GDD bölüm 7.
// Veri: G.map.vine (Uint8Array; 0 = boş, 1 = sarmaşık, 2 = kök). Sözleşme: docs/CONTRACT.md
// ============================================================
(function () {
  const Vines = (window.Vines = {});
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let timer = 0, cover = 0;

  Vines.has = (G, tx, ty) => Game.inMap(G, tx, ty) && G.map.vine[Game.idx(G, tx, ty)] > 0;
  Vines.isRoot = (G, tx, ty) => Game.inMap(G, tx, ty) && G.map.vine[Game.idx(G, tx, ty)] === 2;

  // Bir binanın üstündeki ya da bitişiğindeki sarmaşık karesi var mı
  Vines.touches = function (G, b) {
    for (let y = b.y - 1; y <= b.y + b.size; y++)
      for (let x = b.x - 1; x <= b.x + b.size; x++)
        if (Vines.has(G, x, y)) return true;
    return false;
  };

  function spread(G) {
    const vc = G.cfg.vines, w = G.map.w, h = G.map.h, max = Math.floor(w * h * vc.maxCover);
    if (cover >= max) return;
    const tiles = [];
    for (let i = 0; i < G.map.vine.length; i++) if (G.map.vine[i]) tiles.push(i);
    for (const i of tiles) {
      if (cover >= max) break;
      if (Math.random() >= vc.spreadChance) continue;
      // Sarmaşık şehre (batıya) doğru ilerlemeyi sever
      const d = Math.random() < vc.westBias ? DIRS[1] : [DIRS[0], DIRS[2], DIRS[3]][Math.floor(Math.random() * 3)];
      const nx = (i % w) + d[0], ny = Math.floor(i / w) + d[1];
      if (!Game.inMap(G, nx, ny)) continue;
      const j = Game.idx(G, nx, ny);
      if (G.map.vine[j] || Game.buildingAt(G, nx, ny)) continue; // binanın içine girmez, yanına dayanır
      G.map.vine[j] = 1; cover++;
    }
  }

  Vines.prune = function (G, tx, ty) {
    const vc = G.cfg.vines;
    if (!Vines.has(G, tx, ty)) return false;
    if (Vines.isRoot(G, tx, ty)) { Game.msg(G, 'Sarmaşık kökü budanamaz.', '#e67e22'); return false; }
    const near = G.buildings.some((b) => {
      if (b.hp <= 0) return false;
      const c = Game.center(b);
      return Game.dist(c.x, c.y, tx + 0.5, ty + 0.5) <= vc.pruneRange;
    });
    if (!near) { Game.msg(G, `Budamak için ${vc.pruneRange} kare yakında bir binan olmalı.`, '#e67e22'); return false; }
    if (!Game.pay(G, vc.pruneCost)) { Game.msg(G, `Budama için ${Game.costText(vc.pruneCost)} gerekli.`, '#e67e22'); return false; }
    G.map.vine[Game.idx(G, tx, ty)] = 0; cover--;
    return true;
  };

  Game.register({
    name: 'vines',
    init(G) {
      timer = 0; cover = 0;
      G.cfg.vines.roots.forEach((r) => {
        G.map.vine[Game.idx(G, r.x, r.y)] = 2; cover++;
        // köklerin çevresinde küçük bir başlangıç öbeği
        DIRS.forEach((d) => {
          const x = r.x + d[0], y = r.y + d[1];
          if (Game.inMap(G, x, y) && !G.map.vine[Game.idx(G, x, y)]) { G.map.vine[Game.idx(G, x, y)] = 1; cover++; }
        });
      });
    },
    update(G, dt) {
      const vc = G.cfg.vines;
      timer += dt;
      while (timer >= vc.spreadEvery) { timer -= vc.spreadEvery; spread(G); }
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
      const T = G.map.tile, c = G.cfg.colors, cv = ctx.canvas;
      const x0 = Math.max(0, Math.floor(G.cam.x / T)), y0 = Math.max(0, Math.floor(G.cam.y / T));
      const x1 = Math.min(G.map.w, Math.ceil((G.cam.x + cv.width) / T) + 1), y1 = Math.min(G.map.h, Math.ceil((G.cam.y + cv.height) / T) + 1);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const v = G.map.vine[Game.idx(G, x, y)];
        if (!v) continue;
        const px = x * T, py = y * T, h = (x * 73856093) ^ (y * 19349663); // kareye özgü sabit desen
        ctx.fillStyle = 'rgba(80,30,110,0.35)';
        ctx.fillRect(px, py, T, T);
        // kıvrık gövdeler
        ctx.strokeStyle = c.vineStem; ctx.lineWidth = v === 2 ? 5 : 2.5; ctx.lineCap = 'round';
        for (let k = 0; k < 2; k++) {
          const off = ((h >> (k * 4)) & 15) / 15;
          ctx.beginPath();
          ctx.moveTo(px, py + T * (0.2 + 0.6 * off));
          ctx.bezierCurveTo(px + T * 0.35, py + T * (off), px + T * 0.65, py + T * (1 - off), px + T, py + T * (0.8 - 0.6 * off));
          ctx.stroke();
        }
        // mavi yapraklar (hafif ışıldar)
        ctx.fillStyle = c.vineLeaf;
        for (let k = 0; k < 3; k++) {
          const lx = px + T * (0.15 + (((h >> (k * 3 + 1)) & 7) / 7) * 0.7);
          const ly = py + T * (0.15 + (((h >> (k * 3 + 9)) & 7) / 7) * 0.7);
          ctx.globalAlpha = 0.75 + 0.25 * Math.sin(G.time * 2 + k + x);
          ctx.beginPath(); ctx.ellipse(lx, ly, 4, 2.5, k, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (v === 2) { // kök düğümü
          ctx.fillStyle = '#4a1f66';
          ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, T * 0.32, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = c.vineLeaf; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      // Budanabilir kare vurgusu (fare üstündeyken)
      const m = G.ui.mouse;
      if (!G.ui.buildMode && Vines.has(G, m.tx, m.ty) && !Vines.isRoot(G, m.tx, m.ty)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
        ctx.strokeRect(m.tx * T + 1, m.ty * T + 1, T - 2, T - 2);
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
        ctx.fillText('Buda: ' + Game.costText(G.cfg.vines.pruneCost), m.tx * T + 2, m.ty * T - 4);
      }
    },
    onClick(G, info) {
      if (G.ui.buildMode || info.button !== 0) return false;
      if (!Vines.has(G, info.tx, info.ty)) return false;
      Vines.prune(G, info.tx, info.ty);
      return true;
    },
  });
})();
