// ============================================================
//  ADMIN 2 — Logic (Updated with Photo Preview)
// ============================================================

let allOrders   = [];
let allBooks    = [];
let allPayments = [];
let cfg          = {};

// ── AUTH ─────────────────────────────────────────────────────
window.onload = async () => {
  if (sessionStorage.getItem('admin2_auth') === 'true') {
    try {
      const res = await api({ action: 'getConfig' });
      cfg = res.cfg;
      document.getElementById('auth-gate').style.display = 'none';
      initDaySelects();
      await loadOrders();
    } catch(e) {}
  }
};

async function doAuth() {
  const pass = document.getElementById('auth-pass').value.trim();
  if (!pass) return;
  showLoading('Verifikasi...');
  try {
    const res = await api({ action: 'getConfig' });
    cfg = res.cfg;
    if (String(pass) !== String(cfg.admin_password)) {
      hideLoading();
      document.getElementById('auth-err').textContent = 'Password salah';
      return;
    }
    document.getElementById('auth-gate').style.display = 'none';
    sessionStorage.setItem('admin2_auth', 'true');
    initDaySelects();
    await loadOrders();
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
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  navEl.classList.add('active');
  if (name === 'books')    loadBooks();
  if (name === 'search')  loadSearchTomorrow();
  if (name === 'payment') loadPayments();
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

function renderOrders() {
  const q  = document.getElementById('order-search').value.toLowerCase();
  const st = document.getElementById('order-status-filter').value;

  const rows = allOrders.filter(o => {
    const matchQ = !q || o.buyer_name?.toLowerCase().includes(q) || o.book_title?.toLowerCase().includes(q);
    const matchS = !st || o.order_status === st;
    return matchQ && matchS;
  });

  const NEXT = {
    pending:         [['reserved','Ambil buku','green'], ['not_found','Tdk ada','red']],
    reserved:        [['confirmed','Konfirmasi','green'], ['search_tomorrow','Cari besok','amber']],
    confirmed:       [],
    search_tomorrow: [['confirmed','Ketemu!','green'], ['not_found','Tdk ketemu','red']],
    not_found:       [],
  };

  document.getElementById('orders-tbody').innerHTML = rows.length
    ? rows.map(o => {
        const btns = (NEXT[o.order_status] || [])
          .map(([st, lbl, cls]) =>
            `<button class="btn-xs ${cls}" onclick="changeOrderStatus('${o.order_id}','${st}','${o.event_day}')">${lbl}</button>`
          ).join('');
        
        // Tambahan: Preview foto kecil jika ada
        const imgThumb = (o.photo_url && String(o.photo_url).startsWith('http')) 
          ? `<img src="${o.photo_url}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;">`
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
}

async function changeOrderStatus(orderId, newStatus, eventDay) {
  const searchDay = newStatus === 'search_tomorrow' ? Number(eventDay) + 1 : '';
  showLoading('Mengupdate status...');
  try {
    await api({ action: 'updateOrderStatus', order_id: orderId, new_status: newStatus, search_day: searchDay });
    await loadOrders();
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

function renderBooks() {
  const q  = document.getElementById('book-search').value.toLowerCase();
  const st = document.getElementById('book-status-filter').value;

  const rows = allBooks.filter(b => {
    const matchQ = !q || b.title?.toLowerCase().includes(q);
    const matchS = !st || b.status === st;
    return matchQ && matchS;
  });

  document.getElementById('books-tbody').innerHTML = rows.length
    ? rows.map(b => {
        const imgThumb = b.photo_url 
          ? `<img src="${b.photo_url}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;">`
          : '';
        
        return `
        <tr>
          <td style="font-family:var(--mono);font-size:11px;color:var(--muted);">${b.book_id}</td>
          <td>
            <div style="display:flex; align-items:center;">
              ${imgThumb}
              <div>
                <div style="font-weight:600;">${b.title}</div>
                <div style="font-size:11px;color:var(--muted);">${b.author || ''}</div>
              </div>
            </div>
          </td>
          <td style="font-family:var(--mono);">${formatRp(b.price)} <button onclick="editBookPrice('', '')" style="background:none;border:none;cursor:pointer;font-size:12px;" title="Edit Harga">✏️</button></td>
          <td style="font-family:var(--mono);font-weight:600;">${b.table_code}</td>
          <td>${b.event_day}</td>
          <td><span class="badge b-${b.status}">${b.status}</span> <button onclick="editBookStatus('', '')" style="background:none;border:none;cursor:pointer;font-size:12px;" title="Edit Status">✏️</button></td>
          <td style="font-size:11px;color:var(--muted);">${b.submitted_by || ''}</td>
        </tr>`}).join('')
    : '<tr><td colspan="7"><div class="empty">Tidak ada buku</div></td></tr>';
}

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

// Tambahkan Event Listener untuk Search Input agar realtime
document.getElementById('order-search')?.addEventListener('input', renderOrders);
document.getElementById('book-search')?.addEventListener('input', renderBooks);

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'auth-pass') doAuth();
});

// ── INLINE EDIT BUKU ──────────────────────────────────────────
async function editBookPrice(bookId, currentPrice) {
  const newPrice = prompt('Ubah harga buku (masukkan angka saja):', currentPrice);
  if (!newPrice || isNaN(newPrice) || newPrice === currentPrice) return;
  
  showLoading('Menyimpan harga...');
  try {
    await api({ action: 'editBook', book_id: bookId, new_price: newPrice });
    await loadBooks();
    toast('Harga berhasil diubah', 'ok');
  } catch(e) { toast('Gagal mengubah harga', 'err'); }
  hideLoading();
}

async function editBookStatus(bookId, currentStatus) {
  const newStatus = prompt('Ubah status buku (available / reserved / sold / not_found):', currentStatus);
  if (!newStatus || newStatus === currentStatus) return;
  
  const valid = ['available','reserved','sold','not_found'];
  if(!valid.includes(newStatus.toLowerCase())) {
    toast('Status tidak valid', 'err');
    return;
  }

  showLoading('Menyimpan status...');
  try {
    await api({ action: 'editBook', book_id: bookId, new_status: newStatus.toLowerCase() });
    await loadBooks();
    toast('Status berhasil diubah', 'ok');
  } catch(e) { toast('Gagal mengubah status', 'err'); }
  hideLoading();
}


