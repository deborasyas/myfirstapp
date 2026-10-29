/**
 * Budget Safety Cap Engine - Smart Grocery & Budget Safety Tracker
 * Implements F-05 (Pengendali Anggaran, Visual Warning States, Smart Cut Advisor)
 */

import { StorageService } from './storage.js';
import { CurrencyUtils } from './cart.js';

export const BudgetService = {
  getBudgetLimit() {
    return StorageService.getBudget();
  },

  setBudgetLimit(newLimit) {
    const val = Math.max(10000, parseInt(newLimit, 10) || 500000);
    StorageService.saveBudget(val);
    return val;
  },

  /**
   * Evaluates the current budget status against cart total.
   * Status Levels:
   * 1. 'SAFE': spent < 90% (Green)
   * 2. 'WARNING': spent >= 90% and <= 100% (Yellow / Amber)
   * 3. 'OVER_BUDGET': spent > 100% (Red Alert Banner)
   */
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

  /**
   * Smart Cut Advisor (Rekomendasi Pangkas Belanja)
   * Automatically analyzes cart items when over-budget and suggests
   * high-impact cuts (e.g. snack, excess drinks, or single item that solves the overage).
   */
  getCutRecommendations(cartItems, totalSpent, budgetLimit = null) {
    const limit = budgetLimit || this.getBudgetLimit();
    if (totalSpent <= limit || !cartItems || cartItems.length === 0) {
      return [];
    }

    const overAmount = totalSpent - limit;
    const recommendations = [];

    // Priority 1: Check for discretionary categories (Camilan, Snack, Minuman Manis)
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

    // Priority 2: Check items with Qty > 1 where reducing qty solves or heavily helps
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

    // Priority 3: The single item whose subtotal is closest to overAmount
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

    return recommendations.slice(0, 3); // Top 3 smartest recommendations
  },

  /**
   * Calculate spending breakdown by category for analytics
   */
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
