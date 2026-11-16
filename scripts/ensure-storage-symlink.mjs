import fs from 'fs';
import path from 'path';

/**
 * Script ini berjalan saat build / deploy di Hostinger.
 * Tujuannya adalah menghubungkan public/uploads ke direktori permanen hbuilds/shared_uploads
 * sehingga berkas tidak pernah hilang walaupun ada Git Deploy baru.
 */
function setupPersistentStorage() {
  const cwd = process.cwd();
  
  try {
    const hbuildsDir = path.resolve(cwd, '../../..');
    const isHostinger = fs.existsSync(hbuildsDir) && path.basename(hbuildsDir) === 'hbuilds';
    
    if (!isHostinger) {
      // Di laptop / lokal dev: pastikan public/uploads ada
      const localUploads = path.join(cwd, 'public', 'uploads');
      if (!fs.existsSync(localUploads)) {
        fs.mkdirSync(localUploads, { recursive: true });
      }
      return;
    }

    const sharedUploads = path.resolve(hbuildsDir, 'shared_uploads');
    if (!fs.existsSync(sharedUploads)) {
      fs.mkdirSync(sharedUploads, { recursive: true });
      console.log(`[Storage] Membuat direktori permanen: ${sharedUploads}`);
    }

    // Normalisasi file yang terekstrak dengan backslash Windows (misal: "dashboard-metadata\armada-data.json")
    try {
      function normalizeBackslashes(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            normalizeBackslashes(fullPath);
          } else if (entry.name.includes('\\')) {
            const parts = entry.name.split('\\');
            const targetDir = path.join(dir, ...parts.slice(0, -1));
            const targetFile = path.join(dir, ...parts);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            try {
              fs.renameSync(fullPath, targetFile);
              console.log(`[Storage] Berhasil merapikan: ${entry.name} -> ${parts.join('/')}`);
            } catch {}
          }
        }
      }
      normalizeBackslashes(sharedUploads);
    } catch (normErr) {
      console.warn(`[Storage] Normalisasi backslash: ${normErr.message}`);
    }

    const localUploads = path.join(cwd, 'public', 'uploads');

    // Jika public/uploads belum ada, buat symlink ke shared_uploads
    if (!fs.existsSync(localUploads)) {
      try {
        fs.symlinkSync(sharedUploads, localUploads, 'junction');
        console.log(`[Storage] Berhasil menghubungkan symlink: ${localUploads} -> ${sharedUploads}`);
      } catch (err) {
        console.warn(`[Storage] Gagal membuat symlink, membuat folder lokal: ${err.message}`);
        fs.mkdirSync(localUploads, { recursive: true });
      }
    }
  } catch (err) {
    console.warn(`[Storage] Warning: ${err.message}`);
  }
}

setupPersistentStorage();
