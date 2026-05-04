// src/main/db.js — JSON Veritabanı Katmanı v2

const { app } = require('electron');
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const XLSX    = require('xlsx');

const DATA_DIR = path.join(app.getPath('userData'), 'OrvixHal');
const DB_FILE  = path.join(DATA_DIR, 'db.json');
const BACK_DIR = path.join(DATA_DIR, 'yedekler');

const BOSLUK = {
  musteriler:  [],
  bahceciler:  [],
  satislar:    [],
  alimlar:     [],
  cekler:      [],
  odemeler:    [],
  stok:        [],
  urunler: [
    { ad: 'Domates',    kdv: 1  },
    { ad: 'Biber',      kdv: 1  },
    { ad: 'Portakal',   kdv: 1  },
    { ad: 'Muz',        kdv: 1  },
    { ad: 'Salatalık',  kdv: 1  },
    { ad: 'Patlıcan',   kdv: 1  },
    { ad: 'Elma',       kdv: 1  },
    { ad: 'Limon',      kdv: 1  },
    { ad: 'Soğan',      kdv: 1  },
    { ad: 'Patates',    kdv: 1  },
    { ad: 'Havuç',      kdv: 1  },
    { ad: 'Ispanak',    kdv: 1  },
    { ad: 'Çilek',      kdv: 1  },
    { ad: 'Karpuz',     kdv: 1  },
    { ad: 'Kavun',      kdv: 1  },
    { ad: 'Mandalina',  kdv: 1  },
    { ad: 'Lahana',     kdv: 1  },
    { ad: 'Brokoli',    kdv: 1  },
    { ad: 'Maydanoz',   kdv: 1  },
    { ad: 'Dereotu',    kdv: 1  },
    { ad: 'Nane',       kdv: 1  },
    { ad: 'Sarımsak',   kdv: 1  },
    { ad: 'Zencefil',   kdv: 1  },
    { ad: 'Kuşkonmaz',  kdv: 1  },
  ],
  ayarlar: {
    firmaAdi:      'OrvixHal Toptancılık',
    firmaAdres:    'Hal Binası No:1',
    firmaTel:      '',
    kagitGenislik: '80mm',
    yazici:        '',
    kdvOrani:      18,
    komisyonOrani: 5,
    stopajOrani:   3,
    iskontoOrani:  0,
    paraBirimi:    '₺',
  },
  auth: {
    kullanici: null,
    isim:      null,
    sifreHash: null,
  },
  meta: {
    faturaNo:  146,
    alimNo:    88,
    odemeNo:   0,
    version:   '2.0.0',
  },
};

let _db = null;

function oku() {
  if (_db) return _db;
  if (fs.existsSync(DB_FILE)) {
    try { _db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (e) {
      // Bozuk dosya → yedeğe al, temiz başlat
      const bozukYol = DB_FILE + '.bozuk.' + Date.now();
      fs.copyFileSync(DB_FILE, bozukYol);
      _db = JSON.parse(JSON.stringify(BOSLUK));
    }
  } else {
    _db = JSON.parse(JSON.stringify(BOSLUK));
  }
  return _db;
}

function kaydet() {
  // Atomik yazma: önce geçici dosyaya yaz, sonra taşı
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function yeniId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function simdi() {
  return new Date().toISOString();
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACK_DIR)) fs.mkdirSync(BACK_DIR, { recursive: true });
  oku();
  // Versiyon uyumluluğu — eksik alanları doldur
  if (!_db.odemeler)                _db.odemeler = [];
  if (!_db.meta.odemeNo)            _db.meta.odemeNo = 0;
  if (!_db.urunler)                 _db.urunler = BOSLUK.urunler;
  if (!_db.meta.version)            _db.meta.version = '2.0.0';
  if (_db.ayarlar.stopajOrani === undefined)  _db.ayarlar.stopajOrani = 3;
  if (_db.ayarlar.iskontoOrani === undefined) _db.ayarlar.iskontoOrani = 0;
  // Eski string array'i object array'e migrate et
  if (_db.urunler.length > 0 && typeof _db.urunler[0] === 'string') {
    _db.urunler = _db.urunler.map(u => ({ ad: u, kdv: 1 }));
  }
  kaydet();
}

// ─── YARDIMCI: Cari Hesap ────────────────────────────────────────────────────
function musteriCariBakiye(db, musteriId) {
  const satislar    = db.satislar.filter(s => s.musteriId === musteriId);
  const satisToplam = satislar.reduce((t, s) => t + (s.genelToplam || 0), 0);

  // Tahsilat tablosundan
  const tahsilat = db.odemeler
    .filter(o => o.musteriId === musteriId && o.tip === 'musteri_tahsilat')
    .reduce((t, o) => t + (o.tutar || 0), 0);

  // Nakit/havale satışlar anında tahsil
  const anindaTahsilat = satislar
    .filter(s => s.odenmeDurumu === 'odendi' &&
                 (s.odemeTipi === 'nakit' || s.odemeTipi === 'havale'))
    .reduce((t, s) => t + (s.genelToplam || 0), 0);

  const toplamTahsilat = tahsilat + anindaTahsilat;
  return {
    satisToplam,
    tahsilat:   toplamTahsilat,
    acikBakiye: Math.max(0, satisToplam - toplamTahsilat),
  };
}

