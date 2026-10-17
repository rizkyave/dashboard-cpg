#!/usr/bin/env node
/**
 * Migrasikan seluruh foto TTB dari URL CDN lama (Vercel Blob) langsung ke Cloudflare R2.
 *
 * Pemakaian:
 *   node scripts/migrate-blob-to-r2.mjs --dry-run
 *   node scripts/migrate-blob-to-r2.mjs --limit 100
 *   node scripts/migrate-blob-to-r2.mjs
 */
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'src', 'data', 'ttb-photos-manifest.json');
const CONCURRENCY = 15;

// Load env files
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

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('❌ Kredensial Cloudflare R2 belum lengkap di .env.local');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Manifest file tidak ditemukan:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const entries = Object.entries(manifest);
  console.log(`📦 Total foto di manifest: ${entries.length}`);

  // Filter foto yang belum tersimpan di R2 (URL masih vercel-storage atau blob)
  const toMigrate = entries.filter(([fileName, url]) => {
    return typeof url === 'string' && url.includes('vercel-storage.com');
  });

  console.log(`🔍 Ditemukan ${toMigrate.length} foto yang perlu disalin dari Vercel Blob ke Cloudflare R2.`);

  if (toMigrate.length === 0) {
    console.log('✅ Seluruh foto sudah termigrasi ke Cloudflare R2!');
    return;
  }

  const targetItems = toMigrate.slice(0, LIMIT);
  console.log(`🚀 Memproses ${targetItems.length} foto (Concurrency: ${CONCURRENCY})...`);

  if (DRY_RUN) {
    console.log('[Dry Run] Mode simulasi selesai, tidak ada berkas yang diunggah.');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let running = 0;
  let currentIndex = 0;

  const getMime = (name) => {
    const ext = path.extname(name).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
  };

  const processItem = async ([fileName, sourceUrl]) => {
    const r2Key = `ttb-photos/${fileName}`;
    try {
      // 1. Download dari sumber lama
      const res = await fetch(sourceUrl);
      if (!res.ok) {
        throw new Error(`Fetch status ${res.status}: ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. Upload ke Cloudflare R2
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: res.headers.get('content-type') || getMime(fileName),
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      // 3. Update manifest
      const newUrl = PUBLIC_URL
        ? `${PUBLIC_URL}/${encodeURI(r2Key)}`
        : `/api/r2-file?key=${encodeURIComponent(r2Key)}`;
      manifest[fileName] = newUrl;

      successCount++;
    } catch (err) {
      failCount++;
      console.warn(`\n⚠️ Gagal migrasi [${fileName}]: ${err.message}`);
    } finally {
      process.stdout.write(
        `\r⏳ Progress: ${successCount + failCount}/${targetItems.length} | Sukses: ${successCount} | Gagal: ${failCount}`
      );
    }
  };

  await new Promise((resolve) => {
    const next = () => {
      if (currentIndex >= targetItems.length && running === 0) {
        return resolve();
      }
      while (running < CONCURRENCY && currentIndex < targetItems.length) {
        const item = targetItems[currentIndex++];
        running++;
        processItem(item).finally(() => {
          running--;
          next();
        });
      }
    };
    next();
  });

  console.log('\n\n💾 Menyimpan manifest yang telah diperbarui...');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1), 'utf8');
  console.log(`🎉 Migrasi Selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
