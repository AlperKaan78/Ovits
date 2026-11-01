// ============================================================
// src/colonies.js  —  SAHİBİ: Kişi 2
// Eklem bacaklı koloniler: dolaşma, saldırılınca karşılık verme, av, Kitin,
// bayılma, nöro-çip ile yakalama ve kraliçe. Tasarım: GDD bölüm 8. Sözleşme: docs/CONTRACT.md
// ============================================================
// YAPILACAKLAR
// [ ] init: CONFIG.colonies.list için G.colonies.push({ id, queen:{x,y}, hostileUntil:0, kills:0, members:[] })
//     members: { id, role:'toplayici'|'muhafiz'|'kralice', x, y, hp, maxHp, state:'wander'|'fainted'|'chipped' }
// [ ] Toplayıcılar orman kenarında / düzlükte dolaşır; muhafızlar kraliçenin guardRadius çevresinde bekler
// [ ] Colonies.hunt(G, member): koloniyi hostileTime boyunca düşman yap; huntSoldiers asker o bireye saldırır
//     (asker davranışı city.js'de: askerler Colonies.hostileMembers(G) listesini de hedef alır)
// [ ] Ölen birey: G.res.kitin += 1, colony.kills += 1. Kitin Ağı araştırıldıysa can faintBelow altına inince ölmez, 'fainted' olur
// [ ] Nöro-çip araştırıldıysa bayılmış bireye tıklama -> City.orderChip(G, member); çip süresi = max(chipTimeMin, chipTime - kills)
// [ ] Çiplenen toplayıcı oyuncunun 'tasiyici' birimi olur (işçi gibi, tasiyiciSpeedMul kat hızlı); muhafız 'asker' gibi savaşır
// [ ] Kraliçe Çipi ile kraliçe çiplenirse G.over = 'win'
// [ ] onClick: bir bireye tıklanırsa G.ui.selected = { type:'member', member, colony } ve true dön
// [ ] Çizim: altı bacaklı elips; notr yeşil, düşman kırmızı, çipli turuncu; kraliçe büyük
(function () {
  const Colonies = (window.Colonies = {});
  Colonies.hostileMembers = function (G) { return []; };
  Game.register({
    name: 'colonies',
    init(G) {},
    update(G, dt) {},
    draw(ctx, G) {},
    onClick(G, info) { return false; },
  });
})();
