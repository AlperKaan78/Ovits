# Kişi 3 test raporu — Three.js geçişi

## Geçen kontroller

`node --test assets/role3.test.cjs`: gerçek data/config.js ve src/core.js kullanılarak 11/11 test geçti.

- İlk akın 180 saniyede, sonraki 120 saniyede; boyut artışı, benzersiz kimlik ve doğru sınırlar.
- Duraklatma/bitiş, kule-işçi-karakol önceliği, gerçek merkez ve moveTo imzası.
- Karakol koruması, yerdeki kristal ve ölen taşıyıcı yağması; kaçana bounty verilmemesi.
- Gerçek nesne biçimindeki bounty'nin tek sefer verilmesi.
- G.res, unit.kind, food maliyeti, member zarfı, research.ok, engellenen düğmeler, UI tıklama bölgeleri ve yeniden başlatma.

`assets/three-check.cjs` gerçek Edge/WebGL tarayıcı kontrolleri:

- Yerleşim sahnesi ve 17 model seçimi, sürükleme, yakınlaşma, otomatik dönüş ve resize.
- G adaptöründe oluşturma, rol değiştirme, kristal tükenmesi, silme, UI tıklama engeli ve dispose.
- Gerçek ekip config/core/vines/city/meteors/colonies/enemies/research modülleriyle 3B giriş açılışı.
- 180 saniyelik hızlandırılmış simülasyonda en az üç akıncı ve sonlu konum/kaynak değerleri.
- Test boyunca JavaScript sayfa hatası yok.
- Statik sahne çizim çağrısı önce 2903, birleştirmeden sonra 39 (FPS kıyası değildir).

Ekran görüntüleri: three-settlement.png, three-isci.png, three-kralice.png, three-cekimKulesi.png, three-mobile.png, three-game.png. Yerleşim, karakter, kraliçe ve gerçek oyun verisiyle sahne görsel olarak kontrol edildi; bildirim ile yardım kutusunun örtüşmesi düzeltildi.

## Sınırlar

Kişi 1'in şehir ve meteor davranışları bc5bc7f commitinden alınıp yukarıdaki testler yeniden geçirildi. Tam maç veya zafer dengesi henüz doğrulanmadı. Three.js girişinin ana index.html yerine alınması Kişi 1 ile birleştirme gerektirir; mevcut 2B giriş değiştirilmedi. Görseller özgün prosedürel modellerdir; sonuç stilize gerçekçi oyun grafiğidir, fotogerçekçi tarama değildir.

## Ekibe aktarılacak notlar

- Kişi 1 / src/city.js: güncel feed/sendSoldier, yerleştirme, savaş ve taşıma davranışları assets/game3d.html üzerinden yüklenir; tam maç testi bekliyor.
- Kişi 1 / src/meteors.js: meteor simülasyonu alındı; düşüş/uyarı animasyonları 3B adaptöre ayrıca bağlanmalıdır; model fabrikasında meteor ve kristal var.
- Kişi 2 / src/colonies.js: member seçim zarfı, canChip/tryChip ve research.ok UI'de desteklenir; koloni/sarmaşık veri şemasıyla 3B senkronizasyon çalışır.

Bu notlar rapordur; ekip üyelerine doğrudan mesaj gönderilmedi.
