const { ipc, bildirim } = window;

export async function render(container) {
  const buAyBas = new Date(); buAyBas.setDate(1);
  const bas = buAyBas.toISOString().slice(0,10);
  const bit = new Date().toISOString().slice(0,10);

  container.innerHTML = `
    <div class="topbar"><div class="topbar-title">Excel Raporu</div></div>
    <div class="p-20">
      <div class="card" style="max-width:480px;">
        <div class="card-head"><div class="card-head-title">Tarih Aralığı Seç</div></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
            <div><div class="fs-11 text-muted mb-4">Başlangıç</div><input type="date" id="rBas" value="${bas}"></div>
            <div><div class="fs-11 text-muted mb-4">Bitiş</div><input type="date" id="rBit" value="${bit}"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
            ${[
              ['Satışlar sayfası',  'Fatura listesi, müşteri, tutar, durum'],
              ['Alımlar sayfası',   'Bahçeci, ürün, komisyon, ödeme'],
              ['Çekler sayfası',    'Vade, tutar, durum'],
            ].map((([lbl,alt], i) => `
              <label style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;border:0.5px solid var(--color-border-secondary);cursor:pointer;">
                <input type="checkbox" class="rSayfa" checked style="width:auto;cursor:pointer;">
                <div>
                  <div style="font-weight:500;font-size:13px;">${lbl}</div>
                  <div style="font-size:11px;color:var(--color-text-tertiary);">${alt}</div>
                </div>
              </label>`)).join('')}
          </div>
          <button class="btn-primary" id="excelBtn" style="width:100%;justify-content:center;padding:10px;">
            Excel Dosyası İndir (.xlsx)
          </button>
        </div>
      </div>
    </div>`;

  document.getElementById('excelBtn').addEventListener('click', async () => {
    const b  = document.getElementById('rBas').value;
    const bi = document.getElementById('rBit').value;
    if (!b || !bi) return bildirim('Tarih seçin', 'error');
    const btn = document.getElementById('excelBtn');
    btn.textContent = 'Oluşturuluyor...';
    btn.disabled = true;
    try {
      const sonuc = await ipc('rapor:excelExport', { baslangic: b, bitis: bi });
      if (!sonuc.iptal) bildirim('Excel dosyası kaydedildi!');
    } catch(e) {
      bildirim('Hata: ' + e.message, 'error');
    } finally {
      btn.textContent = 'Excel Dosyası İndir (.xlsx)';
      btn.disabled = false;
    }
  });
}
