import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';
import { ProcurementItem } from '@/types/procurement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_PROCUREMENT_KEY = 'dashboard-metadata/procurement-data.json';
const R2_WEBHOOK_KEY = 'dashboard-metadata/webhook-config.json';
const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'src', 'data', 'webhook-config.json');
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'google-apps-script-webhook.js');

interface WebhookConfig {
  webhookUrl: string;
  updatedAt: string;
}

// 1. Baca Konfigurasi Webhook dari R2 atau file lokal
async function getWebhookConfig(): Promise<string> {
  // Cek env var
  if (process.env.GOOGLE_SHEET_WEBHOOK_URL) {
    return process.env.GOOGLE_SHEET_WEBHOOK_URL.trim();
  }

  // Cek Cloudflare R2
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_WEBHOOK_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed: WebhookConfig = JSON.parse(text);
        if (parsed.webhookUrl) return parsed.webhookUrl.trim();
      }
    } catch {}
  }

  // Cek file lokal
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const text = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      const parsed: WebhookConfig = JSON.parse(text);
      if (parsed.webhookUrl) return parsed.webhookUrl.trim();
    } catch {}
  }

  return '';
}

// 2. Simpan Konfigurasi Webhook ke R2 dan file lokal
async function saveWebhookConfig(webhookUrl: string): Promise<boolean> {
  const config: WebhookConfig = {
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
    console.warn('Gagal menyimpan webhook config ke lokal:', err);
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
      console.warn('Gagal menyimpan webhook config ke R2:', err);
    }
  }

  return savedLocal;
}

// 3. Baca Procurement Items dari Cloudflare R2
async function getStoredProcurement(): Promise<ProcurementItem[] | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_PROCUREMENT_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Gagal membaca procurement-data.json dari R2:', err);
  }
  return null;
}

// 4. Simpan Procurement Items ke Cloudflare R2
async function saveProcurement(items: ProcurementItem[]): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    await uploadToR2({
      key: R2_PROCUREMENT_KEY,
      body: Buffer.from(JSON.stringify(items), 'utf8'),
      contentType: 'application/json',
    });
    return true;
  } catch (err) {
    console.error('Gagal menyimpan procurement ke R2:', err);
    return false;
  }
}

// 5. Teruskan request ke Google Apps Script Webhook
async function forwardToGoogleAppsScript(webhookUrl: string, payload: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20 detik timeout

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: res.ok, raw: text };
    }
  } catch (err: any) {
    clearTimeout(timeout);
    return {
      success: false,
      message: err.name === 'AbortError' ? 'Koneksi ke Google Sheets timeout (20s).' : err.message,
    };
  }
}

// GET: Ambil config webhook dan skrip
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const getScript = searchParams.get('script') === 'true';

  if (getScript) {
    if (fs.existsSync(SCRIPT_PATH)) {
      const scriptCode = fs.readFileSync(SCRIPT_PATH, 'utf8');
      return NextResponse.json({ success: true, script: scriptCode });
    }
    return NextResponse.json({ success: false, message: 'Skrip webhook tidak ditemukan di server.' }, { status: 404 });
  }

  const webhookUrl = await getWebhookConfig();
  return NextResponse.json({
    success: true,
    webhookUrl: webhookUrl || '',
    isConfigured: !!webhookUrl,
  });
}

