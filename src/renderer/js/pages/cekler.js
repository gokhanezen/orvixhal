const { ipc, fmtPara, fmtTarih, bildirim, modalAc } = window;

export async function render(container) {
  let cekler = await ipc('cek:liste');
  let aktifFiltre = 'hepsi';
  const today = new Date(); today.setHours(0,0,0,0);

  function gunFark(tarih) {
    if (!tarih) return null;
    const t = new Date(tarih); t.setHours(0,0,0,0);
    return Math.round((t - today) / 86400000);
  }

  function kalanBadge(gun, durum) {
    if (durum === 'tahsil') return `
      <span class="pill pill-green" style="display:inline-flex;align-items:center;gap:4px;">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#27500A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 5.5L4 8L9.5 2.5"/>
        </svg>
        Tahsil Edildi
      </span>`;
    if (gun === null) return '<span class="pill pill-gray">—</span>';
    if (gun < 0)  return `
      <span class="pill pill-red" style="display:inline-flex;align-items:center;gap:4px;">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#791F1F" stroke-width="1.8" stroke-linecap="round">
          <path d="M5.5 2v4M5.5 8.5v.5"/>
        </svg>
        ${Math.abs(gun)}g geçti
      </span>`;
    if (gun === 0) return `
      <span class="pill pill-red" style="display:inline-flex;align-items:center;gap:4px;">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#791F1F" stroke-width="1.8" stroke-linecap="round">
          <path d="M5.5 2v4M5.5 8.5v.5"/>
        </svg>
        Bugün!
      </span>`;
    if (gun <= 7) return `<span class="pill pill-amber">${gun} gün</span>`;
    return `<span class="pill pill-gray">${gun} gün</span>`;
  }

  // Satır arka plan rengi
  function satirRenk(gun, durum) {
    if (durum === 'tahsil') return 'background:rgba(39,80,10,0.04);';
    if (gun !== null && gun < 0) return 'background:rgba(163,45,45,0.06);border-left:3px solid #E24B4A;';
    if (gun === 0) return 'background:rgba(163,45,45,0.06);border-left:3px solid #E24B4A;';
    if (gun !== null && gun <= 7) return 'background:rgba(133,79,11,0.04);border-left:3px solid #EF9F27;';
    return '';
  }

  // ─── LİSTE ────────────────────────────────────────────────────────────────
  function renderListe() {
    const aktif  = cekler.filter(c=>c.durum!=='tahsil');
    const gecmis = aktif.filter(c=>gunFark(c.vadeTarihi)<0).length;
    const hafta  = aktif.filter(c=>{const g=gunFark(c.vadeTarihi);return g!==null&&g>=0&&g<=7;}).length;
    const toplam = aktif.reduce((s,c)=>s+(c.tutar||0),0);

    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Çek Takibi</div>
        <button class="btn-primary" id="yeniCekBtn" style="background:var(--amber,#854F0B);">+ Yeni Çek</button>
      </div>
      <div class="p-20">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card"><div class="stat-label">Aktif Çek</div><div class="stat-val">${aktif.length}</div></div>
          <div class="stat-card"><div class="stat-label">Vadesi Geçmiş</div><div class="stat-val" style="color:var(--red,#A32D2D);">${gecmis}</div></div>
          <div class="stat-card"><div class="stat-label">Bu Hafta Vadeli</div><div class="stat-val" style="color:var(--amber,#854F0B);">${hafta}</div></div>
          <div class="stat-card"><div class="stat-label">Toplam Tutar</div><div class="stat-val" style="color:var(--blue,#185FA5);">${fmtPara(toplam)}</div></div>
        </div>
        <div class="card">
          <div class="card-head" style="gap:6px;flex-wrap:wrap;">
            <div style="display:flex;gap:6px;" id="cekFiltreGrp">
              ${[['hepsi','Tümü'],['gecmis','Vadesi Geçmiş'],['buHafta','Bu Hafta'],['tahsil','Tahsil Edildi']]
                .map(([v,l])=>`<button class="btn-secondary cek-filtre" data-filtre="${v}"
                  style="${v==='hepsi'?'background:var(--amber-l,#FAEEDA);color:#633806;border-color:rgba(133,79,11,0.3);':''}">${l}</button>`).join('')}
            </div>
          </div>
          <div id="cekListe">${renderListeIcerik()}</div>
        </div>
      </div>`;

    document.getElementById('yeniCekBtn').addEventListener('click', yeniCek);
    document.querySelectorAll('.cek-filtre').forEach(btn => {
      btn.addEventListener('click', () => {
        aktifFiltre = btn.dataset.filtre;
        document.querySelectorAll('.cek-filtre').forEach(b => {
          const ak = b.dataset.filtre === aktifFiltre;
          b.style.background  = ak ? 'var(--amber-l,#FAEEDA)' : '';
          b.style.color       = ak ? '#633806' : '';
          b.style.borderColor = ak ? 'rgba(133,79,11,0.3)' : '';
        });
        document.getElementById('cekListe').innerHTML = renderListeIcerik();
        bagla();
      });
    });
    bagla();
  }

  function filtrele(liste) {
    return liste.filter(c => {
      if (aktifFiltre === 'gecmis')   return c.durum!=='tahsil' && gunFark(c.vadeTarihi)<0;
      if (aktifFiltre === 'buHafta')  { const g=gunFark(c.vadeTarihi); return c.durum!=='tahsil'&&g!==null&&g>=0&&g<=7; }
      if (aktifFiltre === 'tahsil')   return c.durum==='tahsil';
      return true;
    });
  }

  function renderListeIcerik() {
    const f = filtrele(cekler);
    if (!f.length) return '<div class="bos-durum"><p>Bu filtreye uygun çek bulunamadı</p></div>';
    return `
      <div class="t-head" style="display:grid;grid-template-columns:28px 1fr 100px 70px 110px 100px 90px 120px;gap:8px;padding:9px 16px;">
        <div></div><div>Kişi / İşletme</div><div>Çek No</div><div>Tip</div><div>Tutar</div><div>Vade</div><div>Kalan</div><div>İşlemler</div>
      </div>
      ${f.map(c => {
        const gun = gunFark(c.vadeTarihi);
        const renk = satirRenk(gun, c.durum);
        // Satır başı ikon
        const satirIkon = c.durum === 'tahsil'
          ? `<div style="align-self:center;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#EAF3DE;">
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#27500A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 6L4.5 9L10.5 3"/></svg>
             </div>`
          : gun !== null && gun < 0
          ? `<div style="align-self:center;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#FCEBEB;">
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#A32D2D" stroke-width="2" stroke-linecap="round"><path d="M6 2v5M6 9v.5"/></svg>
             </div>`
          : gun === 0
          ? `<div style="align-self:center;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#FCEBEB;">
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#A32D2D" stroke-width="2" stroke-linecap="round"><path d="M6 2v5M6 9v.5"/></svg>
             </div>`
          : gun !== null && gun <= 7
          ? `<div style="align-self:center;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#FAEEDA;">
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#854F0B" stroke-width="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v3L7.5 8"/></svg>
             </div>`
          : `<div style="width:22px;height:22px;"></div>`;

        return `
        <div class="t-row cek-satir" data-id="${c.id}"
             style="display:grid;grid-template-columns:28px 1fr 100px 70px 110px 100px 90px 120px;gap:8px;padding:11px 16px;cursor:pointer;${renk}">
          ${satirIkon}
          <div>
            <div class="fw-500">${c.kisiAdi}</div>
            <div class="text-hint fs-11">${c.banka||''}</div>
          </div>
          <div style="align-self:center;font-family:monospace;font-size:11px;">${c.cekNo}</div>
          <div style="align-self:center;">${c.tip==='Alacak'?'<span class="pill pill-green">Alacak</span>':'<span class="pill pill-blue">Borç</span>'}</div>
          <div style="align-self:center;font-weight:500;color:var(--amber,#854F0B);">${fmtPara(c.tutar)}</div>
          <div style="align-self:center;font-size:12px;">${fmtTarih(c.vadeTarihi)}</div>
          <div style="align-self:center;">${kalanBadge(gun, c.durum)}</div>
          <div style="align-self:center;display:flex;gap:4px;" onclick="event.stopPropagation()">
            ${c.durum!=='tahsil'?`<button class="btn-secondary btn-tahsil" data-id="${c.id}" style="padding:3px 7px;font-size:11px;color:var(--green,#2D7A3A);">Tahsil</button>`:''}
            <button class="btn-secondary btn-duzenle" data-id="${c.id}" style="padding:3px 7px;font-size:11px;">Düzenle</button>
            <button class="btn-secondary btn-sil" data-id="${c.id}" style="padding:3px 7px;font-size:11px;color:var(--red,#A32D2D);">Sil</button>
          </div>
        </div>`;
      }).join('')}`;
  }

  function bagla() {
    document.querySelectorAll('.cek-satir').forEach(row =>
      row.addEventListener('click', () => renderDetay(row.dataset.id)));
    document.querySelectorAll('.btn-tahsil').forEach(btn =>
      btn.addEventListener('click', async () => {
        await ipc('cek:tahsilEt', btn.dataset.id);
        bildirim('Çek tahsil edildi!');
        cekler = await ipc('cek:liste');
        renderListe();
      }));
    document.querySelectorAll('.btn-duzenle').forEach(btn =>
      btn.addEventListener('click', () => duzenle(btn.dataset.id)));
    document.querySelectorAll('.btn-sil').forEach(btn =>
      btn.addEventListener('click', () => cekSil(btn.dataset.id)));
  }

  // ─── DETAY ────────────────────────────────────────────────────────────────
  function renderDetay(id) {
    const c = cekler.find(x => x.id === id);
    if (!c) return;
    const gun = gunFark(c.vadeTarihi);

    // Büyük durum ikonu
    const durumIkon = c.durum === 'tahsil'
      ? `<div style="width:52px;height:52px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
           <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#27500A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M4 13L9.5 19L22 7"/>
           </svg>
         </div>`
      : gun !== null && gun < 0
      ? `<div style="width:52px;height:52px;border-radius:50%;background:#FCEBEB;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
           <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#A32D2D" stroke-width="2.5" stroke-linecap="round">
             <path d="M13 5v10M13 18.5v1"/>
           </svg>
         </div>`
      : `<div style="width:52px;height:52px;border-radius:50%;background:#FAEEDA;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
           <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#854F0B" stroke-width="2" stroke-linecap="round">
             <circle cx="13" cy="13" r="9"/>
             <path d="M13 8v6l3 3"/>
           </svg>
         </div>`;

    container.innerHTML = `
      <div class="topbar">
        <button class="btn-secondary" id="detayGeriBtn">← Çek Takibi</button>
        <div class="topbar-title">Çek Detayı</div>
        ${c.durum!=='tahsil'?`<button class="btn-secondary" id="detayTahsilBtn" style="color:var(--green,#2D7A3A);">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 6.5L5 10L11.5 3"/></svg>
          Tahsil Edildi
        </button>`:''}
        <button class="btn-secondary" id="detayDuzenleBtn">Düzenle</button>
        <button class="btn-secondary" id="detaySilBtn" style="color:var(--red,#A32D2D);">Sil</button>
      </div>

      <div class="p-20" style="max-width:680px;">
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head">
            <div style="display:flex;align-items:center;gap:12px;flex:1;">
              ${durumIkon}
              <div>
                <div style="font-size:15px;font-weight:500;">${c.kisiAdi}</div>
                <div style="margin-top:4px;display:flex;gap:6px;align-items:center;">
                  ${c.tip==='Alacak'?'<span class="pill pill-green">Alacak</span>':'<span class="pill pill-blue">Borç</span>'}
                  ${kalanBadge(gun, c.durum)}
                </div>
              </div>
            </div>
            <div style="font-size:24px;font-weight:700;color:var(--amber,#854F0B);">${fmtPara(c.tutar)}</div>
          </div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
              ${[
                ['Çek No',         c.cekNo],
                ['Banka',          c.banka||'—'],
                ['Vade Tarihi',    fmtTarih(c.vadeTarihi)],
                ['Kayıt Tarihi',   fmtTarih(c.olusturma)],
                ['Durum',          c.durum==='tahsil'
                  ? '<span style="color:#27500A;font-weight:500;">✓ Tahsil Edildi</span>'
                  : gun!==null&&gun<0
                  ? '<span style="color:#A32D2D;font-weight:500;">⚠ Vadesi Geçmiş</span>'
                  : '<span style="color:#854F0B;">Bekliyor</span>'],
                ['Not',            c.not||'—'],
              ].map(([k,v]) => `
                <div style="padding:10px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                  <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:3px;">${k}</div>
                  <div style="font-weight:500;font-size:14px;">${v}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        ${c.durum!=='tahsil' && gun !== null ? `
        <div class="card" style="border-color:${gun<0?'rgba(163,45,45,0.3)':gun<=7?'rgba(133,79,11,0.3)':'rgba(0,0,0,0.08)'};">
          <div class="card-body" style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:28px;font-weight:700;color:${gun<0?'var(--red,#A32D2D)':gun<=7?'var(--amber,#854F0B)':'var(--green,#2D7A3A)'};">
              ${gun<0?Math.abs(gun)+' gün geçti':gun===0?'Bugün!':gun+' gün kaldı'}
            </div>
            <div style="font-size:13px;color:var(--color-text-secondary);">
              ${gun<0?'Bu çekin vadesi geçmiş. Acil işlem gerekiyor!':gun<=7?'Vade yaklaşıyor, dikkat!':'Vadeye yeterli zaman var.'}
            </div>
          </div>
        </div>` : ''}
      </div>`;

    document.getElementById('detayGeriBtn').addEventListener('click', () => renderListe());
    document.getElementById('detayDuzenleBtn').addEventListener('click', () => duzenle(id, true));
    document.getElementById('detaySilBtn').addEventListener('click', () => cekSil(id));
    document.getElementById('detayTahsilBtn')?.addEventListener('click', async () => {
      await ipc('cek:tahsilEt', id);
      bildirim('Çek tahsil edildi!');
      cekler = await ipc('cek:liste');
      renderDetay(id);
    });
  }

  // ─── FORM ─────────────────────────────────────────────────────────────────
  function cekFormu(c = {}) {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Kişi / İşletme *</div>
          <input type="text" id="cKisi" value="${c.kisiAdi||''}" placeholder="Ad veya işletme adı"></div>
        <div><div class="fs-11 text-muted mb-4">Çek Tipi</div>
          <select id="cTip">
            <option value="Alacak" ${c.tip==='Alacak'?'selected':''}>Alacak (Bize verildi)</option>
            <option value="Borç"   ${c.tip==='Borç'?'selected':''}>Borç (Biz verdik)</option>
          </select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Tutar (₺) *</div>
          <input type="number" id="cTutar" value="${c.tutar||''}" min="0" placeholder="0"></div>
        <div><div class="fs-11 text-muted mb-4">Çek No *</div>
          <input type="text" id="cNo" value="${c.cekNo||''}" placeholder="12345678"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Vade Tarihi *</div>
          <input type="date" id="cVade" value="${c.vadeTarihi||''}"></div>
        <div><div class="fs-11 text-muted mb-4">Banka</div>
          <select id="cBanka">
            ${['Ziraat Bankası','Halkbank','İş Bankası','Garanti','Yapı Kredi','Vakıfbank','Diğer']
              .map(b=>`<option ${c.banka===b?'selected':''}>${b}</option>`).join('')}
          </select></div>
      </div>
      <div><div class="fs-11 text-muted mb-4">Not</div>
        <input type="text" id="cNot" value="${c.not||''}"></div>`;
  }

  function yeniCek() {
    modalAc('Yeni Çek Kaydı', cekFormu(), async (panel) => {
      const kisi  = panel.querySelector('#cKisi').value.trim();
      const tutar = parseFloat(panel.querySelector('#cTutar').value);
      const no    = panel.querySelector('#cNo').value.trim();
      const vade  = panel.querySelector('#cVade').value;
      if (!kisi||!tutar||!no||!vade) return bildirim('Zorunlu alanları doldurun','error');
      await ipc('cek:ekle',{
        kisiAdi:kisi, tip:panel.querySelector('#cTip').value,
        tutar, cekNo:no, vadeTarihi:vade,
        banka:panel.querySelector('#cBanka').value,
        not:panel.querySelector('#cNot').value,
      });
      bildirim('Çek eklendi!');
      document.querySelector('.modal-overlay')?.remove();
      cekler = await ipc('cek:liste');
      renderListe();
    });
  }

  function duzenle(id, detayModu=false) {
    const c = cekler.find(x=>x.id===id);
    if (!c) return;
    modalAc('Çek Düzenle', cekFormu(c), async (panel) => {
      const kisi  = panel.querySelector('#cKisi').value.trim();
      const tutar = parseFloat(panel.querySelector('#cTutar').value);
      const no    = panel.querySelector('#cNo').value.trim();
      const vade  = panel.querySelector('#cVade').value;
      if (!kisi||!tutar||!no||!vade) return bildirim('Zorunlu alanları doldurun','error');
      await ipc('cek:guncelle',{
        id, kisiAdi:kisi, tip:panel.querySelector('#cTip').value,
        tutar, cekNo:no, vadeTarihi:vade,
        banka:panel.querySelector('#cBanka').value,
        not:panel.querySelector('#cNot').value,
      });
      bildirim('Çek güncellendi!');
      document.querySelector('.modal-overlay')?.remove();
      cekler = await ipc('cek:liste');
      if (detayModu) renderDetay(id); else renderListe();
    });
  }

  function cekSil(id) {
    const c = cekler.find(x=>x.id===id);
    if (!c) return;
    modalAc('Çek Sil',
      `<p style="color:var(--color-text-primary);">Bu çek kaydını silmek istediğinizden emin misiniz?</p>
       <p style="margin-top:6px;font-size:12px;color:var(--color-text-secondary);">${c.kisiAdi} — ${fmtPara(c.tutar)} — Vade: ${fmtTarih(c.vadeTarihi)}</p>`,
      async () => {
        await ipc('cek:sil', id);
        bildirim('Çek silindi.');
        document.querySelector('.modal-overlay')?.remove();
        cekler = await ipc('cek:liste');
        renderListe();
      }, { kaydetLabel: 'Evet, Sil', tehlikeli: true });
  }

  renderListe();
}
