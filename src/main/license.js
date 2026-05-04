// src/main/license.js — OrvixHal Lisans Sistemi
// TazeAdmin ile AYNI SECRET kullanılmalı

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { app } = require('electron');

const SECRET      = 'OrvixHalSecretKey2026!Orvix';
const B32         = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DATA_DIR    = path.join(app.getPath('userData'), 'OrvixHal');
const LICENSE_FILE = path.join(DATA_DIR, 'license.dat');

// ─── BASE32 ──────────────────────────────────────────────────────────────────
function b32enc(buf) {
  let bits=0,val=0,out='';
  for(const b of buf){val=(val<<8)|b;bits+=8;while(bits>=5){out+=B32[(val>>>(bits-5))&31];bits-=5;}}
  if(bits>0)out+=B32[(val<<(5-bits))&31];
  return out;
}

function b32dec(s) {
  const clean=s.replace(/[^A-Z2-7]/gi,'').toUpperCase();
  let bits=0,val=0;const out=[];
  for(const c of clean){const i=B32.indexOf(c);if(i<0)continue;val=(val<<5)|i;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&255);bits-=8;}}
  return Buffer.from(out);
}

// ─── DOĞRULAMA ───────────────────────────────────────────────────────────────
function lisansDogrula(kod) {
  try {
    const enc  = kod.toUpperCase().replace(/TAZE-?/i,'').replace(/-/g,'');
    if(enc.length < 16) return { gecerli: false, hata: 'Geçersiz kod formatı' };
    const buf  = b32dec(enc.slice(0,16));
    if(buf.length < 10) return { gecerli: false, hata: 'Kod çözülemedi' };

    const veri    = buf.slice(0,5);
    const imza    = buf.slice(5,10);
    const beklenen = crypto.createHmac('sha256', SECRET).update(veri).digest().slice(0,5);
    if(!imza.equals(beklenen)) return { gecerli: false, hata: 'Geçersiz lisans kodu' };

    const yy = veri[0]+2000, mm = veri[1]-1, dd = veri[2];
    const bitis = new Date(yy, mm, dd, 23, 59, 59);
    const simdi = new Date();
    const kalan = Math.ceil((bitis-simdi)/86400000);

    if(kalan < 0) return {
      gecerli: false, bitti: true,
      hata: 'Lisans süresi dolmuştur',
      bitis: bitis.toLocaleDateString('tr-TR'),
      kalanGun: 0,
    };
    return {
      gecerli: true,
      bitis:   bitis.toLocaleDateString('tr-TR'),
      bitisISO: bitis.toISOString().slice(0,10),
      kalanGun: kalan,
      uyari:   kalan <= 30,
    };
  } catch {
    return { gecerli: false, hata: 'Lisans kodu okunamadı' };
  }
}

// ─── KAYDET / OKU ────────────────────────────────────────────────────────────
function lisansKaydet(kod) {
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LICENSE_FILE, Buffer.from(kod).toString('base64'), 'utf8');
}

function lisansOku() {
  try {
    if(!fs.existsSync(LICENSE_FILE)) return null;
    return Buffer.from(fs.readFileSync(LICENSE_FILE,'utf8'), 'base64').toString('utf8');
  } catch { return null; }
}

module.exports = { lisansDogrula, lisansKaydet, lisansOku };
