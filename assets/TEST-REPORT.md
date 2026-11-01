# Tam demo kontrolü — 1 Kasım 2026

GitHub'daki son main sürümü indirildi. Kontrol sırasında gelen f543b78/e0f8f35 AoE güncellemesi de alındı; yeni kutu seçimi, sağ tık emirleri, inşaat süreleri ve dengeyle testler tekrar geçirildi. Kaynak ui.js/enemies.js dosyalarının yeni AoE sürümleri korundu; 3B HUD assets/ui3d.js olarak ayrıldı.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| `node --test assets/role3.test.cjs assets/gameplay.test.cjs` | 25/25 geçti |
| `node assets/three-check.cjs` | 17 model geçişi, WebGL, kamera, boyut değişimi, adaptör ve 180 saniyelik simülasyon geçti |
| `node assets/demo-check.cjs` | Gerçek fare/klavye etkileşimleriyle 3B demo ve file:// üzerinden 2B giriş geçti; sayfa/konsol hatası yok |
| `node assets/browser-check.cjs` | Önceki 2B sanat kataloğu ve arayüz önizlemeleri geçti |
| JavaScript sözdizimi | src/data/assets altındaki JS/CJS dosyaları kontrol edildi |

Playwright testleri bu makinede kurulu Edge ile çalıştırıldı. Browser testleri için Playwright'ın Node modül yolunda bulunması gerekir. Ana önizleme 4173, üç boyut testleri 4174, etkileşim testleri 4175 portunu kullanır.

## Oyun sistemi kapsamı

- İnşa maliyeti, doluluk, sınır ve Çekim Kulesi uzaklık kuralı.
- Yumurtadan çıkış, üç farklı besinle yetişkin olma, tek sefer ödeme.
- İşçinin gerçek kristali taşıyıp aynı miktar Öz'ü depolaması.
- Ön uyarı, meteor çarpması, kristal oluşumu, kulede dalga başına ödeme ve çekilen meteor menzili.
- Akın zamanı/büyüklüğü, kimlikler, hedef önceliği, hareket, hasar, taret ölümü, tek bounty, korunmuş/korunmamış kristaller ve taşıyıcı yağması.
- Araştırma kuyruğu, önkoşullu sıralama, iptal/iade ve tamamlanma.
- Sarmaşık budama maliyeti ve erişim menzili.
- Av/bayılma/çip dönüşümü; bilimcinin gerçek çip yolculuğuyla kraliçe zaferi.
- Bina seçme, besleme düğmesi, duraklatma/1×–3× hız, sağ tık iptal, bina/yiyecek kısayolları, kazanma/kaybetme ve sayfa yeniden başlatma.
- 3B kutu seçimi, sağ tık hareket emri, Shift seçimi desteği ve Escape ile çoklu seçimi temizleme. Yeni 2B AoE giriş ekranı Enter ile başlatılarak kontrol edildi.

## Uzun simülasyon

Güncel AoE sürümünde sabit seed 97 ile otomatik beslenen senaryo doğal Öz zaferine yaklaşık 540. saniyede ulaştı. Ayrıca yalnızca stres testi amacıyla zafer eşiği ve Merkez canı yükseltilerek 1200 saniyelik ufuk tamamlandı; kaynaklar ve nesne konumları sonlu, kaynaklar sıfır veya üstünde kaldı. Bu ikinci senaryo normal oyun dengesi ölçümü değildir.

## Bulunan ve düzeltilenler

- **assets/three-game.js, meteor3d.js:** 3B'de eksik meteor uyarısı/düşüş/çarpma/krater çizimleri eklendi; zaman ve konum gerçek meteor modülünden alınır.
- **assets/game3d.js, three-game.js:** City kısayolları, sağ tık iptal ve fare dünya koordinatları bağlandı; görünen modelin arkasındaki zemin yerine doğru nesne seçilir.
- **assets/three-game.js:** seçim halkası, hasar can çubuğu, taşınan kristal ve geçerli/geçersiz inşa önizlemesi eklendi.
- **assets/art3d.js:** oynanabilir alandaki dekoratif dev kayalar kaldırıldı ve zemin düzleştirildi; görsel engellerin gerçekte boş kareleri kapatması engellendi.
- **src/enemies.js:** depodan gelen AoE sürümü korunur; City.guardedAt kullanımı, CONFIG.stealTime ile sökme süresi, fiziksel kaçış, ölen yağmacının kristali bırakması ve tek bounty doğrulandı.
- **assets/ui3d.js:** 3B HUD'da hover, uzun mesajların panelde kırpılması, koloni/rol adları ve kraliçe için av düğmesinin kapanması düzeltildi. src/ui.js içindeki ekip AoE HUD'ı korunur.
- **assets/serve-preview.cjs:** favicon isteği boş yanıtla karşılanır; konsoldaki gereksiz 404 giderildi.
- **Test betikleri:** yeniden başlatmada G henüz oluşmadan yapılan kontrol düzeltildi; eski sanat önizlemesi testi kilitli PNG üzerine yazmak yerine geçici çıktı kullanır.

