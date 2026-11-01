// ============================================================
// src/research.js  —  SAHİBİ: Kişi 2
// Araştırma Laboratuvarı kuyruğu ve ilerlemesi. Tasarım: GDD bölüm 10. Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] Research.enqueue(G, id): requires sağlanmışsa ve maliyet ödenebiliyorsa öde, G.research.queue'ya ekle
// [ ] Laboratuvar binası varsa sıradakini işle; hız = 1 + scientistBonus * (laboratuvardaki bilimci sayısı)
// [ ] Bitince G.research.done[id] = true ve Game.msg ile duyur
// [ ] Research.available(G): kuyruğa eklenebilecek araştırmalar (ui.js Laboratuvar panelinde listeler)
(function () {
  const Research = (window.Research = {});
  Research.enqueue = function (G, id) { return false; };
  Research.available = function (G) { return []; };
  Game.register({
    name: 'research',
    init(G) {},
    update(G, dt) {},
  });
})();
