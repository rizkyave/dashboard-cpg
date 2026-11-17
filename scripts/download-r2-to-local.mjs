import fs from 'fs';
import path from 'path';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '1164fbfe900a7173f85acd083511fc09';
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'dc705658f38420b0f41790495e6c4e58';
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '63955875b6d48fb46280139856f2c5c5a975091e6851738335563c38fa74de23';
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'cpg-storage';

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
  console.log('Mengambil daftar seluruh berkas dari Cloudflare R2 bucket:', BUCKET_NAME);
  
  let continuationToken = undefined;
  let totalObjects = 0;
  const allKeys = [];

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      })
    );
    if (res.Contents) {
      for (const item of res.Contents) {
        if (item.Key) allKeys.push(item);
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  console.log(`Ditemukan ${allKeys.length} objek di Cloudflare R2.`);

  // Simpan ringkasan objek
  const categories = {};
  for (const item of allKeys) {
    const prefix = item.Key.split('/')[0] || 'root';
    categories[prefix] = (categories[prefix] || 0) + 1;
  }
  console.log('Kategori objek:', categories);

  // Download berkas-berkas penting: sop-documents, fstb-documents, ttb-documents, notifications-metadata, ttb-metadata, fpb-metadata, fpb-pdfs, fpb-signed
  const targetPrefixes = [
    'sop-documents',
    'fstb-documents',
    'ttb-documents',
    'ttb-photos',
    'ttb-metadata',
    'dashboard-metadata',
    'notifications-metadata',
    'settings',
    'fpb-metadata',
    'fpb-pdfs',
    'fpb-signed',
    'fpb-attachments',
  ];
  
  const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  let downloadedCount = 0;
  for (const item of allKeys) {
    const key = item.Key;
    const prefix = key.split('/')[0];
    
    // Tentukan path lokal
    const localDest = path.join(UPLOADS_DIR, key);
    const localDir = path.dirname(localDest);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    if (fs.existsSync(localDest) && fs.statSync(localDest).size > 0) {
      // Sudah ada, lewati
      continue;
    }

    try {
      const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const byteArray = await getRes.Body.transformToByteArray();
      fs.writeFileSync(localDest, Buffer.from(byteArray));
      downloadedCount++;
      if (downloadedCount % 10 === 0 || downloadedCount === allKeys.length) {
        console.log(`[Progress] Berhasil mengunduh ${downloadedCount} berkas...`);
      }
    } catch (err) {
      console.warn(`Gagal mengunduh ${key}:`, err.message);
    }
  }

  console.log(`✅ Selesai! Total ${downloadedCount} berkas baru berhasil diunduh ke public/uploads/`);
}

main().catch(console.error);
