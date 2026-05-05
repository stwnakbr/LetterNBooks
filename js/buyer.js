// ============================================================
//  BUYER — Logic (Fixed Emojis & Modal Bug)
// ============================================================

const EMOJIS = ['📚', '📖', '📙', '📘', '📗', '📕', '📔'];
const STATUS_LABEL = {
  pending: 'Menunggu konfirmasi',
  reserved: '⏳ Buku dipegang',
  confirmed: '✅ Terkonfirmasi',
  search_tomorrow: '🔍 Dicari besok',
  not_found: '❌ Tidak ketemu',
};

let allBooks = [];
let activeFilter = '';
let selectedBook = null;
let cfg = {};
let myOrderBookIds = new Set();

// -- INIT -----------------------------------------------------
window.onload = async () => {
  showLoading('Memuat katalog...');
  try {
    const [cfgRes, booksRes] = await Promise.all([
      api({ action: 'getConfig' }),
      api({ action: 'getBooks', forBuyer: true })
    ]);

    cfg = cfgRes.cfg;
    allBooks = booksRes.books || [];

    const jastipNameEl = document.getElementById('jastip-name');
    if (jastipNameEl) jastipNameEl.textContent = cfg.jastiper_name || 'Jastip Buku';

    const eventLabelEl = document.getElementById('event-label');
    if (eventLabelEl) eventLabelEl.textContent = cfg.event_name || '';

    const day = calcEventDay(cfg.event_start_date, cfg.event_duration_days);
    const banner = document.getElementById('banner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = `🚀 Hari ke-${day} dari ${cfg.event_duration_days} hari · ${allBooks.length} buku tersedia`;
    }

    const savedWa = localStorage.getItem('buyer_wa') || '';
    if (savedWa && document.getElementById('panel-wa')) {
      document.getElementById('panel-wa').value = savedWa;
      // Silently fetch to know which books were ordered by this user
      api({ action: 'getBuyerOrders', buyer_wa: savedWa }).then(res => {
        if (res.orders) {
          // Filter ekstra di frontend untuk memastikan hanya order dari WA ini yang ditandai
          const normWa = String(savedWa).replace(/\D/g, '').replace(/^0|^62/, '');
          const myRealOrders = res.orders.filter(o => {
            const normO = String(o.buyer_wa).replace(/\D/g, '').replace(/^0|^62/, '');
            return normO === normWa;
          });
          myRealOrders.forEach(o => myOrderBookIds.add(o.book_id));
          renderBooks();
        }
      }).catch(e => console.log('Silent load orders failed'));
    }

    renderBooks();
  } catch (e) {
    console.error(e);
    document.getElementById('book-list').innerHTML =
      '<div class="empty"><span class="icon">😢</span>Gagal memuat katalog.<br>Coba refresh halaman.</div>';
  }
  hideLoading();
};

let renderLimit = 50;