function bahceciCariBorc(db, bahceciId) {
  const alimlar    = db.alimlar.filter(a => a.bahceciId === bahceciId);
  const alimToplam = alimlar.reduce((t, a) => t + (a.odenecekTutar || 0), 0);

  const odemeler = db.odemeler
    .filter(o => o.bahceciId === bahceciId && o.tip === 'bahceci_odeme')
    .reduce((t, o) => t + (o.tutar || 0), 0);

  const anindaOdeme = alimlar
    .filter(a => a.odemeTipi === 'nakit')
    .reduce((t, a) => t + (a.odenecekTutar || 0), 0);

  const toplamOdeme = odemeler + anindaOdeme;
  return {
    alimToplam,
    odenenToplam: toplamOdeme,
    kalanBorc:    Math.max(0, alimToplam - toplamOdeme),
  };
}

// ─── YARDIMCI: Stok güncelle (iç kullanım) ───────────────────────────────────
function stokGuncelle(db, urunAdi, delta, fiyat = null) {
  const idx = db.stok.findIndex(x => x.urunAdi === urunAdi);
  if (idx >= 0) {
    db.stok[idx].miktar = Math.max(0, (db.stok[idx].miktar || 0) + delta);
    if (fiyat !== null) db.stok[idx].sonAlimFiyati = fiyat;
  } else if (delta > 0) {
    // Alım sırasında yeni ürün stoka giriyor
    db.stok.push({
      id: yeniId(), urunAdi, miktar: delta, birim: 'kg',
      sonAlimFiyati: fiyat, kritikSeviye: 20, olusturma: simdi(),
    });
  }
}

// ─── MÜŞTERİLER ─────────────────────────────────────────────────────────────
const musteri = {
  hepsi: () => {
    const db = oku();
    return db.musteriler.map(m => ({
      ...m,
      acikBakiye: musteriCariBakiye(db, m.id).acikBakiye,
    }));
  },
  ekle: (m) => {
    const db = oku();
    const yeni = { id: yeniId(), olusturma: simdi(), ...m };
    db.musteriler.push(yeni);
    kaydet();
    return yeni;
  },
  guncelle: (m) => {
    const db = oku();
    const idx = db.musteriler.findIndex(x => x.id === m.id);
    if (idx < 0) throw new Error('Müşteri bulunamadı');
    const { acikBakiye, ...guncellenen } = m;
    db.musteriler[idx] = { ...db.musteriler[idx], ...guncellenen, guncelleme: simdi() };
    kaydet();
    return db.musteriler[idx];
  },
  sil: (id) => {
    const db = oku();
    // Cascade: ilişkili satışları, ödemeleri ve çekleri de sil
    const silSatislar  = db.satislar.filter(s => s.musteriId === id);
    // Stokları geri ekle (iptal edilen satışlar)
    silSatislar.forEach(s => {
      (s.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, u.miktar || 0));
    });
    db.satislar  = db.satislar.filter(s => s.musteriId !== id);
    db.odemeler  = db.odemeler.filter(o => o.musteriId !== id);
    db.cekler    = db.cekler.filter(c => !(c.kisiAdi &&
      db.musteriler.find(x => x.id === id)?.ad === c.kisiAdi));
    db.musteriler = db.musteriler.filter(x => x.id !== id);
    kaydet();
    return { ok: true, silinen: { satislar: silSatislar.length } };
  },
  cari: (id) => {
    const db      = oku();
    const bakiye  = musteriCariBakiye(db, id);
    const satislar = db.satislar
      .filter(s => s.musteriId === id)
      .sort((a, b) => b.tarih?.localeCompare(a.tarih));
    const odemeler = db.odemeler
      .filter(o => o.musteriId === id && o.tip === 'musteri_tahsilat')
      .sort((a, b) => b.tarih?.localeCompare(a.tarih));
    return { ...bakiye, satislar, odemeler };
  },
};

