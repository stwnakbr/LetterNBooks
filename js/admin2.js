// ============================================================
//  ADMIN 2 — Logic (Cleaned & Updated)
// ============================================================

/**
 * Konversi Google Drive URL ke thumbnail kecil untuk di list.
 * sz = ukuran max dalam pixel.
 * Kalau bukan Google Drive, return URL asli.
 */
function getThumbnailUrl(url, sz = 200) {
  if (!url) return null;
  const matchDrive = String(url).match(/[?&]id=([^&]+)/);
  if (matchDrive) {
    return `https://lh3.googleusercontent.com/d/${matchDrive[1]}=s${sz}`;
  }
  const matchLh3 = String(url).match(/lh3\.googleusercontent\.com\/d\/([^?=]+)/);
  if (matchLh3) {
    return `https://lh3.googleusercontent.com/d/${matchLh3[1]}=s${sz}`;
  }
  return url;
}

let allOrders   = [];
let allBooks    = [];
let allPayments = [];
let cfg          = {};

// ── AUTH ─────────────────────────────────────────────────────
window.onload = async () => {
  if (sessionStorage.getItem('admin2_auth') === 'true') {
    try {
      document.getElementById('auth-gate').style.display = 'none';
      showLoading('Memuat data...');
      
      // Optimasi: Fetch config dan orders secara paralel (bersamaan) untuk memotong waktu loading setengahnya
      const [resConfig, resOrders] = await Promise.all([
        api({ action: 'getConfig' }),
        api({ action: 'getOrders' })
      ]);
      
      cfg = resConfig.cfg;
      initDaySelects();
      populateCategoryDropdown();
      
      allOrders = resOrders.orders || [];
      renderOrders();
      updateOrderStats();
      hideLoading();
    } catch(e) {
      hideLoading();
    }
  }
};

async function doAuth() {
  const pass = document.getElementById('auth-pass').value.trim();
  if (!pass) return;
  showLoading('Verifikasi & Memuat Data...');
  try {
    // Optimasi: Fetch config dan orders secara paralel
    const [resConfig, resOrders] = await Promise.all([
      api({ action: 'getConfig' }),
      api({ action: 'getOrders' })
    ]);
    
    cfg = resConfig.cfg;
    if (String(pass) !== String(cfg.admin_password)) {
      hideLoading();
      document.getElementById('auth-err').textContent = 'Password salah';
      return;
    }
    
    document.getElementById('auth-gate').style.display = 'none';
    sessionStorage.setItem('admin2_auth', 'true');
    initDaySelects();
    populateCategoryDropdown();
    
    allOrders = resOrders.orders || [];
    renderOrders();
    updateOrderStats();
    
    hideLoading();
  } catch(e) {
    hideLoading();
    document.getElementById('auth-err').textContent = 'Gagal konek. Coba lagi.';
  }
}

function initDaySelects() {
  const days = Number(cfg.event_duration_days) || 7;
  const opts = Array.from({length: days}, (_, i) =>
    `<option value="${i+1}">Hari ke-${i+1}</option>`
  ).join('');
  const blank = '<option value="">Semua Hari</option>';
  document.getElementById('day-filter-orders').innerHTML = blank + opts;
  document.getElementById('day-filter-search').innerHTML = '<option value="">Semua</option>' + opts;
  document.getElementById('day-filter-pay').innerHTML    = blank + opts;
  document.getElementById('cf-day').innerHTML            = opts;
}

// ── NAVIGATION ────────────────────────────────────────────────
function showPage(name, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  if (name === 'orders') loadOrders();
  if (name === 'books')  loadBooks();
  if (name === 'search') loadOrders();
  if (name === 'payment') loadPayments();
  if (name === 'fee') loadFeeRules();
}

// ── ORDERS ────────────────────────────────────────────────────
async function loadOrders() {
  showLoading('Memuat order...');
  const day = document.getElementById('day-filter-orders').value;
  try {
    const res = await api({ action: 'getOrders', event_day: day || undefined });
    allOrders = res.orders || [];
    renderOrders();
    updateOrderStats();
  } catch(e) { toast('Gagal memuat order', 'err'); }
  hideLoading();
}

