// ============================================================
//  CONFIG — ganti SCRIPT_URL dengan URL deployment Anda
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuRhtaQbtZc1TTvuO4nCXetDwQthtXOWwE5XLv0_7avzRbI1kSuAxGnM7kJoeOj2FP/exec';

// ── API helper (Versi Perbaikan) ───────────────────────────────
async function api(payload) {
  let data;
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, 
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error('Server merespon dengan status: ' + res.status);
    }

    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch(e) {
      throw new Error('Response bukan JSON. Cek Apps Script log. Preview: ' + text.substring(0, 200));
    }

    if (!data.ok) throw new Error(data.error || 'Gagal memproses data');
    return data;
  } catch (err) {
    console.error('API error:', err);
    // Lempar pesan asli, bukan pesan generik
    throw err;
  }
}

// ── Utilities ────────────────────────────────────────────────
function calcEventDay(startDate, duration) {
  const s = new Date(startDate), t = new Date();
  s.setHours(0,0,0,0); t.setHours(0,0,0,0);
  const diff = Math.floor((t - s) / 86400000) + 1;
  return Math.max(1, Math.min(diff, Number(duration) || 7));
}

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function calcFee(price, category) {
  const p = Number(price || 0);
  const cat = String(category || "").toLowerCase();
  const rules = (cfg && cfg.fee_rules) ? cfg.fee_rules : [];

  // 1. Cek Kategori
  const catRule = rules.find(r => String(r.type).toLowerCase() === 'category' && String(r.name).toLowerCase() === cat);
  if (catRule) return Number(catRule.fee);

  // 2. Cek Tier
  const tierRules = rules.filter(r => String(r.type).toLowerCase() === 'tier');
  for (let r of tierRules) {
    const min = Number(r.min_price || 0);
    const max = Number(r.max_price || 999999999);
    if (p >= min && p <= max) return Number(r.fee);
  }

  return 10000; // Fallback
}

let _toastTimer;
function toast(msg, type = '') {
  let el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  // Gunakan template literal untuk keamanan class
  el.className = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className = 'toast', 3000);
}

function showLoading(msg) {
  const el = document.getElementById('loading');
  const tx = document.getElementById('loading-text');
  if (el) el.classList.add('show');
  if (tx) tx.textContent = msg || 'Memuat...';
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.remove('show');
}