// ─── BAHÇECİLER ─────────────────────────────────────────────────────────────
const bahceci = {
  hepsi: () => {
    const db = oku();
    return db.bahceciler.map(b => ({
      ...b,
      kalanBorc: bahceciCariBorc(db, b.id).kalanBorc,
    }));
  },
  ekle: (b) => {
    const db = oku();
    const yeni = { id: yeniId(), olusturma: simdi(), komisyonOrani: 5, ...b };
    db.bahceciler.push(yeni);
    kaydet();
    return yeni;
  },
  guncelle: (b) => {
    const db = oku();
    const idx = db.bahceciler.findIndex(x => x.id === b.id);
    if (idx < 0) throw new Error('Bahçeci bulunamadı');
    const { kalanBorc, ...guncellenen } = b;
    db.bahceciler[idx] = { ...db.bahceciler[idx], ...guncellenen, guncelleme: simdi() };
    kaydet();
    return db.bahceciler[idx];
  },
  sil: (id) => {
    const db = oku();
    // Cascade: alımları, ödemeleri sil; stoku geri al
    const silAlimlar = db.alimlar.filter(a => a.bahceciId === id);
    silAlimlar.forEach(a => {
      (a.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, -(u.miktar || 0)));
    });
    db.alimlar    = db.alimlar.filter(a => a.bahceciId !== id);
    db.odemeler   = db.odemeler.filter(o => o.bahceciId !== id);
    db.bahceciler = db.bahceciler.filter(x => x.id !== id);
    kaydet();
    return { ok: true, silinen: { alimlar: silAlimlar.length } };
  },
  cari: (id) => {
    const db     = oku();
    const borc   = bahceciCariBorc(db, id);
    const alimlar = db.alimlar
      .filter(a => a.bahceciId === id)
      .sort((a, b) => b.tarih?.localeCompare(a.tarih));
    const odemeler = db.odemeler
      .filter(o => o.bahceciId === id && o.tip === 'bahceci_odeme')
      .sort((a, b) => b.tarih?.localeCompare(a.tarih));
    return { ...borc, alimlar, odemeler };
  },
};

// ─── ÖDEMELER ────────────────────────────────────────────────────────────────
const odeme = {
  musteriTahsilat: (veri) => {
    const db = oku();
    db.meta.odemeNo += 1;
    const no   = `TAH-${new Date().getFullYear()}-${String(db.meta.odemeNo).padStart(4,'0')}`;
    const yeni = {
      id: yeniId(), odemeNo: no, tip: 'musteri_tahsilat',
      musteriId: veri.musteriId, musteriAdi: veri.musteriAdi,
      tutar: veri.tutar, odemeTipi: veri.odemeTipi || 'nakit',
      aciklama: veri.aciklama || '', tarih: veri.tarih || simdi().slice(0,10),
      olusturma: simdi(),
      cekNo: veri.cekNo || null, cekVade: veri.cekVade || null, cekBanka: veri.cekBanka || null,
    };
    db.odemeler.push(yeni);
    if (veri.odemeTipi === 'cek' && veri.cekNo && veri.cekVade) {
      db.cekler.push({
        id: yeniId(), olusturma: simdi(), kisiAdi: veri.musteriAdi,
        tip: 'Alacak', tutar: veri.tutar, cekNo: veri.cekNo,
        vadeTarihi: veri.cekVade, banka: veri.cekBanka || '', durum: 'bekliyor', odemeId: yeni.id,
      });
    }
    kaydet();
    return yeni;
  },
  bahceciOdeme: (veri) => {
    const db = oku();
    db.meta.odemeNo += 1;
    const no   = `ODE-${new Date().getFullYear()}-${String(db.meta.odemeNo).padStart(4,'0')}`;
    const yeni = {
      id: yeniId(), odemeNo: no, tip: 'bahceci_odeme',
      bahceciId: veri.bahceciId, bahceciAdi: veri.bahceciAdi,
      tutar: veri.tutar, odemeTipi: veri.odemeTipi || 'nakit',
      aciklama: veri.aciklama || '', tarih: veri.tarih || simdi().slice(0,10),
      olusturma: simdi(),
    };
    db.odemeler.push(yeni);
    kaydet();
    return yeni;
  },
  sil: (id) => {
    const db = oku();
    db.odemeler = db.odemeler.filter(x => x.id !== id);
    kaydet();
    return { ok: true };
  },
  liste: (filtre = {}) => {
    const db = oku();
    let liste = db.odemeler;
    if (filtre.musteriId) liste = liste.filter(o => o.musteriId === filtre.musteriId);
    if (filtre.bahceciId) liste = liste.filter(o => o.bahceciId === filtre.bahceciId);
    if (filtre.tip)       liste = liste.filter(o => o.tip === filtre.tip);
    return liste.sort((a, b) => b.olusturma.localeCompare(a.olusturma));
  },
};

