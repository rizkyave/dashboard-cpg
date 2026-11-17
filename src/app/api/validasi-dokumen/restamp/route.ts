import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { findLocalFile, getPersistentStorageDir } from '@/utils/persistentStorage';
import { stampTtbPdf, formatTtbStampDate, TtbStampRoleType } from '@/utils/ttbStamper';
import { stampFstbPdf, formatFstbStampDate, FstbStampRoleType } from '@/utils/fstbStamper';
import { isR2Configured, uploadToR2 } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleRestamp(req);
}

export async function POST(req: NextRequest) {
  return handleRestamp(req);
}

async function handleRestamp(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let docNumber = searchParams.get('docNumber') || searchParams.get('cleanDocNumber') || '';

    if (!docNumber && req.method === 'POST') {
      try {
        const body = await req.json();
        docNumber = body.docNumber || body.cleanDocNumber || '';
      } catch {}
    }

    if (!docNumber) {
      return NextResponse.json({ success: false, error: 'Parameter docNumber wajib disertakan' }, { status: 400 });
    }

    const cleanDoc = docNumber.trim().replace(/[^a-zA-Z0-9\-_]/g, '');

    // Cari metadata validasi dari seluruh kemungkinan file records.json
    const validationCandidates = [
      path.join(getPersistentStorageDir(), 'validation-metadata', 'records.json'),
      path.join(process.cwd(), 'public', 'uploads', 'validation-metadata', 'records.json'),
      path.join(process.cwd(), 'src', 'data', 'document-validations.json'),
    ];

    let records: any[] = [];
    for (const vc of validationCandidates) {
      try {
        const content = await fs.readFile(vc, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          records = parsed;
          break;
        }
      } catch {}
    }

    const record = records.find(
      (r) =>
        r.cleanDocNumber === cleanDoc ||
        r.docNumber === cleanDoc ||
        (r.cleanDocNumber && cleanDoc.includes(r.cleanDocNumber)) ||
        (r.docNumber && cleanDoc.includes(r.docNumber))
    );

    if (!record) {
      return NextResponse.json({ success: false, error: `Dokumen ${cleanDoc} tidak ditemukan di database validasi.` }, { status: 404 });
    }

    const isTtb = record.docType === 'TTB' || cleanDoc.includes('TTB');
    const filename = record.renamedFileName || `${record.cleanDocNumber || cleanDoc}.pdf`;
    const r2Key = record.r2Key || (isTtb ? `ttb-documents/${filename}` : `fstb-documents/${filename}`);

    // Baca PDF fisik
    const localPdfPath = findLocalFile(r2Key, filename) ||
      findLocalFile(isTtb ? `ttb-documents/${filename}` : `fstb-documents/${filename}`, filename);

    if (!localPdfPath) {
      return NextResponse.json({ success: false, error: `Berkas fisik PDF ${filename} tidak ditemukan di disk lokal Hostinger.` }, { status: 404 });
    }

    let pdfBuffer = await fs.readFile(localPdfPath);
    const stampedSlots: string[] = [];

    if (isTtb) {
      const slots = record.ttbSlots || {};
      const slotOrder: { key: string; roleType: TtbStampRoleType }[] = [
        { key: 'deliveredBy', roleType: 'delivered_by' },
        { key: 'approvedBy', roleType: 'approved_by' },
        { key: 'receivedBy', roleType: 'received_by' },
        { key: 'acknowledgedBy', roleType: 'acknowledged_by' },
      ];

      for (const item of slotOrder) {
        const slotData = slots[item.key];
        if (slotData && slotData.isValidated) {
          try {
            const stamped = await stampTtbPdf({
              pdfBuffer,
              signatureDataUrl: slotData.signatureDataUrl || undefined,
              uploaderName: slotData.validatorName || 'Pejabat Berwenang',
              uploadDate: slotData.validatedAt ? formatTtbStampDate(slotData.validatedAt) : formatTtbStampDate(new Date()),
              roleType: item.roleType,
              verificationToken: slotData.verificationToken || undefined,
            });
            pdfBuffer = Buffer.from(stamped);
            stampedSlots.push(item.key);
          } catch (slotErr: any) {
            console.warn(`Gagal restamp slot ${item.key}:`, slotErr.message);
          }
        }
      }
    } else {
      const slots = record.fstbSlots || {};
      const slotOrder: { key: string; roleType: FstbStampRoleType }[] = [
        { key: 'deliveredBy', roleType: 'delivered_by' },
        { key: 'receivedBy', roleType: 'received_by' },
        { key: 'approvedBy', roleType: 'approved_by' },
        { key: 'acknowledgedBy', roleType: 'acknowledged_by' },
      ];

      for (const item of slotOrder) {
        const slotData = slots[item.key];
        if (slotData && slotData.isValidated) {
          try {
            const stamped = await stampFstbPdf({
              pdfBuffer,
              signatureDataUrl: slotData.signatureDataUrl || undefined,
              uploaderName: slotData.validatorName || 'Pejabat Berwenang',
              uploadDate: slotData.validatedAt ? formatFstbStampDate(slotData.validatedAt) : formatFstbStampDate(new Date()),
              roleType: item.roleType,
              verificationToken: slotData.verificationToken || undefined,
            });
            pdfBuffer = Buffer.from(stamped);
            stampedSlots.push(item.key);
          } catch (slotErr: any) {
            console.warn(`Gagal restamp slot ${item.key}:`, slotErr.message);
          }
        }
      }
    }

    if (stampedSlots.length === 0) {
      return NextResponse.json({ success: false, message: 'Tidak ada slot bertanda tangan yang perlu distamp.' });
    }

    // Simpan hasil PDF kembali ke seluruh direktori penyimpanan permanen
    const subfolder = isTtb ? 'ttb-documents' : 'fstb-documents';
    const saveTargets = [
      localPdfPath,
      path.join(getPersistentStorageDir(), subfolder, filename),
      path.join(getPersistentStorageDir(), filename),
      path.join(process.cwd(), 'public', 'uploads', subfolder, filename),
      path.join(process.cwd(), 'public', subfolder, filename),
    ];

    for (const target of saveTargets) {
      try {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, pdfBuffer);
      } catch {}
    }

    if (isR2Configured()) {
      try {
        await uploadToR2({
          key: r2Key,
          body: pdfBuffer,
          contentType: 'application/pdf',
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil membubuhkan ${stampedSlots.length} stempel tanda tangan ke PDF ${filename}.`,
      stampedSlots,
      pdfPath: localPdfPath,
    });
  } catch (err: any) {
    console.error('Error in /api/validasi-dokumen/restamp:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
