// ============================================================
// src/city.js  —  SAHİBİ: Kişi 1
// Binalar (kurma, üretim, taret), yumurta -> yavru -> kişilik,
// İşçi / Asker / Bilimci davranışları, karakol, asker bakımı.
// Tasarım: GDD bölüm 5 (karakol), 6 (şehir ve halk). Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [x] Kurma modu: G.ui.buildMode = 'ev' iken haritaya tıklayınca Game.isFree + Game.pay ile kur
//     (Çekim Kulesi Merkez'e minDistFromMerkez'den yakın olamaz; geçerli yer yeşil, değilse kırmızı önizleme)
//     Sağ tık kurma modunu kapatır. Arayüz yokken test: E ev, O ocak, K kule, R karakol, T taret, L laboratuvar
// [x] Merkez ve Taş Ocağı Taş üretir (tasPerSec)
// [x] Ev: eggEvery saniyede bir yanına 'yumurta' birimi (en fazla maxEggs bekleyen; beslenmemiş yavrular da sayılır)
// [x] Yumurta hatchTime sonra 'yavru' olur; yavruya tıklanınca G.ui.selected = yavru (panel ui.js'de)
//     City.feed(G, yavru, 'isci'|'asker'|'bilimci') -> maliyeti öde, growTime sonra yetişkin olur
//     Arayüz yokken test: yavru seçiliyken Z işçi, X asker, C bilimci
// [x] İşçi: en yakın sahipsiz kristali (G.crystals) alır, Merkez'e götürür, Öz ekler
// [x] Asker: en yakın düşmana (G.enemies, düşman koloni bireyleri) menzilde ateş eder; boştaysa Merkez yanında bekler
// [x] Karakol: City.sendSoldier(G, karakol) -> boştaki en yakın asker gider; bakım dakikada 1 / karakolda 2 Öz
//     Arayüz yokken test: karakol seçiliyken G
// [x] Taret: menzildeki en yakın düşmana dps hasar
// [x] İşçi taşırken u.carrying = kristal (akıncılar bunu hedefler), boşken null
// [x] Bilimci: Laboratuvar varsa oraya gider ve u.state = 'lab' olur (research.js hızlandırmayı sayar);
//     City.orderChip(G, member) ile çip takmaya gider, süre dolunca Colonies.chipDone(G, member) çağırır
//
// [x] AoE tarzı emirler: seçili birimlerle sağ tık -> yürü / saldır / avla / kristal topla / inşa et / buda / karakola gir / çiple
//     u.order = { type: 'move'|'attack'|'gather'|'build'|'prune'|'post', ... }; emir bitince birim kendi işine döner.
//     Yürüme emri sonrası u.anchor = varılan nokta: asker orayı korur, işçi oradaki kristalleri toplar.
// [x] İnşaat: City.build temel atar (b.built = false); seçili ya da en yakın işçiler gelip buildTime saniyede kurar.
//     Kurulmamış bina üretmez, ateş etmez (City.isBuilt(b)).
//
// Seçim: sol tık / kutu seçimi -> G.ui.selection (birimler), G.ui.selected (ilk birim ya da tek bina).
// Kristal alanları: carriedBy = taşıyan birimin id'si; claimedBy = kristale yürüyen işçinin id'si (henüz almadı).
// City.guardedAt(G, x, y): içinde asker olan bir karakolun guardRadius'u içindeyse true (akıncılar için).
(function () {
  const City = (window.City = {});
  const BUILD_KEYS = { e: 'ev', o: 'ocak', k: 'kule', r: 'karakol', t: 'taret', l: 'lab' };
  const FOOD_KEYS = { z: 'isci', x: 'asker', c: 'bilimci' };
  let shots = [], popups = [], chipJobs = [], marks = [];
  let weakWarned = false, firstYavru = true;

  const isCarrier = (u) => u.kind === 'isci' || u.kind === 'tasiyici';
  const isFighter = (u) => u.kind === 'asker' || u.kind === 'savasci';
  const unitName = (G, kind) => (G.cfg.population.foods[kind] ? G.cfg.population.foods[kind].ad : kind);

  City.unitCenter = (u) => ({ x: u.x, y: u.y });
  City.isBuilt = (b) => b && b.built !== false;
  City.isSelected = (G, e) => G.ui.selected === e || G.ui.selection.includes(e);
  City.idleWorkers = (G) => G.units.filter((u) => u.owner === 'player' && u.hp > 0 && isCarrier(u) && u.state === 'idle' && !u.order);
  City.unfedYavrus = (G) => G.units.filter((u) => u.kind === 'yavru' && u.hp > 0 && !u.food).sort((a, b) => a.id - b.id);
  City.count = (G, kind) => G.units.filter((u) => u.owner === 'player' && u.hp > 0 && u.kind === kind).length;

  // ---------- Bina kurma ----------
  // Kurulacak binanın sol üst karesi: fare binanın ortasında olsun
  City.placeAt = function (G, type) {
    const s = G.cfg.buildings[type].size, m = G.ui.mouse;
    return { x: Math.floor(m.wx - s / 2 + 0.5), y: Math.floor(m.wy - s / 2 + 0.5) };
  };

  // { ok, reason }
  City.canPlace = function (G, type, x, y) {
    const d = G.cfg.buildings[type];
    if (!d || type === 'merkez') return { ok: false, reason: 'Bu bina kurulamaz.' };
    if (!Game.isFree(G, x, y, d.size)) return { ok: false, reason: 'Burası dolu.' };
    for (let yy = y; yy < y + d.size; yy++) for (let xx = x; xx < x + d.size; xx++) {
      if (window.Vines && Vines.has && Vines.has(G, xx, yy)) return { ok: false, reason: 'Burada sarmaşık var, önce buda.' };
    }
    const mk = Game.merkez(G);
    if (d.minDistFromMerkez && mk) {
      const c = Game.center(mk);
      if (Game.dist(c.x, c.y, x + d.size / 2, y + d.size / 2) < d.minDistFromMerkez) {
        return { ok: false, reason: `${d.ad} Merkez'e en az ${d.minDistFromMerkez} kare uzak olmalı.` };
      }
    }
    if (!Game.canAfford(G, d.cost)) return { ok: false, reason: `${d.ad}: ${Game.costText(d.cost)} gerekli.` };
    return { ok: true };
  };

  // Temel atar; seçili işçiler (yoksa en yakın boştakiler) gelip kurar
  City.build = function (G, type, x, y) {
    const c = City.canPlace(G, type, x, y);
    if (!c.ok) { Game.msg(G, c.reason, '#e67e22'); return null; }
    const d = G.cfg.buildings[type];
    Game.pay(G, d.cost);
    const b = Game.addBuilding(G, type, x, y);
    b.built = false; b.progress = 0; b.hp = Math.max(1, b.maxHp * 0.1);
    let builders = G.ui.selection.filter((u) => isCarrier(u) && u.hp > 0);
    if (!builders.length) {
      const bc = Game.center(b);
      builders = G.units.filter((u) => u.owner === 'player' && u.hp > 0 && isCarrier(u) && !u.carrying && (!u.order || u.order.type !== 'build'))
        .sort((a, c2) => Game.dist(a.x, a.y, bc.x, bc.y) - Game.dist(c2.x, c2.y, bc.x, bc.y)).slice(0, G.cfg.population.autoBuilders);
    }
    builders.forEach((u) => (u.order = { type: 'build', b }));
    Game.msg(G, builders.length ? `${d.ad} temeli atıldı, ${builders.length} işçi kuruyor.` : `${d.ad} temeli atıldı. Kurması için işçi gönder (işçi seç, binaya sağ tık).`, '#9be7a1');
    return b;
  };

  function finishBuilding(G, b) {
    const d = G.cfg.buildings[b.type];
    b.built = true; b.progress = d.buildTime;
    Game.msg(G, `${d.ad} tamamlandı.`, '#9be7a1');
    if (b.type === 'kule') Game.msg(G, `Kule her dalgada ${d.ozPerWave} Öz yakar ve meteorların bir kısmını çevresine çeker.`, '#9be7a1');
    if (b.type === 'karakol') Game.msg(G, 'Askerleri karakola göndermek için asker seç ve karakola sağ tıkla.', '#9be7a1');
  }

  // Ev ya da Merkez panelindeki "yetiştir" düğmeleri: bekleyen en eski yavruyu besler
  City.feedNext = function (G, tip) {
    const y = City.unfedYavrus(G)[0];
    if (!y) { Game.msg(G, 'Besin bekleyen yavru yok. Evler yumurtluyor, biraz bekle ya da yeni Ev kur.', '#e67e22'); return false; }
    return City.feed(G, y, tip);
  };

  // ---------- Halk ----------
  function spotNear(b) {
    const c = Game.center(b), a = Math.random() * Math.PI * 2, r = b.size / 2 + 0.5 + Math.random() * 0.6;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  }
  // Birime özgü sabit bir bekleme noktası (üst üste yığılmasınlar)
  function slotAround(c, id, r) {
    const a = id * 2.399;
    const rr = r + (id % 3) * 0.45;
    return { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr };
  }

  function updateHouse(G, b, dt) {
    const d = G.cfg.buildings.ev;
    b.data.eggT = (b.data.eggT || 0) + dt;
    if (b.data.eggT < d.eggEvery) return;
    b.data.eggT = 0;
    const waiting = G.units.filter((u) => u.home === b.id && (u.kind === 'yumurta' || (u.kind === 'yavru' && !u.food))).length;
    if (waiting >= d.maxEggs) return;
    const p = spotNear(b);
    Game.addUnit(G, { kind: 'yumurta', owner: 'player', x: p.x, y: p.y, hp: G.cfg.population.eggHp, home: b.id, t: G.cfg.population.hatchTime });
  }

  function updateEgg(G, u, dt) {
    u.t -= dt;
    if (u.t > 0) return;
    u.kind = 'yavru'; u.food = null;
    u.hp = u.maxHp = G.cfg.population.yavruHp;
    if (firstYavru) {
      firstYavru = false;
      Game.msg(G, 'İlk yavru çıktı! Yavruya tıkla ve besin seç: Taş → İşçi, Öz → Asker, Öz + Taş → Bilimci.', '#f2c14e');
    }
  }

  function updateYavru(G, u, dt) {
    if (u.food) {
      u.grow -= dt;
      if (u.grow <= 0) {
        const kind = u.food, d = G.cfg.units[kind];
        u.kind = kind; u.hp = u.maxHp = d.hp; u.state = 'idle'; u.carrying = null;
        delete u.food; delete u.grow; delete u.growMax;
        Game.msg(G, `Yeni bir ${unitName(G, kind)} yetişti.`, '#9be7a1');
      }
      return;
    }
    // Beslenmeyi beklerken evinin yanında hafifçe dolaşır
    u.wT = (u.wT || 0) - dt;
    if (u.wT <= 0) {
      const home = G.buildings.find((b) => b.id === u.home) || Game.merkez(G);
      u.goal = spotNear(home); u.wT = 2 + Math.random() * 3;
    }
    if (u.goal) Game.moveTo(u, u.goal.x, u.goal.y, 0.4, dt);
  }

  City.feed = function (G, yavru, tip) {
    const f = G.cfg.population.foods[tip];
    if (!f || !yavru || yavru.kind !== 'yavru' || yavru.hp <= 0) return false;
    if (yavru.food) { Game.msg(G, 'Bu yavru zaten büyüyor.', '#e67e22'); return false; }
    if (!Game.pay(G, f.cost)) { Game.msg(G, `${f.ad} besini için ${Game.costText(f.cost)} gerekli.`, '#e67e22'); return false; }
    yavru.food = tip; yavru.grow = yavru.growMax = G.cfg.population.growTime;
    Game.msg(G, `Yavru ${f.ad} olarak büyüyor (${yavru.grow} sn).`, '#9be7a1');
    return true;
  };

  // ---------- Tehlikeden kaçınma ----------
  // Birkaç saniye içinde düşecek bir meteorun vuruş alanında mı?
  function threat(G, x, y) {
    const m = G.cfg.meteors;
    for (const me of G.meteors) {
      if (me.t > m.focusTime + 2) continue;
      if (Game.dist(me.x, me.y, x, y) <= m.types[me.type].radius + 0.8) return me;
    }
    return null;
  }
  // Kraliçe yuvasının yakını: muhafızlar oraya gelen herkese saldırır
  function nearNest(G, x, y) {
    const r = G.cfg.colonies.muhafiz.guardRadius + 3;
    return G.colonies.some((col) => !col.captured && Game.dist(col.queen.x + 0.5, col.queen.y + 0.5, x, y) < r);
  }
  function flee(G, u, dt) {
    const me = threat(G, u.x, u.y);
    if (!me) return false;
    const r = G.cfg.meteors.types[me.type].radius + 1.2, sp = (G.cfg.units[u.kind] || G.cfg.units.isci).speed;
    let dx = u.x - me.x, dy = u.y - me.y, d = Math.hypot(dx, dy);
    if (d < 0.01) { dx = 1; dy = 0; d = 1; }
    Game.moveTo(u, me.x + (dx / d) * r, me.y + (dy / d) * r, sp, dt);
    if (u.carrying) { u.carrying.x = u.x; u.carrying.y = u.y; }
    return true;
  }

  // ---------- İşçi ve taşıyıcı: kristali Merkez'e taşır ----------
  function idleNear(G, u, c, r, speed, dt) {
    const s = slotAround(c, u.id, r);
    if (Game.dist(u.x, u.y, s.x, s.y) > 0.05) Game.moveTo(u, s.x, s.y, speed * 0.6, dt);
  }

  // Yürüme emri: varınca emir biter, varılan nokta birimin yeni "yeri" olur
  function doMove(G, u, sp, dt) {
    const o = u.order;
    u.state = 'move'; u.face = Math.atan2(o.y - u.y, o.x - u.x);
    if (Game.moveTo(u, o.x, o.y, sp, dt)) { u.anchor = { x: o.x, y: o.y }; u.order = null; u.state = 'idle'; }
    if (u.carrying) { u.carrying.x = u.x; u.carrying.y = u.y; }
  }

  // İşçi emirleri: inşa et, buda, belirli kristali topla, yürü. true dönerse bu kare emirle geçti.
  function workerOrder(G, u, dt, sp) {
    const o = u.order;
    if (!o) return false;
    if (o.type === 'move') { doMove(G, u, sp, dt); return true; }
    if (o.type === 'build') {
      const b = o.b;
      if (!G.buildings.includes(b) || b.hp <= 0 || City.isBuilt(b)) { u.order = null; return false; }
      const c = Game.center(b);
      if (Game.dist(u.x, u.y, c.x, c.y) > b.size / 2 + 0.75) { u.state = 'toBuild'; Game.moveTo(u, c.x, c.y, sp, dt); return true; }
      const d = G.cfg.buildings[b.type];
      u.state = 'build'; u.step = (u.step || 0) + dt * 10;
      b.progress += dt;
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * dt) / d.buildTime);
      if (b.progress >= d.buildTime) finishBuilding(G, b);
      return true;
    }
    if (o.type === 'prune') {
      if (!(window.Vines && Vines.has && Vines.has(G, o.tx, o.ty))) { u.order = null; return false; }
      const tx = o.tx + 0.5, ty = o.ty + 0.5;
      if (Game.dist(u.x, u.y, tx, ty) > 0.9) { u.state = 'toPrune'; Game.moveTo(u, tx, ty, sp, dt); return true; }
      u.state = 'prune'; o.t = (o.t || 0) + dt; u.step = (u.step || 0) + dt * 10;
      if (o.t >= G.cfg.vines.workerPruneTime) {
        const ok = Vines.prune(G, o.tx, o.ty, { worker: true });
        o.t = 0;
        // bitişikteki bir sonraki sarmaşık karesine geç (AoE'deki gibi işçi işini sürdürür)
        const next = ok && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ tx: o.tx + dx, ty: o.ty + dy }))
          .find((p) => Vines.has(G, p.tx, p.ty) && !(Vines.isRoot && Vines.isRoot(G, p.tx, p.ty)) && Game.dist(p.tx, p.ty, o.ox, o.oy) <= G.cfg.vines.workerPruneArea);
        if (next) { o.tx = next.tx; o.ty = next.ty; } else u.order = null;
      }
      return true;
    }
    if (o.type === 'gather') {
      const cr = o.crystal;
      if (u.carrying || !G.crystals.includes(cr) || (cr.carriedBy && cr.carriedBy !== u.id)) { u.order = null; return false; }
      if (u.target && u.target !== cr && u.target.claimedBy === u.id) u.target.claimedBy = null;
      u.target = cr; cr.claimedBy = u.id;
      u.anchor = { x: cr.x, y: cr.y }; // toplama bitince bu bölgede çalışmaya devam eder
      u.order = null;
      return false;
    }
    u.order = null;
    return false;
  }

  function updateCarrier(G, u, dt, mk) {
    const sp = G.cfg.units.isci.speed * (u.kind === 'tasiyici' ? G.cfg.colonies.tasiyiciSpeedMul : 1);
    const mc = Game.center(mk);
    if (workerOrder(G, u, dt, sp)) return;
    if (u.carrying) {
      const cr = u.carrying;
      if (!G.crystals.includes(cr) || cr.carriedBy !== u.id) { u.carrying = null; u.state = 'idle'; return; } // çalındı ya da düştü
      u.state = 'carry';
      Game.moveTo(u, mc.x, mc.y, sp, dt);
      cr.x = u.x; cr.y = u.y;
      if (Game.dist(u.x, u.y, mc.x, mc.y) <= mk.size / 2 + 0.3) {
        G.crystals.splice(G.crystals.indexOf(cr), 1);
        Game.gain(G, { oz: cr.oz });
        popups.push({ x: mc.x, y: mk.y - 0.2, text: '+' + cr.oz + ' Öz', age: 0 });
        u.carrying = null; u.state = 'idle';
      }
      return;
    }
    let cr = u.target;
    if (!cr || !G.crystals.includes(cr) || cr.carriedBy || cr.claimedBy !== u.id || threat(G, cr.x, cr.y)) {
      if (cr && cr.claimedBy === u.id) cr.claimedBy = null;
      // Bir yere gönderilmiş işçi önce o bölgedeki kristallere bakar, yoksa en yakın kristale gider
      const ok = (k) => !k.carriedBy && !k.claimedBy && !threat(G, k.x, k.y) && !nearNest(G, k.x, k.y);
      const a = u.anchor, R = G.cfg.units.isci.gatherRadius;
      cr = (a && Game.nearest(G.crystals, a.x, a.y, (k) => ok(k) && Game.dist(k.x, k.y, a.x, a.y) <= R)) || Game.nearest(G.crystals, u.x, u.y, ok);
      u.target = cr;
      if (cr) cr.claimedBy = u.id;
    }
    if (cr) {
      u.state = 'toCrystal';
      if (Game.moveTo(u, cr.x, cr.y, sp, dt)) {
        cr.carriedBy = u.id; cr.claimedBy = null;
        u.carrying = cr; u.target = null; u.state = 'carry';
      }
      return;
    }
    u.state = 'idle';
    if (u.anchor) { if (Game.dist(u.x, u.y, u.anchor.x, u.anchor.y) > 0.6) Game.moveTo(u, u.anchor.x, u.anchor.y, sp * 0.6, dt); }
    else idleNear(G, u, mc, 2.2, sp, dt);
  }

  // Ölen birimlerin tuttuğu kristalleri ve çip rezervasyonlarını bırak
  function releaseOrphans(G) {
    const alive = new Set();
    G.units.forEach((u) => { if (u.hp > 0) alive.add(u.id); });
    G.enemies.forEach((e) => { if (e.hp > 0) alive.add(e.id); }); // akıncı kristal taşıyorsa ona dokunma
    G.crystals.forEach((cr) => {
      if (cr.carriedBy && !alive.has(cr.carriedBy)) cr.carriedBy = null; // kristal olduğu yere düşer
      if (cr.claimedBy && !alive.has(cr.claimedBy)) cr.claimedBy = null;
    });
    chipJobs = chipJobs.filter((j) => {
      if (j.u.chip && j.u.chip.member === j.member && alive.has(j.u.id)) return true;
      if (!alive.has(j.u.id) && j.member.state !== 'chipped') {
        j.member.reserved = false;
        Game.msg(G, 'Çip takan bilimci öldü; görev yarım kaldı.', '#e74c3c');
      }
      return false;
    });
  }

  // ---------- Savaş ----------
  function targetsFor(G) {
    const list = G.enemies.filter((e) => e.hp > 0);
    if (window.Colonies && Colonies.hostileMembers) Colonies.hostileMembers(G).forEach((m) => list.push(m));
    return list;
  }
  function findMember(G, id) {
    for (const col of G.colonies) { const m = col.members.find((x) => x.id === id); if (m) return m; }
    return null;
  }
  function fire(G, from, tgt, dps, dt, color) {
    tgt.hp -= dps * dt;
    from.fireT = (from.fireT || 0) - dt;
    if (from.fireT <= 0) { from.fireT = 0.3; shots.push({ x1: from.x, y1: from.y, x2: tgt.x, y2: tgt.y, age: 0, color }); }
  }
  function engage(G, u, tgt, d, dps, dt) {
    u.face = Math.atan2(tgt.y - u.y, tgt.x - u.x);
    if (Game.dist(u.x, u.y, tgt.x, tgt.y) > d.range) Game.moveTo(u, tgt.x, tgt.y, d.speed, dt);
    else fire(G, u, tgt, dps, dt, G.cfg.colors.asker);
  }

  // Bakım: dakikada upkeepPerMin Öz, karakoldaki asker outpostUpkeepPerMin. Öz biterse askerler zayıflar.
  function upkeep(G, dt) {
    const d = G.cfg.units.asker;
    let perMin = 0;
    G.units.forEach((u) => { if (u.kind === 'asker' && u.hp > 0) perMin += u.post ? d.outpostUpkeepPerMin : d.upkeepPerMin; });
    if (!perMin) return false;
    G.res.oz -= (perMin / 60) * dt;
    if (G.res.oz > 0) { weakWarned = false; return false; }
    G.res.oz = 0;
    if (!weakWarned) { weakWarned = true; Game.msg(G, 'Öz bitti: askerlerin bakımı yapılamıyor, zayıfladılar!', '#e74c3c'); }
    return true;
  }

  function updateFighter(G, u, dt, mk, targets, weak) {
    const d = G.cfg.units.asker;
    const dps = d.dps * (weak && u.kind === 'asker' ? d.weakDpsMul : 1);
    const o = u.order;
    if (o && o.type === 'move') { doMove(G, u, d.speed, dt); return; } // yürürken savaşmaz (AoE'deki gibi)
    if (o && o.type === 'attack') {
      const t = o.target;
      const alive = t && t.hp > 0 && (G.enemies.includes(t) || (t.role && t.state !== 'fainted' && t.state !== 'chipped' && findMember(G, t.id)));
      if (!alive) u.order = null;
      else { u.state = 'fight'; engage(G, u, t, d, dps, dt); return; }
    }
    if (o && o.type === 'post') {
      const k = o.b;
      if (!G.buildings.includes(k) || k.hp <= 0) u.order = null;
      else if (City.postCount(G, k) >= G.cfg.buildings.karakol.capacity && u.post !== k.id) { u.order = null; Game.msg(G, 'Karakol dolu.', '#e67e22'); }
      else { u.post = k.id; u.anchor = null; u.order = null; }
    }
    if (u.huntTarget) {
      const m = findMember(G, u.huntTarget);
      if (!m || m.hp <= 0 || m.state === 'fainted' || m.state === 'chipped') u.huntTarget = null;
      else { u.state = 'hunt'; engage(G, u, m, d, dps, dt); return; }
    }
    const post = u.post ? G.buildings.find((b) => b.id === u.post && b.hp > 0) : null;
    if (u.post && !post) { u.post = null; Game.msg(G, 'Karakol yıkıldı, asker şehre dönüyor.', '#e74c3c'); }
    const anchor = post ? Game.center(post) : u.anchor || Game.center(mk);
    const leash = post ? G.cfg.buildings.karakol.guardRadius + d.range : u.anchor ? d.holdGuardRadius : d.cityGuardRadius;
    const tgt = Game.nearest(targets, u.x, u.y, (t) =>
      Game.dist(t.x, t.y, anchor.x, anchor.y) <= leash || Game.dist(t.x, t.y, u.x, u.y) <= d.range + 1);
    if (tgt) { u.state = 'fight'; engage(G, u, tgt, d, dps, dt); return; }
    u.state = post ? 'post' : 'idle';
    if (u.anchor && !post) { if (Game.dist(u.x, u.y, anchor.x, anchor.y) > 0.6) Game.moveTo(u, anchor.x, anchor.y, d.speed, dt); }
    else idleNear(G, u, anchor, post ? 1.1 : 2.8, d.speed / 0.6, dt);
  }

  City.postCount = (G, karakol) => G.units.filter((u) => u.post === karakol.id && u.hp > 0).length;

  City.sendSoldier = function (G, karakol) {
    if (!karakol || karakol.type !== 'karakol' || karakol.hp <= 0) return false;
    const cap = G.cfg.buildings.karakol.capacity, n = City.postCount(G, karakol);
    if (n >= cap) { Game.msg(G, `Karakol dolu (${n}/${cap}).`, '#e67e22'); return false; }
    const c = Game.center(karakol);
    const s = Game.nearest(G.units, c.x, c.y, (u) => u.owner === 'player' && u.kind === 'asker' && u.hp > 0 && !u.post && !u.huntTarget);
    if (!s) { Game.msg(G, 'Şehirde boşta asker yok. Bir yavruyu Asker olarak besle.', '#e67e22'); return false; }
    s.post = karakol.id;
    Game.msg(G, `Asker karakola gidiyor (${n + 1}/${cap}). Karakolda bakımı ${G.cfg.units.asker.outpostUpkeepPerMin} Öz/dk.`, '#9be7a1');
    return true;
  };

  // Akıncılar için: bu nokta içinde asker olan bir karakolun koruma alanında mı?
  City.guardedAt = function (G, x, y) {
    const r = G.cfg.buildings.karakol.guardRadius;
    return G.buildings.some((b) => {
      if (b.type !== 'karakol' || b.hp <= 0 || !City.postCount(G, b)) return false;
      const c = Game.center(b);
      return Game.dist(c.x, c.y, x, y) <= r;
    });
  };

  function updateTurret(G, b, dt, targets) {
    const d = G.cfg.buildings.taret, c = Game.center(b);
    const tgt = Game.nearest(targets, c.x, c.y, (t) => Game.dist(t.x, t.y, c.x, c.y) <= d.range);
    if (!tgt) return;
    b.data.aim = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    const from = b.data.gun || (b.data.gun = { x: c.x, y: c.y });
    fire(G, from, tgt, d.dps, dt, G.cfg.colors.crystal);
  }

  // ---------- Bilimci ----------
  function updateScientist(G, u, dt, mk) {
    const sp = G.cfg.units.bilimci.speed;
    if (u.order && u.order.type === 'move' && !u.chip) { doMove(G, u, sp, dt); return; }
    if (u.order && u.order.type === 'lab') { u.anchor = null; u.order = null; }
    if (u.chip) {
      const m = u.chip.member;
      const exists = window.Colonies && Colonies.colonyOf && Colonies.colonyOf(G, m) && m.hp > 0 && m.state !== 'chipped';
      if (!exists) { m.reserved = false; u.chip = null; u.state = 'idle'; Game.msg(G, 'Çip görevi iptal: hedef artık yok.', '#e67e22'); return; }
      const reach = m.role === 'kralice' ? 1.6 : 0.9;
      if (u.state === 'chip') {
        u.chip.left -= dt;
        if (u.chip.left <= 0) {
          u.chip = null; u.state = 'idle'; m.reserved = false;
          if (Colonies.chipDone) Colonies.chipDone(G, m);
        }
        return;
      }
      u.state = 'chipGo';
      if (Game.dist(u.x, u.y, m.x, m.y) <= reach) u.state = 'chip';
      else Game.moveTo(u, m.x, m.y, sp, dt);
      return;
    }
    if (u.anchor) { // bir yere gönderildi: orada bekler (laboratuvara sağ tıklayınca geri döner)
      u.state = 'idle';
      if (Game.dist(u.x, u.y, u.anchor.x, u.anchor.y) > 0.6) Game.moveTo(u, u.anchor.x, u.anchor.y, sp, dt);
      return;
    }
    const lab = Game.nearest(G.buildings, u.x, u.y, (b) => b.type === 'lab' && b.hp > 0 && City.isBuilt(b));
    if (lab) {
      const s = slotAround(Game.center(lab), u.id, lab.size / 2 + 0.4);
      u.state = Game.moveTo(u, s.x, s.y, sp, dt) ? 'lab' : 'toLab';
      return;
    }
    u.state = 'idle';
    idleNear(G, u, Game.center(mk), 2.5, sp, dt);
  }

  // colonies.js çağırır; boşta bilimci yoksa false
  // sci verilirse o bilimci gider (seçili bilimciyle sağ tık), yoksa en yakın boştaki
  City.orderChip = function (G, member, sure, sci) {
    const s = sci && sci.kind === 'bilimci' && !sci.chip ? sci
      : Game.nearest(G.units, member.x, member.y, (u) => u.owner === 'player' && u.kind === 'bilimci' && u.hp > 0 && !u.chip);
    if (!s) return false;
    s.order = null; s.anchor = null;
    s.chip = { member, left: sure, total: sure };
    s.state = 'chipGo';
    chipJobs.push({ u: s, member });
    return true;
  };

  // ---------- Sağ tık emirleri ----------
  function memberAt(G, wx, wy) {
    let best = null, bd = 0.9;
    G.colonies.forEach((col) => col.members.forEach((m) => {
      const r = m.role === 'kralice' ? 1.4 : 0.9, d = Game.dist(m.x, m.y, wx, wy);
      if (d < r && d < bd + (r - 0.9)) { bd = d; best = m; }
    }));
    return best;
  }

  // Seçili birimlere, imlecin altındaki şeye göre emir ver
  City.command = function (G, units, info) {
    units = units.filter((u) => u.owner === 'player' && u.hp > 0 && u.kind !== 'yumurta' && u.kind !== 'yavru');
    if (!units.length) return false;
    const { wx, wy, tx, ty } = info;
    const fighters = units.filter(isFighter), carriers = units.filter(isCarrier), scis = units.filter((u) => u.kind === 'bilimci');
    const clear = (u) => { u.order = null; u.huntTarget = null; };
    const say = (x, y, color) => marks.push({ x, y, age: 0, color });

    // 1) akıncı
    const enemy = Game.nearest(G.enemies, wx, wy, (e) => e.hp > 0 && Game.dist(e.x, e.y, wx, wy) < 0.8);
    if (enemy && fighters.length) {
      fighters.forEach((u) => { clear(u); u.post = null; u.order = { type: 'attack', target: enemy }; });
      say(enemy.x, enemy.y, G.cfg.colors.bocekDusman); return true;
    }
    // 2) koloni bireyi: askerler avlar, bilimci bayılmış bireye / kraliçeye çip takar
    const m = memberAt(G, wx, wy);
    if (m && window.Colonies) {
      if (scis.length && (m.state === 'fainted' || m.role === 'kralice') && Colonies.tryChip) { Colonies.tryChip(G, m, scis[0]); say(m.x, m.y, G.cfg.colors.bilimci); return true; }
      if (fighters.length && m.role !== 'kralice' && m.state !== 'fainted' && Colonies.hunt) {
        fighters.forEach((u) => { clear(u); u.post = null; });
        Colonies.hunt(G, m, fighters);
        say(m.x, m.y, G.cfg.colors.bocekDusman); return true;
      }
    }
    // 3) kristal: işçiler toplar
    const cr = Game.nearest(G.crystals, wx, wy, (k) => !k.carriedBy && Game.dist(k.x, k.y, wx, wy) < 0.8);
    if (cr && carriers.length) {
      carriers.forEach((u) => { clear(u); u.order = { type: 'gather', crystal: cr }; });
      say(cr.x, cr.y, G.cfg.colors.crystal);
      units = units.filter((u) => !isCarrier(u));
      if (!units.length) return true;
    }
    // 4) kendi binan: yarım binayı kur, karakola gir, laboratuvara dön
    const b = Game.buildingAt(G, tx, ty);
    if (b) {
      const c = Game.center(b);
      if (!City.isBuilt(b) && carriers.length) { carriers.forEach((u) => { clear(u); u.order = { type: 'build', b }; }); say(c.x, c.y, '#9be7a1'); return true; }
      if (b.type === 'karakol' && fighters.length) {
        let room = G.cfg.buildings.karakol.capacity - City.postCount(G, b);
        fighters.forEach((u) => { if (u.post === b.id) return; if (room-- > 0) { clear(u); u.order = { type: 'post', b }; } });
        say(c.x, c.y, '#9be7a1'); return true;
      }
      if (b.type === 'lab' && scis.length) { scis.forEach((u) => { clear(u); u.order = { type: 'lab' }; }); say(c.x, c.y, G.cfg.colors.bilimci); }
    }
    // 5) sarmaşık: işçiler budar
    if (carriers.length && window.Vines && Vines.has && Vines.has(G, tx, ty) && !Vines.isRoot(G, tx, ty)) {
      carriers.forEach((u) => { clear(u); u.order = { type: 'prune', tx, ty, ox: tx, oy: ty }; });
      say(tx + 0.5, ty + 0.5, G.cfg.colors.vineLeaf); return true;
    }
    // 6) yer: birlikte, düzenli bir öbek halinde yürü
    const n = units.length, cols = Math.ceil(Math.sqrt(n)), gap = 0.7;
    units.forEach((u, i) => {
      clear(u); u.post = null;
      if (u.chip) return; // çip takan bilimciyi bölme
      const gx = (i % cols) - (cols - 1) / 2, gy = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
      const x = Math.max(0.5, Math.min(G.map.w - 0.5, wx + gx * gap)), y = Math.max(0.5, Math.min(G.map.h - 0.5, wy + gy * gap));
      u.order = { type: 'move', x, y };
    });
    say(wx, wy, '#9be7a1');
    return true;
  };

  // Birimi kendi haline bırak (Merkez çevresindeki işine döner)
  City.release = function (G, units) {
    units.forEach((u) => { u.order = null; u.anchor = null; u.huntTarget = null; });
  };

  // Oyuncu birimleri birbirinin içine girmesin
  function separate(G) {
    const list = G.units.filter((u) => u.owner === 'player' && u.kind !== 'yumurta' && u.state !== 'chip');
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.001 && d < 0.5) {
        const push = (0.5 - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      }
    }
  }

  // ---------- Çizim ----------
  function box(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  }

  function drawBuilding(ctx, G, b) {
    const T = G.map.tile, c = G.cfg.colors, px = b.x * T, py = b.y * T, s = b.size * T, cx = px + s / 2, cy = py + s / 2;
    if (!City.isBuilt(b)) { // temel + iskele + ilerleme çubuğu
      const d = G.cfg.buildings[b.type], pct = Math.min(1, b.progress / d.buildTime);
      ctx.fillStyle = 'rgba(80,60,40,0.45)'; ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
      ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * pct; ctx.beginPath(); ctx.rect(px, py + s * (1 - pct), s, s * pct); ctx.clip();
      box(ctx, px + 3, py + 3, s - 6, s - 6, c.player, 'rgba(0,0,0,0.5)'); ctx.restore();
      ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= b.size * 2; k++) { ctx.moveTo(px + (k * s) / (b.size * 2), py); ctx.lineTo(px + (k * s) / (b.size * 2), py + s); }
      ctx.moveTo(px, py); ctx.lineTo(px + s, py + s); ctx.moveTo(px + s, py); ctx.lineTo(px, py + s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px, py + s + 3, s, 5);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(px + 1, py + s + 4, (s - 2) * pct, 3);
      label(ctx, `${d.ad} · %${Math.floor(pct * 100)}`, cx, py - 8);
      if (G.ui.selected === b) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px, py, s, s); }
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(px + 5, py + 6, s - 5, s - 5); // gölge
    switch (b.type) {
      case 'merkez': { // teraslı taş yapı
        box(ctx, px + 2, py + 2, s - 4, s - 4, c.player, 'rgba(0,0,0,0.5)');
        box(ctx, px + 10, py + 10, s - 20, s - 20, 'rgba(255,255,255,0.18)', 'rgba(0,0,0,0.3)');
        box(ctx, px + 20, py + 20, s - 40, s - 40, 'rgba(255,255,255,0.22)', 'rgba(0,0,0,0.3)');
        ctx.fillStyle = 'rgba(255,214,120,' + (0.7 + 0.3 * Math.sin(G.time * 2)) + ')';
        [[14, 6], [s - 18, 6], [6, s - 18], [s - 10, s - 14]].forEach(([wx, wy]) => ctx.fillRect(px + wx, py + wy, 4, 4));
        break;
      }
      case 'ev': {
        box(ctx, px + 3, py + 3, s - 6, s - 6, c.player, 'rgba(0,0,0,0.5)');
        box(ctx, px + 8, py + 8, s - 16, s - 16, 'rgba(255,255,255,0.18)');
        ctx.strokeStyle = c.vineStem; ctx.lineWidth = 2; // Mor Lif çatı örgüsü
        ctx.beginPath(); ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + s - 8, py + s - 8); ctx.moveTo(px + s - 8, py + 8); ctx.lineTo(px + 8, py + s - 8); ctx.stroke();
        ctx.fillStyle = 'rgba(255,214,120,0.9)'; ctx.fillRect(cx - 2, py + s - 9, 4, 4);
        break;
      }
      case 'ocak': {
        box(ctx, px + 3, py + 3, s - 6, s - 6, c.rock, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = c.plain;
        [[0.32, 0.6, 5], [0.55, 0.68, 4], [0.45, 0.45, 4], [0.68, 0.5, 3]].forEach(([fx, fy, r]) => { ctx.beginPath(); ctx.arc(px + s * fx, py + s * fy, r, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + s - 10, py + 14); ctx.stroke();
        break;
      }
      case 'kule': {
        const active = b.data.activeWave && b.data.activeWave === G.flags.waveNo && G.meteors.some((m) => m.kule === b.id);
        const kc = G.cfg.buildings.kule;
        ctx.strokeStyle = active ? c.auroraNear : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(cx, cy, kc.landRadius * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        box(ctx, px + 3, py + 3, s - 6, s - 6, '#4a4038', 'rgba(0,0,0,0.6)');
        if (active) {
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s);
          g.addColorStop(0, 'rgba(255,200,90,0.8)'); g.addColorStop(1, 'rgba(255,200,90,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = active ? c.crystal : c.auroraFar; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.32 + (active ? Math.sin(G.time * 8) * 2 : 0), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = active ? '#fff4d6' : c.crystal; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'karakol': {
        box(ctx, px + 3, py + 3, s - 6, s - 6, c.player, 'rgba(0,0,0,0.6)');
        box(ctx, px + 7, py + 7, s - 14, s - 14, 'rgba(0,0,0,0.25)');
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 4, py + s - 8); ctx.lineTo(cx - 4, py + 4); ctx.stroke();
        ctx.fillStyle = c.asker; ctx.beginPath(); ctx.moveTo(cx - 4, py + 4); ctx.lineTo(cx + 9, py + 8); ctx.lineTo(cx - 4, py + 12); ctx.fill();
        const n = City.postCount(G, b), cap = G.cfg.buildings.karakol.capacity;
        for (let i = 0; i < cap; i++) { ctx.fillStyle = i < n ? c.asker : 'rgba(0,0,0,0.4)'; ctx.fillRect(px + 6 + i * 7, py + s - 8, 5, 4); }
        break;
      }
      case 'taret': {
        ctx.fillStyle = c.rock; ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        const a = b.data.aim || -Math.PI / 2;
        ctx.strokeStyle = '#222'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * s * 0.48, cy + Math.sin(a) * s * 0.48); ctx.stroke();
        ctx.fillStyle = c.player; ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'lab': {
        box(ctx, px + 2, py + 2, s - 4, s - 4, c.player, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = c.bilimci; ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx - s * 0.08, cy - s * 0.08, s * 0.12, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default:
        box(ctx, px + 2, py + 2, s - 4, s - 4, c.player, 'rgba(0,0,0,0.5)');
    }
    if (b.hp < b.maxHp) {
      ctx.fillStyle = '#300'; ctx.fillRect(px, py - 5, s, 3);
      ctx.fillStyle = '#4caf50'; ctx.fillRect(px, py - 5, s * Math.max(0, b.hp / b.maxHp), 3);
    }
    const hover = G.ui.mouse.tx >= b.x && G.ui.mouse.ty >= b.y && G.ui.mouse.tx < b.x + b.size && G.ui.mouse.ty < b.y + b.size;
    if (G.ui.selected === b || (hover && !G.ui.buildMode)) {
      if (G.ui.selected === b) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px, py, s, s); }
      label(ctx, G.cfg.buildings[b.type].ad, cx, py - 9);
      if (b.type === 'taret' || b.type === 'karakol') {
        const r = b.type === 'taret' ? G.cfg.buildings.taret.range : G.cfg.buildings.karakol.guardRadius;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, r * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  function label(ctx, text, x, y) {
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = '#fff'; ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  function ring(ctx, x, y, r, pct, color) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, pct))); ctx.stroke();
  }

  function drawUnit(ctx, G, u) {
    const T = G.map.tile, c = G.cfg.colors, px = u.x * T, py = u.y * T;
    if (u.kind === 'yumurta') {
      const g = ctx.createRadialGradient(px, py, 0, px, py, 14);
      g.addColorStop(0, 'rgba(255,190,90,' + (0.45 + 0.2 * Math.sin(G.time * 3 + u.id)) + ')'); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.isci; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(px, py, 5, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ring(ctx, px, py, 10, 1 - u.t / G.cfg.population.hatchTime, c.crystal);
    } else if (u.kind === 'yavru') {
      ctx.fillStyle = c.isci; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, T * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (u.food) ring(ctx, px, py, T * 0.3, 1 - u.grow / u.growMax, c[u.food] || '#fff');
      else {
        ctx.strokeStyle = c.crystal; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, T * 0.3 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
        label(ctx, '?', px, py - T * 0.42);
      }
    } else if (u.kind === 'tasiyici' || u.kind === 'savasci') {
      // çiplenmiş böcekleri colonies.js çizer; burada yalnızca seçim ve taşınan kristal
      if (u.carrying && window.Meteors) Meteors.drawCrystal(ctx, G, px, py - T * 0.45, u.carrying.oz, G.time);
    } else {
      // Ovik: gölge, takım halkası, gövde, baş ve kişiliğe göre alet
      const r = T * 0.22, sel = City.isSelected(G, u);
      const moving = u.state === 'move' || u.state === 'toCrystal' || u.state === 'carry' || u.state === 'toBuild' || u.state === 'toPrune' || u.state === 'toLab' || u.state === 'chipGo';
      if (moving) u.step = (u.step || 0) + 0.25;
      const bob = moving ? Math.abs(Math.sin(u.step || 0)) * 2 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px + 1, py + r * 0.9, r * 1.05, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = sel ? '#ffffff' : c.player; ctx.lineWidth = sel ? 2 : 1.5;
      ctx.beginPath(); ctx.ellipse(px, py + r * 0.85, r * 1.15, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      const body = ctx.createRadialGradient(px - r * 0.3, py - r * 0.4 - bob, 1, px, py - bob, r * 1.2);
      body.addColorStop(0, '#ffffff'); body.addColorStop(0.25, c[u.kind] || '#fff'); body.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = c[u.kind] || '#fff'; ctx.beginPath(); ctx.ellipse(px, py - bob, r * 0.85, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = c.ovikTen; ctx.beginPath(); ctx.arc(px, py - r * 1.05 - bob, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // baş
      const a = u.face || 0;
      if (isFighter(u)) { // mızrak ve kalkan
        ctx.strokeStyle = '#d9d2c3'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * r * 0.6, py - bob - Math.sin(a) * r * 0.6); ctx.lineTo(px + Math.cos(a) * r * 2, py - bob + Math.sin(a) * r * 2); ctx.stroke();
        ctx.fillStyle = c.player; ctx.beginPath(); ctx.arc(px - Math.sin(a) * r * 0.8, py - bob + Math.cos(a) * r * 0.5, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (u.kind === 'bilimci') { ctx.fillStyle = c.vineBud; ctx.beginPath(); ctx.arc(px + r * 0.2, py - r * 1.1 - bob, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
      if (u.kind === 'isci') { // kazma; çalışırken sallanır
        const sw = u.state === 'build' || u.state === 'prune' ? Math.sin((u.step || 0) * 1.5) * 0.9 : 0.4;
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
        const hx = px + r * 0.7, hy = py - bob;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(-1 + sw) * r * 1.4, hy + Math.sin(-1 + sw) * r * 1.4); ctx.stroke();
      }
      if (u.post) { ctx.fillStyle = c.asker; ctx.fillRect(px + r * 0.6, py - r * 1.4, 2, r); ctx.fillRect(px + r * 0.6, py - r * 1.4, 6, 4); }
      if (u.chip && u.state === 'chip') {
        ring(ctx, px, py, r + 5, 1 - u.chip.left / u.chip.total, c.bilimci);
        ctx.strokeStyle = 'rgba(46,134,222,0.7)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(u.chip.member.x * T, u.chip.member.y * T); ctx.stroke(); ctx.setLineDash([]);
      }
      if (u.carrying && window.Meteors) Meteors.drawCrystal(ctx, G, px, py - r - 7, u.carrying.oz, G.time);
    }
    if (u.hp < u.maxHp && u.kind !== 'yumurta') {
      const w = T * 0.6;
      ctx.fillStyle = '#300'; ctx.fillRect(px - w / 2, py - T * 0.45, w, 3);
      ctx.fillStyle = '#4caf50'; ctx.fillRect(px - w / 2, py - T * 0.45, w * Math.max(0, u.hp / u.maxHp), 3);
    }
    if ((u.kind === 'yavru' || u.kind === 'tasiyici' || u.kind === 'savasci') && City.isSelected(G, u)) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, T * 0.45, 0, Math.PI * 2); ctx.stroke();
    }
    // seçili birimin gittiği yer
    if (City.isSelected(G, u) && u.order && u.order.type === 'move') {
      ctx.strokeStyle = 'rgba(155,231,161,0.5)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(u.order.x * T, u.order.y * T); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function drawPreview(ctx, G) {
    const type = G.ui.buildMode, d = G.cfg.buildings[type];
    if (!d) return;
    const T = G.map.tile, p = City.placeAt(G, type), chk = City.canPlace(G, type, p.x, p.y);
    const px = p.x * T, py = p.y * T, s = d.size * T;
    if (d.minDistFromMerkez) { // Merkez'e yasak mesafe
      const mk = Game.merkez(G);
      if (mk) {
        const c = Game.center(mk);
        ctx.fillStyle = 'rgba(231,76,60,0.08)'; ctx.strokeStyle = 'rgba(231,76,60,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(c.x * T, c.y * T, d.minDistFromMerkez * T, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    const r = d.landRadius || d.range || d.guardRadius;
    if (r) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, r * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = chk.ok ? 'rgba(76,175,80,0.45)' : 'rgba(231,76,60,0.45)';
    ctx.fillRect(px, py, s, s);
    ctx.strokeStyle = chk.ok ? '#4caf50' : '#e74c3c'; ctx.lineWidth = 2; ctx.strokeRect(px, py, s, s);
    label(ctx, `${d.ad} · ${Game.costText(d.cost)}`, px + s / 2, py - 8);
    if (!chk.ok) label(ctx, chk.reason, px + s / 2, py + s + 16);
  }

  Game.register({
    name: 'city',
    init(G) {
      shots = []; popups = []; chipJobs = []; marks = []; weakWarned = false; firstYavru = true;
      const s = G.cfg.start;
      Game.addBuilding(G, 'merkez', s.merkez.x, s.merkez.y);
      Game.addBuilding(G, 'ev', s.ev.x, s.ev.y);
      const mk = Game.center(Game.merkez(G));
      for (let i = 0; i < s.isci; i++) {
        Game.addUnit(G, { kind: 'isci', owner: 'player', x: mk.x + 1.6, y: mk.y + i * 0.7 - 0.7, hp: G.cfg.units.isci.hp, state: 'idle', carrying: null });
      }
      for (let i = 0; i < (s.asker || 0); i++) {
        Game.addUnit(G, { kind: 'asker', owner: 'player', x: mk.x - 1.6, y: mk.y + i * 0.7, hp: G.cfg.units.asker.hp, state: 'idle' });
      }
    },
    update(G, dt) {
      const mk = Game.merkez(G);
      if (!mk) return;
      G.buildings.forEach((b) => {
        if (b.hp <= 0 || !City.isBuilt(b)) return;
        const d = G.cfg.buildings[b.type];
        if (d.tasPerSec) G.res.tas += d.tasPerSec * dt;
        if (b.type === 'ev') updateHouse(G, b, dt);
      });
      releaseOrphans(G);
      const targets = targetsFor(G), weak = upkeep(G, dt);
      for (const u of G.units) {
        if (u.owner !== 'player' || u.hp <= 0) continue;
        if (u.kind === 'yumurta') updateEgg(G, u, dt);
        else if (u.state !== 'chip' && flee(G, u, dt)) continue; // altın halkanın içindeyse önce kaç
        else if (u.kind === 'yavru') updateYavru(G, u, dt);
        else if (isCarrier(u)) updateCarrier(G, u, dt, mk);
        else if (isFighter(u)) updateFighter(G, u, dt, mk, targets, weak);
        else if (u.kind === 'bilimci') updateScientist(G, u, dt, mk);
      }
      G.buildings.forEach((b) => { if (b.type === 'taret' && b.hp > 0 && City.isBuilt(b)) updateTurret(G, b, dt, targets); });
      separate(G);
      shots.forEach((s) => (s.age += dt)); shots = shots.filter((s) => s.age < 0.15);
      popups.forEach((p) => (p.age += dt)); popups = popups.filter((p) => p.age < 1.5);
      // Seçili birim ya da bina artık yoksa seçimi bırak
      const sel = G.ui.selected;
      if (sel && ((sel.kind && !G.units.includes(sel)) || (sel.size && !G.buildings.includes(sel)) || (sel.hp != null && sel.hp <= 0))) G.ui.selected = G.ui.selection[0] || null;
    },
    draw(ctx, G) {
      const T = G.map.tile;
      G.buildings.forEach((b) => { if (b.hp > 0) drawBuilding(ctx, G, b); });
      G.units.forEach((u) => { if (u.owner === 'player') drawUnit(ctx, G, u); });
      shots.forEach((s) => {
        ctx.strokeStyle = s.color; ctx.globalAlpha = 1 - s.age / 0.15; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x1 * T, s.y1 * T); ctx.lineTo(s.x2 * T, s.y2 * T); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      popups.forEach((p) => { ctx.globalAlpha = 1 - p.age / 1.5; label(ctx, p.text, p.x * T, p.y * T - p.age * 25); });
      ctx.globalAlpha = 1;
      // sağ tık işaretleri: küçülen halka
      marks.forEach((m) => {
        m.age += 1 / 60;
        const k = m.age / 0.5;
        ctx.strokeStyle = m.color; ctx.globalAlpha = Math.max(0, 1 - k); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(m.x * T, m.y * T, T * 0.5 * (1 - k * 0.6), T * 0.25 * (1 - k * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.globalAlpha = 1; marks = marks.filter((m) => m.age < 0.5);
      if (G.ui.buildMode) drawPreview(ctx, G);
    },
    onClick(G, info) {
      if (G.ui.buildMode && G.cfg.buildings[G.ui.buildMode]) {
        if (info.button === 2) { G.ui.buildMode = null; return true; }
        if (info.button !== 0) return false;
        const p = City.placeAt(G, G.ui.buildMode);
        if (City.build(G, G.ui.buildMode, p.x, p.y) && !info.shift) G.ui.buildMode = null; // Shift ile art arda kur
        return true;
      }
      if (info.button === 2) return City.command(G, G.ui.selection, info);
      if (info.button !== 0) return false;
      let best = null, bd = 0.55;
      G.units.forEach((u) => {
        if (u.owner !== 'player' || u.kind === 'yumurta') return;
        const d = Game.dist(u.x, u.y, info.wx, info.wy);
        if (d < bd) { bd = d; best = u; }
      });
      if (best) {
        if (info.shift) { // Shift: seçime ekle / çıkar
          const i = G.ui.selection.indexOf(best);
          if (i >= 0) G.ui.selection.splice(i, 1); else G.ui.selection.push(best);
          G.ui.selected = G.ui.selection[0] || null;
        } else { G.ui.selection = [best]; G.ui.selected = best; }
        return true;
      }
      const b = Game.buildingAt(G, info.tx, info.ty);
      if (b) { G.ui.selected = b; G.ui.selection = []; return true; }
      return false;
    },
    onKey(G, key) {
      const k = key.toLowerCase(), sel = G.ui.selected;
      if (BUILD_KEYS[k]) { G.ui.buildMode = G.ui.buildMode === BUILD_KEYS[k] ? null : BUILD_KEYS[k]; return; }
      if (FOOD_KEYS[k]) { if (sel && sel.kind === 'yavru') City.feed(G, sel, FOOD_KEYS[k]); else City.feedNext(G, FOOD_KEYS[k]); }
      else if (k === 'g' && sel && sel.type === 'karakol') City.sendSoldier(G, sel);
      else if (k === '.') { // AoE: boştaki işçiyi bul
        const idle = City.idleWorkers(G);
        if (!idle.length) { Game.msg(G, 'Boşta işçi yok.', '#9be7a1'); return; }
        const u = idle[(City._idleI = ((City._idleI || 0) + 1) % idle.length)];
        G.ui.selection = [u]; G.ui.selected = u; Game.centerOn(G, u.x, u.y);
      }
    },
  });
})();