// -- RENDER BOOKS ----------------------------------------------
function renderBooks(reset = true) {
  if (reset) renderLimit = 50;

  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const st = activeFilter;

  const books = allBooks.filter(b => {
    const matchQ = !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q);

    let matchS = true;
    const sold = b.status === 'sold' || b.status === 'not_found';
    if (st === 'available') matchS = !sold;
    else if (st === 'my_orders') matchS = myOrderBookIds.has(b.book_id);

    return matchQ && matchS;
  });

  const listEl = document.getElementById('book-list');
  if (!books.length) {
    listEl.innerHTML = '<div class="empty"><span class="icon">🔎</span>Tidak ada buku yang cocok</div>';
    return;
  }

  const toRender = books.slice(0, renderLimit);
  listEl.innerHTML = toRender.map((b, i) => {
    const emoji = EMOJIS[i % EMOJIS.length];
    const sold = b.status === 'sold' || b.status === 'not_found';
    const isMyOrder = myOrderBookIds.has(b.book_id);

    const photoContent = (b.photo_url && String(b.photo_url).startsWith('http'))
      ? `<div class="book-photo" style="background-image: url('${b.photo_url}')"></div>`
      : `<div class="book-emoji">${emoji}</div>`;

    let badgeCls, badgeTxt;
    if (sold) {
      badgeCls = 'badge-sold';
      badgeTxt = 'Habis';
    } else if (isMyOrder) {
      badgeCls = 'badge-reserved';
      badgeTxt = '📦 Diordermu';
    } else {
      badgeCls = 'badge-available';
      badgeTxt = '✅ Tersedia';
    }

    const click = sold ? '' : `onclick="selectBook('${b.book_id}')"`;

    return `
      <div class="book-item ${isMyOrder ? 'reserved' : ''} ${sold ? 'soldout' : ''}" ${click}>
        ${photoContent}
        <div class="book-body">
          <div class="book-title">${b.title || '—'}</div>
          <div class="book-author">${b.author || 'Penulis tidak dicantumkan'}</div>
          <div class="book-footer">
            <div>
              <div class="book-price">${formatRp(b.price)}</div>
              <div class="book-table">Meja ${b.table_code}</div>
            </div>
            <span class="status-badge ${badgeCls}">${badgeTxt}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  if (renderLimit < books.length) {
    const sentinel = document.createElement('div');
    sentinel.style.height = '40px';
    listEl.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderLimit += 50;
        renderBooks(false);
      }
    });
    observer.observe(sentinel);
  }
}

function setFilter(el, status) {
  document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = status;
  renderBooks(true);
}

// -- SELECT BOOK & MODAL ---------------------------------------
function selectBook(bookId) {
  const b = allBooks.find(b => b.book_id === bookId);
  if (!b) return;
  selectedBook = b;

  const fee = calcFee(b.price, b.category);
  const total = Number(b.price) + fee;

  document.getElementById('m-title').textContent = b.title;
  document.getElementById('m-author').textContent = b.author || '';
  document.getElementById('m-price').textContent = formatRp(b.price);
  document.getElementById('m-fee').textContent = formatRp(fee);
  document.getElementById('m-total').textContent = formatRp(total);

  const mImg = document.getElementById('m-img');
  if (mImg) {
    if (b.photo_url && String(b.photo_url).startsWith('http')) {
      mImg.src = b.photo_url;
      mImg.style.display = 'block';
    } else {
      mImg.style.display = 'none';
    }
  }

  document.getElementById('m-name').value = localStorage.getItem('buyer_name') || '';
  document.getElementById('m-wa').value = localStorage.getItem('buyer_wa') || '';

  document.getElementById('modal-bg').classList.add('show');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-bg')) {
    document.getElementById('modal-bg').classList.remove('show');
  }
}

// -- SUBMIT ORDER ----------------------------------------------
async function submitOrder() {
  const name = document.getElementById('m-name').value.trim();
  const wa = document.getElementById('m-wa').value.trim().replace(/\D/g, '');

  if (!name) { toast('Masukkan nama kamu', 'err'); return; }
  if (wa.length < 9) { toast('Nomor WA tidak valid', 'err'); return; }
  if (!selectedBook) return;

  localStorage.setItem('buyer_name', name);
  localStorage.setItem('buyer_wa', wa);

  showLoading('Mengirim order...');
  try {
    await api({
      action: 'submitOrder',
      buyer_name: name,
      buyer_wa: wa,
      book_id: selectedBook.book_id
    });

    myOrderBookIds.add(selectedBook.book_id);
    renderBooks();

    document.getElementById('modal-bg').classList.remove('show');
    hideLoading();
    toast('🚀 Order terkirim! Pesanan kamu segera diproses.', 'ok');
  } catch (e) {
    hideLoading();
    toast('Gagal: ' + (e.message || 'Terjadi kesalahan sistem'), 'err');
  }
}

// -- MY ORDERS PANEL -------------------------------------------
function openPanel() { document.getElementById('panel-bg').classList.add('show'); }

// PERBAIKAN: Fungsi close agar tidak tertutup saat klik tombol di dalam panel
function closePanel(e) {
  if (!e || e.target === document.getElementById('panel-bg')) {
    document.getElementById('panel-bg').classList.remove('show');
  }
}

async function loadMyOrders() {
  const wa = document.getElementById('panel-wa').value.trim().replace(/\D/g, '');
  if (wa.length < 9) { toast('Masukkan nomor WA yang valid', 'err'); return; }

  localStorage.setItem('buyer_wa', wa);
  showLoading('Memuat order kamu...');
  try {
    const res = await api({ action: 'getBuyerOrders', buyer_wa: wa });
    if (res.orders) {
      // Filter ekstra di frontend untuk keamanan
      const normWa = String(wa).replace(/\D/g, '').replace(/^0|^62/, '');
      const myRealOrders = res.orders.filter(o => {
        const normO = String(o.buyer_wa).replace(/\D/g, '').replace(/^0|^62/, '');
        return normO === normWa;
      });
      myRealOrders.forEach(o => myOrderBookIds.add(o.book_id));
      renderBooks(true); // Update UI in catalog behind the modal

      hideLoading();
      renderMyOrders(myRealOrders);
    } else {
      hideLoading();
      renderMyOrders([]);
    }
  } catch (e) {
    hideLoading();
    toast('Gagal memuat history order', 'err');
  }
}

function renderMyOrders(orders) {
  const el = document.getElementById('my-orders-list');
  if (!orders.length) {
    el.innerHTML = '<div class="empty"><span class="icon">📭</span>Belum ada order dengan nomor ini</div>';
    return;
  }

  const activeOrders = orders.filter(o => ['confirmed', 'reserved'].includes(o.order_status));
  const gtotal = activeOrders.reduce((s, o) => s + Number(o.total || 0), 0);

  el.innerHTML = `
    ${gtotal > 0 ? `
    <div class="grand-total-box">
      <div class="grand-total-label">Total Tagihan (Terkonfirmasi)</div>
      <div class="grand-total-val">${formatRp(gtotal)}</div>
    </div>` : ''}
    
    ${orders.map(o => `
    <div class="order-card">
      <div class="order-card-title">${o.book_title || 'ID: ' + o.book_id}</div>
      <div class="order-card-meta">
        ${formatRp(o.book_price)} + Jastip ${formatRp(o.fee_jastip)}
      </div>
      <div class="order-card-footer">
        <div class="order-total">${formatRp(o.total)}</div>
        <span class="order-st st-${o.order_status}">${STATUS_LABEL[o.order_status] || o.order_status}</span>
      </div>
    </div>`).join('')}
    
    <div class="panel-note">
      * Silakan hubungi admin via WhatsApp untuk proses pembayaran dan pengambilan buku.
    </div>`;
}

document.getElementById('search-input')?.addEventListener('input', () => renderBooks(true));
