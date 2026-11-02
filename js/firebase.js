/**
 * Firebase & Cloud Firestore Service - Smart Grocery & Budget Safety Tracker
 * Architecture: Multi-Device Realtime Sync (HP <-> PC) via onSnapshot() with LocalStorage Fallback
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyBDhKXMPlkcw1nS7DZSAnaxc3iiUVexKBQ",
  authDomain: "smartgrocery-app-5b904.firebaseapp.com",
  projectId: "smartgrocery-app-5b904",
  storageBucket: "smartgrocery-app-5b904.firebasestorage.app",
  messagingSenderId: "179703303578",
  appId: "1:179703303578:web:c879e21cde5e894b327e23"
};

// Initialize Firebase App & Firestore instance
export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// Enable Firestore Local Cache Persistence for robust offline support
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.info('Firestore offline persistence: Multiple tabs open, active in leader tab.');
    } else if (err.code === 'unimplemented') {
      console.info('Firestore offline persistence: Browser does not support IndexedDB.');
    }
  });
} catch (e) {
  console.warn('Firestore offline persistence init warning:', e);
}

// Device & Client Identification (HP vs PC)
export function getDeviceId() {
  let id = localStorage.getItem('smart_grocery_device_id');
  if (!id) {
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const prefix = isMobile ? 'HP' : 'PC';
    id = `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('smart_grocery_device_id', id);
  }
  return id;
}

export function getDeviceType() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'HP' : 'PC';
}

/**
 * 1. REALTIME LISTENER for Active Trolley Session (trolley_sessions/active_cart)
 * Using onSnapshot() so any changes from HP (supermarket) stream immediately to PC (home).
 */
export function subscribeToActiveTrolley(onUpdateCallback, onStatusCallback) {
  const trolleyDocRef = doc(db, "trolley_sessions", "active_cart");
  const myDeviceId = getDeviceId();

  return onSnapshot(trolleyDocRef, { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = snapshot.metadata.fromCache;
    const hasPendingWrites = snapshot.metadata.hasPendingWrites;

    if (onStatusCallback) {
      onStatusCallback({
        online: !fromCache,
        hasPendingWrites,
        status: fromCache ? 'cache' : 'connected'
      });
    }

    if (snapshot.exists()) {
      const data = snapshot.data();
      onUpdateCallback(data, {
        fromCache,
        hasPendingWrites,
        isFromMe: data.lastDeviceId === myDeviceId
      });
    } else {
      // Document does not exist yet on Firestore
      onUpdateCallback(null, { notFound: true, fromCache, hasPendingWrites });
    }
  }, (error) => {
    console.error("Firestore onSnapshot active_cart error:", error);
    if (onStatusCallback) {
      onStatusCallback({
        online: false,
        status: 'error',
        error: error.message
      });
    }
  });
}

/**
 * Sync active trolley session to Cloud Firestore.
 * Debounced slightly to prevent network flood on rapid typing or clicks.
 */
let syncDebounceTimer = null;

export function syncActiveTrolleyToCloud(payload, immediate = false) {
  return new Promise((resolve) => {
    const executeSync = async () => {
      try {
        const trolleyDocRef = doc(db, "trolley_sessions", "active_cart");
        const cleanPayload = {
          storeLocation: payload.storeLocation || 'Lotte Mart Grocery - Puri Indah',
          shoppingDate: payload.shoppingDate || new Date().toISOString().split('T')[0],
          walletLimit: Number(payload.walletLimit) || 500000,
          items: Array.isArray(payload.items) ? payload.items : [],
          totalSpent: Number(payload.totalSpent) || 0,
          totalSaved: Number(payload.totalSaved) || 0,
          totalItemsCount: Number(payload.totalItemsCount) || 0,
          notes: payload.notes || '',
          updatedAt: serverTimestamp(),
          lastDeviceId: getDeviceId(),
          lastDeviceType: getDeviceType()
        };

        await setDoc(trolleyDocRef, cleanPayload, { merge: true });
        resolve(true);
      } catch (err) {
        console.warn("syncActiveTrolleyToCloud warning:", err);
        resolve(false);
      }
    };

    if (immediate) {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      executeSync();
    } else {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(executeSync, 200);
    }
  });
}

/**
 * 2. REALTIME LISTENER for Shopping History Sessions (history_sessions collection)
 */
export function subscribeToHistorySessions(onUpdateCallback) {
  const historyColRef = collection(db, "history_sessions");
  return onSnapshot(historyColRef, (snapshot) => {
    const sessions = [];
    snapshot.forEach(docSnap => {
      sessions.push({ ...docSnap.data(), id: docSnap.id });
    });
    // Sort newest date first
    sessions.sort((a, b) => new Date(b.savedAt || b.date) - new Date(a.savedAt || a.date));
    onUpdateCallback(sessions);
  }, (err) => {
    console.warn("History onSnapshot warning:", err);
  });
}

/**
 * Save finalized session to Cloud Firestore
 */
export async function saveHistorySessionToCloud(session) {
  try {
    const sessionId = session.id || ('session-' + Date.now());
    const docRef = doc(db, "history_sessions", sessionId);
    await setDoc(docRef, {
      ...session,
      savedAt: session.savedAt || new Date().toISOString(),
      lastDeviceId: getDeviceId(),
      lastDeviceType: getDeviceType()
    });
    return true;
  } catch (err) {
    console.warn("saveHistorySessionToCloud warning:", err);
    return false;
  }
}

/**
 * 3. REALTIME LISTENER for Supermarket Stores Metadata (app_metadata/stores)
 */
export function subscribeToStores(onUpdateCallback) {
  const storesDocRef = doc(db, "app_metadata", "stores");
  return onSnapshot(storesDocRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (Array.isArray(data.stores) && data.stores.length > 0) {
        onUpdateCallback(data.stores);
      }
    }
  }, (err) => {
    console.warn("Stores onSnapshot warning:", err);
  });
}

export async function syncStoresToCloud(stores) {
  try {
    const storesDocRef = doc(db, "app_metadata", "stores");
    await setDoc(storesDocRef, {
      stores,
      updatedAt: serverTimestamp(),
      lastDeviceId: getDeviceId()
    }, { merge: true });
  } catch (err) {
    console.warn("syncStoresToCloud warning:", err);
  }
}

