// ============================================================
// src/ui.js  —  SAHİBİ: Kişi 3
// AoE tarzı arayüz: üst kaynak çubuğu, alt panel (mini harita, seçim bilgisi, komut düğmeleri),
// mesajlar, ipuçları, başlangıç / duraklatma / oyun sonu ekranları. Tasarım: GDD bölüm 11 ve 12. Sözleşme: docs/CONTRACT.md
// ============================================================
// [x] Üst çubuk: Öz / Taş / Kitin, nüfus, dalga ve akın sayaçları, Öz hedefi, süre, hız ve duraklatma
// [x] Alt panel: mini harita (tıkla/sürükle = kamera, sağ tık = seçili birimleri oraya gönder),
//     seçim bilgisi (tek birim / bina / koloni bireyi ya da çoklu seçim ızgarası), bağlama göre komut düğmeleri
// [x] Komutlar: bina kurma, yavru besleme (Ev/Merkez seçiliyken), karakola asker, laboratuvar araştırmaları,
//     avla / çiple, budama aracı, boştaki işçi, birimi serbest bırak
// [x] Mesajlar: son 5 mesaj, 8 sn sonra solar
// [x] Başlangıç ekranı, duraklatma, kazandın / kaybettin + yeniden başlat
// ÖNEMLİ: ui.js en son yüklenir; onMouseDown'u dünya modüllerinden önce çalışır ve paneldeki tıklamaları yutar.
(function () {
  const UI = (window.UI = {});
  const TOP = 36, BOTTOM = 172, PAD = 8, MINI_W = 210, BTN_W = 62, BTN_H = 54, COLS = 4, ROWS = 3;
  const RES = [['oz', '◆', 'Öz'], ['tas', '■', 'Taş'], ['kitin', '⬢', 'Kitin']];
  const ICON = { ev: '🏠', ocak: '⛏', kule: '📡', karakol: '🚩', taret: '🎯', lab: '⚗', merkez: '🏛',
    isci: '👷', asker: '⚔', bilimci: '🔬', yavru: '🐣', yumurta: '🥚', tasiyici: '🐞', savasci: '🦂' };
  const STATE = {
    idle: 'Boşta', move: 'Yürüyor', toCrystal: 'Kristale gidiyor', carry: 'Kristal taşıyor', build: 'İnşa ediyor', toBuild: 'İnşaata gidiyor',
    prune: 'Sarmaşık budıyor', toPrune: 'Budamaya gidiyor', fight: 'Savaşıyor', hunt: 'Avlanıyor', post: 'Karakolda nöbette',
    lab: 'Laboratuvarda araştırıyor', toLab: 'Laboratuvara gidiyor', chipGo: 'Çip takmaya gidiyor', chip: 'Çip takıyor',
    wander: 'Dolaşıyor', attack: 'Saldırıyor', flee: 'Yuvaya kaçıyor', fainted: 'Baygın',
  };
  const BUILD_ORDER = [['ev', 'E'], ['ocak', 'O'], ['kule', 'K'], ['karakol', 'R'], ['taret', 'T'], ['lab', 'L']];
  let buttons = [], hover = null, started = false, miniBg = null, modal = null;

  const col = (G) => G.cfg.colors;
  const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const has = (o, f) => o && typeof o[f] === 'function';

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function panel(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#2b2333'); g.addColorStop(1, '#17121d');
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function text(ctx, s, x, y, color, font, align) {
    ctx.font = font || '12px sans-serif'; ctx.fillStyle = color || '#eee'; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  }
  function bar(ctx, x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, pct)), h - 2);
  }
  const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  // ---------- Üst çubuk ----------
  function drawTop(ctx, G) {
    const W = ctx.canvas.width, c = col(G);
    const g = ctx.createLinearGradient(0, 0, 0, TOP);
    g.addColorStop(0, '#2b2333'); g.addColorStop(1, '#17121d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, TOP);
    ctx.fillStyle = '#8a6d3b'; ctx.fillRect(0, TOP - 2, W, 2);
    let x = 10;
    const colors = { oz: c.crystal, tas: '#c9c2b5', kitin: c.bocekNotr };
    RES.forEach(([k, ic, name]) => {
      text(ctx, ic, x, 24, colors[k], 'bold 16px sans-serif');
      text(ctx, String(Math.floor(G.res[k])), x + 18, 23, '#fff', 'bold 14px sans-serif');
      buttons.push({ x: x - 4, y: 4, w: 70, h: 28, tip: { title: name, body: k === 'oz' ? 'Yıldız Özü: meteorlardan gelir. 500 Öz biriktir = zafer.' : k === 'tas' ? 'Taş: Merkez ve Taş Ocakları üretir.' : 'Kitin: avlanan böceklerden gelir.' } });
      x += 74;
    });
    // nüfus
    const n = (k) => G.units.filter((u) => u.owner === 'player' && u.hp > 0 && u.kind === k).length;
    const unfed = G.units.filter((u) => u.kind === 'yavru' && !u.food).length;
    const pop = [['isci', n('isci') + n('tasiyici')], ['asker', n('asker') + n('savasci')], ['bilimci', n('bilimci')]];
    pop.forEach(([k, v]) => { text(ctx, ICON[k] + ' ' + v, x, 23, '#eee', '13px sans-serif'); x += 46; });
    if (unfed) {
      const r = { x: x - 4, y: 6, w: 70, h: 24 };
      ctx.fillStyle = `rgba(242,193,78,${0.25 + 0.2 * Math.sin(G.time * 5)})`; rr(ctx, r.x, r.y, r.w, r.h, 5); ctx.fill();
      text(ctx, '🐣 ' + unfed + ' yavru', x, 23, '#fff', 'bold 12px sans-serif');
      buttons.push(Object.assign(r, { act: () => { const y = G.units.find((u) => u.kind === 'yavru' && !u.food); if (y) { G.ui.selection = [y]; G.ui.selected = y; Game.centerOn(G, y.x, y.y); } },
        tip: { title: 'Besin bekleyen yavru', body: 'Tıkla: yavruyu seç. Besin seç: Taş → İşçi, Öz → Asker, Öz + Taş → Bilimci.' } }));
      x += 76;
    }
    // sayaçlar (ortada)
    const wave = G.flags.nextWaveIn, raid = G.flags.nextRaidIn;
    const wide = x + 250 < W - 184, mid = wide ? Math.max(x + 10, W / 2 - 110) : x + 6;
    const wc = wave != null && wave < 15 ? '#ffb347' : '#9be7a1', rc = raid != null && raid < 20 ? '#ff7b6b' : '#ddd';
    text(ctx, `☄${wide ? ' Meteor' : ''} ${wave != null ? fmtTime(wave) : '-'}`, mid, 23, wc, 'bold 13px sans-serif');
    text(ctx, `⚑${wide ? ' Akın' : ''} ${raid != null ? fmtTime(raid) : '-'}`, mid + (wide ? 118 : 62), 23, rc, 'bold 13px sans-serif');
    buttons.push({ x: mid - 4, y: 4, w: wide ? 220 : 120, h: 28, tip: { title: 'Sayaçlar', body: 'Sonraki meteor dalgasının düşmesine ve Kül Göçebeleri akınına kalan süre.' } });
    // sağ: hedef, süre, hız
    let rx = W - 10;
    const sp = [['⏸', () => (G.paused = !G.paused), G.paused], ['3×', () => (G.speed = 3), G.speed === 3], ['2×', () => (G.speed = 2), G.speed === 2], ['1×', () => (G.speed = 1), G.speed === 1]];
    sp.forEach(([label, act, on]) => {
      rx -= 30; const r = { x: rx, y: 6, w: 27, h: 24 };
      ctx.fillStyle = on ? '#8a6d3b' : 'rgba(255,255,255,0.08)'; rr(ctx, r.x, r.y, r.w, r.h, 4); ctx.fill();
      text(ctx, label, r.x + r.w / 2, 23, '#fff', 'bold 12px sans-serif', 'center');
      buttons.push(Object.assign(r, { act, tip: { title: label === '⏸' ? 'Duraklat (Boşluk)' : 'Oyun hızı ' + label + ' (1/2/3)' } }));
    });
    rx -= 54; if (rx > mid + 130) text(ctx, '⏱ ' + fmtTime(G.time), rx, 23, '#ddd', '13px sans-serif');
    rx -= 120;
    if (rx > mid + 240) {
      text(ctx, `Hedef ${Math.floor(G.res.oz)}/${G.cfg.win.oz} Öz`, rx, 17, '#f2c14e', '11px sans-serif');
      bar(ctx, rx, 21, 110, 7, G.res.oz / G.cfg.win.oz, c.crystal);
    }
  }

  // ---------- Mini harita ----------
  function miniRect(ctx, G) {
    const H = ctx.canvas.height, h = Math.round(MINI_W * G.map.h / G.map.w);
    return { x: PAD, y: H - BOTTOM + (BOTTOM - h) / 2, w: MINI_W, h };
  }
  function buildMiniBg(G, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), sx = w / G.map.w, sy = h / G.map.h, c = col(G);
    for (let y = 0; y < G.map.h; y++) for (let x = 0; x < G.map.w; x++) {
      g.fillStyle = c[G.map.terrain[y * G.map.w + x]]; g.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
    }
    return cv;
  }
  function drawMini(ctx, G) {
    const r = miniRect(ctx, G), sx = r.w / G.map.w, sy = r.h / G.map.h, c = col(G), T = G.map.tile;
    if (!miniBg || miniBg.width !== r.w) miniBg = buildMiniBg(G, r.w, r.h);
    ctx.fillStyle = '#000'; ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    ctx.drawImage(miniBg, r.x, r.y);
    // sarmaşık
    ctx.fillStyle = c.vineStem;
    for (let i = 0; i < G.map.vine.length; i++) if (G.map.vine[i]) ctx.fillRect(r.x + (i % G.map.w) * sx, r.y + Math.floor(i / G.map.w) * sy, sx + 0.3, sy + 0.3);
    // meteor hedefleri
    G.meteors.forEach((m) => {
      ctx.fillStyle = m.t < G.cfg.meteors.focusTime ? '#ffb347' : 'rgba(120,220,170,0.8)';
      ctx.beginPath(); ctx.arc(r.x + m.x * sx, r.y + m.y * sy, 2.5 + Math.sin(G.time * 8) , 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = c.crystal; G.crystals.forEach((k) => ctx.fillRect(r.x + k.x * sx - 1.5, r.y + k.y * sy - 1.5, 3, 3));
    G.buildings.forEach((b) => {
      ctx.fillStyle = b.type === 'merkez' ? '#ffd27a' : c.player;
      ctx.fillRect(r.x + b.x * sx, r.y + b.y * sy, Math.max(3, b.size * sx), Math.max(3, b.size * sy));
    });
    G.colonies.forEach((cl) => cl.members.forEach((m) => {
      const hostile = cl.hostileUntil > G.time || m.state === 'attack';
      ctx.fillStyle = m.role === 'kralice' ? c.kraliceEtiket : hostile ? c.bocekDusman : (cl.ad === 'Yaprakçı' ? '#2fb59a' : c.bocekNotr);
      ctx.fillRect(r.x + m.x * sx - 1, r.y + m.y * sy - 1, m.role === 'kralice' ? 4 : 2, m.role === 'kralice' ? 4 : 2);
    }));
    G.units.forEach((u) => {
      if (u.owner !== 'player' || u.kind === 'yumurta') return;
      ctx.fillStyle = G.ui.selection.includes(u) ? '#fff' : '#ffb04a';
      ctx.fillRect(r.x + u.x * sx - 1, r.y + u.y * sy - 1, 2.5, 2.5);
    });
    ctx.fillStyle = '#ff3b30'; G.enemies.forEach((e) => ctx.fillRect(r.x + e.x * sx - 1.5, r.y + e.y * sy - 1.5, 3.5, 3.5));
    // kamera çerçevesi
    const vw = ctx.canvas.width / T, vh = (ctx.canvas.height - TOP - BOTTOM) / T;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(r.x + (G.cam.x / T) * sx, r.y + ((G.cam.y + TOP) / T) * sy, vw * sx, vh * sy);
    ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  }
  function miniToWorld(ctx, G, sx, sy) {
    const r = miniRect(ctx, G);
    return { x: ((sx - r.x) / r.w) * G.map.w, y: ((sy - r.y) / r.h) * G.map.h };
  }

  // ---------- Komut düğmeleri ----------
  function cmdArea(ctx) { const W = ctx.canvas.width, H = ctx.canvas.height; return { x: W - PAD - COLS * (BTN_W + 4), y: H - BOTTOM + 10 }; }
  function addCmd(ctx, G, i, b) {
    const a = cmdArea(ctx), x = a.x + (i % COLS) * (BTN_W + 4), y = a.y + Math.floor(i / COLS) * (BTN_H + 4);
    const r = { x, y, w: BTN_W, h: BTN_H };
    const hot = hover && inRect(r, hover.x, hover.y);
    ctx.globalAlpha = b.disabled ? 0.45 : 1;
    const g = ctx.createLinearGradient(0, y, 0, y + BTN_H);
    g.addColorStop(0, b.active ? '#6d5530' : hot ? '#4a3d55' : '#3a3044'); g.addColorStop(1, b.active ? '#4a391f' : '#241c2b');
    ctx.fillStyle = g; rr(ctx, x, y, BTN_W, BTN_H, 5); ctx.fill();
    ctx.strokeStyle = b.active ? '#f2c14e' : hot ? '#c9a45c' : '#6b5534'; ctx.lineWidth = b.active ? 2 : 1; ctx.stroke();
    text(ctx, b.icon, x + BTN_W / 2, y + 24, '#fff', '19px sans-serif', 'center');
    text(ctx, b.label, x + BTN_W / 2, y + 39, '#eee', '10px sans-serif', 'center');
    if (b.cost) text(ctx, Game.costText(b.cost), x + BTN_W / 2, y + 50, Game.canAfford(G, b.cost) ? '#f2c14e' : '#ff8a65', '9px sans-serif', 'center');
    if (b.key) text(ctx, b.key, x + 4, y + 11, '#c9a45c', 'bold 9px sans-serif');
    if (b.progress != null) bar(ctx, x + 3, y + BTN_H - 5, BTN_W - 6, 3, b.progress, '#2e86de');
    ctx.globalAlpha = 1;
    buttons.push(Object.assign(r, { act: b.disabled ? null : b.act, tip: { title: b.title || b.label, body: b.desc, cost: b.cost, reason: b.disabled ? b.reason : null } }));
  }

  function commands(G) {
    const sel = G.ui.selected, units = G.ui.selection, list = [];
    const kinds = new Set(units.map((u) => u.kind));
    const bd = G.cfg.buildings;
    const buildBtns = () => BUILD_ORDER.forEach(([t, key]) => {
      const d = bd[t];
      list.push({ icon: ICON[t], label: d.ad.split(' ')[0], title: d.ad, key, cost: d.cost, active: G.ui.buildMode === t,
        desc: buildingDesc(G, t), disabled: !Game.canAfford(G, d.cost), reason: 'Yetersiz kaynak',
        act: () => { G.ui.buildMode = G.ui.buildMode === t ? null : t; G.ui.tool = null; } });
    });
    const feedBtns = (yavru) => Object.keys(G.cfg.population.foods).forEach((k, i) => {
      const f = G.cfg.population.foods[k], key = ['Z', 'X', 'C'][i];
      const waiting = has(window.City, 'unfedYavrus') ? City.unfedYavrus(G).length : 0;
      const ok = yavru ? !yavru.food : waiting > 0;
      list.push({ icon: ICON[k], label: f.ad, title: f.ad + ' yetiştir', key, cost: f.cost,
        desc: { isci: 'Kristal taşır, bina kurar, sarmaşık budar.', asker: 'Akıncılara ve böceklere karşı savaşır. Öz bakımı ister.', bilimci: 'Laboratuvarda araştırmayı hızlandırır, böceklere çip takar.' }[k] + (yavru ? '' : ` (${waiting} yavru bekliyor)`),
        disabled: !ok || !Game.canAfford(G, f.cost), reason: !ok ? 'Besin bekleyen yavru yok — evler yumurtluyor' : 'Yetersiz kaynak',
        act: () => (yavru ? City.feed(G, yavru, k) : City.feedNext(G, k)) });
    });

    if (sel && sel.type) { // bina
      if (sel.built === false) return list;
      if (sel.type === 'ev' || sel.type === 'merkez') feedBtns(null);
      if (sel.type === 'karakol' && has(window.City, 'sendSoldier')) {
        const n = City.postCount(G, sel), cap = bd.karakol.capacity;
        list.push({ icon: '⚔', label: 'Asker gönder', key: 'G', desc: `Boştaki en yakın askeri karakola gönderir (${n}/${cap}). Karakoldaki asker 2 kat Öz bakımı ister.`, disabled: n >= cap, reason: 'Karakol dolu', act: () => City.sendSoldier(G, sel) });
      }
      if (sel.type === 'lab' && has(window.Research, 'available')) {
        Research.available(G).forEach((r) => list.push({ icon: { Gök: '☄', Av: '🕸', Sarmaşık: '☠' }[r.dal] || '⚗', label: r.ad.length > 11 ? r.ad.slice(0, 10) + '…' : r.ad, title: r.ad + (r.dal ? ' · ' + r.dal + ' dalı' : ''),
          cost: r.cost, desc: r.effect + ` (${r.time} sn)`, disabled: !r.ok, reason: r.reason, act: () => Research.enqueue(G, r.id) }));
      }
      return list;
    }
    if (sel && sel.role) { // koloni bireyi
      const m = sel;
      if (m.role !== 'kralice' && m.state !== 'fainted' && has(window.Colonies, 'hunt')) {
        list.push({ icon: '🏹', label: 'Avla', key: 'V', desc: 'En yakın boştaki askerleri bu bireye gönderir. +1 Kitin; koloni bir süre saldırgan olur.', act: () => Colonies.hunt(G, m) });
      }
      if (has(window.Colonies, 'canChip')) {
        const c = Colonies.canChip(G, m);
        list.push({ icon: '🧠', label: 'Çiple', key: 'H', desc: m.role === 'kralice' ? 'Kraliçeyi çiplersen oyunu kazanırsın!' : 'Bilimci gidip çip takar; birey senin birimin olur.', disabled: !c.ok, reason: c.reason, act: () => Colonies.tryChip(G, m) });
      }
      return list;
    }
    if (units.length) {
      if (kinds.has('yavru') && units.length === 1) { feedBtns(units[0]); return list; }
      if (kinds.has('isci') || kinds.has('tasiyici')) buildBtns();
      list.push({ icon: '✂', label: 'Buda', key: 'B', active: G.ui.tool === 'prune', desc: 'Budama aracı: sarmaşık karesine tıkla (yakında bina gerekir). Kök Zehri araştırıldıysa köke tıkla. İpucu: işçilerle sarmaşığa sağ tıklarsan gidip kendileri budarlar.', act: () => { G.ui.tool = G.ui.tool === 'prune' ? null : 'prune'; G.ui.buildMode = null; } });
      list.push({ icon: '↺', label: 'Serbest', key: 'F', desc: 'Birimleri kendi işlerine bırak: işçiler en yakın kristali toplar, askerler Merkez\'i korur, bilimciler laboratuvara gider.', act: () => has(window.City, 'release') && City.release(G, units) });
      return list;
    }
    // hiçbir şey seçili değil: kurma menüsü ve kısayollar
    buildBtns();
    list.push({ icon: '✂', label: 'Buda', key: 'B', active: G.ui.tool === 'prune', desc: 'Budama aracı: sarmaşık karesine tıkla (yakında bina gerekir).', act: () => { G.ui.tool = G.ui.tool === 'prune' ? null : 'prune'; G.ui.buildMode = null; } });
    list.push({ icon: '👷', label: 'Boşta işçi', key: '.', desc: 'Boştaki bir işçiyi seçer ve ekranı ona götürür.', act: () => window.City && City.idleWorkers && selectIdle(G) });
    return list;
  }
  function selectIdle(G) {
    const idle = City.idleWorkers(G);
    if (!idle.length) { Game.msg(G, 'Boşta işçi yok.', '#9be7a1'); return; }
    const u = idle[(UI._i = ((UI._i || 0) + 1) % idle.length)];
    G.ui.selection = [u]; G.ui.selected = u; Game.centerOn(G, u.x, u.y);
  }
  function buildingDesc(G, t) {
    const d = G.cfg.buildings[t];
    return {
      ev: `Her ${d.eggEvery} sn'de bir yumurta. Yavrular beslenince işçi, asker ya da bilimci olur.`,
      ocak: `Saniyede ${d.tasPerSec} Taş üretir.`,
      kule: `Merkez'den en az ${d.minDistFromMerkez} kare uzağa kurulur. Her dalgada ${d.ozPerWave} Öz yakar, meteorların %${Math.round(d.pullChance * 100)}'ini çevresine çeker.`,
      karakol: `${d.capacity} asker alır; ${d.guardRadius} kare çevresindeki kristalleri korur.`,
      taret: `${d.range} kare menzilde düşmanlara ateş eder.`,
      lab: 'Araştırma yapar. İçindeki her bilimci hızı artırır.',
    }[t] + ` Kurulum ${d.buildTime} sn.`;
  }

  // ---------- Seçim bilgisi ----------
  function drawInfo(ctx, G, x, y, w, h) {
    const sel = G.ui.selected, units = G.ui.selection, c = col(G);
    panel(ctx, x, y, w, h);
    if (units.length > 1) { // çoklu seçim: ızgara
      text(ctx, `${units.length} birim seçili`, x + 10, y + 18, '#f2c14e', 'bold 13px sans-serif');
      const s = 34, per = Math.max(1, Math.floor((w - 16) / (s + 4)));
      units.slice(0, per * 3).forEach((u, i) => {
        const bx = x + 8 + (i % per) * (s + 4), by = y + 26 + Math.floor(i / per) * (s + 6), r = { x: bx, y: by, w: s, h: s };
        ctx.fillStyle = '#3a3044'; rr(ctx, bx, by, s, s, 4); ctx.fill();
        text(ctx, ICON[u.kind] || '•', bx + s / 2, by + 23, '#fff', '17px sans-serif', 'center');
        bar(ctx, bx + 2, by + s - 4, s - 4, 3, u.hp / u.maxHp, '#4caf50');
        buttons.push(Object.assign(r, { act: () => { G.ui.selection = [u]; G.ui.selected = u; }, tip: { title: unitName(G, u), body: STATE[u.state] || '' } }));
      });
      return;
    }
    if (!sel) {
      text(ctx, 'Seçim yok', x + 12, y + 22, '#f2c14e', 'bold 13px sans-serif');
      const tips = ['Sol tık / sürükle: birim seç', 'Sağ tık: yürü, saldır, topla, inşa et, buda', 'Mini harita: tıkla = git, sağ tık = birimleri gönder',
        'WASD / ekran kenarı: kamera   Boşluk: duraklat', '.: boştaki işçi   B: budama aracı'];
      tips.forEach((t, i) => text(ctx, t, x + 12, y + 44 + i * 18, '#cfc6d8', '12px sans-serif'));
      return;
    }
    // portre
    const P = 64;
    ctx.fillStyle = '#3a3044'; rr(ctx, x + 10, y + 12, P, P, 6); ctx.fill(); ctx.strokeStyle = '#8a6d3b'; ctx.stroke();
    const icon = sel.type ? ICON[sel.type] : sel.role ? (sel.role === 'kralice' ? '👑' : sel.role === 'muhafiz' ? '🦂' : '🐞') : ICON[sel.kind];
    text(ctx, icon || '•', x + 10 + P / 2, y + 12 + P / 2 + 11, '#fff', '32px sans-serif', 'center');
    const tx = x + P + 22;
    let name, sub = '', hpColor = '#4caf50';
    if (sel.type) {
      name = G.cfg.buildings[sel.type].ad;
      if (sel.built === false) sub = `İnşa ediliyor %${Math.floor((sel.progress / G.cfg.buildings[sel.type].buildTime) * 100)} — işçi seçip sağ tıkla`;
      else if (sel.type === 'ev') sub = `Sonraki yumurta: ${Math.ceil(G.cfg.buildings.ev.eggEvery - (sel.data.eggT || 0))} sn`;
      else if (sel.type === 'kule') sub = `Her dalgada ${G.cfg.buildings.kule.ozPerWave} Öz yakar`;
      else if (sel.type === 'karakol' && window.City) sub = `Askerler: ${City.postCount(G, sel)}/${G.cfg.buildings.karakol.capacity}`;
      else if (sel.type === 'merkez') sub = 'Düşerse oyun biter. Taş üretir, kristaller buraya taşınır.';
      else if (sel.type === 'ocak') sub = `+${G.cfg.buildings.ocak.tasPerSec} Taş/sn`;
      if (sel.type === 'lab' && has(window.Research, 'info')) drawLabQueue(ctx, G, tx, y + 50, w - (tx - x) - 10);
    } else if (sel.role) {
      const cl = G.colonies.find((k) => k.members.includes(sel));
      name = (cl ? cl.ad + ' ' : '') + { kralice: 'Kraliçesi', muhafiz: 'Muhafızı', toplayici: 'Toplayıcısı' }[sel.role];
      sub = (STATE[sel.state] || sel.state) + (cl && cl.hostileUntil > G.time ? ' · koloni SALDIRGAN' : ' · tarafsız') + (cl ? ` · av: ${cl.kills}` : '');
      hpColor = c.bocekDusman;
    } else {
      name = unitName(G, sel);
      sub = sel.kind === 'yavru' ? (sel.food ? `${G.cfg.population.foods[sel.food].ad} olarak büyüyor` : 'Besin bekliyor — aşağıdan seç') : (STATE[sel.state] || sel.state || '');
      if (sel.kind === 'yumurta') sub = `Çatlamasına ${Math.ceil(sel.t)} sn`;
      if (sel.carrying) sub += ` · ${sel.carrying.oz} Öz`;
      if (sel.post) sub += ' · karakolda';
    }
    text(ctx, name, tx, y + 26, '#fff', 'bold 15px sans-serif');
    if (sel.maxHp) { bar(ctx, tx, y + 33, Math.min(180, w - (tx - x) - 12), 8, sel.hp / sel.maxHp, hpColor); text(ctx, `${Math.ceil(sel.hp)}/${sel.maxHp}`, tx + Math.min(180, w - (tx - x) - 12) + 6, y + 41, '#bbb', '10px sans-serif'); }
    wrap(ctx, sub, tx, sel.type === 'lab' ? y + 155 : y + 60, w - (tx - x) - 12, '#cfc6d8');
  }
  function unitName(G, u) {
    const f = G.cfg.population.foods[u.kind];
    return f ? f.ad : { yavru: 'Yavru', yumurta: 'Yumurta', tasiyici: 'Taşıyıcı (çipli böcek)', savasci: 'Savaşçı (çipli böcek)' }[u.kind] || u.kind;
  }
  function wrap(ctx, s, x, y, w, color) {
    ctx.font = '12px sans-serif'; ctx.fillStyle = color;
    const words = String(s).split(' '); let line = '', yy = y;
    words.forEach((wd) => { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w && line) { ctx.fillText(line, x, yy); line = wd; yy += 15; } else line = t; });
    if (line) ctx.fillText(line, x, yy);
  }
  function drawLabQueue(ctx, G, x, y, w) {
    const info = Research.info(G);
    if (!info) { text(ctx, 'Araştırma yok — sağdan seç', x, y + 12, '#cfc6d8'); return; }
    text(ctx, `⚗ ${info.ad}`, x, y + 12, '#9fd0ff', 'bold 12px sans-serif');
    bar(ctx, x, y + 18, Math.min(170, w - 30), 7, info.pct, '#2e86de');
    text(ctx, `${info.eta} sn`, x + Math.min(170, w - 30) + 6, y + 25, '#bbb', '10px sans-serif');
    const xr = { x: x + Math.min(170, w - 30) + 40, y: y + 2, w: 18, h: 18 };
    text(ctx, '✖', xr.x + 9, xr.y + 13, '#ff8a65', 'bold 12px sans-serif', 'center');
    if (has(window.Research, 'cancel')) buttons.push(Object.assign(xr, { act: () => Research.cancel(G, info.id), tip: { title: 'İptal', body: 'Bedelin yarısı geri verilir.' } }));
    (info.queueIds || []).forEach((id, i) => {
      const yy = y + 42 + i * 18, ad = info.queue[i];
      text(ctx, `${i + 1}. ${ad}`, x, yy, '#ddd', '11px sans-serif');
      const up = { x: x + 120, y: yy - 12, w: 16, h: 16 }, cx = { x: x + 140, y: yy - 12, w: 16, h: 16 };
      if (i > 0 && has(window.Research, 'moveUp')) { text(ctx, '▲', up.x + 8, yy, '#9be7a1', '11px sans-serif', 'center'); buttons.push(Object.assign(up, { act: () => Research.moveUp(G, id), tip: { title: 'Öne al' } })); }
      if (has(window.Research, 'cancel')) { text(ctx, '✖', cx.x + 8, yy, '#ff8a65', '11px sans-serif', 'center'); buttons.push(Object.assign(cx, { act: () => Research.cancel(G, id), tip: { title: 'Sıradan çıkar', body: 'Bedel tamamen geri verilir.' } })); }
    });
  }

  // ---------- Mesajlar, ipucu, kutu seçimi, kaplamalar ----------
  function drawMessages(ctx, G) {
    const H = ctx.canvas.height, now = G.time;
    const list = G.messages.filter((m) => now - m.t < 8 && now >= m.t - 0.01).slice(-5);
    list.forEach((m, i) => {
      const a = Math.min(1, (8 - (now - m.t)) / 1.5), y = H - BOTTOM - 14 - (list.length - 1 - i) * 22;
      ctx.font = '13px sans-serif';
      const w = ctx.measureText(m.text).width + 16;
      ctx.globalAlpha = a * 0.75; ctx.fillStyle = '#0e0a14'; rr(ctx, 10, y - 15, w, 20, 4); ctx.fill();
      ctx.globalAlpha = a; text(ctx, m.text, 18, y, m.color);
    });
    ctx.globalAlpha = 1;
  }
  function drawTip(ctx, G) {
    if (!hover) return;
    const b = buttons.slice().reverse().find((r) => inRect(r, hover.x, hover.y) && r.tip);
    if (!b) return;
    const t = b.tip, lines = [];
    if (t.cost) lines.push(['Bedel: ' + Game.costText(t.cost), Game.canAfford(G, t.cost) ? '#f2c14e' : '#ff8a65']);
    if (t.body) lines.push([t.body, '#ddd']);
    if (t.reason) lines.push(['⚠ ' + t.reason, '#ff8a65']);
    const W = 260, x = Math.min(ctx.canvas.width - W - 8, Math.max(8, hover.x - W / 2));
    ctx.font = '12px sans-serif';
    let h = 26; const wrapped = [];
    lines.forEach(([s, c]) => { const words = s.split(' '); let line = ''; words.forEach((wd) => { const tt = line ? line + ' ' + wd : wd; if (ctx.measureText(tt).width > W - 16 && line) { wrapped.push([line, c]); line = wd; } else line = tt; }); if (line) wrapped.push([line, c]); });
    h += wrapped.length * 15;
    const y = hover.y > ctx.canvas.height / 2 ? Math.max(TOP + 4, b.y - h - 6) : b.y + b.h + 6;
    ctx.fillStyle = 'rgba(14,10,20,0.95)'; rr(ctx, x, y, W, h, 5); ctx.fill(); ctx.strokeStyle = '#8a6d3b'; ctx.stroke();
    text(ctx, t.title || '', x + 8, y + 17, '#fff', 'bold 12px sans-serif');
    wrapped.forEach(([s, c], i) => text(ctx, s, x + 8, y + 33 + i * 15, c));
  }
  function drawDrag(ctx, G) {
    const d = G.ui.drag;
    if (!d || !d.active) return;
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
    ctx.fillStyle = 'rgba(155,231,161,0.12)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#9be7a1'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  function overlay(ctx, G, title, lines, btnLabel, act, color) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(8,5,14,0.72)'; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(560, W - 40), ph = 120 + lines.length * 22, px = (W - pw) / 2, py = (H - ph) / 2;
    panel(ctx, px, py, pw, ph);
    text(ctx, title, W / 2, py + 44, color || '#f2c14e', 'bold 28px sans-serif', 'center');
    lines.forEach((l, i) => text(ctx, l, W / 2, py + 76 + i * 22, '#e6dff0', '14px sans-serif', 'center'));
    if (btnLabel) {
      const r = { x: W / 2 - 80, y: py + ph - 46, w: 160, h: 34 };
      ctx.fillStyle = '#8a6d3b'; rr(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill();
      text(ctx, btnLabel, W / 2, r.y + 22, '#fff', 'bold 15px sans-serif', 'center');
      modal = Object.assign(r, { act });
    }
  }

  // ---------- Modül ----------
  Game.register({
    name: 'ui',
    init(G) {
      G.ui.hudTop = TOP; G.ui.hudBottom = BOTTOM;
      started = false; miniBg = null;
      G.paused = true; // başlangıç ekranı
    },
    drawUI(ctx, G) {
      buttons = []; modal = null;
      const W = ctx.canvas.width, H = ctx.canvas.height;
      drawDrag(ctx, G);
      drawMessages(ctx, G);
      drawTop(ctx, G);
      // alt panel
      const g = ctx.createLinearGradient(0, H - BOTTOM, 0, H);
      g.addColorStop(0, '#231c2a'); g.addColorStop(1, '#120e17');
      ctx.fillStyle = g; ctx.fillRect(0, H - BOTTOM, W, BOTTOM);
      ctx.fillStyle = '#8a6d3b'; ctx.fillRect(0, H - BOTTOM, W, 2);
      drawMini(ctx, G);
      const ca = cmdArea(ctx), ix = PAD + MINI_W + 10;
      drawInfo(ctx, G, ix, H - BOTTOM + 8, Math.max(120, ca.x - ix - 10), BOTTOM - 16);
      commands(G).slice(0, COLS * ROWS).forEach((b, i) => addCmd(ctx, G, i, b));
      // araç / kurma ipucu
      const mode = G.ui.buildMode ? `${G.cfg.buildings[G.ui.buildMode].ad} yerleştir: sol tık kur · Shift ile art arda · sağ tık iptal`
        : G.ui.tool === 'prune' ? 'Budama aracı: sarmaşığa sol tık · sağ tık / Esc çık' : null;
      if (mode) {
        ctx.font = 'bold 13px sans-serif'; const tw = ctx.measureText(mode).width + 20;
        ctx.fillStyle = 'rgba(14,10,20,0.85)'; rr(ctx, W / 2 - tw / 2, TOP + 8, tw, 24, 5); ctx.fill();
        text(ctx, mode, W / 2, TOP + 25, '#f2c14e', 'bold 13px sans-serif', 'center');
      }
      if (!started) {
        overlay(ctx, G, 'MOR SARMAŞIK', [
          'Yıldız Özü meteorlarla gökten düşer. 500 Öz biriktir ya da bir koloni kraliçesini çiple.',
          'Merkez yıkılırsa kaybedersin. Sarmaşık, akıncılar ve meteorlar şehrini tehdit eder.',
          '',
          'Sol tık / sürükle: seç · Sağ tık: emir (yürü, saldır, topla, inşa et, buda)',
          'Alttaki düğmelerle bina kur · Ev seçip yavruları besle: İşçi, Asker, Bilimci',
          'Çekim Kulesi meteorları uzağa çeker · Karakol ve taretle kristalleri koru',
          'WASD / ekran kenarı: kamera · Boşluk: duraklat · 1/2/3: hız',
        ], 'Başla', () => { started = true; G.paused = false; });
      } else if (G.over) {
        const win = G.over === 'win';
        overlay(ctx, G, win ? 'ZAFER!' : 'YENİLGİ', [
          win ? 'Zeyra-9\'da Ovik\'lerin geleceği güvende.' : 'Merkez yıkıldı.',
          `Süre ${fmtTime(G.time)} · Öz ${Math.floor(G.res.oz)} · Kitin ${G.res.kitin} · Dalga ${G.flags.waveNo || 0}`,
        ], 'Yeniden başlat', () => location.reload(), win ? '#9be7a1' : '#ff7b6b');
      } else if (G.paused) {
        text(ctx, 'DURAKLATILDI — Boşluk ile devam', W / 2, H / 2 - 60, '#fff', 'bold 22px sans-serif', 'center');
      }
      drawTip(ctx, G);
    },
    onMouseDown(G, info) {
      hover = { x: info.sx, y: info.sy };
      if (modal) { if (info.button === 0 && inRect(modal, info.sx, info.sy)) modal.act(); return true; } // açılış / oyun sonu ekranı
      const btn = buttons.slice().reverse().find((r) => inRect(r, info.sx, info.sy));
      if (btn) { if (info.button === 0 && btn.act) btn.act(); return true; }
      if (!started || G.over) return true; // kaplama açıkken dünyaya tıklanmaz
      const ctx = { canvas: { width: Game.viewSize().w, height: Game.viewSize().h } };
      const r = miniRect(ctx, G);
      if (inRect(r, info.sx, info.sy)) {
        const p = miniToWorld(ctx, G, info.sx, info.sy);
        if (info.button === 2 && window.City && City.command) {
          City.command(G, G.ui.selection, { wx: p.x, wy: p.y, tx: Math.floor(p.x), ty: Math.floor(p.y), button: 2 });
          return true;
        }
        Game.centerOn(G, p.x, p.y);
        return true;
      }
      if (info.sy < TOP || info.sy > ctx.canvas.height - BOTTOM) return true; // panel tıklamayı yutar
      return false;
    },
    onMouseDrag(G, p) {
      hover = { x: p.sx, y: p.sy };
      const ctx = { canvas: { width: Game.viewSize().w, height: Game.viewSize().h } };
      const r = miniRect(ctx, G);
      if (inRect(r, p.sx, p.sy)) { const w = miniToWorld(ctx, G, p.sx, p.sy); Game.centerOn(G, w.x, w.y); }
    },
    update(G) { const m = G.ui.mouse; hover = { x: m.sx, y: m.sy }; },
    onKey(G, key) {
      const k = key.toLowerCase(), sel = G.ui.selected;
      if (!started && (k === 'enter' || k === ' ')) { started = true; G.paused = false; return; }
      if (sel && sel.role && window.Colonies) {
        if (k === 'v' && Colonies.hunt) Colonies.hunt(G, sel);
        if (k === 'h' && Colonies.tryChip) Colonies.tryChip(G, sel);
      }
      if (k === 'f' && G.ui.selection.length && window.City && City.release) City.release(G, G.ui.selection);
    },
  });
  // fare hareketini duraklatılmışken de izle (ipuçları için)
  window.addEventListener('mousemove', (e) => { const c = document.getElementById('game'); if (!c) return; const r = c.getBoundingClientRect(); hover = { x: e.clientX - r.left, y: e.clientY - r.top }; });
})();
