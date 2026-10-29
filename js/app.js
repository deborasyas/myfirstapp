/**
 * Smart Grocery & Budget Safety Tracker - Main App Controller
 * Mobile-First PWA for Students pushing supermarket trolleys
 */

import { StorageService, QUICK_PRODUCTS } from './storage.js';
import { CartManager, CurrencyUtils, calculateMultiTierDiscount, compareWithStoreHistory } from './cart.js';
import { BudgetService } from './budget.js';
import { HistoryService } from './history.js';

// Initialize Core Services
StorageService.init();
const cartManager = new CartManager();

// Web Audio API Synthesizer Sound Effects (Zero external audio assets)
const SoundEffects = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playBeep(freq = 600, duration = 0.08, type = 'sine') {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  },
  playCoinChime() {
    this.playBeep(880, 0.07, 'sine');
    setTimeout(() => this.playBeep(1320, 0.12, 'sine'), 60);
  },
  playWarningBuzzer() {
    this.playBeep(320, 0.15, 'sawtooth');
    setTimeout(() => this.playBeep(260, 0.25, 'sawtooth'), 120);
  }
};

// Haptic Vibration Helper
function triggerHaptic(pattern = [40]) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

// Toast Alert
function showToast(message, icon = '✨') {
  const toast = document.getElementById('app-toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  if (toast && msgEl) {
    msgEl.textContent = message;
    iconEl.textContent = icon;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }
}

// Global DOM References
const storeSelect = document.getElementById('store-select');
const sessionDateInput = document.getElementById('session-date-input');
const cartItemsList = document.getElementById('cart-items-list');
const quickProductsChips = document.getElementById('quick-products-chips');
const cartItemCount = document.getElementById('cart-item-count');
const navCartBadge = document.getElementById('nav-cart-badge');

// Budget Banner Elements
const budgetBanner = document.getElementById('budget-banner');
const budgetSafetyIcon = document.getElementById('budget-safety-icon');
const budgetSafetyTitle = document.getElementById('budget-safety-title');
const budgetStatusPill = document.getElementById('budget-status-pill');
const valTotalSpent = document.getElementById('val-total-spent');
const valBudgetLimit = document.getElementById('val-budget-limit');
const budgetProgressBar = document.getElementById('budget-progress-bar');
const budgetSafetyNote = document.getElementById('budget-safety-note');
const smartCutContainer = document.getElementById('smart-cut-container');
const smartCutList = document.getElementById('smart-cut-list');

// Modals
const itemModalOverlay = document.getElementById('item-modal-overlay');
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const editItemId = document.getElementById('edit-item-id');
const inputItemName = document.getElementById('input-item-name');
const inputItemCategory = document.getElementById('input-item-category');
const inputItemUnit = document.getElementById('input-item-unit');
const inputItemQty = document.getElementById('input-item-qty');
const inputItemPrice = document.getElementById('input-item-price');
const inputItemDiscount = document.getElementById('input-item-discount');
const modalQtyMinus = document.getElementById('modal-qty-minus');
const modalQtyPlus = document.getElementById('modal-qty-plus');
const modalPriceComparator = document.getElementById('modal-price-comparator');
const modalComparatorIcon = document.getElementById('modal-comparator-icon');
const modalComparatorText = document.getElementById('modal-comparator-text');
const discountPreviewBox = document.getElementById('discount-preview-box');
const discountPreviewSummary = document.getElementById('discount-preview-summary');
const discountPreviewSteps = document.getElementById('discount-preview-steps');
const modalLiveSubtotal = document.getElementById('modal-live-subtotal');
const modalLiveSavings = document.getElementById('modal-live-savings');

// Finish Shopping Modal
const finishModalOverlay = document.getElementById('finish-modal-overlay');
const btnFinishShopping = document.getElementById('btn-finish-shopping');
const btnCloseFinishModal = document.getElementById('btn-close-finish-modal');
const btnConfirmSaveSession = document.getElementById('btn-confirm-save-session');

// New Store Modal
const newStoreModalOverlay = document.getElementById('new-store-modal-overlay');
const btnCloseStoreModal = document.getElementById('btn-close-store-modal');
const newStoreForm = document.getElementById('new-store-form');

