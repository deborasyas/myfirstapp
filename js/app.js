/**
 * Smart Grocery & Budget Safety Tracker - Unified Application Controller
 * Features: F-01, F-02, F-03, F-04, F-05, F-06
 * Architecture: Realtime Multi-Device (HP <-> PC) via Cloud Firestore + LocalStorage Offline-First Fallback
 * 100% Compatible with direct file:/// execution and http:// local server
 */

// ============================================================================
// 1. CURRENCY & NUMBER UTILITIES
// ============================================================================
const CurrencyUtils = {
  formatRupiah(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
    return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
  },

  parseRupiah(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = str.toString().replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  }
};

// ============================================================================
// 2. F-03: MULTI-TIER DISCOUNT CALCULATOR
// ============================================================================
function calculateMultiTierDiscount(originalPrice, discountInput) {
  const basePrice = Math.max(0, Number(originalPrice) || 0);
  if (!discountInput || discountInput.trim() === '' || discountInput.trim() === '0' || discountInput.trim() === '0%') {
    return {
      originalPrice: basePrice,
      finalUnitPrice: basePrice,
      discountPerUnit: 0,
      discountString: '0%',
      effectivePercentage: 0,
      breakdownSteps: []
    };
  }

  const raw = discountInput.trim();

  // Check if nominal discount (e.g., "Rp 5000" or "-5000")
  if (raw.toLowerCase().startsWith('rp') || (raw.startsWith('-') && !raw.includes('%'))) {
    const nominal = CurrencyUtils.parseRupiah(raw);
    const finalPrice = Math.max(0, basePrice - nominal);
    const discountAmount = basePrice - finalPrice;
    const effPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;
    return {
      originalPrice: basePrice,
      finalUnitPrice: finalPrice,
      discountPerUnit: discountAmount,
      discountString: CurrencyUtils.formatRupiah(nominal),
      effectivePercentage: Math.round(effPercent),
      breakdownSteps: [`Potongan Langsung: -${CurrencyUtils.formatRupiah(nominal)}`]
    };
  }

  // Parse multi-tier percentages separated by '+', '/', or comma
  // e.g. "50% + 20%", "50+20", "30% + 10% + 5%"
  const parts = raw.split(/[+,/]/).map(p => {
    const num = parseFloat(p.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  }).filter(n => n > 0);

  if (parts.length === 0) {
    return {
      originalPrice: basePrice,
      finalUnitPrice: basePrice,
      discountPerUnit: 0,
      discountString: '0%',
      effectivePercentage: 0,
      breakdownSteps: []
    };
  }

  let currentPrice = basePrice;
  const steps = [];

  for (let i = 0; i < parts.length; i++) {
    const pct = parts[i];
    const discountThisStep = currentPrice * (pct / 100);
    const priceAfterStep = Math.max(0, currentPrice - discountThisStep);
    steps.push(`Diskon ${i + 1} (${pct}%): -${CurrencyUtils.formatRupiah(discountThisStep)} (Sisa: ${CurrencyUtils.formatRupiah(priceAfterStep)})`);
    currentPrice = priceAfterStep;
  }

  const finalUnitPrice = Math.round(currentPrice);
  const discountPerUnit = basePrice - finalUnitPrice;
  const effectivePercentage = basePrice > 0 ? ((discountPerUnit / basePrice) * 100) : 0;
  const discountDisplay = parts.map(p => `${p}%`).join(' + ');

  return {
    originalPrice: basePrice,
    finalUnitPrice: finalUnitPrice,
    discountPerUnit: discountPerUnit,
    discountString: discountDisplay,
    effectivePercentage: Math.round(effectivePercentage * 10) / 10,
    breakdownSteps: steps
  };
}

// ============================================================================
// 3. STORAGE & DATABASE LAYER (F-01, F-06, Multi-Store History)
// ============================================================================
const STORAGE_KEYS = {
  CURRENT_CART: 'smart_grocery_cart_v3',
  SESSION_META: 'smart_grocery_session_meta_v3',
  STORES: 'smart_grocery_stores_v1',
  SESSIONS_HISTORY: 'smart_grocery_history_v3',
  PRICE_DB: 'smart_grocery_price_db_v1',
  USER_BUDGET: 'smart_grocery_budget_v1'
};

const DEFAULT_STORES = [
  { id: 'lotte-puri', name: 'Lotte Mart Grocery - Puri Indah', area: 'Jakarta Barat', icon: 'store' },
  { id: 'superindo-meruya', name: 'Super Indo - Meruya', area: 'Jakarta Barat', icon: 'shopping-cart' },
  { id: 'grandlucky-scbd', name: 'Grand Lucky - SCBD', area: 'Jakarta Selatan', icon: 'bag' },
  { id: 'hypermart-puri', name: 'Hypermart - Puri Indah Mall', area: 'Jakarta Barat', icon: 'store' },
  { id: 'alfamidi-super', name: 'Alfamidi Super - Kebon Jeruk', area: 'Jakarta Barat', icon: 'shopping-cart' }
];

const SEED_SESSIONS = [
  {
    id: 'session-prev-lotte-1',
    storeName: 'Lotte Mart Grocery - Puri Indah',
    date: '2026-09-28', // Bulan lalu
    budgetLimit: 500000,
    totalSpent: 384500,
    totalSaved: 48500,
    note: 'Belanja Bulanan Kost Awal Semester',
    items: [
      { id: 's1', name: 'Beras 5kg', category: 'Bahan Pokok', unit: 'pack', qty: 1, originalPrice: 68000, discountString: '0', finalUnitPrice: 68000, subtotal: 68000 },
      { id: 's2', name: 'Telur 1kg', category: 'Bahan Pokok', unit: 'kg', qty: 1, originalPrice: 32000, discountString: '0', finalUnitPrice: 32000, subtotal: 32000 },
      { id: 's3', name: 'Garam 500g', category: 'Bumbu & Dapur', unit: 'pack', qty: 1, originalPrice: 5000, discountString: '0', finalUnitPrice: 5000, subtotal: 5000 },
      { id: 's4', name: 'Minyak Goreng Tropical 2L', category: 'Bahan Pokok', unit: 'liter', qty: 2, originalPrice: 35000, discountString: '10%', finalUnitPrice: 31500, subtotal: 63000 },
      { id: 's5', name: 'Ultra Milk Cokelat 1L', category: 'Minuman', unit: 'pcs', qty: 2, originalPrice: 21000, discountString: '10%', finalUnitPrice: 18900, subtotal: 37800 },
      { id: 's6', name: 'Rinso Cair Molto 750ml', category: 'Mandi & Cuci', unit: 'pack', qty: 1, originalPrice: 24500, discountString: '15%', finalUnitPrice: 20800, subtotal: 20800 },
      { id: 's7', name: 'Sabun Mandi Lifebuoy Refill 450ml', category: 'Mandi & Cuci', unit: 'pack', qty: 2, originalPrice: 26000, discountString: '30%', finalUnitPrice: 18200, subtotal: 36400 },
      { id: 's8', name: 'Sunlight Jeruk Nipis 750ml', category: 'Mandi & Cuci', unit: 'pack', qty: 1, originalPrice: 17000, discountString: '0', finalUnitPrice: 17000, subtotal: 17000 }
    ]
  },
  {
    id: 'session-prev-superindo-1',
    storeName: 'Super Indo - Meruya',
    date: '2026-10-14',
    budgetLimit: 450000,
    totalSpent: 342000,
    totalSaved: 36000,
    note: 'Belanja Tengah Bulan & Lauk Dingin',
    items: [
      { id: 's201', name: 'Beras 5kg', category: 'Bahan Pokok', unit: 'pack', qty: 1, originalPrice: 69500, discountString: '0', finalUnitPrice: 69500, subtotal: 69500 },
      { id: 's202', name: 'Minyak Goreng Tropical 2L', category: 'Bahan Pokok', unit: 'liter', qty: 1, originalPrice: 34000, discountString: '0', finalUnitPrice: 34000, subtotal: 34000 },
      { id: 's203', name: 'Fiesta Chicken Nugget 500g', category: 'Makanan Cepat Saji', unit: 'pack', qty: 2, originalPrice: 52000, discountString: '20%', finalUnitPrice: 41600, subtotal: 83200 },
      { id: 's204', name: 'Telur 1kg', category: 'Bahan Pokok', unit: 'kg', qty: 1, originalPrice: 29000, discountString: '0', finalUnitPrice: 29000, subtotal: 29000 },
      { id: 's205', name: 'Chitato Sapi Panggang 68g', category: 'Camilan', unit: 'pcs', qty: 3, originalPrice: 12500, discountString: '0', finalUnitPrice: 12500, subtotal: 37500 },
      { id: 's206', name: 'Ultra Milk Cokelat 1L', category: 'Minuman', unit: 'pcs', qty: 1, originalPrice: 20000, discountString: '0', finalUnitPrice: 20000, subtotal: 20000 },
      { id: 's207', name: 'Deterjen Rinso 750ml', category: 'Mandi & Cuci', unit: 'pack', qty: 1, originalPrice: 22000, discountString: '10%', finalUnitPrice: 19800, subtotal: 19800 }
    ]
  }
];

const SEED_ACTIVE_CART = [
  {
    id: 'cart-1',
    name: 'Beras 5kg',
    category: 'Bahan Pokok',
    unit: 'pack',
    qty: 1,
    originalPrice: 74000, // Bulan lalu Rp 68.000 -> Sekarang Rp 74.000 (Naik +Rp 6.000)
    discountString: '0',
    finalUnitPrice: 74000,
    subtotal: 74000,
    discountSavings: 0
  },
  {
    id: 'cart-2',
    name: 'Telur 1kg',
    category: 'Bahan Pokok',
    unit: 'kg',
    qty: 1,
    originalPrice: 28000, // Bulan lalu Rp 32.000 -> Sekarang Rp 28.000 (Turun -Rp 4.000)
    discountString: '0',
    finalUnitPrice: 28000,
    subtotal: 28000,
    discountSavings: 0
  },
  {
    id: 'cart-3',
    name: 'Garam 500g',
    category: 'Bumbu & Dapur',
    unit: 'pack',
    qty: 1,
    originalPrice: 5000, // Bulan lalu Rp 5.000 -> Sekarang Rp 5.000 (Tetap Stabil)
    discountString: '0',
    finalUnitPrice: 5000,
    subtotal: 5000,
    discountSavings: 0
  },
  {
    id: 'cart-4',
    name: 'Minyak Goreng Tropical 2L',
    category: 'Bahan Pokok',
    unit: 'liter',
    qty: 2,
    originalPrice: 38000,
    discountString: '50% + 20%', // F-03 Diskon Bertingkat
    finalUnitPrice: 15200,
    subtotal: 30400,
    discountSavings: 45600
  }
];

const QUICK_PRODUCTS = [
  { name: 'Beras 5kg', category: 'Bahan Pokok', unit: 'pack', defaultPrice: 74000 },
  { name: 'Telur 1kg', category: 'Bahan Pokok', unit: 'kg', defaultPrice: 28000 },
  { name: 'Garam 500g', category: 'Bumbu & Dapur', unit: 'pack', defaultPrice: 5000 },
  { name: 'Minyak Goreng Tropical 2L', category: 'Bahan Pokok', unit: 'liter', defaultPrice: 34000 },
  { name: 'Indomie Goreng Special', category: 'Makanan Cepat Saji', unit: 'dus', defaultPrice: 115000 },
  { name: 'Ultra Milk Cokelat 1L', category: 'Minuman', unit: 'pcs', defaultPrice: 19500 },
  { name: 'Fiesta Chicken Nugget 500g', category: 'Makanan Cepat Saji', unit: 'pack', defaultPrice: 45000 },
  { name: 'Rinso Cair Molto 750ml', category: 'Mandi & Cuci', unit: 'pack', defaultPrice: 21000 },
  { name: 'Sabun Mandi Lifebuoy Refill 450ml', category: 'Mandi & Cuci', unit: 'pack', defaultPrice: 23500 },
  { name: 'Sunlight Jeruk Nipis 750ml', category: 'Mandi & Cuci', unit: 'pack', defaultPrice: 15500 }
];
  { name: 'Rinso Cair Molto 750ml', category: 'Mandi & Cuci', unit: 'pack', defaultPrice: 21000 },
  { name: 'Sabun Mandi Lifebuoy Refill 450ml', category: 'Mandi & Cuci', unit: 'pack', defaultPrice: 23500 },
  { name: 'Sunlight Jeruk Nipis 750ml', category: 'Mandi & Cuci', unit: 'pack', defaultPrice: 15500 },
  { name: 'Pasta Gigi Pepsodent 225g', category: 'Mandi & Cuci', unit: 'pcs', defaultPrice: 16500 },
  { name: 'Kopi Kapal Api Special Mix 10x24g', category: 'Minuman', unit: 'pack', defaultPrice: 14500 },
  { name: 'Sarden ABC Tomat 425g', category: 'Makanan Cepat Saji', unit: 'kaleng', defaultPrice: 23000 },
  { name: 'Chitato Sapi Panggang 68g', category: 'Camilan', unit: 'pcs', defaultPrice: 12000 },
  { name: 'Oreo Vanilla 119g', category: 'Camilan', unit: 'pack', defaultPrice: 9500 },
  { name: 'Roti Tawar Kupas Sari Roti', category: 'Bahan Pokok', unit: 'pack', defaultPrice: 16000 }
];

