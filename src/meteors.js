// ============================================================
// src/meteors.js  —  SAHİBİ: Kişi 1
// Meteor dalgaları, zemindeki kuzey ışığı ışıltısı, çarpma, Öz kristali,
// Çekim Kulesi'nin meteor çekmesi. Tasarım: GDD bölüm 5. Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [x] Dalga zamanlayıcı: ilk firstWave, sonra interval; G.flags.nextWaveIn (ui.js gösterir)
//     G.flags.nextWaveIn = dalganın DÜŞMESİNE kalan süre; ışıltı auroraTime saniye önce başlar. G.flags.waveNo = dalga sayısı
// [x] Dalga başında her meteor için hedef seç (rastgele kare). Kule varsa ve ozPerWave Öz ödenebiliyorsa
//     her meteor pullChance (Geniş Çekim araştırıldıysa researchValues.genisCekimPull) olasılıkla kulenin landRadius çevresine
// [x] Meteor Kalkanı araştırıldıysa (G.research.done.meteorKalkan) Merkez'in kalkanRadius çevresindeki hedefleri uzağa kaydır
// [x] G.meteors: { x, y, type:'kaya'|'dev', t } — t: düşmeye kalan süre (auroraTime'dan geri sayar)
//     ek alanlar: sx, sy (ışıltının başladığı yer; çekilen/saptırılan meteorun ışıltısı x, y'ye kayar), kule (çeken kulenin id'si)
// [x] Çizim: t > focusTime iken geniş, dalgalanan yeşil-mor ışık; son focusTime saniyede altın-turuncu daralan halka
// [x] t <= 0: Game.damageArea (Çekim Kulesi'ni atla), G.crystals.push({ id, x, y, oz, carriedBy:null })
// [x] Kristalleri altın elmas olarak çiz (taşınanları city.js birimin üstünde çizer: Meteors.drawCrystal)
(function () {
  const Meteors = (window.Meteors = {});
  const FALL = 0.8;        // meteorun gökten inişinin çizildiği son saniyeler (yalnız görsel)
  const CRATER_LIFE = 90;  // krater izinin solma süresi (yalnız görsel)
  let waveNo = 0, spawned = false, warned = false;
  let fx = [], craters = [];

  const mc = (G) => G.cfg.meteors;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const clampMap = (G, x, y) => ({ x: Math.max(0.5, Math.min(G.map.w - 0.5, x)), y: Math.max(0.5, Math.min(G.map.h - 0.5, y)) });
  const randomPoint = (G) => ({ x: 1 + Math.random() * (G.map.w - 2), y: 1 + Math.random() * (G.map.h - 2) });

  Meteors.waveNo = () => waveNo;

  // Işıltının şu an göründüğü yer: çekilen meteorun ışıltısı ilk (auroraTime - focusTime) saniyede hedefe kayar
  Meteors.displayPos = function (G, me) {
    const m = mc(G);
    const k = clamp01((me.t0 - me.t) / Math.max(0.1, me.t0 - m.focusTime));
    const e = k * k * (3 - 2 * k);
    return { x: me.sx + (me.x - me.sx) * e, y: me.sy + (me.y - me.sy) * e };
  };

  function spawnWave(G) {
    const m = mc(G), kc = G.cfg.buildings.kule;
    waveNo++; G.flags.waveNo = waveNo;
    const count = Math.min(m.maxCount, m.baseCount + Math.floor((waveNo - 1) / m.growEvery));

    // Her kule dalga başına ozPerWave Öz yakar; ödeyemeyen bu dalgada çekmez
    const active = [];
    G.buildings.filter((b) => b.type === 'kule' && b.hp > 0 && b.built !== false).forEach((k) => {
      if (Game.pay(G.civilizationAccount?.(k.civ)||G, { oz: kc.ozPerWave })) { active.push(k); k.data.activeWave = waveNo; }
      else { k.data.activeWave = 0; Game.msg(G, `Çekim Kulesi bu dalgada çalışmadı: ${kc.ozPerWave} Öz gerekli.`, '#e74c3c'); }
    });
    const R = G.cfg.researchValues.kalkanRadius;

    let pulled = 0, shielded = 0;
    for (let i = 0; i < count; i++) {
      const type = m.devEvery && waveNo % m.devEvery === 0 && i === 0 ? 'dev' : 'kaya';
      const start = randomPoint(G);
      let p = start, kule = null;
      const nearestTower=Game.nearest(active,start.x,start.y);
      const pull=(G.civilizationAccount?.(nearestTower?.civ)||G).research.done.genisCekim?G.cfg.researchValues.genisCekimPull:kc.pullChance;
      if (nearestTower && Math.random() < pull) {
        kule = nearestTower;
        const c = Game.center(kule), a = Math.random() * Math.PI * 2;
        const r = Math.min(1.2, kc.landRadius) + Math.random() * Math.max(0, kc.landRadius - 1.2);
        p = clampMap(G, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
        pulled++;
      }
      // Each civilization's research and early safety protect its own center.
      const centers=G.buildings.filter(b=>b.type==='merkez'&&b.hp>0);
      const protectedAt=q=>centers.some(b=>{const c=Game.center(b),account=G.civilizationAccount?.(b.civ)||G;return account.research.done.meteorKalkan&&Game.dist(q.x,q.y,c.x,c.y)<R || G.time<m.citySafeUntil&&Game.dist(q.x,q.y,c.x,c.y)<m.citySafeRadius;});
      if(protectedAt(p)){for(let tries=0;tries<100&&protectedAt(p);tries++)p=randomPoint(G);shielded++;}
      const t=G.flags.nextWaveIn+i*.35+Math.random()*.3;
      G.meteors.push({ x: p.x, y: p.y, type, t, t0: t, sx: start.x, sy: start.y, kule: kule ? kule.id : null, ang: Math.random() * Math.PI });
    }
    let text = `Meteor dalgası ${waveNo}: ${count} meteor ${Math.round(G.flags.nextWaveIn)} sn içinde düşüyor!`;
    if (pulled) text += ` ${pulled} tanesi Çekim Kulesi'ne çekiliyor.`;
    if (shielded) text += ` Kalkan ${shielded} meteoru şehirden saptırdı.`;
    if (count && waveNo % m.devEvery === 0) text += ' DEV meteor geliyor!';
    Game.msg(G, text, '#9be7a1');
  }

  function impact(G, me) {
    const d = mc(G).types[me.type];
    Game.damageArea(G, me.x, me.y, d.radius, d.damage, { skip: (b) => b.type === 'kule' });
    G.crystals.push({ id: Game.newId(), x: me.x, y: me.y, oz: d.oz, carriedBy: null });
    const parts = [];
    for (let i = 0; i < (me.type === 'dev' ? 30 : 16); i++) {
      parts.push({ a: Math.random() * Math.PI * 2, v: 0.6 + Math.random() * 1.8, s: 1.5 + Math.random() * 3, spark: Math.random() < 0.3 });
    }
    fx.push({ x: me.x, y: me.y, r: d.radius, age: 0, parts });
    craters.push({ x: me.x, y: me.y, r: d.radius, age: 0 });
  }

  // ---------- Çizim yardımcıları ----------
  Meteors.drawCrystal = function (ctx, G, px, py, oz, time) {
    const big = oz >= mc(G).types.dev.oz ? 1.6 : 1;
    const s = 7 * big, pulse = 0.5 + 0.5 * Math.sin(time * 3 + px * 0.05);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px, py, 0, px, py, s * 2.6);
    g.addColorStop(0, 'rgba(242,193,78,' + (0.35 + 0.25 * pulse) + ')');
    g.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, s * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = G.cfg.colors.crystal; ctx.strokeStyle = 'rgba(80,50,0,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px, py - s * 1.3); ctx.lineTo(px + s, py); ctx.lineTo(px, py + s * 1.3); ctx.lineTo(px - s, py); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(px, py - s * 1.3); ctx.lineTo(px + s * 0.35, py - s * 0.1); ctx.lineTo(px - s * 0.2, py - s * 0.1); ctx.closePath(); ctx.fill();
  };

  // Zeminde dalgalanan kuzey ışığı (k: 0..1 yoğunluk, R: piksel yarıçap)
  function drawAurora(ctx, G, cx, cy, R, k, ang) {
    const c = G.cfg.colors, purple = c.auroraFar2 || 'rgba(170,110,240,0.22)', time = G.time;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, c.auroraFar); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const color = i % 2 ? purple : c.auroraFar;
      const base = (i - 2) * R * 0.22;
      let prev = null;
      for (let x = -R; x <= R + 0.1; x += 12) {
        const y = base + Math.sin(x * 0.028 + time * 1.4 + i * 1.7) * R * 0.16 + Math.sin(x * 0.07 - time * 2.1 + i) * R * 0.04;
        const f = 1 - Math.min(1, (x * x + y * y) / (R * R));
        if (prev && f > 0) {
          ctx.globalAlpha = k * f * 0.9;
          ctx.strokeStyle = color; ctx.lineWidth = 9;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
          // perde: ince dikey ışık çizgileri
          ctx.globalAlpha = k * f * 0.5; ctx.lineWidth = 2.5;
          const hgt = 10 + 14 * (0.5 + 0.5 * Math.sin(time * 3 + x * 0.1 + i));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - hgt); ctx.stroke();
        }
        prev = { x, y };
      }
    }
    ctx.restore();
  }

  function drawFocus(ctx, G, me, cx, cy, q) {
    const T = G.map.tile, d = mc(G).types[me.type], c = G.cfg.colors;
    const R0 = mc(G).auroraRadius * T * 0.6, R1 = d.radius * T;
    const r = R0 + (R1 - R0) * q, pulse = 0.5 + 0.5 * Math.sin(G.time * (8 + q * 10));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,200,90,' + (0.15 + 0.35 * q) + ')'); g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.auroraNear; ctx.lineWidth = 3 + 3 * q + pulse * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // vuruş alanı
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.4 * q) + ')'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, R1, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,220,150,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();
    if (me.type === 'dev') {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('DEV', cx, cy - r - 6); ctx.textAlign = 'left';
    }
  }

  Game.register({
    name: 'meteors',
    init(G) {
      waveNo = 0; spawned = false; warned = false; fx = []; craters = [];
      G.flags.nextWaveIn = mc(G).firstWave; G.flags.waveNo = 0;
    },
    update(G, dt) {
      const m = mc(G), kc = G.cfg.buildings.kule;
      G.flags.nextWaveIn -= dt;
      if (!warned && !spawned && G.flags.nextWaveIn <= m.auroraTime + 10) {
        warned = true;
        if (G.buildings.some((b) => b.type === 'kule' && b.hp > 0 && b.built !== false && (G.civilizationAccount?.(b.civ)||G).res.oz < kc.ozPerWave)) {
          Game.msg(G, `Dalgaya ${Math.round(G.flags.nextWaveIn)} sn: Çekim Kulesi için ${kc.ozPerWave} Öz gerekli!`, '#e67e22');
        }
      }
      if (!spawned && G.flags.nextWaveIn <= m.auroraTime) { spawned = true; spawnWave(G); }
      if (G.flags.nextWaveIn <= 0) { G.flags.nextWaveIn += m.interval; spawned = false; warned = false; }

      for (let i = G.meteors.length - 1; i >= 0; i--) {
        const me = G.meteors[i];
        me.t -= dt;
        if (me.t <= 0) { G.meteors.splice(i, 1); impact(G, me); }
      }
      fx.forEach((f) => (f.age += dt)); fx = fx.filter((f) => f.age < 1.6);
      craters.forEach((c) => (c.age += dt)); craters = craters.filter((c) => c.age < CRATER_LIFE);
    },
    // Zemin katmanı: krater izleri, ışıltılar, kule çekim ışınları, yerdeki kristaller
    draw(ctx, G) {
      const T = G.map.tile, m = mc(G);
      craters.forEach((c) => {
        const a = 1 - c.age / CRATER_LIFE;
        ctx.fillStyle = 'rgba(40,30,20,' + 0.35 * a + ')';
        ctx.beginPath(); ctx.ellipse(c.x * T, c.y * T, c.r * T * 0.8, c.r * T * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(230,215,190,' + 0.3 * a + ')'; ctx.lineWidth = 2; ctx.stroke();
      });
      G.meteors.forEach((me) => {
        const p = Meteors.displayPos(G, me), cx = p.x * T, cy = p.y * T;
        const R = m.auroraRadius * T;
        if (me.t > m.focusTime) {
          const k = 0.35 + 0.65 * clamp01(1 - (me.t - m.focusTime) / Math.max(0.1, m.auroraTime - m.focusTime));
          drawAurora(ctx, G, cx, cy, R, k, me.ang);
          // Kule çekiyorsa: ışıltıdan kuleye ışın
          const kule = me.kule && G.buildings.find((b) => b.id === me.kule && b.hp > 0);
          if (kule) {
            const kc = Game.center(kule);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = G.cfg.colors.auroraFar; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -G.time * 40;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(kc.x * T, kc.y * T); ctx.stroke();
            ctx.restore();
          }
        } else {
          const q = clamp01(1 - me.t / m.focusTime);
          drawAurora(ctx, G, cx, cy, R * (1 - 0.5 * q), (1 - q) * 0.7, me.ang);
          drawFocus(ctx, G, me, cx, cy, q);
        }
      });
      G.crystals.forEach((cr) => { if (!cr.carriedBy) Meteors.drawCrystal(ctx, G, cr.x * T, cr.y * T, cr.oz, G.time); });
    },
    // Binaların ve birimlerin üstünde kalması gerekenler: düşen meteor ve çarpma efektleri (kamera elle uygulanır)
    drawUI(ctx, G) {
      const T = G.map.tile;
      ctx.save();
      ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
      G.meteors.forEach((me) => {
        if (me.t > FALL) return;
        const k = me.t / FALL, big = me.type === 'dev' ? 1.8 : 1;
        const tx = me.x * T, ty = me.y * T;
        const hx = tx - 90 * k, hy = ty - 420 * k;
        const g = ctx.createLinearGradient(hx, hy, hx - 60, hy - 260);
        g.addColorStop(0, 'rgba(255,230,170,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 6 * big; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 60, hy - 260); ctx.stroke();
        ctx.fillStyle = '#fff4d6';
        ctx.beginPath(); ctx.arc(hx, hy, 5 * big, 0, Math.PI * 2); ctx.fill();
      });
      fx.forEach((f) => {
        const cx = f.x * T, cy = f.y * T, R = f.r * T;
        if (f.age < 0.3) {
          ctx.fillStyle = 'rgba(255,245,220,' + (1 - f.age / 0.3) * 0.85 + ')';
          ctx.beginPath(); ctx.arc(cx, cy, R * (0.4 + f.age * 3), 0, Math.PI * 2); ctx.fill();
        }
        if (f.age < 0.9) {
          ctx.strokeStyle = 'rgba(255,190,110,' + (1 - f.age / 0.9) + ')'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(cx, cy, R * (0.3 + f.age * 1.8), 0, Math.PI * 2); ctx.stroke();
        }
        const a = Math.max(0, 1 - f.age / 1.6);
        f.parts.forEach((p) => {
          const d = R * p.v * Math.min(1, f.age * 1.6);
          ctx.fillStyle = p.spark ? 'rgba(255,170,60,' + a + ')' : 'rgba(205,190,160,' + a * 0.8 + ')';
          ctx.beginPath(); ctx.arc(cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d - f.age * 10, p.s, 0, Math.PI * 2); ctx.fill();
        });
      });
      ctx.restore();
    },
  });
})();
