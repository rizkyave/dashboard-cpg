import { SisaLayananItem, SisaLayananSummary } from '@/types/sisaLayanan';

const DB_NAME = 'cpg_dashboard_data_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak tersedia di browser ini'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`IndexedDB get error (${key}):`, e);
    return null;
  }
}

async function idbSet<T>(key: string, val: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error(`IndexedDB set error (${key}):`, e);
  }
}

export async function saveStoredSisaLayanan(
  items: SisaLayananItem[],
  summary?: SisaLayananSummary | null
): Promise<void> {
  await idbSet('sisa_layanan_data', items);
  if (summary) {
    await idbSet('sisa_layanan_summary', summary);
  }
}

export async function loadStoredSisaLayanan(): Promise<{
  items: SisaLayananItem[];
  summary: SisaLayananSummary | null;
} | null> {
  const items = await idbGet<SisaLayananItem[]>('sisa_layanan_data');
  const summary = await idbGet<SisaLayananSummary>('sisa_layanan_summary');

  if (items && Array.isArray(items) && items.length > 0) {
    return { items, summary: summary || null };
  }
  return null;
}

export async function clearStoredSisaLayanan(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('sisa_layanan_data');
    store.delete('sisa_layanan_summary');
  } catch (e) {
    console.warn('Gagal menghapus cache Sisa Layanan di IndexedDB:', e);
  }
}

