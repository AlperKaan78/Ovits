// ============================================================
// src/ui.js  —  SAHİBİ: Kişi 3
// Kaynak çubuğu, dalga / akın sayaçları, bina çubuğu, seçim paneli,
// mesajlar, kazandın / kaybettin ekranı. Tasarım: GDD bölüm 11 ve 12. Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] Üst çubuk: Öz / Taş / Kitin, G.flags.nextWaveIn ve G.flags.nextRaidIn, duraklatma ve hız
// [ ] Alt bina çubuğu: CONFIG.buildings ('merkez' hariç) için düğme + maliyet; tıklayınca G.ui.buildMode = tip
//     (parası yetmiyorsa soluk göster)
// [ ] Sağ panel (G.ui.selected): bina adı ve canı;
//     yavru -> üç besin düğmesi (City.feed); karakol -> "Asker gönder" (City.sendSoldier);
//     laboratuvar -> Research.available listesi (Research.enqueue); koloni bireyi -> "Avla" (Colonies.hunt) / "Çiple"
// [ ] Mesajlar: G.messages son 5 tanesi, 8 saniye sonra solar
// [ ] G.over -> ortada büyük "Kazandın" / "Kaybettin" ve "Yeniden başlat" (location.reload())
// [ ] onClick: önce kendi düğmelerine bak, tıklandıysa true dön (dünya tıklamasını engeller)
// ÖNEMLİ: ui.js en son yüklenir, bu yüzden onClick'i dünya modüllerinden önce çalışır.
(function () {
  const UI = (window.UI = {});
  Game.register({
    name: 'ui',
    drawUI(ctx, G) {
      // Geçici: core.js'deki yedek göstergenin aynısı. Kişi 3 bunu gerçek arayüzle değiştirir.
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, ctx.canvas.width, 28);
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
      ctx.fillText(`Öz ${Math.floor(G.res.oz)}   Taş ${Math.floor(G.res.tas)}   Kitin ${G.res.kitin}   ` +
        `Dalga ${Math.ceil(G.flags.nextWaveIn || 0)} sn   Akın ${Math.ceil(G.flags.nextRaidIn || 0)} sn` +
        (G.paused ? '   [DURAKLATILDI]' : ''), 10, 19);
    },
    onClick(G, info) { return false; },
  });
})();