## Görsel kontrol ve sınırlar

demo-warning.png, demo-win.png, demo-lose.png ve demo-2d.png incelendi. Yeni sahne, model kataloğu ve uyarlanabilir boyut önizlemeleri de test edildi. Kaynak kod testleri ve kontrollü tarayıcı senaryoları, insan tarafından oynanmış her olası maçın hatasız olduğunu garanti etmez.

Denge notu (Kişi 2 / data/config.js): otomatik beslenen seed 97 senaryosunun yaklaşık 9 dakikada Öz zaferi alması, görev belgesindeki 15–20 dakika hedefinden kısadır. Sayı ayarları sahiplik sınırı gereği değiştirilmedi; bu sonuç denge gözden geçirmesinde kullanılmalıdır.

Üç boyutlu giriş assets/game3d.html, orijinal giriş index.html'dir. İki sürüm de kontrol edildi. Kişi 1/2 kaynak dosyaları değiştirilmedi.

## Nüfus ve asker üretimi düzeltmesi

Son kullanıcı geri bildirimi sonrası 3B HUD'a sürekli nüfus paneli, yumurta/kuluçka/büyüme sayaçları ve yavru seçmeden İşçi/Asker/Bilimci yetiştirme düğmeleri eklendi. Ev/Merkez seçiminde de yetiştirme eylemleri bulunur. Duraklatılmış oyun ve eksik kaynak/yavru durumları açıklanır; temel nüfus kuralları değiştirilmedi.

Güncel Node sonucu **26/26 başarılı**: ek regresyon testi doğal ev yumurtasının açılmasını bekler, HUD'daki gerçek Asker düğmesine tıklama gönderir ve kaynak bedeli, yetişkin sayısı ve asker sayısının artmasını doğrular. Bu ek turdaki tarayıcı doğrulaması Windows tarayıcı başlatma/profil hataları nedeniyle tamamlanamadı; yukarıdaki tarayıcı sonuçları önceki sürümün kontrolleridir. Yeni senaryo demo-check.cjs'ye de eklenmiştir.

## Birim görevleri, alan hasadı, ufuk ve meteor sesi

Son turda **29/29 Node testi başarılı**. Önceki Windows Edge profil sorunu, ayrı Playwright Chromium Headless Shell test çalışma zamanı kullanılarak giderildi. `assets/commands-check.cjs` gerçek tarayıcıda geçti:

- Soldaki listeden işçi, bilimci ve asker seçme; işçiye sol tıkla hedefe yürüme, bilimciye laboratuvar ve askere saldırı emri.
- İşçi için alan hasadı düğmesi, sürükleyerek sınır seçme, seçilen bölgedeki sarmaşıkların işçi tarafından kaldırılması ve Mor Lif/Azur Özsu artışı.
- Sağ üst mini harita, haritadan kamera odaklama ve görüş alanı çerçevesi.
- Meteorun görünür düşüş/çarpma yaşam döngüsünde AudioContext üzerinden özgün sesin gerçekten tetiklenmesi. Tarayıcı testi ses grafiğini ve çağrı sayısını doğrular; dinleyici değerlendirmesi değildir.
- JavaScript sayfa hatası yok; demo-commands.png görsel olarak incelendi.

Sarmaşık hasadı hâlâ CONFIG.vines.pruneCost öder; kökler elle kesilmez. CONFIG.vines.harvestYield yeni kaynak miktarlarını tanımlar. Kazanç yalnızca başarılı işçi kesimine uygulanır; Yıldız Özü bitkiden üretilmez. Toplanan Mor Lif/Azur Özsu sayaçları 3B HUD'da görünür; mevcut prototipin besleme tarifleri değiştirilmedi.

