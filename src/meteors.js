// ============================================================
// src/meteors.js  —  SAHİBİ: Kişi 1
// Meteor dalgaları, zemindeki kuzey ışığı ışıltısı, çarpma, Öz kristali,
// Çekim Kulesi'nin meteor çekmesi. Tasarım: GDD bölüm 5. Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] Dalga zamanlayıcı: ilk firstWave, sonra interval; G.flags.nextWaveIn (ui.js gösterir)
// [ ] Dalga başında her meteor için hedef seç (rastgele kare). Kule varsa ve ozPerWave Öz ödenebiliyorsa
//     her meteor pullChance (Geniş Çekim araştırıldıysa researchValues.genisCekimPull) olasılıkla kulenin landRadius çevresine
// [ ] Meteor Kalkanı araştırıldıysa (G.research.done.meteorKalkan) Merkez'in kalkanRadius çevresindeki hedefleri uzağa kaydır
// [ ] G.meteors: { x, y, type:'kaya'|'dev', t } — t: düşmeye kalan süre (auroraTime'dan geri sayar)
// [ ] Çizim: t > focusTime iken geniş, dalgalanan yeşil-mor ışık; son focusTime saniyede altın-turuncu daralan halka
// [ ] t <= 0: Game.damageArea (Çekim Kulesi'ni atla), G.crystals.push({ id, x, y, oz, carriedBy:null })
// [ ] Kristalleri altın elmas olarak çiz
(function () {
  Game.register({
    name: 'meteors',
    init(G) { G.flags.nextWaveIn = G.cfg.meteors.firstWave; },
    update(G, dt) {},
    draw(ctx, G) {},
  });
})();
