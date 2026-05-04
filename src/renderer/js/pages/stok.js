const { ipc, fmtPara, fmtTarih, bildirim, modalAc } = window;

export async function render(container) {
  let stok    = await ipc('stok:liste');
  let urunler = await ipc('stok:urunler');

  function durumBadge(s) {
    if ((s.miktar||0) <= 0)                        return '<span class="pill pill-red">Tükendi</span>';
    if ((s.miktar||0) <= (s.kritikSeviye||20))     return '<span class="pill pill-red">Kritik</span>';
    if ((s.miktar||0) <= (s.kritikSeviye||20) * 2) return '<span class="pill pill-amber">Az</span>';
    return '<span class="pill pill-green">İyi</span>';
  }

  function renderListe() {
    const kritikSayi  = stok.filter(s=>(s.miktar||0)<=(s.kritikSeviye||20)).length;
    const toplamDeger = stok.reduce((t,s)=>t+(s.miktar||0)*(s.sonAlimFiyati||0),0);

    container.innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Stok Durumu</div>
        <input type="text" id="stokArama" placeholder="Ürün ara..." style="max-width:200px;">
        <button class="btn-secondary" id="urunListesiBtn">Ürün Listesi Yönet</button>
        <button class="btn-primary" id="yeniUrunBtn">+ Stok Ekle</button>
      </div>
      <div class="p-20">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card"><div class="stat-label">Toplam Ürün</div><div class="stat-val">${stok.length}</div></div>
          <div class="stat-card">
            <div class="stat-label">Kritik / Tükenen</div>
            <div class="stat-val" style="color:var(--red,#A32D2D);">${kritikSayi}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Stok Değeri</div>
            <div class="stat-val" style="color:var(--green,#2D7A3A);">${fmtPara(toplamDeger)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">İyi Durumda</div>
            <div class="stat-val">${stok.filter(s=>(s.miktar||0)>(s.kritikSeviye||20)*2).length}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="card-head-title">Ürün Listesi</div>
            <span style="font-size:11px;color:var(--color-text-secondary);">Detay için satıra tıklayın</span>
          </div>
          <div id="stokListe">${renderListeIcerik(stok)}</div>
        </div>
      </div>`;

    document.getElementById('yeniUrunBtn').addEventListener('click', yeniUrun);
    document.getElementById('urunListesiBtn').addEventListener('click', urunListesiYonet);
    document.getElementById('stokArama').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const f = stok.filter(s => s.urunAdi?.toLowerCase().includes(q));
      document.getElementById('stokListe').innerHTML = renderListeIcerik(f);
      bagla();
    });
    bagla();
  }

  function renderListeIcerik(liste) {
    if (!liste.length) return '<div class="bos-durum"><p>Ürün bulunamadı</p></div>';
    return `
      <div class="t-head" style="display:grid;grid-template-columns:1fr 70px 100px 110px 110px 80px 80px;gap:8px;padding:9px 16px;">
        <div>Ürün</div><div>Birim</div><div>Stok</div><div>Kritik Seviye</div><div>Son Alış</div><div>Durum</div><div>İşlem</div>
      </div>
      ${liste.map(s => `
        <div class="t-row stok-satir" data-id="${s.id}"
             style="display:grid;grid-template-columns:1fr 70px 100px 110px 110px 80px 80px;gap:8px;padding:11px 16px;cursor:pointer;">
          <div style="align-self:center;font-weight:500;">${s.urunAdi}</div>
          <div style="align-self:center;font-size:12px;">${s.birim||'kg'}</div>
          <div style="align-self:center;font-weight:500;font-size:15px;
                      color:${(s.miktar||0)<=(s.kritikSeviye||20)?'var(--red,#A32D2D)':'inherit'};">
            ${s.miktar||0}
          </div>
          <div style="align-self:center;font-size:12px;color:var(--color-text-secondary);">${s.kritikSeviye||20}</div>
          <div style="align-self:center;font-size:12px;">${s.sonAlimFiyati?fmtPara(s.sonAlimFiyati):'—'}</div>
          <div style="align-self:center;">${durumBadge(s)}</div>
          <div style="align-self:center;" onclick="event.stopPropagation()">
            <button class="btn-secondary btn-duzenle" data-id="${s.id}" style="padding:3px 9px;font-size:11px;">Düzenle</button>
          </div>
        </div>`).join('')}`;
  }

  function bagla() {
    document.querySelectorAll('.stok-satir').forEach(row =>
      row.addEventListener('click', () => renderDetay(row.dataset.id)));
    document.querySelectorAll('.btn-duzenle').forEach(btn =>
      btn.addEventListener('click', () => duzenle(btn.dataset.id)));
  }

  // ─── DETAY ────────────────────────────────────────────────────────────────
  function renderDetay(id) {
    const s     = stok.find(x => x.id === id);
    if (!s) return;
    const deger = (s.miktar||0) * (s.sonAlimFiyati||0);
    const maks  = (s.kritikSeviye||20) * 3;
    const pct   = maks > 0 ? Math.min(100, Math.round((s.miktar||0) / maks * 100)) : 100;
    const barRenk = (s.miktar||0) <= (s.kritikSeviye||20)
      ? '#A32D2D' : (s.miktar||0) <= (s.kritikSeviye||20)*2 ? '#854F0B' : '#2D7A3A';

    container.innerHTML = `
      <div class="topbar">
        <button class="btn-secondary" id="detayGeriBtn">← Stok</button>
        <div class="topbar-title">${s.urunAdi}</div>
        <button class="btn-secondary" id="detayDuzenleBtn">Düzenle</button>
      </div>
      <div class="p-20" style="max-width:700px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          ${[
            ['Mevcut Stok',    s.miktar||0, (s.miktar||0)<=(s.kritikSeviye||20)?'var(--red,#A32D2D)':'var(--green,#2D7A3A)', s.birim||'kg'],
            ['Kritik Seviye',  s.kritikSeviye||20, 'var(--amber,#854F0B)', s.birim||'kg'],
            ['Son Alış Fiyatı',s.sonAlimFiyati?fmtPara(s.sonAlimFiyati):'—', '#111', ''],
            ['Tahmini Değer',  fmtPara(deger), 'var(--blue,#185FA5)', ''],
          ].map(([lbl,val,clr,birim]) => `
            <div class="card">
              <div class="card-body" style="text-align:center;padding:20px;">
                <div style="font-size:11px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${lbl}</div>
                <div style="font-size:32px;font-weight:600;color:${clr};">${val}</div>
                ${birim?`<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">${birim}</div>`:''}
              </div>
            </div>`).join('')}
        </div>
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head"><div class="card-head-title">Stok Durumu</div>${durumBadge(s)}</div>
          <div class="card-body">
            <div style="background:var(--color-background-secondary,#F1EFE8);border-radius:6px;height:12px;overflow:hidden;margin-bottom:8px;">
              <div style="height:100%;width:${pct}%;background:${barRenk};border-radius:6px;transition:width 0.3s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-secondary);">
              <span>0</span>
              <span>Kritik: ${s.kritikSeviye||20} ${s.birim||'kg'}</span>
              <span>Hedef: ${maks} ${s.birim||'kg'}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-head-title">Ürün Bilgileri</div></div>
          <div class="card-body">
            ${[['Ürün Adı',s.urunAdi],['Birim',s.birim||'kg'],['Son Güncelleme',fmtTarih(s.guncelleme||s.olusturma)||'—']]
              .map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
                <span style="font-size:12px;color:var(--color-text-secondary);">${k}</span><span style="font-weight:500;">${v}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    document.getElementById('detayGeriBtn').addEventListener('click', () => renderListe());
    document.getElementById('detayDuzenleBtn').addEventListener('click', () => duzenle(id, true));
  }

  // ─── ÜRÜN LİSTESİ YÖNETİMİ ───────────────────────────────────────────────
  function urunListesiYonet() {
    const icerik = `
      <div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:500;color:var(--color-text-secondary);margin-bottom:8px;">Yeni Ürün Ekle</div>
        <div style="display:grid;grid-template-columns:1fr 120px auto;gap:8px;align-items:end;">
          <div>
            <div class="fs-11 text-muted mb-4">Ürün Adı *</div>
            <input type="text" id="yeniUrunAdi" placeholder="Domates, Elma...">
          </div>
          <div>
            <div class="fs-11 text-muted mb-4">KDV %</div>
            <input type="number" id="yeniUrunKdv" value="1" min="0" max="100" step="0.5" placeholder="1">
          </div>
          <button class="btn-primary" id="urunEkleBtn2" style="height:36px;white-space:nowrap;">+ Ekle</button>
        </div>
        <div id="urunEkleHata" style="color:var(--red,#A32D2D);font-size:12px;margin-top:4px;display:none;"></div>
      </div>
      <div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:6px;">
        Mevcut Ürün Listesi (${urunler.length} ürün) — KDV oranlarını düzenleyebilirsiniz
      </div>
      <div id="urunListesiDiv" style="max-height:320px;overflow-y:auto;border:0.5px solid var(--color-border-secondary);border-radius:8px;">
        <div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;padding:7px 12px;background:var(--color-background-secondary,#F1EFE8);font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;border-bottom:0.5px solid var(--color-border-tertiary);">
          <div>Ürün Adı</div><div style="text-align:center;">KDV %</div><div></div>
        </div>
        ${urunler.map(u => {
          const ad  = typeof u === 'string' ? u : u.ad;
          const kdv = typeof u === 'string' ? 1  : (u.kdv ?? 1);
          return `
          <div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;padding:8px 12px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
            <span style="font-size:13px;">${ad}</span>
            <div>
              <input type="number" class="kdv-input" data-urun="${ad}" value="${kdv}"
                min="0" max="100" step="0.5"
                style="width:100%;padding:4px 6px;font-size:12px;text-align:center;">
            </div>
            <div style="text-align:right;">
              <button class="urun-sil-btn" data-urun="${ad}"
                style="padding:3px 8px;border-radius:5px;border:0.5px solid rgba(163,45,45,0.3);
                       background:#FCEBEB;color:#A32D2D;cursor:pointer;font-size:11px;">Sil</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--color-text-tertiary);">
        💡 KDV oranını değiştirince otomatik kaydedilir. Meyve/sebze için %1, sanayi için %18 vb.
      </div>`;

    modalAc('Ürün Listesi & KDV Yönetimi', icerik, null, { kaydetLabel: 'Kapat' });

    setTimeout(() => {
      // KDV değişince kaydet
      document.querySelectorAll('.kdv-input').forEach(input => {
        input.addEventListener('change', async () => {
          const ad  = input.dataset.urun;
          const kdv = parseFloat(input.value) || 0;
          urunler = await ipc('stok:urunGuncelle', ad, kdv);
          bildirim(`${ad} KDV güncellendi: %${kdv}`);
        });
      });

      document.getElementById('urunEkleBtn2')?.addEventListener('click', async () => {
        const ad   = document.getElementById('yeniUrunAdi')?.value.trim();
        const kdv  = parseFloat(document.getElementById('yeniUrunKdv')?.value) || 0;
        const hata = document.getElementById('urunEkleHata');
        hata.style.display = 'none';
        try {
          urunler = await ipc('stok:urunEkle', { ad, kdv });
          bildirim(`"${ad}" ürün listesine eklendi! (KDV: %${kdv})`);
          document.querySelector('.modal-overlay')?.remove();
          urunListesiYonet();
        } catch(e) {
          hata.textContent = e.message;
          hata.style.display = 'block';
        }
      });

      document.getElementById('yeniUrunAdi')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('urunEkleBtn2')?.click();
      });

      document.querySelectorAll('.urun-sil-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ad = btn.dataset.urun;
          if (!confirm(`"${ad}" ürünü listeden kaldırılsın mı?`)) return;
          urunler = await ipc('stok:urunSil', ad);
          bildirim(`"${ad}" listeden kaldırıldı.`);
          document.querySelector('.modal-overlay')?.remove();
          urunListesiYonet();
        });
      });
    }, 80);
  }

  // ─── FORM: YENİ / DÜZENLE ─────────────────────────────────────────────────
  function yeniUrun() {
    const urunOpts = urunler.map(u => {
      const ad = typeof u === 'string' ? u : u.ad;
      return `<option value="${ad}">${ad}</option>`;
    }).join('');
    modalAc('Yeni Stok Girişi', `
      <div style="margin-bottom:12px;">
        <div class="fs-11 text-muted mb-4">Ürün Adı *</div>
        <select id="sUrun"><option value="">— Seçin —</option>${urunOpts}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div><div class="fs-11 text-muted mb-4">Başlangıç Stok</div>
          <input type="number" id="sMiktar" value="0" min="0" step="0.5"></div>
        <div><div class="fs-11 text-muted mb-4">Birim</div>
          <select id="sBirim"><option>kg</option><option>adet</option><option>kasa</option><option>demet</option></select></div>
        <div><div class="fs-11 text-muted mb-4">Kritik Seviye</div>
          <input type="number" id="sKritik" value="20" min="0"></div>
      </div>`,
      async (panel) => {
        const urunAdi = panel.querySelector('#sUrun').value.trim();
        if (!urunAdi) return bildirim('Ürün seçin', 'error');
        if (stok.find(s=>s.urunAdi===urunAdi)) return bildirim('Bu ürün zaten stokta var','error');
        await ipc('stok:guncelle',{
          urunAdi, miktar: parseFloat(panel.querySelector('#sMiktar').value)||0,
          birim: panel.querySelector('#sBirim').value,
          kritikSeviye: parseFloat(panel.querySelector('#sKritik').value)||20,
        });
        bildirim('Ürün eklendi!');
        document.querySelector('.modal-overlay')?.remove();
        stok = await ipc('stok:liste');
        renderListe();
      });
  }

  function duzenle(id, detayModu=false) {
    const s = stok.find(x=>x.id===id);
    if (!s) return;
    modalAc('Stok Düzenle', `
      <div style="margin-bottom:12px;">
        <div class="fs-11 text-muted mb-4">Ürün Adı</div>
        <input type="text" value="${s.urunAdi}" disabled style="opacity:0.6;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
        <div><div class="fs-11 text-muted mb-4">Mevcut Stok</div>
          <input type="number" id="sMiktar" value="${s.miktar||0}" min="0" step="0.5"></div>
        <div><div class="fs-11 text-muted mb-4">Birim</div>
          <select id="sBirim">
            ${['kg','adet','kasa','demet'].map(b=>`<option ${s.birim===b?'selected':''}>${b}</option>`).join('')}
          </select></div>
        <div><div class="fs-11 text-muted mb-4">Kritik Seviye</div>
          <input type="number" id="sKritik" value="${s.kritikSeviye||20}" min="0"></div>
      </div>
      <div><div class="fs-11 text-muted mb-4">Son Alış Fiyatı (₺)</div>
        <input type="number" id="sFiyat" value="${s.sonAlimFiyati||0}" min="0" step="0.25"></div>`,
      async (panel) => {
        await ipc('stok:guncelle',{
          ...s,
          miktar:        parseFloat(panel.querySelector('#sMiktar').value)||0,
          birim:         panel.querySelector('#sBirim').value,
          kritikSeviye:  parseFloat(panel.querySelector('#sKritik').value)||20,
          sonAlimFiyati: parseFloat(panel.querySelector('#sFiyat').value)||0,
        });
        bildirim('Stok güncellendi!');
        document.querySelector('.modal-overlay')?.remove();
        stok = await ipc('stok:liste');
        if (detayModu) renderDetay(id); else renderListe();
      });
  }

  renderListe();
}
