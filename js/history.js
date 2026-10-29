/**
 * History & Multi-Store Database Engine - Smart Grocery & Budget Safety Tracker
 * Implements F-06: Riwayat Sesi Belanja, Database Multi-Toko, Cross-Store Price Analysis
 */

import { StorageService } from './storage.js';
import { CurrencyUtils } from './cart.js';

export const HistoryService = {
  getSessions() {
    return StorageService.getHistorySessions();
  },

  getSessionById(sessionId) {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === sessionId) || null;
  },

  /**
   * Finalize and archive current cart into permanent session history (F-06)
   */
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

    // Also register store if new
    StorageService.addStore(newSession.storeName);

    return newSession;
  },

  /**
   * Cross-Store Price Intelligence for Students (Anak Rantau):
   * Searches historical records across all stores to see who sells this item cheapest!
   */
  searchCrossStorePrices(query) {
    if (!query || !query.trim()) return [];
    const clean = query.trim().toLowerCase();
    const sessions = this.getSessions();

    const productMap = {}; // key: storeName + productName

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
    // Sort from cheapest to most expensive
    results.sort((a, b) => a.price - b.price);
    return results;
  },

  /**
   * Filter sessions by store name
   */
  getSessionsByStore(storeName) {
    const sessions = this.getSessions();
    if (!storeName || storeName === 'ALL') return sessions;
    return sessions.filter(s => s.storeName.toLowerCase() === storeName.toLowerCase());
  },

  /**
   * Delete a past session
   */
  deleteSession(sessionId) {
    let sessions = this.getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem('smart_grocery_history_v1', JSON.stringify(sessions));
    return sessions;
  },

  /**
   * Export all data as JSON
   */
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
  },

  /**
   * Import data from JSON
   */
  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.stores) localStorage.setItem('smart_grocery_stores_v1', JSON.stringify(parsed.stores));
      if (parsed.sessions) localStorage.setItem('smart_grocery_history_v1', JSON.stringify(parsed.sessions));
      if (parsed.budget) localStorage.setItem('smart_grocery_budget_v1', parsed.budget.toString());
      if (parsed.cart) localStorage.setItem('smart_grocery_cart_v1', JSON.stringify(parsed.cart));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
};
