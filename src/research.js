// ============================================================
// src/research.js  —  SAHİBİ: Kişi 2
// Araştırma Laboratuvarı kuyruğu ve ilerlemesi. Tasarım: GDD bölüm 10. Sözleşme: docs/CONTRACT.md
// G.research = { done:{id:true}, queue:[id], current:id|null, progress:saniye }
// ============================================================
(function () {
  const Research = (window.Research = {});
  const def = (G, id) => G.cfg.research.find((r) => r.id === id);
  const lab = (G) => G.buildings.find((b) => b.type === 'lab' && b.hp > 0);
  const inPipeline = (G, id) => G.research.done[id] || G.research.current === id || G.research.queue.includes(id);

  // Laboratuvarda çalışan bilimci sayısı (city.js bilimciye state = 'lab' yazar)
  Research.scientists = (G) => G.units.filter((u) => u.kind === 'bilimci' && u.state === 'lab' && u.hp > 0).length;
  Research.speed = (G) => 1 + G.cfg.buildings.lab.scientistBonus * Research.scientists(G);

  // Kuyruğa eklenebilecek araştırmalar (arayüz listeler). Kilitli olanlar da döner, nedeniyle birlikte.
  Research.available = function (G) {
    return G.cfg.research
      .filter((r) => !inPipeline(G, r.id))
      .map((r) => {
        let reason = null;
        if (!lab(G)) reason = 'Laboratuvar gerekli';
        else if (r.requires && !inPipeline(G, r.requires)) reason = 'Önce: ' + def(G, r.requires).ad;
        else if (!Game.canAfford(G, r.cost)) reason = 'Yetersiz kaynak';
        return { id: r.id, ad: r.ad, cost: r.cost, costText: Game.costText(r.cost), time: r.time, effect: r.effect, ok: !reason, reason };
      });
  };

  Research.enqueue = function (G, id) {
    const r = def(G, id);
    if (!r || inPipeline(G, id)) return false;
    if (!lab(G)) { Game.msg(G, 'Araştırma için önce Laboratuvar kur.', '#e67e22'); return false; }
    if (r.requires && !inPipeline(G, r.requires)) { Game.msg(G, `${r.ad} için önce ${def(G, r.requires).ad} gerekli.`, '#e67e22'); return false; }
    if (!Game.pay(G, r.cost)) { Game.msg(G, `${r.ad}: ${Game.costText(r.cost)} gerekli.`, '#e67e22'); return false; }
    G.research.queue.push(id);
    Game.msg(G, `${r.ad} araştırma sırasına eklendi.`, '#2e86de');
    return true;
  };

  // Arayüz için: şu anki araştırmanın durumu
  Research.info = function (G) {
    const R = G.research;
    if (!R.current) return null;
    const r = def(G, R.current);
    return { id: r.id, ad: r.ad, progress: R.progress, time: r.time, pct: Math.min(1, R.progress / r.time), speed: Research.speed(G), queue: R.queue.map((id) => def(G, id).ad) };
  };

  Research.isDone = (G, id) => !!G.research.done[id];

  let warnedNoLab = false;

  Game.register({
    name: 'research',
    update(G, dt) {
      const R = G.research;
      if (!R.current && R.queue.length) { R.current = R.queue.shift(); R.progress = 0; }
      if (!R.current) return;
      if (!lab(G)) {
        if (!warnedNoLab) { warnedNoLab = true; Game.msg(G, 'Laboratuvar yıkıldı, araştırma durdu!', '#e74c3c'); }
        return;
      }
      warnedNoLab = false;
      R.progress += dt * Research.speed(G);
      const r = def(G, R.current);
      if (R.progress >= r.time) {
        R.done[r.id] = true;
        Game.msg(G, `Araştırma tamamlandı: ${r.ad}. ${r.effect}.`, '#2ecc71');
        R.current = null; R.progress = 0;
      }
    },
    // Laboratuvarın üstünde ilerleme çubuğu
    draw(ctx, G) {
      const info = Research.info(G), b = lab(G);
      if (!info || !b) return;
      const T = G.map.tile, colors = G.cfg.colors, cx = (b.x + b.size / 2) * T, py = b.y * T;
      const label = `⚗ ${info.ad}  ${Math.floor(info.pct * 100)}%` + (info.speed > 1 ? `  ×${info.speed.toFixed(1)}` : '');
      ctx.font = 'bold 11px sans-serif';
      const bw = Math.max(b.size * T + 20, ctx.measureText(label).width + 16), bx = cx - bw / 2, by = py - 30;
      const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
      ctx.fillStyle = colors.panel; rr(bx, by, bw, 22, 6); ctx.fill();
      ctx.strokeStyle = colors.arastirma; ctx.lineWidth = 1; ctx.stroke();
      // ilerleme: üstte parlayan dolgu
      if (info.pct > 0) {
        const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        grd.addColorStop(0, colors.arastirma); grd.addColorStop(1, colors.vineBud);
        ctx.fillStyle = grd; ctx.globalAlpha = 0.85; rr(bx + 3, by + 15, (bw - 6) * info.pct, 4, 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = colors.text; ctx.textAlign = 'center';
      ctx.fillText(label, cx, by + 12);
      if (info.queue.length) {
        ctx.font = '10px sans-serif'; ctx.fillStyle = colors.vineBud;
        ctx.fillText('Sırada: ' + info.queue.join(', '), cx, by - 4);
      }
      ctx.textAlign = 'left';
    },
  });
})();