function updateOrderStats() {
  document.getElementById('s-total').textContent     = allOrders.length;
  document.getElementById('s-confirmed').textContent = allOrders.filter(o => o.order_status === 'confirmed').length;
  document.getElementById('s-search').textContent    = allOrders.filter(o => o.order_status === 'search_tomorrow').length;
  document.getElementById('s-notfound').textContent  = allOrders.filter(o => o.order_status === 'not_found').length;
  document.getElementById('badge-pending').textContent = allOrders.filter(o => o.order_status === 'pending').length;
  document.getElementById('badge-search').textContent  = allOrders.filter(o => o.order_status === 'search_tomorrow').length;
}

let renderLimitOrders = 50;

function renderOrders(reset = true) {
  if (reset) renderLimitOrders = 50;
  const q  = document.getElementById('order-search').value.toLowerCase();
  const st = document.getElementById('order-status-filter').value;

  const rows = allOrders.filter(o => {
    const matchQ = !q || o.buyer_name?.toLowerCase().includes(q) || o.book_title?.toLowerCase().includes(q);
    const matchS = !st || o.order_status === st;
    return matchQ && matchS;
  });

  const NEXT = {
    pending:         [['confirmed','Konfirmasi','green'], ['search_tomorrow','Cari besok','amber'], ['not_found','Tdk ada','red']],
    reserved:        [['confirmed','Konfirmasi','green'], ['search_tomorrow','Cari besok','amber']],
    confirmed:       [],
    search_tomorrow: [['confirmed','Ketemu!','green'], ['not_found','Tdk ketemu','red']],
    not_found:       [],
  };

  const toRender = rows.slice(0, renderLimitOrders);

  document.getElementById('orders-tbody').innerHTML = toRender.length
    ? toRender.map(o => {
        const btns = (NEXT[o.order_status] || [])
          .map(([st, lbl, cls]) =>
            `<button class="btn-xs ${cls}" onclick="changeOrderStatus('${o.order_id}','${st}','${o.event_day}')">${lbl}</button>`
          ).join('');
        
        const imgThumbUrl = getThumbnailUrl(o.photo_url, 100);
        const imgThumb = (imgThumbUrl && String(imgThumbUrl).startsWith('http')) 
          ? `<img src="${imgThumbUrl}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;">`
          : '';

        return `
        <tr>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--muted);">${o.order_id}</span></td>
          <td>
            <div style="font-weight:600;">${o.buyer_name}</div>
            <div style="font-family:var(--mono);font-size:10px;color:var(--muted);">${o.buyer_wa}</div>
          </td>
          <td>
            <div style="display:flex; align-items:center;">
              ${imgThumb}
              <div>
                <div>${o.book_title}</div>
                <div style="font-size:11px;color:var(--muted);">Day ${o.event_day}</div>
              </div>
            </div>
          </td>
          <td style="font-weight:600;">${formatRp(o.total)}</td>
          <td><span class="badge b-${o.order_status}">${o.order_status}</span></td>
          <td><div class="actions">${btns || '<span style="color:var(--muted);font-size:11px;">—</span>'}</div></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6"><div class="empty"><span class="icon">📭</span>Tidak ada order</div></td></tr>';

  if (renderLimitOrders < rows.length) {
    const sentinel = document.createElement('tr');
    sentinel.innerHTML = '<td colspan="6" style="text-align:center; padding:16px; color:var(--muted);">Memuat lebih banyak...</td>';
    document.getElementById('orders-tbody').appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderLimitOrders += 50;
        renderOrders(false);
      }
    });
    observer.observe(sentinel);
  }
}

async function changeOrderStatus(orderId, newStatus, eventDay) {
  const searchDay = newStatus === 'search_tomorrow' ? Number(eventDay) + 1 : '';
  showLoading('Mengupdate status...');
  try {
    await api({ action: 'updateOrderStatus', order_id: orderId, new_status: newStatus, search_day: searchDay });
    // Optimasi: Update state lokal tanpa harus memuat ulang semua data dari server
    const oIndex = allOrders.findIndex(o => o.order_id === orderId);
    if (oIndex !== -1) {
      allOrders[oIndex].order_status = newStatus;
      if (searchDay) allOrders[oIndex].search_day = searchDay;
      renderOrders(true);
      updateOrderStats();
      // Update data di tab search besok jika sedang aktif
      if (document.getElementById('page-search').classList.contains('active')) {
        loadSearchTomorrow();
      }
    } else {
      await loadOrders();
    }
    toast('Status diupdate: ' + newStatus, 'ok');
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  hideLoading();
}

// ── BOOKS ─────────────────────────────────────────────────────
async function loadBooks() {
  showLoading('Memuat katalog...');
  try {
    const res = await api({ action: 'getBooks' });
    allBooks  = res.books || [];
    renderBooks();
  } catch(e) { toast('Gagal memuat buku', 'err'); }
  hideLoading();
}

let renderLimitBooks = 50;

function renderBooks(reset = true) {
  if (reset) renderLimitBooks = 50;
  const q  = document.getElementById('book-search').value.toLowerCase();
  const st = document.getElementById('book-status-filter').value;

  const rows = allBooks.filter(b => {
    const matchQ = !q || String(b.title||'').toLowerCase().includes(q) || String(b.author||'').toLowerCase().includes(q);
    const matchS = !st || b.status === st;
    return matchQ && matchS;
  });

  const toRender = rows.slice(0, renderLimitBooks);

  document.getElementById('books-tbody').innerHTML = toRender.length
    ? toRender.map(b => {
        const thumbSrc = getThumbnailUrl(b.photo_url, 200);
        const thumb = thumbSrc
          ? `<img class="thumb-click" src="${thumbSrc}" onclick="openPhotoZoom('${b.photo_url}')"
              style="width:52px;height:52px;object-fit:cover;border-radius:8px;display:block;">`
          : `<div style="width:52px;height:52px;background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">📷</div>`;

        const titleDisplay = b.title
          ? `<div style="font-weight:600;">${b.title}</div>`
          : `<div style="font-weight:600;color:var(--red);">[Belum diisi]</div>`;

        return `
        <tr>
          <td style="font-family:var(--mono);font-size:11px;color:var(--muted);">${b.book_id}</td>
          <td>${thumb}</td>
          <td>
            ${titleDisplay}
            <div style="font-size:11px;color:var(--muted);">${b.author || '—'}</div>
          </td>
          <td style="font-family:var(--mono);">${b.price ? formatRp(b.price) : '<span style="color:var(--muted);">—</span>'}</td>
          <td style="font-family:var(--mono);font-weight:600;">${b.table_code}</td>
          <td><span class="badge b-${b.status}">${b.status}</span></td>
          <td>
            <button class="btn-xs blue" onclick='openEditModal(${JSON.stringify(b)})'>✏️ Edit</button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7"><div class="empty">Tidak ada buku</div></td></tr>';

  if (renderLimitBooks < rows.length) {
    const sentinel = document.createElement('tr');
    sentinel.innerHTML = '<td colspan="7" style="text-align:center; padding:16px; color:var(--muted);">Memuat lebih banyak...</td>';
    document.getElementById('books-tbody').appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderLimitBooks += 50;
        renderBooks(false);
      }
    });
    observer.observe(sentinel);
  }
}

