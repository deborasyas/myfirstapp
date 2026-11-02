/**
 * Storage & Database Layer - Smart Grocery & Budget Safety Tracker
 * Multi-store persistence, pre-seeded historical data, lookup queries,
 * and Realtime Synchronization hooks with Cloud Firestore & LocalStorage fallback.
 */

const STORAGE_KEYS = {
  CURRENT_CART: 'smart_grocery_cart_v3',
  SESSION_META: 'smart_grocery_session_meta_v3',
  STORES: 'smart_grocery_stores_v1',
  SESSIONS_HISTORY: 'smart_grocery_history_v3',
  PRICE_DB: 'smart_grocery_price_db_v1',
  USER_BUDGET: 'smart_grocery_budget_v1'
};

// Default supermarket list with "Lotte Mart Grocery - Puri Indah" as first / default
export const DEFAULT_STORES = [
  { id: 'lotte-puri', name: 'Lotte Mart Grocery - Puri Indah', area: 'Jakarta Barat', icon: 'store' },
  { id: 'superindo-meruya', name: 'Super Indo - Meruya', area: 'Jakarta Barat', icon: 'shopping-cart' },
  { id: 'grandlucky-scbd', name: 'Grand Lucky - SCBD', area: 'Jakarta Selatan', icon: 'bag' },
  { id: 'hypermart-puri', name: 'Hypermart - Puri Indah Mall', area: 'Jakarta Barat', icon: 'store' },
  { id: 'alfamidi-super', name: 'Alfamidi Super - Kebon Jeruk', area: 'Jakarta Barat', icon: 'shopping-cart' }
];

// Pre-seeded shopping sessions from last month to immediately power F-04 comparator
export const SEED_SESSIONS = [
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

// Initial seed active cart for first launch demonstration
export const SEED_ACTIVE_CART = [
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
    discountString: '50% + 20%', // Demonstrating multi-tier discount F-03
    finalUnitPrice: 15200,
    subtotal: 30400,
    discountSavings: 45600
  }
];

