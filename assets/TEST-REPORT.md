# Kişi 3 test raporu

## Doğrulananlar

- Node testleri: 9/9 başarılı.
- Gerçek Edge tarayıcısında file:// üzerinden iki önizleme açıldı.
- Canvas çizimleri, bina düğmesi, duraklatma, yavru paneli ve zafer ekranı doğrulandı; JavaScript sayfa hatası alınmadı.
- Sanat kataloğu ve yavru paneli ekran görüntüleri görsel olarak incelendi; taşma veya üst üste binme gözlenmedi (1200×800 Canvas).
- Katalogda 20 kutu: 7 bina, 5 Ovik yaşam/rol çizimi, akıncı, koloni, kraliçe, sarmaşık, kristal, meteor, iki uyarı aşaması.

## Düzeltilenler

- src/ui.js: üst/alt çubuk ve seçim panelindeki boş alanlara tıklamanın haritaya geçmesi engellendi.
- src/ui.js: panelin dışında kalan eylemlerin görünmez tıklama alanları oluşturması engellendi.
- src/enemies.js: özgün sanat kütüphanesi kullanımı eklendi; kütüphane olmadan çizim de korunuyor.

## Test kapsamının sınırı

Testlerde G ve CONFIG sahte verileri kullanılır; gerçek ekip sözleşmesi henüz yoktur. Bu rapor tam maçın, oyun dengesinin veya diğer modüllerle entegrasyonun geçtiği anlamına gelmez. 15–20 dakikalık gerçek maç, çekirdek ve diğer oyun modülleri geldikten sonra oynanmalıdır.

## Ekibe aktarılacak notlar

| Sorumlu | Dosyalar | Mesaj |
| --- | --- | --- |
| Kişi 1 | src/core.js, src/main.js | Kayıt/draw/update/moveTo imzalarını ve G alanlarını assets/INTEGRATION.md ile karşılaştırıp ortak sözleşmeyi paylaşın. |
| Kişi 1 | src/city.js | hp=0 birim/bina temizliğini, carrying biçimini ve feed/sendSoldier API'lerini doğrulayın. |
| Kişi 2 | data/config.js | Geçici CONFIG alanlarını gerçek dengeye bağlayın; akın ve besleme maliyetlerini sağlayın. |
| Kişi 2 | src/research.js, src/colonies.js | available/enqueue/hunt imzalarıyla seçilen koloni bireyinin alanlarını paylaşın. |

Bu notlar yerel rapordur; ekip üyelerine mesaj gönderilmedi.