const StorageService = {
  _syncCallback: null,
  _isApplyingRemote: false,
  currentUserId: null,

  setCurrentUser(uid) {
    this.currentUserId = uid;
    this.init();
  },

  getUserKey(baseKey) {
    const uid = this.currentUserId || 'local_user';
    return `${baseKey}_${uid}`;
  },

  setSyncCallback(callback) {
    this._syncCallback = callback;
  },

  setApplyingRemote(isRemote) {
    this._isApplyingRemote = !!isRemote;
  },

  isApplyingRemote() {
    return this._isApplyingRemote;
  },

  notifyChange(type, data) {
    if (!this._isApplyingRemote && typeof this._syncCallback === 'function') {
      try {
        this._syncCallback({ type, data });
      } catch (e) {
        console.warn('StorageService sync callback warning:', e);
      }
    }
  },

  init() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.STORES)) {
        localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(DEFAULT_STORES));
      }
      const histKey = this.getUserKey(STORAGE_KEYS.SESSIONS_HISTORY);
      if (!localStorage.getItem(histKey)) {
        localStorage.setItem(histKey, JSON.stringify(SEED_SESSIONS));
      }
      const budgetKey = this.getUserKey(STORAGE_KEYS.USER_BUDGET);
      if (!localStorage.getItem(budgetKey)) {
        localStorage.setItem(budgetKey, '500000');
      }
      const cartKey = this.getUserKey(STORAGE_KEYS.CURRENT_CART);
      if (!localStorage.getItem(cartKey)) {
        localStorage.setItem(cartKey, JSON.stringify(SEED_ACTIVE_CART));
      }
      const metaKey = this.getUserKey(STORAGE_KEYS.SESSION_META);
      if (!localStorage.getItem(metaKey)) {
        const today = new Date().toISOString().split('T')[0];
        const defaultMeta = {
          storeName: 'Lotte Mart Grocery - Puri Indah',
          date: today,
          notes: 'Sesi Belanja Bulanan Anak Rantau'
        };
        localStorage.setItem(metaKey, JSON.stringify(defaultMeta));
      }
      const catBudgetKey = this.getUserKey('smart_grocery_cat_budgets');
      if (!localStorage.getItem(catBudgetKey)) {
        const defaultCatBudgets = [
          { id: 'cat-b-1', name: 'Bahan Pokok', limit: 250000 },
          { id: 'cat-b-2', name: 'Camilan & Minuman', limit: 75000 },
          { id: 'cat-b-3', name: 'Mandi & Cuci', limit: 100000 }
        ];
        localStorage.setItem(catBudgetKey, JSON.stringify(defaultCatBudgets));
      }
    } catch (e) {
      console.warn('LocalStorage access warning:', e);
    }
  },

  getStores() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STORES);
      return data ? JSON.parse(data) : DEFAULT_STORES;
    } catch {
      return DEFAULT_STORES;
    }
  },

  addStore(storeName, area = 'Jakarta') {
    const stores = this.getStores();
    if (!stores.some(s => s.name.toLowerCase() === storeName.toLowerCase())) {
      stores.push({
        id: 'store-' + Date.now(),
        name: storeName,
        area: area,
        icon: 'store'
      });
      try {
        localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(stores));
      } catch (e) {}
      this.notifyChange('stores', stores);
    }
    return stores;
  },

  mergeRemoteStores(remoteStores) {
    if (!Array.isArray(remoteStores) || remoteStores.length === 0) return this.getStores();
    const local = this.getStores();
    const map = new Map();
    local.forEach(s => map.set(s.name.toLowerCase(), s));
    remoteStores.forEach(s => {
      if (s && s.name && !map.has(s.name.toLowerCase())) {
        map.set(s.name.toLowerCase(), s);
      }
    });
    const merged = Array.from(map.values());
    try {
      localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(merged));
    } catch (e) {}
    return merged;
  },

  getSessionMeta() {
    try {
      const data = localStorage.getItem(this.getUserKey(STORAGE_KEYS.SESSION_META));
      if (data) return JSON.parse(data);
    } catch (e) {}
    const today = new Date().toISOString().split('T')[0];
    return {
      storeName: 'Lotte Mart Grocery - Puri Indah',
      date: today,
      notes: 'Sesi Belanja Bulanan Anak Rantau'
    };
  },

  saveSessionMeta(meta) {
    try {
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.SESSION_META), JSON.stringify(meta));
    } catch (e) {}
    this.notifyChange('meta', meta);
  },

  getCart() {
    try {
      const data = localStorage.getItem(this.getUserKey(STORAGE_KEYS.CURRENT_CART));
      return data ? JSON.parse(data) : SEED_ACTIVE_CART;
    } catch {
      return SEED_ACTIVE_CART;
    }
  },

  saveCart(cart) {
    try {
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.CURRENT_CART), JSON.stringify(cart));
    } catch (e) {}
    this.notifyChange('cart', cart);
  },

  getBudget() {
    try {
      const b = localStorage.getItem(this.getUserKey(STORAGE_KEYS.USER_BUDGET));
      return b ? parseInt(b, 10) : 500000;
    } catch {
      return 500000;
    }
  },

  saveBudget(budget) {
    try {
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.USER_BUDGET), budget.toString());
    } catch (e) {}
    this.notifyChange('budget', { walletLimit: budget, categoryBudgets: this.getCategoryBudgets() });
  },

  getCategoryBudgets() {
    try {
      const data = localStorage.getItem(this.getUserKey('smart_grocery_cat_budgets'));
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [
      { id: 'cat-b-1', name: 'Bahan Pokok', limit: 250000 },
      { id: 'cat-b-2', name: 'Camilan & Minuman', limit: 75000 },
      { id: 'cat-b-3', name: 'Mandi & Cuci', limit: 100000 }
    ];
  },

  saveCategoryBudgets(budgets) {
    try {
      localStorage.setItem(this.getUserKey('smart_grocery_cat_budgets'), JSON.stringify(budgets));
    } catch (e) {}
    this.notifyChange('budget', { walletLimit: this.getBudget(), categoryBudgets: budgets });
  },

  addCategoryBudget(item) {
    const list = this.getCategoryBudgets();
    const newItem = {
      id: 'cat-b-' + Date.now(),
      name: item.name.trim(),
      limit: Number(item.limit) || 100000
    };
    list.push(newItem);
    this.saveCategoryBudgets(list);
    return newItem;
  },

  updateCategoryBudget(id, updateData) {
    const list = this.getCategoryBudgets();
    const target = list.find(c => c.id === id);
    if (target) {
      if (updateData.name) target.name = updateData.name.trim();
      if (updateData.limit) target.limit = Number(updateData.limit) || target.limit;
      this.saveCategoryBudgets(list);
    }
    return target;
  },

  deleteCategoryBudget(id) {
    let list = this.getCategoryBudgets();
    list = list.filter(c => c.id !== id);
    this.saveCategoryBudgets(list);
    return list;
  },

  getHistorySessions() {
    try {
      const data = localStorage.getItem(this.getUserKey(STORAGE_KEYS.SESSIONS_HISTORY));
      return data ? JSON.parse(data) : SEED_SESSIONS;
    } catch {
      return SEED_SESSIONS;
    }
  },

  saveHistorySession(session) {
    const history = this.getHistorySessions();
    if (!history.some(h => h.id === session.id)) {
      history.unshift(session);
    }
    try {
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.SESSIONS_HISTORY), JSON.stringify(history));
    } catch (e) {}
    this.notifyChange('history', session);
    return history;
  },

  deleteHistorySession(sessionId) {
    let history = this.getHistorySessions();
    history = history.filter(h => h.id !== sessionId);
    try {
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.SESSIONS_HISTORY), JSON.stringify(history));
    } catch (e) {}
    this.notifyChange('history_delete', { id: sessionId });
    return history;
  },

  mergeRemoteHistory(remoteSessions) {
    if (!Array.isArray(remoteSessions) || remoteSessions.length === 0) return this.getHistorySessions();
    const local = this.getHistorySessions();
    const map = new Map();
    local.forEach(s => map.set(s.id, s));
    remoteSessions.forEach(s => map.set(s.id, s));
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.savedAt || b.date) - new Date(a.savedAt || a.date));
    try {
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.SESSIONS_HISTORY), JSON.stringify(merged));
    } catch (e) {}
    return merged;
  },

  findProductHistoricalPrice(storeName, productName) {
    if (!productName || !productName.trim()) return null;
    const cleanQuery = productName.trim().toLowerCase();
    const history = this.getHistorySessions();

    // 1. Look in requested store first (newest date first)
    for (const session of history) {
      if (session.storeName && session.storeName.toLowerCase() === storeName.toLowerCase()) {
        const matchedItem = session.items?.find(it => {
          const itName = it.name.trim().toLowerCase();
          return itName === cleanQuery || itName.includes(cleanQuery) || cleanQuery.includes(itName);
        });
        if (matchedItem) {
          return {
            found: true,
            inSameStore: true,
            storeName: session.storeName,
            date: session.date,
            unit: matchedItem.unit,
            price: matchedItem.finalUnitPrice || matchedItem.originalPrice || 0,
            basePrice: matchedItem.originalPrice || 0,
            matchedProductName: matchedItem.name
          };
        }
      }
    }

    // 2. Cross-store comparison
    for (const session of history) {
      const matchedItem = session.items?.find(it => {
        const itName = it.name.trim().toLowerCase();
        return itName === cleanQuery || itName.includes(cleanQuery) || cleanQuery.includes(itName);
      });
      if (matchedItem) {
        return {
          found: true,
          inSameStore: false,
          storeName: session.storeName,
          date: session.date,
          unit: matchedItem.unit,
          price: matchedItem.finalUnitPrice || matchedItem.originalPrice || 0,
          basePrice: matchedItem.originalPrice || 0,
          matchedProductName: matchedItem.name
        };
      }
    }

    return null;
  },

  resetToDefault() {
    try {
      localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(DEFAULT_STORES));
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.SESSIONS_HISTORY), JSON.stringify(SEED_SESSIONS));
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.CURRENT_CART), JSON.stringify(SEED_ACTIVE_CART));
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.USER_BUDGET), '500000');
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(this.getUserKey(STORAGE_KEYS.SESSION_META), JSON.stringify({
        storeName: 'Lotte Mart Grocery - Puri Indah',
        date: today,
        notes: 'Sesi Belanja Bulanan Anak Rantau'
      }));
    } catch (e) {}
  }
};

