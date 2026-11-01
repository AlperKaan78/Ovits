// ============================================================
// src/colonies.js  —  SAHİBİ: Kişi 2
// Eklem bacaklı koloniler: dolaşma, saldırılınca karşılık verme, av, Kitin,
// bayılma, nöro-çip ile yakalama ve kraliçe. Tasarım: GDD bölüm 8. Sözleşme: docs/CONTRACT.md
// ============================================================
// Kişi 1 ile bağlantılar:
//  - Askerler/taretler Colonies.hostileMembers(G) listesini hedef alır.
//  - Colonies.hunt bir askere u.huntTarget = member.id yazar; asker önce o bireye gitmeli.
//  - City.orderChip(G, member, sure) bilimciyi gönderir; çip bitince city.js Colonies.chipDone(G, member) çağırır.
//  - Çiplenen toplayıcı 'tasiyici' (işçi gibi), muhafız 'savasci' (asker gibi, bakımsız) birimi olur.
(function () {
  const Colonies = (window.Colonies = {});

  // ---------- Yardımcılar ----------
  const cc = (G) => G.cfg.colonies;
  const isHostile = (G, col) => col.hostileUntil > G.time;
  const active = (m) => m.hp > 0 && m.state !== 'fainted' && m.state !== 'chipped';
  Colonies.colonyOf = (G, member) => G.colonies.find((c) => c.members.includes(member));

  function makeMember(G, col, role, x, y) {
    const d = role === 'kralice' ? cc(G).kralice : cc(G)[role];
    return {
      id: Game.newId(), role, x, y, hp: d.hp, maxHp: d.hp, lastHp: d.hp,
      state: 'wander', tx: x, ty: y, wanderT: Math.random() * 3, faintT: 0, reserved: false,
      dir: Math.random() * Math.PI * 2, step: Math.random() * 10, attackTarget: null, colonyId: col.id,
    };
  }

  function roamPoint(G, col) {
    // Toplayıcılar: kraliçeden batıya doğru, orman kenarı ve düzlükte dolaşır
    const q = col.queen, w = cc(G).roamWidth;
    return {
      x: Math.max(1, Math.min(G.map.w - 2, q.x - 4 - Math.random() * (w + 8))),
      y: Math.max(1, Math.min(G.map.h - 2, q.y + (Math.random() - 0.5) * 16)),
    };
  }
  function guardPoint(G, col) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * (cc(G).muhafiz.guardRadius - 1.5);
    return { x: col.queen.x + 0.5 + Math.cos(a) * r, y: col.queen.y + 0.5 + Math.sin(a) * r };
  }

  function playerTargets(G) {
    const list = G.units.filter((u) => u.owner === 'player' && u.hp > 0 && u.kind !== 'yumurta');
    G.buildings.forEach((b) => { if (b.hp > 0) list.push(b); });
    return list;
  }
  const posOf = (e) => (e.size ? Game.center(e) : e);

  // ---------- Dışarıya açılanlar ----------

  // Askerlerin ve taretlerin hedef alacağı bireyler: düşman kolonilerin aktif bireyleri
  // ve yuvayı korumak için saldıran muhafızlar. Kraliçe hiçbir zaman listede değildir.
  Colonies.hostileMembers = function (G) {
    const out = [];
    for (const col of G.colonies) {
      const hostile = isHostile(G, col);
      for (const m of col.members) {
        if (m.role === 'kralice' || !active(m)) continue;
        if (hostile || m.state === 'attack') out.push(m);
      }
    }
    // Avlanan birey listenin başında olsun
    out.sort((a, b) => (b.hunted ? 1 : 0) - (a.hunted ? 1 : 0));
    return out;
  };

  // Oyuncu bir bireyi avlamak istedi
  Colonies.hunt = function (G, member) {
    const col = Colonies.colonyOf(G, member);
    if (!col || !active(member) || member.role === 'kralice') return false;
    col.hostileUntil = G.time + cc(G).hostileTime;
    col.members.forEach((m) => (m.hunted = false));
    member.hunted = true;
    // En yakın boştaki askerleri bu bireye yönlendir (city.js asker davranışı u.huntTarget'a bakar)
    const soldiers = G.units
      .filter((u) => u.owner === 'player' && (u.kind === 'asker' || u.kind === 'savasci') && u.hp > 0 && !u.post)
      .sort((a, b) => Game.dist(a.x, a.y, member.x, member.y) - Game.dist(b.x, b.y, member.x, member.y))
      .slice(0, cc(G).huntSoldiers);
    soldiers.forEach((s) => (s.huntTarget = member.id));
    Game.msg(G, soldiers.length
      ? `${soldiers.length} asker avlanmaya gidiyor. Koloni ${cc(G).hostileTime} sn boyunca saldırgan!`
      : 'Avlanacak boşta asker yok! Koloni yine de saldırganlaştı.', '#e74c3c');
    return true;
  };

  Colonies.chipTimeFor = function (G, member) {
    const col = Colonies.colonyOf(G, member);
    if (member.role === 'kralice') return cc(G).queenChipTime;
    return Math.max(cc(G).chipTimeMin, cc(G).chipTime - (col ? col.kills : 0));
  };

  // Çiplenebilir mi? { ok, reason }
  Colonies.canChip = function (G, member) {
    const col = Colonies.colonyOf(G, member);
    if (!col || member.state === 'chipped') return { ok: false, reason: 'Bu birey zaten çipli.' };
    if (member.reserved) return { ok: false, reason: 'Bir bilimci zaten yolda.' };
    if (member.role === 'kralice') {
      if (!G.research.done.kraliceCipi) return { ok: false, reason: 'Önce Kraliçe Çipi araştırılmalı.' };
      const guards = col.members.filter((m) => m.role === 'muhafiz' && active(m));
      if (guards.length) return { ok: false, reason: `Önce ${guards.length} muhafızı etkisiz hâle getir.` };
      return { ok: true };
    }
    if (!G.research.done.noroCip) return { ok: false, reason: 'Önce Nöro-çip araştırılmalı.' };
    if (member.state !== 'fainted') return { ok: false, reason: 'Birey önce bayıltılmalı (Kitin Ağı + avla).' };
    return { ok: true };
  };

  // Arayüzün "Çiple" düğmesi bunu çağırır
  Colonies.tryChip = function (G, member) {
    const c = Colonies.canChip(G, member);
    if (!c.ok) { Game.msg(G, c.reason, '#e67e22'); return false; }
    if (!(window.City && City.orderChip)) { Game.msg(G, 'Bilimci çip görevi henüz hazır değil (city.js).', '#e67e22'); return false; }
    const t = Colonies.chipTimeFor(G, member);
    const ok = City.orderChip(G, member, t);
    if (ok === false) { Game.msg(G, 'Boşta bilimci yok.', '#e67e22'); return false; }
    member.reserved = true;
    Game.msg(G, `Bilimci çip takmaya gidiyor (${t} sn).`, '#2e86de');
    return true;
  };

  // Bilimci çipi bitirdi
  Colonies.chipDone = function (G, member) {
    const col = Colonies.colonyOf(G, member);
    if (!col || member.state === 'chipped') return;
    if (member.role === 'kralice') {
      col.captured = true;
      col.members.slice().forEach((m) => { if (m !== member && m.hp > 0) convert(G, col, m); });
      member.state = 'chipped'; member.reserved = false;
      Game.msg(G, `KRALİÇE ÇİPLENDİ! Koloni ${col.id} artık senin.`, '#e67e22');
      G.over = 'win';
      return;
    }
    convert(G, col, member);
    Game.msg(G, member.role === 'toplayici' ? 'Bir toplayıcı çiplendi: artık taşıyıcın.' : 'Bir muhafız çiplendi: artık savaşçın.', '#e67e22');
  };

  function convert(G, col, m) {
    col.members = col.members.filter((x) => x !== m);
    m.state = 'chipped';
    const kind = m.role === 'muhafiz' ? 'savasci' : 'tasiyici';
    Game.addUnit(G, {
      kind, owner: 'player', x: m.x, y: m.y, hp: m.maxHp, maxHp: m.maxHp,
      state: 'idle', carrying: null, fromColony: col.id, role: m.role,
    });
  }

  // ---------- Davranış ----------
  function onDown(G, col, m) {
    // Can bitti ya da bayılma eşiğinin altına indi
    if (G.research.done.kitinAgi && m.role !== 'kralice') {
      m.state = 'fainted'; m.hp = Math.max(1, m.hp); m.faintT = cc(G).faintTime;
      m.hunted = false; m.attackTarget = null;
      G.res.kitin += 1; col.kills += 1;
      Game.msg(G, `Bir birey bayıldı (+1 Kitin). ${G.research.done.noroCip ? 'Tıklayıp çipleyebilirsin.' : ''}`, '#9be7a1');
    } else {
      m.hp = 0;
      col.members = col.members.filter((x) => x !== m);
      G.res.kitin += 1; col.kills += 1;
      Game.msg(G, '+1 Kitin. Bu koloniyi çiplemek artık daha kolay.', '#9be7a1');
    }
  }

  function updateMember(G, col, m, dt) {
    const c = cc(G);
    const d = m.role === 'kralice' ? c.kralice : c[m.role];

    // Bayılma / ölüm kontrolü
    if (m.state !== 'fainted' && m.state !== 'chipped' && m.role !== 'kralice') {
      const faintLine = G.research.done.kitinAgi ? m.maxHp * c.faintBelow : 0;
      if (m.hp <= faintLine) { onDown(G, col, m); return; }
    }
    if (m.role === 'kralice' && m.hp <= 0) m.hp = 1; // kraliçe öldürülemez, yalnızca çiplenir

    // Hasar aldıysa ve yakında oyuncu varsa: koloni kızar
    if (m.hp < m.lastHp - 0.01 && m.state !== 'fainted') {
      const near = playerTargets(G).some((t) => { const p = posOf(t); return Game.dist(p.x, p.y, m.x, m.y) < c.aggroRadius + 2; });
      if (near && !isHostile(G, col)) {
        col.hostileUntil = G.time + c.hostileTime;
        Game.msg(G, `Koloni ${col.id} saldırıya uğradı ve karşılık veriyor!`, '#e74c3c');
      }
    }
    m.lastHp = m.hp;

    if (m.state === 'fainted') {
      if (!m.reserved) m.faintT -= dt;
      if (m.faintT <= 0) { m.state = 'wander'; m.hp = m.maxHp * 0.5; m.lastHp = m.hp; }
      return;
    }
    if (m.role === 'kralice') return; // yuvasından çıkmaz

    // Saldırı hedefi seç
    const hostile = isHostile(G, col);
    let target = null;
    const targets = playerTargets(G);
    if (hostile) {
      target = Game.nearest(targets, m.x, m.y, (t) => { const p = posOf(t); return Game.dist(p.x, p.y, m.x, m.y) < c.aggroRadius; });
    }
    if (!target && m.role === 'muhafiz') {
      // Yuvaya yaklaşan herkese saldırır
      const R = d.guardRadius + 2;
      target = Game.nearest(targets, m.x, m.y, (t) => {
        const p = posOf(t); return Game.dist(p.x, p.y, col.queen.x + 0.5, col.queen.y + 0.5) < R && !(t.kind === 'bilimci' && t.state === 'chip');
      });
    }
    m.state = target ? 'attack' : 'wander';
    m.attackTarget = target;

    if (target) {
      const p = posOf(target);
      const reach = d.range + (target.size ? target.size / 2 : 0);
      const dd = Game.dist(p.x, p.y, m.x, m.y);
      if (dd > reach) { m.dir = Math.atan2(p.y - m.y, p.x - m.x); Game.moveTo(m, p.x, p.y, d.speed * 1.3, dt); m.step += dt * 12; }
      else target.hp -= d.dps * dt;
      return;
    }

    // Dolaşma
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      const p = m.role === 'muhafiz' ? guardPoint(G, col) : roamPoint(G, col);
      m.tx = p.x; m.ty = p.y; m.wanderT = 3 + Math.random() * 5;
    }
    if (Game.dist(m.x, m.y, m.tx, m.ty) > 0.1) {
      m.dir = Math.atan2(m.ty - m.y, m.tx - m.x);
      Game.moveTo(m, m.tx, m.ty, d.speed * 0.6, dt);
      m.step += dt * 8;
    }
  }

  function updateColony(G, col, dt) {
    const c = cc(G);
    col.members.slice().forEach((m) => updateMember(G, col, m, dt));
    // Kraliçe zamanla yeni toplayıcı yumurtlar (eksik varsa)
    col.spawnT += dt;
    if (col.spawnT >= c.queenSpawnEvery) {
      col.spawnT = 0;
      if (col.captured) return;
      const tops = col.members.filter((m) => m.role === 'toplayici').length;
      const guards = col.members.filter((m) => m.role === 'muhafiz').length;
      const q = col.queen;
      if (guards < c.muhafiz.count) col.members.push(makeMember(G, col, 'muhafiz', q.x + 0.5, q.y + 1.5));
      else if (tops < c.toplayici.count) col.members.push(makeMember(G, col, 'toplayici', q.x - 1, q.y + 0.5));
    }
  }

  // ---------- Çizim ----------
  function drawBug(ctx, G, m, col) {
    const T = G.map.tile, px = m.x * T, py = m.y * T, colors = G.cfg.colors;
    const big = m.role === 'kralice' ? 2.1 : m.role === 'muhafiz' ? 1.25 : 1;
    const L = T * 0.32 * big, W = T * 0.2 * big;
    let fill = colors.bocekNotr;
    if (m.state === 'fainted') fill = '#7f8c8d';
    else if (isHostile(G, col) || m.state === 'attack') fill = colors.bocekDusman;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(m.role === 'kralice' ? 0 : m.dir);
    // bacaklar
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = m.role === 'kralice' ? 2 : 1.4;
    for (let i = -1; i <= 1; i++) {
      const sw = m.state === 'fainted' ? 0 : Math.sin(m.step + i) * 0.35;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(i * L * 0.45, 0);
        ctx.lineTo(i * L * 0.45 + (i + sw * side) * L * 0.25, side * (W + L * 0.55));
        ctx.stroke();
      }
    }
    // gövde: karın + baş
    ctx.fillStyle = fill; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-L * 0.15, 0, L * 0.75, W, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(L * 0.75, 0, W * 0.7, W * 0.65, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // kabuk çizgileri
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-L * 0.15 + k * L * 0.3, -W); ctx.lineTo(-L * 0.15 + k * L * 0.3, W); ctx.stroke(); }
    if (m.role === 'muhafiz') { // kıskaçlar
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L * 1.1, -W * 0.4); ctx.lineTo(L * 1.45, -W * 0.8); ctx.moveTo(L * 1.1, W * 0.4); ctx.lineTo(L * 1.45, W * 0.8); ctx.stroke();
    }
    ctx.restore();

    if (m.role === 'kralice') {
      ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('KRALİÇE ' + col.id, px, py - L - 8); ctx.textAlign = 'left';
    }
    if (m.state === 'fainted') {
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
      ctx.fillText('zzz', px + 6, py - 8 - Math.sin(G.time * 3) * 2);
    }
    if (m.reserved) {
      ctx.strokeStyle = '#2e86de'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(px, py, L + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (m.hp < m.maxHp && m.state !== 'fainted') {
      const bw = L * 2;
      ctx.fillStyle = '#300'; ctx.fillRect(px - bw / 2, py - L - 6, bw, 3);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(px - bw / 2, py - L - 6, bw * Math.max(0, m.hp / m.maxHp), 3);
    }
    const sel = G.ui.selected;
    if (sel && sel.type === 'member' && sel.member === m) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, L + 4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  Game.register({
    name: 'colonies',
    init(G) {
      const c = cc(G);
      c.list.forEach((def) => {
        const col = { id: def.id, queen: { x: def.queen.x, y: def.queen.y }, hostileUntil: 0, kills: 0, members: [], spawnT: 0, captured: false };
        col.members.push(makeMember(G, col, 'kralice', def.queen.x + 0.5, def.queen.y + 0.5));
        for (let i = 0; i < c.muhafiz.count; i++) { const p = guardPoint(G, col); col.members.push(makeMember(G, col, 'muhafiz', p.x, p.y)); }
        for (let i = 0; i < c.toplayici.count; i++) { const p = roamPoint(G, col); col.members.push(makeMember(G, col, 'toplayici', p.x, p.y)); }
        G.colonies.push(col);
      });
    },
    update(G, dt) {
      G.colonies.forEach((col) => updateColony(G, col, dt));
      // Seçili birey artık yoksa seçimi bırak
      const sel = G.ui.selected;
      if (sel && sel.type === 'member' && !G.colonies.some((c) => c.members.includes(sel.member))) G.ui.selected = null;
    },
    draw(ctx, G) {
      const T = G.map.tile, colors = G.cfg.colors;
      // yuvalar
      G.colonies.forEach((col) => {
        const px = (col.queen.x + 0.5) * T, py = (col.queen.y + 0.5) * T;
        ctx.fillStyle = colors.yuva;
        ctx.beginPath(); ctx.ellipse(px, py, T * 2.2, T * 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(79,163,224,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(231,76,60,0.25)'; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(px, py, (cc(G).muhafiz.guardRadius + 2) * T, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      });
      G.colonies.forEach((col) => col.members.forEach((m) => drawBug(ctx, G, m, col)));
      // çiplenmiş (oyuncuya geçmiş) böcekler: turuncu halka ile işaretle
      G.units.forEach((u) => {
        if (u.kind !== 'tasiyici' && u.kind !== 'savasci') return;
        ctx.strokeStyle = colors.bocekCipli; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(u.x * T, u.y * T, T * 0.42, 0, Math.PI * 2); ctx.stroke();
      });
    },
    onClick(G, info) {
      if (G.ui.buildMode || info.button !== 0) return false;
      let best = null, bd = 0.8;
      G.colonies.forEach((col) => col.members.forEach((m) => {
        const r = m.role === 'kralice' ? 1.3 : 0.8;
        const d = Game.dist(m.x, m.y, info.wx, info.wy);
        if (d < r && d < bd + (r - 0.8)) { bd = d; best = { m, col }; }
      }));
      if (!best) return false;
      const { m, col } = best;
      const already = G.ui.selected && G.ui.selected.type === 'member' && G.ui.selected.member === m;
      G.ui.selected = { type: 'member', member: m, colony: col };
      // Bayılmış bireye ya da kraliçeye ikinci tıklama: çiple (arayüzde düğme yoksa da çalışsın)
      if (already && (m.state === 'fainted' || m.role === 'kralice')) Colonies.tryChip(G, m);
      else if (m.state === 'fainted' && G.research.done.noroCip) Game.msg(G, 'Bayılmış birey: çiplemek için tekrar tıkla.', '#2e86de');
      return true;
    },
  });
})();
