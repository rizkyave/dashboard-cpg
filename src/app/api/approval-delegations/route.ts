import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { isR2Configured, uploadToR2, getObjectFromR2 } from '@/utils/r2Client';
import { ApprovalDelegation } from '@/types/delegation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'approval-delegations.json');
const R2_KEY = 'settings/approval-delegations.json';

async function getDelegations(): Promise<ApprovalDelegation[]> {
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_KEY);
      if (obj?.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }

  try {
    const raw = await fs.readFile(LOCAL_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveDelegations(delegations: ApprovalDelegation[]) {
  const jsonStr = JSON.stringify(delegations, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (e) {
      console.warn('Gagal menyimpan delegasi ke R2:', e);
    }
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_FILE_PATH), { recursive: true });
    await fs.writeFile(LOCAL_FILE_PATH, jsonStr, 'utf8');
  } catch {}
}

export async function GET() {
  try {
    const delegations = await getDelegations();
    return NextResponse.json(
      { success: true, delegations },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat data delegasi cuti.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      delegatorUsername,
      delegatorName,
      delegatorRole,
      delegateUsername,
      delegateName,
      delegateRole,
      startDate,
      endDate,
      reason,
      status = 'ACTIVE',
      createdBy,
    } = body;

    if (!delegatorUsername || !delegateUsername) {
      return NextResponse.json(
        { success: false, error: 'Pejabat yang cuti dan pejabat pengganti (Plh) wajib dipilih.' },
        { status: 400 }
      );
    }

    if (delegatorUsername.toLowerCase() === delegateUsername.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Pejabat pengganti (Plh) tidak boleh sama dengan pejabat yang cuti.' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Rentang tanggal mulai dan selesai cuti wajib diisi.' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, error: 'Tanggal mulai tidak boleh lebih lambat dari tanggal selesai cuti.' },
        { status: 400 }
      );
    }

    const delegations = await getDelegations();
    const nowIso = new Date().toISOString();

    if (id) {
      const idx = delegations.findIndex((d) => d.id === id);
      if (idx !== -1) {
        delegations[idx] = {
          ...delegations[idx],
          delegatorUsername,
          delegatorName: delegatorName || delegations[idx].delegatorName,
          delegatorRole: delegatorRole || delegations[idx].delegatorRole,
          delegateUsername,
          delegateName: delegateName || delegations[idx].delegateName,
          delegateRole: delegateRole || delegations[idx].delegateRole,
          startDate,
          endDate,
          reason: reason || delegations[idx].reason,
          status,
          updatedAt: nowIso,
        };
        await saveDelegations(delegations);
        return NextResponse.json({
          success: true,
          message: 'Data delegasi cuti (Plh) berhasil diperbarui.',
          delegation: delegations[idx],
          delegations,
        });
      }
    }

    const newRecord: ApprovalDelegation = {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      delegatorUsername,
      delegatorName: delegatorName || delegatorUsername,
      delegatorRole: delegatorRole || 'supervisor',
      delegateUsername,
      delegateName: delegateName || delegateUsername,
      delegateRole: delegateRole || 'supervisor',
      startDate,
      endDate,
      reason: reason || 'Cuti Tugas',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: createdBy || 'admin',
    };

    delegations.unshift(newRecord);
    await saveDelegations(delegations);

    return NextResponse.json({
      success: true,
      message: `Delegasi wewenang Plh berhasil diaktifkan untuk ${newRecord.delegateName} menggantikan ${newRecord.delegatorName} (${startDate} s/d ${endDate}).`,
      delegation: newRecord,
      delegations,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat menyimpan data delegasi cuti.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const terminateOnly = searchParams.get('terminate') === 'true';

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID delegasi wajib disertakan.' }, { status: 400 });
    }

    const delegations = await getDelegations();
    const idx = delegations.findIndex((d) => d.id === id);

    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Data delegasi tidak ditemukan.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (terminateOnly) {
      // Nonaktifkan saja (akhiri masa cuti lebih awal)
      delegations[idx].status = 'INACTIVE';
      delegations[idx].updatedAt = nowIso;
      delegations[idx].endDate = new Date().toISOString().slice(0, 10);
      await saveDelegations(delegations);
      return NextResponse.json({
        success: true,
        message: 'Masa delegasi Plh telah diakhiri. Wewenang kembali normal.',
        delegations,
      });
    }

    delegations.splice(idx, 1);
    await saveDelegations(delegations);

    return NextResponse.json({
      success: true,
      message: 'Data delegasi cuti berhasil dihapus.',
      delegations,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memproses penghapusan delegasi.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
