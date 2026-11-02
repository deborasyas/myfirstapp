/**
 * Cart & Calculation Engine - Smart Grocery & Budget Safety Tracker
 * Implements F-01, F-02, F-03 (Multi-tier discount), and F-04 (Price comparison)
 */

import { StorageService } from './storage.js';

export const CurrencyUtils = {
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

/**
 * F-03: Multi-tier discount calculator
 * Accurately parses and computes multi-level compounding discounts:
 * Examples:
 * - "25%" -> 25% single discount
 * - "50% + 20%" or "50+20" -> 50% followed by 20% on the remainder
 * - "30% + 10%" -> 30% then 10%
 * - "Rp 10.000" or direct numeric nominal discount
 */
export function calculateMultiTierDiscount(originalPrice, discountInput) {
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

/**
 * F-04: Realtime Store History Price Comparison
 * Returns comparison object with visual badge type:
 * - 'UP': Price increased (+Rp X, +Y%) -> Red arrow UP (↑)
 * - 'DOWN': Price decreased / promo (-Rp X, -Y%) -> Green arrow DOWN (↓)
 * - 'EQUAL': Price identical -> Equal sign (=)
 * - 'NEW': No prior record found for this store
 */
export function compareWithStoreHistory(storeName, productName, currentPrice) {
  if (!productName || !currentPrice) {
    return { status: 'NONE' };
  }

  const numPrice = Number(currentPrice);
  const hist = StorageService.findProductHistoricalPrice(storeName, productName);

  if (!hist || !hist.found) {
    return {
      status: 'NEW',
      symbol: '✨',
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
  const formattedDate = hist.date ? new Date(hist.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'riwayat lalu';

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

export class CartManager {
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
    // Recalculate price comparisons for all items under the new store
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

  /**
   * F-01 & F-02: Add item to cart with automatic quantity and discount calculation
   */
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

    // Attach F-04 comparison
    item.comparison = compareWithStoreHistory(this.getStoreName(), item.name, item.originalPrice);

    this.items.unshift(item);
    StorageService.saveCart(this.items);
    return item;
  }

  /**
   * F-02: Immediate Qty update (instant multiplication of subtotal)
   */
  updateQty(itemId, newQty) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return null;

    const q = Math.max(1, parseInt(newQty, 10) || 1);
    item.qty = q;
    // F-02 automatic multiplication
    item.subtotal = item.finalUnitPrice * q;
    const discountPerUnit = item.originalPrice - item.finalUnitPrice;
    item.discountSavings = discountPerUnit * q;

    StorageService.saveCart(this.items);
    return item;
  }

  incrementQty(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      return this.updateQty(itemId, item.qty + 1);
    }
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