// Tab navigation buttons
const navTabBtns = document.querySelectorAll('.nav-tab-btn');
const tabViews = {
  belanja: document.getElementById('tab-belanja-view'),
  riwayat: document.getElementById('tab-riwayat-view'),
  anggaran: document.getElementById('tab-anggaran-view')
};
const cartFloatingDock = document.getElementById('cart-floating-dock');

// ============================================================================
// INITIALIZATION & STORE SETUP
// ============================================================================
function initApp() {
  initClock();
  populateStoreDropdown();
  initDateInput();
  initQuickChips();
  renderCart();
  renderBudgetStatus();
  renderHistorySessions();
  renderCategoryBreakdown();
  initModalListeners();
  initTabs();
  initPWA();
  refreshLucideIcons();
}

function initClock() {
  const clockEl = document.getElementById('status-live-time');
  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hours}:${minutes}`;
  }
  updateTime();
  setInterval(updateTime, 30000);
}

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function populateStoreDropdown() {
  const stores = StorageService.getStores();
  const currentStore = cartManager.getStoreName();

  storeSelect.innerHTML = '';
  stores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    if (s.name === currentStore) opt.selected = true;
    storeSelect.appendChild(opt);
  });

  // Add Option to Add New Store
  const newOpt = document.createElement('option');
  newOpt.value = '__ADD_NEW__';
  newOpt.textContent = '➕ Tambah Toko Baru...';
  storeSelect.appendChild(newOpt);
}

function initDateInput() {
  const currentDate = cartManager.getDate();
  sessionDateInput.value = currentDate;

  sessionDateInput.addEventListener('change', (e) => {
    cartManager.setDate(e.target.value);
    showToast(`Tanggal transaksi: ${e.target.value}`);
  });

  storeSelect.addEventListener('change', (e) => {
    if (e.target.value === '__ADD_NEW__') {
      openNewStoreModal();
      // restore select
      storeSelect.value = cartManager.getStoreName();
      return;
    }
    cartManager.setStore(e.target.value);
    showToast(`Lokasi Toko: ${e.target.value}`);
    renderCart(); // Re-evaluates F-04 comparator tags against the new store!
  });
}

function initQuickChips() {
  quickProductsChips.innerHTML = '';
  QUICK_PRODUCTS.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quick-product-chip';
    chip.innerHTML = `
      <span class="quick-chip-name">${p.name}</span>
      <span class="quick-chip-price">${CurrencyUtils.formatRupiah(p.defaultPrice)}</span>
    `;
    chip.addEventListener('click', () => {
      SoundEffects.playCoinChime();
      triggerHaptic([30]);
      cartManager.addItem({
        name: p.name,
        category: p.category,
        unit: p.unit,
        qty: 1,
        originalPrice: p.defaultPrice,
        discountString: '0'
      });
      showToast(`+1 ${p.name} ke troli!`, '🛒');
      renderCart();
      renderBudgetStatus();
    });
    quickProductsChips.appendChild(chip);
  });
}

// ============================================================================
// CART RENDERING & F-02 (Perhitungan Kuantitas Otomatis) & F-04 (Komparator)
// ============================================================================
function renderCart() {
  const items = cartManager.getItems();
  const totals = cartManager.getTotals();

  // Update item count badges
  cartItemCount.textContent = `${totals.totalItemsCount} Item (${totals.uniqueCount} Jenis)`;
  if (navCartBadge) {
    navCartBadge.textContent = totals.totalItemsCount;
    navCartBadge.style.display = totals.totalItemsCount > 0 ? 'inline-block' : 'none';
  }

  if (items.length === 0) {
    cartItemsList.innerHTML = `
      <div class="empty-trolley-box">
        <div class="empty-icon-wrap">
          <i data-lucide="shopping-cart" style="width:32px; height:32px;"></i>
        </div>
        <h3>Troli Belanja Masih Kosong</h3>
        <p>Tekan tombol <strong>+ Masukkan Troli</strong> di bawah atau pilih item favorit di bawah saat mendorong troli.</p>
      </div>
    `;
    refreshLucideIcons();
    return;
  }

  cartItemsList.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grocery-item-card';

    // F-04 Comparison Tag HTML
    const comp = item.comparison || compareWithStoreHistory(cartManager.getStoreName(), item.name, item.originalPrice);
    let compBadgeHtml = '';

    if (comp && comp.status !== 'NONE') {
      compBadgeHtml = `
        <span class="price-comparator-badge ${comp.badgeClass}" title="${comp.desc || ''}">
          <span>${comp.symbol}</span>
          <span>${comp.label}</span>
        </span>
      `;
    }

    // F-03 Discount breakdown tag
    let discountTagHtml = '';
    if (item.discountString && item.discountString !== '0' && item.discountString !== '0%') {
      discountTagHtml = `
        <span class="discount-ribbon">Diskon: ${item.discountString}</span>
        <span class="original-price-strike">${CurrencyUtils.formatRupiah(item.originalPrice)}</span>
      `;
    }

    card.innerHTML = `
      <div class="item-card-top">
        <div class="item-title-group">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-tags-row">
            <span class="category-tag">${escapeHtml(item.category)}</span>
            <span class="category-tag">${escapeHtml(item.unit)}</span>
            ${compBadgeHtml}
          </div>
        </div>
        <div class="item-card-actions">
          <button type="button" class="card-action-icon edit-btn" title="Edit Item" data-id="${item.id}">
            <i data-lucide="pencil" style="width:14px; height:14px;"></i>
          </button>
          <button type="button" class="card-action-icon trash trash-btn" title="Hapus dari Troli" data-id="${item.id}">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </div>
      </div>

      <div class="item-card-mid">
        <div class="price-details">
          <div class="unit-price-line">
            ${discountTagHtml}
            <span style="font-weight:700; color:#34d399;">${CurrencyUtils.formatRupiah(item.finalUnitPrice)} / ${item.unit}</span>
          </div>
          <div class="item-subtotal-val">${CurrencyUtils.formatRupiah(item.subtotal)}</div>
        </div>

        <!-- F-02 Ergonomic Stepper Control (Large Touch Buttons) -->
        <div class="qty-stepper-control">
          <button type="button" class="stepper-btn minus-btn" data-id="${item.id}">−</button>
          <input type="number" class="stepper-input cart-qty-input" data-id="${item.id}" value="${item.qty}" min="1" inputmode="numeric">
          <button type="button" class="stepper-btn plus-btn" data-id="${item.id}">+</button>
        </div>
      </div>

      <div class="item-card-bottom">
        <span class="history-tooltip-text">
          ${comp && comp.desc ? comp.desc : `Tercatat di ${cartManager.getStoreName()}`}
        </span>
        ${item.discountSavings > 0 ? `
          <span style="font-size:11px; color:#fbbf24; font-weight:700;">
            Hemat ${CurrencyUtils.formatRupiah(item.discountSavings)}
          </span>
        ` : ''}
      </div>
    `;

    // Event Listeners for inline card interactions (F-02: Instant Qty recalculation)
    const btnMinus = card.querySelector('.minus-btn');
    const btnPlus = card.querySelector('.plus-btn');
    const qtyInput = card.querySelector('.cart-qty-input');
    const btnTrash = card.querySelector('.trash-btn');
    const btnEdit = card.querySelector('.edit-btn');

    btnMinus.addEventListener('click', () => {
      SoundEffects.playBeep(450, 0.05);
      triggerHaptic([20]);
      cartManager.decrementQty(item.id);
      renderCart();
      renderBudgetStatus();
    });

    btnPlus.addEventListener('click', () => {
      SoundEffects.playBeep(700, 0.05);
      triggerHaptic([20]);
      cartManager.incrementQty(item.id);
      renderCart();
      renderBudgetStatus();
    });

    qtyInput.addEventListener('change', (e) => {
      const newQ = parseInt(e.target.value, 10);
      if (!isNaN(newQ) && newQ >= 1) {
        cartManager.updateQty(item.id, newQ);
        renderCart();
        renderBudgetStatus();
      }
    });

    btnTrash.addEventListener('click', () => {
      SoundEffects.playBeep(300, 0.08);
      triggerHaptic([40]);
      cartManager.removeItem(item.id);
      showToast(`Dihapus dari troli: ${item.name}`, '🗑️');
      renderCart();
      renderBudgetStatus();
    });

    btnEdit.addEventListener('click', () => {
      openEditModal(item);
    });

    cartItemsList.appendChild(card);
  });

  refreshLucideIcons();
}

// ============================================================================
// F-05: BUDGET SAFETY CAP & SMART CUT ADVISOR
// ============================================================================
function renderBudgetStatus() {
  const totals = cartManager.getTotals();
  const evaluation = BudgetService.evaluate(totals.grandTotal);

  valTotalSpent.textContent = CurrencyUtils.formatRupiah(totals.grandTotal);
  valBudgetLimit.textContent = CurrencyUtils.formatRupiah(evaluation.budgetLimit);

  // Set safety banner class
  budgetBanner.className = `budget-safety-banner ${evaluation.colorClass}`;
  budgetSafetyTitle.textContent = evaluation.statusTitle;
  budgetStatusPill.textContent = evaluation.badgeText;
  budgetSafetyNote.textContent = evaluation.statusMessage;

  // Icon switcher
  if (evaluation.status === 'SAFE') {
    budgetSafetyIcon.textContent = '🛡️';
  } else if (evaluation.status === 'WARNING') {
    budgetSafetyIcon.textContent = '⚠️';
  } else {
    budgetSafetyIcon.textContent = '🚨';
    // Sound buzzer and vibrate if over budget
    SoundEffects.playWarningBuzzer();
    triggerHaptic([100, 50, 100]);
  }

  // Progress Bar
  const displayPercent = Math.min(100, evaluation.percentage);
  budgetProgressBar.style.width = `${displayPercent}%`;

  // Smart Cut Advisor (Rekomendasi Pangkas Belanja Saat Over Budget)
  if (evaluation.isOverBudget) {
    const recommendations = BudgetService.getCutRecommendations(
      cartManager.getItems(),
      totals.grandTotal,
      evaluation.budgetLimit
    );

    if (recommendations.length > 0) {
      smartCutContainer.style.display = 'block';
      smartCutList.innerHTML = '';

      recommendations.forEach(rec => {
        const row = document.createElement('div');
        row.className = 'cut-item-row';
        row.innerHTML = `
          <div class="cut-item-info">
            <span class="cut-item-name">${escapeHtml(rec.itemName)}</span>
            <span class="cut-item-reason">${escapeHtml(rec.reason)}</span>
          </div>
          <button type="button" class="cut-action-btn" data-action="${rec.type}" data-id="${rec.itemId}">
            ${rec.actionLabel}
          </button>
        `;

        const actionBtn = row.querySelector('.cut-action-btn');
        actionBtn.addEventListener('click', () => {
          if (rec.type === 'REDUCE_QTY') {
            cartManager.decrementQty(rec.itemId);
          } else {
            cartManager.removeItem(rec.itemId);
          }
          SoundEffects.playBeep(650, 0.08);
          triggerHaptic([40]);
          showToast(`Berhasil dipangkas: ${rec.itemName}!`, '✂️');
          renderCart();
          renderBudgetStatus();
          renderCategoryBreakdown();
        });

        smartCutList.appendChild(row);
      });
    } else {
      smartCutContainer.style.display = 'none';
    }
  } else {
    smartCutContainer.style.display = 'none';
  }

  renderCategoryBreakdown();
}

// ============================================================================
// MODAL BOTTOM SHEET & F-03 (Multi-tier discount) & F-04 (Modal Comparator)
// ============================================================================
function initModalListeners() {
  btnOpenAddModal.addEventListener('click', () => {
    openAddModal();
  });

  btnCloseModal.addEventListener('click', () => {
    closeItemModal();
  });

  // Modal Category Pills
  const catPills = document.querySelectorAll('#category-pills .selector-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      inputItemCategory.value = pill.dataset.value;
    });
  });

  // Modal Stepper
  modalQtyMinus.addEventListener('click', () => {
    let q = parseInt(inputItemQty.value, 10) || 1;
    if (q > 1) {
      inputItemQty.value = q - 1;
      updateModalLiveCalculation();
    }
  });

  modalQtyPlus.addEventListener('click', () => {
    let q = parseInt(inputItemQty.value, 10) || 1;
    inputItemQty.value = q + 1;
    updateModalLiveCalculation();
  });

  inputItemQty.addEventListener('input', updateModalLiveCalculation);

  // Price input with auto rupiah format
  inputItemPrice.addEventListener('input', (e) => {
    const rawVal = CurrencyUtils.parseRupiah(e.target.value);
    e.target.value = rawVal > 0 ? CurrencyUtils.formatRupiah(rawVal) : '';
    updateModalLiveCalculation();
  });

  // Product Name input -> triggers realtime comparison preview (F-04)
  inputItemName.addEventListener('input', () => {
    updateModalPriceComparison();
  });

  // Discount preset chips
  const discChips = document.querySelectorAll('#discount-preset-chips .discount-chip');
  discChips.forEach(chip => {
    chip.addEventListener('click', () => {
      discChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      inputItemDiscount.value = chip.dataset.val;
      updateModalLiveCalculation();
    });
  });

  inputItemDiscount.addEventListener('input', () => {
    discChips.forEach(c => c.classList.remove('active'));
    updateModalLiveCalculation();
  });

  // Form Submit (Add or Edit)
  itemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = inputItemName.value.trim();
    const price = CurrencyUtils.parseRupiah(inputItemPrice.value);
    const qty = parseInt(inputItemQty.value, 10) || 1;
    const category = inputItemCategory.value;
    const unit = inputItemUnit.value;
    const discount = inputItemDiscount.value;

    if (!name) {
      showToast('Masukkan nama produk!', '⚠️');
      return;
    }
    if (price <= 0) {
      showToast('Masukkan harga satuan yang valid!', '⚠️');
      return;
    }

    const editId = editItemId.value;
    if (editId) {
      cartManager.updateItem(editId, {
        name,
        category,
        unit,
        qty,
        originalPrice: price,
        discountString: discount
      });
      showToast(`Item ${name} berhasil diubah!`, '✏️');
    } else {
      cartManager.addItem({
        name,
        category,
        unit,
        qty,
        originalPrice: price,
        discountString: discount
      });
      SoundEffects.playCoinChime();
      triggerHaptic([30, 30]);
      showToast(`+${qty} ${name} masuk troli!`, '🛒');
    }

    closeItemModal();
    renderCart();
    renderBudgetStatus();
  });

  // Selesaikan Belanja Button & Modal
  btnFinishShopping.addEventListener('click', () => {
    const items = cartManager.getItems();
    if (items.length === 0) {
      showToast('Troli belanja masih kosong!', '⚠️');
      return;
    }
    openFinishModal();
  });

  btnCloseFinishModal.addEventListener('click', () => {
    finishModalOverlay.classList.remove('open');
  });

  btnConfirmSaveSession.addEventListener('click', () => {
    const store = cartManager.getStoreName();
    const date = cartManager.getDate();
    const items = cartManager.getItems();
    const budget = BudgetService.getBudgetLimit();
    const notes = document.getElementById('finish-session-notes').value;

    try {
      HistoryService.finalizeCurrentCart(store, date, items, budget, notes);
      cartManager.clearCart();
      finishModalOverlay.classList.remove('open');
      SoundEffects.playCoinChime();
      triggerHaptic([50, 100, 50]);
      showToast('Sesi belanja berhasil disimpan ke Riwayat Toko!', '🎉');
      renderCart();
      renderBudgetStatus();
      renderHistorySessions();
      // Switch to history tab to show saved receipt
      switchTab('riwayat');
    } catch (err) {
      showToast(err.message, '⚠️');
    }
  });

  // Budget Edit quick button in banner
  document.getElementById('btn-edit-budget').addEventListener('click', () => {
    switchTab('anggaran');
  });

  // Budget setup preset buttons in Tab 3
  const budgetBtns = document.querySelectorAll('.preset-budget-btn');
  const inputBudgetCap = document.getElementById('input-budget-cap');
  budgetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      budgetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = parseInt(btn.dataset.val, 10);
      inputBudgetCap.value = CurrencyUtils.formatRupiah(val);
    });
  });

  document.getElementById('btn-save-budget-cap').addEventListener('click', () => {
    const val = CurrencyUtils.parseRupiah(inputBudgetCap.value);
    if (val > 0) {
      BudgetService.setBudgetLimit(val);
      showToast(`Pagu dompet berhasil disimpan: ${CurrencyUtils.formatRupiah(val)}!`, '💰');
      renderBudgetStatus();
      switchTab('belanja');
    }
  });

  // Reset to default test data
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm('Muat ulang data sampel default (Lotte Mart & Super Indo)?')) {
      StorageService.resetToDefault();
      location.reload();
    }
  });

  // Export JSON
  document.getElementById('btn-export-data').addEventListener('click', () => {
    const json = HistoryService.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-grocery-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Data belanja berhasil di-export!', '💾');
  });

  // Cross-store search
  const crossSearchInput = document.getElementById('cross-store-search');
  crossSearchInput.addEventListener('input', (e) => {
    renderCrossStoreResults(e.target.value);
  });
}

function openAddModal() {
  modalTitle.textContent = 'Tambah Belanjaan Baru';
  editItemId.value = '';
  itemForm.reset();
  inputItemQty.value = 1;
  inputItemPrice.value = '';
  inputItemDiscount.value = '0';
  modalPriceComparator.style.display = 'none';
  discountPreviewBox.style.display = 'none';
  modalLiveSubtotal.textContent = 'Rp 0';
  modalLiveSavings.textContent = 'Hemat: Rp 0';

  // Reset category pill
  const catPills = document.querySelectorAll('#category-pills .selector-pill');
  catPills.forEach(p => p.classList.remove('active'));
  catPills[0].classList.add('active');
  inputItemCategory.value = catPills[0].dataset.value;

  itemModalOverlay.classList.add('open');
  setTimeout(() => inputItemName.focus(), 250);
}

function openEditModal(item) {
  modalTitle.textContent = 'Edit Item Belanja';
  editItemId.value = item.id;
  inputItemName.value = item.name;
  inputItemPrice.value = CurrencyUtils.formatRupiah(item.originalPrice);
  inputItemQty.value = item.qty;
  inputItemUnit.value = item.unit || 'pcs';
  inputItemDiscount.value = item.discountString || '0';

  // Category pill
  const catPills = document.querySelectorAll('#category-pills .selector-pill');
  catPills.forEach(p => {
    if (p.dataset.value === item.category) {
      p.classList.add('active');
      inputItemCategory.value = item.category;
    } else {
      p.classList.remove('active');
    }
  });

  updateModalPriceComparison();
  updateModalLiveCalculation();
  itemModalOverlay.classList.add('open');
}

function closeItemModal() {
  itemModalOverlay.classList.remove('open');
}

// Live calculation inside modal (F-02 & F-03)
function updateModalLiveCalculation() {
  const price = CurrencyUtils.parseRupiah(inputItemPrice.value);
  const qty = Math.max(1, parseInt(inputItemQty.value, 10) || 1);
  const discountString = inputItemDiscount.value;

  const res = calculateMultiTierDiscount(price, discountString);
  const subtotal = res.finalUnitPrice * qty;
  const totalSavings = res.discountPerUnit * qty;

  modalLiveSubtotal.textContent = CurrencyUtils.formatRupiah(subtotal);
  modalLiveSavings.textContent = totalSavings > 0 ? `Hemat: ${CurrencyUtils.formatRupiah(totalSavings)} (${res.effectivePercentage}%)` : 'Tanpa Diskon';

  if (res.discountPerUnit > 0) {
    discountPreviewBox.style.display = 'block';
    discountPreviewSummary.textContent = `Harga Bersih: ${CurrencyUtils.formatRupiah(res.finalUnitPrice)} / unit (Hemat ${CurrencyUtils.formatRupiah(res.discountPerUnit)})`;
    if (res.breakdownSteps && res.breakdownSteps.length > 0) {
      discountPreviewSteps.innerHTML = res.breakdownSteps.map(s => `• ${s}`).join('<br>');
    } else {
      discountPreviewSteps.textContent = '';
    }
  } else {
    discountPreviewBox.style.display = 'none';
  }

  updateModalPriceComparison();
}

// F-04 Realtime Comparator feedback inside modal
function updateModalPriceComparison() {
  const name = inputItemName.value.trim();
  const price = CurrencyUtils.parseRupiah(inputItemPrice.value);

  if (!name || price <= 0) {
    modalPriceComparator.style.display = 'none';
    return;
  }

  const comp = compareWithStoreHistory(cartManager.getStoreName(), name, price);
  if (comp && comp.status !== 'NONE') {
    modalPriceComparator.style.display = 'flex';
    modalPriceComparator.className = `modal-comparator-preview ${comp.badgeClass}`;
    modalComparatorIcon.textContent = comp.symbol;
    modalComparatorText.innerHTML = `<strong>${comp.label}</strong>: ${comp.desc}`;
  } else {
    modalPriceComparator.style.display = 'none';
  }
}

function openFinishModal() {
  const totals = cartManager.getTotals();
  const evaluation = BudgetService.evaluate(totals.grandTotal);

  document.getElementById('finish-store-name').textContent = cartManager.getStoreName();
  document.getElementById('finish-date').textContent = cartManager.getDate();
  document.getElementById('finish-total-spent').textContent = CurrencyUtils.formatRupiah(totals.grandTotal);
  document.getElementById('finish-total-saved').textContent = CurrencyUtils.formatRupiah(totals.totalSavings);
  
  const statusTag = document.getElementById('finish-status-tag');
  statusTag.textContent = evaluation.badgeText;
  statusTag.style.color = evaluation.isOverBudget ? '#f43f5e' : (evaluation.isWarning ? '#f59e0b' : '#10b981');

  finishModalOverlay.classList.add('open');
}

// New Store Modal
function openNewStoreModal() {
  newStoreModalOverlay.classList.add('open');
}

btnCloseStoreModal.addEventListener('click', () => {
  newStoreModalOverlay.classList.remove('open');
});

newStoreForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('input-new-store-name').value.trim();
  const area = document.getElementById('input-new-store-area').value.trim() || 'Supermarket';
  if (name) {
    StorageService.addStore(name, area);
    populateStoreDropdown();
    storeSelect.value = name;
    cartManager.setStore(name);
    newStoreModalOverlay.classList.remove('open');
    showToast(`Toko baru ditambahkan: ${name}!`, '🏪');
    renderCart();
  }
});

// ============================================================================
// TAB NAVIGATION & VIEWS
// ============================================================================
function initTabs() {
  navTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Desktop Frame Toggle (Mode Frame HP / Full Screen)
  const toggleBtn = document.getElementById('toggle-frame-btn');
  const frameModeText = document.getElementById('frame-mode-text');
  const mobileFrame = document.getElementById('mobile-frame');

  if (toggleBtn) {
    let isFramed = true;
    toggleBtn.addEventListener('click', () => {
      isFramed = !isFramed;
      if (isFramed) {
        mobileFrame.style.maxWidth = '430px';
        mobileFrame.style.borderRadius = '44px';
        mobileFrame.style.height = '92vh';
        frameModeText.textContent = 'Frame Smartphone';
      } else {
        mobileFrame.style.maxWidth = '100%';
        mobileFrame.style.borderRadius = '0';
        mobileFrame.style.height = '100vh';
        frameModeText.textContent = 'Layar Penuh (Responsif)';
      }
    });
  }
}

function switchTab(tabKey) {
  navTabBtns.forEach(b => {
    if (b.dataset.tab === tabKey) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  Object.keys(tabViews).forEach(key => {
    if (key === tabKey) {
      tabViews[key].style.display = 'block';
    } else {
      tabViews[key].style.display = 'none';
    }
  });

  // Show / hide floating action dock in Belanja tab only
  if (cartFloatingDock) {
    cartFloatingDock.style.display = (tabKey === 'belanja') ? 'flex' : 'none';
  }

  // Refresh tab content
  if (tabKey === 'riwayat') {
    renderHistorySessions();
  } else if (tabKey === 'anggaran') {
    renderCategoryBreakdown();
  } else if (tabKey === 'belanja') {
    renderCart();
    renderBudgetStatus();
  }

  refreshLucideIcons();
}

// ============================================================================
// TAB 2: RIWAYAT SESI BELANJA & CROSS-STORE SEARCH (F-06)
// ============================================================================
function renderHistorySessions() {
  const sessions = HistoryService.getSessions();
  const listEl = document.getElementById('history-sessions-list');

  if (!listEl) return;
  if (sessions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-trolley-box">
        <p>Belum ada riwayat sesi belanja yang disimpan.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  sessions.forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-history-card';
    const formattedDate = new Date(session.date).toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    card.innerHTML = `
      <div class="session-card-header">
        <span class="session-store-title">🏪 ${escapeHtml(session.storeName)}</span>
        <span class="session-date-label">${formattedDate}</span>
      </div>
      <div style="font-size:12px; color:#cbd5e1; margin-bottom:6px;">
        ${session.note ? `<em>"${escapeHtml(session.note)}"</em> • ` : ''}${session.items ? session.items.length : 0} Barang Belanjaan
      </div>
      <div class="session-numbers-row">
        <div>
          <span style="font-size:11px; color:#94a3b8;">Total Transaksi:</span>
          <div style="font-size:16px; font-weight:800; color:#34d399;">${CurrencyUtils.formatRupiah(session.totalSpent)}</div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px; color:#94a3b8;">Total Hemat:</span>
          <div style="font-size:14px; font-weight:700; color:#fbbf24;">${CurrencyUtils.formatRupiah(session.totalSaved || 0)}</div>
        </div>
      </div>
      
      <!-- Collapsible items preview -->
      <details style="margin-top:10px; font-size:12px;">
        <summary style="cursor:pointer; color:#94a3b8; font-weight:600;">Lihat Rincian ${session.items?.length || 0} Barang...</summary>
        <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:8px; margin-top:6px;">
          ${(session.items || []).map(it => `
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span>${it.qty}x ${escapeHtml(it.name)}</span>
              <strong>${CurrencyUtils.formatRupiah(it.subtotal)}</strong>
            </div>
          `).join('')}
        </div>
      </details>
    `;

    listEl.appendChild(card);
  });
}

function renderCrossStoreResults(query) {
  const container = document.getElementById('cross-store-results');
  if (!container) return;

  if (!query || !query.trim()) {
    container.innerHTML = '';
    return;
  }

  const results = HistoryService.searchCrossStorePrices(query);
  if (results.length === 0) {
    container.innerHTML = `
      <div style="padding:10px; font-size:12px; color:#94a3b8; text-align:center;">
        Tidak ada riwayat harga untuk "<em>${escapeHtml(query)}</em>".
      </div>
    `;
    return;
  }

  const cheapest = results[0];

  container.innerHTML = `
    <div style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:6px 10px; font-size:11px; color:#34d399; margin-bottom:8px;">
      💡 <strong>Rekomendasi Hemat:</strong> Termurah di <strong>${cheapest.storeName}</strong> seharga ${CurrencyUtils.formatRupiah(cheapest.price)} / ${cheapest.unit}!
    </div>
    ${results.map((r, idx) => `
      <div class="cross-store-row">
        <div>
          <div class="store-name-tag">${r.storeName} ${idx === 0 ? '🏆 Termurah' : ''}</div>
          <div style="font-size:11px; color:#94a3b8;">${r.productName} (${r.unit}) • Tgl ${r.date}</div>
        </div>
        <div class="store-price-tag">${CurrencyUtils.formatRupiah(r.price)}</div>
      </div>
    `).join('')}
  `;
}

// ============================================================================
// TAB 3: ANGGARAN & CATEGORY BREAKDOWN
// ============================================================================
function renderCategoryBreakdown() {
  const container = document.getElementById('category-distribution-container');
  if (!container) return;

  const items = cartManager.getItems();
  const breakdown = BudgetService.getCategoryBreakdown(items);

  if (breakdown.length === 0) {
    container.innerHTML = `
      <div style="font-size:12px; color:#94a3b8; text-align:center; padding:12px;">
        Belum ada item di troli untuk dianalisis.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  breakdown.forEach(b => {
    const itemEl = document.createElement('div');
    itemEl.className = 'category-bar-item';
    itemEl.innerHTML = `
      <div class="category-bar-label">
        <span>${escapeHtml(b.category)}</span>
        <span><strong>${CurrencyUtils.formatRupiah(b.amount)}</strong> (${b.percentage}%)</span>
      </div>
      <div class="category-bar-track">
        <div class="category-bar-fill" style="width: ${b.percentage}%;"></div>
      </div>
    `;
    container.appendChild(itemEl);
  });
}

// ============================================================================
// PWA SERVICE WORKER & ADD TO HOME SCREEN
// ============================================================================
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW registration failed:', err));
    });
  }

  let deferredPrompt;
  const pwaBanner = document.getElementById('pwa-install-banner');
  const btnInstallPwa = document.getElementById('btn-install-pwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaBanner) pwaBanner.classList.add('active');
  });

  if (btnInstallPwa) {
    btnInstallPwa.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Aplikasi berhasil dipasang di layar utama!', '📲');
        }
        deferredPrompt = null;
        if (pwaBanner) pwaBanner.classList.remove('active');
      } else {
        showToast('Buka menu browser dan pilih "Add to Home Screen"', '📲');
      }
    });
  }
}

// Utility: HTML Escaping
function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
