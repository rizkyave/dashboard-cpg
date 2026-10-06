#!/usr/bin/env node
/**
 * Upload foto TTB dari folder lokal ke Vercel Blob (ukuran asli).
 *
 * Pemakaian:
 *   node scripts/upload-ttb-photos.mjs --dry-run        # cek saja, tidak upload
 *   node scripts/upload-ttb-photos.mjs --limit 1900     # upload maks 1900 foto (terbaru dulu)
 *   node scripts/upload-ttb-photos.mjs                  # upload semua yang belum terupload
 *
 * - Token dibaca dari env BLOB_READ_WRITE_TOKEN atau file .env.local
 * - Hasil disimpan ke src/data/ttb-photos-manifest.json  { "<nama file>": "<url blob>" }
 *   -> file ini di-commit & ikut deploy, jadi aplikasi tidak perlu memanggil list() (hemat kuota).
 * - Bisa dijalankan ulang kapan saja: foto yang sudah ada di manifest dilewati.
 */
import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';

const ROOT = process.cwd();
const PHOTOS_DIR = process.env.TTB_PHOTOS_DIR || path.join(ROOT, 'src', 'app', 'public', 'photos_TTB');
const MANIFEST = path.join(ROOT, 'src', 'data', 'ttb-photos-manifest.json');
const BLOB_PREFIX = 'ttb-photos/';
const CONCURRENCY = 5;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// --- token dari .env.local jika belum ada di env ---
if (!process.env.BLOB_READ_WRITE_TOKEN && fs.existsSync(path.join(ROOT, '.env.local'))) {
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*BLOB_READ_WRITE_TOKEN\s*=\s*"?([^"\s]+)"?/);
    if (m) process.env.BLOB_READ_WRITE_TOKEN = m[1];
  }
}
if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN tidak ditemukan. Isi di .env.local (lihat README langkah setup).');
  process.exit(1);
}

// --- regex sama dengan src/utils/ttbPhotoMatch.ts ---
const TTB_RE = /(?:([A-Z]{2,4})\s*-\s*)?(?<![A-Z])T?TB[\s\-_.]*((?:\d{2,6}[\s,&\-]*)+)/gi;
const hasTtb = (name) => {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  for (const m of base.matchAll(TTB_RE)) if ((m[2].match(/\b\d{5}\b/g) || []).length) return true;
  return false;
};
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const dateKey = (name) => {
  const m = name.match(/(\d{4}-\d{2}-\d{2}) at (\d{2}\.\d{2}\.\d{2})/);
  return m ? `${m[1]} ${m[2]}` : '0000';
};

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const saveManifest = () => {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1));
};

const all = fs.readdirSync(PHOTOS_DIR).filter((f) => MIME[path.extname(f).toLowerCase()] && hasTtb(f));
const pending = all
  .filter((f) => !manifest[f])
  .sort((a, b) => dateKey(b).localeCompare(dateKey(a))) // terbaru dulu
  .slice(0, LIMIT);
const pendingBytes = pending.reduce((s, f) => s + fs.statSync(path.join(PHOTOS_DIR, f)).size, 0);

console.log(`📁 Folder      : ${PHOTOS_DIR}`);
console.log(`🖼️  Foto ber-TTB: ${all.length}  |  sudah di Blob: ${all.length - all.filter((f) => !manifest[f]).length}`);
console.log(`⬆️  Akan upload : ${pending.length} foto (${(pendingBytes / 1024 / 1024).toFixed(0)} MB)`);
if (DRY_RUN || pending.length === 0) process.exit(0);

let done = 0, failed = 0;
const queue = [...pending];
const worker = async () => {
  while (queue.length) {
    const name = queue.shift();
    try {
      const body = fs.readFileSync(path.join(PHOTOS_DIR, name));
      const res = await put(BLOB_PREFIX + name, body, {
        access: 'public',
        contentType: MIME[path.extname(name).toLowerCase()],
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      });
      manifest[name] = res.url;
      done++;
      if (done % 25 === 0) saveManifest();
      process.stdout.write(`\r   ✅ ${done}/${pending.length}  ❌ ${failed}   `);
    } catch (err) {
      failed++;
      console.error(`\n   ❌ ${name}: ${err.message}`);
      if (/limit|quota|429|exceeded/i.test(err.message)) {
        console.error('\n⛔ Kuota Vercel Blob habis. Progres disimpan — jalankan lagi setelah kuota reset.');
        queue.length = 0;
      }
    }
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
saveManifest();
console.log(`\n\n🎉 Selesai. Berhasil ${done}, gagal ${failed}. Manifest: ${path.relative(ROOT, MANIFEST)}`);
console.log('   Commit file manifest lalu deploy ulang agar foto muncul di Vercel.');

