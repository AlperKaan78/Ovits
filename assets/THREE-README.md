# Three.js görsel katmanı

## Açılış

Depo kökünde `node assets/serve-preview.cjs` çalıştırın; tarayıcıda http://127.0.0.1:4173/assets/three-preview.html açın. Three.js ES modülleri nedeniyle çift tıklamayla file:// açılışı yerine yerel sunucu gerekir. İnternet veya npm kurulumu gerekmez; Three.js r180 yerelde sabitlenmiştir. Sunucu yalnızca 127.0.0.1 üzerinde dinler.

## Görsel içerik

18 özgün model türü: yedi yapı, işçi/asker/bilimci/yavru/yumurta, akıncı, koloni, kraliçe, sarmaşık, kristal, meteor. Ayrı taş bloklar, teraslar, merdivenler, pencere çerçeveleri, ekipman, eklemli bacaklar ve taşıyıcı metal aksam kodla modellenir. Yüzey renk ve kabartma haritaları deterministik olarak Canvas üzerinden üretilir. Stok model, fotoğraf, HDRI veya üçüncü taraf görsel dokusu kullanılmaz.

Fiziksel malzemeler, pürüzlülük/metallik, prosedürel yansıma ortamı, sıcak güneş/soğuk dolgu, yumuşak gölge, sis ve ACES ton eşleme kullanılır. Mevcut sonuç stilize gerçekçi oyun grafiğidir; fotogerçekçi insan taraması değildir.

Three.js bir yazılım bağımlılığıdır ve MIT lisanslıdır; bildirimi `vendor/THREE-LICENSE.txt` içinde korunur. Bu bağımlılığın lisansı ile özgün görsel varlıklar birbirinden ayrıdır. Özgün varlıklara bu çalışmada ayrıca bir lisans tanımı eklenmedi.

## Oyun entegrasyonu

`art3d.js` model fabrikasını (`createModel`), zemin fabrikasını (`createLandscape`), renderer kurulumunu (`createView`) ve sabit geometri birleştirmeyi (`batchStatic`) dışa aktarır. Dünya X/Z düzlemindedir; Y yüksekliktir. Bir oyun karesi bir dünya birimidir. `createModel` varsayılan olarak model ayrıntı ölçeğinde üretir; oyun adaptörü ölçekler.

`three-game.js`, mevcut G için bir adaptördür; simülasyonu yeniden yazmaz. Örnek:

```js
import {createGameView} from './assets/three-game.js';
const view=createGameView({
  canvas: document.querySelector('#world3d'),
  uiCanvas: document.querySelector('#ui'),
  onMapClick(G,info) { /* info.x, info.y, info.entity ile çekirdeğin işlemini çağırın */ }
});
// Ana döngüde simülasyondan sonra:
view.render(G);
// UI canvas dünya canvas'ının üstünde absolute konumlanmalı ve pointer-events:none olmalı.
// Eski 2B dünya çizimi bu modda çağrılmamalı; UI.drawUI aynı kalır.
```

Adaptör buildings, units, enemies, crystals listelerini senkronize eder, kaldırılan modelleri temizler, seçimi raycast ile yapar ve ekran tıklamalarını önce UI'ye verir. Bina kurma kurallarını çekirdek uygulamalıdır. Ortak sözleşme henüz gelmediği için gerçek oyunda entegrasyon doğrulanmadı. Sarmaşık ve koloni veri listelerinin şemaları belirlenince aynı senkronizasyona eklenmelidir.

## Doğrulama

`node --test assets/role3.test.cjs`: 9 mevcut mantık testi. Playwright kurulu ortamda `node assets/three-check.cjs`: WebGL, 17 seçim/model geçişi, döndürme, sürükleme, tekerlek, responsive resize; sayfa hataları denetlenir ve PNG'ler üretilir. Test kendi localhost sunucusunu başlatır, port 4173 boş olmalıdır.

Statik dünya materyale göre birleştirildi: ilk tarayıcı ölçümünde 2903 olan sahne çizim çağrısı 39'a düştü. Bu sayı FPS ölçümü değildir ve donanım performans garantisi vermez. Test görüntüleri `three-settlement.png`, `three-isci.png`, `three-kralice.png`, `three-cekimKulesi.png`, `three-mobile.png`.
