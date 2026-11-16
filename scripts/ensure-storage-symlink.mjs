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
