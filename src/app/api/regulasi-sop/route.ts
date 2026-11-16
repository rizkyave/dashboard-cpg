import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
  deleteFromR2,
  getR2FileUrl,
} from '@/utils/r2Client';
import { RegulasiSopData, SopDocument, SopFolder } from '@/types/regulasiSop';
import { getPersistentStorageDir } from '@/utils/persistentStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const R2_METADATA_KEY = 'settings/regulasi-sop.json';
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'src', 'data', 'regulasi-sop.json');
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'sop-documents');

// Helper membaca data
async function loadRegulasiSopData(): Promise<RegulasiSopData> {
  // 1. Coba baca dari R2
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_METADATA_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.folders) && Array.isArray(parsed.documents)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[RegulasiSop] Gagal baca dari Cloudflare R2, fallback ke disk lokal:', err);
    }
  }

  // 2. Baca dari file lokal
  try {
    const raw = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.folders) && Array.isArray(parsed.documents)) {
      return parsed;
    }
  } catch {}

  return {
    folders: [],
    documents: [],
    lastUpdated: new Date().toISOString(),
  };
}

// Helper menyimpan data
async function saveRegulasiSopData(data: RegulasiSopData): Promise<boolean> {
  data.lastUpdated = new Date().toISOString();
  const jsonStr = JSON.stringify(data, null, 2);

  // 1. Simpan ke disk lokal
  try {
    const dir = path.dirname(LOCAL_STORAGE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(LOCAL_STORAGE_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.error('[RegulasiSop] Gagal simpan ke file lokal:', err);
  }

  // 2. Simpan ke Cloudflare R2
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      console.error('[RegulasiSop] Gagal simpan metadata ke Cloudflare R2:', err);
    }
  }

  return true;
}

// GET: Ambil daftar seluruh folder & dokumen
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    const query = searchParams.get('q')?.toLowerCase();

    const data = await loadRegulasiSopData();

    let docs = [...data.documents];

    if (folderId && folderId !== 'ALL') {
      docs = docs.filter((d) => d.folderId === folderId);
    }

    if (query) {
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.docNumber.toLowerCase().includes(query) ||
          d.summary.toLowerCase().includes(query) ||
          d.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({
      success: true,
      folders: data.folders,
      documents: docs,
      totalDocuments: data.documents.length,
      lastUpdated: data.lastUpdated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat data SOP' },
      { status: 500 }
    );
  }
}

