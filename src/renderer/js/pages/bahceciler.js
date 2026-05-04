const { ipc, fmtPara, fmtTarih, bildirim, sayfaGit, modalAc } = window;

export async function render(container) {
  let bahceciler = await ipc('bahceci:liste');

  // ─── LİSTE ────────────────────────────────────────────────────────────────
  function renderListe() {
    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Bahçeciler — Tedarikçiler</div>
        <input type="text" id="bahceciArama" placeholder="İsim veya yer ara..." style="max-width:220px;">
        <button class="btn-primary" id="yeniBahceciBtn">+ Yeni Bahçeci</button>
      </div>
      <div class="p-20">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card"><div class="stat-label">Toplam Bahçeci</div><div class="stat-val">${bahceciler.length}</div></div>
          <div class="stat-card">
            <div class="stat-label">Toplam Borç</div>
            <div class="stat-val" style="color:var(--red,#A32D2D);">${fmtPara(bahceciler.reduce((t,b)=>t+(b.kalanBorc||0),0))}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Ort. Komisyon</div>
            <div class="stat-val" style="color:var(--amber,#854F0B);">%${bahceciler.length?Math.round(bahceciler.reduce((t,b)=>t+(b.komisyonOrani||5),0)/bahceciler.length*10)/10:0}</div>
          </div>
          <div class="stat-card"><div class="stat-label">Borçlu Bahçeci</div><div class="stat-val">${bahceciler.filter(b=>(b.kalanBorc||0)>0).length}</div></div>
        </div>
        <div class="card" id="bahceciKart">${renderListeIcerik(bahceciler)}</div>
      </div>`;

    document.getElementById('yeniBahceciBtn').addEventListener('click', yeniBahceci);
    document.getElementById('bahceciArama').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const f = bahceciler.filter(b => b.ad?.toLowerCase().includes(q) || b.adres?.toLowerCase().includes(q));
      document.getElementById('bahceciKart').innerHTML = renderListeIcerik(f);
      bagla();
    });
    bagla();
  }

  function renderListeIcerik(liste) {
    if (!liste.length) return '<div class="bos-durum"><p>Bahçeci bulunamadı</p></div>';
    return `
      <div class="t-head" style="display:grid;grid-template-columns:28px 1fr 100px 80px 110px 110px;gap:10px;padding:9px 16px;">
        <div></div><div>Bahçeci</div><div>Telefon</div><div>Kom. %</div><div>Kalan Borç</div><div>İşlemler</div>
      </div>
      ${liste.map(b => {
        const av = (b.ad||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `
        <div class="t-row bahceci-satir" data-id="${b.id}"
             style="display:grid;grid-template-columns:28px 1fr 100px 80px 110px 110px;gap:10px;padding:11px 16px;cursor:pointer;">
          <div style="align-self:center;">
            <div style="width:28px;height:28px;border-radius:50%;background:#E1F5EE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#085041;">${av}</div>
          </div>
          <div>
            <div class="fw-500">${b.ad}</div>
            <div class="text-hint fs-11">${b.adres||'—'}</div>
          </div>
          <div style="align-self:center;font-size:12px;">${b.tel||'—'}</div>
          <div style="align-self:center;font-weight:500;color:var(--amber,#854F0B);">%${b.komisyonOrani||5}</div>
          <div style="align-self:center;font-weight:500;color:${(b.kalanBorc||0)>0?'var(--red,#A32D2D)':'var(--green,#2D7A3A)'};">
            ${fmtPara(b.kalanBorc||0)}
          </div>
          <div style="align-self:center;display:flex;gap:4px;" onclick="event.stopPropagation()">
            <button class="btn-secondary btn-duzenle" data-id="${b.id}" style="padding:3px 9px;font-size:11px;">Düzenle</button>
            <button class="btn-secondary btn-sil" data-id="${b.id}" style="padding:3px 9px;font-size:11px;color:var(--red,#A32D2D);">Sil</button>
          </div>
        </div>`}).join('')}`;
  }

  function bagla() {
    document.querySelectorAll('.bahceci-satir').forEach(row =>
      row.addEventListener('click', () => renderDetay(row.dataset.id)));
    document.querySelectorAll('.btn-duzenle').forEach(btn =>
      btn.addEventListener('click', () => duzenle(btn.dataset.id)));
    document.querySelectorAll('.btn-sil').forEach(btn =>
      btn.addEventListener('click', () => sil(btn.dataset.id)));
  }

  // ─── DETAY + CARİ HESAP ───────────────────────────────────────────────────
  async function renderDetay(id) {
    const b    = bahceciler.find(x => x.id === id);
    if (!b) return;
    const cari = await ipc('bahceci:cari', id);
    const av   = (b.ad||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    container.innerHTML = `
      <div class="topbar">
        <button class="btn-secondary" id="detayGeriBtn">← Bahçeciler</button>
        <div class="topbar-title">${b.ad}</div>
        <button class="btn-secondary" id="detayDuzenleBtn">Düzenle</button>
        <button class="btn-primary" id="detayOdemeBtn" style="background:var(--teal,#0F6E56);">+ Ödeme Yap</button>
        <button class="btn-secondary" id="detayYeniAlimBtn">+ Yeni Alım</button>
      </div>

      <div class="p-20">
        <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;">

          <!-- SOL -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-body">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:0.5px solid var(--color-border-tertiary);">
                  <div style="width:52px;height:52px;border-radius:50%;background:#E1F5EE;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#085041;flex-shrink:0;">${av}</div>
                  <div>
                    <div style="font-size:17px;font-weight:500;">${b.ad}</div>
                    <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">Bahçeci / Tedarikçi</div>
                  </div>
                </div>
                ${[['Telefon',b.tel||'—'],['Adres',b.adres||'—'],['IBAN',b.iban||'—'],['Kayıt',fmtTarih(b.olusturma)]]
                  .map(([k,v])=>`
                    <div style="display:flex;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                      <span style="font-size:12px;color:var(--color-text-secondary);min-width:70px;">${k}</span>
                      <span style="font-size:13px;font-weight:500;">${v}</span>
                    </div>`).join('')}
              </div>
            </div>

            <!-- CARİ ÖZET -->
            <div class="card">
              <div class="card-head"><div class="card-head-title">Cari Hesap</div></div>
              <div class="card-body">
                ${[
                  ['Komisyon Oranı', `%${b.komisyonOrani||5}`,       'var(--amber,#854F0B)'],
                  ['Toplam Alım',    fmtPara(cari.alimToplam),       'inherit'],
                  ['Ödenen Toplam',  fmtPara(cari.odenenToplam),     'var(--green,#2D7A3A)'],
                  ['Alım Sayısı',    (cari.alimlar||[]).length+' alım','inherit'],
                ].map(([k,v,c])=>`
                  <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                    <span style="font-size:12px;color:var(--color-text-secondary);">${k}</span>
                    <span style="font-weight:500;color:${c};">${v}</span>
                  </div>`).join('')}
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--color-border-tertiary);margin-top:4px;">
                  <span style="font-weight:500;">Kalan Borç</span>
                  <span style="font-size:22px;font-weight:600;color:${cari.kalanBorc>0?'var(--red,#A32D2D)':'var(--green,#2D7A3A)'};">${fmtPara(cari.kalanBorc)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SAĞ: SEKMELER -->
          <div class="card">
            <div class="card-head" style="padding:0;overflow:hidden;">
              <div style="display:flex;border-bottom:0.5px solid var(--color-border-tertiary);">
                <button class="cari-tab aktif-tab" data-tab="alimlar"
                  style="padding:12px 18px;border:none;background:#E1F5EE;cursor:pointer;font-size:13px;font-weight:500;color:#085041;border-bottom:2px solid #0F6E56;font-family:inherit;">
                  Alımlar (${(cari.alimlar||[]).length})
                </button>
                <button class="cari-tab" data-tab="odemeler"
                  style="padding:12px 18px;border:none;background:transparent;cursor:pointer;font-size:13px;color:var(--color-text-secondary);font-family:inherit;">
                  Ödemeler (${(cari.odemeler||[]).length})
                </button>
              </div>
            </div>

            <!-- ALIMLAR -->
            <div id="tab-alimlar">
              ${!(cari.alimlar||[]).length
                ? '<div class="bos-durum"><p>Alım bulunamadı</p></div>'
                : `<div class="t-head" style="display:grid;grid-template-columns:110px 90px 110px 100px 100px;gap:8px;padding:9px 16px;">
                    <div>Alım No</div><div>Tarih</div><div>Mal Bedeli</div><div>Komisyon</div><div>Ödenecek</div>
                   </div>
                   ${cari.alimlar.map(a=>`
                     <div style="display:grid;grid-template-columns:110px 90px 110px 100px 100px;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                       <div style="font-family:monospace;font-size:12px;font-weight:500;">${a.alimNo}</div>
                       <div style="font-size:12px;">${fmtTarih(a.tarih)}</div>
                       <div style="font-weight:500;">${fmtPara(a.malBedeli)}</div>
                       <div style="color:var(--amber,#854F0B);">${fmtPara(a.toplamKomisyon)}</div>
                       <div style="font-weight:500;color:var(--teal,#0F6E56);">${fmtPara(a.odenecekTutar)}</div>
                     </div>`).join('')}`}
            </div>

            <!-- ÖDEMELER -->
            <div id="tab-odemeler" style="display:none;">
              ${!(cari.odemeler||[]).length
                ? '<div class="bos-durum"><p>Ödeme kaydı bulunamadı</p></div>'
                : `<div class="t-head" style="display:grid;grid-template-columns:110px 90px 110px 90px 1fr 60px;gap:8px;padding:9px 16px;">
                    <div>Ödeme No</div><div>Tarih</div><div>Tutar</div><div>Yöntem</div><div>Açıklama</div><div>Sil</div>
                   </div>
                   ${cari.odemeler.map(o=>`
                     <div style="display:grid;grid-template-columns:110px 90px 110px 90px 1fr 60px;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                       <div style="font-family:monospace;font-size:12px;font-weight:500;">${o.odemeNo}</div>
                       <div style="font-size:12px;">${fmtTarih(o.tarih)}</div>
                       <div style="font-weight:500;color:var(--teal,#0F6E56);">${fmtPara(o.tutar)}</div>
                       <div style="font-size:12px;">${o.odemeTipi||'—'}</div>
                       <div style="font-size:12px;color:var(--color-text-secondary);">${o.aciklama||'—'}</div>
                       <div><button class="btn-secondary odeme-sil" data-id="${o.id}" style="padding:3px 7px;font-size:11px;color:var(--red,#A32D2D);">Sil</button></div>
                     </div>`).join('')}`}
            </div>
          </div>
        </div>
      </div>`;

    // Tab geçişi
    document.querySelectorAll('.cari-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cari-tab').forEach(t => {
          t.style.background = 'transparent'; t.style.color = 'var(--color-text-secondary)'; t.style.borderBottom = 'none';
        });
        btn.style.background = '#E1F5EE'; btn.style.color = '#085041'; btn.style.borderBottom = '2px solid #0F6E56';
        document.getElementById('tab-alimlar').style.display  = btn.dataset.tab==='alimlar'?'block':'none';
        document.getElementById('tab-odemeler').style.display = btn.dataset.tab==='odemeler'?'block':'none';
      });
    });

    document.querySelectorAll('.odeme-sil').forEach(btn =>
      btn.addEventListener('click', async () => {
        await ipc('odeme:sil', btn.dataset.id);
        bildirim('Ödeme silindi.');
        renderDetay(id);
      }));

    document.getElementById('detayGeriBtn').addEventListener('click', async () => {
      bahceciler = await ipc('bahceci:liste');
      renderListe();
    });
    document.getElementById('detayDuzenleBtn').addEventListener('click', () => duzenle(id, true));
    document.getElementById('detayYeniAlimBtn').addEventListener('click', () => sayfaGit('alimlar','yeni'));
    document.getElementById('detayOdemeBtn').addEventListener('click', () => odemeModal(b, cari.kalanBorc, id));
  }

  // ─── ÖDEME MODAL ──────────────────────────────────────────────────────────
  function odemeModal(b, kalanBorc, id) {
    modalAc('Bahçeciye Ödeme Yap — ' + b.ad, `
      <div style="background:#E1F5EE;border-radius:8px;padding:10px 12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#085041;">Kalan Borç</span>
        <span style="font-size:18px;font-weight:600;color:${kalanBorc>0?'#A32D2D':'#2D7A3A'};">${fmtPara(kalanBorc)}</span>
      </div>
      <div style="margin-bottom:12px;">
        <div class="fs-11 text-muted mb-4">Ödeme Tutarı (₺) *</div>
        <input type="number" id="oTutar" value="${kalanBorc||''}" min="0" step="0.01" placeholder="0">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Ödeme Yöntemi</div>
          <select id="oTip"><option value="nakit">Nakit</option><option value="havale">Havale / EFT</option><option value="cek">Çek</option></select>
        </div>
        <div><div class="fs-11 text-muted mb-4">Tarih</div>
          <input type="date" id="oTarih" value="${new Date().toISOString().slice(0,10)}">
        </div>
      </div>
      <div><div class="fs-11 text-muted mb-4">Açıklama (opsiyonel)</div>
        <input type="text" id="oAciklama" placeholder="Alım no veya not..."></div>`,
      async (panel) => {
        const tutar = parseFloat(panel.querySelector('#oTutar').value);
        if (!tutar || tutar <= 0) return bildirim('Geçerli bir tutar girin', 'error');
        await ipc('odeme:bahceciOdeme', {
          bahceciId:  b.id,
          bahceciAdi: b.ad,
          tutar,
          odemeTipi:  panel.querySelector('#oTip').value,
          tarih:      panel.querySelector('#oTarih').value,
          aciklama:   panel.querySelector('#oAciklama').value,
        });
        bildirim(`₺${tutar.toLocaleString('tr-TR')} ödeme yapıldı!`);
        document.querySelector('.modal-overlay')?.remove();
        bahceciler = await ipc('bahceci:liste');
        renderDetay(id);
      }, { kaydetLabel: 'Ödemeyi Kaydet' });
  }

  // ─── FORM ─────────────────────────────────────────────────────────────────
  function bahceciFormu(b = {}) {
    return `
      <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Ad Soyad *</div>
        <input type="text" id="bAd" value="${b.ad||''}" placeholder="Mehmet Usta"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Telefon</div><input type="text" id="bTel" value="${b.tel||''}"></div>
        <div><div class="fs-11 text-muted mb-4">Komisyon Oranı (%)</div><input type="number" id="bKom" value="${b.komisyonOrani||5}" min="0" max="50" step="0.5"></div>
      </div>
      <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Adres / Bahçe Yeri</div>
        <textarea id="bAdres" style="min-height:58px;">${b.adres||''}</textarea></div>
      <div><div class="fs-11 text-muted mb-4">IBAN (opsiyonel)</div>
        <input type="text" id="bIban" value="${b.iban||''}" placeholder="TR..."></div>`;
  }

  function yeniBahceci() {
    modalAc('Yeni Bahçeci Ekle', bahceciFormu(), async (panel) => {
      const ad = panel.querySelector('#bAd').value.trim();
      if (!ad) return bildirim('Ad zorunludur', 'error');
      await ipc('bahceci:ekle', { ad, tel: panel.querySelector('#bTel').value.trim(), komisyonOrani: parseFloat(panel.querySelector('#bKom').value)||5, adres: panel.querySelector('#bAdres').value.trim(), iban: panel.querySelector('#bIban').value.trim() });
      bildirim('Bahçeci eklendi!');
      document.querySelector('.modal-overlay')?.remove();
      bahceciler = await ipc('bahceci:liste');
      renderListe();
    });
  }

  function duzenle(id, detayModu=false) {
    const b = bahceciler.find(x=>x.id===id);
    if (!b) return;
    modalAc('Bahçeci Düzenle', bahceciFormu(b), async (panel) => {
      const ad = panel.querySelector('#bAd').value.trim();
      if (!ad) return bildirim('Ad zorunludur', 'error');
      await ipc('bahceci:guncelle', { id, ad, tel: panel.querySelector('#bTel').value.trim(), komisyonOrani: parseFloat(panel.querySelector('#bKom').value)||5, adres: panel.querySelector('#bAdres').value.trim(), iban: panel.querySelector('#bIban').value.trim() });
      bildirim('Bahçeci güncellendi!');
      document.querySelector('.modal-overlay')?.remove();
      bahceciler = await ipc('bahceci:liste');
      if (detayModu) renderDetay(id); else renderListe();
    });
  }

  function sil(id) {
    const b = bahceciler.find(x=>x.id===id);
    if (!b) return;
    modalAc('Bahçeci Sil',
      `<p style="color:var(--color-text-primary);">"<strong>${b.ad}</strong>" kaydını silmek istediğinizden emin misiniz?</p>
       <p style="margin-top:8px;font-size:12px;color:var(--red,#A32D2D);">Bu işlem geri alınamaz.</p>`,
      async () => {
        await ipc('bahceci:sil', id);
        bildirim('Bahçeci silindi.');
        document.querySelector('.modal-overlay')?.remove();
        bahceciler = await ipc('bahceci:liste');
        renderListe();
      }, { kaydetLabel: 'Evet, Sil', tehlikeli: true });
  }

  renderListe();
}
