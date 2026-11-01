// ============================================================
// src/city.js  —  SAHİBİ: Kişi 1
// Binalar (kurma, üretim, taret), yumurta -> yavru -> kişilik,
// İşçi / Asker / Bilimci davranışları, karakol, asker bakımı.
// Tasarım: GDD bölüm 5 (karakol), 6 (şehir ve halk). Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] Kurma modu: G.ui.buildMode = 'ev' iken haritaya tıklayınca Game.isFree + Game.pay ile kur
//     (Çekim Kulesi Merkez'e minDistFromMerkez'den yakın olamaz; geçerli yer yeşil, değilse kırmızı önizleme)
// [ ] Merkez ve Taş Ocağı Taş üretir (tasPerSec)
// [ ] Ev: eggEvery saniyede bir yanına 'yumurta' birimi (en fazla maxEggs bekleyen)
// [ ] Yumurta hatchTime sonra 'yavru' olur; yavruya tıklanınca G.ui.selected = yavru (panel ui.js'de)
//     City.feed(G, yavru, 'isci'|'asker'|'bilimci') -> maliyeti öde, growTime sonra yetişkin olur
// [ ] İşçi: en yakın sahipsiz kristali (G.crystals) alır, Merkez'e götürür, Öz ekler
// [ ] Asker: en yakın düşmana (G.enemies, düşman koloni bireyleri) menzilde ateş eder; boştaysa Merkez yanında bekler
// [ ] Karakol: City.sendSoldier(G, karakol) -> boştaki en yakın asker gider; bakım dakikada 1 / karakolda 2 Öz
// [ ] Taret: menzildeki en yakın düşmana dps hasar
// [ ] Bilimci: Laboratuvar varsa oraya gider (research.js hızlandırmayı sayar); City.orderChip(G, hedef) ile çip takmaya gider
(function () {
  const City = (window.City = {});

  City.unitCenter = (u) => ({ x: u.x, y: u.y });

  Game.register({
    name: 'city',
    init(G) {
      const s = G.cfg.start;
      Game.addBuilding(G, 'merkez', s.merkez.x, s.merkez.y);
      Game.addBuilding(G, 'ev', s.ev.x, s.ev.y);
      const mk = Game.center(Game.merkez(G));
      for (let i = 0; i < s.isci; i++) {
        Game.addUnit(G, { kind: 'isci', owner: 'player', x: mk.x + 1.5, y: mk.y + i - 0.5, hp: G.cfg.units.isci.hp, state: 'idle' });
      }
    },
    update(G, dt) {
      // Örnek: Merkez Taş üretir. Kalan davranışlar Kişi 1'in görevi.
      G.buildings.forEach((b) => {
        const d = G.cfg.buildings[b.type];
        if (d.tasPerSec) G.res.tas += d.tasPerSec * dt;
      });
    },
    draw(ctx, G) {
      const T = G.map.tile, c = G.cfg.colors;
      G.buildings.forEach((b) => {
        const px = b.x * T, py = b.y * T, s = b.size * T;
        ctx.fillStyle = c.player; ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 6, py + 6, s - 12, s - 12);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(G.cfg.buildings[b.type].ad[0], px + s / 2, py + s / 2 + 5);
        ctx.textAlign = 'left';
        if (b.hp < b.maxHp) { // can çubuğu
          ctx.fillStyle = '#300'; ctx.fillRect(px, py - 5, s, 3);
          ctx.fillStyle = '#4caf50'; ctx.fillRect(px, py - 5, s * Math.max(0, b.hp / b.maxHp), 3);
        }
      });
      G.units.forEach((u) => {
        if (u.owner !== 'player') return;
        ctx.fillStyle = c[u.kind] || '#fff';
        ctx.beginPath(); ctx.arc(u.x * T, u.y * T, T * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.stroke();
      });
    },
  });
})();
