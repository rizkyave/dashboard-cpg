import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { INITIAL_PROCUREMENT_DATA, INITIAL_ARMADA_DATA } from '@/data/initialData';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';
import { findLocalFile, getPersistentStorageDir } from '@/utils/persistentStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_PROCUREMENT_KEY = 'dashboard-metadata/procurement-data.json';
const R2_ARMADA_KEY = 'dashboard-metadata/armada-data.json';
const R2_DASHBOARD_META_KEY = 'dashboard-metadata/dashboard-meta.json';

const LOCAL_PROCUREMENT_PATH = path.join(process.cwd(), 'public', 'uploads', 'dashboard-metadata', 'procurement-data.json');
const LOCAL_ARMADA_PATH = path.join(process.cwd(), 'public', 'uploads', 'dashboard-metadata', 'armada-data.json');
const LOCAL_META_PATH = path.join(process.cwd(), 'public', 'uploads', 'dashboard-metadata', 'dashboard-meta.json');

// In-Memory RAM Cache Server dengan TTL 5 Menit (300.000 ms)
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedProcurement: ProcurementItem[] | null = null;
let cachedArmada: ArmadaItem[] | null = null;
let cachedMeta: DashboardMeta | null = null;
let lastDashboardSyncCacheTime = 0;

interface DashboardMeta {
  lastUpdated: string;
  totalProcurement: number;
  totalArmada: number;
  updatedBy?: string;
}

const R2_PUBLIC_BASE =
  process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/+$/, '') ||
  'https://pub-9a40b24be68549b19c6eaec0f2542c0b.r2.dev';

/**
 * Baca dataset Procurement dari disk lokal Hostinger atau Cloudflare R2
 */
async function getStoredProcurementFromR2(): Promise<ProcurementItem[] | null> {
  // Prioritas 1: Baca langsung dari disk Hostinger (shared_uploads & public/uploads)
  const candidateProcurementPaths = [
    findLocalFile('dashboard-metadata/procurement-data.json', 'procurement-data.json'),
    path.join(getPersistentStorageDir(), 'dashboard-metadata', 'procurement-data.json'),
    LOCAL_PROCUREMENT_PATH,
  ].filter(Boolean) as string[];

  for (const p of candidateProcurementPaths) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }

  // Prioritas 2: Fallback ke Cloudflare R2 hanya jika R2 aktif
  if (isR2Configured()) {
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
      console.warn('Gagal membaca procurement-data.json dari Cloudflare R2 via SDK:', err);
    }
  }
  return null;
}

/**
 * Baca dataset Armada dari disk lokal Hostinger atau Cloudflare R2
 */
async function getStoredArmadaFromR2(): Promise<ArmadaItem[] | null> {
  // Prioritas 1: Baca langsung dari disk Hostinger (shared_uploads & public/uploads)
  const candidateArmadaPaths = [
    findLocalFile('dashboard-metadata/armada-data.json', 'armada-data.json'),
    path.join(getPersistentStorageDir(), 'dashboard-metadata', 'armada-data.json'),
    LOCAL_ARMADA_PATH,
  ].filter(Boolean) as string[];

  for (const p of candidateArmadaPaths) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }

  // Prioritas 2: Fallback ke Cloudflare R2 hanya jika R2 aktif
  if (isR2Configured()) {
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
      console.warn('Gagal membaca armada-data.json dari Cloudflare R2 via SDK:', err);
    }
  }
  return null;
}

/**
 * Simpan dataset Procurement & Armada ke Disk Hostinger (dan Cloudflare R2 jika aktif)
 */
