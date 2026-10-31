import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { StockTaliItem, StockTaliWebhookConfig } from '@/types/stockTali';
import {
  STOCK_TALI_SHEET_URL,
  STOCK_TALI_CSV_EXPORT_URL,
  parseCsvRows,
  computeSummary,
} from '@/utils/stockTaliParser';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOCAL_DATA_PATH = path.join(process.cwd(), 'src', 'data', 'stock-tali-data.json');
const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'src', 'data', 'stock-tali-webhook-config.json');
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'google-apps-script-stock-tali.js');
const R2_DATA_KEY = 'dashboard-metadata/stock-tali-data.json';
const R2_WEBHOOK_KEY = 'dashboard-metadata/stock-tali-webhook-config.json';

// 1. Baca Konfigurasi Webhook dari env, R2, atau file lokal
async function getWebhookConfig(): Promise<string> {
  if (process.env.STOCK_TALI_WEBHOOK_URL) {
    return process.env.STOCK_TALI_WEBHOOK_URL.trim();
  }

  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_WEBHOOK_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed: StockTaliWebhookConfig = JSON.parse(text);
        if (parsed.webhookUrl) return parsed.webhookUrl.trim();
      }
    } catch {}
  }

  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const text = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      const parsed: StockTaliWebhookConfig = JSON.parse(text);
      if (parsed.webhookUrl) return parsed.webhookUrl.trim();
    } catch {}
  }

  return '';
}

// 2. Simpan Konfigurasi Webhook ke lokal dan R2
async function saveWebhookConfig(webhookUrl: string): Promise<boolean> {
  const config: StockTaliWebhookConfig = {
    webhookUrl: webhookUrl.trim(),
    updatedAt: new Date().toISOString(),
  };

  let savedLocal = false;
  try {
    const dir = path.dirname(LOCAL_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    savedLocal = true;
  } catch (err) {
    console.warn('Gagal menyimpan webhook config stock tali ke lokal:', err);
  }

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_WEBHOOK_KEY,
        body: Buffer.from(JSON.stringify(config, null, 2), 'utf8'),
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      console.warn('Gagal menyimpan webhook config stock tali ke R2:', err);
    }
  }

  return savedLocal;
}

// 3. Baca Items Stock Tali dari lokal atau R2
async function getStoredStockTali(): Promise<StockTaliItem[]> {
  // Cek R2
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_DATA_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
          return parsed.items;
        }
      }
    } catch {}
  }

  // Cek file lokal
  if (fs.existsSync(LOCAL_DATA_PATH)) {
    try {
      const text = fs.readFileSync(LOCAL_DATA_PATH, 'utf8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.items)) {
        return parsed.items;
      }
    } catch {}
  }

  return [];
}

// 4. Simpan Items Stock Tali ke lokal dan R2
async function saveStoredStockTali(items: StockTaliItem[], updatedAt?: string): Promise<boolean> {
  const dateStr = updatedAt || new Date().toISOString();
  const payload = {
    updatedAt: dateStr,
    sourceUrl: STOCK_TALI_SHEET_URL,
    total: items.length,
    items,
  };

  let savedLocal = false;
  try {
    const dir = path.dirname(LOCAL_DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(payload, null, 2), 'utf8');
    savedLocal = true;
  } catch (err) {
    console.warn('Gagal menyimpan stock-tali-data.json lokal:', err);
  }

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_DATA_KEY,
        body: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      console.warn('Gagal menyimpan stock tali ke R2:', err);
    }
  }

  return savedLocal;
}

