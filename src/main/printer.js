// src/main/printer.js — Yazıcı Modülü
// Termal fiş (58/80mm) ve A4 fatura yazdırma

const { BrowserWindow } = require('electron');
const path = require('path');

// ─── Yazıcı Listesi ─────────────────────────────────────────────────────────
async function liste(mainWin) {
  try {
    const yazicilar = await mainWin.webContents.getPrintersAsync();
    return yazicilar.map(p => ({
      isim:    p.name,
      varsayilan: p.isDefault || false,
      durum:   p.status === 0 ? 'hazir' : 'mesgul',
    }));
  } catch {
    return [];
  }
}

// ─── HTML → Yazdır ──────────────────────────────────────────────────────────
function htmlYazdir(htmlIcerik, yaziciAdi, mainWin, ayarlar = {}) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 400,
      height: 600,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlIcerik));

    win.webContents.once('did-finish-load', async () => {
      try {
        // Yazıcı listesini al
        const yazicilar = await mainWin.webContents.getPrintersAsync();

        const hedef = yazicilar.find(p => p.name === yaziciAdi) || yazicilar[0];

        const secenekler = {
          silent: true,
          printBackground: true,
          deviceName: hedef ? hedef.name : '',
          pageSize: ayarlar.kagit || { width: 80000, height: 297000 }, // mikron
          margins: { marginType: 'custom', top: 2, bottom: 2, left: 4, right: 4 },
          ...ayarlar.printOptions,
        };

        win.webContents.print(secenekler, (basarili, hata) => {
          win.close();
          if (basarili) resolve({ ok: true });
          else reject(new Error(hata || 'Yazdırma başarısız'));
        });
      } catch (e) {
        win.close();
        reject(e);
      }
    });
  });
}

