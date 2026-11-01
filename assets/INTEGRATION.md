# Kişi 3 entegrasyonu

Güncel ortak sözleşme: `docs/CONTRACT.md`. Depodaki gerçek config/core ile uyarlama yapıldı. G.res, unit.kind, map.w/h/tile, crystal.oz, member seçim zarfı ve gerçek Game.moveTo(e,x,y,speed,dt) imzası kullanılır.

- `src/ui.js`: ekip deposundaki AoE arayüzü; mini harita, çoklu seçim, bağlamsal komutlar ve başlangıç ekranı. `assets/ui3d.js`: Three.js girişinin ayrı Canvas HUD'ı; kaynaklar, zamanlayıcılar, bina düğmeleri, bina/yavru/karakol/lab/koloni panelleri, besleme, av/çipleme, araştırma, hız/duraklatma, yardım ve sonuç ekranı. Eksik API'ler kapalıdır; toplam Öz istatistiği yoksa “Depodaki Öz” gösterilir.
- `src/enemies.js`: ekip deposundaki güncel AoE akıncı modülü; uyarı, zamanlama, hedefler, kristali süreyle sökme, sınırdan kaçma, ölümde bırakma ve tek bounty. Gerçek CONFIG ve City.guardedAt kullanır.
- `assets/art.js`: önceki özgün 2B çizim kütüphanesi; 2B akıncı modülü isteğe bağlı kullanır.
- `assets/art3d.js`, `three-game.js`: Three.js modelleri, PBR malzemeleri, arazi, ışık/gölge ve G senkronizasyon adaptörü. Birimler, binalar, düşmanlar, yerdeki kristaller, koloni bireyleri ve map.vine çizilir. Taşınan/tükenmiş kristaller ve çiplenip taşınan bireyler gizlenir.
- `assets/game3d.html`: gerçek config/core/dünya modülleriyle 3B entegrasyon başlatıcısı. Diğer kişilerin dosyalarını değiştirmeden alternatif giriş sunar. `assets/THREE-README.md` açılış komutlarını açıklar.

## Yeni 3B kontroller

assets/ui3d.js artık birim listesi, görünür görev düğmeleri, sağ üst mini harita ve ses denetimi sunar. Birim tıklaması küçük mesh üçgenleri yanında ekran üzerindeki tolerans alanını da kullanır. Görev düğmesinden sonra sol tık veya doğrudan sağ tık City komutlarına bağlanır; Shift ve kutu seçimi korunur.

assets/tasks3d.js, seçili işçilere dikdörtgen hasat alanı atar; işçilerin o alanın dışını biçmesi engellenir. Başarılı worker:true budaması CONFIG.vines.harvestYield üzerinden G.res.lif ve G.res.ozsu kazandırır. Bu oturuma özel Vines.prune sarmalayıcısı dispose sırasında geri alınır; orijinal Vines maliyet/kök/öfke kontrolleri korunur. CONFIG'e yalnızca harvestYield alanı eklendi.

assets/audio3d.js Web Audio ile özgün çarpma sesi sentezler. İlk kullanıcı etkileşiminde açılır; oyun hızı ses perdesini etkilemez. meteor3d.js onImpact callback'i üzerinden çağrılır. Hazır ses dosyası veya harici görsel varlık kullanılmaz.

Three.js dönüşümü kullanıcının açık isteğiyle yapılmıştır. 2B index.html korunur; yeni ES modülleri localhost sunucusundan açılır. Dünya koordinatları X/Z, yükseklik Y'dir. Görsel ölçek oyun kurallarından ayrıdır. Sabit sahne geometri birleştirme ve sarmaşık instancing ile çizilir.

## Kalan ekip işleri

Kişi 1'in şehir ve meteor davranışlarıyla 25 mantık/sistem testi, 180 saniyelik tarayıcı simülasyonu, doğal Öz zaferi, bilimciyle kraliçe zaferi ve 1200 saniyelik kontrollü stres testi geçti. Gerçek etkileşimli demoda 3B inşa, seçim, besleme, kısayollar, meteor uyarısı/çarpması, sonuç ve yeniden başlatma kontrol edildi. Bütün olası maçlar denenmedi; denge notları assets/TEST-REPORT.md'dedir. `index.html`, `src/core.js`, `src/main.js`, `src/city.js`, `src/meteors.js`, `data/config.js` ve Kişi 2 modüllerine yerel değişiklik yapılmadı; depodan gelen sürümleri kullanılır.

## Halk, kalıcı görevler ve LAN

`assets/civilization.js` ortak City API'sini 3B girişte genişletir; `city.update` için `externalOrder` alanı, `level` çarpanları ve ev `data.capacity` alanı eklendi. İnşaat işçileri emir kilidi taşır. `deposits` sınırlı taş yataklarıdır; `hastane`, `duvar`, `gozetleme` yapı tanımları bu modülde eklenir. `research.paid` gerçek ödenen araştırma bedellerini saklar. `G.civilizationAccount(id)` yalnız LAN sunucusunda bulunur; ortak ekonomi/araştırma kazançları ilgili medeniyete yönlenir, tek oyunculuda eski G üzerinden çalışır.

`lan-server.cjs` tek ortak tarafsız dünya ve medeniyet başına City/Research güncellemesi yürütür. Birimler/binalar `civ` ve `flag` taşır. İstemcinin kendi dizileriyle diğer medeniyetleri gösteren `visitors` ayrıdır; simülasyon sunucuya aittir. Ağ durumundaki hedef/yük nesneleri graph codec ile korunur, istemci varlıkları id'leriyle yerinde günceller. İstemci para/HP/durum gönderemez; yalnız izinli emirler gönderir. LAN başlatma/kullanım notları `LAN-README.md` içindedir.
