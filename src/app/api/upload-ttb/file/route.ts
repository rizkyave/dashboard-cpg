import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { getObjectFromR2, isR2Configured } from '@/utils/r2Client';
import rawHistory from '@/data/ttb-uploads-history.json';
import { stampTtbPdf, formatTtbStampDate } from '@/utils/ttbStamper';
import { getSignatureForUploader } from '@/utils/uploaderSignatures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};


async function ensureTtbPdfStamped(
  pdfBuffer: Buffer,
  filename: string
): Promise<Buffer> {
  try {
    const isTtbDoc = filename.toUpperCase().includes('TTB');
    if (!isTtbDoc) return pdfBuffer;

    const historyItem = (rawHistory as any[]).find(
      (h) => h.renamedFileName === filename || (h.noTtb && filename.toUpperCase().includes(h.noTtb.toUpperCase()))
    );

    const uploader = historyItem?.uploaderUsername || historyItem?.uploaderName;
    const sig = getSignatureForUploader(uploader || 'fifi');
    if (!sig) return pdfBuffer;

    const uploaderDisplayName = historyItem?.uploaderName || 'NURUL HAFIFAH ALIM';
    const stampDate = historyItem?.receivedDate
      ? formatTtbStampDate(historyItem.receivedDate)
      : formatTtbStampDate(new Date().toISOString().slice(0, 10));

    return await stampTtbPdf({
      pdfBuffer,
      signatureDataUrl: sig,
      uploaderName: uploaderDisplayName,
      uploadDate: stampDate,
    });
  } catch (err) {
    console.warn('Gagal memastikan stempel TTB pada berkas PDF:', err);
    return pdfBuffer;
  }
}

// GET /api/upload-ttb/file?name=<renamedFileName>&download=true
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || '';
  const download = req.nextUrl.searchParams.get('download') === 'true';

  // Cegah path traversal: hanya nama file langsung tanpa karakter slash
  if (!name || name !== path.basename(name)) {
    return new NextResponse('Nama file tidak valid.', { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return new NextResponse('Format file tidak didukung.', { status: 415 });
  }

  // 1. Coba baca dari disk lokal
  try {
    const filePath = path.join(getPhotosDir(), name);
    const data = await fs.readFile(filePath);

    const headers: Record<string, string> = {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    };

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(name)}"`;
    } else {
      headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(name)}"`;
    }

    const stampedBytes = ext === '.pdf' ? await ensureTtbPdfStamped(data, name) : data;
    headers['Content-Length'] = String(stampedBytes.length);
    return new NextResponse(new Uint8Array(stampedBytes), { headers });
  } catch {
    // 2. Jika tidak ada di lokal, coba ambil dari Cloudflare R2
    if (isR2Configured()) {
      try {
        const isPdf = ext === '.pdf';
        const r2Key = isPdf ? `ttb-documents/${name}` : `ttb-photos/${name}`;
        let r2Object = await getObjectFromR2(r2Key);

        // Fallback coba prefix sebaliknya jika tidak ditemukan
        if (!r2Object) {
          const altKey = isPdf ? `ttb-photos/${name}` : `ttb-documents/${name}`;
          r2Object = await getObjectFromR2(altKey);
        }

        if (r2Object) {
          const headers: Record<string, string> = {
            'Content-Type': r2Object.contentType || mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
          };

          if (download) {
            headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(name)}"`;
          } else {
            headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(name)}"`;
          }

          const stampedBytes = ext === '.pdf' ? await ensureTtbPdfStamped(Buffer.from(r2Object.body), name) : Buffer.from(r2Object.body);
          headers['Content-Length'] = String(stampedBytes.length);
          return new NextResponse(new Uint8Array(stampedBytes), { headers });
        }
      } catch (r2Err) {
        console.warn('Gagal membaca berkas dari Cloudflare R2:', r2Err);
      }
    }

    // 3. Fallback terakhir ke folder Google Drive
    const driveFolderId = process.env.GOOGLE_DRIVE_TTB_FOLDER_ID || '1Hd6FsgWiALq1jJyRvh8auY0FJGE9h5tf';
    return NextResponse.redirect(`https://drive.google.com/drive/folders/${driveFolderId}`, 302);
  }
}
