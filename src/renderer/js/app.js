// src/renderer/js/app.js — Ana Renderer

// ─── Yardımcı: IPC çağrısı ───────────────────────────────────────────────────
// window.tt preload.js tarafından expose edilir (contextBridge).
// Burada sadece kısa alias oluşturuyoruz — const kullanmıyoruz (çakışma önlenir).
function ipc(kanal, ...args) {
  return window.tt.invoke(kanal, ...args);
}

// ─── Yardımcı: Para formatı ──────────────────────────────────────────────────
function fmtPara(n) {
  return '₺' + (Math.round((n || 0) * 100) / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// ─── Yardımcı: Tarih formatı ─────────────────────────────────────────────────
function fmtTarih(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtTarihSaat(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Yardımcı: Vade günü ─────────────────────────────────────────────────────
function vadeFark(tarihStr) {
  if (!tarihStr) return null;
  const t = new Date(tarihStr);
  const bugun = new Date(); bugun.setHours(0,0,0,0); t.setHours(0,0,0,0);
  return Math.round((t - bugun) / 86400000);
}

// ─── Yardımcı: Pill HTML ─────────────────────────────────────────────────────
function pillHtml(metin, tip) {
  return `<span class="pill pill-${tip}">${metin}</span>`;
}

function durumPill(durum) {
  const m = {
    odendi: ['Ödendi','green'],   bekliyor: ['Bekliyor','amber'],
    vadeli:  ['Vadeli','blue'],   iptal:    ['İptal','gray'],
    gecikti: ['Gecikti','red'],   tahsil:   ['Tahsil','green'],
    nakit:   ['Nakit','green'],   cek:      ['Çek','amber'],
    havale:  ['Havale','blue'],
  };
  const [label, renk] = m[durum] || [durum, 'gray'];
  return pillHtml(label, renk);
}

// ─── GİRİŞ / KURULUM ─────────────────────────────────────────────────────────

// Uygulama açıldığında: önce lisans, sonra kurulum/giriş
async function girisEkraniniHazirla() {
  // 1. Lisans kontrolü
  const lisans = await ipc('lisans:kontrol');

  if (!lisans.gecerli && lisans.kurulumGerekli) {
    // Lisans dosyası yok — lisans ekranını göster
    document.getElementById('lisansEkrani').style.display = 'flex';
    document.getElementById('girisEkrani').style.display  = 'none';
    document.getElementById('lisansInput')?.focus();
    return;
  }

  if (!lisans.gecerli && lisans.bitti) {
    // Lisans süresi dolmuş
    document.getElementById('lisansEkrani').style.display = 'flex';
    document.getElementById('girisEkrani').style.display  = 'none';
    const hataEl = document.getElementById('lisansHata');
    hataEl.textContent = `Lisansınızın süresi ${new Date(lisans.bitis).toLocaleDateString('tr-TR')} tarihinde dolmuştur. Yenilemek için satıcınızla iletişime geçin.`;
    hataEl.style.display = 'block';
    document.getElementById('lisansInput')?.focus();
    return;
  }

  // 2. Lisans geçerli — 30 gün kala uyarı göster
  if (lisans.gecerli && lisans.uyari) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;top:20px;right:20px;background:#FAEEDA;border:1px solid rgba(133,79,11,0.3);' +
        'border-radius:10px;padding:14px 16px;max-width:320px;z-index:9000;';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#854F0B" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4M10 13.5v.5"/></svg>
          <div>
            <div style="font-weight:500;font-size:13px;color:#633806;">Lisans süresi yaklaşıyor</div>
            <div style="font-size:12px;color:#854F0B;margin-top:2px;">${lisans.kalanGun} gün kaldı · ${new Date(lisans.bitis).toLocaleDateString('tr-TR')}'de bitiyor</div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()"
            style="margin-left:auto;background:transparent;border:none;cursor:pointer;font-size:16px;color:#854F0B;">×</button>
        </div>`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 10000);
    }, 1500);
  }

  // 3. Auth kontrolü — kurulum mu giriş mi?
  const durum = await ipc('auth:durum');
  document.getElementById('lisansEkrani').style.display = 'none';
  document.getElementById('girisEkrani').style.display  = 'flex';

  if (durum.kurulumGerekli) {
    document.getElementById('girisAltBaslik').textContent = 'İlk kurulum';
    document.getElementById('kurulumFormu').style.display = 'block';
    document.getElementById('girisFormu').style.display   = 'none';
    document.getElementById('kurulumIsim')?.focus();
  } else {
    document.getElementById('girisAltBaslik').textContent = 'Meyve Sebze Toptancı Yönetimi';
    document.getElementById('kurulumFormu').style.display = 'none';
    document.getElementById('girisFormu').style.display   = 'block';
    document.getElementById('girisKullanici')?.focus();
  }
}

// Lisans aktifleştirme
async function lisansAktiflestir() {
  const input  = document.getElementById('lisansInput');
  const hataEl = document.getElementById('lisansHata');
  const btn    = document.getElementById('lisansAktiflestirBtn');
  const kod    = input?.value.trim().toUpperCase();

  hataEl.style.display = 'none';
  if (!kod || kod.length < 10) {
    hataEl.textContent = 'Geçerli bir lisans anahtarı girin.';
    hataEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Kontrol ediliyor...';
  btn.disabled = true;

  const sonuc = await ipc('lisans:aktiflestir', kod);

  if (sonuc.gecerli) {
    btn.textContent = '✓ Aktifleştirildi!';
    setTimeout(() => girisEkraniniHazirla(), 800);
  } else {
    btn.textContent = 'Aktifleştir';
    btn.disabled = false;
    hataEl.textContent = sonuc.hata || 'Geçersiz lisans kodu.';
    hataEl.style.display = 'block';
    input.value = '';
    input.focus();
  }
}

async function kurulumYap() {
  const isim      = document.getElementById('kurulumIsim')?.value.trim();
  const kullanici = document.getElementById('kurulumKullanici')?.value.trim();
  const sifre     = document.getElementById('kurulumSifre')?.value;
  const tekrar    = document.getElementById('kurulumSifreTekrar')?.value;
  const hataEl    = document.getElementById('kurulumHata');

  hataEl.style.display = 'none';

  if (!kullanici) return gosterHata(hataEl, 'Kullanıcı adı zorunludur.');
  if (/\s/.test(kullanici)) return gosterHata(hataEl, 'Kullanıcı adında boşluk olamaz.');
  if (!sifre || sifre.length < 4) return gosterHata(hataEl, 'Şifre en az 4 karakter olmalıdır.');
  if (sifre !== tekrar) return gosterHata(hataEl, 'Şifreler eşleşmiyor.');

  const btn = document.getElementById('kurulumBtn');
  btn.textContent = 'Oluşturuluyor...';
  btn.disabled = true;

  const sonuc = await ipc('auth:kurulum', { isim, kullanici, sifre });

  if (sonuc.ok) {
    uygulamayiAc(sonuc.isim, sonuc.kullanici);
  } else {
    btn.textContent = 'Hesabı Oluştur ve Başla';
    btn.disabled = false;
    gosterHata(hataEl, sonuc.hata || 'Bir hata oluştu.');
  }
}

async function girisYap() {
  const kullanici = document.getElementById('girisKullanici')?.value.trim();
  const sifre     = document.getElementById('girisSifre')?.value;
  const hataEl    = document.getElementById('girisHata');

  hataEl.style.display = 'none';
  if (!kullanici || !sifre) return gosterHata(hataEl, 'Kullanıcı adı ve şifre gerekli.');

  const btn = document.getElementById('girisBtn');
  btn.textContent = 'Giriş yapılıyor...';
  btn.disabled = true;

  const sonuc = await ipc('auth:giris', { kullanici, sifre });

  if (sonuc.ok) {
    uygulamayiAc(sonuc.isim, sonuc.kullanici);
  } else if (sonuc.kurulumGerekli) {
    girisEkraniniHazirla();
  } else {
    btn.textContent = 'Giriş Yap';
    btn.disabled = false;
    gosterHata(hataEl, sonuc.hata || 'Kullanıcı adı veya şifre hatalı.');
    document.getElementById('girisSifre').value = '';
    document.getElementById('girisSifre').focus();
  }
}

function gosterHata(el, mesaj) {
  el.textContent = mesaj;
  el.style.display = 'block';
}

async function uygulamayiAc(isim, kullanici) {
  // Sidebar'daki kullanıcı bilgisini güncelle
  const av = (isim || kullanici || 'K').charAt(0).toUpperCase();
  const el = document.getElementById('userAvatar');
  if (el) el.textContent = av;
  const adEl = document.getElementById('userAdi');
  if (adEl) adEl.textContent = isim || kullanici;

  document.getElementById('girisEkrani').style.display  = 'none';
  document.getElementById('anaUygulama').style.display  = 'flex';
  await sayfaGit('dashboard');
  dashboardBadgeleriGuncelle();
}

function cikisYap() {
  document.getElementById('anaUygulama').style.display = 'none';
  document.getElementById('girisEkrani').style.display = 'flex';
  // Formları temizle
  const kField = document.getElementById('girisKullanici');
  const sField = document.getElementById('girisSifre');
  if (kField) kField.value = '';
  if (sField) sField.value = '';
  document.getElementById('girisHata').style.display = 'none';
  // Giriş formuna dön (kurulum değil)
  document.getElementById('girisFormu').style.display   = 'block';
  document.getElementById('kurulumFormu').style.display = 'none';
  kField?.focus();
}

// ─── SAYFA ROUTER ────────────────────────────────────────────────────────────
const sayfaModulleri = {
  dashboard:   () => import('./pages/dashboard.js'),
  musteriler:  () => import('./pages/musteriler.js'),
  bahceciler:  () => import('./pages/bahceciler.js'),
  satislar:    () => import('./pages/satislar.js'),
  alimlar:     () => import('./pages/alimlar.js'),
  cekler:      () => import('./pages/cekler.js'),
  tahsilatlar: () => import('./pages/tahsilatlar.js'),
  stok:        () => import('./pages/stok.js'),
  karZarar:    () => import('./pages/karZarar.js'),
  raporlar:    () => import('./pages/raporlar.js'),
  ayarlar:     () => import('./pages/ayarlar.js'),
};

async function sayfaGit(sayfa, params = {}) {
  // Nav aktif işaretle
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.sayfa === sayfa);
  });

  // Yükleniyor göster
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="yukleniyor" id="yukleniyor">
    <div class="spinner"></div><p>Yükleniyor...</p></div>`;

  try {
    const modul = await sayfaModulleri[sayfa]?.();
    if (modul?.render) {
      await modul.render(main, params);
    } else {
      main.innerHTML = `<div class="bos-durum"><p>Sayfa bulunamadı: ${sayfa}</p></div>`;
    }
  } catch (e) {
    console.error('Sayfa yükleme hatası:', e);
    main.innerHTML = `<div class="bos-durum"><p>Hata: ${e.message}</p></div>`;
  }
}

// ─── BADGE GÜNCELLEYİCİ ─────────────────────────────────────────────────────
async function dashboardBadgeleriGuncelle() {
  try {
    const data = await ipc('rapor:dashboard');

    // Bekleyen satışlar
    const bekleyen = (data.sonSatislar || []).filter(s => s.odenmeDurumu === 'bekliyor').length;
    const satBadge = document.getElementById('bekleyenSatisBadge');
    if (satBadge) { satBadge.textContent = bekleyen; satBadge.style.display = bekleyen > 0 ? '' : 'none'; }

    // Vadeli çekler (7 gün)
    const vadeBadge = document.getElementById('vadeCekBadge');
    if (vadeBadge) { vadeBadge.textContent = data.vadeliCekSayisi; vadeBadge.style.display = data.vadeliCekSayisi > 0 ? '' : 'none'; }

    // Kritik stok
    const kritikBadge = document.getElementById('kritikStokBadge');
    if (kritikBadge) { kritikBadge.textContent = data.kritikStok?.length || 0; kritikBadge.style.display = (data.kritikStok?.length || 0) > 0 ? '' : 'none'; }
  } catch (e) {
    console.error('Badge güncelleme hatası:', e);
  }
}

// ─── MODAL YARDIMCIları ──────────────────────────────────────────────────────
function modalAc(baslik, icerikHtml, onKaydet, opts = {}) {
  document.querySelector('.modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:1000;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:var(--color-background-primary,#fff);border-radius:14px;' +
    'border:0.5px solid rgba(0,0,0,0.12);padding:24px;width:500px;' +
    'max-width:92vw;max-height:88vh;overflow-y:auto;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;margin-bottom:18px;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:15px;font-weight:500;flex:1;color:var(--color-text-primary,#111);';
  titleEl.textContent = baslik;
  const kapatBtn = document.createElement('button');
  kapatBtn.style.cssText =
    'width:28px;height:28px;border-radius:6px;border:0.5px solid rgba(0,0,0,0.15);' +
    'background:transparent;cursor:pointer;font-size:18px;line-height:1;color:#666;';
  kapatBtn.textContent = '×';
  kapatBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(titleEl);
  header.appendChild(kapatBtn);

  const icerik = document.createElement('div');
  icerik.innerHTML = icerikHtml;

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;margin-top:20px;';
  const kaydetBtnEl = document.createElement('button');
  kaydetBtnEl.className = 'btn-primary';
  if (opts.tehlikeli) kaydetBtnEl.style.cssText = 'background:#A32D2D;border:none;color:#fff;';
  kaydetBtnEl.textContent = opts.kaydetLabel || 'Kaydet';
  const iptalBtnEl = document.createElement('button');
  iptalBtnEl.className = 'btn-secondary';
  iptalBtnEl.textContent = 'İptal';
  kaydetBtnEl.addEventListener('click', () => onKaydet && onKaydet(panel));
  iptalBtnEl.addEventListener('click', () => overlay.remove());
  footer.appendChild(kaydetBtnEl);
  footer.appendChild(iptalBtnEl);

  panel.appendChild(header);
  panel.appendChild(icerik);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => panel.querySelector('input,select,textarea')?.focus(), 50);
  return overlay;
}

// ─── BİLDİRİM ────────────────────────────────────────────────────────────────
function bildirim(mesaj, tip = 'success') {
  const renkler = { success: '#2D7A3A', error: '#A32D2D', warning: '#854F0B', info: '#185FA5' };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:20px;right:20px;
    background:${renkler[tip]||renkler.success};color:#fff;
    padding:10px 18px;border-radius:8px;font-size:13px;
    font-weight:500;z-index:9999;
    animation:slideIn 0.2s ease;`;
  el.textContent = mesaj;
  document.body.appendChild(el);
  setTimeout(() => el.style.opacity = '0', 2500);
  setTimeout(() => el.remove(), 2800);
}

// ─── Global erişim ────────────────────────────────────────────────────────────
// NOT: window.tt preload.js'ten geliyor, burada YAZILMAZ.
// Tüm sayfa modülleri ve inline onclick'ler bu fonksiyonlara window üzerinden erişir.
window.ipc            = ipc;
window.sayfaGit       = sayfaGit;
window.fmtPara        = fmtPara;
window.fmtTarih       = fmtTarih;
window.fmtTarihSaat   = fmtTarihSaat;
window.vadeFark       = vadeFark;
window.pillHtml       = pillHtml;
window.durumPill      = durumPill;
window.modalAc        = modalAc;
window.bildirim       = bildirim;
window.girisYap       = girisYap;
window.kurulumYap     = kurulumYap;
window.cikisYap       = cikisYap;
window.lisansAktiflestir = lisansAktiflestir;

// ─── DOM hazır olunca event'leri bağla ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Lisans ekranı
  document.getElementById('lisansAktiflestirBtn')?.addEventListener('click', lisansAktiflestir);
  document.getElementById('lisansInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') lisansAktiflestir();
    // Otomatik tire ekle (TAZE-XXXX-XXXX-...)
    setTimeout(() => {
      const el = document.getElementById('lisansInput');
      if (!el) return;
      let v = el.value.toUpperCase().replace(/[^A-Z2-7]/g, '');
      // TAZE prefix'i koru
      if (v.startsWith('TAZE')) v = v.slice(4);
      // 4'lü grupla
      const gruplar = [];
      for (let i = 0; i < v.length && gruplar.length < 4; i += 4) {
        gruplar.push(v.slice(i, i + 4));
      }
      const formatted = 'TAZE' + (gruplar.length ? '-' + gruplar.join('-') : '');
      el.value = formatted;
    }, 0);
  });
  document.getElementById('lisansInput')?.addEventListener('input', () => {
    const el = document.getElementById('lisansInput');
    if (!el) return;
    let v = el.value.toUpperCase().replace(/[^A-Z2-7]/g, '');
    if (v.startsWith('TAZE')) v = v.slice(4);
    const gruplar = [];
    for (let i = 0; i < v.length && gruplar.length < 4; i += 4) {
      gruplar.push(v.slice(i, i + 4));
    }
    const cursor = el.selectionStart;
    el.value = 'TAZE' + (gruplar.length ? '-' + gruplar.join('-') : '');
  });
  // Giriş formu
  document.getElementById('girisKullanici')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('girisSifre')?.focus();
  });
  document.getElementById('girisSifre')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') girisYap();
  });
  document.getElementById('girisBtn')?.addEventListener('click', girisYap);

  // Kurulum formu — Tab ile alan geçişi, Enter ile gönder
  document.getElementById('kurulumSifreTekrar')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') kurulumYap();
  });
  document.getElementById('kurulumBtn')?.addEventListener('click', kurulumYap);

  // Sidebar nav — data-sayfa attribute'u olan tüm .nav-item'ları bağla
  document.querySelectorAll('.nav-item[data-sayfa]').forEach(el => {
    el.addEventListener('click', () => sayfaGit(el.dataset.sayfa));
  });

  // Çıkış butonu
  document.getElementById('cikisBtn')?.addEventListener('click', cikisYap);

  // Kurulum mu giriş mi göster?
  girisEkraniniHazirla();
});

// ─── KLAVYE KISAYOLLARI ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Sadece uygulama açıkken (giriş ekranında değil) çalış
  if (document.getElementById('anaUygulama')?.style.display === 'none') return;
  // Input, select veya textarea odaklanmışsa kısayolları devre dışı bırak
  const aktifEl = document.activeElement?.tagName?.toLowerCase();
  const inputAktif = ['input','select','textarea'].includes(aktifEl);

  const ctrl = e.ctrlKey || e.metaKey;

  // Escape — Modal kapat
  if (e.key === 'Escape') {
    const modal = document.querySelector('.modal-overlay');
    if (modal) { modal.remove(); e.preventDefault(); return; }
  }

  if (inputAktif) return; // input odakta iken diğer kısayollar çalışmasın

  // Ctrl + N — Yeni Satış
  if (ctrl && e.key === 'n') {
    e.preventDefault();
    sayfaGit('satislar', 'yeni');
    return;
  }

  // Ctrl + B — Yeni Alım
  if (ctrl && e.key === 'b') {
    e.preventDefault();
    sayfaGit('alimlar', 'yeni');
    return;
  }

  // Ctrl + P — Aktif sayfadaki yazdır butonu (varsa)
  if (ctrl && e.key === 'p') {
    e.preventDefault();
    const fisBtn     = document.getElementById('detayFisBtn');
    const makbuzBtn  = document.getElementById('detayMakbuzBtn');
    const faturaBtn  = document.getElementById('detayFaturaBtn');
    if (fisBtn)    { fisBtn.click(); return; }
    if (makbuzBtn) { makbuzBtn.click(); return; }
    if (faturaBtn) { faturaBtn.click(); return; }
    return;
  }

  // Ctrl + F — Arama kutusuna odaklan
  if (ctrl && e.key === 'f') {
    e.preventDefault();
    const arama = document.querySelector(
      '#musteriArama, #bahceciArama, #satisArama, #alimArama, #stokArama'
    );
    if (arama) { arama.focus(); arama.select(); }
    return;
  }

  // Ctrl + 1..9 — Menü kısayolları
  if (ctrl && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const menuler = [
      'dashboard','musteriler','bahceciler',
      'satislar','alimlar','cekler',
      'stok','karZarar','ayarlar',
    ];
    const idx = parseInt(e.key) - 1;
    if (menuler[idx]) sayfaGit(menuler[idx]);
    return;
  }
});

// Slide-in animasyonu
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(20px); opacity:0; } to { transform: none; opacity:1; } }`;
document.head.appendChild(style);
