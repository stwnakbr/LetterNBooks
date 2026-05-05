// ============================================================
//  ADMIN 1 — Logic
// ============================================================

let adminName = '';
let eventDay  = 1;
let drafts    = [];
let cfg       = {};

// ── AUTH ─────────────────────────────────────────────────────
async function doAuth() {
  const name = document.getElementById('auth-name').value.trim();
  const pass = document.getElementById('auth-pass').value.trim();
  if (!name) { showAuthErr('Masukkan nama kamu'); return; }
  if (!pass) { showAuthErr('Masukkan password');  return; }

  showLoading('Verifikasi...');
  try {
    const res = await api({ action: 'getConfig' });
    cfg = res.cfg;

    if (String(pass) !== String(cfg.admin_password)) {
      hideLoading(); showAuthErr('Password salah'); return;
    }

    adminName = name;
    eventDay  = calcEventDay(cfg.event_start_date, cfg.event_duration_days);

    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('day-label').textContent = 'Day ' + eventDay;
    document.getElementById('admin-chips').innerHTML =
      `<div class="chip active">${name}</div>`;

    hideLoading();
    toast('Halo, ' + name + '! 👋', 'ok');
  } catch(e) {
    hideLoading(); showAuthErr('Gagal konek ke server. Coba lagi.');
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
    const img = new Image();
    img.onload = () => {
      btn.classList.add('has-photo');
      label.textContent = '✓ Foto terpilih — ' + file.name.substring(0, 24);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── PREVIEW ──────────────────────────────────────────────────
function updatePreview() {
  const title = document.getElementById('f-title').value.trim();
  const price = document.getElementById('f-price').value;
  const table = document.getElementById('f-table').value.trim();
  const prev  = document.getElementById('preview');
  const btn   = document.getElementById('btn-submit');

  if (title && price && table) {
    prev.classList.add('show');
    document.getElementById('prev-title').textContent = title;
    document.getElementById('prev-author').textContent = document.getElementById('f-author').value || '';
    document.getElementById('prev-price').textContent  = formatRp(price);
    document.getElementById('prev-table').textContent  = 'Meja ' + table;
    btn.disabled = false;
  } else {
    prev.classList.remove('show');
    btn.disabled = true;
  }
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

  showLoading('Menyimpan ke Sheets...');
  try {
    const res = await api({
      action: 'submitBook',
      title, author, price, table_code: table, notes,
      admin_name: adminName, photo_url: ''
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
    toast('Gagal simpan. Cek koneksi.', 'err');
  }
}

function resetForm() {
  ['f-title','f-author','f-price','f-table','f-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('photo-btn').classList.remove('has-photo');
  document.getElementById('photo-label').textContent = 'Tap untuk foto / pilih dari galeri';
  document.getElementById('photo-input').value = '';
  document.getElementById('preview').classList.remove('show');
  document.getElementById('btn-submit').disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── DRAFT LIST ───────────────────────────────────────────────
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

// Enter key on password
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'auth-pass') doAuth();
});