// ─── SATIŞLAR ────────────────────────────────────────────────────────────────
const satis = {
  hepsi: (filtre = {}) => {
    let liste = oku().satislar;
    if (filtre.musteriId) liste = liste.filter(s => s.musteriId === filtre.musteriId);
    if (filtre.baslangic) liste = liste.filter(s => s.tarih >= filtre.baslangic);
    if (filtre.bitis)     liste = liste.filter(s => s.tarih <= filtre.bitis);
    if (filtre.durum)     liste = liste.filter(s => s.odenmeDurumu === filtre.durum);
    return liste.sort((a, b) => b.tarih?.localeCompare(a.tarih));
  },
  ekle: (s) => {
    const db = oku();
    db.meta.faturaNo += 1;
    const no = `FTR-${new Date().getFullYear()}-${String(db.meta.faturaNo).padStart(4,'0')}`;
    const odenmeDurumu = (s.odemeTipi === 'nakit' || s.odemeTipi === 'havale')
      ? 'odendi' : (s.odenmeDurumu || 'bekliyor');
    const yeni = { id: yeniId(), faturaNo: no, olusturma: simdi(), ...s, odenmeDurumu };
    db.satislar.push(yeni);
    // Stok düş
    (s.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, -(u.miktar || 0)));
    kaydet();
    return yeni;
  },
  guncelle: (s) => {
    const db  = oku();
    const idx = db.satislar.findIndex(x => x.id === s.id);
    if (idx < 0) throw new Error('Satış bulunamadı');
    const eski = db.satislar[idx];

    // Eski stokları geri ekle
    (eski.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, u.miktar || 0));
    // Yeni stokları düş
    (s.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, -(u.miktar || 0)));

    // Fatura no ve oluşturma tarihini koru
    db.satislar[idx] = {
      ...eski,
      ...s,
      id:         eski.id,
      faturaNo:   eski.faturaNo,
      olusturma:  eski.olusturma,
      guncelleme: simdi(),
    };
    kaydet();
    return db.satislar[idx];
  },
  sil: (id) => {
    const db  = oku();
    const sat = db.satislar.find(x => x.id === id);
    if (sat) {
      // Stoku geri ekle
      (sat.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, u.miktar || 0));
    }
    db.satislar = db.satislar.filter(x => x.id !== id);
    kaydet();
    return { ok: true };
  },
};

// ─── ALIMLAR ─────────────────────────────────────────────────────────────────
const alim = {
  hepsi: (filtre = {}) => {
    let liste = oku().alimlar;
    if (filtre.bahceciId) liste = liste.filter(a => a.bahceciId === filtre.bahceciId);
    if (filtre.baslangic) liste = liste.filter(a => a.tarih >= filtre.baslangic);
    if (filtre.bitis)     liste = liste.filter(a => a.tarih <= filtre.bitis);
    return liste.sort((a, b) => b.tarih?.localeCompare(a.tarih));
  },
  ekle: (a) => {
    const db = oku();
    db.meta.alimNo += 1;
    const no = `ALM-${new Date().getFullYear()}-${String(db.meta.alimNo).padStart(4,'0')}`;
    // Nakit alımlar anında ödenmiş sayılır
    const odemeDurumu = a.odemeTipi === 'nakit' ? 'odendi' : 'bekliyor';
    const yeni = { id: yeniId(), alimNo: no, olusturma: simdi(), odemeDurumu, ...a };
    db.alimlar.push(yeni);
    (a.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, u.miktar || 0, u.fiyat));
    kaydet();
    return yeni;
  },
  odendi: (id) => {
    const db  = oku();
    const idx = db.alimlar.findIndex(x => x.id === id);
    if (idx < 0) throw new Error('Alım bulunamadı');
    db.alimlar[idx].odemeDurumu   = 'odendi';
    db.alimlar[idx].odemeZamani   = simdi();
    kaydet();
    return db.alimlar[idx];
  },
  guncelle: (a) => {
    const db  = oku();
    const idx = db.alimlar.findIndex(x => x.id === a.id);
    if (idx < 0) throw new Error('Alım bulunamadı');
    const eski = db.alimlar[idx];

    // Eski stokları geri al
    (eski.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, -(u.miktar || 0)));
    // Yeni stokları ekle
    (a.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, u.miktar || 0, u.fiyat));

    // Alım no ve oluşturma tarihini koru
    db.alimlar[idx] = {
      ...eski,
      ...a,
      id:         eski.id,
      alimNo:     eski.alimNo,
      olusturma:  eski.olusturma,
      guncelleme: simdi(),
    };
    kaydet();
    return db.alimlar[idx];
  },
  sil: (id) => {
    const db  = oku();
    const al  = db.alimlar.find(x => x.id === id);
    if (al) {
      // Stoku geri al (alınan miktar stoktan düşülür)
      (al.urunler || []).forEach(u => stokGuncelle(db, u.urunAdi, -(u.miktar || 0)));
    }
    db.alimlar = db.alimlar.filter(x => x.id !== id);
    kaydet();
    return { ok: true };
  },
};