// ============================================================================
// 4. F-04: REALTIME PRICE COMPARATOR vs HISTORICAL STORE RECORDS
// ============================================================================
function compareWithStoreHistory(storeName, productName, currentPrice) {
  if (!productName || !currentPrice) {
    return { status: 'NONE' };
  }

  const numPrice = Number(currentPrice);
  const hist = StorageService.findProductHistoricalPrice(storeName, productName);

  if (!hist || !hist.found) {
    return {
      status: 'NEW',
      symbol: '\u2728',
      badgeClass: 'badge-new',
      label: 'Produk Baru',
      desc: 'Belum ada riwayat di toko ini',
      diff: 0,
      diffPercent: 0,
      historicalPrice: 0,
      historicalDate: null
    };
  }

  const prevPrice = hist.price;
  const diff = numPrice - prevPrice;
  const diffPercent = prevPrice > 0 ? Math.round(((diff / prevPrice) * 100) * 10) / 10 : 0;
  const periodLabel = hist.inSameStore ? 'bulan lalu' : (hist.storeName || 'toko lain');

  if (diff > 0) {
    return {
      status: 'UP',
      symbol: '\u2191',
      badgeClass: 'badge-price-up',
      label: `+${CurrencyUtils.formatRupiah(diff)}`,
      desc: `Naik dibanding ${periodLabel} (${CurrencyUtils.formatRupiah(prevPrice)})`,
      diff: diff,
      diffPercent: diffPercent,
      historicalPrice: prevPrice,
      historicalDate: hist.date,
      historicalStore: hist.storeName,
      inSameStore: hist.inSameStore
    };
  } else if (diff < 0) {
    return {
      status: 'DOWN',
      symbol: '\u2193',
      badgeClass: 'badge-price-down',
      label: `-${CurrencyUtils.formatRupiah(Math.abs(diff))}`,
      desc: `PROMO! Lebih hemat vs ${periodLabel} (${CurrencyUtils.formatRupiah(prevPrice)})`,
      diff: diff,
      diffPercent: diffPercent,
      historicalPrice: prevPrice,
      historicalDate: hist.date,
      historicalStore: hist.storeName,
      inSameStore: hist.inSameStore
    };
  } else {
    return {
      status: 'EQUAL',
      symbol: '=',
      badgeClass: 'badge-price-equal',
      label: 'Harga Tetap Stabil',
      desc: `Sama persis dengan ${periodLabel} (${CurrencyUtils.formatRupiah(prevPrice)})`,
      diff: 0,
      diffPercent: 0,
      historicalPrice: prevPrice,
      historicalDate: hist.date,
      historicalStore: hist.storeName,
      inSameStore: hist.inSameStore
    };
  }
}

// ============================================================================
// 5. CART ENGINE & INSTANT QUANTITY MULTIPLICATION (F-01, F-02)
// ============================================================================
class CartManager {
  constructor() {
    this.items = StorageService.getCart();
    this.sessionMeta = StorageService.getSessionMeta();
  }

  getItems() {
    return this.items;
  }

  setStore(storeName) {
    this.sessionMeta.storeName = storeName;
    StorageService.saveSessionMeta(this.sessionMeta);
    this.refreshComparisons();
  }

  setDate(date) {
    this.sessionMeta.date = date;
    StorageService.saveSessionMeta(this.sessionMeta);
  }

  getStoreName() {
    return this.sessionMeta.storeName || 'Lotte Mart Grocery - Puri Indah';
  }

  getDate() {
    return this.sessionMeta.date || new Date().toISOString().split('T')[0];
  }

  addItem({ name, category, unit, qty, originalPrice, discountString = '0' }) {
    const q = Math.max(1, parseInt(qty, 10) || 1);
    const p = Math.max(0, parseInt(originalPrice, 10) || 0);
    const discountRes = calculateMultiTierDiscount(p, discountString);

    const item = {
      id: 'cart-item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      category: category || 'Bahan Pokok',
      unit: unit || 'pcs',
      qty: q,
      originalPrice: p,
      discountString: discountRes.discountString,
      finalUnitPrice: discountRes.finalUnitPrice,
      subtotal: discountRes.finalUnitPrice * q,
      discountSavings: discountRes.discountPerUnit * q,
      effectivePercentage: discountRes.effectivePercentage,
      createdAt: new Date().toISOString()
    };

    item.comparison = compareWithStoreHistory(this.getStoreName(), item.name, item.originalPrice);
    this.items.unshift(item);
    StorageService.saveCart(this.items);
    return item;
  }

  updateQty(itemId, newQty) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return null;

    const q = Math.max(1, parseInt(newQty, 10) || 1);
    item.qty = q;
    item.subtotal = item.finalUnitPrice * q;
    const discountPerUnit = item.originalPrice - item.finalUnitPrice;
    item.discountSavings = discountPerUnit * q;

    StorageService.saveCart(this.items);
    return item;
  }

  incrementQty(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) return this.updateQty(itemId, item.qty + 1);
  }

  decrementQty(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      if (item.qty <= 1) {
        return this.removeItem(itemId);
      } else {
        return this.updateQty(itemId, item.qty - 1);
      }
    }
  }

  removeItem(itemId) {
    this.items = this.items.filter(i => i.id !== itemId);
    StorageService.saveCart(this.items);
    return true;
  }

  updateItem(itemId, updatedData) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return null;

    const p = Math.max(0, parseInt(updatedData.originalPrice, 10) || 0);
    const q = Math.max(1, parseInt(updatedData.qty, 10) || 1);
    const discountRes = calculateMultiTierDiscount(p, updatedData.discountString || '0');

    item.name = updatedData.name.trim();
    item.category = updatedData.category || item.category;
    item.unit = updatedData.unit || item.unit;
    item.qty = q;
    item.originalPrice = p;
    item.discountString = discountRes.discountString;
    item.finalUnitPrice = discountRes.finalUnitPrice;
    item.subtotal = discountRes.finalUnitPrice * q;
    item.discountSavings = discountRes.discountPerUnit * q;
    item.effectivePercentage = discountRes.effectivePercentage;
    item.comparison = compareWithStoreHistory(this.getStoreName(), item.name, item.originalPrice);

    StorageService.saveCart(this.items);
    return item;
  }

  refreshComparisons() {
    const store = this.getStoreName();
    this.items.forEach(item => {
      item.comparison = compareWithStoreHistory(store, item.name, item.originalPrice);
    });
    StorageService.saveCart(this.items);
  }

  clearCart() {
    this.items = [];
    StorageService.saveCart(this.items);
  }

  getTotals() {
    let grandTotal = 0;
    let totalSavings = 0;
    let totalOriginal = 0;
    let totalItemsCount = 0;

    this.items.forEach(item => {
      grandTotal += item.subtotal;
      totalSavings += item.discountSavings;
      totalOriginal += (item.originalPrice * item.qty);
      totalItemsCount += item.qty;
    });

    return {
      grandTotal,
      totalSavings,
      totalOriginal,
      totalItemsCount,
      uniqueCount: this.items.length
    };
  }
}

