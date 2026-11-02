import { UserAccount } from '@/types/auth';
import usersDataJson from './users-data.json';

/**
 * Master daftar akun pengguna default terverifikasi sistem CPG.
 * Mengambil data otoritatif dari users-data.json yang memuat NIK, jabatan,
 * role otoritas, serta spesimen tanda tangan digital resmi.
 */
export const DEFAULT_USERS: UserAccount[] = usersDataJson as unknown as UserAccount[];
