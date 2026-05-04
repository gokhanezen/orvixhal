const { ipc, fmtPara, fmtTarih, fmtTarihSaat, durumPill, sayfaGit } = window;

export async function render(container) {
  const data = await ipc('rapor:dashboard');

  // Vade uyarısı popup'ı
  if (data.vadeliCekSayisi > 0) {
    setTimeout(() => vadeUyarisi(data.vadeliCekSayisi, data.vadeliCekToplam), 400);
  }

  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Genel Bakış</div>
      <div style="font-size:12px;color:var(--color-text-tertiary);">
        ${new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
      </div>
      <button class="btn-secondary" id="dbYeniSatisBtn">Yeni Satış</button>
      <button class="btn-primary" id="dbYeniAlimBtn">Alım Yap</button>
    </div>

    <div class="p-20">
      <!-- BUGÜNÜN ÖZETİ -->
      <div class="card" style="margin-bottom:20px;border:1.5px solid rgba(45,122,58,0.2);background:linear-gradient(135deg,#F7FBF2 0%,#FAFAF7 100%);">
        <div class="card-head" style="border-bottom:0.5px solid rgba(45,122,58,0.15);">
          <div class="card-head-title" style="color:#27500A;">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#27500A" stroke-width="1.5" style="margin-right:5px;vertical-align:-2px;"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.5l2 2"/></svg>
            Bugünün Özeti
          </div>
          <span style="font-size:11px;color:#3B6D11;">${new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})}</span>
          <button class="btn-secondary" id="dbKarZararBtn" style="padding:4px 10px;font-size:11px;margin-left:auto;">Detaylı Rapor →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;">
          ${[
            ['Satış',      fmtPara(data.bugunSatisToplam),  '#2D7A3A', data.bugunSatisSayisi + ' fatura'],
            ['Alım',       fmtPara(data.bugunAlimToplam),   '#A32D2D', data.bugunAlimSayisi + ' alım'],
            ['Komisyon',   fmtPara(data.bugunKomisyon||0),  '#854F0B', 'bugün kazanılan'],
            ['Net Kâr',    fmtPara(data.bugunKar||0),       (data.bugunKar||0)>=0?'#2D7A3A':'#A32D2D', 'tahmini'],
            ['Açık Alacak',fmtPara(data.acikAlacak),        data.acikAlacak>0?'#854F0B':'#2D7A3A', 'tahsil bekliyor'],
          ].map(([l,v,c,alt],i) => `
            <div style="padding:14px 16px;${i<4?'border-right:0.5px solid rgba(45,122,58,0.12);':''}">
              <div style="font-size:11px;color:#3B6D11;margin-bottom:5px;">${l}</div>
              <div style="font-size:18px;font-weight:600;color:${c};">${v}</div>
              <div style="font-size:11px;color:#5A8A3A;margin-top:2px;">${alt}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ANA METRİKLER -->
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-label">Bugünkü Satış</div>
          <div class="stat-val" style="color:#2D7A3A;">${fmtPara(data.bugunSatisToplam)}</div>
          <div class="stat-sub">${data.bugunSatisSayisi} işlem</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Bugünkü Alım</div>
          <div class="stat-val">${fmtPara(data.bugunAlimToplam)}</div>
          <div class="stat-sub">${data.bugunAlimSayisi} bahçeci</div>
        </div>
        <div class="stat-card" id="acikAlacakKart" style="cursor:pointer;">
          <div class="stat-label">Açık Alacak</div>
          <div class="stat-val" style="color:${data.acikAlacak>0?'var(--amber,#854F0B)':'#2D7A3A'};">${fmtPara(data.acikAlacak)}</div>
          <div class="stat-sub">Bekleyen tahsilat</div>
        </div>
        <div class="stat-card" id="cekKartBtn" style="cursor:pointer;">
          <div class="stat-label">Vadeli Çek (7 gün)</div>
          <div class="stat-val" style="color:${data.vadeliCekSayisi>0?'#A32D2D':'#2D7A3A'};">${fmtPara(data.vadeliCekToplam)}</div>
          <div class="stat-sub">${data.vadeliCekSayisi} çek</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;">

        <!-- SOL: GRAFİK + SON SATIŞLAR -->
        <div style="display:flex;flex-direction:column;gap:14px;">

          <!-- SON 7 GÜN GRAFİĞİ -->
          <div class="card">
            <div class="card-head"><div class="card-head-title">Son 7 Günlük Satış</div></div>
            <div style="padding:16px 16px 8px;">
              <div id="grafik" style="display:flex;align-items:flex-end;gap:8px;height:100px;">
                ${renderGrafik(data.son7Gun)}
              </div>
              <div style="display:flex;gap:8px;margin-top:6px;">
                ${(data.son7Gun||[]).map(g=>`
                  <div style="flex:1;text-align:center;font-size:10px;color:var(--color-text-tertiary);">
                    ${new Date(g.tarih).toLocaleDateString('tr-TR',{weekday:'short'})}
                  </div>`).join('')}
              </div>
            </div>
          </div>

          <!-- SON 6 AY KAR/ZARAR -->
          <div class="card">
            <div class="card-head"><div class="card-head-title">Son 6 Ay — Gelir / Kâr</div></div>
            <div style="padding:16px 16px 8px;">
              <div style="display:flex;align-items:flex-end;gap:6px;height:80px;">
                ${render6AyGrafik(data.son6Ay)}
              </div>
              <div style="display:flex;gap:6px;margin-top:6px;">
                ${(data.son6Ay||[]).map(g=>`
                  <div style="flex:1;text-align:center;font-size:10px;color:var(--color-text-tertiary);">
                    ${g.ay?.slice(5)}
                  </div>`).join('')}
              </div>
              <div style="display:flex;gap:14px;margin-top:10px;font-size:11px;">
                <div style="display:flex;align-items:center;gap:4px;"><div style="width:10px;height:10px;border-radius:2px;background:#C0DD97;"></div>Gelir</div>
                <div style="display:flex;align-items:center;gap:4px;"><div style="width:10px;height:10px;border-radius:2px;background:#2D7A3A;"></div>Kâr</div>
              </div>
            </div>
          </div>

          <!-- SON SATIŞLAR -->
          <div class="card">
            <div class="card-head">
              <div class="card-head-title">Son Satışlar</div>
              <button class="btn-secondary" id="dbTumSatisBtn" style="padding:4px 10px;font-size:11px;">Tümü →</button>
            </div>
            <div>
              ${(data.sonSatislar||[]).length === 0
                ? '<div style="padding:20px;text-align:center;color:var(--color-text-tertiary);font-size:13px;">Henüz satış yok</div>'
                : (data.sonSatislar||[]).slice(0,7).map(s => `
                    <div style="display:grid;grid-template-columns:1fr 100px 90px 80px;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary);align-items:center;">
                      <div>
                        <div style="font-weight:500;">${s.musteriAdi||'—'}</div>
                        <div style="font-size:11px;color:var(--color-text-tertiary);">${fmtTarihSaat(s.tarih)} · ${s.faturaNo}</div>
                      </div>
                      <div style="font-weight:500;color:#2D7A3A;">${fmtPara(s.genelToplam)}</div>
                      <div style="font-size:12px;">${s.odemeTipi||'—'}</div>
                      <div>${durumPill(s.odenmeDurumu)}</div>
                    </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- SAĞ PANELİ -->
        <div style="display:flex;flex-direction:column;gap:12px;">

          <!-- HIZLI İŞLEM -->
          <div class="card">
            <div class="card-head"><div class="card-head-title">Hızlı İşlem</div></div>
            <div style="padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <button class="dbHizli" data-sayfa="satislar" data-param="yeni"
                style="background:#EAF3DE;color:#27500A;border:none;border-radius:8px;padding:10px 8px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;">
                Satış Yap
              </button>
              <button class="dbHizli" data-sayfa="alimlar" data-param="yeni"
                style="background:#E1F5EE;color:#085041;border:none;border-radius:8px;padding:10px 8px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;">
                Alım Yap
              </button>
              <button class="dbHizli" data-sayfa="cekler" data-param=""
                style="background:#FAEEDA;color:#633806;border:none;border-radius:8px;padding:10px 8px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;">
                Çek Ekle
              </button>
              <button class="dbHizli" data-sayfa="musteriler" data-param=""
                style="background:#E6F1FB;color:#0C447C;border:none;border-radius:8px;padding:10px 8px;cursor:pointer;font-size:12px;font-weight:500;font-family:inherit;">
                Müşteri Ekle
              </button>
            </div>
          </div>

          <!-- KRİTİK STOK -->
          ${(data.kritikStok||[]).length > 0 ? `
          <div class="card" style="border-color:rgba(163,45,45,0.25);">
            <div class="card-head">
              <div class="card-head-title" style="color:#A32D2D;">Kritik Stok</div>
              <button class="btn-secondary" id="dbStokBtn" style="padding:3px 8px;font-size:11px;">Stok →</button>
            </div>
            <div>
              ${data.kritikStok.slice(0,4).map(s => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:0.5px solid var(--color-border-tertiary);">
                  <span style="font-weight:500;">${s.urunAdi}</span>
                  <span style="padding:3px 9px;border-radius:5px;font-size:11px;font-weight:600;background:#FCEBEB;color:#A32D2D;">${s.miktar||0} ${s.birim||'kg'}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}

          <!-- SON ALIMLAR -->
          <div class="card">
            <div class="card-head">
              <div class="card-head-title">Son Alımlar</div>
              <button class="btn-secondary" id="dbTumAlimBtn" style="padding:3px 8px;font-size:11px;">Tümü →</button>
            </div>
            <div>
              ${(data.sonAlimlar||[]).length === 0
                ? '<div style="padding:16px;text-align:center;color:var(--color-text-tertiary);font-size:12px;">Alım yok</div>'
                : (data.sonAlimlar||[]).slice(0,4).map(a => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 16px;border-bottom:0.5px solid var(--color-border-tertiary);">
                      <div>
                        <div style="font-weight:500;">${a.bahceciAdi||'—'}</div>
                        <div style="font-size:11px;color:var(--color-text-tertiary);">${fmtTarih(a.tarih)}</div>
                      </div>
                      <div style="color:var(--teal,#0F6E56);font-weight:500;">${fmtPara(a.odenecekTutar)}</div>
                    </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Event bağlantıları
  document.getElementById('dbYeniSatisBtn').addEventListener('click', () => sayfaGit('satislar','yeni'));
  document.getElementById('dbYeniAlimBtn').addEventListener('click', () => sayfaGit('alimlar','yeni'));
  document.getElementById('dbKarZararBtn').addEventListener('click', () => sayfaGit('karZarar'));
  document.getElementById('cekKartBtn').addEventListener('click', () => sayfaGit('cekler'));
  document.getElementById('acikAlacakKart').addEventListener('click', () => sayfaGit('musteriler'));
  document.getElementById('dbTumSatisBtn').addEventListener('click', () => sayfaGit('satislar'));
  document.getElementById('dbTumAlimBtn')?.addEventListener('click', () => sayfaGit('alimlar'));
  document.getElementById('dbStokBtn')?.addEventListener('click', () => sayfaGit('stok'));
  document.querySelectorAll('.dbHizli').forEach(btn =>
    btn.addEventListener('click', () => sayfaGit(btn.dataset.sayfa, btn.dataset.param||undefined)));
}

// ─── GRAFİK (saf CSS çubuk) ──────────────────────────────────────────────────
function renderGrafik(gun7) {
  if (!gun7 || !gun7.length) return '<div style="color:var(--color-text-tertiary);font-size:12px;">Veri yok</div>';
  const maks  = Math.max(...gun7.map(g=>g.toplam), 1);
  const bugun = new Date().toISOString().slice(0,10);
  return gun7.map(g => {
    const pct     = Math.max(4, Math.round((g.toplam / maks) * 100));
    const isBugun = g.tarih === bugun;
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div style="font-size:10px;color:var(--color-text-tertiary);white-space:nowrap;">
          ${g.toplam > 0 ? fmtPara(g.toplam).replace('₺','').trim() : ''}
        </div>
        <div style="width:100%;background:${isBugun?'#2D7A3A':'#C0DD97'};border-radius:4px 4px 0 0;height:${pct}px;"></div>
      </div>`;
  }).join('');
}

