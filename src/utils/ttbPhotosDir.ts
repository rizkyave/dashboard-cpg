import path from 'path';

/**
 * Folder foto "database sementara" (server-side only).
 * Default: src/app/public/photos_TTB — bisa diganti lewat env TTB_PHOTOS_DIR.
 */
export const getPhotosDir = () =>
  process.env.TTB_PHOTOS_DIR || path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB');