// POST: Upload dokumen baru atau buat folder baru
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // A. Form Data (Upload Dokumen File)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const title = (formData.get('title') as string) || '';
      const docNumber = (formData.get('docNumber') as string) || '';
      const folderId = (formData.get('folderId') as string) || '';
      const version = (formData.get('version') as string) || 'v1.0';
      const effectiveDate = (formData.get('effectiveDate') as string) || new Date().toISOString().split('T')[0];
      const summary = (formData.get('summary') as string) || '';
      const tagsRaw = (formData.get('tags') as string) || '';
      const uploadedBy = (formData.get('uploadedBy') as string) || 'admin';
      const uploadedByName = (formData.get('uploadedByName') as string) || 'Administrator';

      if (!title || !docNumber || !folderId) {
        return NextResponse.json(
          { success: false, message: 'Judul, Nomor Dokumen, dan Folder Kategori wajib diisi.' },
          { status: 400 }
        );
      }

      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;
      let fileType = 'pdf';

      if (file && file.size > 0) {
        fileName = file.name;
        fileSize = file.size;
        const ext = path.extname(file.name).toLowerCase().replace('.', '') || 'pdf';
        fileType = ext;

        const buffer = Buffer.from(await file.arrayBuffer());
        const safeDocId = docNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
        const r2Key = `sop-documents/${safeDocId}_${Date.now()}.${ext}`;

        // Simpan ke disk lokal dan penyimpanan permanen Hostinger
        try {
          const targetDirs = [
            LOCAL_UPLOADS_DIR,
            path.join(getPersistentStorageDir(), 'sop-documents'),
          ];
          for (const d of targetDirs) {
            await fs.mkdir(d, { recursive: true });
            const localFilePath = path.join(d, `${safeDocId}_${Date.now()}.${ext}`);
            await fs.writeFile(localFilePath, buffer);
            fileUrl = `/uploads/sop-documents/${path.basename(localFilePath)}`;
          }
        } catch (e) {
          console.warn('Gagal simpan file SOP ke disk lokal:', e);
        }

        // Upload ke Cloudflare R2 jika aktif
        if (isR2Configured()) {
          try {
            await uploadToR2({
              key: r2Key,
              body: buffer,
              contentType: file.type || 'application/pdf',
            });
            fileUrl = `/api/r2-file?key=${encodeURIComponent(r2Key)}`;
          } catch (r2Err) {
            console.warn('Gagal upload file SOP ke Cloudflare R2:', r2Err);
          }
        }
      }

      const newDoc: SopDocument = {
        id: `sop-doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        folderId,
        title,
        docNumber,
        version,
        effectiveDate,
        summary,
        tags,
        fileName: fileName || `${docNumber}.pdf`,
        fileUrl: fileUrl || '',
        fileSize,
        fileType,
        status: 'ACTIVE',
        uploadedBy,
        uploadedByName,
        uploadedAt: new Date().toISOString(),
        viewCount: 0,
        downloadCount: 0,
      };

      const data = await loadRegulasiSopData();
      data.documents.unshift(newDoc);
      await saveRegulasiSopData(data);

      return NextResponse.json({
        success: true,
        message: `Berhasil mengunggah dokumen SOP ${title}`,
        document: newDoc,
      });
    }

    // B. JSON Body (Tambah Folder Baru atau Update Metadata)
    const body = await req.json();

    if (body.action === 'create_folder') {
      const { name, code, description, icon, color } = body;
      if (!name || !code) {
        return NextResponse.json(
          { success: false, message: 'Nama dan Kode folder wajib diisi.' },
          { status: 400 }
        );
      }

      const data = await loadRegulasiSopData();
      const newFolder: SopFolder = {
        id: `folder-${Date.now()}`,
        name,
        code: code.toUpperCase(),
        description: description || '',
        icon: icon || 'Folder',
        color: color || 'blue',
        order: data.folders.length + 1,
      };

      data.folders.push(newFolder);
      await saveRegulasiSopData(data);

      return NextResponse.json({
        success: true,
        message: `Folder ${name} berhasil dibuat.`,
        folder: newFolder,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Aksi tidak dikenali.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Terjadi kesalahan saat memproses data.' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus Dokumen atau Folder
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');
    const folderId = searchParams.get('folderId');

    const data = await loadRegulasiSopData();

    if (docId) {
      const targetDoc = data.documents.find((d) => d.id === docId);
      if (!targetDoc) {
        return NextResponse.json({ success: false, message: 'Dokumen tidak ditemukan.' }, { status: 404 });
      }

      data.documents = data.documents.filter((d) => d.id !== docId);
      await saveRegulasiSopData(data);

      return NextResponse.json({
        success: true,
        message: `Dokumen ${targetDoc.title} berhasil dihapus.`,
      });
    }

    if (folderId) {
      const targetFolder = data.folders.find((f) => f.id === folderId);
      if (!targetFolder) {
        return NextResponse.json({ success: false, message: 'Folder tidak ditemukan.' }, { status: 404 });
      }

      // Hapus folder dan seluruh dokumen di dalamnya
      data.folders = data.folders.filter((f) => f.id !== folderId);
      data.documents = data.documents.filter((d) => d.folderId !== folderId);
      await saveRegulasiSopData(data);

      return NextResponse.json({
        success: true,
        message: `Folder ${targetFolder.name} beserta dokumennya berhasil dihapus.`,
      });
    }

    return NextResponse.json(
      { success: false, message: 'ID Dokumen atau Folder wajib disertakan.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal menghapus data.' },
      { status: 500 }
    );
  }
}

// PATCH: Update view count, download count, status dokumen
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { docId, action, status } = body;

    if (!docId) {
      return NextResponse.json({ success: false, message: 'docId wajib diisi.' }, { status: 400 });
    }

    const data = await loadRegulasiSopData();
    const doc = data.documents.find((d) => d.id === docId);
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Dokumen tidak ditemukan.' }, { status: 404 });
    }

    if (action === 'increment_view') {
      doc.viewCount = (doc.viewCount || 0) + 1;
    } else if (action === 'increment_download') {
      doc.downloadCount = (doc.downloadCount || 0) + 1;
    } else if (status) {
      doc.status = status;
    }

    doc.lastModifiedAt = new Date().toISOString();
    await saveRegulasiSopData(data);

    return NextResponse.json({ success: true, document: doc });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memperbarui dokumen.' },
      { status: 500 }
    );
  }
}
