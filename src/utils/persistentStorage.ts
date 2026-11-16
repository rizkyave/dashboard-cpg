import path from 'path';
import fs from 'fs';

/**
 * Mengembalikan direktori penyimpanan permanen di Hostinger.
 * Folder ini berada di luar direktori versions (yaitu di hbuilds/shared_uploads),
 * sehingga TIDAK AKAN PERNAH ter-reset atau terhapus saat klik tombol Git Deploy di Hostinger.
 */
export function getPersistentStorageDir(): string {
  const cwd = process.cwd();

  // 1. Direktori permanen bersama di Hostinger (kebal Git Deploy)
  const sharedUploads = path.resolve(cwd, '../../../shared_uploads');
  if (fs.existsSync(sharedUploads)) {
    return sharedUploads;
  }

  // Coba buat folder shared_uploads jika berada di environment Hostinger
  try {
    const hbuildsDir = path.resolve(cwd, '../../..');
    if (fs.existsSync(hbuildsDir) && path.basename(hbuildsDir) === 'hbuilds') {
      fs.mkdirSync(sharedUploads, { recursive: true });
      return sharedUploads;
    }
  } catch {}

  // 2. Fallback ke public/uploads di dalam proyek lokal
  const localUploads = path.join(cwd, 'public', 'uploads');
  try {
    if (!fs.existsSync(localUploads)) {
      fs.mkdirSync(localUploads, { recursive: true });
    }
  } catch {}

  return localUploads;
}

/**
 * Mencari berkas di seluruh lokasi penyimpanan yang valid:
 * 1. Direktori permanen shared_uploads
 * 2. Direktori public/uploads lokal
 * 3. Direktori public/
 * 4. Sibling versions di hbuilds/versions/[uuid]/nodejs/public/uploads
 */
export function findLocalFile(relPath: string, filename?: string): string | null {
  const cwd = process.cwd();
  const cleanRel = relPath.split('\\').join('/').replace(/^\/+/, '');
  const fname = filename || path.basename(cleanRel);

  const candidates: string[] = [
    // Shared uploads permanen
    path.join(getPersistentStorageDir(), cleanRel),
    path.join(getPersistentStorageDir(), fname),

    // Local project public/uploads
    path.join(cwd, 'public', 'uploads', cleanRel),
    path.join(cwd, 'public', 'uploads', fname),
    path.join(cwd, 'public', cleanRel),
    path.join(cwd, 'public', fname),

    // Subfolder langsung di public
    path.join(cwd, 'public', 'ttb-documents', fname),
    path.join(cwd, 'public', 'fstb-documents', fname),
    path.join(cwd, 'public', 'sop-documents', fname),
    path.join(cwd, 'public', 'ttb-photos', fname),
    path.join(cwd, 'public', 'fpb-pdfs', fname),
    path.join(cwd, 'public', 'fpb-signed', fname),
  ];

  // Cari di shared_uploads subfolders
  const shared = getPersistentStorageDir();
  candidates.push(path.join(shared, 'uploads', cleanRel));
  candidates.push(path.join(shared, 'uploads', fname));
  candidates.push(path.join(shared, 'ttb-documents', fname));
  candidates.push(path.join(shared, 'fstb-documents', fname));
  candidates.push(path.join(shared, 'sop-documents', fname));
  candidates.push(path.join(shared, 'ttb-photos', fname));
  candidates.push(path.join(shared, 'fpb-pdfs', fname));
  candidates.push(path.join(shared, 'fpb-signed', fname));
  candidates.push(path.join(shared, 'uploads', 'ttb-documents', fname));
  candidates.push(path.join(shared, 'uploads', 'fstb-documents', fname));
  candidates.push(path.join(shared, 'uploads', 'sop-documents', fname));
  candidates.push(path.join(shared, 'uploads', 'ttb-photos', fname));
  candidates.push(path.join(shared, 'uploads', 'fpb-pdfs', fname));
  candidates.push(path.join(shared, 'uploads', 'fpb-signed', fname));

  // Kandidat di tingkat domain Hostinger (di luar hbuilds)
  try {
    const domainDir = path.resolve(cwd, '../../../..');
    const domainShared = path.join(domainDir, 'shared_uploads');
    candidates.push(path.join(domainShared, cleanRel));
    candidates.push(path.join(domainShared, fname));
    candidates.push(path.join(domainShared, 'uploads', cleanRel));
    candidates.push(path.join(domainShared, 'uploads', fname));
    candidates.push(path.join(domainShared, 'ttb-documents', fname));
    candidates.push(path.join(domainShared, 'fstb-documents', fname));
    candidates.push(path.join(domainShared, 'sop-documents', fname));
    candidates.push(path.join(domainShared, 'ttb-photos', fname));
  } catch {}

  // Cari di seluruh versi Hostinger hbuilds/versions/*/nodejs/public/uploads
  try {
    const versionsDir = path.resolve(cwd, '../..');
    if (fs.existsSync(versionsDir) && path.basename(versionsDir) === 'versions') {
      const versions = fs.readdirSync(versionsDir);
      for (const v of versions) {
        const vBase = path.join(versionsDir, v, 'nodejs', 'public');
        candidates.push(path.join(vBase, 'uploads', cleanRel));
        candidates.push(path.join(vBase, 'uploads', fname));
        candidates.push(path.join(vBase, cleanRel));
        candidates.push(path.join(vBase, fname));
        candidates.push(path.join(vBase, 'ttb-documents', fname));
        candidates.push(path.join(vBase, 'fstb-documents', fname));
      }
    }
  } catch {}

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const stat = fs.statSync(c);
        if (stat.isFile() && stat.size > 0) {
          return c;
        }
      }
    } catch {}
  }

  return null;
}
