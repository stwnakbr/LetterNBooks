// ============================================================
//  ADMIN 1 — Logic (Updated for Photo Upload)
// ============================================================

let adminName = '';
let eventDay  = 1;
let drafts    = [];
let cfg       = {};
let photoBase64 = '';  // Base64 tanpa prefix (untuk upload ke Drive)
let photoDataUrl = ''; // Full data URL (untuk OCR Tesseract)

// ── AUTH ─────────────────────────────────────────────────────
window.onload = async () => {
  const cachedName = sessionStorage.getItem('admin1_name');
  if (cachedName) {
    adminName = cachedName;
    try {
      const res = await api({ action: 'getConfig' });
      cfg = res.cfg;
      eventDay = calcEventDay(cfg.event_start_date, cfg.event_duration_days);
      document.getElementById('auth-gate').style.display = 'none';
      document.getElementById('day-label').textContent = 'Day ' + eventDay;
      document.getElementById('admin-chips').innerHTML = `<div class="chip active">${adminName}</div>`;
      populateCategoryDropdown();
    } catch(e) {}
  }
};

async function doAuth() {
  const name = document.getElementById('auth-name').value.trim();
  const pass = document.getElementById('auth-pass').value.trim();
  
  if (!name) { showAuthErr('Masukkan nama kamu'); return; }
  if (!pass) { showAuthErr('Masukkan password');  return; }

  showLoading('Verifikasi...');
  try {
    const res = await api({ action: 'login', password: pass }); 

    if (res.ok) {
      const configRes = await api({ action: 'getConfig' });
      cfg = configRes.cfg;

      adminName = name;
      eventDay  = calcEventDay(cfg.event_start_date, cfg.event_duration_days);

      document.getElementById('auth-gate').style.display = 'none';
      sessionStorage.setItem('admin1_name', name);
      document.getElementById('day-label').textContent = 'Day ' + eventDay;
      document.getElementById('admin-chips').innerHTML = `<div class="chip active">${name}</div>`;
      
      populateCategoryDropdown();
      hideLoading();
      toast('Halo, ' + name + '! 👋', 'ok');
    }
  } catch(e) {
    hideLoading();
    showAuthErr(e.message || 'Gagal konek ke server');
  }
}

function showAuthErr(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  setTimeout(() => el.textContent = '', 3000);
}

// ── PHOTO ────────────────────────────────────────────────────
function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  
  const btn   = document.getElementById('photo-btn');
  const label = document.getElementById('photo-label');
  const reader = new FileReader();
  
  reader.onload = e => {
    photoBase64 = e.target.result.split(',')[1];
    photoDataUrl = e.target.result;
    
    btn.classList.add('has-photo');
    label.textContent = '✓ Foto terpilih — ' + file.name.substring(0, 24);

    // Tampilkan OCR container & reset hasil sebelumnya
    const ocrBox = document.getElementById('ocr-container');
    ocrBox.classList.add('show');
    document.getElementById('ocr-results').innerHTML = '';
    document.getElementById('ocr-hint').style.display = 'none';
    document.getElementById('btn-run-ocr').textContent = '🤖 Pindai Teks dari Foto (OCR)';
    document.getElementById('btn-run-ocr').disabled = false;
    
    updatePreview();
  };
  reader.onerror = err => console.error("FileReader Error: ", err);
  reader.readAsDataURL(file);
}

// ── PREVIEW ──────────────────────────────────────────────────
function updatePreview() {
  const title = document.getElementById('f-title').value.trim();
  const author = document.getElementById('f-author').value.trim();
  const price = document.getElementById('f-price').value;
  const table = document.getElementById('f-table').value.trim();
  const prev  = document.getElementById('preview');
  const btn   = document.getElementById('btn-submit');

  // Sekarang hanya Kode Meja yang wajib, Judul dan Harga opsional untuk diisi Admin 2 nanti
  if (table && photoBase64) {
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }

  document.getElementById('prev-title').textContent = title || '(Judul belum diisi)';
  document.getElementById('prev-author').textContent = author || '';
  document.getElementById('prev-price').textContent = price ? formatRp(price) : '(Harga belum diisi)';
  document.getElementById('prev-table').textContent = table ? 'Meja ' + table : '(Meja belum diisi)';
  prev.classList.add('show');
}

