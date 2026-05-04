const { ipc, fmtPara, fmtTarih, fmtTarihSaat, durumPill, bildirim, sayfaGit, modalAc } = window;

export async function render(container, params) {
  const [musteriler, urunler, ayarlar] = await Promise.all([
    ipc('musteri:liste'),
    ipc('stok:urunler'),
    ipc('ayar:oku'),
  ]);

  if (params === 'yeni') { renderForm(container, musteriler, urunler, ayarlar); return; }

  let satislar = await ipc('satis:liste');

  // ─── LİSTE ────────────────────────────────────────────────────────────────
  function renderListe() {
    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Satışlar</div>
        <input type="text" id="satisArama" placeholder="Müşteri veya fatura no..." style="max-width:230px;">
        <select id="satisFiltre" style="max-width:150px;">
          <option value="">Tüm durumlar</option>
          <option value="bekliyor">Bekliyor</option>
          <option value="odendi">Ödendi</option>
          <option value="vadeli">Vadeli</option>
        </select>
        <button class="btn-primary" id="yeniSatisBtn">+ Yeni Satış</button>
      </div>
      <div class="p-20">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card">
            <div class="stat-label">Toplam Satış</div>
            <div class="stat-val">${satislar.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Toplam Ciro</div>
            <div class="stat-val" style="color:var(--green,#2D7A3A);">
              ${fmtPara(satislar.reduce((t,s)=>t+(s.genelToplam||0),0))}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bekleyen Tahsilat</div>
            <div class="stat-val" style="color:var(--amber,#854F0B);">
              ${fmtPara(satislar.filter(s=>s.odenmeDurumu!=='odendi').reduce((t,s)=>t+(s.genelToplam||0),0))}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bugün</div>
            <div class="stat-val">
              ${satislar.filter(s=>s.tarih?.startsWith(new Date().toISOString().slice(0,10))).length}
            </div>
          </div>
        </div>
        <div class="card">
          <div id="satisListeBody">${renderListeIcerik(satislar)}</div>
        </div>
      </div>`;

    document.getElementById('yeniSatisBtn').addEventListener('click', () => renderForm(container, musteriler, urunler, ayarlar));
    document.getElementById('satisArama').addEventListener('input', filtrele);
    document.getElementById('satisFiltre').addEventListener('change', filtrele);
    bagla();
  }

  function filtrele() {
    const q = document.getElementById('satisArama').value.toLowerCase();
    const d = document.getElementById('satisFiltre').value;
    const f = satislar.filter(s =>
      (!q || s.musteriAdi?.toLowerCase().includes(q) || s.faturaNo?.includes(q)) &&
      (!d || s.odenmeDurumu === d));
    document.getElementById('satisListeBody').innerHTML = renderListeIcerik(f);
    bagla();
  }

  function renderListeIcerik(liste) {
    if (!liste.length) return '<div class="bos-durum"><p>Satış bulunamadı</p></div>';
    return `
      <div class="t-head" style="display:grid;grid-template-columns:120px 1fr 90px 110px 90px 80px 100px;gap:8px;padding:9px 16px;">
        <div>Fatura No</div><div>Müşteri</div><div>Tarih</div><div>Tutar</div><div>Ödeme</div><div>Durum</div><div>İşlem</div>
      </div>
      ${liste.map(s => `
        <div class="t-row satis-satir" data-id="${s.id}"
             style="display:grid;grid-template-columns:120px 1fr 90px 110px 90px 80px 100px;gap:8px;padding:11px 16px;cursor:pointer;">
          <div style="align-self:center;font-family:monospace;font-size:12px;font-weight:500;">${s.faturaNo}</div>
          <div>
            <div class="fw-500">${s.musteriAdi||'—'}</div>
            <div class="text-hint fs-11">${(s.urunler||[]).map(u=>u.urunAdi).slice(0,3).join(', ')}</div>
          </div>
          <div style="align-self:center;font-size:12px;">${fmtTarih(s.tarih)}</div>
          <div style="align-self:center;font-weight:500;color:var(--green,#2D7A3A);">${fmtPara(s.genelToplam)}</div>
          <div style="align-self:center;font-size:12px;">${s.odemeTipi||'—'}</div>
          <div style="align-self:center;">${durumPill(s.odenmeDurumu)}</div>
          <div style="align-self:center;display:flex;gap:4px;" onclick="event.stopPropagation()">
            ${s.odenmeDurumu!=='odendi'
              ? `<button class="btn-secondary btn-odendi" data-id="${s.id}" style="padding:3px 8px;font-size:11px;color:var(--green,#2D7A3A);">Ödendi</button>`
              : ''}
            <button class="btn-secondary btn-sil" data-id="${s.id}" style="padding:3px 8px;font-size:11px;color:var(--red,#A32D2D);">Sil</button>
          </div>
        </div>`).join('')}`;
  }

  function bagla() {
    document.querySelectorAll('.satis-satir').forEach(row =>
      row.addEventListener('click', () => renderDetay(row.dataset.id)));
    document.querySelectorAll('.btn-odendi').forEach(btn =>
      btn.addEventListener('click', async () => {
        await ipc('satis:guncelle', { id: btn.dataset.id, odenmeDurumu: 'odendi' });
        bildirim('Ödendi olarak işaretlendi!');
        satislar = await ipc('satis:liste');
        filtrele();
      }));
    document.querySelectorAll('.btn-sil').forEach(btn =>
      btn.addEventListener('click', () => satirSil(btn.dataset.id)));
  }

  function satirSil(id) {
    const s = satislar.find(x => x.id === id);
    if (!s) return;
    modalAc('Satışı Sil',
      `<p style="color:var(--color-text-primary);">${s.faturaNo} numaralı faturayı silmek istediğinizden emin misiniz?</p>`,
      async () => {
        await ipc('satis:sil', id);
        bildirim('Satış silindi.');
        document.querySelector('.modal-overlay')?.remove();
        satislar = await ipc('satis:liste');
        renderListe();
      }, { kaydetLabel: 'Evet, Sil', tehlikeli: true });
  }

  // ─── DETAY ────────────────────────────────────────────────────────────────
  async function renderDetay(id) {
    const s = satislar.find(x => x.id === id);
    if (!s) return;
    const ayarlar = await ipc('ayar:oku');

    container.innerHTML = `
      <div class="topbar">
        <button class="btn-secondary" id="detayGeriBtn">← Satışlar</button>
        <div class="topbar-title">${s.faturaNo}</div>
        <button class="btn-secondary" id="detayDuzenleBtn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 2l2 2-7 7H2v-2L9 2z"/></svg>
          Düzenle
        </button>
        <button class="btn-secondary" id="detayFisBtn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="1" width="9" height="6" rx="1"/><path d="M1 7h11v4a1 1 0 01-1 1H3a1 1 0 01-1-1V7z"/></svg>
          Fiş Yazdır
        </button>
        <button class="btn-secondary" id="detayFaturaBtn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="1" width="11" height="11" rx="1"/><path d="M3 4h7M3 6h7M3 8h4"/></svg>
          A4 Fatura
        </button>
        ${s.odenmeDurumu !== 'odendi'
          ? `<button class="btn-secondary" id="detayOdendiBtn" style="color:var(--green,#2D7A3A);">Ödendi İşaretle</button>`
          : ''}
        <button class="btn-secondary" id="detaySilBtn" style="color:var(--red,#A32D2D);">Sil</button>
      </div>

      <div class="p-20">
        <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;">

          <!-- SOL: FATURA BİLGİLERİ -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-head">
                <div class="card-head-title">Fatura Bilgileri</div>
                ${durumPill(s.odenmeDurumu)}
              </div>
              <div class="card-body">
                ${[
                  ['Fatura No',    s.faturaNo],
                  ['Müşteri',      s.musteriAdi||'—'],
                  ['Tarih',        fmtTarih(s.tarih)],
                  ['Vade Tarihi',  fmtTarih(s.vadeTarihi)||'—'],
                  ['Ödeme Tipi',   s.odemeTipi||'—'],
                  ['Not',          s.not||'—'],
                ].map(([k,v]) => `
                  <div style="display:flex;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                    <span style="font-size:12px;color:var(--color-text-secondary);min-width:90px;flex-shrink:0;">${k}</span>
                    <span style="font-size:13px;font-weight:500;">${v}</span>
                  </div>`).join('')}
              </div>
            </div>

            <!-- TUTAR ÖZETİ -->
            <div class="card">
              <div class="card-head"><div class="card-head-title">Tutar Özeti</div></div>
              <div class="card-body">
                ${[
                  ['Ara Toplam',   fmtPara(s.araToplam||0),   'inherit'],
                  [`İskonto (%${s.iskontoOrani||0})`, fmtPara(s.iskontoTutar||0), 'var(--red,#A32D2D)'],
                  [`KDV (%${s.kdvOrani||0})`,          fmtPara(s.kdvTutar||0),    'inherit'],
                ].map(([k,v,c]) => `
                  <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                    <span style="font-size:12px;color:var(--color-text-secondary);">${k}</span>
                    <span style="font-size:13px;color:${c};">${v}</span>
                  </div>`).join('')}
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--color-border-tertiary);margin-top:4px;">
                  <span style="font-weight:500;font-size:14px;">Genel Toplam</span>
                  <span style="font-size:22px;font-weight:600;color:var(--green,#2D7A3A);">${fmtPara(s.genelToplam)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SAĞ: ÜRÜN LİSTESİ -->
          <div class="card">
            <div class="card-head">
              <div class="card-head-title">Ürün / Kalem Listesi</div>
              <span class="pill pill-green">${(s.urunler||[]).length} kalem</span>
            </div>
            <div class="t-head" style="display:grid;grid-template-columns:1fr 80px 110px 100px 110px;gap:8px;padding:9px 16px;">
              <div>Ürün</div><div>Birim</div><div>Miktar</div><div>Birim Fiyat</div><div>Tutar</div>
            </div>
            ${(s.urunler||[]).map((u,i) => `
              <div style="display:grid;grid-template-columns:1fr 80px 110px 100px 110px;gap:8px;padding:11px 16px;
                          background:${i%2===0?'':'var(--color-background-secondary,#F1EFE8)'};
                          border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                <div style="font-weight:500;">${u.urunAdi}</div>
                <div style="font-size:13px;">${u.birim||'kg'}</div>
                <div style="font-size:13px;">${u.miktar}</div>
                <div style="font-size:13px;">${fmtPara(u.birimFiyat||0)}</div>
                <div style="font-weight:500;color:var(--green,#2D7A3A);">${fmtPara(u.tutar||0)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    document.getElementById('detayGeriBtn').addEventListener('click', async () => {
      satislar = await ipc('satis:liste');
      renderListe();
    });
    document.getElementById('detaySilBtn').addEventListener('click', () => { satirSil(id); });
    document.getElementById('detayDuzenleBtn').addEventListener('click', () => {
      renderForm(container, musteriler, urunler, ayarlar, s);
    });
    document.getElementById('detayOdendiBtn')?.addEventListener('click', async () => {
      await ipc('satis:guncelle', { id, odenmeDurumu: 'odendi' });
      bildirim('Ödendi olarak işaretlendi!');
      satislar = await ipc('satis:liste');
      renderDetay(id);
    });

    // Fiş yazdır
    document.getElementById('detayFisBtn').addEventListener('click', async () => {
      const btn = document.getElementById('detayFisBtn');
      btn.textContent = 'Gönderiliyor...'; btn.disabled = true;
      try {
        await ipc('yazici:fisYazdir', {
          firma:   { adi: ayarlar.firmaAdi, adres: ayarlar.firmaAdres, tel: ayarlar.firmaTel },
          fatura:  { no: s.faturaNo, musteriAdi: s.musteriAdi, tarih: s.tarih, kasiyer: '' },
          urunler: s.urunler || [],
          ozet:    { araToplam: s.araToplam||0, iskontoTutar: s.iskontoTutar||0, kdvOrani: s.kdvOrani||0, kdvTutar: s.kdvTutar||0, genelToplam: s.genelToplam },
          odeme:   { tip: s.odemeTipi, vade: s.vadeTarihi },
          yazici:  ayarlar.yazici,
          kagitGenislik: ayarlar.kagitGenislik,
        });
        bildirim('Fiş yazıcıya gönderildi!');
      } catch(e) { bildirim('Yazıcı hatası: '+e.message, 'error'); }
      finally { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="1" width="9" height="6" rx="1"/><path d="M1 7h11v4a1 1 0 01-1 1H3a1 1 0 01-1-1V7z"/></svg> Fiş Yazdır'; btn.disabled = false; }
    });

    // A4 fatura yazdır
    document.getElementById('detayFaturaBtn').addEventListener('click', async () => {
      const btn = document.getElementById('detayFaturaBtn');
      btn.textContent = 'Gönderiliyor...'; btn.disabled = true;
      try {
        await ipc('yazici:faturaYazdir', {
          firma:   { adi: ayarlar.firmaAdi, adres: ayarlar.firmaAdres, tel: ayarlar.firmaTel },
          fatura:  { no: s.faturaNo, musteriAdi: s.musteriAdi, tarih: s.tarih },
          urunler: s.urunler || [],
          ozet:    { araToplam: s.araToplam||0, iskontoTutar: s.iskontoTutar||0, kdvOrani: s.kdvOrani||0, kdvTutar: s.kdvTutar||0, genelToplam: s.genelToplam },
          odeme:   { tip: s.odemeTipi, vade: s.vadeTarihi },
          yazici:  ayarlar.yazici,
        });
        bildirim('Fatura yazıcıya gönderildi!');
      } catch(e) { bildirim('Yazıcı hatası: '+e.message, 'error'); }
      finally { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="1" width="11" height="11" rx="1"/><path d="M3 4h7M3 6h7M3 8h4"/></svg> A4 Fatura'; btn.disabled = false; }
    });
  }

  renderListe();
}

// ─── YENİ / DÜZENLE SATIŞ FORMU ─────────────────────────────────────────────
function renderForm(container, musteriler, urunler, ayarlar = {}, mevcutSatis = null) {
  const duzenlemeModu = !!mevcutSatis;

  let satirlar = duzenlemeModu
    ? mevcutSatis.urunler.map((u, i) => ({
        id: i + 1, urun: u.urunAdi, birim: u.birim || 'kg',
        miktar: u.miktar, fiyat: u.birimFiyat || u.fiyat || 0,
        kdvOrani: u.kdvOrani || 0,
      }))
    : [{ id: 1, urun: '', birim: 'kg', miktar: 0, fiyat: 0, kdvOrani: 0 }];
  let satirId = satirlar.length + 1;

  const varsKdv     = ayarlar.kdvOrani    ?? 18;
  const varsIskonto = duzenlemeModu ? (mevcutSatis.iskontoOrani || 0) : (ayarlar.iskontoOrani ?? 0);

  const musteriOpts = musteriler.map(m =>
    `<option value="${m.id}" data-ad="${m.ad}" ${duzenlemeModu && m.id === mevcutSatis.musteriId ? 'selected' : ''}>${m.ad}</option>`).join('');
  const urunOpts = urunler.map(u => {
    const ad = typeof u === 'string' ? u : u.ad;
    return `<option value="${ad}">${ad}</option>`;
  }).join('');

  container.innerHTML = `
    <div class="topbar">
      <button class="btn-secondary" id="geriBtn">← Geri</button>
      <div class="topbar-title">${duzenlemeModu ? mevcutSatis.faturaNo + ' — Düzenle' : 'Yeni Satış Faturası'}</div>
      <button class="btn-primary" id="kaydetBtn">${duzenlemeModu ? 'Değişiklikleri Kaydet' : 'Faturayı Kaydet'}</button>
    </div>
    <div class="p-20" style="display:grid;grid-template-columns:1fr 280px;gap:16px;">
      <div>
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head"><div class="card-head-title">Müşteri</div></div>
          <div class="card-body">
            <div style="margin-bottom:10px;">
              <div class="fs-11 text-muted mb-4">Müşteri *</div>
              <select id="satisMusteri">
                <option value="">— Müşteri seçin —</option>${musteriOpts}
              </select>
              <div id="musteriBakiyeUyari" style="display:none;margin-top:8px;"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div><div class="fs-11 text-muted mb-4">Tarih</div>
                <input type="date" id="satisTarih" value="${duzenlemeModu ? (mevcutSatis.tarih||'').slice(0,10) : new Date().toISOString().slice(0,10)}"></div>
              <div><div class="fs-11 text-muted mb-4">Vade Tarihi</div>
                <input type="date" id="satisVade" value="${duzenlemeModu ? (mevcutSatis.vadeTarihi||'').slice(0,10) : ''}"></div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head">
            <div class="card-head-title">Ürünler</div>
            <span id="kalemSayisi" class="pill pill-green">0 kalem</span>
          </div>
          <div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:var(--color-background-secondary,#F1EFE8);">
                <th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:28%;">Ürün</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:10%;">Birim</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:12%;">Miktar</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:13%;">Birim Fiyat</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:9%;">KDV %</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:10%;">KDV ₺</th>
                <th style="padding:7px 5px;text-align:right;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:13%;">Tutar</th>
                <th style="width:5%;"></th>
              </tr></thead>
              <tbody id="urunBody"></tbody>
            </table>
            <button id="urunEkleBtn" style="width:100%;padding:9px;background:transparent;border:none;border-top:0.5px dashed rgba(0,0,0,0.1);cursor:pointer;font-size:12px;color:var(--color-text-secondary);font-family:inherit;">+ Ürün Satırı Ekle</button>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Not</div></div>
          <div class="card-body">
            <textarea id="satisNot" placeholder="Fatura notu..." style="min-height:48px;">${duzenlemeModu ? (mevcutSatis.not||'') : ''}</textarea>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card">
          <div class="card-head"><div class="card-head-title">Özet</div></div>
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">Ara toplam</span><span id="ozetAra" class="fw-500">₺0</span></div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">KDV (satır bazlı)</span><span id="ozetKdv" class="fw-500" style="color:var(--amber,#854F0B);">₺0</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">İskonto %</span>
              <input type="number" id="iskontoInput" value="${varsIskonto}" min="0" max="100" style="width:60px;text-align:center;padding:4px 6px;font-size:12px;">
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--color-border-tertiary);margin-top:4px;">
              <span class="fw-500">Toplam</span>
              <span id="ozetToplam" style="font-size:20px;font-weight:600;color:#2D7A3A;">₺0</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Ödeme</div></div>
          <div class="card-body">
            <select id="odemeTipi">
              <option value="nakit">Nakit</option><option value="cek">Çek</option>
              <option value="havale">Havale / EFT</option><option value="acikHesap">Açık Hesap</option>
            </select>
            <div id="odemeEkstra" style="margin-top:10px;"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Durum</div></div>
          <div class="card-body">
            <select id="satisDurum">
              <option value="bekliyor" selected>Bekliyor</option>
              <option value="odendi">Ödendi</option>
              <option value="vadeli">Vadeli</option>
            </select>
          </div>
        </div>
        <button class="btn-primary" id="kaydetBtn2" style="width:100%;justify-content:center;padding:10px;">Faturayı Kaydet</button>
      </div>
    </div>`;

  function renderSatirlar() {
    const tbody = document.getElementById('urunBody');
    if (!tbody) return;
    tbody.innerHTML = satirlar.map(s => {
      const tutar    = (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0);
      const kdvOrani = parseFloat(s.kdvOrani) || 0;
      const kdvTutar = tutar * kdvOrani / 100;
      return `<tr style="border-bottom:0.5px solid rgba(0,0,0,0.06);" data-sid="${s.id}">
        <td style="padding:4px 5px;">
          <select style="padding:6px;font-size:12px;width:100%;" data-alan="urun">
            <option value="">Seçin...</option>${urunOpts.replace(`value="${s.urun}"`,`value="${s.urun}" selected`)}
          </select>
          ${s.stokBilgi ? `<div style="font-size:10px;color:${s.stokBilgi.stok<=0?'#A32D2D':s.stokBilgi.stok<=20?'#854F0B':'#3B6D11'};margin-top:2px;padding-left:2px;">
            Stok: ${s.stokBilgi.stok} kg${s.stokBilgi.fiyat?` · Son alış: ${fmtPara(s.stokBilgi.fiyat)}`:''}
          </div>` : ''}
        </td>
        <td style="padding:4px 3px;">
          <select style="padding:6px;font-size:12px;width:100%;" data-alan="birim">
            ${['kg','adet','demet','kasa'].map(b=>`<option ${s.birim===b?'selected':''}>${b}</option>`).join('')}
          </select>
        </td>
        <td style="padding:4px 3px;"><input type="number" value="${s.miktar||''}" min="0" step="0.5" style="padding:6px;font-size:12px;" data-alan="miktar" placeholder="0"></td>
        <td style="padding:4px 3px;">
          <input type="number" value="${s.fiyat||''}" min="0" step="0.25" style="padding:6px;font-size:12px;" data-alan="fiyat"
            placeholder="${s.stokBilgi?.fiyat ? '₺'+s.stokBilgi.fiyat : '₺'}"
            title="${s.stokBilgi?.fiyat ? 'Son alış: '+fmtPara(s.stokBilgi.fiyat) : ''}">
        </td>
        <td style="padding:4px 3px;">
          <input type="number" value="${kdvOrani}" min="0" max="100" step="0.5"
            style="padding:6px;font-size:12px;text-align:center;" data-alan="kdvOrani"
            title="Bu ürünün KDV oranı">
        </td>
        <td style="padding:4px 5px;font-size:12px;color:var(--amber,#854F0B);text-align:right;" data-kdv="${s.id}">${fmtPara(kdvTutar)}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:500;color:#2D7A3A;font-size:13px;" data-tutar="${s.id}">${fmtPara(tutar)}</td>
        <td style="padding:4px 3px;"><button data-sil="${s.id}" style="width:26px;height:26px;border-radius:6px;border:0.5px solid rgba(0,0,0,0.15);background:transparent;cursor:pointer;color:#666;">×</button></td>
      </tr>`;
    }).join('');
    document.getElementById('kalemSayisi').textContent = satirlar.length + ' kalem';

    tbody.querySelectorAll('[data-alan]').forEach(el => {
      if (el.dataset.alan === 'urun') {
        el.addEventListener('change', async () => {
          const tr  = el.closest('tr');
          const sid = parseInt(tr.dataset.sid);
          const s   = satirlar.find(x => x.id === sid);
          if (!s) return;
          s.urun = el.value;
          if (el.value) {
            const sonFiyat = await ipc('stok:sonFiyat', el.value);
            s.stokBilgi = sonFiyat;
            if (!s.fiyat || s.fiyat == 0) s.fiyat = sonFiyat.fiyat || 0;
            // Ürünün KDV oranını otomatik doldur
            s.kdvOrani = sonFiyat.kdvOrani ?? 1;
          } else {
            s.stokBilgi = null;
            s.kdvOrani  = 0;
          }
          renderSatirlar(); hesapla();
        });
      } else {
        el.addEventListener('change', () => guncelleSatir(el));
        el.addEventListener('input',  () => guncelleSatir(el));
      }
    });
    tbody.querySelectorAll('[data-sil]').forEach(btn =>
      btn.addEventListener('click', () => {
        satirlar = satirlar.filter(s => s.id !== parseInt(btn.dataset.sil));
        renderSatirlar(); hesapla();
      }));
  }

  function guncelleSatir(el) {
    const tr = el.closest('tr'); const sid = parseInt(tr.dataset.sid);
    const s  = satirlar.find(x => x.id === sid); if (!s) return;
    s[el.dataset.alan] = el.value;
    const tutar    = (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0);
    const kdvOrani = parseFloat(s.kdvOrani) || 0;
    const kdvTutar = tutar * kdvOrani / 100;
    tr.querySelector(`[data-tutar="${sid}"]`).textContent = fmtPara(tutar);
    tr.querySelector(`[data-kdv="${sid}"]`).textContent   = fmtPara(kdvTutar);
    hesapla();
  }

  function hesapla() {
    let ara = 0, kdvTop = 0;
    satirlar.forEach(s => {
      const tutar    = (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0);
      const kdvOrani = parseFloat(s.kdvOrani) || 0;
      ara    += tutar;
      kdvTop += tutar * kdvOrani / 100;
    });
    const iskPct = parseFloat(document.getElementById('iskontoInput')?.value) || 0;
    const isk    = ara * iskPct / 100;
    const toplam = ara + kdvTop - isk;
    document.getElementById('ozetAra').textContent   = fmtPara(ara);
    document.getElementById('ozetKdv').textContent   = fmtPara(kdvTop);
    document.getElementById('ozetToplam').textContent = fmtPara(toplam);
  }

  function hesapla() {
    const ara  = satirlar.reduce((t,s)=>t+(parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0),0);
    const isk  = ara*(parseFloat(document.getElementById('iskontoInput')?.value)||0)/100;
    const kdv  = (ara-isk)*(parseFloat(document.getElementById('kdvOrani')?.value)||0)/100;
    document.getElementById('ozetAra').textContent    = fmtPara(ara);
    document.getElementById('ozetToplam').textContent = fmtPara(ara-isk+kdv);
  }

  async function kaydet() {
    const sel = document.getElementById('satisMusteri');
    const musteriId  = sel?.value;
    const musteriAdi = sel?.options[sel.selectedIndex]?.dataset?.ad;
    if (!musteriId) return bildirim('Müşteri seçin', 'error');
    if (!satirlar.some(s=>s.urun)) return bildirim('En az bir ürün ekleyin', 'error');

    let ara = 0, kdvTop = 0;
    satirlar.forEach(s => {
      const tutar    = (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0);
      const kdvOrani = parseFloat(s.kdvOrani) || 0;
      ara    += tutar;
      kdvTop += tutar * kdvOrani / 100;
    });
    const iskPct = parseFloat(document.getElementById('iskontoInput')?.value)||0;
    const isk    = ara * iskPct / 100;
    const toplam = ara + kdvTop - isk;
    const odeme  = document.getElementById('odemeTipi')?.value;

    const veri = {
      musteriId, musteriAdi,
      tarih:        document.getElementById('satisTarih')?.value,
      vadeTarihi:   document.getElementById('satisVade')?.value,
      odemeTipi:    odeme,
      odenmeDurumu: document.getElementById('satisDurum')?.value,
      not:          document.getElementById('satisNot')?.value,
      urunler: satirlar.filter(s=>s.urun).map(s=>({
        urunAdi:    s.urun,
        birim:      s.birim,
        miktar:     parseFloat(s.miktar)||0,
        birimFiyat: parseFloat(s.fiyat)||0,
        tutar:      (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0),
        kdvOrani:   parseFloat(s.kdvOrani)||0,
        kdvTutar:   (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0)*(parseFloat(s.kdvOrani)||0)/100,
      })),
      araToplam:    ara,
      kdvTutar:     kdvTop,
      iskontoOrani: iskPct,
      iskontoTutar: isk,
      genelToplam:  toplam,
    };

    try {
      if (duzenlemeModu) {
        // Güncelleme
        await ipc('satis:guncelle', { id: mevcutSatis.id, ...veri });
        bildirim('Fatura güncellendi!');
      } else {
        // Yeni kayıt — çek oluştur
        if (odeme === 'cek') {
          const cekNo = document.getElementById('cekNo')?.value;
          const vade  = document.getElementById('cekVade')?.value;
          if (cekNo && vade) await ipc('cek:ekle', { kisiAdi: musteriAdi, tip: 'Alacak', tutar: toplam, cekNo, vadeTarihi: vade, banka: document.getElementById('cekBanka')?.value });
        }
        await ipc('satis:ekle', veri);
        bildirim('Fatura kaydedildi!');
      }
      sayfaGit('satislar');
    } catch(e) { bildirim('Hata: '+e.message,'error'); }
  }

  document.getElementById('geriBtn').addEventListener('click', () => {
    if (duzenlemeModu) sayfaGit('satislar');
    else sayfaGit('satislar');
  });
  document.getElementById('kaydetBtn').addEventListener('click', kaydet);
  document.getElementById('kaydetBtn2').addEventListener('click', kaydet);
  document.getElementById('urunEkleBtn').addEventListener('click', () => {
    satirlar.push({ id: satirId++, urun: '', birim: 'kg', miktar: 0, fiyat: 0 });
    renderSatirlar(); hesapla();
  });
  document.getElementById('iskontoInput').addEventListener('input', hesapla);

  // Müşteri seçilince açık bakiye uyarısı göster
  document.getElementById('satisMusteri').addEventListener('change', async () => {
    const sel  = document.getElementById('satisMusteri');
    const uyar = document.getElementById('musteriBakiyeUyari');
    const id   = sel.value;
    if (!id) { uyar.style.display = 'none'; return; }
    const m = musteriler.find(x => x.id === id);
    if (!m) return;
    const bakiye = m.acikBakiye || 0;
    if (bakiye > 0) {
      uyar.style.display = 'block';
      uyar.innerHTML = `
        <div style="background:#FAEEDA;border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#854F0B" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 11v.5"/></svg>
          <div>
            <div style="font-size:12px;font-weight:500;color:#633806;">Bu müşterinin açık bakiyesi var</div>
            <div style="font-size:11px;color:#854F0B;margin-top:1px;">Mevcut borç: <strong>${fmtPara(bakiye)}</strong></div>
          </div>
        </div>`;
    } else {
      uyar.style.display = 'none';
    }
  });

  document.getElementById('odemeTipi').addEventListener('change', () => {
    const tip = document.getElementById('odemeTipi').value;
    const el  = document.getElementById('odemeEkstra');
    if (tip === 'cek') el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><div class="fs-11 text-muted mb-4">Çek No</div><input type="text" id="cekNo"></div>
        <div><div class="fs-11 text-muted mb-4">Vade</div><input type="date" id="cekVade"></div>
      </div>
      <div><div class="fs-11 text-muted mb-4">Banka</div>
        <select id="cekBanka"><option>Ziraat Bankası</option><option>Halkbank</option><option>İş Bankası</option><option>Garanti</option><option>Diğer</option></select></div>`;
    else if (tip === 'havale') el.innerHTML = `<div class="fs-11 text-muted mb-4">Dekont / Ref No</div><input type="text" id="havaleRef">`;
    else el.innerHTML = '';
  });
  renderSatirlar(); hesapla();
}
