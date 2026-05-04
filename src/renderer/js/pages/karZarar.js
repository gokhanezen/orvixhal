const { ipc, fmtPara, bildirim } = window;

export async function render(container) {
  const bugun     = new Date().toISOString().slice(0,10);
  const haftaBas  = (() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10); })();
  const ayBas     = new Date().toISOString().slice(0,8) + '01';
  const gecenAyBas = (() => { const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10); })();
  const gecenAyBit = (() => { const d=new Date(); d.setDate(0); return d.toISOString().slice(0,10); })();

  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Kâr / Zarar Raporu</div>
    </div>
    <div class="p-20">

      <!-- HIZLI FİLTRELER -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <button class="btn-secondary hizli-btn" data-bas="${bugun}" data-bit="${bugun}"
          style="font-weight:500;">Bugün</button>
        <button class="btn-secondary hizli-btn" data-bas="${haftaBas}" data-bit="${bugun}">Bu Hafta</button>
        <button class="btn-secondary hizli-btn" data-bas="${ayBas}" data-bit="${bugun}">Bu Ay</button>
        <button class="btn-secondary hizli-btn" data-bas="${gecenAyBas}" data-bit="${gecenAyBit}">Geçen Ay</button>
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
          <input type="date" id="kkBas" value="${ayBas}" style="width:145px;">
          <span style="color:var(--color-text-tertiary);">—</span>
          <input type="date" id="kkBit" value="${bugun}" style="width:145px;">
          <button class="btn-primary" id="kkHesaplaBtn">Hesapla</button>
        </div>
      </div>

      <!-- SONUÇLAR -->
      <div id="kkIcerik">
        <div class="bos-durum"><p>Yukarıdan tarih seçin veya hızlı filtre kullanın.</p></div>
      </div>
    </div>`;

  async function yukle(bas, bit) {
    if (!bas || !bit) return bildirim('Tarih seçin', 'error');

    // Aktif butonu vurgula
    document.querySelectorAll('.hizli-btn').forEach(b => {
      const aktif = b.dataset.bas === bas && b.dataset.bit === bit;
      b.style.background   = aktif ? 'var(--green-l,#EAF3DE)' : '';
      b.style.color        = aktif ? 'var(--green-d,#27500A)' : '';
      b.style.borderColor  = aktif ? 'rgba(45,122,58,0.3)' : '';
      b.style.fontWeight   = aktif ? '600' : '';
    });

    document.getElementById('kkIcerik').innerHTML =
      '<div class="yukleniyor"><div class="spinner"></div><p>Hesaplanıyor...</p></div>';

    const data   = await ipc('rapor:karZarar', { baslangic: bas, bitis: bit });
    const karPct = data.gelir > 0 ? Math.round(data.karNet / data.gelir * 100) : 0;

    // Dönem etiketi
    let donemEtiketi = '';
    if (bas === bit && bas === bugun) donemEtiketi = 'Bugün';
    else if (bas === haftaBas && bit === bugun) donemEtiketi = 'Bu Hafta';
    else if (bas === ayBas && bit === bugun) donemEtiketi = 'Bu Ay';
    else if (bas === gecenAyBas && bit === gecenAyBit) donemEtiketi = 'Geçen Ay';
    else donemEtiketi = `${bas} — ${bit}`;

    document.getElementById('kkIcerik').innerHTML = `
      <!-- DÖNEM BAŞLIĞI -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="font-size:15px;font-weight:500;">${donemEtiketi}</div>
        ${data.karNet >= 0
          ? `<span style="background:#EAF3DE;color:#27500A;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;">Kârlı ✓</span>`
          : `<span style="background:#FCEBEB;color:#A32D2D;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;">Zararlı ✗</span>`}
      </div>

      <!-- ANA KARTLAR -->
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;">
        ${[
          ['Toplam Satış',    fmtPara(data.gelir),    '#2D7A3A', data.satisAdedi + ' fatura'],
          ['Toplam Alım',     fmtPara(data.maliyet),  '#A32D2D', data.alimAdedi + ' alım'],
          ['Komisyon Geliri', fmtPara(data.komisyon), '#854F0B', 'Bahçeci komisyonu'],
          ['Net Kâr',         fmtPara(data.karNet),   data.karNet>=0?'#2D7A3A':'#A32D2D', '%' + karPct + ' kâr marjı'],
        ].map(([l,v,c,alt]) => `
          <div class="stat-card">
            <div class="stat-label">${l}</div>
            <div class="stat-val" style="color:${c};font-size:${data.karNet>999999?'18px':'22px'};">${v}</div>
            <div class="stat-sub">${alt}</div>
          </div>`).join('')}
      </div>

      <!-- DETAY KARTI -->
      <div class="card">
        <div class="card-head"><div class="card-head-title">Dönem Detayı</div></div>
        <div class="card-body">
          ${[
            ['Toplam Satış Geliri', fmtPara(data.gelir),     '#2D7A3A'],
            ['Mal Maliyeti',        fmtPara(data.maliyet),   '#A32D2D'],
            ['Brüt Kâr',            fmtPara(data.karBrut),  data.karBrut>=0?'#2D7A3A':'#A32D2D'],
            ['+ Komisyon Geliri',   fmtPara(data.komisyon),  '#854F0B'],
            ['Tahsilat (Bu Dönem)', fmtPara(data.tahsilat||0), '#185FA5'],
            ['Satış Adedi',         data.satisAdedi + ' fatura', '#111'],
            ['Alım Adedi',          data.alimAdedi + ' alım', '#111'],
            ['Kâr Marjı',           '%' + karPct, data.karPct>=0?'#2D7A3A':'#A32D2D'],
          ].map(([k,v,c], i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;
                        border-bottom:0.5px solid var(--color-border-tertiary);
                        ${i===3?'border-top:2px solid var(--color-border-tertiary);margin-top:4px;':''}">
              <span style="font-size:13px;color:var(--color-text-secondary);">${k}</span>
              <span style="font-weight:${i===3||i===7?'700':'500'};font-size:${i===3||i===7?'15px':'13px'};color:${c};">${v}</span>
            </div>`).join('')}
          <!-- NET KÂR TOPLAM SATIRI -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:2px solid #111;margin-top:4px;">
            <span style="font-size:15px;font-weight:600;">Net Kâr / Zarar</span>
            <span style="font-size:24px;font-weight:700;color:${data.karNet>=0?'#2D7A3A':'#A32D2D'};">${fmtPara(data.karNet)}</span>
          </div>
        </div>
      </div>`;
  }

  // Hızlı filtre butonları
  document.querySelectorAll('.hizli-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bas = btn.dataset.bas;
      const bit = btn.dataset.bit;
      document.getElementById('kkBas').value = bas;
      document.getElementById('kkBit').value = bit;
      yukle(bas, bit);
    });
  });

  document.getElementById('kkHesaplaBtn').addEventListener('click', () => {
    yukle(document.getElementById('kkBas').value, document.getElementById('kkBit').value);
  });

  // Sayfa açılınca "Bugün" otomatik yükle
  yukle(bugun, bugun);
}
