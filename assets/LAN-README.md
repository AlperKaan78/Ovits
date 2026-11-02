# Aynı Wi-Fi üzerinden oyun

Sunucu bilgisayarda Node.js ile depo kökünden `node assets/lan-server.cjs` çalıştırın veya `lan-baslat.bat` açın. Sunucu varsayılan olarak 4180 portunu dinler ve yerel ağ IP adreslerini konsola yazar. Diğer cihazlarda aynı Wi-Fi ağına bağlanıp `http://SUNUCUNUN_IP_ADRESI:4180` açın. Sunucunun kendi bilgisayarında `http://localhost:4180` kullanılabilir.

Girişte medeniyet adı ve bayrak seçilir. En fazla dört medeniyet aynı dünyada ayrı başlangıç merkezleri, kaynaklar, birimler ve araştırmalarla oynar. Meteorlar, yerdeki yıldızlar, sarmaşıklar, taş yatakları ve tarafsız düşmanlar ortaktır. Diğer medeniyetlerin yapıları/birimleri görünür; onlara emir verilemez. Bu sürüm birlikte hayatta kalma içindir; medeniyetler arası PvP ve diplomasi eklenmedi.

Oyun sunucuda ilerler. Tarayıcılar emir gönderir, sunucu sahiplik ve kaynakları doğrular. LAN hız/duraklatma düğmeleri kapalıdır. Sayfayı yenilemek aynı sekmede aynı medeniyete döner; bağlantı kopunca otomatik yeniden bağlanır. Sekme kapansa da medeniyet dünyada kalır. Sunucu kapanınca oda sıfırlanır; diske kayıt yoktur. Yeni oda için sunucuyu yeniden başlatın.

Bağlantı reddedilirse sunucunun açık olduğunu ve adresin doğru ağ adaptörüne ait olduğunu kontrol edin. Windows güvenlik duvarı ağ erişimi sorarsa yalnızca kullandığınız özel ağ için Node.js erişimi gerekir. Program güvenlik duvarını otomatik değiştirmez. Bu LAN sunucusunu internete port yönlendirerek açmayın; hesap sistemi ve internet barındırması bu kapsamda değildir.

Tek oyunculu eski giriş ayrı kalır: `node assets/serve-preview.cjs` ardından `http://127.0.0.1:4173/assets/game3d.html`.

# Yeni kontroller

- Soldaki İşçi / Asker / Bilimci filtreleri o mesleğin yaşayan birimlerini birlikte seçer. Shift+tık veya kutu seçimiyle gruplar oluşturulur; aktif meslek filtresi kutu seçimine uygulanır.
- İşçi hasadı seçilen alanda sürekli kalır; sarmaşık yeniden çıkarsa biçmeye devam eder. Dur emri veya yeni görevle biter. Yıldız toplama kendiliğinden sürer. Tüm işçiler merkeze dön komutu yükü teslim edip bekletir. İnşaat işçileri bina bitene kadar başka emir alamaz.
- Taş ocağı yalnızca mini haritadaki açık renkli taş yataklarına kurulabilir. İşçi seçip ocağa sağ tıklayın veya ocağın kazma düğmesini kullanın. Çalışan işçi başına üretim yapılır; yatak miktarı ortaktır ve tükenebilir.
- Hasarlı binayı seçip tamir emri verin. Gerçekte onarılan her 5 can için 1 Taş tüketilir. Hastanede çalışan bilim insanları yakın yaralıları tedavi eder. Birimin panelinden hastaneye tedavi emri verilebilir.
- Ev/ocak geliştirmelerini bilim insanları çalışarak tamamlar. Evler daha hızlı yumurtlar ve bekleyen yavru/yumurta kapasitesi artar; ocakların üretimi artar. İşçi/asker seviyeleri kaynakla en fazla 5 olur; can, işçi inşaat hızı ve asker hasarı gelişir.
- Laboratuvarda çalışan her bilim insanı araştırma hızına %50 ekler ve yeni araştırma maliyetini %5 düşürür (en fazla %50 indirim). İptal iadeleri o araştırma için gerçekten ödenen bedelden hesaplanır.
- Çekim Kulesi meteor çeker; Taret düşmana ateş eder. Ayrı roller korunur. Duvar fiziksel engeldir; Savunma Kulesi daha uzun menzilli saldırı yapar.
- Mini harita sol alttadır. İnşa düğmeleri ekran genişliğine göre satırlara ayrılır. Seçili birimin sağ paneli tekerlekle kaydırılır; harita üzerinde tekerlek kamerayı yakınlaştırır.

## Yeni oyun, mod seçimi ve yerel sürümler

`oyunu-ac.bat` güncel başlangıç menüsünü açar. Çevrimdışı mod yalnız tarayıcıdaki simülasyonu çalıştırır; çevrimiçi mod aynı Wi-Fi sunucusuna bağlanır. Akıncılar varsayılan olarak kapalıdır; yeni oyun formunda işaretlenirse etkinleşir. Mevcut çevrimiçi odada bu ayarı ilk oyuncu belirler, katılanlar aynı ayarı kullanır. Yerel önizleme sunucusunda yalnız çevrimdışı mod açılır; iki modu birlikte sunmak için `oyunu-ac.bat` veya LAN sunucusunu kullanın.

Ses her yeni oyunda kapalı başlar; ses düğmesiyle açılır. Yeni oyun düğmesi başlangıç menüsüne döner. Başlatmayı onaylayınca bu sekmenin önceki çevrimiçi medeniyeti, birimleri ve binaları temizlenir; diğer oyuncuların medeniyetleri korunur. Son medeniyet de ayrılmışsa dünya ve oda seçenekleri sıfırlanır. Kalıcı oyun kaydı bu sürümde yoktur. Önceki bölümdeki yenilemeyle otomatik devam davranışı bu yeni başlangıç akışıyla değiştirilmiştir; bağlantının geçici kopmasında aynı oyuna otomatik bağlanma sürer.

Kaynak dosya yedekleri oyun oturumundan ayrıdır. `D:\challenge\deneme2`, `deneme3` vb. klasörler tam proje kopyasıdır; Yeni oyun bunları silmez. `tools/yerel-surum.ps1` her teslimde bir sonraki boş klasörü oluşturur, bütün dosyaların SHA256 eşleşmesini denetler ve sürüm/dosya listesi yazar. Git geçmişi klasörü `.git` kopyalanmaz; çalışan oyun, kod, görseller, belgeler ve testler kopyalanır. Her kopyadaki `oyunu-ac.bat` o kopyanın kendi sunucusunu farklı portta açar; `deneme3` için port 4203'tür.