function render6AyGrafik(ay6) {
  if (!ay6 || !ay6.length) return '<div style="color:var(--color-text-tertiary);font-size:12px;">Veri yok</div>';
  const maks = Math.max(...ay6.map(g=>g.gelir), 1);
  return ay6.map(g => {
    const gelirPct = Math.max(2, Math.round((g.gelir / maks) * 80));
    const karPct   = Math.max(2, Math.round((Math.max(0, g.kar) / maks) * 80));
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:100%;position:relative;height:80px;display:flex;align-items:flex-end;gap:2px;">
          <div style="flex:1;background:#C0DD97;border-radius:3px 3px 0 0;height:${gelirPct}px;" title="Gelir: ${fmtPara(g.gelir)}"></div>
          <div style="flex:1;background:#2D7A3A;border-radius:3px 3px 0 0;height:${karPct}px;" title="Kâr: ${fmtPara(g.kar)}"></div>
        </div>
      </div>`;
  }).join('');
}

// ─── VADE UYARI POPUP ────────────────────────────────────────────────────────
function vadeUyarisi(sayi, toplam) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:20px;right:20px;background:#FAEEDA;border:1px solid rgba(133,79,11,0.3);' +
    'border-radius:10px;padding:14px 16px;max-width:300px;z-index:9000;cursor:pointer;';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#854F0B" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/></svg>
      <div>
        <div style="font-weight:500;font-size:13px;color:#633806;">${sayi} çekin vadesi bu hafta!</div>
        <div style="font-size:12px;color:#854F0B;margin-top:2px;">Toplam: ${fmtPara(toplam)}</div>
      </div>
      <button style="margin-left:auto;background:transparent;border:none;cursor:pointer;font-size:16px;color:#854F0B;">×</button>
    </div>`;
  el.querySelector('button').addEventListener('click', e => { e.stopPropagation(); el.remove(); });
  el.addEventListener('click', () => { el.remove(); sayfaGit('cekler'); });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}
