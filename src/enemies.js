/* Kişi 3: Kül Göçebeleri. Provisional adapter until docs/CONTRACT.md arrives.
 * CONFIG.enemies: firstRaid, raidInterval, count, countGrowth, hp, speed,
 * dps, range, bounty, stealAmount. Times are simulation seconds.
 * Game.moveTo(entity, target, speed * dt); Game.gain(G, {oz: amount}).
 */
(function () {
  'use strict';
  const cfg = () => (window.CONFIG && CONFIG.enemies) || {};
  const value = (key, fallback) => Number.isFinite(cfg()[key]) ? cfg()[key] : fallback;
  const alive = e => e && !e.dead && (e.hp == null || e.hp > 0);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const live = list => (list || []).filter(alive);
  const nearest = (list, from) => list.reduce((best, e) => !best || distance(e, from) < distance(best, from) ? e : best, null);
  function message(G, text) { if (Game.msg) Game.msg(G, text); }
  function move(e, target, dt) {
    const step = value('speed', 2) * dt;
    if (Game.moveTo) Game.moveTo(e, target, step);
    else {
      const d = distance(e, target);
      if (d) { e.x += (target.x - e.x) * Math.min(1, step / d); e.y += (target.y - e.y) * Math.min(1, step / d); }
    }
  }
  function init(G) {
    G.enemies = G.enemies || [];
    G.flags = G.flags || {};
    G.flags.nextRaidIn = value('firstRaid', 180);
    G.flags.raidNumber = 0;
  }
  function spawn(G) {
    const width = G.map && (G.map.width || G.map.w) || 60;
    const height = G.map && (G.map.height || G.map.h) || 40;
    const count = Math.max(1, Math.floor(value('count', 3) + G.flags.raidNumber * value('countGrowth', 1)));
    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4), along = Math.random();
      const x = edge === 0 ? 0 : edge === 1 ? width - 1 : along * (width - 1);
      const y = edge === 2 ? 0 : edge === 3 ? height - 1 : along * (height - 1);
      G.enemies.push({type: 'akinci', x, y, hp: value('hp', 45), maxHp: value('hp', 45), home: {x, y}, loot: 0});
    }
    G.flags.raidNumber++;
    message(G, 'Kül Göçebeleri geliyor!');
  }
  function target(G, e) {
    return nearest(live(G.units).filter(u => u.carrying), e)
      || nearest(live(G.buildings).filter(b => b.type === 'cekimKulesi' || b.type === 'kule'), e)
      || nearest(live(G.crystals).filter(c => c.amount > 0), e)
      || nearest(live(G.buildings), e);
  }
  function update(G, dt) {
    if (G.over || G.paused || !(dt > 0) || !Number.isFinite(dt)) return;
    G.flags = G.flags || {};
    G.enemies = G.enemies || [];
    if (!Number.isFinite(G.flags.nextRaidIn)) init(G);
    G.flags.nextRaidIn -= dt;
    const interval = Math.max(1, value('raidInterval', 120));
    while (G.flags.nextRaidIn <= 0) { spawn(G); G.flags.nextRaidIn += interval; }
    for (const e of G.enemies) {
      if (e.hp <= 0 && !e.rewarded && !e.escaped) {
        e.rewarded = true; e.dead = true;
        if (Game.gain) Game.gain(G, {oz: value('bounty', 3)});
        message(G, 'Bir Kül Göçebesi durduruldu.');
      }
      if (!alive(e)) continue;
      if (e.loot > 0) {
        move(e, e.home, dt);
        if (distance(e, e.home) <= value('range', 0.8)) {
          e.escaped = true; e.dead = true;
          message(G, 'Akıncı çaldığı Yıldız Özü ile kaçtı!');
        }
        continue;
      }
      const t = target(G, e);
      if (!t) continue;
      if (distance(e, t) > value('range', 0.8)) { move(e, t, dt); continue; }
      if ((G.crystals || []).includes(t)) {
        e.loot = Math.min(t.amount, Math.max(0, value('stealAmount', 5)));
        t.amount -= e.loot;
      } else {
        t.hp = Math.max(0, t.hp - value('dps', 7) * dt);
        if (t.hp === 0 && t.carrying) {
          e.loot = typeof t.carrying === 'number' ? t.carrying : (t.carrying.amount || 1);
          t.carrying = null;
        }
      }
    }
    G.enemies = G.enemies.filter(e => !e.dead && e.hp > 0);
  }
  function draw(ctx, G) {
    const size = (G.map && G.map.tileSize) || (window.CONFIG && CONFIG.tileSize) || 20;
    for (const e of G.enemies || []) {
      if (!alive(e)) continue;
      if (window.Art) {
        Art.draw(ctx, 'akinci', (e.x + 0.5) * size, (e.y + 0.5) * size, size, {time: G.time || 0});
        ctx.fillStyle = '#24222a'; ctx.fillRect(e.x * size, (e.y - .22) * size, size, 3);
        ctx.fillStyle = '#db7668'; ctx.fillRect(e.x * size, (e.y - .22) * size, size * Math.max(0, Math.min(1, e.hp / e.maxHp)), 3);
        continue;
      }
      ctx.save(); ctx.translate((e.x + 0.5) * size, (e.y + 0.5) * size);
      ctx.fillStyle = e.loot ? '#c9773a' : '#353841'; ctx.strokeStyle = '#b9bec6'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -size * 0.42); ctx.lineTo(size * 0.36, size * 0.32); ctx.lineTo(-size * 0.36, size * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#24222a'; ctx.fillRect(-size / 2, -size * 0.68, size, 3);
      ctx.fillStyle = '#db7668'; ctx.fillRect(-size / 2, -size * 0.68, size * Math.max(0, Math.min(1, e.hp / e.maxHp)), 3);
      ctx.restore();
    }
  }
  window.Enemies = {init, update, draw, spawn};
  Game.register({name: 'enemies', init, update, draw});
})();
