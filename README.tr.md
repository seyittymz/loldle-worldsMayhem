# Worlds Mayhem Helper

*[English](README.md) · **Türkçe***

[Loldle](https://loldle.net) **Worlds Mayhem** modunda her turda hangi takımı ve hangi oyuncuyu seçmen gerektiğini söyleyen tarayıcı konsolu betiği.

Oyunun kendi veri setini ve kendi güç formülünü kullanır, kalan turları Monte Carlo ile simüle eder ve seçenekleri şampiyonluk ihtimaline göre sıralar.

```
—— Worlds Mayhem öneri  (dolu rol: 0/5, reroll: 3) ——
┌──────────────────────┬─────────────┬───────────┬────────┬──────────────┬────────────┬──────────┐
│ Takım                │ Oyuncu      │ Rol       │ Rating │ Beklenen güç │ Şampiyon % │ Final+ % │
├──────────────────────┼─────────────┼───────────┼────────┼──────────────┼────────────┼──────────┤
│ SK Telecom T1 2013   │ bengi       │ JUNGLE    │ 90     │ 85.87        │ 20.3       │ 73.8     │
│ SK Telecom T1 2013   │ Faker       │ MID       │ 90     │ 85.95        │ 19.8       │ 78.3     │
│ Suning 2020          │ SwordArt    │ SUPPORT   │ 80     │ 84.05        │ 8.5        │ 50.5     │
└──────────────────────┴─────────────┴───────────┴────────┴──────────────┴────────────┴──────────┘
SEÇ:  SK Telecom T1 2013  ->  bengi  (JUNGLE, rating 90)
```

## Kurulum

1. [loldle.net/worldsMayhem](https://loldle.net/worldsMayhem) adresini aç.
2. `F12` → **Console** sekmesi.
3. `worldsmayhem-helper.js` dosyasının tamamını yapıştır, Enter.

Chrome ilk kez konsola yapıştırma yaparken uyarı verirse, istediği gibi `allow pasting` yazıp Enter'a bas.

## Kullanım

| Komut | Ne yapar |
|---|---|
| `wm.go()` | Ekrandaki 3 takım için öneri tablosu çıkarır |
| `wm.auto()` | Her tur otomatik öneri verir (tur değiştikçe kendisi hesaplar) |
| `wm.stop()` | Otomatik modu kapatır |
| `wm.dream()` | Teorik tavan kadroyu ve tur eşiklerini gösterir |
| `wm.manual(takımlar, kadro)` | Oyun otomatik okunamazsa elle giriş |
| `wm.power(roster)` | Bir kadronun güç değerini hesaplar |

Spin'e bastıktan sonra `wm.go()` çağır. Otomatik mod için bir kere `wm.auto()` demen yeterli:

```js
wm.auto();            // her tur kendiliğinden öneri
wm.go({ sims: 1500 }); // daha hassas (ve daha yavaş) hesap
wm.manual(["SK Telecom T1 2013", "Suning 2020", "Flash Wolves 2016"], { MID: "Faker" });
```

## Oyun nasıl çalışıyor

Betik tahmin yürütmüyor; kurallar oyunun kendi paketinden çıkarıldı.

**Takım gücü:**

```
power = ağırlıklı ortalama + carry bonusu − zayıf halka cezası
```

- Rol ağırlıkları: MID `0.24`, ADC `0.23`, JUNGLE `0.20`, TOP `0.17`, SUPPORT `0.16`
- **Carry bonusu:** en yüksek ratingli oyuncunun ortalamayı aşan kısmının %20'si, ikincinin %12'si, üçüncünün %4'ü — en fazla `+2.5`
- **Zayıf halka cezası:** en düşük oyuncunun ortalamanın altındaki kısmının %20'si, sondan ikincinin %10'u — en fazla `−2`

**Tur eşikleri** — her tur sabit bir güç eşiğine karşı oynanır, ekranda gösterilen rakip sonucu etkilemez:

| Tur | Geçme eşiği |
|---|---|
| Grup aşaması | 77.8 |
| Çeyrek final | 81.9 |
| Yarı final | 84.1 |
| Final | 88.2 |

Seride kazananı güç belirler; rastgele olan yalnızca skordur (3-0 / 3-1 / 3-2). Maç içi olaylar sadece anlatı amaçlıdır, güce etki etmez.

**Oyuncu ratingleri** OraclesElixir verisinden üretilmiş: WinRate, KDA, kill participation, CS/dk, gold/dk, hasar/dk, 15. dakika gold ve CS farkı gibi statlar aynı rol ve aynı turnuvadaki oyunculara göre normalize edilip rol bazlı ağırlıklarla toplanıyor, üstüne takım derecesi bonusu ekleniyor. 2013–2025 arası 205 takım ve 1067 oyuncu kaydı var, ratingler 65–99 aralığında.

## Betik ne yapıyor

1. Veriyi sayfadaki Vue bileşeninden okur; bulamazsa `index.js` paketini indirip içindeki veri bloğunu ayıklar.
2. Ekrandaki her *(takım, oyuncu, rol)* seçeneği için, o seçim yapılmış varsayıp kalan turları yüzlerce kez simüle eder. Simülasyonda ileriki turlar makul bir açgözlü politikayla oynanır ve düşük ratingli turlarda reroll harcanır.
3. Her seçenek için beklenen bitiş gücünü ve şampiyonluk / finalist ihtimalini raporlar.
4. Reroll hakkı varsa, yeniden çekmenin beklenen değeriyle en iyi seçeneği karşılaştırıp reroll önerir ya da önermez.

Karşılaştırmalar ortak rastgele sayılarla (seedli PRNG) yapılır, böylece iki seçenek aynı rastgele dünyada sınanır ve sıralama gürültüden etkilenmez.

Basitçe "en yüksek ratingi seç" demek yetmiyor: aynı rating farklı rollerde farklı değerde, yüksek ağırlıklı bir rolü ileride gelecek iyi bir oyuncuya saklamak bazen daha kârlı ve zayıf halka cezası yüzünden dengesiz kadro, ortalaması aynı olan dengeli kadrodan geride kalıyor.

## Bilinen sınırlar

- **Günlük meydan okuma** modunda oyun belirli bir bölgeden takım gelmesini zorunlu tutuyor; betik bu kısıtı modellemiyor, o modda ihtimaller bir miktar iyimser çıkabilir.
- Eşikler ve rol ağırlıkları betiğin içinde sabit. Loldle dengeyi değiştirirse `TH` ve `W` değerlerini güncellemek gerekir.
- Veri okuma önce Vue bileşeninden yapıldığı için paket adı değişse bile çalışmaya devam eder; Vue bulunamazsa paket ayıklama yoluna düşer.

## Katkı

Sorun bildirmek veya geliştirmek için issue/PR açabilirsin. Özellikle faydalı olur:

- Günlük meydan okuma kısıtlarının modellenmesi
- Açgözlü politika yerine daha iyi bir ileriye bakış (beam search vb.)
- Eşik/ağırlık değişikliklerinin otomatik tespiti

## Sorumluluk reddi

Bu bir hayran projesidir. Loldle veya Riot Games ile bir ilgisi yoktur; League of Legends ve Riot Games, Riot Games, Inc. şirketinin ticari markalarıdır. Betik yalnızca tarayıcının zaten indirdiği veriyi okur, siteye ek istek göndermez ve oyunun sunucusuna hiçbir şey yazmaz. Kendi tarayıcında, kendi keyfin için kullan.

## Lisans

MIT
