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
  },

  buildings: {
    merkez:  { ad: 'Merkez',        cost: null,                 hp: 1000, size: 2, tasPerSec: 1 },
    ev:      { ad: 'Ev',            cost: { tas: 50 },          hp: 150,  size: 1, eggEvery: 30, maxEggs: 2 },
    ocak:    { ad: 'Taş Ocağı',     cost: { tas: 60 },          hp: 150,  size: 1, tasPerSec: 2 },
    kule:    { ad: 'Çekim Kulesi',  cost: { tas: 100, oz: 20 }, hp: 300,  size: 1, minDistFromMerkez: 15, ozPerWave: 10, pullChance: 0.7, landRadius: 3 },
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
    spreadEvery: 8, spreadChance: 0.25, maxCover: 0.35,
    damagePerSec: 2, pruneCost: { tas: 5 }, pruneRange: 6,
  },

  colonies: {
    list: [{ id: 'A', queen: { x: 54, y: 10 } }, { id: 'B', queen: { x: 54, y: 30 } }],
    toplayici: { count: 4, hp: 40, speed: 1.5, dps: 5, range: 1.2 },
    muhafiz:   { count: 3, hp: 80, speed: 1.6, dps: 10, range: 1.5, guardRadius: 4 },
    kralice:   { hp: 300 },
    hostileTime: 30, huntSoldiers: 2, faintBelow: 0.3,
    chipTime: 6, chipTimeMin: 2, queenChipTime: 15, queenSpawnEvery: 40,
    tasiyiciSpeedMul: 2,
  },

  research: [
    { id: 'genisCekim',   ad: 'Geniş Çekim',     cost: { oz: 30 },             time: 40, effect: 'Kule çekme oranı %85' },
    { id: 'meteorKalkan', ad: 'Meteor Kalkanı',  cost: { oz: 40 },             time: 45, effect: 'Merkez çevresine (10 kare) meteor düşmez' },
    { id: 'kitinAgi',     ad: 'Kitin Ağı',       cost: { oz: 20, kitin: 3 },   time: 30, effect: 'Avlanan bireyler ölmez, bayılır' },
    { id: 'noroCip',      ad: 'Nöro-çip',        cost: { oz: 50, kitin: 5 },   time: 60, effect: 'Bayılmış bireyler çiplenebilir', requires: 'kitinAgi' },
    { id: 'kraliceCipi',  ad: 'Kraliçe Çipi',    cost: { oz: 100, kitin: 10 }, time: 90, effect: 'Kraliçe çiplenebilir', requires: 'noroCip' },
  ],
  researchValues: { genisCekimPull: 0.85, kalkanRadius: 10 },

  enemies: {
    firstRaid: 180, interval: 120, baseSize: 3, growPerRaid: 1,
    hp: 50, speed: 1.8, range: 1.5, dps: 8, bounty: { oz: 5 },
  },
};
