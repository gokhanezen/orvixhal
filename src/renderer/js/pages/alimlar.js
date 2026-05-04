const { ipc, fmtPara, fmtTarih, bildirim, sayfaGit, modalAc } = window;

export async function render(container, params) {
  const [bahceciler, urunler, ayarlar] = await Promise.all([
    ipc('bahceci:liste'),
    ipc('stok:urunler'),
    ipc('ayar:oku'),
  ]);
  if (params === 'yeni') { renderForm(container, bahceciler, urunler, ayarlar); return; }

  let alimlar = await ipc('alim:liste');

  // ─── LİSTE ────────────────────────────────────────────────────────────────
  function renderListe() {
    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Alımlar — Bahçeciler</div>
        <input type="text" id="alimArama" placeholder="Bahçeci veya alım no..." style="max-width:230px;">
        <select id="alimBFilt" style="max-width:180px;">
          <option value="">Tüm bahçeciler</option>
          ${bahceciler.map(b=>`<option value="${b.id}">${b.ad}</option>`).join('')}
        </select>
        <button class="btn-primary" id="yeniAlimBtn" style="background:var(--teal,#0F6E56);">+ Yeni Alım</button>
      </div>
      <div class="p-20">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card"><div class="stat-label">Toplam Alım</div><div class="stat-val">${alimlar.length}</div></div>
          <div class="stat-card">
            <div class="stat-label">Toplam Maliyet</div>
            <div class="stat-val">${fmtPara(alimlar.reduce((t,a)=>t+(a.malBedeli||0),0))}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bekleyen Ödeme</div>
            <div class="stat-val" style="color:var(--red,#A32D2D);">
              ${fmtPara(alimlar.filter(a=>a.odemeDurumu!=='odendi').reduce((t,a)=>t+(a.odenecekTutar||0),0))}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bugün</div>
            <div class="stat-val">${alimlar.filter(a=>a.tarih?.startsWith(new Date().toISOString().slice(0,10))).length}</div>
          </div>
        </div>
        <div class="card">
          <div id="alimListeBody">${renderListeIcerik(alimlar)}</div>
        </div>
      </div>`;

    document.getElementById('yeniAlimBtn').addEventListener('click', () => renderForm(container, bahceciler, urunler, ayarlar));
    document.getElementById('alimArama').addEventListener('input', filtrele);
    document.getElementById('alimBFilt').addEventListener('change', filtrele);
    bagla();
  }

  function filtrele() {
    const q   = document.getElementById('alimArama').value.toLowerCase();
    const bId = document.getElementById('alimBFilt').value;
    const f   = alimlar.filter(a =>
      (!q   || a.bahceciAdi?.toLowerCase().includes(q) || a.alimNo?.includes(q)) &&
      (!bId || a.bahceciId === bId));
    document.getElementById('alimListeBody').innerHTML = renderListeIcerik(f);
    bagla();
  }

  function renderListeIcerik(liste) {
    if (!liste.length) return '<div class="bos-durum"><p>Alım bulunamadı</p></div>';
    return `
      <div class="t-head" style="display:grid;grid-template-columns:120px 1fr 90px 110px 100px 100px 80px 110px;gap:8px;padding:9px 16px;">
        <div>Alım No</div><div>Bahçeci</div><div>Tarih</div><div>Mal Bedeli</div><div>Komisyon</div><div>Ödenecek</div><div>Durum</div><div>İşlem</div>
      </div>
      ${liste.map(a => {
        const odendi = a.odemeDurumu === 'odendi';
        return `
        <div class="t-row alim-satir" data-id="${a.id}"
             style="display:grid;grid-template-columns:120px 1fr 90px 110px 100px 100px 80px 110px;gap:8px;padding:11px 16px;cursor:pointer;
                    ${odendi?'background:rgba(45,122,58,0.04);':''}">
          <div style="align-self:center;font-family:monospace;font-size:12px;font-weight:500;">${a.alimNo}</div>
          <div>
            <div class="fw-500">${a.bahceciAdi||'—'}</div>
            <div class="text-hint fs-11">${(a.urunler||[]).map(u=>u.urunAdi).slice(0,3).join(', ')}</div>
          </div>
          <div style="align-self:center;font-size:12px;">${fmtTarih(a.tarih)}</div>
          <div style="align-self:center;font-weight:500;">${fmtPara(a.malBedeli)}</div>
          <div style="align-self:center;color:var(--amber,#854F0B);">${fmtPara(a.toplamKomisyon)}</div>
          <div style="align-self:center;font-weight:500;color:var(--teal,#0F6E56);">${fmtPara(a.odenecekTutar)}</div>
          <div style="align-self:center;">
            ${odendi
              ? `<span class="pill pill-green" style="display:inline-flex;align-items:center;gap:3px;">
                   <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#27500A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5L3.5 7L8.5 2.5"/></svg>
                   Ödendi
                 </span>`
              : `<span class="pill pill-amber">Bekliyor</span>`}
          </div>
          <div style="align-self:center;display:flex;gap:4px;" onclick="event.stopPropagation()">
            ${!odendi
              ? `<button class="btn-secondary btn-odendi" data-id="${a.id}"
                   style="padding:3px 8px;font-size:11px;color:var(--green,#2D7A3A);">✓ Ödendi</button>`
              : ''}
            <button class="btn-secondary btn-sil" data-id="${a.id}"
              style="padding:3px 8px;font-size:11px;color:var(--red,#A32D2D);">Sil</button>
          </div>
        </div>`}).join('')}`;
  }

  function bagla() {
    document.querySelectorAll('.alim-satir').forEach(row =>
      row.addEventListener('click', () => renderDetay(row.dataset.id)));
    document.querySelectorAll('.btn-odendi').forEach(btn =>
      btn.addEventListener('click', async () => {
        await ipc('alim:odendi', btn.dataset.id);
        bildirim('Ödeme işaretlendi!');
        alimlar = await ipc('alim:liste');
        filtrele();
      }));
    document.querySelectorAll('.btn-sil').forEach(btn =>
      btn.addEventListener('click', () => alimSil(btn.dataset.id)));
  }

  function alimSil(id) {
    const a = alimlar.find(x => x.id === id);
    if (!a) return;
    modalAc('Alımı Sil',
      `<p style="color:var(--color-text-primary);">${a.alimNo} alım kaydını silmek istediğinizden emin misiniz?</p>`,
      async () => {
        await ipc('alim:sil', id);
        bildirim('Alım silindi.');
        document.querySelector('.modal-overlay')?.remove();
        alimlar = await ipc('alim:liste');
        renderListe();
      }, { kaydetLabel: 'Evet, Sil', tehlikeli: true });
  }

  // ─── DETAY ────────────────────────────────────────────────────────────────
  async function renderDetay(id) {
    const a = alimlar.find(x => x.id === id);
    if (!a) return;
    const ayarlar = await ipc('ayar:oku');

    container.innerHTML = `
      <div class="topbar">
        <button class="btn-secondary" id="detayGeriBtn">← Alımlar</button>
        <div class="topbar-title">${a.alimNo}</div>
        <button class="btn-secondary" id="detayDuzenleBtn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 2l2 2-7 7H2v-2L9 2z"/></svg>
          Düzenle
        </button>
        ${a.odemeDurumu === 'odendi'
          ? `<span class="pill pill-green" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;">
               <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#27500A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5.5L4 8L9.5 2.5"/></svg>
               Ödendi
             </span>`
          : `<button class="btn-secondary" id="detayOdendiBtn" style="color:var(--green,#2D7A3A);font-weight:500;">
               ✓ Ödendi İşaretle
             </button>`}
        <button class="btn-secondary" id="detayMakbuzBtn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="1" width="9" height="6" rx="1"/><path d="M1 7h11v4a1 1 0 01-1 1H3a1 1 0 01-1-1V7z"/></svg>
          Makbuz Yazdır
        </button>
        <button class="btn-secondary" id="detaySilBtn" style="color:var(--red,#A32D2D);">Sil</button>
      </div>

      <div class="p-20">
        <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;">

          <!-- SOL: ALIM BİLGİLERİ -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-head"><div class="card-head-title">Alım Bilgileri</div></div>
              <div class="card-body">
                ${[
                  ['Alım No',       a.alimNo],
                  ['Bahçeci',       a.bahceciAdi||'—'],
                  ['Tarih',         fmtTarih(a.tarih)],
                  ['Teslimat Yeri', a.teslimatYeri||'—'],
                  ['Ödeme Tipi',    a.odemeTipi||'—'],
                  ['Not',           a.not||'—'],
                ].map(([k,v]) => `
                  <div style="display:flex;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                    <span style="font-size:12px;color:var(--color-text-secondary);min-width:100px;flex-shrink:0;">${k}</span>
                    <span style="font-size:13px;font-weight:500;">${v}</span>
                  </div>`).join('')}
              </div>
            </div>

            <!-- MALİYET ÖZETİ -->
            <div class="card">
              <div class="card-head"><div class="card-head-title">Maliyet Özeti</div></div>
              <div class="card-body">
                ${[
                  ['Mal Bedeli',     fmtPara(a.malBedeli||0),      'inherit'],
                  ['Komisyon',       fmtPara(a.toplamKomisyon||0), 'var(--amber,#854F0B)'],
                  [`Stopaj (%${a.stopajOrani||0})`, fmtPara(a.stopajTutar||0), 'var(--red,#A32D2D)'],
                  ['Nakliye',        fmtPara(a.nakliye||0),        'inherit'],
                ].map(([k,v,c]) => `
                  <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                    <span style="font-size:12px;color:var(--color-text-secondary);">${k}</span>
                    <span style="font-size:13px;color:${c};">${v}</span>
                  </div>`).join('')}
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--color-border-tertiary);margin-top:4px;">
                  <span style="font-weight:500;font-size:14px;">Ödenecek</span>
                  <span style="font-size:22px;font-weight:600;color:var(--teal,#0F6E56);">${fmtPara(a.odenecekTutar)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SAĞ: ÜRÜN LİSTESİ -->
          <div class="card">
            <div class="card-head">
              <div class="card-head-title">Alınan Ürünler</div>
              <span class="pill pill-teal">${(a.urunler||[]).length} kalem</span>
            </div>
            <div class="t-head" style="display:grid;grid-template-columns:1fr 80px 100px 100px 80px 110px;gap:8px;padding:9px 16px;">
              <div>Ürün</div><div>Birim</div><div>Miktar</div><div>Alış Fiyatı</div><div>Kom %</div><div>Tutar</div>
            </div>
            ${(a.urunler||[]).map((u,i) => `
              <div style="display:grid;grid-template-columns:1fr 80px 100px 100px 80px 110px;gap:8px;padding:11px 16px;
                          background:${i%2===0?'':'var(--color-background-secondary,#F1EFE8)'};
                          border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                <div style="font-weight:500;">${u.urunAdi}</div>
                <div style="font-size:13px;">${u.birim||'kg'}</div>
                <div style="font-size:13px;">${u.miktar}</div>
                <div style="font-size:13px;">${fmtPara(u.fiyat||0)}</div>
                <div style="font-size:13px;color:var(--amber,#854F0B);">%${u.komPct||0}</div>
                <div style="font-weight:500;color:var(--teal,#0F6E56);">${fmtPara(u.tutar||0)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    document.getElementById('detayGeriBtn').addEventListener('click', async () => {
      alimlar = await ipc('alim:liste');
      renderListe();
    });
    document.getElementById('detaySilBtn').addEventListener('click', () => alimSil(id));
    document.getElementById('detayDuzenleBtn').addEventListener('click', () => {
      renderForm(container, bahceciler, urunler, ayarlar, a);
    });
    document.getElementById('detayOdendiBtn')?.addEventListener('click', async () => {
      await ipc('alim:odendi', id);
      bildirim('Ödeme işaretlendi!');
      alimlar = await ipc('alim:liste');
      renderDetay(id);
    });

    document.getElementById('detayMakbuzBtn').addEventListener('click', async () => {
      const btn = document.getElementById('detayMakbuzBtn');
      btn.textContent = 'Gönderiliyor...'; btn.disabled = true;
      try {
        await ipc('yazici:alimMakbuzu', {
          firma:   { adi: ayarlar.firmaAdi, adres: ayarlar.firmaAdres, tel: ayarlar.firmaTel },
          alim:    { no: a.alimNo, bahceciAdi: a.bahceciAdi, tarih: a.tarih, teslimatYeri: a.teslimatYeri },
          urunler: a.urunler || [],
          ozet:    { malBedeli: a.malBedeli||0, toplamKomisyon: a.toplamKomisyon||0, stopajOrani: a.stopajOrani||0, stopajTutar: a.stopajTutar||0, nakliye: a.nakliye||0, odenecekTutar: a.odenecekTutar||0 },
          odeme:   { tip: a.odemeTipi },
          yazici:  ayarlar.yazici,
          kagitGenislik: ayarlar.kagitGenislik,
        });
        bildirim('Makbuz yazıcıya gönderildi!');
      } catch(e) { bildirim('Yazıcı hatası: '+e.message, 'error'); }
      finally {
        const b = document.getElementById('detayMakbuzBtn');
        if (b) { b.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="1" width="9" height="6" rx="1"/><path d="M1 7h11v4a1 1 0 01-1 1H3a1 1 0 01-1-1V7z"/></svg> Makbuz Yazdır'; b.disabled = false; }
      }
    });
  }  // renderDetay sonu

  renderListe();
}

// ─── YENİ / DÜZENLE ALIM FORMU ───────────────────────────────────────────────
function renderForm(container, bahceciler, urunler, ayarlar = {}, mevcutAlim = null) {
  const duzenlemeModu = !!mevcutAlim;

  let satirlar = duzenlemeModu
    ? mevcutAlim.urunler.map((u, i) => ({
        id: i + 1, urun: u.urunAdi, birim: u.birim || 'kg',
        miktar: u.miktar, fiyat: u.fiyat || 0,
        komPct: u.komPct || ayarlar.komisyonOrani || 5,
        kdvPct: u.kdvPct || 0,
      }))
    : [{ id: 1, urun: '', birim: 'kg', miktar: 0, fiyat: 0, komPct: ayarlar.komisyonOrani||5, kdvPct: 1 }];
  let satirId   = satirlar.length + 1;
  let seciliBah = duzenlemeModu ? bahceciler.find(b => b.id === mevcutAlim.bahceciId) || null : null;
  let seciliOde = duzenlemeModu ? mevcutAlim.odemeTipi || 'nakit' : 'nakit';

  const bahceciOpts = bahceciler.map(b =>
    `<option value="${b.id}" data-ad="${b.ad}" data-kom="${b.komisyonOrani||5}"
      ${duzenlemeModu && b.id === mevcutAlim.bahceciId ? 'selected' : ''}>${b.ad}</option>`).join('');
  const urunOpts = urunler.map(u => {
    const ad = typeof u === 'string' ? u : u.ad;
    return `<option value="${ad}">${ad}</option>`;
  }).join('');

  container.innerHTML = `
    <div class="topbar">
      <button class="btn-secondary" id="geriBtn">← Geri</button>
      <div class="topbar-title">${duzenlemeModu ? mevcutAlim.alimNo + ' — Düzenle' : 'Bahçeci Alım Kaydı'}</div>
      <button class="btn-primary" id="kaydetBtn" style="background:var(--teal,#0F6E56);">${duzenlemeModu ? 'Değişiklikleri Kaydet' : 'Kaydet'}</button>
    </div>
    <div class="p-20" style="display:grid;grid-template-columns:1fr 290px;gap:16px;">
      <div>
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head"><div class="card-head-title">Bahçeci Seçimi</div></div>
          <div class="card-body">
            <div style="margin-bottom:10px;">
              <div class="fs-11 text-muted mb-4">Bahçeci *</div>
              <select id="alimBahceci">
                <option value="">— Seçin —</option>${bahceciOpts}
              </select>
              <div id="bKart" style="${duzenlemeModu?'':'display:none;'}background:var(--teal-l,#E1F5EE);border-radius:8px;padding:10px 12px;margin-top:8px;">
                <div class="fw-500" id="bKartAd" style="color:#085041;">${duzenlemeModu?mevcutAlim.bahceciAdi:''}</div>
                <div class="fs-11" id="bKartDet" style="color:#0F6E56;margin-top:2px;">${duzenlemeModu&&seciliBah?`Komisyon: %${seciliBah.komisyonOrani||5} · Borç: ${(seciliBah.kalanBorc||0).toLocaleString('tr-TR')}₺`:''}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div><div class="fs-11 text-muted mb-4">Tarih</div>
                <input type="date" id="alimTarih" value="${duzenlemeModu ? (mevcutAlim.tarih||'').slice(0,10) : new Date().toISOString().slice(0,10)}"></div>
              <div><div class="fs-11 text-muted mb-4">Teslimat Yeri</div>
                <select id="alimYer">
                  ${['Hal','Bahçe','Depo'].map(y=>`<option ${duzenlemeModu&&mevcutAlim.teslimatYeri===y?'selected':''}>${y}</option>`).join('')}
                </select></div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head">
            <div class="card-head-title">Alınan Ürünler</div>
            <span id="aKalem" class="pill pill-teal">0 kalem</span>
          </div>
          <div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:var(--color-background-secondary,#F1EFE8);">
                <th style="padding:7px 8px;text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:25%;">Ürün</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:10%;">Birim</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:12%;">Miktar</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:12%;">Alış ₺</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:9%;">Kom%</th>
                <th style="padding:7px 5px;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:9%;">KDV%</th>
                <th style="padding:7px 5px;text-align:right;font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;width:13%;">Tutar</th>
                <th style="width:10%;"></th>
              </tr></thead>
              <tbody id="aUrunBody"></tbody>
            </table>
            <button id="aUrunEkleBtn" style="width:100%;padding:9px;background:transparent;border:none;border-top:0.5px dashed rgba(0,0,0,0.1);cursor:pointer;font-size:12px;color:var(--color-text-secondary);font-family:inherit;">+ Ürün Satırı Ekle</button>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Not</div></div>
          <div class="card-body"><textarea id="alimNot" placeholder="Not..." style="min-height:48px;"></textarea></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card">
          <div class="card-head"><div class="card-head-title">Alım Özeti</div></div>
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">Mal bedeli</span><span id="aMal" class="fw-500">₺0</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">Komisyon %</span>
              <span id="aKom" class="fw-500" style="color:var(--amber,#854F0B);">₺0</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">KDV (ürün bazlı)</span>
              <span id="aKdvTutar" class="fw-500" style="color:var(--blue,#185FA5);">₺0</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="text-muted fs-12">Stopaj %</span>
                <input type="number" id="aStopajPct" value="${ayarlar.stopajOrani||3}" min="0" max="20" step="0.5"
                  style="width:48px;text-align:center;padding:3px 5px;font-size:11px;">
              </div>
              <span id="aStopaj" class="fw-500" style="color:var(--red,#A32D2D);">₺0</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">Nakliye ₺</span>
              <input type="number" id="aNakliye" value="0" min="0" style="width:70px;text-align:right;padding:4px 6px;font-size:12px;">
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--color-border-tertiary);margin-top:4px;">
              <span class="fw-500">Ödenecek</span>
              <span id="aOde" style="font-size:20px;font-weight:600;color:var(--teal,#0F6E56);">₺0</span>
            </div>
            <div style="background:var(--amber-l,#FAEEDA);border-radius:8px;padding:10px 12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span class="fs-12" style="color:var(--amber,#854F0B);">Komisyon kazancım</span>
                <span class="fw-500" style="color:#633806;" id="aKomKaz">₺0</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="font-size:11px;color:var(--amber,#854F0B);">Ort. oran</span>
                <span style="font-size:12px;font-weight:500;color:#633806;" id="aOrtKom">%0</span>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Ödeme Yöntemi</div></div>
          <div class="card-body">
            <div style="display:flex;gap:6px;margin-bottom:10px;" id="aOdemeGrp">
              ${[['nakit','Nakit','#EAF3DE','#2D7A3A'],['cek','Çek','#FAEEDA','#854F0B'],['veresiye','Veresiye','#FCEBEB','#A32D2D']]
                .map(([v,l,bg,c])=>`<button data-val="${v}" style="flex:1;padding:8px 4px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;background:${v==='nakit'?bg:'transparent'};color:${v==='nakit'?c:'var(--color-text-secondary)'};border:${v==='nakit'?'2px solid '+c:'0.5px solid rgba(0,0,0,0.15)'};font-family:inherit;">${l}</button>`).join('')}
            </div>
            <div id="aOdemeEk"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Bahçeci Bakiyesi</div></div>
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">Önceki borç</span><span id="bEski" class="fw-500">₺0</span></div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
              <span class="text-muted fs-12">Bu alım</span><span id="bBu" class="fw-500" style="color:var(--teal,#0F6E56);">+ ₺0</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;">
              <span class="fw-500 fs-12">Yeni toplam</span>
              <span id="bYeni" style="font-size:15px;font-weight:500;color:var(--red,#A32D2D);">₺0</span>
            </div>
          </div>
        </div>
        <button class="btn-primary" id="kaydetBtn2" style="width:100%;justify-content:center;padding:10px;background:var(--teal,#0F6E56);">Alımı Kaydet</button>
      </div>
    </div>`;

  function renderSatirlar() {
    const tbody = document.getElementById('aUrunBody');
    if (!tbody) return;
    tbody.innerHTML = satirlar.map(s => {
      const tutar = (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0);
      return `<tr style="border-bottom:0.5px solid rgba(0,0,0,0.06);" data-sid="${s.id}">
        <td style="padding:4px 5px;">
          <select style="padding:6px;font-size:12px;width:100%;" data-alan="urun">
            <option value="">Seçin...</option>${urunOpts.replace(`value="${s.urun}"`,`value="${s.urun}" selected`)}
          </select>
          ${s.stokBilgi !== undefined ? `<div style="font-size:10px;color:${(s.stokBilgi?.stok||0)<=20?'#A32D2D':'#3B6D11'};margin-top:2px;padding-left:2px;">
            Stok: <strong>${s.stokBilgi?.stok||0}</strong> kg
            ${s.stokBilgi?.kdvOrani !== undefined ? `· KDV: <strong>%${s.stokBilgi.kdvOrani}</strong>` : ''}
          </div>` : ''}
        </td>
        <td style="padding:4px 3px;"><select style="padding:6px;font-size:12px;width:100%;" data-alan="birim">
          ${['kg','adet','kasa','demet'].map(b=>`<option ${s.birim===b?'selected':''}>${b}</option>`).join('')}
        </select></td>
        <td style="padding:4px 3px;"><input type="number" value="${s.miktar||''}" min="0" step="0.5" style="padding:6px;font-size:12px;" data-alan="miktar" placeholder="0"></td>
        <td style="padding:4px 3px;"><input type="number" value="${s.fiyat||''}" min="0" step="0.25" style="padding:6px;font-size:12px;" data-alan="fiyat" placeholder="₺"></td>
        <td style="padding:4px 3px;"><input type="number" value="${s.komPct}" min="0" max="50" step="0.5" style="padding:6px;font-size:12px;text-align:center;" data-alan="komPct"></td>
        <td style="padding:4px 3px;"><input type="number" value="${s.kdvPct??1}" min="0" max="100" step="0.5" style="padding:6px;font-size:12px;text-align:center;" data-alan="kdvPct"></td>
        <td style="padding:4px 5px;text-align:right;font-weight:500;color:var(--teal,#0F6E56);font-size:13px;" data-tutar="${s.id}">${fmtPara(tutar)}</td>
        <td style="padding:4px 3px;"><button data-sil="${s.id}" style="width:26px;height:26px;border-radius:6px;border:0.5px solid rgba(0,0,0,0.15);background:transparent;cursor:pointer;color:#666;">×</button></td>
      </tr>`;
    }).join('');
    document.getElementById('aKalem').textContent = satirlar.length + ' kalem';

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
            // KDV oranını otomatik doldur
            s.kdvPct = sonFiyat.kdvOrani ?? 1;
          } else {
            s.stokBilgi = undefined;
            s.kdvPct    = 0;
          }
          renderSatirlar(); hesapla();
        });
      } else {
        el.addEventListener('change', () => guncelleASatir(el));
        el.addEventListener('input',  () => guncelleASatir(el));
      }
    });
    tbody.querySelectorAll('[data-sil]').forEach(btn =>
      btn.addEventListener('click', () => {
        satirlar = satirlar.filter(s => s.id !== parseInt(btn.dataset.sil));
        renderSatirlar(); hesapla();
      }));
  }

  function guncelleASatir(el) {
    const tr = el.closest('tr'); const sid = parseInt(tr.dataset.sid);
    const s  = satirlar.find(x => x.id === sid); if (!s) return;
    s[el.dataset.alan] = el.value;
    tr.querySelector(`[data-tutar="${sid}"]`).textContent =
      fmtPara((parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0));
    hesapla();
  }

  function hesapla() {
    let mal=0, kom=0, kdvTutar=0;
    satirlar.forEach(s => {
      const t   = (parseFloat(s.miktar)||0) * (parseFloat(s.fiyat)||0);
      const kdv = t * (parseFloat(s.kdvPct)||0) / 100;
      mal  += t;
      kom  += t * (parseFloat(s.komPct)||0) / 100;
      kdvTutar += kdv;
    });
    const stopajPct = parseFloat(document.getElementById('aStopajPct')?.value)||0;
    const stopaj    = (mal - kom) * stopajPct / 100;
    const nak       = parseFloat(document.getElementById('aNakliye')?.value)||0;
    const ode       = mal - kom - stopaj + kdvTutar + nak;
    const ort       = mal>0 ? Math.round(kom/mal*1000)/10 : 0;
    const eski      = seciliBah?.kalanBorc || 0;
    document.getElementById('aMal').textContent     = fmtPara(mal);
    document.getElementById('aKom').textContent     = fmtPara(kom);
    document.getElementById('aKdvTutar').textContent= fmtPara(kdvTutar);
    document.getElementById('aStopaj').textContent  = fmtPara(stopaj);
    document.getElementById('aOde').textContent     = fmtPara(ode);
    document.getElementById('aKomKaz').textContent  = fmtPara(kom);
    document.getElementById('aOrtKom').textContent  = '%'+ort;
    document.getElementById('bEski').textContent    = fmtPara(eski);
    document.getElementById('bBu').textContent      = '+ '+fmtPara(ode);
    document.getElementById('bYeni').textContent    = fmtPara(eski+ode);
  }

  document.getElementById('alimBahceci').addEventListener('change', () => {
    const sel = document.getElementById('alimBahceci');
    const opt = sel.options[sel.selectedIndex];
    if (!opt.value) { seciliBah=null; document.getElementById('bKart').style.display='none'; return; }
    seciliBah = bahceciler.find(b=>b.id===opt.value);
    if (seciliBah) {
      document.getElementById('bKartAd').textContent = seciliBah.ad;
      document.getElementById('bKartDet').textContent= `Komisyon: %${seciliBah.komisyonOrani||5} · Borç: ${fmtPara(seciliBah.borc||0)}`;
      document.getElementById('bKart').style.display = 'block';
      satirlar.forEach(s=>s.komPct=seciliBah.komisyonOrani||5);
      renderSatirlar(); hesapla();
    }
  });
  document.getElementById('aNakliye').addEventListener('input', hesapla);
  document.getElementById('aStopajPct')?.addEventListener('input', hesapla);
  document.getElementById('aOdemeGrp').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      seciliOde = btn.dataset.val;
      document.getElementById('aOdemeGrp').querySelectorAll('button').forEach(b => {
        const v=b.dataset.val;
        const m={nakit:['#EAF3DE','#2D7A3A'],cek:['#FAEEDA','#854F0B'],veresiye:['#FCEBEB','#A32D2D']};
        const [bg,c]=m[v]; const ak=v===seciliOde;
        b.style.background=ak?bg:'transparent'; b.style.color=ak?c:'var(--color-text-secondary)';
        b.style.border=ak?`2px solid ${c}`:'0.5px solid rgba(0,0,0,0.15)';
      });
      const ek=document.getElementById('aOdemeEk');
      if(seciliOde==='cek') ek.innerHTML=`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div><div class="fs-11 text-muted mb-4">Çek No</div><input type="text" id="aCekNo"></div>
          <div><div class="fs-11 text-muted mb-4">Vade</div><input type="date" id="aCekVade"></div>
        </div>
        <div><div class="fs-11 text-muted mb-4">Banka</div>
          <select id="aCekB"><option>Ziraat Bankası</option><option>Halkbank</option><option>İş Bankası</option><option>Garanti</option><option>Diğer</option></select></div>`;
      else if(seciliOde==='veresiye') ek.innerHTML=`<div class="fs-11 text-muted mb-4">Beklenen tarih</div><input type="date" id="aVerTarih">`;
      else ek.innerHTML='';
    });
  });

  async function kaydet() {
    const sel=document.getElementById('alimBahceci');
    const bahceciId=sel?.value, bahceciAdi=sel?.options[sel?.selectedIndex]?.dataset?.ad;
    if(!bahceciId) return bildirim('Bahçeci seçin','error');
    if(!satirlar.some(s=>s.urun)) return bildirim('En az bir ürün ekleyin','error');
    let mal=0, kom=0, kdvTop=0;
    satirlar.forEach(s=>{
      const t=(parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0);
      mal    += t;
      kom    += t*(parseFloat(s.komPct)||0)/100;
      kdvTop += t*(parseFloat(s.kdvPct)||0)/100;
    });
    const stopajPct = parseFloat(document.getElementById('aStopajPct')?.value)||0;
    const stopaj    = (mal - kom) * stopajPct / 100;
    const nak       = parseFloat(document.getElementById('aNakliye')?.value)||0;
    const ode       = mal - kom - stopaj + kdvTop + nak;

    const veri = {
      bahceciId, bahceciAdi,
      tarih:        document.getElementById('alimTarih')?.value,
      teslimatYeri: document.getElementById('alimYer')?.value,
      odemeTipi:    seciliOde,
      not:          document.getElementById('alimNot')?.value,
      urunler: satirlar.filter(s=>s.urun).map(s=>({
        urunAdi:  s.urun, birim: s.birim,
        miktar:   parseFloat(s.miktar)||0,
        fiyat:    parseFloat(s.fiyat)||0,
        tutar:    (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0),
        komPct:   parseFloat(s.komPct)||0,
        kdvPct:   parseFloat(s.kdvPct)||0,
        kdvTutar: (parseFloat(s.miktar)||0)*(parseFloat(s.fiyat)||0)*(parseFloat(s.kdvPct)||0)/100,
      })),
      malBedeli:mal, toplamKomisyon:kom,
      kdvToplam:kdvTop,
      stopajOrani:stopajPct, stopajTutar:stopaj,
      nakliye:nak, odenecekTutar:ode,
    };

    try {
      if (duzenlemeModu) {
        await ipc('alim:guncelle', { id: mevcutAlim.id, ...veri });
        bildirim('Alım güncellendi!');
      } else {
        if(seciliOde==='cek'){
          const cekNo=document.getElementById('aCekNo')?.value,vade=document.getElementById('aCekVade')?.value;
          if(cekNo&&vade) await ipc('cek:ekle',{kisiAdi:bahceciAdi,tip:'Borç',tutar:ode,cekNo,vadeTarihi:vade,banka:document.getElementById('aCekB')?.value});
        }
        await ipc('alim:ekle', veri);
        bildirim('Alım kaydedildi!');
      }
      sayfaGit('alimlar');
    } catch(e){bildirim('Hata: '+e.message,'error');}
  }

  document.getElementById('geriBtn').addEventListener('click', () => sayfaGit('alimlar'));
  document.getElementById('kaydetBtn').addEventListener('click', kaydet);
  document.getElementById('kaydetBtn2').addEventListener('click', kaydet);
  document.getElementById('aUrunEkleBtn').addEventListener('click', () => {
    satirlar.push({id:satirId++,urun:'',birim:'kg',miktar:0,fiyat:0,komPct:seciliBah?.komisyonOrani||5,kdvPct:1});
    renderSatirlar(); hesapla();
  });
  renderSatirlar(); hesapla();
}
