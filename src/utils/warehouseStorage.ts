import {
  WarehouseStockItem,
  WarehouseMutation,
  WarehouseSummary,
} from '@/types/warehouseStock';
import {
  INITIAL_WAREHOUSE_ITEMS,
  INITIAL_WAREHOUSE_MUTATIONS,
  calculateWarehouseSummary,
} from '@/data/initialWarehouseData';

const LOCAL_STORAGE_ITEMS_KEY = 'CPG_WAREHOUSE_STOCK_ITEMS';
const LOCAL_STORAGE_MUTATIONS_KEY = 'CPG_WAREHOUSE_STOCK_MUTATIONS';

export function saveLocalWarehouseData(
  items: WarehouseStockItem[],
  mutations: WarehouseMutation[]
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(items));
    localStorage.setItem(LOCAL_STORAGE_MUTATIONS_KEY, JSON.stringify(mutations));
  } catch (e) {
    console.warn('Gagal menyimpan stok gudang ke localStorage:', e);
  }
}

export function loadLocalWarehouseData(): {
  items: WarehouseStockItem[];
  mutations: WarehouseMutation[];
  summary: WarehouseSummary;
} {
  if (typeof window === 'undefined') {
    return {
      items: INITIAL_WAREHOUSE_ITEMS,
      mutations: INITIAL_WAREHOUSE_MUTATIONS,
      summary: calculateWarehouseSummary(INITIAL_WAREHOUSE_ITEMS, INITIAL_WAREHOUSE_MUTATIONS),
    };
  }

  try {
    const rawItems = localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY);
    const rawMut = localStorage.getItem(LOCAL_STORAGE_MUTATIONS_KEY);

    if (rawItems && rawMut) {
      const items: WarehouseStockItem[] = JSON.parse(rawItems);
      const mutations: WarehouseMutation[] = JSON.parse(rawMut);
      if (Array.isArray(items) && Array.isArray(mutations)) {
        return {
          items,
          mutations,
          summary: calculateWarehouseSummary(items, mutations),
        };
      }
    }
  } catch (e) {
    console.warn('Gagal membaca stok gudang dari localStorage, fallback ke awal:', e);
  }

  return {
    items: INITIAL_WAREHOUSE_ITEMS,
    mutations: INITIAL_WAREHOUSE_MUTATIONS,
    summary: calculateWarehouseSummary(INITIAL_WAREHOUSE_ITEMS, INITIAL_WAREHOUSE_MUTATIONS),
  };
}

export function clearLocalWarehouseData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_ITEMS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_MUTATIONS_KEY);
  } catch (e) {
    console.warn('Gagal menghapus stok gudang dari localStorage:', e);
  }
}

