const { ipc, bildirim, sayfaGit } = window;

export async function render(container) {
  const [ayarlar, kullaniciBilgi, yazicilar] = await Promise.all([
    ipc('ayar:oku'),
    ipc('auth:kullaniciBilgi'),
    ipc('yazici:yaziciListe').catch(() => []),
  ]);
  const kullanici = kullaniciBilgi?.kullanici || '';

  container.innerHTML = `
    <div class="topbar"><div class="topbar-title">Ayarlar</div></div>
    <div class="p-20" style="max-width:580px;">

      <!-- FİRMA BİLGİLERİ -->
      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><div class="card-head-title">Firma Bilgileri</div></div>
        <div class="card-body">
          <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Firma Adı</div>
            <input type="text" id="aFirmaAdi" value="${ayarlar.firmaAdi||''}"></div>
          <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Adres</div>
            <input type="text" id="aAdres" value="${ayarlar.firmaAdres||''}"></div>
          <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Telefon</div>
            <input type="text" id="aTel" value="${ayarlar.firmaTel||''}"></div>
        </div>
      </div>

      <!-- MUHASEBE VARSAYILAN DEĞERLERİ -->
      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><div class="card-head-title">Muhasebe Varsayılanları</div></div>
        <div class="card-body">
          <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px;">
            Bu değerler yeni satış ve alım formlarında otomatik dolar. Her işlemde ayrıca değiştirilebilir.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <div class="fs-11 text-muted mb-4">Varsayılan KDV %</div>
              <input type="number" id="aKdv" value="${ayarlar.kdvOrani??18}" min="0" max="100" step="0.5" placeholder="18">
            </div>
            <div>
              <div class="fs-11 text-muted mb-4">Varsayılan Komisyon %</div>
              <input type="number" id="aKom" value="${ayarlar.komisyonOrani||5}" min="0" max="100" step="0.5"
                placeholder="5">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <div class="fs-11 text-muted mb-4">Varsayılan Stopaj %</div>
              <input type="number" id="aStopaj" value="${ayarlar.stopajOrani||3}" min="0" max="50" step="0.5"
                placeholder="3">
              <div style="font-size:10px;color:var(--color-text-tertiary);margin-top:3px;">
                Alımlarda komisyon sonrası bakiyeden kesilir
              </div>
            </div>
            <div>
              <div class="fs-11 text-muted mb-4">Varsayılan İskonto %</div>
              <input type="number" id="aIskonto" value="${ayarlar.iskontoOrani||0}" min="0" max="100" step="0.5"
                placeholder="0">
              <div style="font-size:10px;color:var(--color-text-tertiary);margin-top:3px;">
                Satışlarda otomatik uygulanır
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- YAZICI AYARLARI -->
      <div class="card" style="margin-bottom:14px;">
        <div class="card-head">
          <div class="card-head-title">Yazıcı Ayarları</div>
          <button class="btn-secondary" id="yaziciYenileBtn" style="padding:4px 10px;font-size:11px;">Yenile</button>
        </div>
        <div class="card-body">
          <div style="margin-bottom:12px;">
            <div class="fs-11 text-muted mb-4">Varsayılan Yazıcı</div>
            ${yazicilar.length === 0
              ? `<div style="background:var(--color-background-secondary,#F1EFE8);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--color-text-secondary);">
                  Yazıcı bulunamadı. Windows'ta yazıcı kurulu olduğundan emin olun.
                 </div>
                 <input type="text" id="aYazici" value="${ayarlar.yazici||''}" placeholder="Yazıcı adını manuel girin" style="margin-top:8px;">`
              : `<select id="aYazici">
                  <option value="">— Seçin —</option>
                  ${yazicilar.map(p=>`
                    <option value="${p.isim}" ${ayarlar.yazici===p.isim?'selected':''}>
                      ${p.isim}${p.varsayilan?' (Varsayılan)':''}${p.durum==='mesgul'?' ⚠':''}
                    </option>`).join('')}
                </select>`}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div>
              <div class="fs-11 text-muted mb-4">Kağıt Genişliği</div>
              <select id="aKagit">
                ${['58mm','80mm','A4'].map(v=>`<option ${ayarlar.kagitGenislik===v?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="fs-11 text-muted mb-4">Test Yazdırma</div>
              <button class="btn-secondary" id="testYazdir" style="width:100%;">Test Sayfası Gönder</button>
            </div>
          </div>
          ${yazicilar.length > 0 ? `
          <div style="background:var(--color-background-secondary,#F1EFE8);border-radius:8px;padding:10px 12px;">
            <div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:6px;">Sistemde Kurulu Yazıcılar</div>
            ${yazicilar.map(p=>`
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:0.5px solid var(--color-border-tertiary);">
                <span>${p.isim}</span>
                <span style="color:${p.durum==='hazir'?'var(--green,#2D7A3A)':'var(--amber,#854F0B)'};">
                  ${p.varsayilan?'★ ':''} ${p.durum==='hazir'?'Hazır':'Meşgul'}
                </span>
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>

      <!-- KULLANICI BİLGİLERİ -->
      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><div class="card-head-title">Kullanıcı & Güvenlik</div></div>
        <div class="card-body">
          <div style="margin-bottom:12px;">
            <div class="fs-11 text-muted mb-4">Kullanıcı Adı</div>
            <input type="text" value="${kullanici}" disabled style="opacity:0.5;cursor:not-allowed;">
          </div>
          <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Mevcut Şifre</div>
            <input type="password" id="eskiSifre" autocomplete="current-password"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div><div class="fs-11 text-muted mb-4">Yeni Şifre</div>
              <input type="password" id="yeniSifre" autocomplete="new-password"></div>
            <div><div class="fs-11 text-muted mb-4">Yeni Şifre Tekrar</div>
              <input type="password" id="yeniSifreTekrar" autocomplete="new-password"></div>
          </div>
          <button class="btn-secondary" id="sifreDegisBtn">Şifreyi Güncelle</button>
        </div>
      </div>

      <!-- VERİ YÖNETİMİ -->
      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><div class="card-head-title">Veri Yönetimi</div></div>
        <div class="card-body">
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="btn-secondary" id="yedekAlBtn">Yedek Al</button>
            <button class="btn-secondary" id="yedekYukleBtn" style="color:var(--red,#A32D2D);">Yedekten Yükle</button>
          </div>
          <div style="font-size:11px;color:var(--color-text-tertiary);">
            Yedekler her gece otomatik alınır. Son 30 gün saklanır.
          </div>
        </div>
      </div>

      <!-- KLAVYE KISAYOLLARI -->
      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><div class="card-head-title">Klavye Kısayolları</div></div>
        <div class="card-body">
          ${[
            ['Ctrl + N',   'Yeni Satış'],
            ['Ctrl + B',   'Yeni Alım'],
            ['Ctrl + P',   'Yazdır (detay sayfasında)'],
            ['Ctrl + F',   'Arama odaklan'],
            ['Escape',     'Modalı kapat / Listeye dön'],
            ['Ctrl + 1-9', 'Menü kısayolları (1=Dashboard, 2=Müşteriler...)'],
          ].map(([k,v])=>`
            <div style="display:flex;gap:12px;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
              <kbd style="background:var(--color-background-secondary,#F1EFE8);border:0.5px solid var(--color-border-secondary);border-radius:5px;padding:2px 8px;font-size:11px;font-family:monospace;white-space:nowrap;flex-shrink:0;">${k}</kbd>
              <span style="font-size:12px;color:var(--color-text-secondary);">${v}</span>
            </div>`).join('')}
        </div>
      </div>

      <button class="btn-primary" id="ayarKaydetBtn" style="width:100%;justify-content:center;padding:10px;">
        Ayarları Kaydet
      </button>
    </div>`;

  // ─── Event listeners ──────────────────────────────────────────────────────
  document.getElementById('ayarKaydetBtn').addEventListener('click', async () => {
    const yaziciEl = document.getElementById('aYazici');
    await ipc('ayar:kaydet', {
      firmaAdi:      document.getElementById('aFirmaAdi').value,
      firmaAdres:    document.getElementById('aAdres').value,
      firmaTel:      document.getElementById('aTel').value,
      kdvOrani:      parseFloat(document.getElementById('aKdv').value) || 0,
      komisyonOrani: parseFloat(document.getElementById('aKom').value) || 5,
      stopajOrani:   parseFloat(document.getElementById('aStopaj').value) || 0,
      iskontoOrani:  parseFloat(document.getElementById('aIskonto').value) || 0,
      kagitGenislik: document.getElementById('aKagit').value,
      yazici:        yaziciEl?.value || '',
    });
    bildirim('Ayarlar kaydedildi!');
  });

  document.getElementById('yaziciYenileBtn').addEventListener('click', () => render(container));

  document.getElementById('testYazdir').addEventListener('click', async () => {
    const yazici = document.getElementById('aYazici')?.value;
    const kagit  = document.getElementById('aKagit')?.value;
    const btn    = document.getElementById('testYazdir');
    btn.textContent = 'Gönderiliyor...'; btn.disabled = true;
    try {
      const ayar = await ipc('ayar:oku');
      await ipc('yazici:fisYazdir', {
        firma:   { adi: ayar.firmaAdi, adres: ayar.firmaAdres, tel: ayar.firmaTel },
        fatura:  { no: 'TEST-001', musteriAdi: 'Test Müşteri', tarih: new Date().toISOString(), kasiyer: '' },
        urunler: [{ urunAdi: 'Domates', birim: 'kg', miktar: 10, tutar: 150 }],
        ozet:    { araToplam: 150, iskontoTutar: 0, kdvOrani: 18, kdvTutar: 27, genelToplam: 177 },
        odeme:   { tip: 'Test' },
        dipnot:  'Bu bir test yazdırmasıdır.',
        yazici, kagitGenislik: kagit,
      });
      bildirim('Test sayfası yazıcıya gönderildi!');
    } catch(e) { bildirim('Yazıcı hatası: '+e.message, 'error'); }
    finally { btn.textContent = 'Test Sayfası Gönder'; btn.disabled = false; }
  });

  document.getElementById('sifreDegisBtn').addEventListener('click', async () => {
    const eski   = document.getElementById('eskiSifre').value;
    const yeni   = document.getElementById('yeniSifre').value;
    const tekrar = document.getElementById('yeniSifreTekrar').value;
    if (!yeni) return bildirim('Yeni şifre girin', 'error');
    if (yeni.length < 4) return bildirim('Şifre en az 4 karakter olmalı', 'error');
    if (yeni !== tekrar) return bildirim('Şifreler eşleşmiyor', 'error');
    const sonuc = await ipc('auth:sifreDegis', { eskiSifre: eski, yeniSifre: yeni });
    if (sonuc.ok) {
      bildirim('Şifre güncellendi!');
      ['eskiSifre','yeniSifre','yeniSifreTekrar'].forEach(id => { document.getElementById(id).value = ''; });
    } else bildirim(sonuc.hata || 'Hata oluştu', 'error');
  });

  document.getElementById('yedekAlBtn').addEventListener('click', async () => {
    const sonuc = await ipc('yedek:al');
    if (sonuc && !sonuc.iptal) bildirim('Yedek alındı!');
  });

  document.getElementById('yedekYukleBtn').addEventListener('click', async () => {
    if (!confirm('Mevcut tüm veriler silinecek ve yedek yüklenecek.\nEmin misiniz?')) return;
    const sonuc = await ipc('yedek:yukle');
    if (sonuc && !sonuc.iptal) {
      bildirim('Yedek yüklendi!');
      setTimeout(() => sayfaGit('dashboard'), 1200);
    }
  });
}