// ─── ÇEKLER ──────────────────────────────────────────────────────────────────
const cek = {
  hepsi: () => oku().cekler.sort((a, b) => a.vadeTarihi?.localeCompare(b.vadeTarihi)),
  ekle: (c) => {
    const db = oku();
    const yeni = { id: yeniId(), olusturma: simdi(), durum: 'bekliyor', ...c };
    db.cekler.push(yeni);
    kaydet();
    return yeni;
  },
  guncelle: (c) => {
    const db = oku();
    const idx = db.cekler.findIndex(x => x.id === c.id);
    if (idx < 0) throw new Error('Çek bulunamadı');
    db.cekler[idx] = { ...db.cekler[idx], ...c, guncelleme: simdi() };
    kaydet();
    return db.cekler[idx];
  },
  sil: (id) => {
    const db = oku();
    db.cekler = db.cekler.filter(x => x.id !== id);
    kaydet();
    return { ok: true };
  },
  tahsilEt: (id) => {
    const db = oku();
    const idx = db.cekler.findIndex(x => x.id === id);
    if (idx < 0) throw new Error('Çek bulunamadı');
    db.cekler[idx].durum        = 'tahsil';
    db.cekler[idx].tahsilTarihi = simdi();
    kaydet();
    return db.cekler[idx];
  },
};

// ─── STOK ────────────────────────────────────────────────────────────────────
const stok = {
  hepsi: () => oku().stok,
  urunler: () => oku().urunler,  // [{ad, kdv}] döner

  urunEkle: (urun) => {
    const db   = oku();
    const ad   = typeof urun === 'string' ? urun.trim() : urun.ad?.trim();
    const kdv  = typeof urun === 'string' ? 1 : (parseFloat(urun.kdv) ?? 1);
    if (!ad) throw new Error('Ürün adı boş olamaz');
    if (db.urunler.find(u => (typeof u==='string'?u:u.ad) === ad))
      throw new Error('Bu ürün zaten listede');
    db.urunler.push({ ad, kdv });
    db.urunler.sort((a, b) => {
      const aa = typeof a==='string'?a:a.ad;
      const bb = typeof b==='string'?b:b.ad;
      return aa.localeCompare(bb, 'tr');
    });
    kaydet();
    return db.urunler;
  },

  urunGuncelle: (ad, kdv) => {
    const db  = oku();
    const idx = db.urunler.findIndex(u => (typeof u==='string'?u:u.ad) === ad);
    if (idx >= 0) { db.urunler[idx] = { ad, kdv: parseFloat(kdv) || 0 }; kaydet(); }
    return db.urunler;
  },

  urunSil: (urunAdi) => {
    const db = oku();
    db.urunler = db.urunler.filter(u => (typeof u==='string'?u:u.ad) !== urunAdi);
    kaydet();
    return db.urunler;
  },

  sonFiyat: (urunAdi) => {
    const db     = oku();
    const stk    = db.stok.find(x => x.urunAdi === urunAdi);
    const urunObj = db.urunler.find(u => (typeof u==='string'?u:u.ad) === urunAdi);
    const kdvOrani = urunObj ? (typeof urunObj==='string' ? 1 : (urunObj.kdv ?? 1)) : 1;
    if (stk?.sonAlimFiyati)
      return { fiyat: stk.sonAlimFiyati, stok: stk.miktar || 0, kdvOrani };
    const gecmis = db.alimlar
      .flatMap(a => (a.urunler || []).map(u => ({ ...u, tarih: a.tarih })))
      .filter(u => u.urunAdi === urunAdi)
      .sort((a, b) => b.tarih?.localeCompare(a.tarih));
    if (gecmis.length)
      return { fiyat: gecmis[0].fiyat, stok: stk?.miktar || 0, kdvOrani };
    return { fiyat: null, stok: stk?.miktar || 0, kdvOrani };
  },

  guncelle: (s) => {
    const db = oku();
    const idx = db.stok.findIndex(x => x.id === s.id);
    if (idx >= 0) db.stok[idx] = { ...db.stok[idx], ...s, guncelleme: simdi() };
    else db.stok.push({ id: yeniId(), olusturma: simdi(), ...s });
    kaydet();
    return { ok: true };
  },
};