// Quick auto-complete products for student budget grocery
export const QUICK_PRODUCTS = [
  { name: 'Beras 5kg', category: 'Bahan Pokok', unit: 'pack', defaultPrice: 74000 },
  { name: 'Telur 1kg', category: 'Bahan Pokok', unit: 'kg', defaultPrice: 28000 },
  { name: 'Garam 500g', category: 'Bumbu & Dapur', unit: 'pack', defaultPrice: 5000 },
  { name: 'Minyak Goreng Tropical 2L', category: 'Bahan Pokok', unit: 'liter', defaultPrice: 34000 },
  { name: 'Indomie Goreng Special', category: 'Makanan Cepat Saji', unit: 'dus', defaultPrice: 115000 },
  { name: 'Ultra Milk Cokelat 1L', category: 'Minuman', unit: 'pcs', defaultPrice: 19500 },
  { name: 'Fiesta Chicken Nugget 500g', category: 'Makanan Cepat Saji', unit: 'pack', defaultPrice: 45000 },
  { name: 'Minyak Goreng Tropical 2L', category: 'Bahan Pokok', unit: 'liter', defaultPrice: 34000 },
  { name: 'Telur Ayam Negeri 1kg', category: 'Bahan Pokok', unit: 'kg', defaultPrice: 28500 },
  { name: 'Indomie Goreng Special', category: 'Makanan Cepat Saji', unit: 'dus', defaultPrice: 115000 },
  { name: 'Ultra Milk Cokelat 1L', category: 'Minuman', unit: 'pcs', defaultPrice: 19500 },
  { name: 'Fiesta Chicken Nugget 500g', category: 'Makanan Cepat Saji', unit: 'pack', defaultPrice: 45000 },
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

export const StorageService = {
  _syncCallback: null,
  _isApplyingRemote: false,

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
    if (!localStorage.getItem(STORAGE_KEYS.STORES)) {
      localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(DEFAULT_STORES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SESSIONS_HISTORY)) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS_HISTORY, JSON.stringify(SEED_SESSIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USER_BUDGET)) {
      localStorage.setItem(STORAGE_KEYS.USER_BUDGET, '500000'); // Default Rp 500.000
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_CART)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_CART, JSON.stringify(SEED_ACTIVE_CART));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SESSION_META)) {
      // Default to today's date in YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      const defaultMeta = {
        storeName: 'Lotte Mart Grocery - Puri Indah',
        date: today,
        notes: 'Sesi Belanja Bulanan Anak Rantau'
      };
      localStorage.setItem(STORAGE_KEYS.SESSION_META, JSON.stringify(defaultMeta));
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
      localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(stores));
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
    localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(merged));
    return merged;
  },

  getSessionMeta() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION_META);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const today = new Date().toISOString().split('T')[0];
    return {
      storeName: 'Lotte Mart Grocery - Puri Indah',
      date: today,
      notes: 'Sesi Belanja Bulanan Anak Rantau'
    };
  },

  saveSessionMeta(meta) {
    localStorage.setItem(STORAGE_KEYS.SESSION_META, JSON.stringify(meta));
    this.notifyChange('meta', meta);
  },

  getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_CART);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCart(cart) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_CART, JSON.stringify(cart));
    this.notifyChange('cart', cart);
  },

  getBudget() {
    const b = localStorage.getItem(STORAGE_KEYS.USER_BUDGET);
    return b ? parseInt(b, 10) : 500000;
  },

  saveBudget(budget) {
    localStorage.setItem(STORAGE_KEYS.USER_BUDGET, budget.toString());
    this.notifyChange('budget', budget);
  },

  getHistorySessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveHistorySession(session) {
    const history = this.getHistorySessions();
    if (!history.some(h => h.id === session.id)) {
      history.unshift(session); // prepend newest
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS_HISTORY, JSON.stringify(history));
    this.notifyChange('history', session);
    return history;
  },

  mergeRemoteHistory(remoteSessions) {
    if (!Array.isArray(remoteSessions) || remoteSessions.length === 0) return this.getHistorySessions();
    const local = this.getHistorySessions();
    const map = new Map();
    local.forEach(s => map.set(s.id, s));
    remoteSessions.forEach(s => map.set(s.id, s));
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.savedAt || b.date) - new Date(a.savedAt || a.date));
    localStorage.setItem(STORAGE_KEYS.SESSIONS_HISTORY, JSON.stringify(merged));
    return merged;
  },

  /**
   * Price history lookup function for F-04:
   * Finds the most recent recorded price for a given product at a specific store.
   * Matches product name case-insensitively and intelligently.
   */
  findProductHistoricalPrice(storeName, productName) {
    if (!productName || !productName.trim()) return null;
    const cleanQuery = productName.trim().toLowerCase();
    const history = this.getHistorySessions();

    // 1. Look in the requested store first (newest date first)
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
            // Compare against original base price or unit price
            price: matchedItem.finalUnitPrice || matchedItem.originalPrice || 0,
            basePrice: matchedItem.originalPrice || 0,
            matchedProductName: matchedItem.name
          };
        }
      }
    }

    // 2. If not found in current store, check any other store for cross-store comparison!
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
    localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(DEFAULT_STORES));
    localStorage.setItem(STORAGE_KEYS.SESSIONS_HISTORY, JSON.stringify(SEED_SESSIONS));
    localStorage.setItem(STORAGE_KEYS.CURRENT_CART, JSON.stringify(SEED_ACTIVE_CART));
    localStorage.setItem(STORAGE_KEYS.USER_BUDGET, '500000');
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEYS.SESSION_META, JSON.stringify({
      storeName: 'Lotte Mart Grocery - Puri Indah',
      date: today,
      notes: 'Sesi Belanja Bulanan Anak Rantau'
    }));
  }
};
