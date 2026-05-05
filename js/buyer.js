// ============================================================
//  BUYER — Logic
// ============================================================

const EMOJIS = ['📗','📘','📙','📕','📒','📓','📔'];
const STATUS_LABEL = {
  pending:         'Menunggu konfirmasi',
  reserved:        '✓ Buku dipegang',
  confirmed:       '✓ Terkonfirmasi',
  search_tomorrow: '🔍 Dicari besok',
  not_found:       '✗ Tidak ketemu',
};

let allBooks     = [];
let activeFilter = '';
let selectedBook = null;
let cfg          = {};

// ── INIT ─────────────────────────────────────────────────────
window.onload = async () => {
  showLoading('Memuat katalog...');
  try {
    const [cfgRes, booksRes] = await Promise.all([
      api({ action: 'getConfig' }),
      api({ action: 'getBooks', forBuyer: true })
    ]);
    cfg      = cfgRes.cfg;
    allBooks = booksRes.books || [];

    document.getElementById('jastip-name').textContent = cfg.jastiper_name || 'Jastip Buku';
    document.getElementById('event-label').textContent = cfg.event_name    || '';

    const day = calcEventDay(cfg.event_start_date, cfg.event_duration_days);
    const banner = document.getElementById('banner');
    banner.style.display = 'block';
    banner.textContent = `📅 Hari ke-${day} dari ${cfg.event_duration_days} hari · ${allBooks.length} buku tersedia`;

    // prefill WA dari localStorage
    const savedWa = localStorage.getItem('buyer_wa') || '';
    if (savedWa) document.getElementById('panel-wa').value = savedWa;

    renderBooks();
  } catch(e) {
    document.getElementById('book-list').innerHTML =
      '<div class="empty"><span class="icon">⚠️</span>Gagal memuat katalog.<br>Coba refresh halaman.</div>';
  }
  hideLoading();
};

