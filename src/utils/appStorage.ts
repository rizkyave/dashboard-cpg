import { ProcurementItem, ArmadaItem, InventoryItem, InventorySummary, PdfItemsCache, KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';
import { WorkOrderItem, WorkOrderSummary } from '@/types/workOrder';

const DB_NAME = 'cpg_dashboard_data_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak tersedia'));
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

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`IndexedDB delete error (${key}):`, e);
  }
}

/**
 * Simpan dataset Procurement ke IndexedDB (kapasitas besar, mendukung puluhan ribu record)
 */
export async function saveStoredProcurement(items: ProcurementItem[]): Promise<void> {
  await idbSet('procurement_data', items);
  // Hapus key lama di localStorage agar tidak memicu QuotaExceededError (limit 5MB)
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('CPG_SAVED_PROCUREMENT_DATA');
    } catch {}
  }
}

/**
 * Muat dataset Procurement: prioritas IndexedDB, fallback migrasi dari localStorage jika ada data lama
 */
export async function loadStoredProcurement(): Promise<ProcurementItem[] | null> {
  const idbData = await idbGet<ProcurementItem[]>('procurement_data');
  if (idbData && Array.isArray(idbData) && idbData.length > 0) {
    return idbData;
  }

  // Cek migrasi dari localStorage lama
  if (typeof window !== 'undefined') {
    try {
      const legacy = localStorage.getItem('CPG_SAVED_PROCUREMENT_DATA');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrasikan ke IndexedDB dan bersihkan localStorage
          await idbSet('procurement_data', parsed);
          localStorage.removeItem('CPG_SAVED_PROCUREMENT_DATA');
          return parsed;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Simpan dataset Armada ke IndexedDB
 */
export async function saveStoredArmada(items: ArmadaItem[]): Promise<void> {
  await idbSet('armada_data', items);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('CPG_SAVED_ARMADA_DATA');
    } catch {}
  }
}

/**
 * Muat dataset Armada
 */
export async function loadStoredArmada(): Promise<ArmadaItem[] | null> {
  const idbData = await idbGet<ArmadaItem[]>('armada_data');
  if (idbData && Array.isArray(idbData) && idbData.length > 0) {
    return idbData;
  }

  if (typeof window !== 'undefined') {
    try {
      const legacy = localStorage.getItem('CPG_SAVED_ARMADA_DATA');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await idbSet('armada_data', parsed);
          localStorage.removeItem('CPG_SAVED_ARMADA_DATA');
          return parsed;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Simpan dataset Inventory Stok ke IndexedDB
 */
export async function saveStoredInventory(
  items: InventoryItem[],
  summary?: InventorySummary | null
): Promise<void> {
  await idbSet('inventory_items', items);
  if (summary) {
    await idbSet('inventory_summary', summary);
  } else {
    await idbDelete('inventory_summary');
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('CPG_SAVED_INVENTORY_ITEMS');
      localStorage.removeItem('CPG_SAVED_INVENTORY_SUMMARY');
    } catch {}
  }
}

/**
 * Muat dataset Inventory Stok
 */
export async function loadStoredInventory(): Promise<{
  items: InventoryItem[];
  summary: InventorySummary | null;
} | null> {
  const items = await idbGet<InventoryItem[]>('inventory_items');
  const summary = await idbGet<InventorySummary>('inventory_summary');

  if (items && Array.isArray(items) && items.length > 0) {
    return { items, summary: summary || null };
  }

  if (typeof window !== 'undefined') {
    try {
      const legacyItems = localStorage.getItem('CPG_SAVED_INVENTORY_ITEMS');
      if (legacyItems) {
        const parsed = JSON.parse(legacyItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let parsedSummary: InventorySummary | null = null;
          const legacySummary = localStorage.getItem('CPG_SAVED_INVENTORY_SUMMARY');
          if (legacySummary) {
            try {
              parsedSummary = JSON.parse(legacySummary);
            } catch {}
          }
          await idbSet('inventory_items', parsed);
          if (parsedSummary) await idbSet('inventory_summary', parsedSummary);
          localStorage.removeItem('CPG_SAVED_INVENTORY_ITEMS');
          localStorage.removeItem('CPG_SAVED_INVENTORY_SUMMARY');
          return { items: parsed, summary: parsedSummary };
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Simpan cache nama barang dari PDF (untuk Advanced Search)
 * Key IndexedDB: 'pdf_items_cache'
 */
export async function savePdfItemsCache(cache: PdfItemsCache): Promise<void> {
  await idbSet('pdf_items_cache', cache);
}

/**
 * Muat cache nama barang PDF
 */
export async function loadPdfItemsCache(): Promise<PdfItemsCache | null> {
  const data = await idbGet<PdfItemsCache>('pdf_items_cache');
  return data && typeof data === 'object' ? data : null;
}

/**
 * Update cache untuk satu FPB tertentu
 */
export async function updatePdfItemsCacheForFpb(
  fpb: string,
  itemNames: string[]
): Promise<void> {
  const existing = await loadPdfItemsCache();
  const updated = { ...(existing || {}), [fpb]: itemNames };
  await savePdfItemsCache(updated);
}

/**
 * Simpan dataset Posisi Kapal (Daily Report FMS) ke IndexedDB
 */
export async function saveStoredKapalPosisi(
  items: KapalPosisiItem[],
  summary?: KapalPosisiSummary | null
): Promise<void> {
  await idbSet('kapal_posisi_items', items);
  if (summary) {
    await idbSet('kapal_posisi_summary', summary);
  }
}

/**
 * Muat dataset Posisi Kapal dari IndexedDB
 */
export async function loadStoredKapalPosisi(): Promise<{
  items: KapalPosisiItem[];
  summary: KapalPosisiSummary | null;
} | null> {
  const items = await idbGet<KapalPosisiItem[]>('kapal_posisi_items');
  const summary = await idbGet<KapalPosisiSummary>('kapal_posisi_summary');

  if (items && Array.isArray(items) && items.length > 0) {
    return { items, summary: summary || null };
  }

  return null;
}

/**
 * Simpan dataset Work Order (Form Responses 1 Google Sheets) ke IndexedDB
 */
export async function saveStoredWorkOrder(
  items: WorkOrderItem[],
  summary?: WorkOrderSummary | null
): Promise<void> {
  await idbSet('work_order_items', items);
  if (summary) {
    await idbSet('work_order_summary', summary);
  }
}

/**
 * Muat dataset Work Order dari IndexedDB
 */
export async function loadStoredWorkOrder(): Promise<{
  items: WorkOrderItem[];
  summary: WorkOrderSummary | null;
} | null> {
  const items = await idbGet<WorkOrderItem[]>('work_order_items');
  const summary = await idbGet<WorkOrderSummary>('work_order_summary');

  if (items && Array.isArray(items) && items.length > 0) {
    return { items, summary: summary || null };
  }

  return null;
}

/**
 * Hapus data dari storage berdasarkan scope
 */
export async function clearStoredData(scope: 'all' | 'procurement' | 'inventory'): Promise<void> {
  if (scope === 'all' || scope === 'procurement') {
    await idbDelete('procurement_data');
    await idbDelete('armada_data');
    await idbDelete('pdf_items_cache');
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('CPG_SAVED_PROCUREMENT_DATA');
        localStorage.removeItem('CPG_SAVED_ARMADA_DATA');
      } catch {}
    }
  }

  if (scope === 'all' || scope === 'inventory') {
    await idbDelete('inventory_items');
    await idbDelete('inventory_summary');
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('CPG_SAVED_INVENTORY_ITEMS');
        localStorage.removeItem('CPG_SAVED_INVENTORY_SUMMARY');
      } catch {}
    }
  }
}
