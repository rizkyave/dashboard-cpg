#!/usr/bin/env node
/**
 * Upload foto TTB dari folder lokal ke Cloudflare R2 (S3-compatible).
 *
 * Pemakaian:
 *   node scripts/upload-ttb-photos.mjs --dry-run        # cek saja, tidak upload
 *   node scripts/upload-ttb-photos.mjs --limit 100      # upload maks 100 foto (terbaru dulu)
 *   node scripts/upload-ttb-photos.mjs                  # upload semua yang belum terupload
 *
 * Konfigurasi di .env.local atau environment variable:
 *   CLOUDFLARE_R2_ACCOUNT_ID=...
 *   CLOUDFLARE_R2_ACCESS_KEY_ID=...
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
 *   CLOUDFLARE_R2_BUCKET_NAME=...
 *   CLOUDFLARE_R2_PUBLIC_URL=... (opsional, cth: https://pub-xxx.r2.dev)
 */
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT = process.cwd();
const PHOTOS_DIR = process.env.TTB_PHOTOS_DIR || path.join(ROOT, 'src', 'app', 'public', 'photos_TTB');
const MANIFEST = path.join(ROOT, 'src', 'data', 'ttb-photos-manifest.json');
const R2_PREFIX = 'ttb-photos/';
const CONCURRENCY = 5;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// --- Baca variabel dari .env.local atau .env jika ada ---
const loadEnvFile = (filename) => {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'cpg-storage';
const PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

if (!DRY_RUN && (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY)) {
  console.error('❌ Kredensial Cloudflare R2 belum lengkap.');
  console.error('   Silakan isi di .env.local:');
  console.error('   CLOUDFLARE_R2_ACCOUNT_ID=<Cloudflare Account ID>');
  console.error('   CLOUDFLARE_R2_ACCESS_KEY_ID=<R2 Access Key>');
  console.error('   CLOUDFLARE_R2_SECRET_ACCESS_KEY=<R2 Secret Key>');
  console.error('   CLOUDFLARE_R2_BUCKET_NAME=<Nama Bucket>');
  console.error('   CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev (opsional)');
  process.exit(1);
}

const s3Client = !DRY_RUN
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    })
  : null;

// --- Regex pencocokan nomor TTB ---
const TTB_RE = /(?:([A-Z]{2,4})\s*-\s*)?(?<![A-Z])T?TB[\s\-_.]*((?:\d{2,6}[\s,&\-]*)+)/gi;
const hasTtb = (name) => {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  for (const m of base.matchAll(TTB_RE)) {
    if ((m[2].match(/\b\d{5}\b/g) || []).length) return true;
  }
  return false;
};

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

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

if (!fs.existsSync(PHOTOS_DIR)) {
  console.error(`❌ Folder foto tidak ditemukan: ${PHOTOS_DIR}`);
  process.exit(1);
}

const all = fs.readdirSync(PHOTOS_DIR).filter((f) => MIME[path.extname(f).toLowerCase()] && hasTtb(f));

// Foto yang belum di-upload ke R2 (atau masih berupa vercel blob lama)
const isUploadedToR2 = (url) => Boolean(url && !url.includes('vercel-storage.com'));

const pending = all
  .filter((f) => !isUploadedToR2(manifest[f]))
  .sort((a, b) => dateKey(b).localeCompare(dateKey(a)))
  .slice(0, LIMIT);

const pendingBytes = pending.reduce((s, f) => s + fs.statSync(path.join(PHOTOS_DIR, f)).size, 0);

console.log(`📁 Folder Sumber: ${PHOTOS_DIR}`);
console.log(`📦 Cloudflare R2: Bucket "${BUCKET_NAME}" (Endpoint: ${ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : 'Belum diatur'})`);
console.log(`🖼️  Total Foto  : ${all.length} | Sudah di R2: ${all.length - pending.length}`);
console.log(`⬆️  Akan Upload : ${pending.length} foto (${(pendingBytes / 1024 / 1024).toFixed(0)} MB)`);

if (DRY_RUN || pending.length === 0) {
  if (DRY_RUN) console.log('\n[Dry Run Selesai] Tidak ada data yang diunggah.');
  process.exit(0);
}

let done = 0;
let failed = 0;
const queue = [...pending];

const worker = async () => {
  while (queue.length) {
    const name = queue.shift();
    if (!name) break;

    try {
      const filePath = path.join(PHOTOS_DIR, name);
      const body = fs.readFileSync(filePath);
      const ext = path.extname(name).toLowerCase();
      const contentType = MIME[ext] || 'image/jpeg';
      const key = `${R2_PREFIX}${name}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      });

      await s3Client.send(command);

      const r2Url = PUBLIC_URL
        ? `${PUBLIC_URL}/${encodeURI(key)}`
        : `/api/r2-file?key=${encodeURIComponent(key)}`;

      manifest[name] = r2Url;
      done++;

      if (done % 20 === 0) {
        saveManifest();
      }

      process.stdout.write(`\r   ✅ Upload R2: ${done}/${pending.length}  ❌ Gagal: ${failed}   `);
    } catch (err) {
      failed++;
      console.error(`\n   ❌ Gagal upload ${name}: ${err.message}`);
    }
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
saveManifest();

console.log(`\n\n🎉 Selesai. Berhasil diunggah ke Cloudflare R2: ${done}, Gagal: ${failed}.`);
console.log(`   File manifest diperbarui: ${path.relative(ROOT, MANIFEST)}`);
