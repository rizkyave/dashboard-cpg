import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { ModulePermissionItem, MODULE_PERMISSIONS_MATRIX } from '@/types/auth';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_RBAC_MATRIX_KEY = 'settings/rbac-matrix.json';
const LOCAL_RBAC_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'rbac-matrix.json');

/**
 * Baca matriks perizinan RBAC dari Cloudflare R2 atau disk lokal
 */
async function getStoredRbacMatrix(): Promise<ModulePermissionItem[]> {
  // 1. Coba baca dari Cloudflare R2 jika terkonfigurasi
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_RBAC_MATRIX_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca RBAC Matrix dari Cloudflare R2:', err);
    }
  }

  // 2. Coba baca dari file lokal
  try {
    const raw = await fs.readFile(LOCAL_RBAC_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Non-fatal
  }

  // 3. Fallback ke matriks bawaan sistem
  return MODULE_PERMISSIONS_MATRIX;
}

/**
 * Simpan matriks perizinan RBAC ke Cloudflare R2 dan disk lokal
 */
async function saveStoredRbacMatrix(matrix: ModulePermissionItem[]): Promise<void> {
  const jsonStr = JSON.stringify(matrix, null, 2);

  // 1. Simpan ke Cloudflare R2
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_RBAC_MATRIX_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      });
    } catch (err) {
      console.warn('Gagal menyimpan RBAC Matrix ke Cloudflare R2:', err);
    }
  }

  // 2. Simpan ke file lokal
  try {
    await fs.mkdir(path.dirname(LOCAL_RBAC_FILE_PATH), { recursive: true });
    await fs.writeFile(LOCAL_RBAC_FILE_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.error('Gagal menyimpan RBAC Matrix ke file lokal:', err);
  }
}

/**
 * GET: Ambil matriks hak akses & perizinan modul RBAC terkini
 */
export async function GET() {
  try {
    const matrix = await getStoredRbacMatrix();
    return NextResponse.json(
      {
        success: true,
        matrix,
        storage: isR2Configured() ? 'CLOUDFLARE_R2' : 'LOCAL',
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal memuat RBAC Matrix';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

/**
 * POST: Simpan kustomisasi matriks hak akses & perizinan modul RBAC
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matrix, action } = body;

    // Aksi Reset ke default bawaan sistem
    if (action === 'reset') {
      await saveStoredRbacMatrix(MODULE_PERMISSIONS_MATRIX);
      return NextResponse.json({
        success: true,
        message: 'Matriks hak akses RBAC berhasil di-reset ke setelan default sistem CPG.',
        matrix: MODULE_PERMISSIONS_MATRIX,
      });
    }

    if (!Array.isArray(matrix) || matrix.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data matriks perizinan tidak valid.' },
        { status: 400 }
      );
    }

    await saveStoredRbacMatrix(matrix);

    return NextResponse.json({
      success: true,
      message: 'Matriks hak akses & perizinan modul RBAC berhasil disimpan permanen di server.',
      matrix,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal menyimpan RBAC Matrix';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