// POST: Update row, create row, save webhook URL, atau test webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'update_row';

    // Aksi: Simpan Webhook URL
    if (action === 'save_webhook_url') {
      const url = body.webhookUrl || '';
      await saveWebhookConfig(url);
      return NextResponse.json({
        success: true,
        message: url ? 'Webhook Google Apps Script berhasil disimpan!' : 'Webhook URL dihapus.',
        webhookUrl: url,
      });
    }

    // Aksi: Test Webhook
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
        const json = await testRes.json().catch(() => null);
        if (json && (json.status === 'active' || json.success !== undefined)) {
          return NextResponse.json({
            success: true,
            message: 'Koneksi ke Google Sheets Webhook AKTIF dan SIAP!',
            details: json,
          });
        }
        return NextResponse.json({
          success: true,
          message: `Webhook merespons status HTTP ${testRes.status}.`,
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          message: `Gagal terhubung ke Webhook: ${err.message}`,
        });
      }
    }

    // Aksi: Tambah Baris Baru (create_row) atau Edit Baris (update_row)
    if (action === 'create_row' || action === 'update_row') {
      const itemData: Partial<ProcurementItem> = body.data || body.item;

      if (!itemData) {
        return NextResponse.json(
          { success: false, message: 'Data baris tidak boleh kosong.' },
          { status: 400 }
        );
      }

      // Pastikan ada nomor FPB atau PO
      const targetFpb = String(itemData.fpb || '').trim().toUpperCase();
      const targetPo = String(itemData.po || itemData.noPo || '').trim().toUpperCase();

      if (!targetFpb && !targetPo) {
        return NextResponse.json(
          { success: false, message: 'Harus mengisi Nomor FPB atau Nomor PO.' },
          { status: 400 }
        );
      }

      // 1. Perbarui Data di Penyimpanan Internal Cloudflare R2
      let storedItems = await getStoredProcurement();
      let updatedItem: ProcurementItem | null = null;
      let isNew = false;

      if (storedItems && Array.isArray(storedItems)) {
        const idx = storedItems.findIndex((it) => {
          const itFpb = String(it.fpb || '').trim().toUpperCase();
          const itPo = String(it.po || it.noPo || '').trim().toUpperCase();
          if (targetFpb && itFpb === targetFpb) return true;
          if (targetPo && targetPo !== '-' && itPo === targetPo) return true;
          return false;
        });

        if (idx >= 0) {
          // Update item yang sudah ada
          storedItems[idx] = {
            ...storedItems[idx],
            ...itemData,
            fpb: itemData.fpb || storedItems[idx].fpb,
            po: itemData.po || itemData.noPo || storedItems[idx].po,
          };
          updatedItem = storedItems[idx];
        } else if (action === 'create_row') {
          // Baris baru
          const newItem: ProcurementItem = {
            id: `fpb-${Date.now()}`,
            fpb: itemData.fpb || '-',
            entity: itemData.entity || 'CPL',
            po: itemData.po || itemData.noPo || '-',
            noPo: itemData.noPo || itemData.po || '-',
            date: itemData.tglPo || itemData.date || new Date().toISOString().slice(0, 10),
            item: itemData.item || itemData.keterangan || '-',
            peruntukan: itemData.peruntukan || itemData.deptArmada || '-',
            lapse: itemData.lapse || 0,
            statusBadge: itemData.statusBadge || 'BARU DIBUAT',
            statusTone: itemData.statusTone || 'amber',
            picPch: itemData.picPch || '-',
            picTtb: itemData.picTtb || '-',
            picLap: itemData.picLap || '-',
            picAdm: itemData.picAdm || '-',
            picAktif: itemData.picPch || '-',
            statusPenjelasan: 'Berkas baru diinput dari dashboard',
            ...itemData,
          };
          storedItems.unshift(newItem); // Letakkan di paling atas
          updatedItem = newItem;
          isNew = true;
        }

        // Simpan array yang telah dimodifikasi ke R2
        await saveProcurement(storedItems);
      }

      // 2. Teruskan perubahan ke Google Sheets jika Webhook URL telah disetel
      const webhookUrl = await getWebhookConfig();
      let googleSyncResult: any = null;

      if (webhookUrl) {
        googleSyncResult = await forwardToGoogleAppsScript(webhookUrl, {
          action,
          data: itemData,
        });
      }

      return NextResponse.json({
        success: true,
        message: googleSyncResult?.success
          ? `Data ${targetFpb || targetPo} berhasil disimpan & disinkronkan otomatis ke Google Sheets!`
          : webhookUrl
          ? `Data disimpan di database lokal. Webhook Google Sheets mengembalikan pesan: ${googleSyncResult?.message || 'Menunggu pemrosesan'}`
          : `Data ${targetFpb || targetPo} berhasil disimpan ke database lokal. (Belum terhubung ke Webhook Google Sheets)`,
        googleSync: googleSyncResult?.success || false,
        googleSyncResult,
        item: updatedItem || itemData,
        isNew,
      });
    }

    return NextResponse.json(
      { success: false, message: `Aksi '${action}' tidak dikenali.` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error in /api/monitoring-internal:', err);
    return NextResponse.json(
      { success: false, message: `Terjadi kesalahan server: ${err.message}` },
      { status: 500 }
    );
  }
}
