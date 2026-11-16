import path from 'path';
import os from 'os';
import { getPersistentStorageDir } from './persistentStorage';

/**
 * Folder berkas FSTB di penyimpanan permanen Hostinger (kebal Git deploy).
 */
export const getFstbPhotosDir = () => {
  if (process.env.FSTB_PHOTOS_DIR) return process.env.FSTB_PHOTOS_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'photos_FSTB');
  }
  const shared = getPersistentStorageDir();
  return path.join(shared, 'fstb-documents');
};

