import path from 'path';
import os from 'os';

/**
 * Folder foto "database sementara" (server-side only).
 * Jika di Vercel/serverless (process.env.VERCEL atau AWS_LAMBDA), gunakan os.tmpdir() (/tmp/photos_TTB).
 * Jika di lokal/dev, gunakan src/app/public/photos_TTB.
 */
export const getPhotosDir = () => {
  if (process.env.TTB_PHOTOS_DIR) return process.env.TTB_PHOTOS_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'photos_TTB');
  }
  return path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB');
};