// ── SUBMIT ───────────────────────────────────────────────────
async function submitBook() {
  const title  = document.getElementById('f-title').value.trim();
  const author = document.getElementById('f-author').value.trim();
  const price  = Number(document.getElementById('f-price').value);
  const table  = document.getElementById('f-table').value.trim();
  const notes  = document.getElementById('f-notes').value.trim();

  if (!title || !price || !table) { toast('Lengkapi judul, harga & kode meja', 'err'); return; }
  if (!adminName)                  { toast('Login dulu ya', 'err'); return; }

  const draftId = Date.now();
  drafts.unshift({ id: draftId, title, price, table, status: 'sending' });
  renderDrafts();

  showLoading('Menyimpan data & upload foto...');
  try {
    const res = await api({
      action: 'submitBook',
      title, 
      author, 
      price, 
      table_code: table, 
      notes,
      category: document.getElementById('in-category').value,
      admin_name: adminName, 
      photo_data: photoBase64, 
      photo_name: `IMG_${Date.now()}.jpg`
    });

    const d = drafts.find(d => d.id === draftId);
    if (d) { d.status = 'ok'; d.book_id = res.book_id; }
    renderDrafts();
    resetForm();
    hideLoading();
    toast('✓ ' + title.substring(0, 20) + ' tersimpan!', 'ok');
  } catch(e) {
    const d = drafts.find(d => d.id === draftId);
    if (d) d.status = 'error';
    renderDrafts();
    hideLoading();
    toast('Gagal simpan: ' + e.message, 'err');
  }
}

function resetForm() {
  ['f-title','f-author','f-price','f-table','f-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  photoBase64 = ''; // Reset data foto
  document.getElementById('photo-btn').classList.remove('has-photo');
  document.getElementById('photo-label').textContent = 'Tap untuk foto / pilih dari galeri';
  document.getElementById('photo-input').value = '';
  document.getElementById('preview').classList.remove('show');
  document.getElementById('btn-submit').disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDrafts() {
  const el = document.getElementById('draft-list');
  document.getElementById('draft-count').textContent = drafts.length;

  if (!drafts.length) {
    el.innerHTML = '<div class="empty"><span class="icon">📭</span>Belum ada buku yang disubmit</div>';
    return;
  }
  el.innerHTML = drafts.map((d, i) => `
    <div class="draft-item">
      <div class="draft-num">${String(i+1).padStart(2,'0')}</div>
      <div class="draft-info">
        <div class="draft-title">${d.title}</div>
        <div class="draft-sub">${formatRp(d.price)} · Meja ${d.table}${d.book_id ? ' · '+d.book_id : ''}</div>
      </div>
      <div class="draft-status ${d.status === 'sending' ? 'sending' : d.status === 'error' ? 'error' : ''}">
        ${d.status === 'sending' ? '⏳' : d.status === 'error' ? '✗ gagal' : '✓ ok'}
      </div>
    </div>
  `).join('');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'auth-pass') doAuth();
});

// -- OCR -----------------------------------------------------------
async function runOCR() {
  if (!photoBase64) return;

  const btn     = document.getElementById('btn-run-ocr');
  const results = document.getElementById('ocr-results');
  const hint    = document.getElementById('ocr-hint');

  btn.disabled = true;
  btn.textContent = 'Memindai via Google... mohon tunggu';
  results.innerHTML = '';
  hint.style.display = 'none';

  try {
    const res = await api({ action: 'doOCR', photo_data: photoBase64 });
    const lines = (res.lines || []).filter(l => l.length > 1);

    if (lines.length === 0) {
      results.innerHTML = '<span style="color:var(--muted);font-size:12px;">Tidak ada teks terdeteksi. Coba foto lebih jelas / dekat.</span>';
    } else {
      hint.style.display = 'block';
      results.innerHTML = lines.map(line => {
        const safe = line.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<span class="ocr-chip" onclick="fillTitle('${safe}')">${line}</span>`;
      }).join('');
    }

    btn.textContent = 'Pindai Ulang';
    btn.disabled = false;

  } catch(err) {
    results.innerHTML = '<span style="color:var(--danger);font-size:12px;">Gagal: ' + err.message + '</span>';
    btn.textContent = 'Pindai Teks dari Foto (OCR)';
    btn.disabled = false;
  }
}

function fillTitle(text) {
  document.getElementById('f-title').value = text;
  document.getElementById('f-title').dispatchEvent(new Event('input'));
  document.querySelectorAll('.ocr-chip').forEach(c => c.style.borderColor = '');
  event.target.style.borderColor = 'var(--accent2)';
}

function populateCategoryDropdown() {
  const rules = (cfg && cfg.fee_rules) ? cfg.fee_rules : [];
  const categories = rules.filter(r => String(r.type).toLowerCase() === 'category');
  
  const html = `
    <option value="reguler">Reguler (Ikut Harga)</option>
    ${categories.map(c => `<option value="${c.name}">${c.name.toUpperCase()} (Fee ${formatRp(c.fee)})</option>`).join('')}
  `;
  
  const el = document.getElementById('in-category');
  if (el) el.innerHTML = html;
}