// ============================================================================
// 6. F-05: BUDGET SAFETY CAP & SMART CUT ADVISOR ENGINE
// ============================================================================
const BudgetService = {
  getBudgetLimit() {
    return StorageService.getBudget();
  },

  setBudgetLimit(newLimit) {
    const val = Math.max(10000, parseInt(newLimit, 10) || 500000);
    StorageService.saveBudget(val);
    return val;
  },

  evaluate(totalSpent, budgetLimit = null) {
    const limit = budgetLimit || this.getBudgetLimit();
    const spent = Math.max(0, totalSpent || 0);
    const remaining = limit - spent;
    const percentage = limit > 0 ? (spent / limit) * 100 : 100;
    const roundedPercent = Math.round(percentage * 10) / 10;

    let status = 'SAFE';
    let statusTitle = 'Dompet Aman';
    let statusMessage = `Tersisa ${CurrencyUtils.formatRupiah(remaining)} dari total pagu dompet.`;
    let colorClass = 'status-safe';
    let badgeText = 'Aman (<90%)';

    if (percentage > 100) {
      const overBy = spent - limit;
      status = 'OVER_BUDGET';
      statusTitle = '🚨 OVER BUDGET!';
      statusMessage = `Belanjaan melampaui limit dompet sebesar ${CurrencyUtils.formatRupiah(overBy)}! Hapus barang tidak penting sebelum ke kasir.`;
      colorClass = 'status-danger';
      badgeText = 'Melebihi Limit (>100%)';
    } else if (percentage >= 90) {
      status = 'WARNING';
      statusTitle = '⚠️ Waspada Anggaran Menipis';
      statusMessage = `Sisa anggaran hanya ${CurrencyUtils.formatRupiah(remaining)} (${roundedPercent}% terpakai). Periksa kembali isi troli!`;
      colorClass = 'status-warning';
      badgeText = 'Waspada (≥90%)';
    }

    return {
      status,
      statusTitle,
      statusMessage,
      colorClass,
      badgeText,
      budgetLimit: limit,
      totalSpent: spent,
      remaining: remaining,
      percentage: Math.min(percentage, 100),
      rawPercentage: roundedPercent,
      isOverBudget: percentage > 100,
      isWarning: percentage >= 90 && percentage <= 100,
      overAmount: percentage > 100 ? (spent - limit) : 0
    };
  },

  getCutRecommendations(cartItems, totalSpent, budgetLimit = null) {
    const limit = budgetLimit || this.getBudgetLimit();
    if (totalSpent <= limit || !cartItems || cartItems.length === 0) {
      return [];
    }

    const overAmount = totalSpent - limit;
    const recommendations = [];

    // Priority 1: Discretionary categories (Camilan, Snack, Minuman)
    const discretionaryCategories = ['Camilan', 'Snack', 'Minuman'];
    const discretionaryItems = cartItems.filter(item => 
      discretionaryCategories.some(cat => item.category?.toLowerCase().includes(cat.toLowerCase()))
    );

    discretionaryItems.sort((a, b) => b.subtotal - a.subtotal);

    for (const item of discretionaryItems) {
      recommendations.push({
        type: 'REMOVE_DISCRETIONARY',
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        subtotal: item.subtotal,
        saves: item.subtotal,
        reason: `Barang camilan/sekunder. Pangkas ini hemat ${CurrencyUtils.formatRupiah(item.subtotal)}!`,
        actionLabel: `Hapus ${item.name}`,
        resolvesOverbudget: item.subtotal >= overAmount
      });
    }

    // Priority 2: Items with Qty > 1
    cartItems.forEach(item => {
      if (item.qty > 1 && !recommendations.some(r => r.itemId === item.id)) {
        const unitSavings = item.finalUnitPrice;
        recommendations.push({
          type: 'REDUCE_QTY',
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          saves: unitSavings,
          reason: `Kurangi kuantitas dari ${item.qty} menjadi ${item.qty - 1} ${item.unit} hemat ${CurrencyUtils.formatRupiah(unitSavings)}`,
          actionLabel: `Kurangi 1 ${item.unit}`,
          resolvesOverbudget: unitSavings >= overAmount
        });
      }
    });

    // Priority 3: Highest subtotal items
    const sortedBySubtotal = [...cartItems].sort((a, b) => b.subtotal - a.subtotal);
    for (const item of sortedBySubtotal) {
      if (!recommendations.some(r => r.itemId === item.id)) {
        recommendations.push({
          type: 'REMOVE_ITEM',
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          subtotal: item.subtotal,
          saves: item.subtotal,
          reason: `Pangkas item ini untuk langsung menghemat ${CurrencyUtils.formatRupiah(item.subtotal)}`,
          actionLabel: `Hapus ${item.name}`,
          resolvesOverbudget: item.subtotal >= overAmount
        });
      }
    }

    return recommendations.slice(0, 3);
  },

  getCategoryBreakdown(cartItems) {
    if (!cartItems || cartItems.length === 0) return [];
    const catMap = {};
    let total = 0;

    cartItems.forEach(item => {
      const cat = item.category || 'Lain-lain';
      catMap[cat] = (catMap[cat] || 0) + item.subtotal;
      total += item.subtotal;
    });

    return Object.keys(catMap).map(category => {
      const amount = catMap[category];
      const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
      return {
        category,
        amount,
        percentage: pct
      };
    }).sort((a, b) => b.amount - a.amount);
  }
};

// ============================================================================
// 7. F-06: HISTORY SERVICE & CROSS-STORE PRICE INTELLIGENCE
// ============================================================================
const HistoryService = {
  getSessions() {
    return StorageService.getHistorySessions();
  },

  finalizeCurrentCart(storeName, date, cartItems, budgetLimit, note = '') {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Troli belanja masih kosong. Tambahkan item sebelum menyimpan.');
    }

    let totalSpent = 0;
    let totalSaved = 0;

    const itemsSnapshot = cartItems.map(item => {
      totalSpent += item.subtotal;
      totalSaved += (item.discountSavings || 0);
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        qty: item.qty,
        originalPrice: item.originalPrice,
        discountString: item.discountString,
        finalUnitPrice: item.finalUnitPrice,
        subtotal: item.subtotal
      };
    });

    const newSession = {
      id: 'session-' + Date.now(),
      storeName: storeName || 'Lotte Mart Grocery - Puri Indah',
      date: date || new Date().toISOString().split('T')[0],
      budgetLimit: budgetLimit || StorageService.getBudget(),
      totalSpent,
      totalSaved,
      itemCount: cartItems.length,
      note: note || 'Selesai Belanja Supermarket',
      savedAt: new Date().toISOString(),
      items: itemsSnapshot
    };

    StorageService.saveHistorySession(newSession);
    StorageService.addStore(newSession.storeName);
    return newSession;
  },

  searchCrossStorePrices(query) {
    if (!query || !query.trim()) return [];
    const clean = query.trim().toLowerCase();
    const sessions = this.getSessions();
    const productMap = {};

    sessions.forEach(session => {
      session.items?.forEach(item => {
        const itName = item.name.toLowerCase();
        if (itName.includes(clean) || clean.includes(itName)) {
          const key = `${session.storeName}__${item.name}`;
          if (!productMap[key] || new Date(session.date) > new Date(productMap[key].date)) {
            productMap[key] = {
              storeName: session.storeName,
              productName: item.name,
              category: item.category,
              unit: item.unit,
              price: item.finalUnitPrice || item.originalPrice,
              originalPrice: item.originalPrice,
              date: session.date
            };
          }
        }
      });
    });

    const results = Object.values(productMap);
    results.sort((a, b) => a.price - b.price);
    return results;
  },

  deleteSession(sessionId) {
    return StorageService.deleteHistorySession(sessionId);
  },

  exportData() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      stores: StorageService.getStores(),
      sessions: StorageService.getHistorySessions(),
      cart: StorageService.getCart(),
      budget: StorageService.getBudget(),
      sessionMeta: StorageService.getSessionMeta()
    };
    return JSON.stringify(data, null, 2);
  }
};

