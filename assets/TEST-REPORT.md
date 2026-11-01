# Tam demo kontrolü — 1 Kasım 2026

GitHub'daki son main sürümü indirildi; çalışma başlangıcında yerel depo origin/main ile eşitti. Kişi 1'in şehir/meteor ve Kişi 2'nin güncel koloni/sarmaşık/araştırma modülleri birlikte test edildi.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| `node --test assets/role3.test.cjs assets/gameplay.test.cjs` | 25/25 geçti |
| `node assets/three-check.cjs` | 17 model geçişi, WebGL, kamera, boyut değişimi, adaptör ve 180 saniyelik simülasyon geçti |
| `node assets/demo-check.cjs` | Gerçek fare/klavye etkileşimleriyle 3B demo ve file:// üzerinden 2B giriş geçti; sayfa/konsol hatası yok |
| `node assets/browser-check.cjs` | Önceki 2B sanat kataloğu ve arayüz önizlemeleri geçti |
| JavaScript sözdizimi | src/data/assets altındaki 22 JS/CJS dosyası geçti |

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
- Bina seçme, besleme düğmesi, duraklatma/hız, sağ tık iptal, bina/yiyecek kısayolları, kazanma/kaybetme ve sayfa yeniden başlatma.

## Uzun simülasyon

Sabit seed 97 ile otomatik beslenen senaryo doğal Öz zaferine 387. saniyede ulaştı. Ayrıca yalnızca stres testi amacıyla zafer eşiği ve Merkez canı yükseltilerek 1200 saniyelik ufuk tamamlandı; kaynaklar ve nesne konumları sonlu, kaynaklar sıfır veya üstünde kaldı. Bu ikinci senaryo normal oyun dengesi ölçümü değildir.

## Bulunan ve düzeltilenler

- **assets/three-game.js, meteor3d.js:** 3B'de eksik meteor uyarısı/düşüş/çarpma/krater çizimleri eklendi; zaman ve konum gerçek meteor modülünden alınır.
- **assets/game3d.js, three-game.js:** City kısayolları, sağ tık iptal ve fare dünya koordinatları bağlandı; görünen modelin arkasındaki zemin yerine doğru nesne seçilir.
- **assets/three-game.js:** seçim halkası, hasar can çubuğu, taşınan kristal ve geçerli/geçersiz inşa önizlemesi eklendi.
- **assets/art3d.js:** oynanabilir alandaki dekoratif dev kayalar kaldırıldı ve zemin düzleştirildi; görsel engellerin gerçekte boş kareleri kapatması engellendi.
- **src/enemies.js:** gerçek City.guardedAt kullanılır; boş karakol kristallere ücretsiz koruma sağlamaz.
- **src/ui.js:** 2B fare hover, uzun mesajların panelde kırpılması, koloni/rol adları ve kraliçe için av düğmesinin kapanması düzeltildi.
- **assets/serve-preview.cjs:** favicon isteği boş yanıtla karşılanır; konsoldaki gereksiz 404 giderildi.
- **Test betikleri:** yeniden başlatmada G henüz oluşmadan yapılan kontrol düzeltildi; eski sanat önizlemesi testi kilitli PNG üzerine yazmak yerine geçici çıktı kullanır.

## Görsel kontrol ve sınırlar

demo-warning.png, demo-win.png, demo-lose.png ve demo-2d.png incelendi. Yeni sahne, model kataloğu ve uyarlanabilir boyut önizlemeleri de test edildi. Kaynak kod testleri ve kontrollü tarayıcı senaryoları, insan tarafından oynanmış her olası maçın hatasız olduğunu garanti etmez.

Denge notu (Kişi 2 / data/config.js): otomatik beslenen seed 97 senaryosunun 6 dakika 27 saniyede Öz zaferi alması, görev belgesindeki 15–20 dakika hedefinden kısadır. Sayı ayarları sahiplik sınırı gereği değiştirilmedi; bu sonuç denge gözden geçirmesinde kullanılmalıdır.

Üç boyutlu giriş assets/game3d.html, orijinal giriş index.html'dir. İki sürüm de kontrol edildi. Kişi 1/2 kaynak dosyaları değiştirilmedi.
