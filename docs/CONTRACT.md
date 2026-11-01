# Ortak sözleşme (üç kişi de buna uyar)

Oyun tek bir `index.html` ve sırayla yüklenen düz JavaScript dosyalarından oluşur. Kurulum yok: `index.html`'e çift tıklayın, tarayıcıda açılır. Herkes yalnızca **kendi dosyalarını** değiştirir, böylece Git'te çakışma olmaz.

## Dosyalar ve sahipleri

| Dosya | Sahibi | İçerik |
| --- | --- | --- |
| `index.html`, `src/core.js`, `src/main.js` | Kişi 1 | Durum, döngü, kamera, girdi, yardımcılar |
| `src/city.js` | Kişi 1 | Binalar, yumurta/yavru/kişilik, işçi, asker, bilimci, karakol, taret |
| `src/meteors.js` | Kişi 1 | Dalgalar, zemin ışıltısı, çarpma, kristal, Çekim Kulesi |
| `data/config.js` | Kişi 2 | Bütün sayılar ve renkler |
| `src/vines.js` | Kişi 2 | Sarmaşık yayılması, hasar, budama |
| `src/colonies.js` | Kişi 2 | Koloniler, av, Kitin, bayılma, çip, kraliçe |
| `src/research.js` | Kişi 2 | Laboratuvar kuyruğu |
| `src/ui.js` | Kişi 3 | Kaynak çubuğu, bina çubuğu, seçim paneli, mesajlar, oyun sonu |
| `src/enemies.js` | Kişi 3 | Kül Göçebeleri akınları |
| `assets/` | Kişi 3 | (İsteğe bağlı) görseller ve sesler |

## Modül biçimi

```js
(function () {
  Game.register({
    name: 'meteors',
    init(G) {},            // oyun başında bir kez
    update(G, dt) {},      // her karede; dt saniye (oyun hızı dahil)
    draw(ctx, G) {},       // dünya çizimi; koordinat = kare * G.map.tile (kamera core.js'de uygulanır)
    drawUI(ctx, G) {},     // ekran çizimi (kamera yok)
    onClick(G, info) {},   // info: { sx, sy, wx, wy, tx, ty, button }; tıklamayı kullandıysan true dön
    onKey(G, key) {},
  });
})();
```

Başka modüllerin çağırması gereken fonksiyonları `window.City`, `window.Colonies`, `window.Research`, `window.UI` nesnelerine koyun.

## Oyun durumu `G`

| Alan | Açıklama |
| --- | --- |
| `G.cfg` | `CONFIG` (data/config.js) |
| `G.time`, `G.speed`, `G.paused`, `G.over` | Süre (sn), hız (1/2), duraklatma, `null` / `'win'` / `'lose'` |
| `G.res` | `{ oz, tas, kitin }` |
| `G.map` | `{ w, h, tile, terrain[], vine: Uint8Array }`; terrain: `'rock'`, `'plain'`, `'forest'` |
| `G.buildings` | `{ id, type, x, y, size, hp, maxHp, data:{} }` (x, y = sol üst kare) |
| `G.units` | Oyuncu birimleri `{ id, kind, owner:'player', x, y, hp, maxHp, ... }`; kind: `yumurta`, `yavru`, `isci`, `asker`, `bilimci`, `tasiyici` |
| `G.enemies` | Akıncılar `{ id, x, y, hp, maxHp, target }` |
| `G.colonies` | `{ id, queen:{x,y}, hostileUntil, kills, members:[{ id, role, x, y, hp, maxHp, state }] }` |
| `G.meteors` | Düşmekte olan meteorlar `{ x, y, type, t }` |
| `G.crystals` | Yerdeki Öz kristalleri `{ id, x, y, oz, carriedBy }` |
| `G.research` | `{ done:{}, queue:[], current, progress }` |
| `G.messages` | `{ text, color, t }` (Game.msg ile eklenir) |
| `G.ui` | `{ buildMode, selected, selection, tool, drag, hudTop, hudBottom, mouse }` — `selection`: seçili oyuncu birimleri (kutu seçimi), `selected`: ilk birim ya da tek seçilen bina / koloni bireyi, `tool`: `'prune'` (budama aracı) |
| `G.flags` | Paylaşılan küçük değerler: `nextWaveIn`, `nextRaidIn`; vines.js yazar: `vineCover`, `vineAnger` (0..1), `night` (0..1, gece karartmasını vines.js çizer) |

Birim alanları:

- `Colonies.hunt` en yakın boştaki (karakolda olmayan) askerlere `u.huntTarget = member.id` yazar; asker varsa önce o bireye gitmeli, birey ölünce ya da bayılınca alanı temizlemeli.
- Çiplenen toplayıcı `kind: 'tasiyici'` (işçi gibi kristal taşır, `colonies.tasiyiciSpeedMul` kat hızlı), çiplenen muhafız `kind: 'savasci'` (asker gibi savaşır, bakım istemez) olarak `G.units`'e eklenir.
- Koloni bireyi seçilince `G.ui.selected = { type: 'member', member, colony }`; `member.state`: `'wander'`, `'attack'`, `'flee'` (yuvaya kaçıyor), `'fainted'`. Koloninin `ad` (Taşkabuk / Yaprakçı) ve `type` alanları vardır.
- Çiplenen birimin `fromColony` alanı koloni kimliğidir; Yaprakçı'dan gelenler üstünden geçtikleri sarmaşığı kendiliğinden yer (colonies.js).
- İşçi ve taşıyıcının `carrying` alanı taşıdığı kristal ya da `null`; laboratuvarda çalışan bilimcinin `state` alanı `'lab'` (research.js hız için sayar).

