import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { uploadToR2, isR2Configured, getObjectFromR2 } from '@/utils/r2Client';
import { PreDispatchChecklistData, PreDispatchResponse } from '@/types/preDispatch';
import { sanitizeTtbNumber } from '@/utils/ttbRename';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const R2_PRE_DISPATCH_KEY = 'ttb-metadata/pre-dispatch-records.json';
const LOCAL_PRE_DISPATCH_PATH = path.join(process.cwd(), 'src', 'data', 'pre-dispatch-records.json');

async function getPreDispatchRecords(): Promise<PreDispatchChecklistData[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_PRE_DISPATCH_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback ke local
    }
  }

  try {
    const raw = await fs.readFile(LOCAL_PRE_DISPATCH_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Non-fatal
  }

  return [];
}

async function savePreDispatchRecords(records: PreDispatchChecklistData[]): Promise<void> {
  const jsonStr = JSON.stringify(records, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_PRE_DISPATCH_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal sinkronisasi pre-dispatch ke Cloudflare R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_PRE_DISPATCH_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PRE_DISPATCH_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.error('Gagal menyimpan pre-dispatch ke file lokal:', err);
  }
}

// GET: Ambil seluruh daftar pre-dispatch checklist
export async function GET(): Promise<NextResponse<PreDispatchResponse>> {
  try {
    const records = await getPreDispatchRecords();
    return NextResponse.json({
      success: true,
      message: 'Berhasil memuat data checklist pre-dispatch.',
      records,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat data pre-dispatch.',
        error: (err as Error).message,
        records: [],
      },
      { status: 500 }
    );
  }
}

// POST: Simpan atau perbarui checklist pre-dispatch keberangkatan
export async function POST(req: NextRequest): Promise<NextResponse<PreDispatchResponse>> {
  try {
    const body = await req.json();
    const {
      ttbId,
      noTtb,
      armada,
      noFpb,
      noPo,
      itemSummary,
      itemsVerified,
      packagingGood,
      documentsReady,
      dispatchNotes,
      dispatchedAt,
      courierName,
    } = body;

    if (!ttbId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nomor / ID TTB wajib disertakan.',
        },
        { status: 400 }
      );
    }

    if (!itemsVerified || !packagingGood || !documentsReady) {
      return NextResponse.json(
        {
          success: false,
          message: 'Semua 3 poin pemeriksaan wajib dicentang sebelum keberangkatan.',
        },
        { status: 400 }
      );
    }

    const cleanNoTtb = sanitizeTtbNumber(ttbId || noTtb || '');
    const nowIso = dispatchedAt || new Date().toISOString();

    const newRecord: PreDispatchChecklistData = {
      ttbId,
      cleanNoTtb,
      noTtb: noTtb || ttbId,
      armada: armada || '',
      noFpb: noFpb || '',
      noPo: noPo || '',
      itemSummary: itemSummary || '',
      itemsVerified: Boolean(itemsVerified),
      packagingGood: Boolean(packagingGood),
      documentsReady: Boolean(documentsReady),
      dispatchNotes: (dispatchNotes || '').trim(),
      dispatchedAt: nowIso,
      courierName: (courierName || 'Petugas Lapangan').trim(),
    };

    const records = await getPreDispatchRecords();
    const existingIndex = records.findIndex(
      (r) => r.cleanNoTtb === cleanNoTtb || r.ttbId === ttbId || r.noTtb === noTtb
    );

    if (existingIndex >= 0) {
      records[existingIndex] = newRecord;
    } else {
      records.unshift(newRecord);
    }

    await savePreDispatchRecords(records);

    return NextResponse.json({
      success: true,
      message: `Pemeriksaan pra-keberangkatan TTB ${newRecord.noTtb} berhasil dikonfirmasi. Status: Dalam Pengantaran.`,
      record: newRecord,
      records,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memproses konfirmasi pre-dispatch.',
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

