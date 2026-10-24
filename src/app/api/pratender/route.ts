import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { PratenderPackage } from '@/types/pratender';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_PRATENDER_KEY = 'pratender-metadata/packages.json';
const LOCAL_PRATENDER_PATH = path.join(process.cwd(), 'src', 'data', 'pratender-packages.json');

async function getStoredPackages(): Promise<PratenderPackage[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_PRATENDER_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('Gagal membaca pratender dari R2:', err);
    }
  }

  try {
    const raw = await fs.readFile(LOCAL_PRATENDER_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function savePackages(packages: PratenderPackage[]) {
  const jsonStr = JSON.stringify(packages, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_PRATENDER_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal upload paket pratender ke R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_PRATENDER_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PRATENDER_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal
  }
}

export async function GET() {
  try {
    const packages = await getStoredPackages();
    return NextResponse.json({
      success: true,
      packages,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'SAVE_PACKAGE';

    const currentPackages = await getStoredPackages();

    if (action === 'SAVE_PACKAGE') {
      const pkgData: PratenderPackage = body.package;
      if (!pkgData || !pkgData.title || !pkgData.items || pkgData.items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Data paket atau rincian item tidak lengkap.' },
          { status: 400 }
        );
      }

      const existingIndex = currentPackages.findIndex((p) => p.id === pkgData.id);
      if (existingIndex !== -1) {
        currentPackages[existingIndex] = {
          ...currentPackages[existingIndex],
          ...pkgData,
          updatedAt: new Date().toISOString(),
        };
      } else {
        currentPackages.unshift({
          ...pkgData,
          createdAt: pkgData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await savePackages(currentPackages);

      return NextResponse.json({
        success: true,
        message: `Paket Pratender "${pkgData.packageNumber || pkgData.title}" berhasil disimpan!`,
        package: pkgData,
      });
    }

    if (action === 'UPDATE_STATUS') {
      const { packageId, status, awardedVendor, awardedValue, poNumberGenerated, notes } = body;
      const targetIndex = currentPackages.findIndex((p) => p.id === packageId);
      if (targetIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Paket pratender tidak ditemukan.' },
          { status: 404 }
        );
      }

      const target = currentPackages[targetIndex];
      target.status = status || target.status;
      if (awardedVendor !== undefined) target.awardedVendor = awardedVendor;
      if (awardedValue !== undefined) target.awardedValue = awardedValue;
      if (poNumberGenerated !== undefined) target.poNumberGenerated = poNumberGenerated;
      if (notes !== undefined) target.notes = notes;
      target.updatedAt = new Date().toISOString();

      currentPackages[targetIndex] = target;
      await savePackages(currentPackages);

      return NextResponse.json({
        success: true,
        message: `Status paket ${target.packageNumber} diperbarui menjadi ${target.status}.`,
        package: target,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Aksi tidak dikenali.' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const role = searchParams.get('role');

    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Hanya administrator yang diizinkan menghapus paket pratender.' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID paket diperlukan.' },
        { status: 400 }
      );
    }

    const currentPackages = await getStoredPackages();
    const filtered = currentPackages.filter((p) => p.id !== id);

    if (filtered.length === currentPackages.length) {
      return NextResponse.json(
        { success: false, error: 'Paket tidak ditemukan.' },
        { status: 404 }
      );
    }

    await savePackages(filtered);

    return NextResponse.json({
      success: true,
      message: 'Paket pratender berhasil dihapus oleh admin.',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