// ─── Fiş HTML Şablonu (Termal) ───────────────────────────────────────────────
function fisHtml(data) {
  const { firma, fatura, urunler, ozet, odeme, dipnot } = data;
  const tarih = new Date(fatura.tarih).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const satirlar = (urunler || []).map(u => `
    <tr>
      <td style="padding:1px 0;">${u.urunAdi}</td>
      <td style="text-align:center;">${u.miktar} ${u.birim}</td>
      <td style="text-align:right;font-weight:bold;">₺${Number(u.tutar).toLocaleString('tr-TR')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { margin: 0; size: 80mm auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px;
         width: 72mm; padding: 4mm; color: #000; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .big    { font-size: 15px; font-weight: bold; letter-spacing: 2px; }
  .divider { border: none; border-top: 1px dashed #555; margin: 3mm 0; }
  table   { width: 100%; border-collapse: collapse; }
  th      { font-size: 9px; text-transform: uppercase; padding: 2px 0;
            border-bottom: 1px solid #000; }
  .kv     { display: flex; justify-content: space-between; font-size: 10px; padding: 1px 0; }
  .kv .k  { color: #555; }
  .total  { display: flex; justify-content: space-between; font-size: 14px;
            font-weight: bold; padding: 3px 0; border-top: 2px solid #000; margin-top: 2mm; }
  .foot   { font-size: 9px; text-align: center; color: #555; margin-top: 3mm; line-height: 1.5; }
  .barcode { font-size: 20px; letter-spacing: 3px; text-align: center; margin: 2mm 0; }
</style>
</head><body>
  <div class="center" style="margin-bottom:3mm;">
    <div class="big">${(firma.adi || 'TAZETAKIP').toUpperCase()}</div>
    <div style="font-size:9px;">${firma.adres || ''}</div>
    <div style="font-size:9px;">${firma.tel ? 'Tel: ' + firma.tel : ''}</div>
  </div>
  <hr class="divider">
  <div class="kv"><span class="k">Fatura No</span><span class="bold">${fatura.no}</span></div>
  <div class="kv"><span class="k">Tarih</span><span>${tarih}</span></div>
  <div class="kv"><span class="k">Müşteri</span><span class="bold">${fatura.musteriAdi}</span></div>
  <div class="kv"><span class="k">Ödeme</span><span>${odeme.tip}</span></div>
  <hr class="divider">
  <table>
    <thead><tr><th style="text-align:left;">Ürün</th><th style="text-align:center;">Miktar</th><th style="text-align:right;">Tutar</th></tr></thead>
    <tbody>${satirlar}</tbody>
  </table>
  <hr class="divider">
  <div class="kv"><span class="k">Ara Toplam</span><span>₺${Number(ozet.araToplam).toLocaleString('tr-TR')}</span></div>
  ${ozet.iskontoTutar > 0 ? `<div class="kv"><span class="k">İskonto</span><span>-₺${Number(ozet.iskontoTutar).toLocaleString('tr-TR')}</span></div>` : ''}
  ${ozet.kdvTutar > 0 ? `<div class="kv"><span class="k">KDV (%${ozet.kdvOrani})</span><span>₺${Number(ozet.kdvTutar).toLocaleString('tr-TR')}</span></div>` : ''}
  <div class="total"><span>TOPLAM</span><span>₺${Number(ozet.genelToplam).toLocaleString('tr-TR')}</span></div>
  ${odeme.vade ? `<div class="kv" style="margin-top:2mm;"><span class="k">Vade</span><span>${new Date(odeme.vade).toLocaleDateString('tr-TR')}</span></div>` : ''}
  <hr class="divider">
  <div class="barcode">||| |||| ||| |||</div>
  <div class="foot">${dipnot || 'Teşekkür ederiz!'}<br>${firma.adi || 'OrvixHal'}</div>
  <div class="kv" style="margin-top:3mm;font-size:9px;"><span>Kasiyer</span><span>${fatura.kasiyer || ''}</span></div>
  <div style="height:10mm;"></div>
</body></html>`;
}

// ─── Fatura HTML Şablonu (A4) ────────────────────────────────────────────────
function faturaHtml(data) {
  const { firma, fatura, urunler, ozet, odeme } = data;
  const satirlar = (urunler || []).map((u, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'};">
      <td style="padding:7px 10px;">${i + 1}</td>
      <td style="padding:7px 10px;">${u.urunAdi}</td>
      <td style="padding:7px 10px;text-align:center;">${u.miktar} ${u.birim}</td>
      <td style="padding:7px 10px;text-align:right;">₺${Number(u.birimFiyat).toLocaleString('tr-TR')}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:bold;">₺${Number(u.tutar).toLocaleString('tr-TR')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { margin: 15mm 20mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; }
  .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .firma-adi { font-size: 22px; font-weight: bold; color: #2D7A3A; }
  .fatura-baslik { font-size: 20px; font-weight: bold; color: #555; text-align: right; }
  .fatura-no { font-size: 14px; font-weight: bold; color: #2D7A3A; text-align: right; }
  .bilgi-tablo { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .bilgi-tablo td { padding: 5px 10px; border: 0.5px solid #ddd; }
  .bilgi-tablo .etiket { background: #f5f5f5; font-weight: bold; color: #555; width: 140px; }
  .urun-tablo { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .urun-tablo th { background: #2D7A3A; color: #fff; padding: 9px 10px; text-align: left; font-size: 11px; }
  .urun-tablo td { border-bottom: 0.5px solid #eee; font-size: 12px; }
  .ozet-tablo { width: 260px; margin-left: auto; border-collapse: collapse; }
  .ozet-tablo td { padding: 5px 10px; font-size: 12px; }
  .ozet-tablo .etiket { color: #666; }
  .ozet-tablo .deger { text-align: right; font-weight: bold; }
  .toplam-satir { background: #2D7A3A; color: #fff; font-size: 14px; font-weight: bold; }
  .toplam-satir td { padding: 9px 10px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd;
            font-size: 10px; color: #888; text-align: center; }
</style>
</head><body>
  <div class="header">
    <div>
      <div class="firma-adi">${firma.adi || 'OrvixHal'}</div>
      <div style="color:#666;margin-top:4px;">${firma.adres || ''}</div>
      <div style="color:#666;">${firma.tel ? 'Tel: ' + firma.tel : ''}</div>
    </div>
    <div>
      <div class="fatura-baslik">FATURA</div>
      <div class="fatura-no">${fatura.no}</div>
      <div style="text-align:right;color:#666;margin-top:4px;">${new Date(fatura.tarih).toLocaleDateString('tr-TR')}</div>
    </div>
  </div>

  <table class="bilgi-tablo">
    <tr><td class="etiket">Müşteri</td><td>${fatura.musteriAdi}</td>
        <td class="etiket">Ödeme Yöntemi</td><td>${odeme.tip}</td></tr>
    <tr><td class="etiket">Fatura Tarihi</td><td>${new Date(fatura.tarih).toLocaleDateString('tr-TR')}</td>
        <td class="etiket">Vade Tarihi</td><td>${odeme.vade ? new Date(odeme.vade).toLocaleDateString('tr-TR') : '-'}</td></tr>
  </table>

  <table class="urun-tablo">
    <thead><tr><th>#</th><th>Ürün</th><th style="text-align:center;">Miktar</th>
    <th style="text-align:right;">Birim Fiyat</th><th style="text-align:right;">Tutar</th></tr></thead>
    <tbody>${satirlar}</tbody>
  </table>

  <table class="ozet-tablo">
    <tr><td class="etiket">Ara Toplam</td><td class="deger">₺${Number(ozet.araToplam).toLocaleString('tr-TR')}</td></tr>
    ${ozet.iskontoTutar > 0 ? `<tr><td class="etiket">İskonto</td><td class="deger" style="color:#c00;">-₺${Number(ozet.iskontoTutar).toLocaleString('tr-TR')}</td></tr>` : ''}
    <tr><td class="etiket">KDV (%${ozet.kdvOrani})</td><td class="deger">₺${Number(ozet.kdvTutar).toLocaleString('tr-TR')}</td></tr>
    <tr class="toplam-satir"><td>TOPLAM</td><td style="text-align:right;">₺${Number(ozet.genelToplam).toLocaleString('tr-TR')}</td></tr>
  </table>

  <div class="footer">
    ${firma.adi || 'OrvixHal'} · ${firma.adres || ''} · ${firma.tel || ''}
  </div>
</body></html>`;
}

// ─── Alım Makbuzu HTML (Termal) ──────────────────────────────────────────────
function alimMakbuzuHtml(data) {
  const { firma, alim, urunler, ozet, odeme } = data;
  const tarih = new Date(alim.tarih).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const satirlar = (urunler || []).map(u => `
    <tr>
      <td style="padding:1px 0;">${u.urunAdi}</td>
      <td style="text-align:center;">${u.miktar} ${u.birim}</td>
      <td style="text-align:center;">%${u.komPct||0}</td>
      <td style="text-align:right;font-weight:bold;">₺${Number(u.tutar).toLocaleString('tr-TR')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { margin: 0; size: 80mm auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; padding: 4mm; color: #000; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .big    { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
  .divider { border: none; border-top: 1px dashed #555; margin: 3mm 0; }
  table   { width: 100%; border-collapse: collapse; }
  th      { font-size: 9px; text-transform: uppercase; padding: 2px 0; border-bottom: 1px solid #000; }
  .kv     { display: flex; justify-content: space-between; font-size: 10px; padding: 1px 0; }
  .total  { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; padding: 3px 0; border-top: 2px solid #000; margin-top: 2mm; }
  .kom-box { border: 1px dashed #555; padding: 2mm; margin: 2mm 0; }
  .foot   { font-size: 9px; text-align: center; color: #555; margin-top: 3mm; line-height: 1.5; }
</style>
</head><body>
  <div class="center" style="margin-bottom:3mm;">
    <div class="big">${(firma.adi || 'TAZETAKIP').toUpperCase()}</div>
    <div style="font-size:9px;">BAHÇECI ALIM MAKBUZU</div>
    <div style="font-size:9px;">${firma.adres || ''}</div>
  </div>
  <hr class="divider">
  <div class="kv"><span>Alım No</span><span class="bold">${alim.no}</span></div>
  <div class="kv"><span>Tarih</span><span>${tarih}</span></div>
  <div class="kv"><span>Bahçeci</span><span class="bold">${alim.bahceciAdi}</span></div>
  <div class="kv"><span>Teslimat</span><span>${alim.teslimatYeri||'—'}</span></div>
  <hr class="divider">
  <table>
    <thead><tr>
      <th style="text-align:left;">Ürün</th>
      <th style="text-align:center;">Miktar</th>
      <th style="text-align:center;">Kom%</th>
      <th style="text-align:right;">Tutar</th>
    </tr></thead>
    <tbody>${satirlar}</tbody>
  </table>
  <hr class="divider">
  <div class="kv"><span>Mal Bedeli</span><span>₺${Number(ozet.malBedeli).toLocaleString('tr-TR')}</span></div>
  <div class="kom-box">
    <div class="kv"><span>Komisyon Kazancım</span><span class="bold">₺${Number(ozet.toplamKomisyon).toLocaleString('tr-TR')}</span></div>
  </div>
  ${ozet.stopajTutar > 0 ? `<div class="kv"><span>Stopaj (%${ozet.stopajOrani||0})</span><span style="color:#A32D2D;">- ₺${Number(ozet.stopajTutar).toLocaleString('tr-TR')}</span></div>` : ''}
  ${ozet.nakliye > 0 ? `<div class="kv"><span>Nakliye</span><span>₺${Number(ozet.nakliye).toLocaleString('tr-TR')}</span></div>` : ''}
  <div class="total"><span>ÖDENECEK</span><span>₺${Number(ozet.odenecekTutar).toLocaleString('tr-TR')}</span></div>
  <div class="kv" style="margin-top:2mm;"><span>Ödeme Tipi</span><span>${odeme.tip||'—'}</span></div>
  <hr class="divider">
  <div class="foot">Bahçeci İmza: ____________________<br>${firma.adi || 'OrvixHal'}</div>
  <div style="height:10mm;"></div>
</body></html>`;
}

// ─── Dışa Açık Fonksiyonlar ──────────────────────────────────────────────────
async function fisYazdir(data, mainWin) {
  const html = fisHtml(data);
  return htmlYazdir(html, data.yazici, mainWin, {
    kagit: data.kagitGenislik === '58mm'
      ? { width: 58000, height: 200000 }
      : { width: 80000, height: 200000 },
  });
}

async function faturaYazdir(data, mainWin) {
  const html = faturaHtml(data);
  return htmlYazdir(html, data.yazici, mainWin, {
    kagit: 'A4',
    printOptions: { landscape: false },
  });
}

async function alimMakbuzu(data, mainWin) {
  const html = alimMakbuzuHtml(data);
  return htmlYazdir(html, data.yazici, mainWin, {
    kagit: data.kagitGenislik === '58mm'
      ? { width: 58000, height: 200000 }
      : { width: 80000, height: 200000 },
  });
}

module.exports = { liste, fisYazdir, faturaYazdir, alimMakbuzu };