// ─── RAPORLAR ────────────────────────────────────────────────────────────────
const rapor = {
  dashboard: () => {
    const db    = oku();
    const bugun = new Date().toISOString().slice(0, 10);
    const bugunSatislar = db.satislar.filter(s => s.tarih?.startsWith(bugun));
    const bugunAlimlar  = db.alimlar.filter(a => a.tarih?.startsWith(bugun));

    const bugunKomisyon = bugunAlimlar.reduce((t, a) => t + (a.toplamKomisyon || 0), 0);
    const bugunKar      = bugunSatislar.reduce((t, s) => t + (s.genelToplam || 0), 0)
                        - bugunAlimlar.reduce((t, a) => t + (a.malBedeli || 0), 0)
                        + bugunKomisyon;

    const acikAlacak = db.musteriler.reduce((t, m) =>
      t + musteriCariBakiye(db, m.id).acikBakiye, 0);

    const vadeliCekler = db.cekler.filter(c => {
      if (c.durum !== 'bekliyor') return false;
      const gun = Math.round((new Date(c.vadeTarihi) - new Date()) / 86400000);
      return gun >= 0 && gun <= 7;
    });

    // Son 7 günün günlük satış
    const son7Gun = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const tarihStr = d.toISOString().slice(0, 10);
      son7Gun.push({
        tarih:  tarihStr,
        toplam: db.satislar
          .filter(s => s.tarih?.startsWith(tarihStr))
          .reduce((t, s) => t + (s.genelToplam || 0), 0),
      });
    }

    // Son 6 ay kar/zarar özeti
    const son6Ay = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const ayBas = d.toISOString().slice(0, 7); // "2026-01"
      const gelir   = db.satislar.filter(s => s.tarih?.startsWith(ayBas)).reduce((t,s)=>t+(s.genelToplam||0),0);
      const maliyet = db.alimlar.filter(a => a.tarih?.startsWith(ayBas)).reduce((t,a)=>t+(a.malBedeli||0),0);
      const kom     = db.alimlar.filter(a => a.tarih?.startsWith(ayBas)).reduce((t,a)=>t+(a.toplamKomisyon||0),0);
      son6Ay.push({ ay: ayBas, gelir, maliyet, kar: gelir - maliyet + kom });
    }

    return {
      bugunSatisToplam:  bugunSatislar.reduce((t, s) => t + (s.genelToplam || 0), 0),
      bugunAlimToplam:   bugunAlimlar.reduce((t, a) => t + (a.odenecekTutar || 0), 0),
      bugunSatisSayisi:  bugunSatislar.length,
      bugunAlimSayisi:   bugunAlimlar.length,
      bugunKomisyon,
      bugunKar,
      acikAlacak,
      vadeliCekToplam:   vadeliCekler.reduce((t, c) => t + (c.tutar || 0), 0),
      vadeliCekSayisi:   vadeliCekler.length,
      kritikStok:        db.stok.filter(s => (s.miktar || 0) <= (s.kritikSeviye || 20)),
      sonSatislar:       [...db.satislar].sort((a,b)=>b.olusturma?.localeCompare(a.olusturma)).slice(0,10),
      sonAlimlar:        [...db.alimlar].sort((a,b)=>b.olusturma?.localeCompare(a.olusturma)).slice(0,5),
      son7Gun,
      son6Ay,
    };
  },

  karZarar: ({ baslangic, bitis }) => {
    const db       = oku();
    const satislar = db.satislar.filter(s => s.tarih >= baslangic && s.tarih <= bitis);
    const alimlar  = db.alimlar.filter(a => a.tarih >= baslangic && a.tarih <= bitis);
    const tahsilatlar = db.odemeler.filter(o =>
      o.tip === 'musteri_tahsilat' && o.tarih >= baslangic && o.tarih <= bitis);

    const gelir    = satislar.reduce((t, s) => t + (s.genelToplam || 0), 0);
    const maliyet  = alimlar.reduce((t, a) => t + (a.malBedeli || 0), 0);
    const komisyon = alimlar.reduce((t, a) => t + (a.toplamKomisyon || 0), 0);
    const tahsilat = tahsilatlar.reduce((t, o) => t + (o.tutar || 0), 0);
    return {
      gelir, maliyet, komisyon, tahsilat,
      karBrut: gelir - maliyet,
      karNet:  gelir - maliyet + komisyon,
      satisAdedi: satislar.length,
      alimAdedi:  alimlar.length,
    };
  },

  excelExport: ({ baslangic, bitis }, dosyaYolu) => {
    const db = oku();
    const wb = XLSX.utils.book_new();

    // 1. Satışlar — her ürün ayrı satır
    const satisRows = [];
    db.satislar.filter(s => s.tarih >= baslangic && s.tarih <= bitis).forEach(s => {
      if ((s.urunler||[]).length === 0) {
        satisRows.push({
          'Fatura No':    s.faturaNo,
          'Tarih':        s.tarih?.slice(0,10),
          'Müşteri':      s.musteriAdi,
          'Ürün':         '—',
          'Birim':        '—',
          'Miktar':       0,
          'Birim Fiyat':  0,
          'KDV %':        0,
          'KDV ₺':        0,
          'Ürün Tutarı':  0,
          'İskonto %':    s.iskontoOrani||0,
          'KDV Toplam':   s.kdvTutar||0,
          'Genel Toplam': s.genelToplam,
          'Ödeme':        s.odemeTipi,
          'Durum':        s.odenmeDurumu,
        });
      } else {
        (s.urunler||[]).forEach((u,i) => {
          satisRows.push({
            'Fatura No':    i===0 ? s.faturaNo : '',
            'Tarih':        i===0 ? s.tarih?.slice(0,10) : '',
            'Müşteri':      i===0 ? s.musteriAdi : '',
            'Ürün':         u.urunAdi,
            'Birim':        u.birim||'kg',
            'Miktar':       u.miktar||0,
            'Birim Fiyat':  u.birimFiyat||0,
            'KDV %':        u.kdvOrani||0,
            'KDV ₺':        u.kdvTutar||0,
            'Ürün Tutarı':  u.tutar||0,
            'İskonto %':    i===0 ? (s.iskontoOrani||0) : '',
            'KDV Toplam':   i===0 ? (s.kdvTutar||0) : '',
            'Genel Toplam': i===0 ? s.genelToplam : '',
            'Ödeme':        i===0 ? s.odemeTipi : '',
            'Durum':        i===0 ? s.odenmeDurumu : '',
          });
        });
      }
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(satisRows), 'Satışlar');

    // 2. Alımlar — her ürün ayrı satır
    const alimRows = [];
    db.alimlar.filter(a => a.tarih >= baslangic && a.tarih <= bitis).forEach(a => {
      if ((a.urunler||[]).length === 0) {
        alimRows.push({
          'Alım No':      a.alimNo,
          'Tarih':        a.tarih?.slice(0,10),
          'Bahçeci':      a.bahceciAdi,
          'Ürün':         '—',
          'Birim':        '—',
          'Miktar':       0,
          'Alış Fiyatı':  0,
          'Kom %':        0,
          'KDV %':        0,
          'Ürün Tutarı':  0,
          'Mal Bedeli':   a.malBedeli||0,
          'Komisyon':     a.toplamKomisyon||0,
          'Stopaj':       a.stopajTutar||0,
          'Ödenecek':     a.odenecekTutar||0,
          'Ödeme':        a.odemeTipi,
        });
      } else {
        (a.urunler||[]).forEach((u,i) => {
          alimRows.push({
            'Alım No':      i===0 ? a.alimNo : '',
            'Tarih':        i===0 ? a.tarih?.slice(0,10) : '',
            'Bahçeci':      i===0 ? a.bahceciAdi : '',
            'Ürün':         u.urunAdi,
            'Birim':        u.birim||'kg',
            'Miktar':       u.miktar||0,
            'Alış Fiyatı':  u.fiyat||0,
            'Kom %':        u.komPct||0,
            'KDV %':        u.kdvPct||0,
            'Ürün Tutarı':  u.tutar||0,
            'Mal Bedeli':   i===0 ? (a.malBedeli||0) : '',
            'Komisyon':     i===0 ? (a.toplamKomisyon||0) : '',
            'Stopaj':       i===0 ? (a.stopajTutar||0) : '',
            'Ödenecek':     i===0 ? a.odenecekTutar : '',
            'Ödeme':        i===0 ? a.odemeTipi : '',
          });
        });
      }
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alimRows), 'Alımlar');

    // 3. Çekler
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      db.cekler.map(c => ({
        'Çek No':      c.cekNo,
        'Kişi':        c.kisiAdi,
        'Tip':         c.tip,
        'Tutar':       c.tutar,
        'Vade Tarihi': c.vadeTarihi,
        'Banka':       c.banka,
        'Durum':       c.durum,
      }))
    ), 'Çekler');

    // 4. Ödemeler / Tahsilatlar
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      db.odemeler.map(o => ({
        'Ödeme No':   o.odemeNo,
        'Tarih':      o.tarih,
        'Tip':        o.tip === 'musteri_tahsilat' ? 'Müşteri Tahsilat' : 'Bahçeci Ödeme',
        'Kişi':       o.musteriAdi || o.bahceciAdi,
        'Tutar':      o.tutar,
        'Ödeme Tipi': o.odemeTipi,
        'Açıklama':   o.aciklama,
      }))
    ), 'Ödemeler');

    // 5. MÜŞTERİ CARİ ÖZETİ — en önemli sayfa
    const musteriCariData = db.musteriler.map(m => {
      const cari = musteriCariBakiye(db, m.id);
      return {
        'Müşteri':          m.ad,
        'Tür':              m.tur || '—',
        'Telefon':          m.tel || '—',
        'Toplam Satış (₺)': cari.satisToplam,
        'Tahsilat (₺)':     cari.tahsilat,
        'Açık Bakiye (₺)':  cari.acikBakiye,
        'Durum':            cari.acikBakiye > 0 ? 'Borçlu' : 'Temiz',
      };
    }).sort((a, b) => b['Açık Bakiye (₺)'] - a['Açık Bakiye (₺)']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(musteriCariData), 'Müşteri Cari');

    // 6. BAHÇECİ CARİ ÖZETİ
    const bahceciCariData = db.bahceciler.map(b => {
      const cari = bahceciCariBorc(db, b.id);
      return {
        'Bahçeci':          b.ad,
        'Telefon':          b.tel || '—',
        'Komisyon %':       b.komisyonOrani || 5,
        'Toplam Alım (₺)':  cari.alimToplam,
        'Ödenen (₺)':       cari.odenenToplam,
        'Kalan Borç (₺)':   cari.kalanBorc,
        'Durum':            cari.kalanBorc > 0 ? 'Borç Var' : 'Ödenmiş',
      };
    }).sort((a, b) => b['Kalan Borç (₺)'] - a['Kalan Borç (₺)']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bahceciCariData), 'Bahçeci Cari');

    // 7. Stok Durumu
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      db.stok.map(s => ({
        'Ürün':            s.urunAdi,
        'Birim':           s.birim || 'kg',
        'Mevcut Stok':     s.miktar || 0,
        'Kritik Seviye':   s.kritikSeviye || 20,
        'Son Alış Fiyatı': s.sonAlimFiyati || 0,
        'Tahmini Değer':   Math.round((s.miktar||0) * (s.sonAlimFiyati||0) * 100) / 100,
        'Durum':           (s.miktar||0) <= (s.kritikSeviye||20) ? 'KRİTİK' : 'Normal',
      }))
    ), 'Stok');

    XLSX.writeFile(wb, dosyaYolu);
    return { ok: true, dosya: dosyaYolu };
  },
};