// ============================================================================
// 8. CLOUD FIRESTORE REALTIME SYNC (HP <-> PC) WITH LOCALSTORAGE FALLBACK
// ============================================================================
const FirebaseSync = {
  db: null,
  auth: null,
  isInitialized: false,

  config: {
    apiKey: "AIzaSyBDhKXMPlkcw1nS7DZSAnaxc3iiUVexKBQ",
    authDomain: "smartgrocery-app-5b904.firebaseapp.com",
    projectId: "smartgrocery-app-5b904",
    storageBucket: "smartgrocery-app-5b904.firebasestorage.app",
    messagingSenderId: "179703303578",
    appId: "1:179703303578:web:c879e21cde5e894b327e23"
  },

  getDeviceId() {
    let id = localStorage.getItem('smart_grocery_device_id');
    if (!id) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const prefix = isMobile ? 'HP' : 'PC';
      id = `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
      try { localStorage.setItem('smart_grocery_device_id', id); } catch (e) {}
    }
    return id;
  },

  getDeviceType() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'HP' : 'Laptop/PC';
  },

  init() {
    if (this.isInitialized) return true;
    try {
      if (typeof window.firebase !== 'undefined') {
        if (!firebase.apps.length) {
          firebase.initializeApp(this.config);
        }
        if (typeof firebase.auth === 'function') {
          this.auth = firebase.auth();
        }
        if (typeof firebase.firestore === 'function') {
          this.db = firebase.firestore();
          try {
            this.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
          } catch (e) {}
        }
        this.isInitialized = true;
        return true;
      }
    } catch (e) {
      console.warn('Firebase init warning:', e);
    }
    return false;
  },

  onAuthChange(callback) {
    if (!this.init() || !this.auth) return () => {};
    return this.auth.onAuthStateChanged(callback);
  },

  login(email, password) {
    if (!this.init() || !this.auth) return Promise.reject(new Error('Firebase Auth belum siap. Gunakan Mode Tamu.'));
    return this.auth.signInWithEmailAndPassword(email, password);
  },

  register(email, password) {
    if (!this.init() || !this.auth) return Promise.reject(new Error('Firebase Auth belum siap. Gunakan Mode Tamu.'));
    return this.auth.createUserWithEmailAndPassword(email, password);
  },

  logout() {
    if (!this.init() || !this.auth) return Promise.resolve();
    return this.auth.signOut();
  },

  subscribeActiveTrolley(uid, onUpdateCallback, onStatusCallback) {
    if (!this.init() || !this.db || !uid) {
      if (onStatusCallback) onStatusCallback({ online: false, status: 'offline' });
      return () => {};
    }

    const myId = this.getDeviceId();
    try {
      const docRef = this.db.collection('users').doc(uid).collection('trolley').doc('active');
      return docRef.onSnapshot({ includeMetadataChanges: true }, (doc) => {
        const fromCache = doc.metadata.fromCache;
        const hasPendingWrites = doc.metadata.hasPendingWrites;

        if (onStatusCallback) {
          onStatusCallback({
            online: !fromCache,
            hasPendingWrites,
            status: fromCache ? 'cache' : 'connected'
          });
        }

        if (doc.exists) {
          const data = doc.data();
          onUpdateCallback(data, {
            fromCache,
            hasPendingWrites,
            isFromMe: data.lastDeviceId === myId
          });
        } else {
          onUpdateCallback(null, { notFound: true, fromCache });
        }
      }, (err) => {
        console.warn('Firestore active_cart snapshot notice:', err);
        if (onStatusCallback) onStatusCallback({ online: false, status: 'error' });
      });
    } catch (e) {
      console.warn('subscribeActiveTrolley warning:', e);
      return () => {};
    }
  },

  syncActiveTrolley(uid, payload) {
    if (!this.init() || !this.db || !uid) return Promise.resolve(false);
    try {
      const cleanPayload = {
        storeLocation: payload.storeLocation || 'Lotte Mart Grocery - Puri Indah',
        shoppingDate: payload.shoppingDate || new Date().toISOString().split('T')[0],
        walletLimit: Number(payload.walletLimit) || 500000,
        items: Array.isArray(payload.items) ? payload.items : [],
        totalSpent: Number(payload.totalSpent) || 0,
        totalSaved: Number(payload.totalSaved) || 0,
        totalItemsCount: Number(payload.totalItemsCount) || 0,
        notes: payload.notes || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastDeviceId: this.getDeviceId(),
        lastDeviceType: this.getDeviceType()
      };
      return this.db.collection('users').doc(uid).collection('trolley').doc('active')
        .set(cleanPayload, { merge: true })
        .then(() => true)
        .catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  },

  subscribeBudget(uid, onUpdateCallback) {
    if (!this.init() || !this.db || !uid) return () => {};
    try {
      return this.db.collection('users').doc(uid).collection('budget').doc('current')
        .onSnapshot((doc) => {
          if (doc.exists) {
            onUpdateCallback(doc.data());
          }
        }, () => {});
    } catch (e) {
      return () => {};
    }
  },

  syncBudget(uid, payload) {
    if (!this.init() || !this.db || !uid) return Promise.resolve(false);
    try {
      const cleanPayload = {
        walletLimit: Number(payload.walletLimit) || 500000,
        categoryBudgets: Array.isArray(payload.categoryBudgets) ? payload.categoryBudgets : [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastDeviceId: this.getDeviceId(),
        lastDeviceType: this.getDeviceType()
      };
      return this.db.collection('users').doc(uid).collection('budget').doc('current')
        .set(cleanPayload, { merge: true })
        .then(() => true)
        .catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  },

  subscribeHistory(uid, onUpdateCallback) {
    if (!this.init() || !this.db || !uid) return () => {};
    try {
      return this.db.collection('users').doc(uid).collection('history')
        .onSnapshot((snapshot) => {
          const list = [];
          snapshot.forEach(d => list.push({ ...d.data(), id: d.id }));
          list.sort((a, b) => new Date(b.savedAt || b.date) - new Date(a.savedAt || a.date));
          onUpdateCallback(list);
        }, () => {});
    } catch (e) {
      return () => {};
    }
  },

  saveHistory(uid, session) {
    if (!this.init() || !this.db || !uid) return Promise.resolve(false);
    try {
      const id = session.id || ('session-' + Date.now());
      return this.db.collection('users').doc(uid).collection('history').doc(id).set({
        ...session,
        savedAt: session.savedAt || new Date().toISOString(),
        lastDeviceId: this.getDeviceId(),
        lastDeviceType: this.getDeviceType()
      }).then(() => true).catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  },

  deleteHistory(uid, sessionId) {
    if (!this.init() || !this.db || !uid) return Promise.resolve(false);
    try {
      return this.db.collection('users').doc(uid).collection('history').doc(sessionId).delete()
        .then(() => true).catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  },

  subscribeStores(onUpdateCallback) {
    if (!this.init() || !this.db) return () => {};
    try {
      return this.db.collection('app_metadata').doc('stores').onSnapshot((doc) => {
        if (doc.exists) {
          const d = doc.data();
          if (Array.isArray(d.stores) && d.stores.length > 0) {
            onUpdateCallback(d.stores);
          }
        }
      }, () => {});
    } catch (e) {
      return () => {};
    }
  },

  syncStores(stores) {
    if (!this.init() || !this.db) return Promise.resolve(false);
    try {
      return this.db.collection('app_metadata').doc('stores').set({
        stores,
        lastDeviceId: this.getDeviceId()
      }, { merge: true }).then(() => true).catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  }
};

// ============================================================================
// 9. WEB AUDIO & HAPTIC SYNTHESIZER
// ============================================================================
const SoundEffects = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
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
    } catch (e) {}
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

function triggerHaptic(pattern = [40]) {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function showToast(message, icon = '✨') {
  const toast = document.getElementById('app-toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  if (toast && msgEl) {
    msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }
}

// ============================================================================
// 10. DOM REFERENCES & UI INITIALIZATION
// ============================================================================
StorageService.init();
const cartManager = new CartManager();

// Global DOM elements
let storeSelect, sessionDateInput, cartItemsList, quickProductsChips, cartItemCount, navCartBadge;
let budgetBanner, budgetSafetyIcon, budgetSafetyTitle, budgetStatusPill, valTotalSpent, valBudgetLimit;
let budgetProgressBar, budgetSafetyNote, smartCutContainer, smartCutList;
let itemModalOverlay, btnOpenAddModal, btnCloseModal, itemForm, modalTitle, editItemId;
let inputItemName, inputItemCategory, inputItemUnit, inputItemQty, inputItemPrice, inputItemDiscount;
let modalQtyMinus, modalQtyPlus, modalPriceComparator, modalComparatorIcon, modalComparatorText;
let discountPreviewBox, discountPreviewSummary, discountPreviewSteps, modalLiveSubtotal, modalLiveSavings;
let finishModalOverlay, btnFinishShopping, btnCloseFinishModal, btnConfirmSaveSession;
let newStoreModalOverlay, btnCloseStoreModal, newStoreForm;
let navTabBtns, tabViews, cartFloatingDock;

function grabDOMElements() {
  storeSelect = document.getElementById('store-select');
  sessionDateInput = document.getElementById('session-date-input');
  cartItemsList = document.getElementById('cart-items-list');
  quickProductsChips = document.getElementById('quick-products-chips');
  cartItemCount = document.getElementById('cart-item-count');
  navCartBadge = document.getElementById('nav-cart-badge');

  budgetBanner = document.getElementById('budget-banner');
  budgetSafetyIcon = document.getElementById('budget-safety-icon');
  budgetSafetyTitle = document.getElementById('budget-safety-title');
  budgetStatusPill = document.getElementById('budget-status-pill');
  valTotalSpent = document.getElementById('val-total-spent');
  valBudgetLimit = document.getElementById('val-budget-limit');
  budgetProgressBar = document.getElementById('budget-progress-bar');
  budgetSafetyNote = document.getElementById('budget-safety-note');
  smartCutContainer = document.getElementById('smart-cut-container');
  smartCutList = document.getElementById('smart-cut-list');

  itemModalOverlay = document.getElementById('item-modal-overlay');
  btnOpenAddModal = document.getElementById('btn-open-add-modal');
  btnCloseModal = document.getElementById('btn-close-modal');
  itemForm = document.getElementById('item-form');
  modalTitle = document.getElementById('modal-title');
  editItemId = document.getElementById('edit-item-id');
  inputItemName = document.getElementById('input-item-name');
  inputItemCategory = document.getElementById('input-item-category');
  inputItemUnit = document.getElementById('input-item-unit');
  inputItemQty = document.getElementById('input-item-qty');
  inputItemPrice = document.getElementById('input-item-price');
  inputItemDiscount = document.getElementById('input-item-discount');
  modalQtyMinus = document.getElementById('modal-qty-minus');
  modalQtyPlus = document.getElementById('modal-qty-plus');
  modalPriceComparator = document.getElementById('modal-price-comparator');
  modalComparatorIcon = document.getElementById('modal-comparator-icon');
  modalComparatorText = document.getElementById('modal-comparator-text');
  discountPreviewBox = document.getElementById('discount-preview-box');
  discountPreviewSummary = document.getElementById('discount-preview-summary');
  discountPreviewSteps = document.getElementById('discount-preview-steps');
  modalLiveSubtotal = document.getElementById('modal-live-subtotal');
  modalLiveSavings = document.getElementById('modal-live-savings');

  finishModalOverlay = document.getElementById('finish-modal-overlay');
  btnFinishShopping = document.getElementById('btn-finish-shopping');
  btnCloseFinishModal = document.getElementById('btn-close-finish-modal');
  btnConfirmSaveSession = document.getElementById('btn-confirm-save-session');

  newStoreModalOverlay = document.getElementById('new-store-modal-overlay');
  btnCloseStoreModal = document.getElementById('btn-close-store-modal');
  newStoreForm = document.getElementById('new-store-form');

  navTabBtns = document.querySelectorAll('.nav-tab-btn');
  tabViews = {
    belanja: document.getElementById('tab-belanja-view'),
    riwayat: document.getElementById('tab-riwayat-view'),
    anggaran: document.getElementById('tab-anggaran-view')
  };
  cartFloatingDock = document.getElementById('cart-floating-dock');
}

function initApp() {
  grabDOMElements();
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
  initRealtimeSync();
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
    try { window.lucide.createIcons(); } catch (e) {}
  }
}

// ============================================================================
// 11. STORE DROPDOWN & DATE CONTROLS (F-01)
// ============================================================================
function populateStoreDropdown() {
  if (!storeSelect) return;
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

  const newOpt = document.createElement('option');
  newOpt.value = '__ADD_NEW__';
  newOpt.textContent = '➕ Tambah Toko Baru...';
  storeSelect.appendChild(newOpt);
}

function initDateInput() {
  if (!sessionDateInput) return;
  const currentDate = cartManager.getDate();
  sessionDateInput.value = currentDate;

  sessionDateInput.addEventListener('change', (e) => {
    cartManager.setDate(e.target.value);
    showToast(`Tanggal transaksi: ${e.target.value}`);
  });

  if (storeSelect) {
    storeSelect.addEventListener('change', (e) => {
      if (e.target.value === '__ADD_NEW__') {
        openNewStoreModal();
        storeSelect.value = cartManager.getStoreName();
        return;
      }
      cartManager.setStore(e.target.value);
      showToast(`Lokasi Toko: ${e.target.value}`);
      renderCart();
    });
  }
}

function initQuickChips() {
  if (!quickProductsChips) return;
  quickProductsChips.innerHTML = '';
  QUICK_PRODUCTS.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quick-product-chip';
    chip.innerHTML = `
      <span class="quick-chip-name">${escapeHtml(p.name)}</span>
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
// 12. CART RENDERING & F-02 (INSTANT QTY MULTIPLICATION) & F-04 (COMPARATOR)
// ============================================================================
function renderCart() {
  if (!cartItemsList) return;
  const items = cartManager.getItems();
  const totals = cartManager.getTotals();

  if (cartItemCount) {
    cartItemCount.textContent = `${totals.totalItemsCount} Item (${totals.uniqueCount} Jenis)`;
  }
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
        <p>Tekan tombol <strong>+ Masukkan Troli</strong> di bawah atau pilih item favorit anak rantau saat mendorong troli.</p>
      </div>
    `;
    refreshLucideIcons();
    return;
  }

  cartItemsList.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grocery-item-card';

    // F-04 Comparison Tag (Always recalculate against currently selected store)
    const comp = compareWithStoreHistory(cartManager.getStoreName(), item.name, item.originalPrice);
    let compBadgeHtml = '';

    if (comp && comp.status !== 'NONE') {
      compBadgeHtml = `
        <span class="price-comparator-badge ${comp.badgeClass}" title="${escapeHtml(comp.desc || '')}">
          <span>${comp.symbol}</span>
          <span>${escapeHtml(comp.label)}</span>
        </span>
      `;
    }

    // F-03 Discount ribbon
    let discountTagHtml = '';
    if (item.discountString && item.discountString !== '0' && item.discountString !== '0%') {
      discountTagHtml = `
        <span class="discount-ribbon">Diskon: ${escapeHtml(item.discountString)}</span>
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

        <!-- F-02 Ergonomic Stepper Control (Instant Qty Recalculation) -->
        <div class="qty-stepper-control">
          <button type="button" class="stepper-btn minus-btn" data-id="${item.id}">−</button>
          <input type="number" class="stepper-input cart-qty-input" data-id="${item.id}" value="${item.qty}" min="1" inputmode="numeric">
          <button type="button" class="stepper-btn plus-btn" data-id="${item.id}">+</button>
        </div>
      </div>

      <div class="item-card-bottom">
        <span class="history-tooltip-text">
          ${comp && comp.desc ? escapeHtml(comp.desc) : `Tercatat di ${escapeHtml(cartManager.getStoreName())}`}
        </span>
        ${item.discountSavings > 0 ? `
          <span style="font-size:11px; color:#fbbf24; font-weight:700;">
            Hemat ${CurrencyUtils.formatRupiah(item.discountSavings)}
          </span>
        ` : ''}
      </div>
    `;

    // Inline Card Listeners (F-02: Instant Qty recalculation without reload)
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
// 13. F-05: BUDGET SAFETY CAP & SMART CUT ADVISOR
// ============================================================================
function renderBudgetStatus() {
  if (!valTotalSpent || !valBudgetLimit) return;
  const totals = cartManager.getTotals();
  const evaluation = BudgetService.evaluate(totals.grandTotal);

  valTotalSpent.textContent = CurrencyUtils.formatRupiah(totals.grandTotal);
  valBudgetLimit.textContent = CurrencyUtils.formatRupiah(evaluation.budgetLimit);

  if (budgetBanner) {
    budgetBanner.className = `budget-safety-banner ${evaluation.colorClass}`;
  }
  if (budgetSafetyTitle) budgetSafetyTitle.textContent = evaluation.statusTitle;
  if (budgetStatusPill) budgetStatusPill.textContent = evaluation.badgeText;
  if (budgetSafetyNote) budgetSafetyNote.textContent = evaluation.statusMessage;

  if (budgetSafetyIcon) {
    if (evaluation.status === 'SAFE') {
      budgetSafetyIcon.textContent = '🛡️';
    } else if (evaluation.status === 'WARNING') {
      budgetSafetyIcon.textContent = '⚠️';
    } else {
      budgetSafetyIcon.textContent = '🚨';
      SoundEffects.playWarningBuzzer();
      triggerHaptic([100, 50, 100]);
    }
  }

  if (budgetProgressBar) {
    const displayPercent = Math.min(100, evaluation.percentage);
    budgetProgressBar.style.width = `${displayPercent}%`;
  }

  // Smart Cut Advisor
  if (smartCutContainer && smartCutList) {
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
              ${escapeHtml(rec.actionLabel)}
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
  }

  renderCategoryBreakdown();
}

// ============================================================================
// 14. MODAL DIALOGS, LIVE CALCULATION & PRICE COMPARISONS (F-01, F-03, F-04)
// ============================================================================
function initModalListeners() {
  if (btnOpenAddModal) btnOpenAddModal.addEventListener('click', openAddModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeItemModal);

  const catPills = document.querySelectorAll('#category-pills .selector-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (inputItemCategory) inputItemCategory.value = pill.dataset.value;
    });
  });

  if (modalQtyMinus && inputItemQty) {
    modalQtyMinus.addEventListener('click', () => {
      let q = parseInt(inputItemQty.value, 10) || 1;
      if (q > 1) {
        inputItemQty.value = q - 1;
        updateModalLiveCalculation();
      }
    });
  }

  if (modalQtyPlus && inputItemQty) {
    modalQtyPlus.addEventListener('click', () => {
      let q = parseInt(inputItemQty.value, 10) || 1;
      inputItemQty.value = q + 1;
      updateModalLiveCalculation();
    });
  }

  if (inputItemQty) inputItemQty.addEventListener('input', updateModalLiveCalculation);

  if (inputItemPrice) {
    inputItemPrice.addEventListener('input', (e) => {
      const rawVal = CurrencyUtils.parseRupiah(e.target.value);
      e.target.value = rawVal > 0 ? CurrencyUtils.formatRupiah(rawVal) : '';
      updateModalLiveCalculation();
    });
  }

  if (inputItemName) {
    inputItemName.addEventListener('input', () => {
      updateModalPriceComparison();
    });
  }

  const discChips = document.querySelectorAll('#discount-preset-chips .discount-chip');
  discChips.forEach(chip => {
    chip.addEventListener('click', () => {
      discChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (inputItemDiscount) inputItemDiscount.value = chip.dataset.val;
      updateModalLiveCalculation();
    });
  });

  if (inputItemDiscount) {
    inputItemDiscount.addEventListener('input', () => {
      discChips.forEach(c => c.classList.remove('active'));
      updateModalLiveCalculation();
    });
  }

  if (itemForm) {
    itemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = inputItemName ? inputItemName.value.trim() : '';
      const price = inputItemPrice ? CurrencyUtils.parseRupiah(inputItemPrice.value) : 0;
      const qty = inputItemQty ? (parseInt(inputItemQty.value, 10) || 1) : 1;
      const category = inputItemCategory ? inputItemCategory.value : 'Bahan Pokok';
      const unit = inputItemUnit ? inputItemUnit.value : 'pcs';
      const discount = inputItemDiscount ? inputItemDiscount.value : '0';

      if (!name) {
        showToast('Masukkan nama produk!', '⚠️');
        return;
      }
      if (price <= 0) {
        showToast('Masukkan harga satuan yang valid!', '⚠️');
        return;
      }

      const editId = editItemId ? editItemId.value : '';
      if (editId) {
        cartManager.updateItem(editId, {
          name, category, unit, qty, originalPrice: price, discountString: discount
        });
        showToast(`Item ${name} berhasil diubah!`, '✏️');
      } else {
        cartManager.addItem({
          name, category, unit, qty, originalPrice: price, discountString: discount
        });
        SoundEffects.playCoinChime();
        triggerHaptic([30, 30]);
        showToast(`+${qty} ${name} masuk troli!`, '🛒');
      }

      closeItemModal();
      renderCart();
      renderBudgetStatus();
    });
  }

  // Finish shopping modal buttons
  if (btnFinishShopping) {
    btnFinishShopping.addEventListener('click', () => {
      const items = cartManager.getItems();
      if (items.length === 0) {
        showToast('Troli belanja masih kosong!', '⚠️');
        return;
      }
      openFinishModal();
    });
  }

  if (btnCloseFinishModal && finishModalOverlay) {
    btnCloseFinishModal.addEventListener('click', () => {
      finishModalOverlay.classList.remove('open');
    });
  }

  if (btnConfirmSaveSession) {
    btnConfirmSaveSession.addEventListener('click', () => {
      const store = cartManager.getStoreName();
      const date = cartManager.getDate();
      const items = cartManager.getItems();
      const budget = BudgetService.getBudgetLimit();
      const notesEl = document.getElementById('finish-session-notes');
      const notes = notesEl ? notesEl.value : '';

      try {
        const savedSession = HistoryService.finalizeCurrentCart(store, date, items, budget, notes);
        FirebaseSync.saveHistory(savedSession);
        cartManager.clearCart();
        dispatchTrolleySync(true);
        if (finishModalOverlay) finishModalOverlay.classList.remove('open');
        SoundEffects.playCoinChime();
        triggerHaptic([50, 100, 50]);
        showToast('Sesi belanja berhasil disimpan ke Riwayat Toko!', '🎉');
        renderCart();
        renderBudgetStatus();
        renderHistorySessions();
        switchTab('riwayat');
      } catch (err) {
        showToast(err.message, '⚠️');
      }
    });
  }

  const editBudgetBtn = document.getElementById('btn-edit-budget');
  if (editBudgetBtn) {
    editBudgetBtn.addEventListener('click', () => switchTab('anggaran'));
  }

  const budgetBtns = document.querySelectorAll('.preset-budget-btn');
  const inputBudgetCap = document.getElementById('input-budget-cap');
  budgetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      budgetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = parseInt(btn.dataset.val, 10);
      if (inputBudgetCap) inputBudgetCap.value = CurrencyUtils.formatRupiah(val);
    });
  });

  const saveBudgetCapBtn = document.getElementById('btn-save-budget-cap');
  if (saveBudgetCapBtn) {
    saveBudgetCapBtn.addEventListener('click', () => {
      if (!inputBudgetCap) return;
      const val = CurrencyUtils.parseRupiah(inputBudgetCap.value);
      if (val > 0) {
        BudgetService.setBudgetLimit(val);
        showToast(`Pagu dompet berhasil disimpan: ${CurrencyUtils.formatRupiah(val)}!`, '💰');
        renderBudgetStatus();
        switchTab('belanja');
      }
    });
  }

  const resetDataBtn = document.getElementById('btn-reset-data');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (confirm('Muat ulang data sampel default (Lotte Mart & Super Indo)?')) {
        StorageService.resetToDefault();
        dispatchTrolleySync(true).then(() => {
          location.reload();
        });
      }
    });
  }

  const exportDataBtn = document.getElementById('btn-export-data');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      const json = HistoryService.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-grocery-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showToast('Data belanja berhasil di-export!', '💾');
    });
  }

  const crossSearchInput = document.getElementById('cross-store-search');
  if (crossSearchInput) {
    crossSearchInput.addEventListener('input', (e) => {
      renderCrossStoreResults(e.target.value);
    });
  }

  // New store modal
  if (btnCloseStoreModal && newStoreModalOverlay) {
    btnCloseStoreModal.addEventListener('click', () => {
      newStoreModalOverlay.classList.remove('open');
    });
  }

  if (newStoreForm) {
    newStoreForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('input-new-store-name');
      const areaInput = document.getElementById('input-new-store-area');
      const name = nameInput ? nameInput.value.trim() : '';
      const area = areaInput ? areaInput.value.trim() || 'Supermarket' : 'Supermarket';
      if (name) {
        StorageService.addStore(name, area);
        populateStoreDropdown();
        if (storeSelect) storeSelect.value = name;
        cartManager.setStore(name);
        if (newStoreModalOverlay) newStoreModalOverlay.classList.remove('open');
        showToast(`Toko baru ditambahkan: ${name}!`, '🏪');
        renderCart();
      }
    });
  }
}

function openAddModal() {
  if (!itemModalOverlay) return;
  if (modalTitle) modalTitle.textContent = 'Tambah Belanjaan Baru';
  if (editItemId) editItemId.value = '';
  if (itemForm) itemForm.reset();
  if (inputItemQty) inputItemQty.value = 1;
  if (inputItemPrice) inputItemPrice.value = '';
  if (inputItemDiscount) inputItemDiscount.value = '0';
  if (modalPriceComparator) modalPriceComparator.style.display = 'none';
  if (discountPreviewBox) discountPreviewBox.style.display = 'none';
  if (modalLiveSubtotal) modalLiveSubtotal.textContent = 'Rp 0';
  if (modalLiveSavings) modalLiveSavings.textContent = 'Hemat: Rp 0';

  const catPills = document.querySelectorAll('#category-pills .selector-pill');
  catPills.forEach(p => p.classList.remove('active'));
  if (catPills[0]) {
    catPills[0].classList.add('active');
    if (inputItemCategory) inputItemCategory.value = catPills[0].dataset.value;
  }

  itemModalOverlay.classList.add('open');
  if (inputItemName) setTimeout(() => inputItemName.focus(), 250);
}

function openEditModal(item) {
  if (!itemModalOverlay) return;
  if (modalTitle) modalTitle.textContent = 'Edit Item Belanja';
  if (editItemId) editItemId.value = item.id;
  if (inputItemName) inputItemName.value = item.name;
  if (inputItemPrice) inputItemPrice.value = CurrencyUtils.formatRupiah(item.originalPrice);
  if (inputItemQty) inputItemQty.value = item.qty;
  if (inputItemUnit) inputItemUnit.value = item.unit || 'pcs';
  if (inputItemDiscount) inputItemDiscount.value = item.discountString || '0';

  const catPills = document.querySelectorAll('#category-pills .selector-pill');
  catPills.forEach(p => {
    if (p.dataset.value === item.category) {
      p.classList.add('active');
      if (inputItemCategory) inputItemCategory.value = item.category;
    } else {
      p.classList.remove('active');
    }
  });

  updateModalPriceComparison();
  updateModalLiveCalculation();
  itemModalOverlay.classList.add('open');
}

function closeItemModal() {
  if (itemModalOverlay) itemModalOverlay.classList.remove('open');
}

function updateModalLiveCalculation() {
  if (!inputItemPrice || !modalLiveSubtotal) return;
  const price = CurrencyUtils.parseRupiah(inputItemPrice.value);
  const qty = inputItemQty ? Math.max(1, parseInt(inputItemQty.value, 10) || 1) : 1;
  const discountString = inputItemDiscount ? inputItemDiscount.value : '0';

  const res = calculateMultiTierDiscount(price, discountString);
  const subtotal = res.finalUnitPrice * qty;
  const totalSavings = res.discountPerUnit * qty;

  modalLiveSubtotal.textContent = CurrencyUtils.formatRupiah(subtotal);
  if (modalLiveSavings) {
    modalLiveSavings.textContent = totalSavings > 0 ? `Hemat: ${CurrencyUtils.formatRupiah(totalSavings)} (${res.effectivePercentage}%)` : 'Tanpa Diskon';
  }

  if (discountPreviewBox) {
    if (res.discountPerUnit > 0) {
      discountPreviewBox.style.display = 'block';
      if (discountPreviewSummary) {
        discountPreviewSummary.textContent = `Harga Bersih: ${CurrencyUtils.formatRupiah(res.finalUnitPrice)} / unit (Hemat ${CurrencyUtils.formatRupiah(res.discountPerUnit)})`;
      }
      if (discountPreviewSteps) {
        discountPreviewSteps.innerHTML = (res.breakdownSteps && res.breakdownSteps.length > 0) ? res.breakdownSteps.map(s => `• ${escapeHtml(s)}`).join('<br>') : '';
      }
    } else {
      discountPreviewBox.style.display = 'none';
    }
  }

  updateModalPriceComparison();
}

function updateModalPriceComparison() {
  if (!inputItemName || !inputItemPrice || !modalPriceComparator) return;
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
    if (modalComparatorIcon) modalComparatorIcon.textContent = comp.symbol;
    if (modalComparatorText) modalComparatorText.innerHTML = `<strong>${escapeHtml(comp.label)}</strong>: ${escapeHtml(comp.desc)}`;
  } else {
    modalPriceComparator.style.display = 'none';
  }
}

function openFinishModal() {
  if (!finishModalOverlay) return;
  const totals = cartManager.getTotals();
  const evaluation = BudgetService.evaluate(totals.grandTotal);

  const finishStoreEl = document.getElementById('finish-store-name');
  const finishDateEl = document.getElementById('finish-date');
  const finishTotalEl = document.getElementById('finish-total-spent');
  const finishSavedEl = document.getElementById('finish-total-saved');
  const statusTag = document.getElementById('finish-status-tag');

  if (finishStoreEl) finishStoreEl.textContent = cartManager.getStoreName();
  if (finishDateEl) finishDateEl.textContent = cartManager.getDate();
  if (finishTotalEl) finishTotalEl.textContent = CurrencyUtils.formatRupiah(totals.grandTotal);
  if (finishSavedEl) finishSavedEl.textContent = CurrencyUtils.formatRupiah(totals.totalSavings);
  
  if (statusTag) {
    statusTag.textContent = evaluation.badgeText;
    statusTag.style.color = evaluation.isOverBudget ? '#f43f5e' : (evaluation.isWarning ? '#f59e0b' : '#10b981');
  }

  finishModalOverlay.classList.add('open');
}

function openNewStoreModal() {
  if (newStoreModalOverlay) newStoreModalOverlay.classList.add('open');
}

// ============================================================================
// 15. TAB NAVIGATION & VIEWS
// ============================================================================
function initTabs() {
  navTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });

  const toggleBtn = document.getElementById('toggle-frame-btn');
  const frameModeText = document.getElementById('frame-mode-text');
  const mobileFrame = document.getElementById('mobile-frame');

  if (toggleBtn && mobileFrame) {
    let isFramed = true;
    toggleBtn.addEventListener('click', () => {
      isFramed = !isFramed;
      if (isFramed) {
        mobileFrame.style.maxWidth = '430px';
        mobileFrame.style.borderRadius = '44px';
        mobileFrame.style.height = '92vh';
        if (frameModeText) frameModeText.textContent = 'Frame Smartphone';
      } else {
        mobileFrame.style.maxWidth = '100%';
        mobileFrame.style.borderRadius = '0';
        mobileFrame.style.height = '100vh';
        if (frameModeText) frameModeText.textContent = 'Layar Penuh (Responsif)';
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
    if (tabViews[key]) {
      tabViews[key].style.display = (key === tabKey) ? 'block' : 'none';
    }
  });

  if (cartFloatingDock) {
    cartFloatingDock.style.display = (tabKey === 'belanja') ? 'flex' : 'none';
  }

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
// 16. TAB 2: RIWAYAT SESI BELANJA & CROSS-STORE SEARCH (F-06)
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
      💡 <strong>Rekomendasi Hemat:</strong> Termurah di <strong>${escapeHtml(cheapest.storeName)}</strong> seharga ${CurrencyUtils.formatRupiah(cheapest.price)} / ${cheapest.unit}!
    </div>
    ${results.map((r, idx) => `
      <div class="cross-store-row">
        <div>
          <div class="store-name-tag">${escapeHtml(r.storeName)} ${idx === 0 ? '🏆 Termurah' : ''}</div>
          <div style="font-size:11px; color:#94a3b8;">${escapeHtml(r.productName)} (${escapeHtml(r.unit)}) • Tgl ${escapeHtml(r.date)}</div>
        </div>
        <div class="store-price-tag">${CurrencyUtils.formatRupiah(r.price)}</div>
      </div>
    `).join('')}
  `;
}

// ============================================================================
// 17. TAB 3: ANGGARAN & CATEGORY BREAKDOWN
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
// 18. REALTIME MULTI-DEVICE FIRESTORE SYNC & LOCALSTORAGE FALLBACK
// ============================================================================
function setSyncBadgeState(state, customText) {
  const badge = document.getElementById('cloud-sync-badge');
  const dot = document.getElementById('cloud-sync-dot');
  const text = document.getElementById('cloud-sync-text');
  if (!badge || !dot || !text) return;

  badge.classList.remove('online', 'offline', 'syncing');
  dot.classList.remove('sync-pulse');

  if (state === 'online') {
    badge.classList.add('online');
    dot.style.background = '#10b981';
    text.textContent = customText || 'Cloud Sync';
    badge.title = 'Terhubung ke Cloud Firestore. Realtime HP ↔ PC aktif.';
  } else if (state === 'offline') {
    badge.classList.add('offline');
    dot.style.background = '#f59e0b';
    text.textContent = customText || 'Offline';
    badge.title = 'Mode Offline: Keranjang belanja tersimpan aman di LocalStorage.';
  } else if (state === 'syncing') {
    badge.classList.add('syncing');
    dot.classList.add('sync-pulse');
    dot.style.background = '#a855f7';
    text.textContent = customText || 'Menyimpan...';
    badge.title = 'Sedang menyinkronkan data ke Cloud Firestore...';
  }
}

let syncDebounceTimer = null;

function dispatchTrolleySync(immediate = false) {
  if (StorageService.isApplyingRemote()) return Promise.resolve(false);

  const totals = cartManager.getTotals();
  const payload = {
    storeLocation: cartManager.getStoreName(),
    shoppingDate: cartManager.getDate(),
    walletLimit: StorageService.getBudget(),
    items: cartManager.getItems(),
    totalSpent: totals.grandTotal,
    totalSaved: totals.totalSavings,
    totalItemsCount: totals.totalItemsCount,
    notes: cartManager.sessionMeta?.notes || ''
  };

  setSyncBadgeState('syncing');

  return new Promise((resolve) => {
    const doSync = () => {
      FirebaseSync.syncActiveTrolley(payload).then((success) => {
        if (success) {
          setSyncBadgeState('online');
        } else {
          setSyncBadgeState('offline', 'Mode Offline');
        }
        resolve(success);
      });
    };

    if (immediate) {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      doSync();
    } else {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(doSync, 200);
    }
  });
}

function initRealtimeSync() {
  StorageService.setSyncCallback(({ type, data }) => {
    if (type === 'cart' || type === 'meta' || type === 'budget') {
      dispatchTrolleySync();
    } else if (type === 'stores') {
      FirebaseSync.syncStores(data);
    } else if (type === 'history') {
      FirebaseSync.saveHistory(data);
    }
  });

  FirebaseSync.subscribeActiveTrolley((remoteData, meta) => {
    if (!remoteData) {
      dispatchTrolleySync(true);
      return;
    }

    if (meta.fromCache) {
      setSyncBadgeState('offline', 'Offline (Cache)');
    } else {
      setSyncBadgeState('online', 'Cloud Sync');
    }

    if (meta.isFromMe && meta.hasPendingWrites) {
      return;
    }

    applyRemoteTrolleyUpdate(remoteData, meta);
  }, (status) => {
    if (status.online) {
      setSyncBadgeState('online', 'Cloud Sync');
    } else if (status.status === 'cache' || !navigator.onLine) {
      setSyncBadgeState('offline', 'Mode Offline');
    } else {
      setSyncBadgeState('offline', 'Offline');
    }
  });

  FirebaseSync.subscribeHistory((remoteSessions) => {
    if (Array.isArray(remoteSessions) && remoteSessions.length > 0) {
      StorageService.mergeRemoteHistory(remoteSessions);
      renderHistorySessions();
    }
  });

  FirebaseSync.subscribeStores((remoteStores) => {
    if (Array.isArray(remoteStores) && remoteStores.length > 0) {
      StorageService.mergeRemoteStores(remoteStores);
      populateStoreDropdown();
    }
  });

  window.addEventListener('online', () => {
    setSyncBadgeState('online', 'Cloud Sync');
    showToast('Koneksi internet aktif! Menyinkronkan...', '🌐');
    dispatchTrolleySync(true);
  });

  window.addEventListener('offline', () => {
    setSyncBadgeState('offline', 'Mode Offline (LocalStorage)');
    showToast('Offline: Keranjang aman di LocalStorage', '💾');
  });

  const cloudBadge = document.getElementById('cloud-sync-badge');
  if (cloudBadge) {
    cloudBadge.addEventListener('click', () => {
      const myDev = FirebaseSync.getDeviceType();
      if (navigator.onLine) {
        showToast(`Cloud Realtime Aktif (${myDev}) ↔ Terhubung ke HP & PC`, '🟢');
        dispatchTrolleySync(true);
      } else {
        showToast(`Mode Offline: Keranjang aman di LocalStorage (${myDev})`, '🟡');
      }
    });
  }
}

function applyRemoteTrolleyUpdate(remoteData, meta) {
  StorageService.setApplyingRemote(true);
  try {
    let hasChanges = false;

    if (Array.isArray(remoteData.items)) {
      cartManager.items = remoteData.items;
      StorageService.saveCart(remoteData.items);
      hasChanges = true;
    }

    if (remoteData.storeLocation && remoteData.storeLocation !== cartManager.getStoreName()) {
      cartManager.sessionMeta.storeName = remoteData.storeLocation;
      if (storeSelect) storeSelect.value = remoteData.storeLocation;
      StorageService.saveSessionMeta(cartManager.sessionMeta);
      hasChanges = true;
    }

    if (remoteData.shoppingDate && remoteData.shoppingDate !== cartManager.getDate()) {
      cartManager.sessionMeta.date = remoteData.shoppingDate;
      if (sessionDateInput) sessionDateInput.value = remoteData.shoppingDate;
      StorageService.saveSessionMeta(cartManager.sessionMeta);
      hasChanges = true;
    }

    if (remoteData.notes) {
      cartManager.sessionMeta.notes = remoteData.notes;
      StorageService.saveSessionMeta(cartManager.sessionMeta);
    }

    if (typeof remoteData.walletLimit === 'number' && remoteData.walletLimit > 0) {
      StorageService.saveBudget(remoteData.walletLimit);
      const inputBudgetCap = document.getElementById('input-budget-cap');
      if (inputBudgetCap) {
        inputBudgetCap.value = CurrencyUtils.formatRupiah(remoteData.walletLimit);
      }
      hasChanges = true;
    }

    if (hasChanges) {
      cartManager.refreshComparisons();
      renderCart();
      renderBudgetStatus();
      renderCategoryBreakdown();

      if (!meta.isFromMe && !meta.hasPendingWrites) {
        const otherDev = remoteData.lastDeviceType || 'Perangkat Lain';
        showToast(`⚡ Troli diperbarui dari ${otherDev}!`, '🛒');
        SoundEffects.playBeep(880, 0.05);
      }
    }
  } finally {
    StorageService.setApplyingRemote(false);
  }
}

// ============================================================================
// 19. PWA SERVICE WORKER
// ============================================================================
function initPWA() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW failed:', err));
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

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
