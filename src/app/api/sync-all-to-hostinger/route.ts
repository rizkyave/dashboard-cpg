import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { listR2Objects, getObjectFromR2, isR2Configured } from '@/utils/r2Client';
import { getPersistentStorageDir } from '@/utils/persistentStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 menit

export async function GET(req: NextRequest) {
  const targetDir = getPersistentStorageDir();
  const results = {
    targetDir,
    totalR2Objects: 0,
    downloadedCount: 0,
    alreadyExistCount: 0,
    errors: [] as string[],
    durationSeconds: 0,
  };

  const startTime = Date.now();

  try {
    // 1. Ambil seluruh daftar berkas di Cloudflare R2
    const allObjects = await listR2Objects('', 2000);
    results.totalR2Objects = allObjects.length;

    // 1.5 Auto-repair: Rapikan file yang terlanjur tersimpan dengan backslash di Linux
    try {
      const fixBackslashFiles = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            fixBackslashFiles(fullPath);
          } else if (entry.name.includes('\\')) {
            const parts = entry.name.split('\\').filter(Boolean);
            const targetDir = path.join(dir, ...parts.slice(0, -1));
            const targetFile = path.join(dir, ...parts);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            try {
              fs.renameSync(fullPath, targetFile);
            } catch {}
          }
        }
      };
      fixBackslashFiles(targetDir);
    } catch {}

    // 2. Download setiap berkas ke persistent storage
    for (const obj of allObjects) {
      const rawKey = obj.key;
      // Jangan simpan file kosong atau direktori semu
      if (!rawKey || rawKey.endsWith('/') || rawKey.endsWith('\\')) continue;

      const cleanKey = rawKey.replace(/\\/g, '/');
      const keyParts = cleanKey.split('/').filter(Boolean);
      const targetPath = path.join(targetDir, ...keyParts);

      // Jika berkas sudah ada dan ukurannya sama, lewati
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.size > 0 && stat.size === obj.size) {
          results.alreadyExistCount++;
          continue;
        }
      }

      try {
        const r2File = await getObjectFromR2(rawKey);
        if (r2File && r2File.body) {
          await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.promises.writeFile(targetPath, Buffer.from(r2File.body));
          results.downloadedCount++;
        }
      } catch (err: any) {
        results.errors.push(`${rawKey}: ${err.message}`);
      }
    }

    // 3. Hubungkan symlink public/uploads -> targetDir jika berbeda
    const localPublicUploads = path.join(process.cwd(), 'public', 'uploads');
    if (localPublicUploads !== targetDir && !fs.existsSync(localPublicUploads)) {
      try {
        fs.symlinkSync(targetDir, localPublicUploads, 'junction');
      } catch {}
    }
  } catch (e: any) {
    results.errors.push(`General error: ${e.message}`);
  }

  results.durationSeconds = Math.round((Date.now() - startTime) / 1000);
  return NextResponse.json(results);
}
