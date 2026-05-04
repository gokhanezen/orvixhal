const { ipc, fmtPara, fmtTarih, durumPill, bildirim, sayfaGit, modalAc } = window;

export async function render(container) {
  let musteriler = await ipc('musteri:liste');

  // ─── LİSTE ────────────────────────────────────────────────────────────────
  function renderListe() {
    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Müşteriler</div>
        <input type="text" id="musteriArama" placeholder="İsim, telefon veya tür ara..." style="max-width:240px;">
        <button class="btn-primary" id="yeniMusteriBtn">+ Yeni Müşteri</button>
      </div>
      <div class="p-20">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card"><div class="stat-label">Toplam Müşteri</div><div class="stat-val">${musteriler.length}</div></div>
          <div class="stat-card">
            <div class="stat-label">Toplam Açık Bakiye</div>
            <div class="stat-val" style="color:var(--amber,#854F0B);">
              ${fmtPara(musteriler.reduce((t,m)=>t+(m.acikBakiye||0),0))}
            </div>
          </div>
          <div class="stat-card"><div class="stat-label">Marketler</div><div class="stat-val">${musteriler.filter(m=>m.tur==='Market').length}</div></div>
          <div class="stat-card"><div class="stat-label">Otel / Restoran</div><div class="stat-val">${musteriler.filter(m=>['Otel','Restoran'].includes(m.tur)).length}</div></div>
        </div>
        <div class="card" id="musteriKart">${renderListeIcerik(musteriler)}</div>
      </div>`;

    document.getElementById('yeniMusteriBtn').addEventListener('click', yeniMusteri);
    document.getElementById('musteriArama').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const f = musteriler.filter(m => m.ad?.toLowerCase().includes(q) || m.tel?.includes(q) || m.tur?.toLowerCase().includes(q));
      document.getElementById('musteriKart').innerHTML = renderListeIcerik(f);
      bagla();
    });
    bagla();
  }

  function renderListeIcerik(liste) {
    if (!liste.length) return '<div class="bos-durum"><p>Müşteri bulunamadı</p></div>';
    return `
      <div class="t-head" style="display:grid;grid-template-columns:28px 1fr 90px 110px 100px 110px;gap:10px;padding:9px 16px;">
        <div></div><div>Müşteri / İşletme</div><div>Tür</div><div>Telefon</div><div>Açık Bakiye</div><div>İşlemler</div>
      </div>
      ${liste.map(m => {
        const av = (m.ad||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `
        <div class="t-row musteri-satir" data-id="${m.id}"
             style="display:grid;grid-template-columns:28px 1fr 90px 110px 100px 110px;gap:10px;padding:11px 16px;cursor:pointer;">
          <div style="align-self:center;">
            <div style="width:28px;height:28px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#27500A;">${av}</div>
          </div>
          <div>
            <div class="fw-500">${m.ad}</div>
            <div class="text-hint fs-11">${m.adres||'—'}</div>
          </div>
          <div style="align-self:center;"><span class="pill pill-gray">${m.tur||'Diğer'}</span></div>
          <div style="align-self:center;font-size:12px;">${m.tel||'—'}</div>
          <div style="align-self:center;font-weight:500;color:${(m.acikBakiye||0)>0?'var(--amber,#854F0B)':'var(--green,#2D7A3A)'};">
            ${fmtPara(m.acikBakiye||0)}
          </div>
          <div style="align-self:center;display:flex;gap:4px;" onclick="event.stopPropagation()">
            <button class="btn-secondary btn-duzenle" data-id="${m.id}" style="padding:3px 9px;font-size:11px;">Düzenle</button>
            <button class="btn-secondary btn-sil" data-id="${m.id}" style="padding:3px 9px;font-size:11px;color:var(--red,#A32D2D);">Sil</button>
          </div>
        </div>`}).join('')}`;
  }

  function bagla() {
    document.querySelectorAll('.musteri-satir').forEach(row =>
      row.addEventListener('click', () => renderDetay(row.dataset.id)));
    document.querySelectorAll('.btn-duzenle').forEach(btn =>
      btn.addEventListener('click', () => duzenle(btn.dataset.id)));
    document.querySelectorAll('.btn-sil').forEach(btn =>
      btn.addEventListener('click', () => sil(btn.dataset.id)));
  }

  // ─── DETAY + CARİ HESAP ───────────────────────────────────────────────────
  async function renderDetay(id) {
    const m    = musteriler.find(x => x.id === id);
    if (!m) return;
    const cari = await ipc('musteri:cari', id);
    const av   = (m.ad||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    container.innerHTML = `
      <div class="topbar">
        <button class="btn-secondary" id="detayGeriBtn">← Müşteriler</button>
        <div class="topbar-title">${m.ad}</div>
        <button class="btn-secondary" id="detayEkstreBtn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="1" width="11" height="11" rx="1"/><path d="M3 4h7M3 6h7M3 8h4"/></svg>
          Ekstre
        </button>
        <button class="btn-primary" id="detayTahsilatBtn" style="background:var(--green,#2D7A3A);">+ Tahsilat Al</button>
        <button class="btn-secondary" id="detayYeniSatisBtn">+ Yeni Satış</button>
      </div>

      <div class="p-20">
        <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;">

          <!-- SOL -->
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="card">
              <div class="card-body">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:0.5px solid var(--color-border-tertiary);">
                  <div style="width:52px;height:52px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#27500A;flex-shrink:0;">${av}</div>
                  <div>
                    <div style="font-size:17px;font-weight:500;">${m.ad}</div>
                    <span class="pill pill-gray" style="margin-top:3px;">${m.tur||'Diğer'}</span>
                  </div>
                </div>
                ${[['Telefon',m.tel||'—'],['Adres',m.adres||'—'],['Not',m.not||'—'],['Kayıt',fmtTarih(m.olusturma)]]
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
                  ['Toplam Satış',   fmtPara(cari.satisToplam),  'inherit'],
                  ['Tahsilat',       fmtPara(cari.tahsilat),      'var(--green,#2D7A3A)'],
                  ['Satış Adedi',    (cari.satislar||[]).length + ' fatura', 'inherit'],
                ].map(([k,v,c])=>`
                  <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                    <span style="font-size:12px;color:var(--color-text-secondary);">${k}</span>
                    <span style="font-weight:500;color:${c};">${v}</span>
                  </div>`).join('')}
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--color-border-tertiary);margin-top:4px;">
                  <span style="font-weight:500;">Açık Bakiye</span>
                  <span style="font-size:22px;font-weight:600;color:${cari.acikBakiye>0?'var(--red,#A32D2D)':'var(--green,#2D7A3A)'};">${fmtPara(cari.acikBakiye)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SAĞ: SEKMELER -->
          <div class="card">
            <div class="card-head" style="padding:0;overflow:hidden;">
              <div style="display:flex;border-bottom:0.5px solid var(--color-border-tertiary);">
                <button class="cari-tab aktif-tab" data-tab="satislar"
                  style="padding:12px 18px;border:none;background:#EAF3DE;cursor:pointer;font-size:13px;font-weight:500;color:#27500A;border-bottom:2px solid #2D7A3A;font-family:inherit;">
                  Satışlar (${(cari.satislar||[]).length})
                </button>
                <button class="cari-tab" data-tab="odemeler"
                  style="padding:12px 18px;border:none;background:transparent;cursor:pointer;font-size:13px;color:var(--color-text-secondary);font-family:inherit;">
                  Tahsilatlar (${(cari.odemeler||[]).length})
                </button>
              </div>
            </div>

            <!-- SATIŞLAR -->
            <div id="tab-satislar">
              ${!(cari.satislar||[]).length
                ? '<div class="bos-durum"><p>Satış bulunamadı</p></div>'
                : `<div class="t-head" style="display:grid;grid-template-columns:110px 90px 110px 90px 80px 80px;gap:8px;padding:9px 16px;">
                    <div>Fatura No</div><div>Tarih</div><div>Tutar</div><div>Ödeme</div><div>Durum</div><div>İşlem</div>
                   </div>
                   ${cari.satislar.map(s=>`
                     <div style="display:grid;grid-template-columns:110px 90px 110px 90px 80px 80px;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                       <div style="font-family:monospace;font-size:12px;font-weight:500;">${s.faturaNo}</div>
                       <div style="font-size:12px;">${fmtTarih(s.tarih)}</div>
                       <div style="font-weight:500;color:var(--green,#2D7A3A);">${fmtPara(s.genelToplam)}</div>
                       <div style="font-size:12px;">${s.odemeTipi||'—'}</div>
                       <div>${durumPill(s.odenmeDurumu)}</div>
                       <div>${s.odenmeDurumu!=='odendi'
                         ?`<button class="btn-secondary satis-odendi" data-id="${s.id}" style="padding:3px 7px;font-size:11px;color:var(--green,#2D7A3A);">Ödendi</button>`
                         :''}
                       </div>
                     </div>`).join('')}`}
            </div>

            <!-- TAHSİLATLAR -->
            <div id="tab-odemeler" style="display:none;">
              ${!(cari.odemeler||[]).length
                ? '<div class="bos-durum"><p>Tahsilat kaydı bulunamadı</p></div>'
                : `<div class="t-head" style="display:grid;grid-template-columns:110px 90px 110px 90px 1fr 60px;gap:8px;padding:9px 16px;">
                    <div>Tahsilat No</div><div>Tarih</div><div>Tutar</div><div>Ödeme</div><div>Açıklama</div><div>Sil</div>
                   </div>
                   ${cari.odemeler.map(o=>`
                     <div style="display:grid;grid-template-columns:110px 90px 110px 90px 1fr 60px;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                       <div style="font-family:monospace;font-size:12px;font-weight:500;">${o.odemeNo}</div>
                       <div style="font-size:12px;">${fmtTarih(o.tarih)}</div>
                       <div style="font-weight:500;color:var(--green,#2D7A3A);">${fmtPara(o.tutar)}</div>
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
        document.querySelectorAll('.cari-tab').forEach(b => {
          b.style.background   = 'transparent';
          b.style.color        = 'var(--color-text-secondary)';
          b.style.borderBottom = 'none';
        });
        btn.style.background   = '#EAF3DE';
        btn.style.color        = '#27500A';
        btn.style.borderBottom = '2px solid #2D7A3A';
        document.getElementById('tab-satislar').style.display  = btn.dataset.tab==='satislar'?'block':'none';
        document.getElementById('tab-odemeler').style.display  = btn.dataset.tab==='odemeler'?'block':'none';
      });
    });

    // Satış ödendi
    document.querySelectorAll('.satis-odendi').forEach(btn =>
      btn.addEventListener('click', async () => {
        await ipc('satis:guncelle', { id: btn.dataset.id, odenmeDurumu: 'odendi' });
        bildirim('Ödendi işaretlendi!');
        renderDetay(id);
      }));

    // Tahsilat sil
    document.querySelectorAll('.odeme-sil').forEach(btn =>
      btn.addEventListener('click', async () => {
        await ipc('odeme:sil', btn.dataset.id);
        bildirim('Tahsilat silindi.');
        renderDetay(id);
      }));

    document.getElementById('detayGeriBtn').addEventListener('click', async () => {
      musteriler = await ipc('musteri:liste');
      renderListe();
    });
    document.getElementById('detayYeniSatisBtn').addEventListener('click', () => sayfaGit('satislar','yeni'));
    document.getElementById('detayTahsilatBtn').addEventListener('click', () => tahsilatModal(m, cari.acikBakiye, id));
    document.getElementById('detayEkstreBtn').addEventListener('click', () => ekstreModal(m, cari));
  }

  // ─── TAHSİLAT MODAL ───────────────────────────────────────────────────────
  function tahsilatModal(m, acikBakiye, id) {
    modalAc('Tahsilat Al — ' + m.ad, `
      <div style="background:#EAF3DE;border-radius:8px;padding:10px 12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#27500A;">Açık Bakiye</span>
        <span style="font-size:18px;font-weight:600;color:${acikBakiye>0?'#A32D2D':'#2D7A3A'};">${fmtPara(acikBakiye)}</span>
      </div>
      <div style="margin-bottom:12px;">
        <div class="fs-11 text-muted mb-4">Tahsilat Tutarı (₺) *</div>
        <input type="number" id="tTutar" value="${acikBakiye||''}" min="0" step="0.01" placeholder="0">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <div class="fs-11 text-muted mb-4">Ödeme Yöntemi</div>
          <select id="tTip">
            <option value="nakit">Nakit</option>
            <option value="havale">Havale / EFT</option>
            <option value="cek">Çek</option>
          </select>
        </div>
        <div>
          <div class="fs-11 text-muted mb-4">Tarih</div>
          <input type="date" id="tTarih" value="${new Date().toISOString().slice(0,10)}">
        </div>
      </div>
      <div id="cekAlanlar" style="display:none;background:var(--color-background-secondary,#F1EFE8);border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div><div class="fs-11 text-muted mb-4">Çek No</div><input type="text" id="tCekNo"></div>
          <div><div class="fs-11 text-muted mb-4">Vade</div><input type="date" id="tCekVade"></div>
        </div>
        <div><div class="fs-11 text-muted mb-4">Banka</div>
          <select id="tCekBanka"><option>Ziraat Bankası</option><option>Halkbank</option><option>İş Bankası</option><option>Garanti</option><option>Diğer</option></select>
        </div>
      </div>
      <div>
        <div class="fs-11 text-muted mb-4">Açıklama (opsiyonel)</div>
        <input type="text" id="tAciklama" placeholder="Fatura no veya not...">
      </div>`,
      async (panel) => {
        const tutar = parseFloat(panel.querySelector('#tTutar').value);
        if (!tutar || tutar <= 0) return bildirim('Geçerli bir tutar girin', 'error');
        const tip = panel.querySelector('#tTip').value;
        await ipc('odeme:musteriTahsilat', {
          musteriId:  m.id,
          musteriAdi: m.ad,
          tutar,
          odemeTipi:  tip,
          tarih:      panel.querySelector('#tTarih').value,
          aciklama:   panel.querySelector('#tAciklama').value,
          cekNo:      tip==='cek' ? panel.querySelector('#tCekNo')?.value : null,
          cekVade:    tip==='cek' ? panel.querySelector('#tCekVade')?.value : null,
          cekBanka:   tip==='cek' ? panel.querySelector('#tCekBanka')?.value : null,
        });
        bildirim(`₺${tutar.toLocaleString('tr-TR')} tahsilat alındı!`);
        document.querySelector('.modal-overlay')?.remove();
        musteriler = await ipc('musteri:liste');
        renderDetay(id);
      }, { kaydetLabel: 'Tahsilatı Kaydet' });

    // Çek alanları toggle
    setTimeout(() => {
      document.getElementById('tTip')?.addEventListener('change', e => {
        document.getElementById('cekAlanlar').style.display = e.target.value==='cek' ? 'block' : 'none';
      });
    }, 60);
  }

  // ─── FORM: YENİ / DÜZENLE ─────────────────────────────────────────────────
  function musteriFormu(m = {}) {
    return `
      <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Ad / İşletme Adı *</div>
        <input type="text" id="mAd" value="${m.ad||''}" placeholder="Afacan Market"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Telefon</div><input type="text" id="mTel" value="${m.tel||''}"></div>
        <div><div class="fs-11 text-muted mb-4">Tür</div>
          <select id="mTur">${['Market','Otel','Restoran','Büfe','Manav','Diğer'].map(t=>`<option ${m.tur===t?'selected':''}>${t}</option>`).join('')}</select>
        </div>
      </div>
      <div style="margin-bottom:12px;"><div class="fs-11 text-muted mb-4">Adres</div>
        <textarea id="mAdres" style="min-height:58px;">${m.adres||''}</textarea></div>
      <div><div class="fs-11 text-muted mb-4">Not</div><input type="text" id="mNot" value="${m.not||''}"></div>`;
  }

  function yeniMusteri() {
    modalAc('Yeni Müşteri Ekle', musteriFormu(), async (panel) => {
      const ad = panel.querySelector('#mAd').value.trim();
      if (!ad) return bildirim('Ad zorunludur', 'error');
      await ipc('musteri:ekle', { ad, tel: panel.querySelector('#mTel').value.trim(), tur: panel.querySelector('#mTur').value, adres: panel.querySelector('#mAdres').value.trim(), not: panel.querySelector('#mNot').value.trim() });
      bildirim('Müşteri eklendi!');
      document.querySelector('.modal-overlay')?.remove();
      musteriler = await ipc('musteri:liste');
      renderListe();
    });
  }

  function duzenle(id, detayModu=false) {
    const m = musteriler.find(x=>x.id===id);
    if (!m) return;
    modalAc('Müşteri Düzenle', musteriFormu(m), async (panel) => {
      const ad = panel.querySelector('#mAd').value.trim();
      if (!ad) return bildirim('Ad zorunludur', 'error');
      await ipc('musteri:guncelle', { id, ad, tel: panel.querySelector('#mTel').value.trim(), tur: panel.querySelector('#mTur').value, adres: panel.querySelector('#mAdres').value.trim(), not: panel.querySelector('#mNot').value.trim() });
      bildirim('Müşteri güncellendi!');
      document.querySelector('.modal-overlay')?.remove();
      musteriler = await ipc('musteri:liste');
      if (detayModu) renderDetay(id); else renderListe();
    });
  }

  function sil(id) {
    const m = musteriler.find(x=>x.id===id);
    if (!m) return;
    modalAc('Müşteriyi Sil',
      `<p style="color:var(--color-text-primary);">"<strong>${m.ad}</strong>" müşterisini silmek istediğinizden emin misiniz?</p>
       <p style="margin-top:8px;font-size:12px;color:var(--red,#A32D2D);">Bu işlem geri alınamaz.</p>`,
      async () => {
        await ipc('musteri:sil', id);
        bildirim('Müşteri silindi.');
        document.querySelector('.modal-overlay')?.remove();
        musteriler = await ipc('musteri:liste');
        renderListe();
      }, { kaydetLabel: 'Evet, Sil', tehlikeli: true });
  }

  // ─── EKSTRe MODAL ────────────────────────────────────────────────────────
  function ekstreModal(m, cari) {
    const ayarlar = ipc('ayar:oku');
    ayarlar.then(ayar => {
      // Tüm hareketleri tarihe göre sırala
      const satirlar = [
        ...( cari.satislar||[]).map(s=>({
          tarih:  s.tarih,
          tip:    'Satış',
          aciklama: s.faturaNo + (s.odemeTipi?' ('+s.odemeTipi+')':''),
          borc:   s.genelToplam||0,
          alacak: 0,
        })),
        ...(cari.odemeler||[]).map(o=>({
          tarih:   o.tarih,
          tip:     'Tahsilat',
          aciklama: o.odemeNo + (o.aciklama?' - '+o.aciklama:''),
          borc:    0,
          alacak:  o.tutar||0,
        })),
      ].sort((a,b) => a.tarih?.localeCompare(b.tarih));

      let bakiye = 0;
      const satirHtml = satirlar.map(s => {
        bakiye += s.borc - s.alacak;
        return `<tr>
          <td>${new Date(s.tarih).toLocaleDateString('tr-TR')}</td>
          <td><span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:${s.tip==='Satış'?'#FAEEDA':'#EAF3DE'};color:${s.tip==='Satış'?'#854F0B':'#27500A'};">${s.tip}</span></td>
          <td>${s.aciklama}</td>
          <td style="text-align:right;">${s.borc>0?s.borc.toLocaleString('tr-TR',{minimumFractionDigits:2}):'—'}</td>
          <td style="text-align:right;color:#2D7A3A;">${s.alacak>0?s.alacak.toLocaleString('tr-TR',{minimumFractionDigits:2}):'—'}</td>
          <td style="text-align:right;font-weight:600;color:${bakiye>0?'#A32D2D':'#2D7A3A'};">${bakiye.toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
        </tr>`;
      }).join('');

      const ekstre = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8">
<style>
  @page{margin:15mm;} *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',sans-serif;font-size:12px;color:#1a1a1a;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #2D7A3A;}
  .firma{font-size:18px;font-weight:700;color:#2D7A3A;margin-bottom:4px;}
  .baslik{font-size:14px;font-weight:600;margin-bottom:6px;}
  .ozet{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
  .ozet-kart{background:#F7F9F7;border:0.5px solid #ddd;border-radius:6px;padding:10px;}
  .ozet-label{font-size:10px;color:#666;text-transform:uppercase;margin-bottom:3px;}
  .ozet-val{font-size:16px;font-weight:700;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}
  th{background:#2D7A3A;color:#fff;padding:7px 10px;text-align:left;font-size:11px;}
  td{padding:6px 10px;border-bottom:0.5px solid #eee;}
  tr:nth-child(even) td{background:#F9F9F9;}
  .footer{text-align:center;color:#999;font-size:10px;margin-top:12px;}
</style>
</head><body>
<div class="header">
  <div>
    <div class="firma">${ayar.firmaAdi||'OrvixHal'}</div>
    <div style="font-size:11px;color:#666;">${ayar.firmaAdres||''} ${ayar.firmaTel?'· '+ayar.firmaTel:''}</div>
  </div>
  <div style="text-align:right;">
    <div class="baslik">MÜŞTERİ EKSTRESİ</div>
    <div style="font-size:13px;font-weight:600;">${m.ad}</div>
    <div style="font-size:11px;color:#666;">${m.tel||''}</div>
    <div style="font-size:11px;color:#666;">Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
  </div>
</div>
<div class="ozet">
  <div class="ozet-kart">
    <div class="ozet-label">Toplam Satış</div>
    <div class="ozet-val" style="color:#854F0B;">₺${cari.satisToplam.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
  </div>
  <div class="ozet-kart">
    <div class="ozet-label">Toplam Tahsilat</div>
    <div class="ozet-val" style="color:#2D7A3A;">₺${cari.tahsilat.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
  </div>
  <div class="ozet-kart">
    <div class="ozet-label">Açık Bakiye</div>
    <div class="ozet-val" style="color:${cari.acikBakiye>0?'#A32D2D':'#2D7A3A'};">₺${cari.acikBakiye.toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th>Tarih</th><th>Tür</th><th>Açıklama</th><th style="text-align:right;">Borç (₺)</th><th style="text-align:right;">Alacak (₺)</th><th style="text-align:right;">Bakiye (₺)</th>
  </tr></thead>
  <tbody>${satirHtml}</tbody>
</table>
<div style="text-align:right;font-weight:700;font-size:14px;border-top:2px solid #2D7A3A;padding-top:8px;">
  Toplam Açık Bakiye: <span style="color:${cari.acikBakiye>0?'#A32D2D':'#2D7A3A'};">₺${cari.acikBakiye.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
</div>
<div class="footer">OrvixHal Toptancı Yönetim Sistemi — ${new Date().toLocaleString('tr-TR')}</div>
</body></html>`;

      // Yeni pencerede yazdır
      const w = window.open('', '_blank', 'width=900,height=700');
      w.document.write(ekstre);
      w.document.close();
      setTimeout(() => w.print(), 500);
    });
  }

  renderListe();
}