// ── PHOTO ZOOM ────────────────────────────────────────────────
function openPhotoZoom(url) {
  document.getElementById('photo-zoom-img').src = url;
  document.getElementById('photo-zoom-overlay').classList.add('show');
}
function closePhotoZoom() {
  document.getElementById('photo-zoom-overlay').classList.remove('show');
}
function openPhotoZoomFromModal() {
  const src = document.getElementById('em-photo').src;
  if (src) openPhotoZoom(src);
}

// ── EDIT BOOK MODAL ───────────────────────────────────────────
let _editingBookId = null;
let _newPhotoBase64 = null;

function openEditModal(b) {
  _editingBookId = b.book_id;
  _newPhotoBase64 = null;
  document.getElementById('em-file').value = '';
  document.getElementById('em-photo-hint').textContent = 'Klik foto untuk perbesar';

  document.getElementById('em-id').textContent   = b.book_id;
  document.getElementById('em-title').value      = b.title  || '';
  document.getElementById('em-author').value     = b.author || '';
  document.getElementById('em-price').value      = b.price  || '';
  document.getElementById('em-category').value   = b.category || 'reguler';
  document.getElementById('em-status').value     = b.status || 'available';

  const photo = document.getElementById('em-photo');
  if (b.photo_url) {
    photo.src = b.photo_url;
    photo.style.display = 'block';
  } else {
    photo.style.display = 'none';
  }

  document.getElementById('edit-book-overlay').classList.add('show');
  setTimeout(() => document.getElementById('em-title').focus(), 200);
}

function handleModalPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _newPhotoBase64 = e.target.result.split(',')[1];
    document.getElementById('em-photo').src = e.target.result;
    document.getElementById('em-photo').style.display = 'block';
    document.getElementById('em-photo-hint').textContent = 'Foto baru terpilih (Belum disimpan)';
    document.getElementById('em-photo-hint').style.color = 'var(--accent)';
  };
  reader.readAsDataURL(file);
}

function closeEditModal() {
  document.getElementById('edit-book-overlay').classList.remove('show');
  _editingBookId = null;
  _newPhotoBase64 = null;
}

async function saveBookEdit() {
  if (!_editingBookId) return;
  const payload = {
    action:     'editBook',
    book_id:    _editingBookId,
    new_title:  document.getElementById('em-title').value.trim(),
    new_author: document.getElementById('em-author').value.trim(),
    new_price:  document.getElementById('em-price').value,
    new_category: document.getElementById('em-category').value,
    new_status: document.getElementById('em-status').value,
  };

  if (_newPhotoBase64) {
    payload.new_photo_data = _newPhotoBase64;
    payload.new_photo_name = 'UPDATE_' + _editingBookId + '.jpg';
  }

  showLoading('Menyimpan...');
  try {
    await api(payload);
    closeEditModal();
    
    // Optimasi: Jika ada upload foto baru, kita harus load dari server untuk mendapat URL Google Drive baru.
    // Jika tidak ada foto baru, kita cukup update array lokal agar jauh lebih cepat.
    if (_newPhotoBase64) {
      await loadBooks();
    } else {
      const bIndex = allBooks.findIndex(b => b.book_id === _editingBookId);
      if (bIndex !== -1) {
        allBooks[bIndex].title = payload.new_title;
        allBooks[bIndex].author = payload.new_author;
        allBooks[bIndex].price = payload.new_price;
        allBooks[bIndex].category = payload.new_category;
        allBooks[bIndex].status = payload.new_status;
        renderBooks(true);
      } else {
        await loadBooks();
      }
    }
    
    toast('✓ Data buku diperbarui', 'ok');
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  hideLoading();
}

// Tutup modal dengan ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeEditModal(); closePhotoZoom(); }
});

