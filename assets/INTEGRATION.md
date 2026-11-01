# Kişi 3 — Entegrasyon notları

Ortak oyun iskeleti ve `docs/CONTRACT.md` henüz bulunmuyor. Aşağıdaki arayüz geçicidir; ekip sözleşmesi geldiğinde uyarlanmalıdır. Bu teslim tam oynanabilir oyun değildir.

## Dosyalar ve önizleme

- `src/ui.js`: Canvas arayüzü, tıklamalar, üzerine gelme, paneller.
- `src/enemies.js`: akınlar, hedef seçimi, hasar, yağma, kaçış ve ödül.
- `assets/art.js`: özgün Canvas çizimleri; harici görsel kullanılmaz.
- `assets/preview.html`: sanat kataloğu; çift tıklayın.
- `assets/ui-preview.html`: etkileşimli arayüz provası; çift tıklayın.
- `assets/role3.test.cjs`: `node --test assets/role3.test.cjs`.
- `assets/browser-check.cjs`: Playwright kurulu ortamda `node assets/browser-check.cjs`; varsayılan Edge, `BROWSER_CHANNEL` ile değişir. Ekran görüntülerini assets klasöründe üretir.

## Modül ve veri varsayımları

`Game.register({name,init,update,draw,drawUI,onClick,onMouseMove})` kullanılır. `update(G,dt)` saniye alır. `draw(ctx,G)` dünya piksel uzayında, `drawUI(ctx,G)` ekran piksel uzayında çağrılır. `onClick(G,{sx,sy})` true dönerse harita işlemi yapılmamalıdır. Hız çarpanını ve duraklatmayı çekirdek uygular.

G alanları:

| Alan | Biçim |
| --- | --- |
| resources | `{oz,tas,kitin}` |
| time | Simülasyon saniyesi |
| paused, speed | boolean; 1, 2 veya 4 |
| over | `'win'` veya `'lose'` |
| stats.collectedOz | Toplam toplanan Öz |
| ui | `{selected,buildMode}`; selected doğrudan nesnedir |
| flags | `{nextWaveIn,nextRaidIn,raidNumber}` |
| map | `{width,height,tileSize}`; 60×40, 20 piksel varsayılan |
| buildings, units | `{type,x,y,hp,maxHp}` listeleri |
| crystals | `{x,y,amount}` listesi |
| messages | `{text,time}` listesi |

İşçinin `carrying` alanı sayı veya `{amount}` olabilir. Koloni bireyi `colonyId` taşır. Ölüm sonrası bina ve birim temizliği City/çekirdek sorumluluğundadır. Akıncı ölümü ve temizliği Enemies tarafından yapılır. Kristal yağması `amount` değerini azaltır; akıncı sınırdan kaçınca ödül verilmez. Ölen akıncı bounty ödülünü yalnızca bir kez verir.

Yardımcı imzaları: `Game.moveTo(entity,target,speed*dt)`, `Game.gain(G,{oz:amount})`, `Game.msg(G,text)`, `Game.canAfford(G,cost)`, `Game.costText(cost)`. Bu imzalar ortak sözleşmeyle doğrulanmalıdır.

CONFIG alanları:

- `buildings[id]`: `{name,cost,hp}`. Kimlikler merkez, ev, tasOcagi, cekimKulesi, karakol, taret, laboratuvar.
- `units[isci|asker|bilimci].cost`: besleme maliyeti.
- `research[id]`: `{name,cost}`.
- `enemies`: firstRaid, raidInterval, count, countGrowth, hp, speed, dps, range, bounty, stealAmount. Eksik ayarlarda geçici varsayımlar vardır; gerçek denge CONFIG üzerinden sağlanmalıdır.

API'ler: `City.feed(G,yavru,tip)`, `City.sendSoldier(G,karakol)`, `Research.available(G)` (kimlik veya `{id,name,cost,available}` listesi), `Research.enqueue(G,id)`, `Colonies.hunt(G,member)`. Eksik fonksiyonlar için düğmeler kapalıdır ve “yakında” yazar.

## Çizim entegrasyonu

`assets/art.js` dosyasını akıncı modülünden önce yükleyin. Akıncılar kütüphaneyi otomatik kullanır, bulunmazsa basit üçgen çizimine döner. Diğer modüller kendi nesneleri için şu çağrıyı kullanabilir:

```js
Art.draw(ctx, 'isci', xPixels, yPixels, sizePixels, {
  time: G.time, selected: true
});
```

Kimlikler: merkez, ev, tasOcagi, cekimKulesi, karakol, taret, laboratuvar, isci, asker, bilimci, yavru, yumurta, akinci, koloni, kralice, sarmasik, kristal, meteor, isiltı. `isiltı` için `{remaining:3}` altın-turuncu, `{remaining:15}` yeşil uyarı çizer. Tüm çizimler ctx durumunu korur.

## Kalan ortak çalışma

İskelet geldiğinde kayıt/yardımcı fonksiyon imzalarını, gerçek alan adlarını, dünya-kamera dönüşümünü, seçim ve mesaj zamanlarını doğrulayın. Kişi 1/2 dosyaları değiştirilmedi. Gerçek şehir, meteor, araştırma, sarmaşık ve koloni sistemleri olmadan baştan sona maç testi yapılamaz.