// ── RENDER BOOKS ──────────────────────────────────────────────
function renderBooks() {
  const q  = document.getElementById('search-input').value.trim().toLowerCase();
  const st = activeFilter;

  const books = allBooks.filter(b => {
    const matchQ = !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q);
    const matchS = !st || b.status === st;
    return matchQ && matchS;
  });

  if (!books.length) {
    document.getElementById('book-list').innerHTML =
      '<div class="empty"><span class="icon">🔍</span>Tidak ada buku yang cocok</div>';
    return;
  }

  document.getElementById('book-list').innerHTML = books.map((b, i) => {
    const emoji    = EMOJIS[i % EMOJIS.length];
    const sold     = b.status === 'sold' || b.status === 'not_found';
    const reserved = b.status === 'reserved';
    const badgeCls = sold ? 'badge-sold' : reserved ? 'badge-reserved' : 'badge-available';
    const badgeTxt = sold ? 'Habis' : reserved ? '🔒 Reserved' : '✓ Tersedia';
    const click    = sold ? '' : `onclick="selectBook('${b.book_id}')"`;

    return `
      <div class="book-item ${reserved ? 'reserved' : ''} ${sold ? 'soldout' : ''}" ${click}>
        <div class="book-emoji">${emoji}</div>
        <div class="book-body">
          <div class="book-title">${b.title || '—'}</div>
          <div class="book-author">${b.author || 'Penulis tidak dicantumkan'}</div>
          <div class="book-footer">
            <div>
              <div class="book-price">${formatRp(b.price)}</div>
              <div class="book-table">Meja ${b.table_code} · Day ${b.event_day}</div>
            </div>
            <span class="status-badge ${badgeCls}">${badgeTxt}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function setFilter(el, status) {
  document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = status;
  renderBooks();
}

// ── SELECT BOOK → MODAL ───────────────────────────────────────
function selectBook(bookId) {
  const b = allBooks.find(b => b.book_id === bookId);
  if (!b) return;
  selectedBook = b;

  const fee   = calcFee(b.price, cfg);
  const total = Number(b.price) + fee;

  document.getElementById('m-title').textContent  = b.title;
  document.getElementById('m-author').textContent = b.author || '';
  document.getElementById('m-price').textContent  = formatRp(b.price);
  document.getElementById('m-fee').textContent    = formatRp(fee);
  document.getElementById('m-total').textContent  = formatRp(total);

  // prefill dari localStorage
  document.getElementById('m-name').value = localStorage.getItem('buyer_name') || '';
  document.getElementById('m-wa').value   = localStorage.getItem('buyer_wa')   || '';

  document.getElementById('modal-bg').classList.add('show');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-bg')) {
    document.getElementById('modal-bg').classList.remove('show');
  }
}

// ── SUBMIT ORDER ──────────────────────────────────────────────
async function submitOrder() {
  const name = document.getElementById('m-name').value.trim();
  const wa   = document.getElementById('m-wa').value.trim().replace(/\D/g, '');
  if (!name)            { toast('Masukkan nama kamu', 'err'); return; }
  if (wa.length < 9)    { toast('Nomor WA tidak valid', 'err'); return; }
  if (!selectedBook)    return;

  localStorage.setItem('buyer_name', name);
  localStorage.setItem('buyer_wa',   wa);

  showLoading('Mengirim order...');
  try {
    const res = await api({
      action: 'submitOrder',
      buyer_name: name,
      buyer_wa:   wa,
      book_id:    selectedBook.book_id
    });

    // update status lokal
    const b = allBooks.find(b => b.book_id === selectedBook.book_id);
    if (b) b.status = 'reserved';
    renderBooks();

    document.getElementById('modal-bg').classList.remove('show');
    hideLoading();
    toast('✓ Order terkirim! Total: ' + formatRp(res.total), 'ok');
  } catch(e) {
    hideLoading();
    toast('Gagal: ' + (e.message || 'coba lagi'), 'err');
  }
}

// ── MY ORDERS PANEL ───────────────────────────────────────────
function openPanel()  { document.getElementById('panel-bg').classList.add('show'); }
function closePanel() { document.getElementById('panel-bg').classList.remove('show'); }

async function loadMyOrders() {
  const wa = document.getElementById('panel-wa').value.trim().replace(/\D/g, '');
  if (wa.length < 9) { toast('Masukkan nomor WA yang valid', 'err'); return; }

  localStorage.setItem('buyer_wa', wa);
  showLoading('Memuat order...');
  try {
    const res = await api({ action: 'getBuyerOrders', buyer_wa: wa });
    hideLoading();
    renderMyOrders(res.orders || []);
  } catch(e) {
    hideLoading();
    toast('Gagal memuat order', 'err');
  }
}

function renderMyOrders(orders) {
  const el = document.getElementById('my-orders-list');
  if (!orders.length) {
    el.innerHTML = '<div class="empty"><span class="icon">📭</span>Belum ada order</div>';
    return;
  }

  const confirmed = orders.filter(o => o.order_status === 'confirmed' || o.order_status === 'reserved');
  const gtotal    = confirmed.reduce((s, o) => s + Number(o.total || 0), 0);

  el.innerHTML = `
    ${gtotal > 0 ? `
    <div class="grand-total-box">
      <div class="grand-total-label">Total yang perlu dibayar</div>
      <div class="grand-total-val">${formatRp(gtotal)}</div>
    </div>` : ''}
    ${orders.map(o => `
    <div class="order-card">
      <div class="order-card-title">${o.book_title || o.book_id}</div>
      <div class="order-card-meta">Day ${o.event_day} · ${formatRp(o.book_price)} + fee ${formatRp(o.fee_jastip)}</div>
      <div class="order-card-footer">
        <div class="order-total">${formatRp(o.total)}</div>
        <span class="order-st st-${o.order_status}">${STATUS_LABEL[o.order_status] || o.order_status}</span>
      </div>
    </div>`).join('')}
    <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;font-family:var(--mono);">
      Hubungi admin via WA untuk konfirmasi pembayaran
    </div>`;
}