- Binanın `built` alanı `false` ise inşaat sürüyor (`progress` saniye); kurulmamış bina üretmez, ateş etmez, kuleyse meteor çekmez. Eski binalarda alan yoksa kurulu sayılır (`City.isBuilt(b)`).
- Oyuncu biriminin `order` alanı (`move`, `attack`, `gather`, `build`, `prune`, `post`, `lab`) sağ tık emridir; `anchor` gönderildiği yerdir.

## Girdi (AoE tarzı)

Sol tık / sürükle: seç (core.js kutu seçimini yapar). Sağ tık: modüllerin `onClick`'i `button: 2` ile çağrılır; city.js seçili birimlere `City.command` ile emir verir. Bir modül `onMouseDown(G, info)` içinde `true` dönerse fare onda kalır ve `onMouseDrag` / `onMouseUp` alır (ui.js paneli ve mini harita). `Game.centerOn(G, x, y)` kamerayı bir kareye ortalar.

Konumlar **kare** cinsindendir ve ondalıklı olabilir (birimler için merkez noktası).

## core.js yardımcıları

`Game.dist`, `Game.center(b)`, `Game.merkez(G)`, `Game.inMap`, `Game.idx`, `Game.buildingAt`, `Game.isFree(G, tx, ty, size)`, `Game.addBuilding(G, type, tx, ty)`, `Game.addUnit(G, u)`, `Game.nearest(list, x, y, filter)`, `Game.moveTo(e, tx, ty, speed, dt)`, `Game.damageArea(G, x, y, r, dmg, {skip})`, `Game.canAfford(G, cost)`, `Game.pay(G, cost)`, `Game.gain(G, res)`, `Game.costText(cost)`, `Game.msg(G, text, color)`, `Game.newId()`.

Ölü nesneleri (hp ≤ 0) core.js her karede temizler; kazanma (500 Öz) ve kaybetme (Merkez yıkıldı) kontrolü de core.js'dedir. Kraliçe çiplenince colonies.js `G.over = 'win'` yapar.

## Kişiler arası çağrılar

| Çağrı | Yazan | Çağıran |
| --- | --- | --- |
| `City.feed(G, yavru, tip)` (tip: `'isci'`, `'asker'`, `'bilimci'`) | Kişi 1 | ui.js |
| `City.sendSoldier(G, karakol)` | Kişi 1 | ui.js |
| `City.orderChip(G, member, sure, bilimci?)` (sure saniye; boşta bilimci yoksa `false` döner) | Kişi 1 | colonies.js |
| `City.command(G, birimler, info)`, `City.release(G, birimler)`, `City.feedNext(G, tip)`, `City.idleWorkers(G)`, `City.unfedYavrus(G)`, `City.isBuilt(b)`, `City.guardedAt(G, x, y)` | Kişi 1 | ui.js, enemies.js |
| `Colonies.hunt(G, member, askerler?)` | Kişi 2 | ui.js, city.js (sağ tık) |
| `Colonies.chipDone(G, member)` (bilimci çipi bitirince birey oyuncuya geçer) | Kişi 2 | city.js |
| `Vines.seed(G, x, y, r)` (r kare yarıçapında hızlı sarmaşık filizlenmesi; ör. kara meteor) | Kişi 2 | meteors.js (isteğe bağlı) |
| `Research.moveUp(G, id)`, `Research.cancel(G, id)` (sırayı değiştir / iptal et, bedel iade) | Kişi 2 | ui.js (laboratuvar paneli) |
| `Colonies.hostileMembers(G)` (avlanan birey listenin başında) | Kişi 2 | city.js (askerler, taretler) |
| `Colonies.tryChip(G, member, bilimci?)` ("Çiple" düğmesi; uygun değilse nedenini mesaj olarak yazar) | Kişi 2 | ui.js, city.js (sağ tık) |
| `Colonies.canChip(G, member)` → `{ ok, reason }`, `Colonies.chipTimeFor(G, member)` | Kişi 2 | ui.js |
| `Research.info(G)` → `{ ad, pct, speed, queue }` ya da `null` | Kişi 2 | ui.js |
| `Vines.prune(G, tx, ty)`, `Vines.has(G, tx, ty)` | Kişi 2 | (sarmaşığa tıklamayı vines.js kendisi yakalar) |
| `Research.enqueue(G, id)`, `Research.available(G)` (her öğe `{ id, ad, costText, time, effect, ok, reason }`; `ok` false ise düğme soluk, `reason` gösterilir) | Kişi 2 | ui.js |

Bir çağrı henüz yazılmadıysa `if (window.City && City.feed)` gibi kontrol edin; oyun yine çalışsın.
