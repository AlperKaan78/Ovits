Bu depo "Mor Sarmaşık" adlı, tarayıcıda çalışan 2D (yukarıdan bakış) strateji / şehir kurma oyunudur.
Teknoloji: HTML5 Canvas + düz JavaScript (modül/derleyici yok, klasik <script> etiketleri). index.html çift tıklanınca çalışmalı.
Oyunun tarifi: https://claude.ai/artifact/RaSWzzC1RzHGgXWCmPqczc (tasarım dokümanı). Ortak kurallar: docs/CONTRACT.md.

Kurallar:
- Yalnızca bana ait dosyaları değiştir (docs/CONTRACT.md'deki sahiplik tablosu). Başkasının dosyasına ihtiyaç varsa bana söyle.
- Hiçbir oyun değerini koda sabit yazma; data/config.js'teki CONFIG'den oku.
- ES modülleri (import/export) ve harici kütüphane kullanma; file:// üzerinden açılınca çalışmalı.
- Başka modüllerin fonksiyonlarını çağırmadan önce var olduklarını kontrol et (ör. if (window.City && City.feed)).
- Küçük adımlarla ilerle; her adımdan sonra tarayıcıda denenebilir olsun. İş bitince neyin değiştiğini ve nasıl deneneceğini kısaca yaz.
