import { FotoLapangan, UploadFotoPayload } from '@/types/fotoLapangan';

const DB_NAME = 'cpg_foto_lapangan_db';
const DB_VERSION = 1;
const STORE_NAME = 'fotos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada environment ini'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('noTtb', 'noTtb', { unique: false });
        store.createIndex('fpb', 'fpb', { unique: false });
        store.createIndex('noFstb', 'noFstb', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function notifyUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('foto-lapangan-updated'));
  }
}

export async function getAllFotos(): Promise<FotoLapangan[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as FotoLapangan[]) || [];
        // Sort descending by createdAt
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error fetching all photos:', err);
    return [];
  }
}

export async function getFotosByNoTtb(noTtb: string): Promise<FotoLapangan[]> {
  if (!noTtb || !noTtb.trim()) return [];
  const cleanTarget = noTtb.trim().toLowerCase();

  try {
    const all = await getAllFotos();
    return all.filter((item) => {
      const itemTtb = item.noTtb?.trim().toLowerCase() || '';
      return itemTtb === cleanTarget || itemTtb.includes(cleanTarget);
    });
  } catch (err) {
    console.error('Error searching photos by TTB:', err);
    return [];
  }
}

export async function getFotosByFpbOrFstb(
  arg1?: string | { fpb?: string; noFstb?: string },
  arg2?: string
): Promise<FotoLapangan[]> {
  let cleanFpb: string | undefined;
  let cleanFstb: string | undefined;

  if (typeof arg1 === 'object' && arg1 !== null) {
    cleanFpb = arg1.fpb?.trim().toLowerCase();
    cleanFstb = arg1.noFstb?.trim().toLowerCase();
  } else {
    cleanFpb = typeof arg1 === 'string' ? arg1.trim().toLowerCase() : undefined;
    cleanFstb = typeof arg2 === 'string' ? arg2.trim().toLowerCase() : undefined;
  }

  if (!cleanFpb && !cleanFstb) return [];

  try {
    const all = await getAllFotos();
    return all.filter((item) => {
      const matchFpb = cleanFpb && item.fpb?.trim().toLowerCase().includes(cleanFpb);
      const matchFstb = cleanFstb && item.noFstb?.trim().toLowerCase().includes(cleanFstb);
      return Boolean(matchFpb || matchFstb);
    });
  } catch (err) {
    console.error('Error searching photos by FPB/FSTB:', err);
    return [];
  }
}

export async function saveFotoLapangan(payload: UploadFotoPayload): Promise<FotoLapangan> {
  const db = await openDB();
  const now = new Date();
  const id = `foto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const waktu = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const record: FotoLapangan = {
    id,
    noTtb: payload.noTtb.trim(),
    fpb: payload.fpb?.trim() || undefined,
    noPo: payload.noPo?.trim() || undefined,
    noFstb: payload.noFstb?.trim() || undefined,
    itemDescription: payload.itemDescription?.trim() || undefined,
    armada: payload.armada?.trim() || undefined,
    picLapangan: payload.picLapangan?.trim() || 'AGUS',
    tanggal: payload.tanggal || now.toISOString().slice(0, 10),
    waktu,
    dataUrl: payload.dataUrl,
    catatan: payload.catatan?.trim() || undefined,
    fileSizeKb: payload.fileSizeKb,
    fileName: payload.fileName,
    createdAt: now.getTime(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => {
      notifyUpdate();
      resolve(record);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFotoLapangan(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyUpdate();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mengompresi file foto sebelum disimpan ke Base64 IndexedDB
 * agar ukuran efisien (kisaran 200KB - 500KB) dan performa UI tetap lancar.
 */
export function compressImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<{ dataUrl: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl, sizeKb });
      };
      img.onerror = () => reject(new Error('Gagal membaca gambar'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Mengosongkan seluruh foto lapangan di IndexedDB
 */
export async function clearAllFotos(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => {
        notifyUpdate();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error clearing fotos DB:', err);
  }
}

