import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DeliveryScheduleItem } from '@/types/deliverySchedule';
import {
  uploadToR2,
  isR2Configured,
  getObjectFromR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'src', 'data', 'delivery-schedules.json');
const R2_METADATA_SCHEDULE_KEY = 'dashboard-metadata/delivery-schedules.json';

// Master data 5 Personel Aktif Logistik Tim Delivery
const MASTER_COURIERS = [
  {
    name: 'AGUSSALIM',
    nik: 'MP-DAO-0871',
    phone: '+62 859-5448-7599',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'BARDI',
    nik: 'MP-DAO-0274',
    phone: '+62 813-4718-0635',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'HAMKA ALKA',
    nik: 'CPL-DAO-0031',
    phone: '+62 813-5016-0353',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'ZULFIANSYAH',
    nik: 'MP-DAO-0367',
    phone: '+62 813-4632-0456',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'AKBAR RAMADHAN',
    nik: 'MP-DAO-0512',
    phone: '+62 813-5151-0415',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
];

// Helper membaca data jadwal
async function loadSchedules(): Promise<DeliveryScheduleItem[]> {
  // 1. Coba baca dari Cloudflare R2 terlebih dahulu jika aktif
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_METADATA_SCHEDULE_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[JadwalPengantaran] R2 read fallback to local disk:', err);
    }
  }

  // 2. Baca dari file lokal
  try {
    const data = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper menyimpan data jadwal
async function persistSchedules(items: DeliveryScheduleItem[]): Promise<boolean> {
  const jsonStr = JSON.stringify(items, null, 2);

  // 1. Simpan ke disk lokal
  try {
    const dir = path.dirname(LOCAL_STORAGE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(LOCAL_STORAGE_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.error('[JadwalPengantaran] Gagal simpan ke file lokal:', err);
  }

  // 2. Simpan ke Cloudflare R2
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_SCHEDULE_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('[JadwalPengantaran] Gagal sync ke R2:', err);
    }
  }

  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week'); // W1 atau W2

    let schedules = await loadSchedules();

    if (week && (week === 'W1' || week === 'W2')) {
      schedules = schedules.filter((item) => item.targetWeek === week);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      couriers: MASTER_COURIERS,
      totalCount: schedules.length,
      items: schedules,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat jadwal pengantaran: ' + (error?.message || 'Unknown error'),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const current = await loadSchedules();

    // Mode 1: Bulk replace / AI auto-schedule save
    if (body.action === 'bulk_replace' && Array.isArray(body.items)) {
      const week = body.targetWeek; // jika ada filter week
      let updatedList: DeliveryScheduleItem[];
      
      if (week) {
        // Pertahankan week lain, ganti hanya week yang dikirim
        updatedList = current.filter((x) => x.targetWeek !== week).concat(body.items);
      } else {
        updatedList = body.items;
      }

      await persistSchedules(updatedList);
      return NextResponse.json({
        success: true,
        message: `Berhasil memperbarui ${body.items.length} jadwal pengantaran.`,
        totalCount: updatedList.length,
        items: updatedList,
      });
    }

    // Mode 2: Tambah atau Update single item
    const item: DeliveryScheduleItem = body.item || body;
    if (!item.id || !item.shipName || !item.scheduledDay) {
      return NextResponse.json(
        { success: false, message: 'Data jadwal tidak lengkap (id, shipName, scheduledDay wajib diisi).' },
        { status: 400 }
      );
    }

    const existingIndex = current.findIndex((x) => x.id === item.id);
    let updatedList: DeliveryScheduleItem[];

    if (existingIndex >= 0) {
      updatedList = [...current];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        ...item,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newItem: DeliveryScheduleItem = {
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = [newItem, ...current];
    }

    await persistSchedules(updatedList);

    return NextResponse.json({
      success: true,
      message: 'Jadwal pengantaran berhasil disimpan.',
      item: existingIndex >= 0 ? updatedList[existingIndex] : updatedList[0],
      totalCount: updatedList.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal menyimpan jadwal pengantaran: ' + (error?.message || 'Unknown error'),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Parameter ID jadwal pengantaran wajib diisi.' },
        { status: 400 }
      );
    }

    const current = await loadSchedules();
    const filtered = current.filter((x) => x.id !== id);

    if (filtered.length === current.length) {
      return NextResponse.json(
        { success: false, message: 'Item jadwal tidak ditemukan.' },
        { status: 404 }
      );
    }

    await persistSchedules(filtered);

    return NextResponse.json({
      success: true,
      message: 'Jadwal pengantaran berhasil dihapus.',
      deletedId: id,
      totalCount: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal menghapus jadwal pengantaran: ' + (error?.message || 'Unknown error'),
      },
      { status: 500 }
    );
  }
}
