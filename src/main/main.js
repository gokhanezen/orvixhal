// src/main/main.js — OrvixHal Ana Süreç

const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');
const db   = require('./db');
const printer = require('./printer');
const license = require('./license');

const isDev = process.argv.includes('--dev');

let mainWindow;

// ─── Ana Pencere ────────────────────────────────────────────────────────────
function createWindow() {
  // Icon yolu — dev ve production için farklı
  const iconPath = isDev
    ? path.join(__dirname, '../../assets/icon.ico')
    : path.join(process.resourcesPath, 'assets/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'OrvixHal — Meyve Sebze Toptancı Yönetimi',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#F7F6F2',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // Ctrl+P'nin tarayıcı print diyalogunu açmasını engelle —
  // uygulama kendi yazdırma mantığını renderer'da yönetiyor.
  // Boş bir uygulama menüsü bırakarak varsayılan aksiyonları devre dışı bırakıyoruz.
  const kisayolMenu = Menu.buildFromTemplate([
    {
      label: 'OrvixHal',
      submenu: [
        { role: 'quit', label: 'Çıkış', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Düzen',
      submenu: [
        { role: 'undo',       label: 'Geri Al',    accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo',       label: 'İleri Al',   accelerator: 'CmdOrCtrl+Shift+Z' },
        { role: 'cut',        label: 'Kes',         accelerator: 'CmdOrCtrl+X' },
        { role: 'copy',       label: 'Kopyala',     accelerator: 'CmdOrCtrl+C' },
        { role: 'paste',      label: 'Yapıştır',    accelerator: 'CmdOrCtrl+V' },
        { role: 'selectAll',  label: 'Tümünü Seç', accelerator: 'CmdOrCtrl+A' },
        // Ctrl+P ve Ctrl+F tarayıcı varsayılanlarını engelle (renderer handle eder)
        {
          label: 'Yazdır',
          accelerator: 'CmdOrCtrl+P',
          click: () => {}, // renderer'daki keydown handler çalışacak
          visible: false,
        },
        {
          label: 'Ara',
          accelerator: 'CmdOrCtrl+F',
          click: () => {},
          visible: false,
        },
      ],
    },
    isDev ? {
      label: 'Geliştirici',
      submenu: [
        { role: 'reload', label: 'Yenile', accelerator: 'CmdOrCtrl+R' },
        { role: 'toggleDevTools', label: 'DevTools', accelerator: 'CmdOrCtrl+Shift+I' },
      ],
    } : null,
  ].filter(Boolean));
  Menu.setApplicationMenu(kisayolMenu);
}

app.whenReady().then(() => {
  db.init();           // JSON veritabanını başlat / oluştur
  createWindow();
  scheduleBackup();    // Otomatik yedekleme zamanlayıcısı
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Otomatik Yedekleme ─────────────────────────────────────────────────────
function scheduleBackup() {
  // Her gece 23:00'de yedek al
  const now   = new Date();
  const night = new Date(now);
  night.setHours(23, 0, 0, 0);
  if (night <= now) night.setDate(night.getDate() + 1);
  const ms = night - now;

  setTimeout(() => {
    db.backup();
    setInterval(() => db.backup(), 24 * 60 * 60 * 1000);
  }, ms);
}

// ─── IPC: Müşteriler ────────────────────────────────────────────────────────
ipcMain.handle('musteri:liste',    ()       => db.musteri.hepsi());
ipcMain.handle('musteri:ekle',     (_, m)   => db.musteri.ekle(m));
ipcMain.handle('musteri:guncelle', (_, m)   => db.musteri.guncelle(m));
ipcMain.handle('musteri:sil',      (_, id)  => db.musteri.sil(id));
ipcMain.handle('musteri:cari',     (_, id)  => db.musteri.cari(id));

// ─── IPC: Bahçeciler ────────────────────────────────────────────────────────
ipcMain.handle('bahceci:liste',    ()       => db.bahceci.hepsi());
ipcMain.handle('bahceci:ekle',     (_, b)   => db.bahceci.ekle(b));
ipcMain.handle('bahceci:guncelle', (_, b)   => db.bahceci.guncelle(b));
ipcMain.handle('bahceci:sil',      (_, id)  => db.bahceci.sil(id));
ipcMain.handle('bahceci:cari',     (_, id)  => db.bahceci.cari(id));

// ─── IPC: Ödemeler (Cari Hareketler) ────────────────────────────────────────
ipcMain.handle('odeme:musteriTahsilat', (_, v) => db.odeme.musteriTahsilat(v));
ipcMain.handle('odeme:bahceciOdeme',    (_, v) => db.odeme.bahceciOdeme(v));
ipcMain.handle('odeme:sil',             (_, id) => db.odeme.sil(id));
ipcMain.handle('odeme:liste',           (_, f)  => db.odeme.liste(f));

// ─── IPC: Satışlar ──────────────────────────────────────────────────────────
ipcMain.handle('satis:liste',    (_, filtre) => db.satis.hepsi(filtre));
ipcMain.handle('satis:ekle',     (_, s)      => db.satis.ekle(s));
ipcMain.handle('satis:guncelle', (_, s)      => db.satis.guncelle(s));
ipcMain.handle('satis:sil',      (_, id)     => db.satis.sil(id));

// ─── IPC: Alımlar ───────────────────────────────────────────────────────────
ipcMain.handle('alim:liste',    (_, filtre) => db.alim.hepsi(filtre));
ipcMain.handle('alim:ekle',     (_, a)      => db.alim.ekle(a));
ipcMain.handle('alim:guncelle', (_, a)      => db.alim.guncelle(a));
ipcMain.handle('alim:sil',      (_, id)     => db.alim.sil(id));
ipcMain.handle('alim:odendi',   (_, id)     => db.alim.odendi(id));

// ─── IPC: Çekler ────────────────────────────────────────────────────────────
ipcMain.handle('cek:liste',      ()        => db.cek.hepsi());
ipcMain.handle('cek:ekle',       (_, c)    => db.cek.ekle(c));
ipcMain.handle('cek:guncelle',   (_, c)    => db.cek.guncelle(c));
ipcMain.handle('cek:sil',        (_, id)   => db.cek.sil(id));
ipcMain.handle('cek:tahsilEt',   (_, id)   => db.cek.tahsilEt(id));

// ─── IPC: Stok ──────────────────────────────────────────────────────────────
ipcMain.handle('stok:liste',        ()       => db.stok.hepsi());
ipcMain.handle('stok:guncelle',     (_, s)   => db.stok.guncelle(s));
ipcMain.handle('stok:urunler',      ()       => db.stok.urunler());
ipcMain.handle('stok:urunEkle',     (_, u)   => db.stok.urunEkle(u));
ipcMain.handle('stok:urunGuncelle', (_, ad, kdv) => db.stok.urunGuncelle(ad, kdv));
ipcMain.handle('stok:urunSil',      (_, u)   => db.stok.urunSil(u));
ipcMain.handle('stok:sonFiyat',     (_, u)   => db.stok.sonFiyat(u));

// ─── IPC: Raporlar ──────────────────────────────────────────────────────────
ipcMain.handle('rapor:dashboard',    ()         => db.rapor.dashboard());
ipcMain.handle('rapor:karZarar',     (_, aralik) => db.rapor.karZarar(aralik));
ipcMain.handle('rapor:excelExport',  (_, aralik) => {
  const dosyaYolu = dialog.showSaveDialogSync(mainWindow, {
    title: 'Excel Raporu Kaydet',
    defaultPath: `OrvixHal_Rapor_${new Date().toISOString().slice(0,10)}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (!dosyaYolu) return { iptal: true };
  return db.rapor.excelExport(aralik, dosyaYolu);
});

// ─── IPC: Yazdırma ──────────────────────────────────────────────────────────
ipcMain.handle('yazici:fisYazdir',     (_, data) => printer.fisYazdir(data, mainWindow));
ipcMain.handle('yazici:faturaYazdir',  (_, data) => printer.faturaYazdir(data, mainWindow));
ipcMain.handle('yazici:alimMakbuzu',   (_, data) => printer.alimMakbuzu(data, mainWindow));
ipcMain.handle('yazici:yaziciListe',   ()        => printer.liste(mainWindow));

// ─── IPC: Ayarlar / Auth ────────────────────────────────────────────────────
ipcMain.handle('ayar:oku',          ()       => db.ayar.oku());
ipcMain.handle('ayar:kaydet',       (_, a)   => db.ayar.kaydet(a));
ipcMain.handle('auth:durum',        ()       => db.auth.durum());
ipcMain.handle('auth:kurulum',      (_, d)   => db.auth.kurulum(d));
ipcMain.handle('auth:giris',        (_, d)   => db.auth.giris(d));
ipcMain.handle('auth:sifreDegis',   (_, d)   => db.auth.sifreDegis(d));
ipcMain.handle('auth:kullaniciBilgi', ()     => db.auth.kullaniciBilgi());

// ─── IPC: Yedekleme ─────────────────────────────────────────────────────────
ipcMain.handle('yedek:al', () => {
  const hedef = dialog.showSaveDialogSync(mainWindow, {
    title: 'Yedek Dosyasını Kaydet',
    defaultPath: `OrvixHal_Yedek_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON Yedek', extensions: ['json'] }],
  });
  if (!hedef) return { iptal: true };
  return db.backup(hedef);
});
ipcMain.handle('yedek:yukle', () => {
  const dosyalar = dialog.showOpenDialogSync(mainWindow, {
    title: 'Yedek Dosyası Seç',
    filters: [{ name: 'JSON Yedek', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!dosyalar || !dosyalar[0]) return { iptal: true };
  return db.restore(dosyalar[0]);
});

// ─── IPC: Lisans ─────────────────────────────────────────────────────────────
ipcMain.handle('lisans:kontrol',  ()        => {
  const kod = license.lisansOku();
  if (!kod) return { gecerli: false, kurulumGerekli: true };
  return license.lisansDogrula(kod);
});
ipcMain.handle('lisans:aktiflestir', (_, kod) => {
  const sonuc = license.lisansDogrula(kod);
  if (sonuc.gecerli) license.lisansKaydet(kod);
  return sonuc;
});
ipcMain.handle('lisans:bilgi', () => {
  const kod = license.lisansOku();
  if (!kod) return null;
  return license.lisansDogrula(kod);
});