// 5. Teruskan request ke Google Apps Script Webhook
async function forwardToGoogleAppsScript(webhookUrl: string, payload: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25 detik timeout

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch {
      let errorMsg = 'Google Apps Script tidak mengembalikan format JSON yang valid.';
      if (text.includes('Halaman Tidak Ditemukan') || text.includes('tidak dapat membuka file')) {
        errorMsg = 'URL Webhook tidak ditemukan di Google (Halaman Tidak Ditemukan). Pastikan skrip sudah dideploy sebagai Aplikasi Web dan URL berakhiran /exec.';
      } else if (text.includes('accounts.google.com') || text.includes('signin') || text.includes('IdentifierInput')) {
        errorMsg = 'Akses ditolak oleh Google: Memerlukan login. Pastikan setelan "Siapa yang memiliki akses" (Who has access) pada Web App disetel ke "Siapa saja" (Anyone).';
      }
      return {
        success: false,
        message: errorMsg,
        rawSnippet: text.slice(0, 250),
      };
    }
  } catch (err: any) {
    clearTimeout(timeout);
    return {
      success: false,
      message: err.name === 'AbortError' ? 'Koneksi ke Google Sheets timeout (25 detik).' : err.message,
    };
  }
}

// GET: Ambil data mutasi stock tali dari file lokal atau Google Sheets, atau script
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const getScript = searchParams.get('script') === 'true';
    const forceFresh = searchParams.get('fresh') === 'true';

    // Permintaan skrip Google Apps Script untuk kemudahan salin di UI
    if (getScript) {
      if (fs.existsSync(SCRIPT_PATH)) {
        const scriptCode = fs.readFileSync(SCRIPT_PATH, 'utf8');
        return NextResponse.json({ success: true, script: scriptCode });
      }
      return NextResponse.json(
        { success: false, message: 'Skrip webhook stock tali tidak ditemukan di server.' },
        { status: 404 }
      );
    }

    const webhookUrl = await getWebhookConfig();
    const storedItems = await getStoredStockTali();

    if (!forceFresh && storedItems.length > 0) {
      const summary = computeSummary(storedItems);
      return NextResponse.json({
        success: true,
        updatedAt: new Date().toISOString(),
        sourceUrl: STOCK_TALI_SHEET_URL,
        total: storedItems.length,
        items: storedItems,
        summary,
        webhookUrl: webhookUrl || '',
        isWebhookConfigured: !!webhookUrl,
      });
    }

    // Fetch fresh from Google Sheets CSV
    const res = await fetch(STOCK_TALI_CSV_EXPORT_URL, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (!res.ok) {
      // Fallback ke stored jika ada
      if (storedItems.length > 0) {
        const summary = computeSummary(storedItems);
        return NextResponse.json({
          success: true,
          updatedAt: new Date().toISOString(),
          sourceUrl: STOCK_TALI_SHEET_URL,
          total: storedItems.length,
          items: storedItems,
          summary,
          webhookUrl: webhookUrl || '',
          isWebhookConfigured: !!webhookUrl,
          warning: `Google Sheets CSV mengembalikan status ${res.status}, menampilkan cache lokal.`,
        });
      }
      return NextResponse.json(
        { success: false, message: `Gagal mengunduh CSV Google Sheets: HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const csvText = await res.text();

    // Lindungi dari respon HTML jika Google Sheets mengalihkan ke login
    if (csvText.includes('<!DOCTYPE') || csvText.includes('<html') || csvText.includes('accounts.google.com')) {
      if (storedItems.length > 0) {
        const summary = computeSummary(storedItems);
        return NextResponse.json({
          success: true,
          updatedAt: new Date().toISOString(),
          sourceUrl: STOCK_TALI_SHEET_URL,
          total: storedItems.length,
          items: storedItems,
          summary,
          webhookUrl: webhookUrl || '',
          isWebhookConfigured: !!webhookUrl,
          warning: 'Google Sheets mengalihkan ke login Google, menampilkan data mutasi tersimpan.',
        });
      }
      return NextResponse.json(
        {
          success: false,
          message: 'Google Sheets mengembalikan halaman login HTML. Pastikan setelan akses spreadsheet adalah "Siapa saja yang memiliki tautan dapat melihat".',
        },
        { status: 403 }
      );
    }

    const items = parseCsvRows(csvText);
    const summary = computeSummary(items);
    const updatedAt = new Date().toISOString();

    await saveStoredStockTali(items, updatedAt);

    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${items.length} data mutasi stock tali.`,
      updatedAt,
      sourceUrl: STOCK_TALI_SHEET_URL,
      total: items.length,
      items,
      summary,
      webhookUrl: webhookUrl || '',
      isWebhookConfigured: !!webhookUrl,
    });
  } catch (err: any) {
    console.error('Error in GET /api/sync-stock-tali:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: create_row, update_row, save_webhook_url, test_webhook, atau sync_csv
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || (body.url ? 'sync_csv' : 'create_row');

    // ========================================================
    // 1. Aksi: Simpan Webhook URL
    // ========================================================
    if (action === 'save_webhook_url') {
      const url = String(body.webhookUrl || '').trim();
      await saveWebhookConfig(url);
      return NextResponse.json({
        success: true,
        message: url
          ? 'Webhook Google Apps Script untuk Mutasi Stock Tali berhasil disimpan!'
          : 'Webhook URL dihapus.',
        webhookUrl: url,
      });
    }

    // ========================================================
    // 2. Aksi: Test Webhook Google Apps Script
    // ========================================================
    if (action === 'test_webhook') {
      const testUrl = (body.webhookUrl || (await getWebhookConfig())).trim();
      if (!testUrl) {
        return NextResponse.json({
          success: false,
          message: 'URL Webhook Google Apps Script belum diisi.',
        });
      }

      try {
        const testRes = await fetch(testUrl, {
          method: 'GET',
          redirect: 'follow',
        });
        const text = await testRes.text();
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          let errorMsg = 'Webhook merespons HTML, bukan format JSON.';
          if (text.includes('Halaman Tidak Ditemukan') || text.includes('tidak dapat membuka file')) {
            errorMsg =
              'URL Webhook tidak ditemukan di server Google (Halaman Tidak Ditemukan). Pastikan Anda telah membuat "Penerapan Baru (New Deployment)" jenis "Aplikasi Web" dan menyalin URL berakhiran /exec.';
          } else if (
            text.includes('accounts.google.com') ||
            text.includes('signin') ||
            text.includes('IdentifierInput')
          ) {
            errorMsg =
              'Akses Ditolak: Google mengalihkan ke halaman login akun. Pada setelan Deploy Apps Script, Anda WAJIB memilih "Siapa yang memiliki akses" (Who has access): "Siapa saja" (Anyone).';
          }
          return NextResponse.json({
            success: false,
            message: errorMsg,
          });
        }

        if (json && (json.status === 'active' || json.success === true)) {
          const detailSpreadsheet = json.spreadsheetName
            ? `ke "${json.spreadsheetName}" (${json.sheetName || 'GID 2021352613'}, ${json.totalRows || 0} baris)`
            : '';
          return NextResponse.json({
            success: true,
            message: `✓ Webhook Google Sheets AKTIF dan TERHUBUNG ${detailSpreadsheet}!`,
            details: json,
          });
        }

        return NextResponse.json({
          success: false,
          message: json?.message || 'Webhook Google Sheets mengembalikan status tidak aktif.',
          details: json,
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          message: `Gagal terhubung ke Webhook: ${err.message}`,
        });
      }
    }

    // ========================================================
    // 3. Aksi: Tarik CSV langsung dari Google Sheets (Manual Sync)
    // ========================================================
    if (action === 'sync_csv') {
      let targetUrl = STOCK_TALI_CSV_EXPORT_URL;
      if (body?.url) {
        const trimmed = body.url.trim();
        const gidMatch = trimmed.match(/gid=([0-9]+)/);
        const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (idMatch && idMatch[1]) {
          const gid = gidMatch && gidMatch[1] ? gidMatch[1] : '2021352613';
          targetUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
        }
      }

      const res = await fetch(targetUrl, {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, message: `Gagal menghubungi Google Sheets: HTTP ${res.status}` },
          { status: 502 }
        );
      }

      const csvText = await res.text();

      // Lindungi dari respon HTML jika Google Sheets mengalihkan ke login
      if (csvText.includes('<!DOCTYPE') || csvText.includes('<html') || csvText.includes('accounts.google.com')) {
        const stored = await getStoredStockTali();
        if (stored.length > 0) {
          const summary = computeSummary(stored);
          return NextResponse.json({
            success: true,
            message: 'Google Sheets mengalihkan ke halaman login, menampilkan data mutasi tersimpan.',
            updatedAt: new Date().toISOString(),
            sourceUrl: STOCK_TALI_SHEET_URL,
            total: stored.length,
            items: stored,
            summary,
          });
        }
        return NextResponse.json(
          {
            success: false,
            message: 'Google Sheets mengembalikan halaman login HTML. Pastikan setelan akses spreadsheet adalah "Siapa saja yang memiliki tautan dapat melihat".',
          },
          { status: 403 }
        );
      }

      const items = parseCsvRows(csvText);
      const summary = computeSummary(items);
      const updatedAt = new Date().toISOString();

      await saveStoredStockTali(items, updatedAt);

      return NextResponse.json({
        success: true,
        message: `Berhasil menyinkronkan ${items.length} berkas mutasi stock tali dari Google Sheets!`,
        updatedAt,
        sourceUrl: STOCK_TALI_SHEET_URL,
        total: items.length,
        items,
        summary,
      });
    }

    // ========================================================
    // 4. Aksi: Tambah Baris Baru (create_row) atau Update (update_row)
    // ========================================================
    if (action === 'create_row' || action === 'update_row') {
      const itemData: Partial<StockTaliItem> = body.data || body.item;

      if (!itemData) {
        return NextResponse.json(
          { success: false, message: 'Data mutasi tidak boleh kosong.' },
          { status: 400 }
        );
      }

      const deptArmada = String(itemData.deptArmada || '').trim();
      const pt = String(itemData.pt || '').trim().toUpperCase();

      if (!deptArmada && !itemData.ttb && !itemData.noFpb) {
        return NextResponse.json(
          { success: false, message: 'Harus mengisi Armada/Dept atau Nomor TTB/FPB.' },
          { status: 400 }
        );
      }

      let storedItems = await getStoredStockTali();
      let updatedItem: StockTaliItem | null = null;
      let isNew = false;

      // Cari nomor urut maksimum untuk penomoran otomatis
      const maxNo = storedItems.reduce((acc, it) => {
        const n = parseInt(it.no || '0', 10);
        return !isNaN(n) && n > acc ? n : acc;
      }, 0);

      if (action === 'create_row') {
        isNew = true;
        const newNo = itemData.no || String(maxNo + 1);
        const newItem: StockTaliItem = {
          no: newNo,
          pt: pt || 'CPL',
          deptArmada: deptArmada || '-',
          noFpb: itemData.noFpb || '',
          picTtb: (itemData.picTtb || '').toUpperCase(),
          ttb: itemData.ttb || '',
          tglInputTtb: itemData.tglInputTtb || '',
          tglKeTimLapangan: itemData.tglKeTimLapangan || '',
          keterangan: itemData.keterangan || '',
          lapseDay1: itemData.lapseDay1 || '',
          picLapangan: (itemData.picLapangan || '').toUpperCase(),
          tglBarangDiantar: itemData.tglBarangDiantar || '',
          keteranganAntar: itemData.keteranganAntar || '',
          tglTimLapKePicTtb: itemData.tglTimLapKePicTtb || '',
          lapseDay2: itemData.lapseDay2 || '',
          tglTtbKePicPch: itemData.tglTtbKePicPch || '',
          keteranganPch: itemData.keteranganPch || '',
          lapseDay3: itemData.lapseDay3 || '',
          id: `mutasi-${Date.now()}`,
          ...itemData,
        };

        // Tambah ke daftar (urutan baris baru di atas atau sesuai nomor)
        storedItems = [newItem, ...storedItems];
        updatedItem = newItem;
      } else {
        // update_row
        const targetNo = String(itemData.no || '').trim();
        const targetTtb = String(itemData.ttb || '').trim();
        const targetFpb = String(itemData.noFpb || '').trim();
        const targetArmada = deptArmada.toUpperCase();

        const idx = storedItems.findIndex((it) => {
          if (targetNo && String(it.no || '').trim() === targetNo) return true;
          if (targetTtb && String(it.ttb || '').trim() === targetTtb && targetArmada && it.deptArmada.toUpperCase() === targetArmada) return true;
          if (targetTtb && targetFpb && String(it.ttb || '').trim() === targetTtb && String(it.noFpb || '').trim() === targetFpb) return true;
          return false;
        });

        if (idx >= 0) {
          storedItems[idx] = {
            ...storedItems[idx],
            ...itemData,
            pt: (itemData.pt || storedItems[idx].pt).toUpperCase(),
            picTtb: (itemData.picTtb || storedItems[idx].picTtb).toUpperCase(),
            picLapangan: (itemData.picLapangan || storedItems[idx].picLapangan).toUpperCase(),
          };
          updatedItem = storedItems[idx];
        } else {
          // Jika tidak ditemukan, fallback buat sebagai baru
          isNew = true;
          const newNo = itemData.no || String(maxNo + 1);
          const newItem: StockTaliItem = {
            no: newNo,
            pt: pt || 'CPL',
            deptArmada: deptArmada || '-',
            noFpb: itemData.noFpb || '',
            picTtb: (itemData.picTtb || '').toUpperCase(),
            ttb: itemData.ttb || '',
            tglInputTtb: itemData.tglInputTtb || '',
            tglKeTimLapangan: itemData.tglKeTimLapangan || '',
            keterangan: itemData.keterangan || '',
            lapseDay1: itemData.lapseDay1 || '',
            picLapangan: (itemData.picLapangan || '').toUpperCase(),
            tglBarangDiantar: itemData.tglBarangDiantar || '',
            keteranganAntar: itemData.keteranganAntar || '',
            tglTimLapKePicTtb: itemData.tglTimLapKePicTtb || '',
            lapseDay2: itemData.lapseDay2 || '',
            tglTtbKePicPch: itemData.tglTtbKePicPch || '',
            keteranganPch: itemData.keteranganPch || '',
            lapseDay3: itemData.lapseDay3 || '',
            id: `mutasi-${Date.now()}`,
            ...itemData,
          };
          storedItems = [newItem, ...storedItems];
          updatedItem = newItem;
        }
      }

      // Simpan perubahan ke penyimpanan lokal & R2
      const updatedAt = new Date().toISOString();
      await saveStoredStockTali(storedItems, updatedAt);

      // Teruskan ke Google Sheets Webhook jika dikonfigurasi
      const webhookUrl = await getWebhookConfig();
      let googleSyncResult = null;
      let googleSyncSuccess = false;

      if (webhookUrl) {
        googleSyncResult = await forwardToGoogleAppsScript(webhookUrl, {
          action: isNew ? 'create_row' : 'update_row',
          data: updatedItem,
        });
        googleSyncSuccess = !!googleSyncResult?.success;
      }

      const summary = computeSummary(storedItems);

      return NextResponse.json({
        success: true,
        message: isNew
          ? `Mutasi stok No ${updatedItem?.no} berhasil dibuat!`
          : `Mutasi stok No ${updatedItem?.no} berhasil diperbarui!`,
        item: updatedItem,
        total: storedItems.length,
        items: storedItems,
        summary,
        googleSync: googleSyncSuccess,
        googleSyncResult,
        isWebhookConfigured: !!webhookUrl,
      });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in POST /api/sync-stock-tali:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
