// ============================================================
//  CONFIG — ganti SCRIPT_URL dengan URL deployment Anda
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQ114fCIihUbHFDQkRQo-Q8Y9wzvpSNAAWsBU8cVmBSYyc32ShxVqYeQ3w1iiCidZe/exec';

// ── API helper ───────────────────────────────────────────────
// ── API helper (Versi Perbaikan) ───────────────────────────────
async function api(payload) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      // Menggunakan text/plain agar tidak memicu preflight CORS yang ketat
      headers: { 'Content-Type': 'text/plain' }, 
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error('Server merespon dengan status: ' + res.status);
    }

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Gagal memproses data');
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
    throw new Error('Gagal terhubung ke server. Pastikan SCRIPT_URL benar dan Apps Script sudah di-deploy sebagai Web App dengan akses "Anyone".');
  }
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

function calcFee(price, cfg) {
  if (cfg.fee_jastip_type === 'percent') {
    return Math.round(Number(price) * Number(cfg.fee_jastip_value) / 100);
  }
  return Number(cfg.fee_jastip_value) || 5000;
}

let _toastTimer;
function toast(msg, type = '') {
  let el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
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
