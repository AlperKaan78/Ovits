# Kişi 3 entegrasyonu

Güncel ortak sözleşme: `docs/CONTRACT.md`. Depodaki gerçek config/core ile uyarlama yapıldı. G.res, unit.kind, map.w/h/tile, crystal.oz, member seçim zarfı ve gerçek Game.moveTo(e,x,y,speed,dt) imzası kullanılır.

- `src/ui.js`: kaynaklar, zamanlayıcılar, maliyetli bina düğmeleri, hız/duraklatma, bina/yavru/karakol/lab/koloni panelleri, av ve çipleme, araştırma ve engellenme nedenleri, yardım ve bitiş ekranı. Eksik City API'leri kapalıdır ve “yakında” yazar. Toplam Öz istatistiği çekirdekte bulunmadığında sonuç ekranı dürüstçe “Depodaki Öz” gösterir.
- `src/enemies.js`: gerçek CONFIG.enemies ile zamanlama, sağ/üst/alt sınırda doğma, benzersiz kimlik, kule → taşıyan işçi → karakol → bina önceliği, gerçek merkez noktaları ve hareket yardımcıları, menzil hasarı, korumasız kristal çalma ve tek seferlik bounty.
- `assets/art.js`: önceki özgün 2B çizim kütüphanesi; 2B akıncı modülü isteğe bağlı kullanır.
- `assets/art3d.js`, `three-game.js`: Three.js modelleri, PBR malzemeleri, arazi, ışık/gölge ve G senkronizasyon adaptörü. Birimler, binalar, düşmanlar, yerdeki kristaller, koloni bireyleri ve map.vine çizilir. Taşınan/tükenmiş kristaller ve çiplenip taşınan bireyler gizlenir.
- `assets/game3d.html`: gerçek config/core/dünya modülleriyle 3B entegrasyon başlatıcısı. Diğer kişilerin dosyalarını değiştirmeden alternatif giriş sunar. `assets/THREE-README.md` açılış komutlarını açıklar.

Three.js dönüşümü kullanıcının açık isteğiyle yapılmıştır. 2B index.html korunur; yeni ES modülleri localhost sunucusundan açılır. Dünya koordinatları X/Z, yükseklik Y'dir. Görsel ölçek oyun kurallarından ayrıdır. Sabit sahne geometri birleştirme ve sarmaşık instancing ile çizilir.

## Kalan ekip işleri

Kişi 1'in city.js ve meteors.js dosyalarında üretim dışında pek çok davranış hâlâ TODO durumundadır. Bina yerleştirme, besleme, taşıma, asker saldırısı ve meteor simülasyonu bu ekip parçasında tamamlanınca 3B giriş tekrar baştan sona denenmelidir. `index.html`, `src/core.js`, `src/main.js`, `src/city.js`, `src/meteors.js`, `data/config.js` ve Kişi 2 modüllerine yerel değişiklik yapılmadı; depodan gelen sürümleri kullanılır.
