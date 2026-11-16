import path from 'path';
import os from 'os';
import { getPersistentStorageDir } from './persistentStorage';

/**
 * Folder foto dan berkas TTB di penyimpanan permanen Hostinger (kebal Git deploy).
 */
export const getPhotosDir = () => {
  if (process.env.TTB_PHOTOS_DIR) return process.env.TTB_PHOTOS_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'photos_TTB');
  }
  const shared = getPersistentStorageDir();
  return path.join(shared, 'ttb-photos');
};
