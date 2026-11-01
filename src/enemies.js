// ============================================================
// src/enemies.js  —  SAHİBİ: Kişi 3
// Kül Göçebeleri akınları. Tasarım: GDD bölüm 9. Sözleşme: docs/CONTRACT.md
// ============================================================
// [x] Akın zamanlayıcı: firstRaid, sonra interval; boyut baseSize + growPerRaid * akınSayısı; G.flags.nextRaidIn
// [x] Sağ, üst ya da alt kenardan doğarlar: G.enemies.push({ id, x, y, hp, maxHp, target })
// [x] Hedef sırası: Çekim Kulesi -> kristal taşıyan işçi -> korunmasız yer kristali -> karakol -> en yakın bina -> Merkez
//     Yakınlarında saldıran bir oyuncu birimi varsa önce ona döner.
// [x] Menzile girince dps hasar; korunmasız yer kristaline ulaşırsa kapıp haritanın kenarına kaçar
// [x] Ölen akıncı bounty kadar Öz verir
// [x] Çizim: kül rengi pelerinli, kızıl gözlü göçebe + can çubuğu
(function () {
  let raidNo = 0, warned = false, fx = [];
  const ec = (G) => G.cfg.enemies;

  function spawnRaid(G) {
    raidNo++;
    const n = ec(G).baseSize + ec(G).growPerRaid * (raidNo - 1);
    const side = ['right', 'top', 'bottom'][Math.floor(Math.random() * 3)];
    const W = G.map.w, H = G.map.h;
    const cx = side === 'right' ? W - 1 : 18 + Math.random() * (W - 30);
    const cy = side === 'right' ? 4 + Math.random() * (H - 8) : side === 'top' ? 0.5 : H - 0.5;
    for (let i = 0; i < n; i++) {
      const e = {
        id: Game.newId(), x: cx + (Math.random() - 0.5) * 2, y: cy + (Math.random() - 0.5) * 2,
        hp: ec(G).hp, maxHp: ec(G).hp, target: null, carrying: null, step: Math.random() * 6, face: Math.PI, hitT: 0,
      };
      e.x = Math.max(0.5, Math.min(W - 0.5, e.x)); e.y = Math.max(0.5, Math.min(H - 0.5, e.y));
      G.enemies.push(e);
    }
    const dir = { right: 'doğudan', top: 'kuzeyden', bottom: 'güneyden' }[side];
    Game.msg(G, `⚑ Kül Göçebeleri ${dir} geliyor! (${n} akıncı)`, '#ff7b6b');
    G.flags.lastRaidAt = { x: cx, y: cy, t: G.time };
  }

  const guarded = (G, x, y) => window.City && City.guardedAt && City.guardedAt(G, x, y);
  const posOf = (t) => (t.size ? Game.center(t) : t);
  const alive = (G, t) => t && t.hp > 0 && (t.size ? G.buildings.includes(t) : t.kind ? G.units.includes(t) : G.crystals.includes(t));

  function pickTarget(G, e) {
    // 1) bana saldıran ya da çok yakındaki savaşçı
    const fighter = Game.nearest(G.units, e.x, e.y, (u) => u.owner === 'player' && u.hp > 0 && (u.kind === 'asker' || u.kind === 'savasci') && Game.dist(u.x, u.y, e.x, e.y) < ec(G).aggroRadius);
    if (fighter) return fighter;
    // 2) Çekim Kulesi
    const kule = Game.nearest(G.buildings, e.x, e.y, (b) => b.type === 'kule' && b.hp > 0);
    if (kule) return kule;
    // 3) kristal taşıyan işçi
    const carrier = Game.nearest(G.units, e.x, e.y, (u) => u.owner === 'player' && u.hp > 0 && u.carrying);
    if (carrier) return carrier;
    // 4) korunmasız yer kristali
    const cr = Game.nearest(G.crystals, e.x, e.y, (k) => !k.carriedBy && !guarded(G, k.x, k.y));
    if (cr) return cr;
    // 5) karakol, 6) en yakın bina (Merkez dahil)
    return Game.nearest(G.buildings, e.x, e.y, (b) => b.type === 'karakol' && b.hp > 0)
      || Game.nearest(G.buildings, e.x, e.y, (b) => b.hp > 0);
  }

  function exitPoint(G, e) {
    const W = G.map.w, H = G.map.h;
    const opts = [{ x: W + 1, y: e.y }, { x: e.x, y: -1 }, { x: e.x, y: H + 1 }];
    return opts.reduce((a, b) => (Game.dist(a.x, a.y, e.x, e.y) < Game.dist(b.x, b.y, e.x, e.y) ? a : b));
  }

  function updateEnemy(G, e, dt) {
    const c = ec(G);
    // kristal kaçırıyor
    if (e.carrying) {
      const cr = e.carrying;
      if (!G.crystals.includes(cr) || cr.carriedBy !== e.id) { e.carrying = null; }
      else {
        const p = exitPoint(G, e);
        e.face = Math.atan2(p.y - e.y, p.x - e.x); e.step += dt * 10;
        Game.moveTo(e, p.x, p.y, c.speed * 0.85, dt);
        cr.x = e.x; cr.y = e.y;
        if (e.x < 0 || e.y < 0 || e.x > G.map.w || e.y > G.map.h) {
          G.crystals.splice(G.crystals.indexOf(cr), 1);
          Game.msg(G, `Akıncılar ${cr.oz} Öz'lük kristali kaçırdı!`, '#ff7b6b');
          e.hp = 0; e.escaped = true;
        }
        return;
      }
    }
    e.retarget = (e.retarget || 0) - dt;
    if (!alive(G, e.target) || e.retarget <= 0 || (e.target.carriedBy && e.target.carriedBy !== e.id && !e.target.kind)) {
      e.target = pickTarget(G, e); e.retarget = 1;
    }
    const t = e.target;
    if (!t) return;
    const p = posOf(t);
    const reach = c.range + (t.size ? t.size / 2 : 0);
    const d = Game.dist(p.x, p.y, e.x, e.y);
    e.face = Math.atan2(p.y - e.y, p.x - e.x);
    if (!t.size && !t.kind) { // yer kristali: kap
      if (d < 0.5) {
        if (guarded(G, t.x, t.y)) { e.target = null; e.stealT = 0; return; }
        // kristali sökmek stealTime sürer; bu sırada askerler yetişebilir
        if (!e.stealT) Game.msg(G, 'Akıncılar bir kristali söküyor! Asker gönder.', '#ff7b6b');
        e.stealT = (e.stealT || 0) + dt; e.step += dt * 4;
        if (e.stealT >= c.stealTime) { t.carriedBy = e.id; t.claimedBy = null; e.carrying = t; e.target = null; e.stealT = 0; }
      } else { e.stealT = 0; Game.moveTo(e, p.x, p.y, c.speed, dt); e.step += dt * 10; }
      return;
    }
    if (d > reach) { Game.moveTo(e, p.x, p.y, c.speed, dt); e.step += dt * 10; return; }
    t.hp -= c.dps * dt;
    e.hitT -= dt;
    if (e.hitT <= 0) { e.hitT = 0.45; fx.push({ x: p.x + (Math.random() - 0.5) * 0.4, y: p.y + (Math.random() - 0.5) * 0.4, age: 0 }); }
    if (t.kind && t.carrying && t.hp <= 0) { t.carrying.carriedBy = null; }
  }

  function drawRaider(ctx, G, e) {
    const T = G.map.tile, px = e.x * T, py = e.y * T, r = T * 0.24, bob = Math.abs(Math.sin(e.step)) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px + 1, py + r, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(px, py + r * 0.9, r * 1.15, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    // pelerin (üçgen, yöne bakar)
    ctx.save(); ctx.translate(px, py - bob); ctx.rotate(e.face);
    ctx.fillStyle = G.cfg.colors.akinci; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 0.9, -r * 0.95); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(-r * 0.9, r * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8c8c8c'; ctx.lineWidth = 2; // kılıç
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.5); ctx.lineTo(r * 1.5, r * 0.9); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.arc(px, py - bob - r * 0.2, r * 0.45, 0, Math.PI * 2); ctx.fill(); // başlık
    ctx.fillStyle = '#ff5a3c'; ctx.fillRect(px - 3, py - bob - r * 0.3, 2, 2); ctx.fillRect(px + 1, py - bob - r * 0.3, 2, 2); // gözler
    if (e.carrying && window.Meteors && Meteors.drawCrystal) Meteors.drawCrystal(ctx, G, px, py - r - 9, e.carrying.oz, G.time);
    if (e.hp < e.maxHp) {
      const w = T * 0.6;
      ctx.fillStyle = '#300'; ctx.fillRect(px - w / 2, py - T * 0.5, w, 3);
      ctx.fillStyle = '#ff3b30'; ctx.fillRect(px - w / 2, py - T * 0.5, w * Math.max(0, e.hp / e.maxHp), 3);
    }
  }

  Game.register({
    name: 'enemies',
    init(G) { raidNo = 0; warned = false; fx = []; G.flags.nextRaidIn = ec(G).firstRaid; },
    update(G, dt) {
      const c = ec(G);
      G.flags.nextRaidIn -= dt;
      if (!warned && G.flags.nextRaidIn <= c.warnTime) { warned = true; Game.msg(G, `Kül Göçebeleri ${c.warnTime} sn içinde akın edecek! Askerlerini hazırla.`, '#ff9f6b'); }
      if (G.flags.nextRaidIn <= 0) { spawnRaid(G); G.flags.nextRaidIn = c.interval; warned = false; }
      G.enemies.forEach((e) => { if (e.hp > 0) updateEnemy(G, e, dt); });
      // ölenler: ganimet ve taşıdığı kristali düşür
      G.enemies.forEach((e) => {
        if (e.hp > 0 || e.done) return;
        e.done = true;
        if (e.carrying && G.crystals.includes(e.carrying)) e.carrying.carriedBy = null;
        if (!e.escaped) { Game.gain(G, c.bounty); fx.push({ x: e.x, y: e.y, age: 0, text: '+' + Game.costText(c.bounty) }); }
      });
      fx.forEach((f) => (f.age += dt)); fx = fx.filter((f) => f.age < (f.text ? 1.4 : 0.25));
    },
    draw(ctx, G) {
      const T = G.map.tile;
      G.enemies.forEach((e) => { if (e.hp > 0) drawRaider(ctx, G, e); });
      fx.forEach((f) => {
        if (f.text) {
          ctx.globalAlpha = 1 - f.age / 1.4; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x * T, f.y * T - f.age * 25);
          ctx.fillStyle = '#f2c14e'; ctx.fillText(f.text, f.x * T, f.y * T - f.age * 25); ctx.textAlign = 'left';
        } else {
          ctx.globalAlpha = 1 - f.age / 0.25; ctx.strokeStyle = '#ff9f6b'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x * T, f.y * T, 4 + f.age * 30, 0, Math.PI * 2); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    },
  });
})();