// ─── AYARLAR ─────────────────────────────────────────────────────────────────
const ayar = {
  oku:    ()  => oku().ayarlar,
  kaydet: (a) => {
    const db = oku();
    db.ayarlar = { ...db.ayarlar, ...a };
    kaydet();
    return db.ayarlar;
  },
};

// ─── AUTH ────────────────────────────────────────────────────────────────────
const auth = {
  durum: () => ({ kurulumGerekli: !oku().auth.sifreHash }),
  kurulum: async ({ kullanici, isim, sifre }) => {
    if (!kullanici || !sifre) return { ok: false, hata: 'Kullanıcı adı ve şifre zorunludur' };
    const db = oku();
    if (db.auth.sifreHash) return { ok: false, hata: 'Kurulum zaten tamamlandı' };
    db.auth.kullanici = kullanici.trim().toLowerCase();
    db.auth.isim      = (isim || kullanici).trim();
    db.auth.sifreHash = await bcrypt.hash(sifre, 10);
    kaydet();
    return { ok: true, isim: db.auth.isim, kullanici: db.auth.kullanici };
  },
  giris: async ({ kullanici, sifre }) => {
    const db = oku();
    if (!db.auth.sifreHash) return { ok: false, kurulumGerekli: true };
    if (db.auth.kullanici && db.auth.kullanici !== kullanici.trim().toLowerCase())
      return { ok: false, hata: 'Kullanıcı adı veya şifre hatalı' };
    const dogru = await bcrypt.compare(sifre, db.auth.sifreHash);
    if (!dogru) return { ok: false, hata: 'Kullanıcı adı veya şifre hatalı' };
    return { ok: true, isim: db.auth.isim || db.auth.kullanici, kullanici: db.auth.kullanici };
  },
  sifreDegis: async ({ eskiSifre, yeniSifre }) => {
    const db = oku();
    if (db.auth.sifreHash) {
      const dogru = await bcrypt.compare(eskiSifre, db.auth.sifreHash);
      if (!dogru) return { ok: false, hata: 'Mevcut şifre yanlış' };
    }
    db.auth.sifreHash = await bcrypt.hash(yeniSifre, 10);
    kaydet();
    return { ok: true };
  },
  kullaniciBilgi: () => {
    const db = oku();
    return { kullanici: db.auth.kullanici, isim: db.auth.isim };
  },
};

// ─── YEDEKLEME ───────────────────────────────────────────────────────────────
function backup(hedefYol) {
  const db  = oku();
  const yol = hedefYol || path.join(BACK_DIR, `yedek_${new Date().toISOString().slice(0,10)}.json`);
  fs.writeFileSync(yol, JSON.stringify(db, null, 2), 'utf8');
  if (!hedefYol) {
    const dosyalar = fs.readdirSync(BACK_DIR).sort();
    if (dosyalar.length > 30)
      dosyalar.slice(0, dosyalar.length - 30).forEach(d => fs.unlinkSync(path.join(BACK_DIR, d)));
  }
  return { ok: true, dosya: yol };
}

function restore(dosyaYolu) {
  try {
    const icerik = JSON.parse(fs.readFileSync(dosyaYolu, 'utf8'));
    backup();
    fs.writeFileSync(DB_FILE, JSON.stringify(icerik, null, 2), 'utf8');
    _db = null;
    oku();
    return { ok: true };
  } catch (e) {
    return { ok: false, hata: e.message };
  }
}

module.exports = { init, musteri, bahceci, odeme, satis, alim, cek, stok, rapor, ayar, auth, backup, restore };
