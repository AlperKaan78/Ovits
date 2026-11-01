# Three.js görsel katmanı

## Açılış

Depo kökünde `node assets/serve-preview.cjs` çalıştırın; tarayıcıda http://127.0.0.1:4173/assets/three-preview.html açın. Three.js ES modülleri nedeniyle çift tıklamayla file:// açılışı yerine yerel sunucu gerekir. İnternet veya npm kurulumu gerekmez; Three.js r180 yerelde sabitlenmiştir. Sunucu yalnızca 127.0.0.1 üzerinde dinler.

Oynanabilir giriş: http://127.0.0.1:4173/assets/game3d.html . Soldaki listeden veya haritadan birim seçin; sağdaki görev düğmesiyle hedefe sol tıklayın ya da doğrudan hedefe sağ tıklayın. İşçi için “Sarmaşık biç / topla” seçip alanı sürükleyin. Sağ üst mini harita kamerayı taşır. WASD/oklar ve tekerlek kamerayı kontrol eder. Ses ilk etkileşimde etkinleşir; HUD'dan kapanır.

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
// Three.js girişinde assets/ui3d.js yüklenir; src/ui.js, 2B AoE girişinde kullanılır.
```

Adaptör buildings, units (kind), enemies, crystals (oz), colonies.members ve map.vine verilerini gerçek ortak sözleşmeyle senkronize eder, kaldırılan modelleri temizler, seçimi raycast ile yapar ve ekran tıklamalarını önce 3B HUD'a verir. İnşa önizlemesi City.canPlace kurallarını izler; yerleştirmeyi City uygular. Kutu seçimi ve sağ tık emirleri güncel City.command'a bağlanır; inşaat ilerlemesi model yüksekliğine yansır. Meteor uyarıları, düşüş ve çarpma/krater efektleri meteor3d.js içindedir. `assets/game3d.html` gerçek ekip modüllerini ve assets/ui3d.js'yi yükler; ana index.html ve diğer kişilerin dosyaları değiştirilmez. Bu girişin simülasyon döngüsü güncel core kurallarını izler; çekirdek değişince beraber güncellenmelidir. Son kapsamlı kontroller için TEST-REPORT.md'ye bakın.

## Doğrulama

`node --test assets/role3.test.cjs assets/gameplay.test.cjs`: gerçek ortak sözleşmeyle 25 mantık/sistem testi. Playwright kurulu ortamda `node assets/three-check.cjs`: WebGL, 17 seçim/model geçişi, kamera, boyut değişimi, adaptör yaşam döngüsü ve gerçek modüllerle 180 saniyelik simülasyon. `node assets/demo-check.cjs`: gerçek tıklama/klavyeyle 3B oyun akışları ve 2B file:// uyumluluğu. Testler 4174 ve 4175 portunda kendi sunucularını açar; ana önizleme açık kalabilir. Browser-check eski önizlemeleri sınar ve ekran görüntülerini geçici dizine yazar (TEST_OUTPUT_DIR ile değişir).

Güncel toplam 29 Node testi vardır. `node assets/commands-check.cjs` ayrı 4176 portunda üç birim rolünün emirlerini, alan hasadını/kaynakları, mini haritayı ve meteor sesini sınar. Bu test varsayılan Playwright Chromium Headless Shell'i kullanır; yerel test tarayıcısının konumu PLAYWRIGHT_BROWSERS_PATH ile verilebilir. Önceki Edge/Chrome profil sorunlarında ayrı test Chromium'u tercih edilmiştir.

Statik dünya materyale göre birleştirildi: ilk tarayıcı ölçümünde 2903 olan sahne çizim çağrısı 39'a düştü. Bu sayı FPS ölçümü değildir ve donanım performans garantisi vermez. Test görüntüleri `three-settlement.png`, `three-isci.png`, `three-kralice.png`, `three-cekimKulesi.png`, `three-mobile.png`.
