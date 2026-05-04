// src/main/preload.js — Güvenli IPC Köprüsü
// contextIsolation=true ile renderer'a güvenli API sunar

const { contextBridge, ipcRenderer } = require('electron');

// Renderer'ın çağırabileceği tüm kanallar
const KANALLAR = [
  'musteri:liste','musteri:ekle','musteri:guncelle','musteri:sil','musteri:cari',
  'bahceci:liste','bahceci:ekle','bahceci:guncelle','bahceci:sil','bahceci:cari',
  'odeme:musteriTahsilat','odeme:bahceciOdeme','odeme:sil','odeme:liste',
  'satis:liste','satis:ekle','satis:guncelle','satis:sil',
  'alim:liste','alim:ekle','alim:guncelle','alim:sil','alim:odendi',
  'cek:liste','cek:ekle','cek:guncelle','cek:sil','cek:tahsilEt',
  'stok:liste','stok:guncelle','stok:urunler','stok:urunEkle','stok:urunGuncelle','stok:urunSil','stok:sonFiyat',
  'rapor:dashboard','rapor:karZarar','rapor:excelExport',
  'yazici:fisYazdir','yazici:faturaYazdir','yazici:alimMakbuzu','yazici:yaziciListe',
  'ayar:oku','ayar:kaydet',
  'auth:durum','auth:kurulum','auth:giris','auth:sifreDegis','auth:kullaniciBilgi',
  'yedek:al','yedek:yukle',
  'lisans:kontrol','lisans:aktiflestir','lisans:bilgi',
];

contextBridge.exposeInMainWorld('tt', {
  // Dinamik invoke — tüm kanalları tek API ile çağır
  // Kullanım: await window.tt.invoke('satis:ekle', satirData)
  invoke: (kanal, ...args) => {
    if (!KANALLAR.includes(kanal)) {
      throw new Error(`Yetkisiz kanal: ${kanal}`);
    }
    return ipcRenderer.invoke(kanal, ...args);
  },

  // Uygulama versiyonu
  versiyon: process.env.npm_package_version || '1.0.0',
});