// ── SEARCH TOMORROW ───────────────────────────────────────────
async function loadSearchTomorrow() {
  showLoading('Memuat...');
  const day = document.getElementById('day-filter-search').value;
  try {
    const res    = await api({ action: 'getOrders', status: 'search_tomorrow', event_day: day || undefined });
    const orders = res.orders || [];
    document.getElementById('badge-search').textContent = orders.length;
    document.getElementById('search-tbody').innerHTML = orders.length
      ? orders.map(o => `
        <tr>
          <td style="font-family:var(--mono);font-size:11px;">${o.order_id}</td>
          <td style="font-weight:600;">${o.buyer_name}</td>
          <td style="font-family:var(--mono);font-size:11px;">${o.buyer_wa}</td>
          <td>${o.book_title}</td>
          <td style="text-align:center;">${o.search_day || Number(o.event_day)+1}</td>
          <td>
            <div class="actions">
              <button class="btn-xs green" onclick="changeOrderStatus('${o.order_id}','confirmed','${o.event_day}')">✓ Ketemu</button>
              <button class="btn-xs red"   onclick="changeOrderStatus('${o.order_id}','not_found','${o.event_day}')">✗ Tdk ketemu</button>
            </div>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="6"><div class="empty"><span class="icon">🎉</span>Tidak ada buku yang perlu dicari besok</div></td></tr>';
  } catch(e) { toast('Gagal memuat', 'err'); }
  hideLoading();
}

// ── PAYMENT ───────────────────────────────────────────────────
async function loadPayments() {
  showLoading('Memuat pembayaran...');
  const day = document.getElementById('day-filter-pay').value;
  try {
    const res   = await api({ action: 'getPayments', event_day: day || undefined });
    allPayments = res.payments || [];

    const totalTagihan = allPayments.reduce((s,p) => s + Number(p.subtotal    || 0), 0);
    const totalMasuk   = allPayments.reduce((s,p) => s + Number(p.amount_paid || 0), 0);
    document.getElementById('p-tagihan').textContent = formatRp(totalTagihan);
    document.getElementById('p-masuk').textContent   = formatRp(totalMasuk);
    document.getElementById('p-kurang').textContent  = formatRp(totalTagihan - totalMasuk);
    document.getElementById('p-count').textContent   = allPayments.length;

    document.getElementById('payment-tbody').innerHTML = allPayments.length
      ? allPayments.map(p => `
        <tr>
          <td style="font-family:var(--mono);font-size:11px;">${p.payment_id}</td>
          <td style="font-weight:600;">${p.buyer_name}</td>
          <td style="font-family:var(--mono);font-size:11px;">${p.buyer_wa}</td>
          <td>${p.event_day}</td>
          <td>${formatRp(p.subtotal)}</td>
          <td style="font-weight:600;">${formatRp(p.amount_paid)}</td>
          <td><span class="badge b-${p.pay_status}">${p.pay_status}</span></td>
          <td style="font-size:12px;">${p.payment_method || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="8"><div class="empty">Belum ada pembayaran</div></td></tr>';
  } catch(e) { toast('Gagal memuat pembayaran', 'err'); }
  hideLoading();
}

async function confirmPayment() {
  const wa     = document.getElementById('cf-wa').value.trim();
  const day    = document.getElementById('cf-day').value;
  const amount = Number(document.getElementById('cf-amount').value);
  const method = document.getElementById('cf-method').value;

  if (!wa || !day || !amount) { toast('Lengkapi semua field konfirmasi', 'err'); return; }

  showLoading('Menyimpan konfirmasi...');
  try {
    await api({ action: 'confirmPayment', buyer_wa: wa, event_day: day, amount_paid: amount, payment_method: method });
    await loadPayments();
    document.getElementById('cf-wa').value = '';
    document.getElementById('cf-amount').value = '';
    toast('✓ Pembayaran terkonfirmasi', 'ok');
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  hideLoading();
}

// ── PENGATURAN FEE ───────────────────────────────────────────
async function loadFeeRules(isManual = false) {
  showLoading('Memuat aturan fee...');
  try {
    const res = await api({ action: 'getFeeRules' });
    const rules = res.rules || [];
    renderFeeRules(rules);
    
    if (isManual) {
      // Jika refresh manual, update juga dropdown-nya
      const configRes = await api({ action: 'getConfig' });
      cfg = configRes.cfg;
      populateCategoryDropdown();
      toast('Berhasil sinkronisasi dengan Google Sheet', 'ok');
    }
  } catch(e) { toast('Gagal memuat fee: ' + e.message, 'err'); }
  hideLoading();
}

function renderFeeRules(rules) {
  const tbody = document.getElementById('fee-tbody');
  if (!tbody) return;
  
  if (!rules.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty"><b>Sheet Kosong / Tidak Ditemukan</b><br>Pastikan sheet bernama "ConfigFee" dan baris 1 adalah header.</div></td></tr>';
    return;
  }

  tbody.innerHTML = rules.map(r => `
    <tr>
      <td><span class="fee-row-${r.type}">${r.type === 'category' ? '📁 Kategori' : '🏷️ Tier'}</span></td>
      <td>
        ${r.type === 'category' ? `<strong>${r.name}</strong>` : `Rp ${Number(r.min_price).toLocaleString()} - ${r.max_price >= 9999999 ? '∞' : 'Rp ' + Number(r.max_price).toLocaleString()}`}
      </td>
      <td style="font-weight:700; color:var(--accent)">${formatRp(r.fee)}</td>
      <td style="text-align:right">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn-xs blue" onclick='openFeeModal(${JSON.stringify(r)})'>Edit</button>
          <button class="btn-xs red" onclick="deleteFeeRule(${r.row_id})">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleFeeFields() {
  const type = document.getElementById('ef-type').value;
  const nameLabel = document.getElementById('ef-name-label');
  const tierBox = document.getElementById('ef-tier-fields');
  
  if (type === 'category') {
    nameLabel.textContent = 'Nama Kategori';
    tierBox.style.display = 'none';
  } else {
    nameLabel.textContent = 'Nama Label (Opsional)';
    tierBox.style.display = 'block';
  }
}

function openFeeModal(r = null) {
  const overlay = document.getElementById('fee-modal-overlay');
  const title = document.getElementById('fee-modal-title');
  
  if (r) {
    title.textContent = 'Edit Aturan Fee';
    document.getElementById('ef-row-id').value = r.row_id;
    document.getElementById('ef-type').value = r.type;
    document.getElementById('ef-name').value = r.name || '';
    document.getElementById('ef-min').value = r.min_price || '';
    document.getElementById('ef-max').value = r.max_price || '';
    document.getElementById('ef-fee').value = r.fee || '';
  } else {
    title.textContent = 'Aturan Fee Baru';
    document.getElementById('ef-row-id').value = '';
    document.getElementById('ef-type').value = 'category';
    document.getElementById('ef-name').value = '';
    document.getElementById('ef-min').value = '';
    document.getElementById('ef-max').value = '';
    document.getElementById('ef-fee').value = '';
  }
  
  toggleFeeFields();
  overlay.classList.add('show');
}

function closeFeeModal() {
  document.getElementById('fee-modal-overlay').classList.remove('show');
}

async function saveFeeRule() {
  const payload = {
    action: 'saveFeeRule',
    row_id: document.getElementById('ef-row-id').value,
    type:   document.getElementById('ef-type').value,
    name:   document.getElementById('ef-name').value.trim(),
    min_price: document.getElementById('ef-min').value,
    max_price: document.getElementById('ef-max').value,
    fee:    document.getElementById('ef-fee').value
  };

  if (!payload.fee) { toast('Isi jumlah fee', 'err'); return; }
  
  showLoading('Menyimpan...');
  try {
    await api(payload);
    closeFeeModal();
    loadFeeRules();
    toast('Aturan fee disimpan', 'ok');

    // Update config lokal agar dropdown ikut berubah
    const res = await api({ action: 'getConfig' });
    cfg = res.cfg;
    populateCategoryDropdown();
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  hideLoading();
}

async function deleteFeeRule(rowId) {
  if (!confirm('Hapus aturan ini?')) return;
  showLoading('Menghapus...');
  try {
    await api({ action: 'deleteFeeRule', row_id: rowId });
    loadFeeRules();
    toast('Aturan dihapus', 'ok');
    
    // Update config lokal agar dropdown ikut berubah
    const res = await api({ action: 'getConfig' });
    cfg = res.cfg;
    populateCategoryDropdown();
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  hideLoading();
}

function populateCategoryDropdown() {
  const rules = (cfg && cfg.fee_rules) ? cfg.fee_rules : [];
  const categories = rules.filter(r => String(r.type).toLowerCase() === 'category');
  
  const html = `
    <option value="reguler">Reguler (Ikut Harga)</option>
    ${categories.map(c => `<option value="${c.name}">${c.name.toUpperCase()} (Fee ${formatRp(c.fee)})</option>`).join('')}
  `;
  
  const el = document.getElementById('em-category');
  if (el) el.innerHTML = html;
}

// ── LISTENERS ────────────────────────────────────────────────
document.getElementById('order-search')?.addEventListener('input', () => renderOrders(true));
document.getElementById('book-search')?.addEventListener('input', () => renderBooks(true));

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'auth-pass') doAuth();
});

// ── INLINE EDIT BUKU (Full) ──────────────────────────────────
