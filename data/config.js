// ============================================================
// data/config.js  —  SAHİBİ: Kişi 2 (oyun tasarımı ve denge)
// Oyundaki TÜM sayılar burada. Kod hiçbir değeri sabit yazmaz.
// Birimler: mesafe = kare (tile), süre = saniye, hız = kare/saniye.
// ============================================================
window.CONFIG = {
  map: { w: 60, h: 40, tile: 32 },

  start: {
    oz: 20, tas: 200, kitin: 0,
    merkez: { x: 7, y: 19 },   // sol üst karesi (Merkez 2x2)
    ev: { x: 4, y: 16 },
    isci: 2,
  },

  win: { oz: 500 },

  colors: {
    plain: '#b9ad97', rock: '#8f877a', forest: '#3b2a4a',
    vineStem: '#7b3fa0', vineLeaf: '#4fa3e0',
    player: '#c9773a', crystal: '#f2c14e',
    auroraFar: 'rgba(120,220,170,0.25)', auroraNear: 'rgba(242,170,60,0.55)',
    isci: '#f1e6cf', asker: '#c0392b', bilimci: '#2e86de',
    bocekNotr: '#4caf50', bocekDusman: '#e74c3c', bocekCipli: '#e67e22',
    akinci: '#2d2d2d', text: '#ffffff',
    tasiyici: '#e67e22', savasci: '#d35400', yuva: '#2a1b36',
    // sarmaşık ayrıntıları
    vineUnder: 'rgba(52,18,78,0.30)', vineStemDark: '#3a1652', vineStemLight: '#c08ae0',
    vineLeafDark: '#1f5f8f', vineLeafVein: 'rgba(210,240,255,0.55)', vineGlow: 'rgba(90,190,255,0.16)',
    vineBud: '#aee9ff', vineRoot: '#2e0f42', vineRootGlow: 'rgba(160,90,220,0.45)',
    pruneOk: '#ffffff', pruneNo: '#ff8a65', panel: 'rgba(14,10,24,0.82)',
    vineDead: '#7a6248', nightTint: 'rgba(8,6,38,0.5)',
    // böcek ve yuva ayrıntıları
    bocekBacak: '#1a1712', bocekBayilmis: '#8a9396', golge: 'rgba(0,0,0,0.28)',
    yuvaToprak: '#4a3a52', yuvaKenar: 'rgba(120,200,255,0.35)', yuvaDelik: '#120a18',
    koloniYumurta: '#efe6c8', kraliceEtiket: '#f2c14e', secim: '#ffffff', arastirma: '#2e86de',
  },

  buildings: {
    merkez:  { ad: 'Merkez',        cost: null,                 hp: 1000, size: 2, tasPerSec: 1 },
    ev:      { ad: 'Ev',            cost: { tas: 50 },          hp: 150,  size: 1, eggEvery: 30, maxEggs: 2 },
    ocak:    { ad: 'Taş Ocağı',     cost: { tas: 60 },          hp: 150,  size: 1, tasPerSec: 2 },
    kule:    { ad: 'Çekim Kulesi',  cost: { tas: 120, oz: 40 }, hp: 300,  size: 1, minDistFromMerkez: 15, ozPerWave: 10, pullChance: 0.7, landRadius: 3 }, // Denge: 20 Öz ile başlangıçta hemen kurulabiliyordu; 40 Öz ilk 2-3 dalganın kristalini ister -> 3-5. dakika
    karakol: { ad: 'Karakol',       cost: { tas: 80 },          hp: 250,  size: 1, capacity: 3, guardRadius: 6 },
    taret:   { ad: 'Taret',         cost: { tas: 70, oz: 10 },  hp: 200,  size: 1, range: 5, dps: 10 },
    lab:     { ad: 'Laboratuvar',   cost: { tas: 120, oz: 30 }, hp: 200,  size: 2, scientistBonus: 0.5 },
  },

  population: {
    hatchTime: 20,   // yumurta -> yavru
    growTime: 10,    // besin seçildikten sonra -> yetişkin
    foods: {
      isci:    { ad: 'İşçi',    cost: { tas: 10 } },
      asker:   { ad: 'Asker',   cost: { oz: 5 } },
      bilimci: { ad: 'Bilimci', cost: { oz: 5, tas: 10 } },
    },
  },

  units: {
    isci:    { hp: 40, speed: 2.0 },
    asker:   { hp: 60, speed: 2.0, range: 4, dps: 8, upkeepPerMin: 1, outpostUpkeepPerMin: 2 },
    bilimci: { hp: 40, speed: 2.0 },
  },

  meteors: {
    firstWave: 60, interval: 45,
    auroraTime: 15, focusTime: 5, auroraRadius: 5,
    baseCount: 4, growEvery: 3, maxCount: 8, devEvery: 6,
    types: {
      kaya: { radius: 1.5, damage: 80,  oz: 15 },
      dev:  { radius: 3.0, damage: 200, oz: 50 },
    },
  },

  vines: {
    roots: [{ x: 46, y: 8 }, { x: 48, y: 20 }, { x: 46, y: 32 }],
    spreadEvery: 7, spreadChance: 0.3, maxCover: 0.6, westBias: 0.55, // westBias: yayılırken batıya (şehre) gitme olasılığı
    damagePerSec: 2, pruneCost: { tas: 5 }, pruneRange: 6,
    growAnim: 1.5, // yeni sarmaşık karesinin büyüme animasyonu (sn, yalnızca görüntü)
    // Sarmaşık Öfkesi (GDD 7): budama ve zehir öfkeyi artırır; tam öfkede yayılma (1 + spreadMul) kat
    anger: { max: 100, perPrune: 3, perPoison: 30, decayPerSec: 0.25, spreadMul: 1, warnAt: 0.7 },
    // Gece-gündüz (GDD 2): cycle saniyelik bir günün son 'part' kadarı gece; gece yayılma spreadMul kat
    night: { cycle: 240, part: 0.35, ramp: 15, spreadMul: 1.6 },
    // Meteor tozu (GDD 7): kristallerin ve Çekim Kulesi'nin radius kare çevresinde yayılma spreadMul kat
    dust: { radius: 4, spreadMul: 2 },
    // Kök Zehri (araştırma): köke tıklanınca cost ödenir; kök ve dalları her kademede witherStep sn arayla kurur
    poison: { cost: { oz: 25 }, witherStep: 0.25 },
  },

  colonies: {
    list: [{ id: 'A', type: 'taskabuk', queen: { x: 54, y: 10 } }, { id: 'B', type: 'yaprakci', queen: { x: 54, y: 30 } }],
    // Koloni türleri (GDD 8): hpMul/speedMul toplayıcı ve muhafızlara uygulanır
    types: {
      taskabuk: { ad: 'Taşkabuk', color: '#6f9a3a', hpMul: 1.3, speedMul: 0.85, eatsVine: false },
      yaprakci: { ad: 'Yaprakçı', color: '#2fb59a', hpMul: 0.9, speedMul: 1.1, eatsVine: true, eatTime: 4 }, // eatTime: bir kare sarmaşığı yeme süresi
    },
    toplayici: { count: 4, hp: 40, speed: 1.5, dps: 5, range: 1.2, groups: 2, groupMove: 9, fleeBelow: 0.5 }, // groups: kaç küçük grupta gezdikleri, groupMove: grubun yeni yere geçme aralığı (sn), fleeBelow: bu can oranının altında yuvaya kaçar
    muhafiz:   { count: 3, hp: 80, speed: 1.6, dps: 10, range: 1.5, guardRadius: 4 },
    kralice:   { hp: 300 },
    hostileTime: 30, huntSoldiers: 2, faintBelow: 0.3, faintTime: 45, aggroRadius: 6,
    roamWidth: 10, // toplayıcıların kraliçeden batıya (düzlüğe) doğru dolaşabildiği kare sayısı
    chipTime: 6, chipTimeMin: 2, queenSpawnEvery: 40,
    queenChipTime: 20, // Denge: 15'ten 20'ye; bilimci yuvada daha uzun korunmalı, kraliçe bir sefer gerektirsin
    tasiyiciSpeedMul: 2,
    healRadius: 3, healPerSec: 4,          // yuvanın healRadius karesi içindeki bireyler saniyede healPerSec can kazanır
    overHunt: { kills: 8, hostileMul: 3 }, // aşırı av cezası (GDD 8): bu kadar av sonrası öfke süresi hostileMul kat
  },

  research: [
    { id: 'genisCekim', dal: 'Gök',   ad: 'Geniş Çekim',     cost: { oz: 30 },             time: 40, effect: 'Kule çekme oranı %85' },
    { id: 'meteorKalkan', dal: 'Gök', ad: 'Meteor Kalkanı',  cost: { oz: 40 },             time: 45, effect: 'Merkez çevresine (10 kare) meteor düşmez' },
    { id: 'kokZehri', dal: 'Sarmaşık',     ad: 'Kök Zehri',       cost: { oz: 35 },             time: 45, effect: 'Sarmaşık köküne tıklayıp kurutabilirsin' },
    { id: 'kitinAgi', dal: 'Av',    ad: 'Kitin Ağı',       cost: { oz: 20, kitin: 3 },   time: 30, effect: 'Avlanan bireyler ölmez, bayılır' },
    { id: 'noroCip', dal: 'Av',      ad: 'Nöro-çip',        cost: { oz: 50, kitin: 5 },   time: 60, effect: 'Bayılmış bireyler çiplenebilir', requires: 'kitinAgi' },
    { id: 'kraliceCipi', dal: 'Av',  ad: 'Kraliçe Çipi',    cost: { oz: 150, kitin: 12 }, time: 150, effect: 'Kraliçe çiplenebilir', requires: 'noroCip' }, // Denge: 100 Öz / 10 Kitin / 90 sn ile 8-10. dakikada alınabiliyordu; kraliçe geç oyunda (12+. dk) gelsin
  ],
  researchValues: { genisCekimPull: 0.85, kalkanRadius: 10, refundCurrent: 0.5 }, // refundCurrent: sürmekte olan araştırma iptal edilince iade oranı

  enemies: {
    firstRaid: 180, interval: 120, baseSize: 3, growPerRaid: 1,
    hp: 50, speed: 1.8, range: 1.5, dps: 8, bounty: { oz: 5 },
  },
};
