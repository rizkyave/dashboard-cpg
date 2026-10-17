import path from 'path';
import os from 'os';

/**
 * Folder berkas FSTB "database sementara" (server-side only).
 * Jika di Vercel/serverless, gunakan os.tmpdir() (/tmp/photos_FSTB).
 * Jika di lokal/dev, gunakan src/app/public/photos_FSTB.
 */
export const getFstbPhotosDir = () => {
  if (process.env.FSTB_PHOTOS_DIR) return process.env.FSTB_PHOTOS_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'photos_FSTB');
  }
  return path.join(process.cwd(), 'src', 'app', 'public', 'photos_FSTB');
};
