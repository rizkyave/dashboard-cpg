import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Konfigurasi Cloudflare R2 Storage (S3-Compatible Object Storage)
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
  endpoint: string;
  isConfigured: boolean;
}

export function getR2Config(): R2Config {
  const accountId =
    process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
    process.env.R2_ACCOUNT_ID ||
    '';

  const accessKeyId =
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.R2_ACCESS_KEY_ID ||
    '';

  const secretAccessKey =
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    '';

  const bucketName =
    process.env.CLOUDFLARE_R2_BUCKET_NAME ||
    process.env.R2_BUCKET_NAME ||
    'cpg-storage';

  const publicUrl =
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    '';

  const endpoint = accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : '';

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: publicUrl ? publicUrl.replace(/\/+$/, '') : undefined,
    endpoint,
    isConfigured,
  };
}

export function isR2Configured(): boolean {
  return getR2Config().isConfigured;
}

let cachedClient: S3Client | null = null;
let lastEndpoint = '';

export function getR2Client(): S3Client {
  const config = getR2Config();
  if (!config.isConfigured) {
    throw new Error(
      'Cloudflare R2 belum dikonfigurasi. Pastikan CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, dan CLOUDFLARE_R2_BUCKET_NAME telah diisi di environment variable.'
    );
  }

  if (!cachedClient || lastEndpoint !== config.endpoint) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Cloudflare R2 requires path-style or virtual-hosted depending on endpoint,
      // forcePathStyle: true works reliably with S3-compatible endpoints
      forcePathStyle: true,
    });
    lastEndpoint = config.endpoint;
  }

  return cachedClient;
}

/**
 * Menghasilkan URL publik untuk file di Cloudflare R2
 * - Menggunakan custom public domain R2 (cth: https://pub-xxx.r2.dev atau domain kustom) jika diatur
 * - Menggunakan rute proxy streaming internal (/api/r2-file?key=...) jika R2 public dev domain belum diaktifkan
 */
export function getR2FileUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, '');
  const config = getR2Config();

  if (config.publicUrl) {
    return `${config.publicUrl}/${encodeURI(cleanKey)}`;
  }

  return `/api/r2-file?key=${encodeURIComponent(cleanKey)}`;
}

export interface UploadR2Params {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface UploadR2Result {
  success: boolean;
  key: string;
  url: string;
  bucket: string;
  eTag?: string;
}

/**
 * Upload berkas ke Cloudflare R2 Bucket
 */
export async function uploadToR2({
  key,
  body,
  contentType,
  metadata = {},
  cacheControl = 'public, max-age=31536000, immutable',
}: UploadR2Params): Promise<UploadR2Result> {
  const config = getR2Config();
  const client = getR2Client();
  const cleanKey = key.replace(/^\/+/, '');

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: cleanKey,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
    Metadata: metadata,
  });

  const response = await client.send(command);

  return {
    success: true,
    key: cleanKey,
    url: getR2FileUrl(cleanKey),
    bucket: config.bucketName,
    eTag: response.ETag,
  };
}

/**
 * Mengambil isi berkas dari Cloudflare R2
 */
export async function getObjectFromR2(key: string): Promise<{
  body: Uint8Array;
  contentType: string;
  contentLength?: number;
  eTag?: string;
  lastModified?: Date;
} | null> {
  try {
    const config = getR2Config();
    const client = getR2Client();
    const cleanKey = key.replace(/^\/+/, '');

    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: cleanKey,
    });

    const res = await client.send(command);
    if (!res.Body) return null;

    const byteArray = await res.Body.transformToByteArray();

    return {
      body: byteArray,
      contentType: res.ContentType || 'application/octet-stream',
      contentLength: res.ContentLength,
      eTag: res.ETag,
      lastModified: res.LastModified,
    };
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Menghasilkan Presigned URL untuk akses unduh/lihat aman sementara
 */
export async function getR2PresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const config = getR2Config();
  const client = getR2Client();
  const cleanKey = key.replace(/^\/+/, '');

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: cleanKey,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Daftar objek yang ada di bucket Cloudflare R2
 */
export async function listR2Objects(
  prefix = '',
  limit = 1000
): Promise<
  Array<{
    key: string;
    name: string;
    size: number;
    lastModified?: Date;
    url: string;
  }>
> {
  try {
    const config = getR2Config();
    const client = getR2Client();

    const command = new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: prefix ? prefix.replace(/^\/+/, '') : undefined,
      MaxKeys: limit,
    });

    const res = await client.send(command);
    if (!res.Contents) return [];

    return res.Contents.filter((it) => Boolean(it.Key)).map((it) => {
      const key = it.Key!;
      const name = key.includes('/') ? key.split('/').pop() || key : key;
      return {
        key,
        name,
        size: it.Size || 0,
        lastModified: it.LastModified,
        url: getR2FileUrl(key),
      };
    });
  } catch (err) {
    console.warn('Gagal membaca objek Cloudflare R2:', err);
    return [];
  }
}

/**
 * Menghapus objek dari Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const config = getR2Config();
    const client = getR2Client();
    const cleanKey = key.replace(/^\/+/, '');

    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: cleanKey,
    });

    await client.send(command);
    return true;
  } catch (err) {
    console.warn('Gagal menghapus file dari R2:', err);
    return false;
  }
}

/**
 * Mengambil metadata objek dari Cloudflare R2
 */
export async function getHeadObjectFromR2(key: string): Promise<{
  metadata: Record<string, string>;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
} | null> {
  try {
    const config = getR2Config();
    const client = getR2Client();
    const cleanKey = key.replace(/^\/+/, '');

    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: cleanKey,
    });

    const res = await client.send(command);
    return {
      metadata: res.Metadata || {},
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      lastModified: res.LastModified,
    };
  } catch {
    return null;
  }
}

