import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_PROCUREMENT_DATA, INITIAL_ARMADA_DATA } from '@/data/initialData';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_PROCUREMENT_KEY = 'dashboard-metadata/procurement-data.json';
const R2_ARMADA_KEY = 'dashboard-metadata/armada-data.json';
const R2_DASHBOARD_META_KEY = 'dashboard-metadata/dashboard-meta.json';

interface DashboardMeta {
  lastUpdated: string;
  totalProcurement: number;
  totalArmada: number;
  updatedBy?: string;
}

/**
 * Baca dataset Procurement dari Cloudflare R2
 */
async function getStoredProcurementFromR2(): Promise<ProcurementItem[] | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_PROCUREMENT_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca procurement-data.json dari Cloudflare R2:', err);
  }
  return null;
}

/**
 * Baca dataset Armada dari Cloudflare R2
 */
async function getStoredArmadaFromR2(): Promise<ArmadaItem[] | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_ARMADA_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca armada-data.json dari Cloudflare R2:', err);
  }
  return null;
}

/**
 * Simpan dataset Procurement & Armada ke Cloudflare R2
 */
async function saveDashboardDataToR2(
  procurement: ProcurementItem[],
  armada: ArmadaItem[],
  updatedBy: string = 'system'
): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    const now = new Date().toISOString();
    const meta: DashboardMeta = {
      lastUpdated: now,
      totalProcurement: procurement.length,
      totalArmada: armada.length,
      updatedBy,
    };

    await Promise.all([
      uploadToR2({
        key: R2_PROCUREMENT_KEY,
        body: Buffer.from(JSON.stringify(procurement), 'utf8'),
        contentType: 'application/json',
      }),
      uploadToR2({
        key: R2_ARMADA_KEY,
        body: Buffer.from(JSON.stringify(armada), 'utf8'),
        contentType: 'application/json',
      }),
      uploadToR2({
        key: R2_DASHBOARD_META_KEY,
        body: Buffer.from(JSON.stringify(meta, null, 2), 'utf8'),
        contentType: 'application/json',
      }),
    ]);
    return true;
  } catch (err) {
    console.error('Gagal menyimpan dashboard data ke Cloudflare R2:', err);
    return false;
  }
}

/**
 * GET: Ambil dataset Procurement dan Layanan Armada tersinkron dari Cloudflare R2
 */
export async function GET() {
  try {
    let procurement = await getStoredProcurementFromR2();
    let armada = await getStoredArmadaFromR2();

    // Jika di R2 belum ada data (booting perdana), inisialisasi dari INITIAL_DATA dan seed ke R2
    if (!procurement || procurement.length === 0) {
      procurement = INITIAL_PROCUREMENT_DATA;
      if (isR2Configured()) {
        try {
          await uploadToR2({
            key: R2_PROCUREMENT_KEY,
            body: Buffer.from(JSON.stringify(procurement), 'utf8'),
            contentType: 'application/json',
          });
        } catch {}
      }
    }

    if (!armada || armada.length === 0) {
      armada = INITIAL_ARMADA_DATA;
      if (isR2Configured()) {
        try {
          await uploadToR2({
            key: R2_ARMADA_KEY,
            body: Buffer.from(JSON.stringify(armada), 'utf8'),
            contentType: 'application/json',
          });
        } catch {}
      }
    }

    let meta: DashboardMeta | null = null;
    if (isR2Configured()) {
      try {
        const metaObj = await getObjectFromR2(R2_DASHBOARD_META_KEY);
        if (metaObj && metaObj.body) {
          meta = JSON.parse(Buffer.from(metaObj.body).toString('utf8'));
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      fromR2: isR2Configured(),
      procurement,
      armada,
      meta: meta || {
        lastUpdated: new Date().toISOString(),
        totalProcurement: procurement.length,
        totalArmada: armada.length,
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/dashboard-sync:', err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Gagal menyinkronkan data dashboard dari cloud.',
        procurement: INITIAL_PROCUREMENT_DATA,
        armada: INITIAL_ARMADA_DATA,
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Simpan pembaruan Procurement dan/atau Armada ke Cloudflare R2
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action || 'save';

    if (action === 'reset') {
      const scope = body?.scope || 'all';
      if (scope === 'all' || scope === 'procurement') {
        const resetProc: ProcurementItem[] = [];
        const resetArm: ArmadaItem[] = [];
        await saveDashboardDataToR2(resetProc, resetArm, body?.updatedBy || 'reset');
      }
      return NextResponse.json({
        success: true,
        message: 'Data dashboard di cloud R2 berhasil direset.',
      });
    }

    // Ambil data yang ada jika hanya salah satu yang dikirim
    let newProcurement: ProcurementItem[] | null = Array.isArray(body?.procurement)
      ? body.procurement
      : null;
    let newArmada: ArmadaItem[] | null = Array.isArray(body?.armada)
      ? body.armada
      : null;

    if (!newProcurement) {
      newProcurement = (await getStoredProcurementFromR2()) || INITIAL_PROCUREMENT_DATA;
    }
    if (!newArmada) {
      newArmada = (await getStoredArmadaFromR2()) || INITIAL_ARMADA_DATA;
    }

    const saved = await saveDashboardDataToR2(
      newProcurement,
      newArmada,
      body?.updatedBy || 'user'
    );

    return NextResponse.json({
      success: true,
      savedToR2: saved,
      message: `Berhasil menyinkronkan data ke Cloudflare R2 (${newProcurement.length} item procurement, ${newArmada.length} armada).`,
      totalProcurement: newProcurement.length,
      totalArmada: newArmada.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in POST /api/dashboard-sync:', err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Gagal menyimpan data dashboard ke Cloudflare R2.',
      },
      { status: 500 }
    );
  }
}