assets/tasks3d.js alan işlerini sınırlar ve City.command'a bağlar. Bilimcinin laboratuvar emrinin genel hareket emrine dönüşmemesi adaptörde güvenceye alındı. assets/audio3d.js tamamen sentezlenmiş ses kullanır; hazır ses dosyası yoktur. Ses kullanıcı tıklaması/tuşuyla açılır ve HUD'dan kapatılabilir.

Oynanabilir görev ızgarası aynı kaldı; görünür çevre 640×640 dünya birimine uzatıldı. Uzak kaya/ağaçlar instancing ve sisle kesintisiz ufuk izlenimi verir; bunlar ayrı oyun kareleri değildir. Kamera daha uzak yakınlaşma/uzaklaşma ve dış çevreyi görme aralığı sunar. Görev alanı dışına tıklama artık açıklama verir.

## Medeniyet ve halk güncellemesi — 1 Kasım 2026

Güncel ana komut: `node --test assets/civilization.test.cjs assets/gameplay.test.cjs assets/role3.test.cjs` — **38/38 başarılı**.

Yeni kapsam: dengeli cinsiyet ataması, taş yatağı zorunluluğu, inşaat emri kilidi, sarmaşık alanında bekleme/yeniden hasat, çalışan işçiyle taş üretimi, ücretli tamir, merkeze yük teslim edip durma, hastane iyileştirmesi, bilimciyle ev kapasitesi geliştirme, birim seviyesi, indirimli araştırma ücret/iadesi, duvar çevresinden yol bulma ve nesne kimliğini koruyan ağ aktarımı. İki medeniyet için sunucu tarafında kaynak/komut sahipliği ve ortak dünyada yapı görünürlüğü ayrı test edilir. Önceki 20 dakika stres ve nüfus/meteor/araştırma testleri de geçer.

`assets/civilization-check.cjs` güncel gerçek tarayıcı regresyonudur; `commands-check.cjs` ve `demo-check.cjs` uyumluluk girişleri bunu çağırır. Chromium Headless Shell ile meslek filtreleri/grup seçimi, dur/otomatik toplama, hareket ve sürükleyerek hasat, gerçek meteor ses tetiklenmesi, altı PNG portresi, bayrak değiştirme, 720p/1080p inşa düzeni ve karakter galerisi doğrulanır. İki tarayıcı oturumunda farklı medeniyetler, ayrı kaynak harcaması, karşılıklı bina görünürlüğü, başka oyuncu birimine emir reddi ve yenileme sonrası tekrar bağlanma kontrol edilir. Yazılımsal GPU maliyetini azaltmak için LAN senaryosunda her istemcinin ilk gerçek 3B karesinden sonra yalnız GPU çizimi kapatılır; simülasyon, ağ, sahne nesneleri ve HUD çalışmaya devam eder. Bu test fiziksel iki farklı Wi-Fi cihazı veya gerçek ekran kartı performans ölçümü değildir.

`demo-civilization.png` ile yerleşim, `people-preview.png` ile altı karakter varyantı görsel olarak incelendi. 3B karakterler referansların prosedürel oyun yorumudur; referans kalitesinde elle hazırlanmış yüksek ayrıntılı karakter modelleri değildir. Kullanıcının PNG'leri portre olarak doğrudan kullanılır.

Bu turda kullanıcının geniş kapsamlı mekanik talebi doğrultusunda ortak `src/city.js`, `src/research.js`, `src/colonies.js`, `src/enemies.js` ve `src/meteors.js` dosyalarına da sınırlı entegrasyon yapıldı: yapı/birim geliştirmeleri, haricî görev desteği, indirimli gerçek bedel iadeleri ve LAN kaynak/araştırma sahipliği. Yeni 3B mekanikler `civilization.js` ile etkinleşir; eski `index.html` bunları yüklemez. Sürekli hasat davranışı 3B girişe özgüdür.

LAN sınırları: 4 oyunculu yerel oda, PvP yok, hesap/kalıcı kayıt yok, sunucu kapanınca sıfırlanır. Kullanım `assets/LAN-README.md` içinde. Bu sürümün uzun süreli çok oyunculu denge ayarı ayrıca oynanış gerektirir.
