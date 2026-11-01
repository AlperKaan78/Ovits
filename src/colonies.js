// ============================================================
// src/colonies.js  —  SAHİBİ: Kişi 2
// Eklem bacaklı koloniler: dolaşma, saldırılınca karşılık verme, av, Kitin,
// bayılma, nöro-çip ile yakalama ve kraliçe. Tasarım: GDD bölüm 8. Sözleşme: docs/CONTRACT.md
// ============================================================
// Koloni türleri (CONFIG.colonies.types):
//  - Taşkabuk: kalın kabuklu, yavaş, dayanıklı.
//  - Yaprakçı: hızlı, sarmaşığı yiyerek temizler (vahşiyken de, çiplenince de).
// Toplayıcılar küçük gruplar halinde gezer; canı azalınca yuvaya kaçar, yuvada iyileşir.
// Bir koloni çok avlanırsa (overHunt) öfkesi çok daha uzun sürer.
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
  const typeOf = (G, col) => cc(G).types[col.type];
  Colonies.colonyOf = (G, member) => G.colonies.find((c) => c.members.includes(member));
  Colonies.typeOf = (G, col) => typeOf(G, col);

  // Koloninin öfke süresi: aşırı avlanmış koloni çok daha uzun kızgın kalır
  const hostileTimeFor = (G, col) => cc(G).hostileTime * (col.overHunted ? cc(G).overHunt.hostileMul : 1);
  function anger(G, col) { col.hostileUntil = Math.max(col.hostileUntil, G.time + hostileTimeFor(G, col)); }

  function makeMember(G, col, role, x, y) {
    const d = role === 'kralice' ? cc(G).kralice : cc(G)[role];
    const hp = Math.round(d.hp * (role === 'kralice' ? 1 : typeOf(G, col).hpMul));
    const m = {
      id: Game.newId(), role, x, y, hp, maxHp: hp, lastHp: hp,
      state: 'wander', tx: x, ty: y, wanderT: Math.random() * 3, faintT: 0, reserved: false,
      dir: Math.random() * Math.PI * 2, step: Math.random() * 10, attackTarget: null, colonyId: col.id,
      eatT: 0,
    };
    if (role === 'toplayici') { // grup içindeki yeri
      m.group = col.nextGroup++ % cc(G).toplayici.groups;
      m.ox = (Math.random() - 0.5) * 2.4; m.oy = (Math.random() - 0.5) * 2.4;
    }
    return m;
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
    anger(G, col);
    col.members.forEach((m) => (m.hunted = false));
    member.hunted = true;
    // En yakın boştaki askerleri bu bireye yönlendir (city.js asker davranışı u.huntTarget'a bakar)
    const soldiers = G.units
      .filter((u) => u.owner === 'player' && (u.kind === 'asker' || u.kind === 'savasci') && u.hp > 0 && !u.post)
      .sort((a, b) => Game.dist(a.x, a.y, member.x, member.y) - Game.dist(b.x, b.y, member.x, member.y))
      .slice(0, cc(G).huntSoldiers);
    soldiers.forEach((s) => (s.huntTarget = member.id));
    Game.msg(G, soldiers.length
      ? `${soldiers.length} asker avlanmaya gidiyor. ${col.ad} kolonisi ${Math.round(hostileTimeFor(G, col))} sn boyunca saldırgan!`
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
      Game.msg(G, `KRALİÇE ÇİPLENDİ! ${col.ad} kolonisi artık senin.`, '#e67e22');
      G.over = 'win';
      return;
    }
    convert(G, col, member);
    Game.msg(G, (member.role === 'toplayici' ? `Bir ${col.ad} toplayıcısı çiplendi: artık taşıyıcın.` : `Bir ${col.ad} muhafızı çiplendi: artık savaşçın.`) +
      (typeOf(G, col).eatsVine ? ' Üstünden geçtiği sarmaşığı yer.' : ''), '#e67e22');
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
  function countKill(G, col) {
    G.res.kitin += 1; col.kills += 1;
    if (!col.overHunted && col.kills >= cc(G).overHunt.kills) {
      col.overHunted = true; anger(G, col);
      Game.msg(G, `${col.ad} kolonisi aşırı avlandı! Artık çok daha uzun süre öfkeli kalacak.`, '#e74c3c');
    }
  }

  function onDown(G, col, m) {
    // Can bitti ya da bayılma eşiğinin altına indi
    if (G.research.done.kitinAgi && m.role !== 'kralice') {
      m.state = 'fainted'; m.hp = Math.max(1, m.hp); m.faintT = cc(G).faintTime;
      m.hunted = false; m.attackTarget = null;
      countKill(G, col);
      Game.msg(G, `Bir birey bayıldı (+1 Kitin). ${G.research.done.noroCip ? 'Tıklayıp çipleyebilirsin.' : ''}`, '#9be7a1');
    } else {
      m.hp = 0;
      col.members = col.members.filter((x) => x !== m);
      countKill(G, col);
      Game.msg(G, '+1 Kitin. Bu koloniyi çiplemek artık daha kolay.', '#9be7a1');
    }
  }

  function updateMember(G, col, m, dt) {
    const c = cc(G);
    const d = m.role === 'kralice' ? c.kralice : c[m.role], typ = typeOf(G, col), speed = (d.speed || 0) * typ.speedMul;

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
        anger(G, col);
        Game.msg(G, `${col.ad} kolonisi saldırıya uğradı ve karşılık veriyor!`, '#e74c3c');
      }
    }
    m.lastHp = m.hp;

    if (m.state === 'fainted') {
      // Bayılmışken meteor ya da patlama hasarıyla ölebilir
      if (m.hp <= 0) { col.members = col.members.filter((x) => x !== m); return; }
      if (!m.reserved) m.faintT -= dt;
      if (m.faintT <= 0) { m.state = 'wander'; m.hp = m.maxHp * 0.5; m.lastHp = m.hp; }
      return;
    }
    if (m.role === 'kralice') return; // yuvasından çıkmaz

    // Yuvada iyileşme
    const qx = col.queen.x + 0.5, qy = col.queen.y + 0.5, atNest = Game.dist(m.x, m.y, qx, qy) < c.healRadius;
    if (atNest && m.state !== 'attack') m.hp = Math.min(m.maxHp, m.hp + c.healPerSec * dt);

    // Kaçma: canı azalan toplayıcı yuvaya koşar, iyileşince geri döner
    if (m.role === 'toplayici') {
      if (m.state !== 'flee' && m.hp < m.maxHp * c.toplayici.fleeBelow) m.state = 'flee';
      if (m.state === 'flee') {
        if (m.hp >= m.maxHp * 0.9) m.state = 'wander';
        else {
          if (!atNest) { m.dir = Math.atan2(qy - m.y, qx - m.x); Game.moveTo(m, qx, qy, speed * 1.25, dt); m.step += dt * 14; }
          m.lastHp = m.hp;
          return;
        }
      }
    }

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
      if (dd > reach) { m.dir = Math.atan2(p.y - m.y, p.x - m.x); Game.moveTo(m, p.x, p.y, speed * 1.3, dt); m.step += dt * 12; }
      else target.hp -= d.dps * dt;
      return;
    }

    // Dolaşma: muhafızlar yuva çevresinde, toplayıcılar grubunun hedef noktası çevresinde
    if (m.role === 'muhafiz') {
      m.wanderT -= dt;
      if (m.wanderT <= 0) { const p = guardPoint(G, col); m.tx = p.x; m.ty = p.y; m.wanderT = 3 + Math.random() * 5; }
    } else {
      const gp = col.groups[m.group];
      m.tx = Math.max(0.5, Math.min(G.map.w - 0.5, gp.x + m.ox)); m.ty = Math.max(0.5, Math.min(G.map.h - 0.5, gp.y + m.oy));
    }
    if (Game.dist(m.x, m.y, m.tx, m.ty) > 0.1) {
      m.dir = Math.atan2(m.ty - m.y, m.tx - m.x);
      Game.moveTo(m, m.tx, m.ty, speed * 0.6, dt);
      m.step += dt * 8;
    } else if (typ.eatsVine) eatVine(G, m, typ, dt);
    else m.dir += Math.sin(G.time * 2 + m.id) * dt; // dururken etrafı koklar
  }

  // Yaprakçı: durduğu karedeki sarmaşığı yavaşça yer
  function eatVine(G, e, typ, dt) {
    if (!(window.Vines && Vines.has && Vines.clear)) return;
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    if (!Vines.has(G, tx, ty)) { e.eatT = 0; return; }
    e.eatT = (e.eatT || 0) + dt;
    e.step = (e.step || 0) + dt * 3;
    if (e.eatT >= typ.eatTime) { e.eatT = 0; Vines.clear(G, tx, ty); }
  }

  function updateColony(G, col, dt) {
    const c = cc(G);
    // Toplayıcı gruplarının ortak hedefi; Yaprakçılar sarmaşıklı karelere yönelmeyi sever
    col.groups.forEach((gp) => {
      gp.t -= dt;
      if (gp.t > 0) return;
      let p = roamPoint(G, col);
      if (typeOf(G, col).eatsVine && window.Vines && Vines.has) {
        for (let k = 0; k < 6 && !Vines.has(G, Math.floor(p.x), Math.floor(p.y)); k++) p = roamPoint(G, col);
      }
      gp.x = p.x; gp.y = p.y; gp.t = c.toplayici.groupMove * (0.7 + Math.random() * 0.6);
    });
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
  // Renk tonu açma/koyulaştırma: amt > 0 açar, < 0 koyulaştırır
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  // Altı bacaklı eklem bacaklı. o: { x, y, dir, step, role, fill, fainted, attacking }
  function drawBugBody(ctx, G, o) {
    const T = G.map.tile, colors = G.cfg.colors, px = o.x * T, py = o.y * T;
    const big = o.role === 'kralice' ? 2.2 : o.role === 'muhafiz' ? 1.3 : 1;
    const L = T * 0.3 * big, W = T * 0.19 * big;
    const queen = o.role === 'kralice', breathe = queen ? 1 + Math.sin(G.time * 1.5) * 0.04 : 1;
    const abX = -L * 0.35 - (queen ? L * 0.3 : 0);

    // gölge
    ctx.fillStyle = colors.golge;
    ctx.beginPath(); ctx.ellipse(px + 2, py + 3, L * 1.3, W * 1.25, o.dir, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(o.dir);
    if (o.fainted) ctx.scale(1, -1); // bayılınca sırtüstü

    // bacaklar: iki eklemli, yürürken üçlü yürüyüşle salınır
    ctx.strokeStyle = colors.bocekBacak; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, big);
    for (let i = -1; i <= 1; i++) {
      for (const side of [-1, 1]) {
        const phase = (i + 1 + (side > 0 ? 1 : 0)) % 2 === 0 ? 0 : Math.PI;
        const sw = o.fainted ? Math.sin(G.time * 9 + i) * 0.12 : Math.sin(o.step + phase) * 0.45;
        const hx = i * L * 0.32, hy = side * W * 0.5;                             // kalça
        const kx = hx + (i * 0.35 + sw) * L * 0.45, ky = side * (W + L * 0.35);  // diz
        const fx = kx + (i * 0.6 + sw) * L * 0.35, fy = ky + side * L * (o.fainted ? 0.05 : 0.3); // ayak
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }
    }

    // karın (arka)
    const base = o.fill;
    const abL = (queen ? L * 1.05 : L * 0.72) * breathe, abW = (queen ? W * 1.25 : W) * breathe;
    const ab = ctx.createRadialGradient(abX - abL * 0.2, -abW * 0.45, 1, abX, 0, abL * 1.1);
    ab.addColorStop(0, shade(base, 0.45)); ab.addColorStop(0.55, base); ab.addColorStop(1, shade(base, -0.45));
    ctx.fillStyle = ab; ctx.strokeStyle = shade(base, -0.65); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(abX, 0, abL, abW, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // karın halkaları
    ctx.strokeStyle = shade(base, -0.4); ctx.lineWidth = queen ? 1.6 : 1;
    const segs = queen ? 5 : 3;
    for (let k = 1; k <= segs; k++) {
      const rel = -1 + (2 * k) / (segs + 1), sx = abX + rel * abL, hh = abW * Math.sqrt(1 - rel * rel);
      ctx.beginPath(); ctx.moveTo(sx, -hh * 0.92); ctx.quadraticCurveTo(sx + abL * 0.12, 0, sx, hh * 0.92); ctx.stroke();
    }
    // göğüs
    const th = ctx.createRadialGradient(L * 0.25, -W * 0.3, 1, L * 0.3, 0, W * 0.9);
    th.addColorStop(0, shade(base, 0.35)); th.addColorStop(1, shade(base, -0.35));
    ctx.fillStyle = th; ctx.strokeStyle = shade(base, -0.65); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(L * 0.3, 0, W * 0.75, W * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (o.role === 'muhafiz') { // zırh plakası
      ctx.fillStyle = shade(base, -0.3);
      ctx.beginPath(); ctx.ellipse(L * 0.3, 0, W * 0.45, W * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    // baş
    ctx.fillStyle = shade(base, -0.2);
    ctx.beginPath(); ctx.ellipse(L * 0.85, 0, W * 0.55, W * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // gözler
    ctx.fillStyle = o.fainted ? shade(base, -0.5) : '#111';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(L * 1.0, s * W * 0.28, Math.max(1.2, W * 0.16), 0, Math.PI * 2); ctx.fill(); }
    if (!o.fainted) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(L * 1.02, s * W * 0.28 - 0.6, Math.max(0.5, W * 0.06), 0, Math.PI * 2); ctx.fill(); }
    }
    // duyargalar (kıpırdar)
    ctx.strokeStyle = colors.bocekBacak; ctx.lineWidth = 1;
    for (const s of [-1, 1]) {
      const wig = o.fainted ? 0 : Math.sin(G.time * 5 + s + o.step * 0.3) * W * 0.3;
      ctx.beginPath(); ctx.moveTo(L * 1.1, s * W * 0.2);
      ctx.quadraticCurveTo(L * 1.45, s * W * 0.9 + wig, L * 1.75, s * W * 0.7 + wig); ctx.stroke();
    }
    // muhafız kıskaçları (saldırırken açılıp kapanır)
    if (o.role === 'muhafiz') {
      const open = o.attacking ? 0.35 + Math.abs(Math.sin(G.time * 10)) * 0.4 : 0.35;
      ctx.strokeStyle = shade(base, -0.6); ctx.lineWidth = 2.2;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(L * 1.2, s * W * 0.25);
        ctx.quadraticCurveTo(L * 1.55, s * W * (0.4 + open), L * 1.7, s * W * 0.05); ctx.stroke();
      }
    }
    ctx.restore();
    return L;
  }

  function hpBar(ctx, x, y, w, frac, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 3);
  }

  function drawBug(ctx, G, m, col) {
    const T = G.map.tile, colors = G.cfg.colors, px = m.x * T, py = m.y * T;
    const hostile = isHostile(G, col) || m.state === 'attack';
    const fill = m.state === 'fainted' ? colors.bocekBayilmis : hostile ? colors.bocekDusman : typeOf(G, col).color;
    const L = drawBugBody(ctx, G, {
      x: m.x, y: m.y, dir: m.role === 'kralice' ? -Math.PI / 2 : m.dir, step: m.step, role: m.role,
      fill, fainted: m.state === 'fainted', attacking: m.state === 'attack',
    });

    if (m.role === 'kralice') {
      ctx.fillStyle = colors.kraliceEtiket; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('♛ ' + col.ad + ' Kraliçesi', px, py - L * 1.6 - 6); ctx.textAlign = 'left';
    }
    if (m.state === 'fainted') {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
      for (let k = 0; k < 3; k++) {
        const f = (G.time * 0.8 + k / 3) % 1;
        ctx.globalAlpha = 1 - f; ctx.fillText('z', px + 6 + f * 8, py - 6 - f * 14);
      }
      ctx.globalAlpha = 1;
      if (!m.reserved) hpBar(ctx, px - 10, py + L + 6, 20, m.faintT / cc(G).faintTime, colors.bocekBayilmis);
    } else if (m.state === 'attack') {
      ctx.fillStyle = colors.bocekDusman; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', px, py - L - 9 - Math.abs(Math.sin(G.time * 6)) * 3); ctx.textAlign = 'left';
    }
    if (m.hunted) { // av hedefi: kırmızı nişangâh
      ctx.strokeStyle = colors.bocekDusman; ctx.lineWidth = 1.5; const r = L + 7;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * (r - 4), py + Math.sin(a) * (r - 4)); ctx.lineTo(px + Math.cos(a) * (r + 4), py + Math.sin(a) * (r + 4)); ctx.stroke();
      }
    }
    if (m.reserved) { // bilimci çip takıyor
      ctx.strokeStyle = colors.arastirma; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -G.time * 15;
      ctx.beginPath(); ctx.arc(px, py, L + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (m.hp < m.maxHp && m.state !== 'fainted') {
      const bw = Math.max(18, L * 2);
      hpBar(ctx, px - bw / 2, py - L - 6, bw, m.hp / m.maxHp, colors.bocekDusman);
    }
    const sel = G.ui.selected;
    if (sel && sel.type === 'member' && sel.member === m) {
      ctx.strokeStyle = colors.secim; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = G.time * 10;
      ctx.beginPath(); ctx.arc(px, py, L + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // Yuva: toprak tümsek, tüneller, kraliçenin çevresinde yumurtalar
  function drawNest(ctx, G, col) {
    const T = G.map.tile, colors = G.cfg.colors, c = cc(G);
    const px = (col.queen.x + 0.5) * T, py = (col.queen.y + 0.5) * T, rx = T * 2.4, ry = T * 1.8;
    const grd = ctx.createRadialGradient(px - rx * 0.2, py - ry * 0.3, T * 0.3, px, py, rx);
    grd.addColorStop(0, shade(colors.yuvaToprak, 0.25)); grd.addColorStop(0.7, colors.yuvaToprak); grd.addColorStop(1, colors.yuva);
    ctx.fillStyle = grd;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) { // düzensiz kenar
      const a = (k / 24) * Math.PI * 2, j = 1 + Math.sin(a * 5 + col.queen.x) * 0.06 + Math.sin(a * 3) * 0.05;
      const x = px + Math.cos(a) * rx * j, y = py + Math.sin(a) * ry * j;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = colors.yuvaKenar; ctx.lineWidth = 2; ctx.stroke();
    // tünel ağızları
    ctx.fillStyle = colors.yuvaDelik;
    [[-1.5, -0.6], [1.6, 0.4], [-0.9, 1.1], [1.0, -1.0]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.ellipse(px + dx * T, py + dy * T, T * 0.28, T * 0.18, dx, 0, Math.PI * 2); ctx.fill();
    });
    // yumurtalar
    if (!col.captured) {
      ctx.fillStyle = colors.koloniYumurta;
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + 0.4, r = T * (0.95 + (k % 3) * 0.18);
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(G.time * 2 + k);
        ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.75, 3.2, 4.2, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // muhafız bölgesi: yalnızca koloni saldırganken ya da fare yakındayken görünür
    const m = G.ui.mouse, R = (c.muhafiz.guardRadius + 2) * T;
    const near = Game.dist(m.wx, m.wy, col.queen.x + 0.5, col.queen.y + 0.5) < c.muhafiz.guardRadius + 4;
    if (isHostile(G, col) || near) {
      ctx.strokeStyle = colors.bocekDusman; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = G.time * 8;
      ctx.globalAlpha = isHostile(G, col) ? 0.5 + 0.3 * Math.sin(G.time * 5) : 0.35;
      ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  // Çiplenmiş (oyuncuya geçmiş) böcekler: city.js'in çizdiği dairenin üstüne böcek olarak çizilir
  function drawChipped(ctx, G, u) {
    const T = G.map.tile, colors = G.cfg.colors;
    if (u._lx == null) { u._lx = u.x; u._ly = u.y; u._dir = 0; u._step = 0; }
    const dx = u.x - u._lx, dy = u.y - u._ly, moved = Math.hypot(dx, dy);
    if (moved > 0.001) { u._dir = Math.atan2(dy, dx); u._step += moved * 9; }
    u._lx = u.x; u._ly = u.y;
    const L = drawBugBody(ctx, G, {
      x: u.x, y: u.y, dir: u._dir, step: u._step, role: u.kind === 'savasci' ? 'muhafiz' : 'toplayici',
      fill: u.kind === 'savasci' ? colors.savasci : colors.tasiyici,
    });
    if (u.eatT > 0) { // yemek yerken küçük yaprak kırıntıları
      ctx.fillStyle = colors.vineLeaf;
      for (let k = 0; k < 3; k++) { const a = G.time * 4 + k * 2.1; ctx.fillRect(u.x * T + Math.cos(a) * L, u.y * T + Math.sin(a) * L, 2, 2); }
    }
    // sırtındaki çip ışığı
    ctx.fillStyle = colors.arastirma; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.time * 6 + u.id);
    ctx.beginPath(); ctx.arc(u.x * T, u.y * T, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (u.hp < u.maxHp) hpBar(ctx, u.x * T - 10, u.y * T - L - 6, 20, u.hp / u.maxHp, '#4caf50');
  }

  Game.register({
    name: 'colonies',
    init(G) {
      const c = cc(G);
      c.list.forEach((def) => {
        const typ = c.types[def.type];
        const col = {
          id: def.id, type: def.type, ad: typ.ad, queen: { x: def.queen.x, y: def.queen.y },
          hostileUntil: 0, kills: 0, overHunted: false, members: [], spawnT: 0, captured: false, nextGroup: 0, groups: [],
        };
        for (let g = 0; g < c.toplayici.groups; g++) { const p = roamPoint(G, col); col.groups.push({ x: p.x, y: p.y, t: Math.random() * c.toplayici.groupMove }); }
        col.members.push(makeMember(G, col, 'kralice', def.queen.x + 0.5, def.queen.y + 0.5));
        for (let i = 0; i < c.muhafiz.count; i++) { const p = guardPoint(G, col); col.members.push(makeMember(G, col, 'muhafiz', p.x, p.y)); }
        for (let i = 0; i < c.toplayici.count; i++) {
          const m = makeMember(G, col, 'toplayici', 0, 0), gp = col.groups[m.group];
          m.x = gp.x + m.ox; m.y = gp.y + m.oy; col.members.push(m);
        }
        G.colonies.push(col);
      });
    },
    update(G, dt) {
      G.colonies.forEach((col) => updateColony(G, col, dt));
      // Çiplenmiş Yaprakçılar da üstünden geçtikleri sarmaşığı yer
      G.units.forEach((u) => {
        if (!u.fromColony || u.hp <= 0) return;
        const col = G.colonies.find((cl) => cl.id === u.fromColony);
        if (col && typeOf(G, col).eatsVine) eatVine(G, u, typeOf(G, col), dt);
      });
      // Seçili birey artık yoksa seçimi bırak
      const sel = G.ui.selected;
      if (sel && sel.type === 'member' && !G.colonies.some((c) => c.members.includes(sel.member))) G.ui.selected = null;
    },
    draw(ctx, G) {
      G.colonies.forEach((col) => drawNest(ctx, G, col));
      G.colonies.forEach((col) => col.members.forEach((m) => drawBug(ctx, G, m, col)));
      G.units.forEach((u) => { if (u.kind === 'tasiyici' || u.kind === 'savasci') drawChipped(ctx, G, u); });
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
