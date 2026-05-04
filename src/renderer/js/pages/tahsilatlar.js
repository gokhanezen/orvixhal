const { ipc, fmtPara, fmtTarih, bildirim, modalAc } = window;

export async function render(container) {
  const [musteriler, odemeler] = await Promise.all([
    ipc('musteri:liste'),
    ipc('odeme:liste', { tip: 'musteri_tahsilat' }),
  ]);

  function renderListe(filtreMusteriId = '', filtreDonem = '') {
    const bugun     = new Date().toISOString().slice(0,10);
    const haftaBas  = (() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10); })();
    const ayBas     = new Date().toISOString().slice(0,8)+'01';

    let liste = [...odemeler];
    if (filtreMusteriId) liste = liste.filter(o => o.musteriId === filtreMusteriId);
    if (filtreDonem === 'bugun')   liste = liste.filter(o => o.tarih === bugun);
    if (filtreDonem === 'hafta')   liste = liste.filter(o => o.tarih >= haftaBas);
    if (filtreDonem === 'ay')      liste = liste.filter(o => o.tarih >= ayBas);

    const toplamTahsilat = liste.reduce((t,o) => t+(o.tutar||0), 0);

    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Tahsilatlar</div>
        <button class="btn-primary" id="hizliTahsilatBtn" style="background:var(--green,#2D7A3A);">+ Hızlı Tahsilat Al</button>
      </div>
      <div class="p-20">

        <!-- İSTATİSTİKLER -->
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card">
            <div class="stat-label">Toplam Tahsilat</div>
            <div class="stat-val" style="color:var(--green,#2D7A3A);">${odemeler.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bugün</div>
            <div class="stat-val">${odemeler.filter(o=>o.tarih===bugun).length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Bu Ay Toplam</div>
            <div class="stat-val" style="color:var(--green,#2D7A3A);">
              ${fmtPara(odemeler.filter(o=>o.tarih>=ayBas).reduce((t,o)=>t+(o.tutar||0),0))}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Toplam Açık Bakiye</div>
            <div class="stat-val" style="color:var(--amber,#854F0B);">
              ${fmtPara(musteriler.reduce((t,m)=>t+(m.acikBakiye||0),0))}
            </div>
          </div>
        </div>

        <!-- FİLTRELER -->
        <div class="card" style="margin-bottom:14px;">
          <div class="card-body" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <select id="musteriFiltre" style="max-width:220px;">
              <option value="">Tüm müşteriler</option>
              ${musteriler.map(m=>`<option value="${m.id}" ${filtreMusteriId===m.id?'selected':''}>${m.ad}</option>`).join('')}
            </select>
            <div style="display:flex;gap:6px;">
              ${[['','Tümü'],['bugun','Bugün'],['hafta','Bu Hafta'],['ay','Bu Ay']]
                .map(([v,l])=>`<button class="btn-secondary donem-btn" data-val="${v}"
                  style="${filtreDonem===v?'background:#EAF3DE;color:#27500A;border-color:rgba(45,122,58,0.3);':''}">${l}</button>`).join('')}
            </div>
            <div style="margin-left:auto;font-weight:500;color:var(--green,#2D7A3A);">
              Toplam: ${fmtPara(toplamTahsilat)}
            </div>
          </div>
        </div>

        <!-- LİSTE -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-title">Tahsilat Hareketleri</div>
            <span class="pill pill-gray">${liste.length} kayıt</span>
          </div>
          ${liste.length === 0
            ? '<div class="bos-durum"><p>Tahsilat bulunamadı</p></div>'
            : `<div class="t-head" style="display:grid;grid-template-columns:110px 1fr 110px 90px 90px 1fr 60px;gap:8px;padding:9px 16px;">
                <div>Tahsilat No</div><div>Müşteri</div><div>Tutar</div><div>Tarih</div><div>Yöntem</div><div>Açıklama</div><div>Sil</div>
               </div>
               ${liste.map(o=>`
                 <div style="display:grid;grid-template-columns:110px 1fr 110px 90px 90px 1fr 60px;gap:8px;padding:11px 16px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                   <div style="font-family:monospace;font-size:11px;font-weight:500;">${o.odemeNo||'—'}</div>
                   <div style="font-weight:500;">${o.musteriAdi||'—'}</div>
                   <div style="font-weight:500;color:var(--green,#2D7A3A);">${fmtPara(o.tutar)}</div>
                   <div style="font-size:12px;">${fmtTarih(o.tarih)}</div>
                   <div>
                     <span class="pill ${o.odemeTipi==='nakit'?'pill-green':o.odemeTipi==='cek'?'pill-amber':'pill-blue'}">
                       ${o.odemeTipi==='nakit'?'Nakit':o.odemeTipi==='cek'?'Çek':'Havale'}
                     </span>
                   </div>
                   <div style="font-size:12px;color:var(--color-text-secondary);">${o.aciklama||'—'}</div>
                   <div>
                     <button class="btn-secondary sil-btn" data-id="${o.id}"
                       style="padding:3px 8px;font-size:11px;color:var(--red,#A32D2D);">Sil</button>
                   </div>
                 </div>`).join('')}`}
        </div>
      </div>`;

    // Event listeners
    document.getElementById('hizliTahsilatBtn').addEventListener('click', () => hizliTahsilat());

    document.getElementById('musteriFiltre').addEventListener('change', e => {
      renderListe(e.target.value, filtreDonem);
    });

    document.querySelectorAll('.donem-btn').forEach(btn => {
      btn.addEventListener('click', () => renderListe(filtreMusteriId, btn.dataset.val));
    });

    document.querySelectorAll('.sil-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modalAc('Tahsilat Sil',
          '<p>Bu tahsilat kaydını silmek istediğinizden emin misiniz?</p>',
          async () => {
            await ipc('odeme:sil', btn.dataset.id);
            bildirim('Tahsilat silindi.');
            document.querySelector('.modal-overlay')?.remove();
            odemeler.splice(odemeler.findIndex(o=>o.id===btn.dataset.id), 1);
            renderListe(filtreMusteriId, filtreDonem);
          }, { kaydetLabel: 'Evet, Sil', tehlikeli: true });
      });
    });
  }

  // ─── HIZLI TAHSİLAT MODAL ────────────────────────────────────────────────
  function hizliTahsilat() {
    const musteriOpts = musteriler.map(m => {
      const bakiye = m.acikBakiye || 0;
      return `<option value="${m.id}" data-ad="${m.ad}" data-bakiye="${bakiye}">
        ${m.ad}${bakiye > 0 ? ' — ' + fmtPara(bakiye) + ' açık' : ''}
      </option>`;
    }).join('');

    modalAc('Tahsilat Al', `
      <div style="margin-bottom:12px;">
        <div class="fs-11 text-muted mb-4">Müşteri *</div>
        <select id="thMusteri">
          <option value="">— Müşteri seçin —</option>${musteriOpts}
        </select>
        <div id="thBakiyeInfo" style="display:none;margin-top:6px;background:#EAF3DE;border-radius:7px;padding:8px 12px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:12px;color:#27500A;">Açık Bakiye</span>
            <span id="thBakiyeVal" style="font-weight:600;color:#A32D2D;"></span>
          </div>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div class="fs-11 text-muted mb-4">Tutar (₺) *</div>
        <input type="number" id="thTutar" min="0" step="0.01" placeholder="0.00">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <div class="fs-11 text-muted mb-4">Ödeme Yöntemi</div>
          <select id="thTip">
            <option value="nakit">Nakit</option>
            <option value="havale">Havale / EFT</option>
            <option value="cek">Çek</option>
          </select>
        </div>
        <div>
          <div class="fs-11 text-muted mb-4">Tarih</div>
          <input type="date" id="thTarih" value="${new Date().toISOString().slice(0,10)}">
        </div>
      </div>
      <div id="thCekAlanlar" style="display:none;background:var(--color-background-secondary,#F1EFE8);border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div><div class="fs-11 text-muted mb-4">Çek No</div><input type="text" id="thCekNo"></div>
          <div><div class="fs-11 text-muted mb-4">Vade</div><input type="date" id="thCekVade"></div>
        </div>
        <div><div class="fs-11 text-muted mb-4">Banka</div>
          <select id="thCekBanka"><option>Ziraat Bankası</option><option>Halkbank</option><option>İş Bankası</option><option>Garanti</option><option>Diğer</option></select>
        </div>
      </div>
      <div>
        <div class="fs-11 text-muted mb-4">Açıklama (opsiyonel)</div>
        <input type="text" id="thAciklama" placeholder="Fatura no veya not...">
      </div>`,
      async (panel) => {
        const musteriSel = panel.querySelector('#thMusteri');
        const musteriId  = musteriSel?.value;
        const musteriAdi = musteriSel?.options[musteriSel.selectedIndex]?.dataset?.ad;
        const tutar      = parseFloat(panel.querySelector('#thTutar').value);
        if (!musteriId) return bildirim('Müşteri seçin', 'error');
        if (!tutar || tutar <= 0) return bildirim('Geçerli tutar girin', 'error');
        const tip = panel.querySelector('#thTip').value;
        await ipc('odeme:musteriTahsilat', {
          musteriId, musteriAdi, tutar,
          odemeTipi:  tip,
          tarih:      panel.querySelector('#thTarih').value,
          aciklama:   panel.querySelector('#thAciklama').value,
          cekNo:      tip==='cek' ? panel.querySelector('#thCekNo')?.value  : null,
          cekVade:    tip==='cek' ? panel.querySelector('#thCekVade')?.value : null,
          cekBanka:   tip==='cek' ? panel.querySelector('#thCekBanka')?.value: null,
        });
        bildirim(`${fmtPara(tutar)} tahsilat alındı!`);
        document.querySelector('.modal-overlay')?.remove();
        // Listeyi yenile
        const yeniOdemeler = await ipc('odeme:liste', { tip: 'musteri_tahsilat' });
        odemeler.length = 0;
        odemeler.push(...yeniOdemeler);
        const yeniMusteriler = await ipc('musteri:liste');
        musteriler.length = 0;
        musteriler.push(...yeniMusteriler);
        renderListe();
      }, { kaydetLabel: 'Tahsilatı Kaydet' });

    // Müşteri seçince bakiye göster
    setTimeout(() => {
      document.getElementById('thMusteri')?.addEventListener('change', e => {
        const sel    = e.target;
        const bakiye = parseFloat(sel.options[sel.selectedIndex]?.dataset?.bakiye) || 0;
        const info   = document.getElementById('thBakiyeInfo');
        if (sel.value && bakiye > 0) {
          document.getElementById('thBakiyeVal').textContent = fmtPara(bakiye);
          document.getElementById('thTutar').value           = bakiye;
          info.style.display = 'block';
        } else {
          info.style.display = 'none';
        }
      });
      document.getElementById('thTip')?.addEventListener('change', e => {
        document.getElementById('thCekAlanlar').style.display =
          e.target.value === 'cek' ? 'block' : 'none';
      });
    }, 60);
  }

  renderListe();
}
