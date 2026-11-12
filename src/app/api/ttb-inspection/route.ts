import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { AppNotification } from '@/types/notification';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type TtbConditionStatus = 'LENGKAP_BAIK' | 'SEBAGIAN_KURANG' | 'RUSAK_CACAT';

export interface TtbInspectionRecord {
  id: string;
  noTtb: string;
  armada: string;
  checkerName: string;
  conditionStatus: TtbConditionStatus;
  conditionNotes?: string;
  checklist: {
    fisikDanQty: boolean;
    kemasanDanLabel: boolean;
    dokumenLengkap: boolean;
  };
  otpCode?: string;
  signatureDataUrl?: string;
  photoFiles: string[];
  inspectedAt: string;
}

const R2_INSPECTIONS_KEY = 'ttb-metadata/ttb-inspections.json';
const LOCAL_INSPECTIONS_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-inspections.json');
const R2_NOTIFICATIONS_KEY = 'ttb-metadata/notifications.json';
const LOCAL_NOTIFICATIONS_PATH = path.join(process.cwd(), 'src', 'data', 'notifications-data.json');

async function getInspections(): Promise<TtbInspectionRecord[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_INSPECTIONS_KEY);
      if (r2Obj && r2Obj.body) {
        const parsed = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(LOCAL_INSPECTIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function saveInspections(records: TtbInspectionRecord[]) {
  const jsonStr = JSON.stringify(records, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_INSPECTIONS_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal simpan ttb-inspections ke R2:', err);
    }
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_INSPECTIONS_PATH), { recursive: true });
    await fs.writeFile(LOCAL_INSPECTIONS_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.warn('Gagal simpan ttb-inspections lokal:', err);
  }
}

async function appendNotification(notification: AppNotification) {
  let list: AppNotification[] = [];
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_NOTIFICATIONS_KEY);
      if (r2Obj && r2Obj.body) {
        list = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
      }
    } catch {}
  }
  if (!list.length) {
    try {
      const raw = await fs.readFile(LOCAL_NOTIFICATIONS_PATH, 'utf8');
      list = JSON.parse(raw);
    } catch {}
  }
  list.unshift(notification);
  const jsonStr = JSON.stringify(list.slice(0, 150), null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_NOTIFICATIONS_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_NOTIFICATIONS_PATH), { recursive: true });
    await fs.writeFile(LOCAL_NOTIFICATIONS_PATH, jsonStr, 'utf8');
  } catch {}
}

export async function GET() {
  try {
    const records = await getInspections();
    return NextResponse.json(
      { success: true, records },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat data pengecekan TTB', records: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const noTtb = String(body.noTtb || '').trim().toUpperCase();
    const checkerName = String(body.checkerName || '').trim();
    if (!noTtb || !checkerName) {
      return NextResponse.json(
        { success: false, message: 'Nomor TTB dan nama petugas wajib diisi.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const conditionStatus: TtbConditionStatus =
      body.conditionStatus === 'SEBAGIAN_KURANG' || body.conditionStatus === 'RUSAK_CACAT'
        ? body.conditionStatus
        : 'LENGKAP_BAIK';

    const newRecord: TtbInspectionRecord = {
      id: `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      noTtb,
      armada: String(body.armada || '-').trim() || '-',
      checkerName,
      conditionStatus,
      conditionNotes: body.conditionNotes ? String(body.conditionNotes).trim() : undefined,
      checklist: {
        fisikDanQty: Boolean(body.checklist?.fisikDanQty),
        kemasanDanLabel: Boolean(body.checklist?.kemasanDanLabel),
        dokumenLengkap: Boolean(body.checklist?.dokumenLengkap),
      },
      otpCode: body.otpCode ? String(body.otpCode).trim() : undefined,
      signatureDataUrl: body.signatureDataUrl ? String(body.signatureDataUrl) : undefined,
      photoFiles: Array.isArray(body.photoFiles) ? body.photoFiles.map(String) : [],
      inspectedAt: nowIso,
    };

    const existing = await getInspections();
    const updated = [newRecord, ...existing].slice(0, 500);
    await saveInspections(updated);

    // Notifikasi otomatis ke Gudang, Purchasing & Logistik
    const condLabel =
      conditionStatus === 'LENGKAP_BAIK'
        ? 'Lengkap & Baik'
        : conditionStatus === 'SEBAGIAN_KURANG'
        ? 'Sebagian / Kurang Qty'
        : 'Ada Kerusakan / Cacat';

    const notifItem: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'SERAH_TERIMA_COMPLETED',
      title:
        conditionStatus === 'LENGKAP_BAIK'
          ? `✅ Pengecekan TTB ${noTtb} Lengkap`
          : `⚠️ Pengecekan TTB ${noTtb}: ${condLabel}`,
      message: `${checkerName} (Tim TTB) menyelesaikan pengecekan ${noTtb} (${newRecord.armada}) — Kondisi: ${condLabel}${
        newRecord.conditionNotes ? ` (${newRecord.conditionNotes})` : ''
      }.`,
      senderName: checkerName,
      senderUsername: 'tim_ttb_mobile',
      senderRole: 'staf_ttb',
      targetRole: 'all',
      linkTab: 'upload-ttb',
      createdAt: nowIso,
      readBy: [],
      metadata: {
        noTtb,
        armada: newRecord.armada,
        notes: newRecord.conditionNotes,
      },
    };
    await appendNotification(notifItem);

    return NextResponse.json({
      success: true,
      message: `Konfirmasi pengecekan TTB ${noTtb} (${condLabel}) berhasil dicatat & notifikasi terkirim.`,
      record: newRecord,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal menyimpan pengecekan TTB.' },
      { status: 500 }
    );
  }
}
