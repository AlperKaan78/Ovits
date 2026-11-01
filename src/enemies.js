// ============================================================
// src/enemies.js  —  SAHİBİ: Kişi 3
// Kül Göçebeleri akınları. Tasarım: GDD bölüm 9. Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] Akın zamanlayıcı: firstRaid, sonra interval; boyut baseSize + growPerRaid * akınSayısı; G.flags.nextRaidIn
// [ ] Sağ, üst ya da alt kenardan rastgele doğsunlar: G.enemies.push({ id, x, y, hp, maxHp, target:null })
// [ ] Hedef sırası: Çekim Kulesi -> kristal taşıyan işçi -> karakol -> en yakın bina -> Merkez
// [ ] Menzile girince dps hasar; korunmasız yer kristaline (karakol guardRadius dışında) ulaşırsa çalıp kaybolur
// [ ] Ölen akıncı bounty kadar Öz verir
// [ ] Çizim: gri-siyah üçgen + can çubuğu
(function () {
  Game.register({
    name: 'enemies',
    init(G) { G.flags.nextRaidIn = G.cfg.enemies.firstRaid; },
    update(G, dt) {},
    draw(ctx, G) {},
  });
})();
