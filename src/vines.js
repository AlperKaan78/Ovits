// ============================================================
// src/vines.js  —  SAHİBİ: Kişi 2
// Mor sarmaşığın yayılması, binalara hasarı ve budama. Tasarım: GDD bölüm 7.
// Veri: G.map.vine (Uint8Array, 1 = sarmaşık). Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] init: CONFIG.vines.roots karelerini sarmaşıkla işaretle (kökler temizlenemez)
// [ ] Her spreadEvery saniyede her sarmaşık karesi spreadChance olasılıkla bir komşuya yayılır (maxCover sınırı)
// [ ] Sarmaşıklı kareye değen (üstünde ya da bitişiğinde) bina damagePerSec can kaybeder
// [ ] onClick: sarmaşıklı kareye tıklanırsa ve oyuncunun bir binası pruneRange içindeyse pruneCost öde, kareyi temizle, true dön
// [ ] Çizim: mor kıvrık gövde + mavi yaprak noktaları
(function () {
  Game.register({
    name: 'vines',
    init(G) {},
    update(G, dt) {},
    draw(ctx, G) {},
    onClick(G, info) { return false; },
  });
})();