async function saveDashboardDataToR2(
  procurement: ProcurementItem[],
  armada: ArmadaItem[],
  updatedBy: string = 'system'
): Promise<boolean> {
  const now = new Date().toISOString();
  const meta: DashboardMeta = {
    lastUpdated: now,
    totalProcurement: procurement.length,
    totalArmada: armada.length,
    updatedBy,
  };

  const procJson = JSON.stringify(procurement);
  const armJson = JSON.stringify(armada);
  const metaJson = JSON.stringify(meta, null, 2);

  // 1. Simpan selalu ke Hostinger Persistent Disk (shared_uploads & public/uploads)
  try {
    const diskTargets = [
      {
        paths: [
          path.join(getPersistentStorageDir(), 'dashboard-metadata', 'procurement-data.json'),
          LOCAL_PROCUREMENT_PATH,
        ],
        data: procJson,
      },
      {
        paths: [
          path.join(getPersistentStorageDir(), 'dashboard-metadata', 'armada-data.json'),
          LOCAL_ARMADA_PATH,
        ],
        data: armJson,
      },
      {
        paths: [
          path.join(getPersistentStorageDir(), 'dashboard-metadata', 'dashboard-meta.json'),
          LOCAL_META_PATH,
        ],
        data: metaJson,
      },
    ];

    for (const target of diskTargets) {
      for (const p of target.paths) {
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, target.data, 'utf8');
      }
    }
  } catch (diskErr) {
    console.warn('Gagal menyimpan metadata dashboard ke disk Hostinger:', diskErr);
  }

  // 2. Simpan ke Cloudflare R2 hanya jika R2 dikonfigurasi aktif
  if (isR2Configured()) {
    try {
      await Promise.all([
        uploadToR2({
          key: R2_PROCUREMENT_KEY,
          body: Buffer.from(procJson, 'utf8'),
          contentType: 'application/json',
        }),
        uploadToR2({
          key: R2_ARMADA_KEY,
          body: Buffer.from(armJson, 'utf8'),
          contentType: 'application/json',
        }),
        uploadToR2({
          key: R2_DASHBOARD_META_KEY,
          body: Buffer.from(metaJson, 'utf8'),
          contentType: 'application/json',
        }),
      ]);
    } catch (err) {
      console.warn('Gagal menyimpan dashboard data ke Cloudflare R2:', err);
    }
  }

  return true;
}

/**
 * GET: Ambil dataset Procurement dan Layanan Armada tersinkron dari Cloudflare R2
 */
export async function GET() {
  try {
    const isCacheFresh = Boolean(
      cachedProcurement &&
      cachedArmada &&
      Date.now() - lastDashboardSyncCacheTime < CACHE_TTL_MS
    );

    if (isCacheFresh) {
      return NextResponse.json(
        {
          success: true,
          fromR2: isR2Configured(),
          cached: true,
          procurement: cachedProcurement!,
          armada: cachedArmada!,
          meta: cachedMeta || {
            lastUpdated: new Date().toISOString(),
            totalProcurement: cachedProcurement!.length,
            totalArmada: cachedArmada!.length,
          },
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          },
        }
      );
    }

    let procurement = await getStoredProcurementFromR2();
    let armada = await getStoredArmadaFromR2();

    // Inisialisasi fallback aman jika data masih kosong
    if (!procurement || procurement.length === 0) {
      procurement = INITIAL_PROCUREMENT_DATA;
    }

    if (!armada || armada.length === 0) {
      armada = INITIAL_ARMADA_DATA;
    }

    let meta: DashboardMeta | null = null;
    const candidateMetaPaths = [
      findLocalFile('dashboard-metadata/dashboard-meta.json', 'dashboard-meta.json'),
      path.join(getPersistentStorageDir(), 'dashboard-metadata', 'dashboard-meta.json'),
      LOCAL_META_PATH,
    ].filter(Boolean) as string[];

    for (const p of candidateMetaPaths) {
      try {
        const raw = await fs.readFile(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          meta = parsed;
          break;
        }
      } catch {}
    }

    if (!meta && isR2Configured()) {
      try {
        const metaObj = await getObjectFromR2(R2_DASHBOARD_META_KEY);
        if (metaObj && metaObj.body) {
          meta = JSON.parse(Buffer.from(metaObj.body).toString('utf8'));
        }
      } catch {}
    }

    const effectiveMeta = meta || {
      lastUpdated: new Date().toISOString(),
      totalProcurement: procurement.length,
      totalArmada: armada.length,
    };

    cachedProcurement = procurement;
    cachedArmada = armada;
    cachedMeta = effectiveMeta;
    lastDashboardSyncCacheTime = Date.now();

    return NextResponse.json(
      {
        success: true,
        fromR2: isR2Configured(),
        cached: false,
        procurement,
        armada,
        meta: effectiveMeta,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
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
        cachedProcurement = resetProc;
        cachedArmada = resetArm;
        cachedMeta = null;
        lastDashboardSyncCacheTime = 0;
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

    // Perbarui in-memory cache server seketika
    cachedProcurement = newProcurement;
    cachedArmada = newArmada;
    cachedMeta = {
      lastUpdated: new Date().toISOString(),
      totalProcurement: newProcurement.length,
      totalArmada: newArmada.length,
      updatedBy: body?.updatedBy || 'user',
    };
    lastDashboardSyncCacheTime = Date.now();

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

