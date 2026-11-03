import rawRbacMatrix from '@/data/rbac-matrix.json';
import { TabType } from './procurement';

export type UserRole =
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'staf_purchasing'
  | 'staf_ttb'
  | 'staf_lapangan'
  | 'end_user'
  | 'visitor'
  | 'user';

export interface DigitalSignatureInfo {
  signatureDataUrl: string; // Base64 data URL (PNG/SVG)
  uploadedAt: string;
  verifiedBy: string; // Username admin yang mengotentifikasi
  verifiedByName?: string; // Nama lengkap admin verifikator
  certificateId: string; // Kode otentifikasi unik misal CPG-AUTH-2026-XXXX
  signeeTitle?: string; // Jabatan resmi penandatangan
  notes?: string;
  status: 'verified' | 'pending' | 'revoked';
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  nik?: string;
  jabatan?: string;
  department?: string;
  email?: string;
  avatar?: string;
  lastLogin?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  signature?: DigitalSignatureInfo;
}

export interface UserAccount extends AuthUser {
  password?: string;
  createdAt?: string;
}

export type ModuleCategory = 'Dashboards' | 'Modul Tambahan' | 'Modul Khusus';

export type AccessLevel =
  | 'Full Access'
  | 'Upload & Kelola'
  | 'Input & Upload'
  | 'View & Verifikasi'
  | 'Validasi & TTD'
  | 'Update Status'
  | 'Read-only'
  | 'Dilarang';

export const ALL_ACCESS_LEVELS: AccessLevel[] = [
  'Full Access',
  'Validasi & TTD',
  'Upload & Kelola',
  'Input & Upload',
  'View & Verifikasi',
  'Update Status',
  'Read-only',
  'Dilarang',
];

export function getToneForAccessLevel(level: AccessLevel): RolePermissionRule['badgeTone'] {
  switch (level) {
    case 'Full Access':
      return 'purple';
    case 'Validasi & TTD':
    case 'Upload & Kelola':
    case 'Input & Upload':
      return 'emerald';
    case 'View & Verifikasi':
      return 'blue';
    case 'Update Status':
      return 'sky';
    case 'Read-only':
      return 'slate';
    case 'Dilarang':
    default:
      return 'rose';
  }
}

export function isAccessLevelAllowed(level: AccessLevel): boolean {
  return level !== 'Dilarang';
}

export interface RolePermissionRule {
  allowed: boolean;
  level: AccessLevel;
  badgeTone: 'purple' | 'emerald' | 'blue' | 'sky' | 'amber' | 'slate' | 'rose';
  notes?: string;
}

export interface ModulePermissionItem {
  tabId: TabType;
  category: ModuleCategory;
  name: string;
  description: string;
  permissions: {
    admin: RolePermissionRule;
    manager: RolePermissionRule;
    supervisor: RolePermissionRule;
    staf_purchasing: RolePermissionRule;
    staf_ttb: RolePermissionRule;
    staf_lapangan: RolePermissionRule;
    end_user: RolePermissionRule;
    visitor: RolePermissionRule;
  };
}

export const MODULE_PERMISSIONS_MATRIX: ModulePermissionItem[] = rawRbacMatrix as unknown as ModulePermissionItem[];

export const RBAC_MATRIX_STORAGE_KEY = 'CPG_AUTH_RBAC_MATRIX_V8';

/**
 * Membaca matriks perizinan dinamis dari localStorage (fallback ke default matrix)
 */
export function getStoredPermissionsMatrix(): ModulePermissionItem[] {
  if (typeof window === 'undefined') {
    return MODULE_PERMISSIONS_MATRIX;
  }
  try {
    // Bersihkan cache usang versi lama agar update hak akses langsung aktif
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX');
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX_V2');
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX_V3');
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX_V4');
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX_V5');
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX_V6');
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX_V7');

    const raw = localStorage.getItem(RBAC_MATRIX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca RBAC Matrix dari localStorage:', err);
  }
  return MODULE_PERMISSIONS_MATRIX;
}

/**
 * Menyimpan perubahan matriks perizinan ke localStorage dan mentrigger pembaruan real-time
 */
export function saveStoredPermissionsMatrix(matrix: ModulePermissionItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RBAC_MATRIX_STORAGE_KEY, JSON.stringify(matrix));
    window.dispatchEvent(new Event('cpg-rbac-updated'));

    // Broadcast ke tab-tab lain yang sedang terbuka
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('cpg_auth_channel');
        bc.postMessage({ type: 'RBAC_UPDATED', timestamp: Date.now() });
        bc.close();
      }
    } catch {
      // Non-fatal
    }

    // Simpan permanen ke server cloud
    fetch('/api/rbac-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix }),
    }).catch((err) => {
      console.warn('Gagal menyimpan RBAC Matrix ke server cloud:', err);
    });
  } catch (err) {
    console.error('Gagal menyimpan RBAC Matrix ke localStorage:', err);
  }
}

/**
 * Sinkronisasi matriks perizinan dari cloud server ke localStorage
 */
export async function syncPermissionsMatrixFromCloud(): Promise<ModulePermissionItem[]> {
  if (typeof window === 'undefined') return MODULE_PERMISSIONS_MATRIX;
  try {
    const res = await fetch('/api/rbac-matrix?_t=' + Date.now(), {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.matrix) && json.matrix.length > 0) {
        localStorage.setItem(RBAC_MATRIX_STORAGE_KEY, JSON.stringify(json.matrix));
        window.dispatchEvent(new Event('cpg-rbac-updated'));
        return json.matrix;
      }
    }
  } catch (err) {
    console.warn('Gagal sinkronisasi RBAC Matrix dari server:', err);
  }
  return getStoredPermissionsMatrix();
}

/**
 * Mengembalikan matriks perizinan ke setelan default sistem
 */
export function resetStoredPermissionsMatrix(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RBAC_MATRIX_STORAGE_KEY);
    localStorage.removeItem('CPG_AUTH_RBAC_MATRIX');
    window.dispatchEvent(new Event('cpg-rbac-updated'));

    // Broadcast ke tab-tab lain
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('cpg_auth_channel');
        bc.postMessage({ type: 'RBAC_UPDATED', timestamp: Date.now() });
        bc.close();
      }
    } catch {
      // Non-fatal
    }

    // Reset di cloud server
    fetch('/api/rbac-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    }).catch((err) => {
      console.warn('Gagal reset RBAC Matrix di server cloud:', err);
    });
  } catch (err) {
    console.error('Gagal reset RBAC Matrix di localStorage:', err);
  }
}

/**
 * Helper RBAC: Menentukan apakah sebuah role memiliki izin mengakses tab/modul tertentu.
 */
export function canAccessTab(role: UserRole | undefined, tab: TabType): boolean {
  if (!role || role === 'admin') return true;
  if (tab === 'admin-settings') return false;

  // 1. Cek perizinan dinamis dari matriks yang dikonfigurasi & disimpan oleh Admin
  if (typeof window !== 'undefined') {
    try {
      const matrix = getStoredPermissionsMatrix();
      const moduleItem = matrix.find((m) => m.tabId === tab);
      if (moduleItem && role in moduleItem.permissions) {
        const rule = (moduleItem.permissions as any)[role] as RolePermissionRule | undefined;
        if (rule) {
          return rule.allowed;
        }
      }
    } catch {
      // Fallback ke logika statis bila terjadi kendala
    }
  }

  // 2. Default sistem saat ini: Seluruh akses dilarang untuk semua role (kecuali admin)
  return false;
}

/**
 * Helper RBAC: Menentukan tab default / landing page utama untuk tiap role pengguna
 */
export function getDefaultTabForRole(role: UserRole | undefined): TabType {
  let preferred: TabType = 'overview';
  if (role === 'staf_lapangan') preferred = 'serah-terima-lapangan';
  else if (role === 'end_user') preferred = 'serah-terima-lapangan';
  else if (role === 'staf_ttb') preferred = 'upload-ttb';
  else if (role === 'staf_purchasing') preferred = 'procurement';

  if (canAccessTab(role, preferred)) {
    return preferred;
  }

  const candidates: TabType[] = [
    'upload-ttb',
    'monitoring-internal',
    'validasi-dokumen',
    'serah-terima-lapangan',
    'galeri-ttb',
    'procurement',
    'overview',
    'review-fpb',
    'pratender',
    'upload-fstb',
    'inventory',
    'stok-gudang',
    'armada',
    'pos-kapal',
    'crew-kapal',
    'work-order',
    'list-sm',
    'sisa-layanan',
  ];
  const firstAllowed = candidates.find((t) => canAccessTab(role, t));
  return firstAllowed || preferred;
}

/**
 * Helper RBAC: Nama tampilan peran user
 */
export function getRoleDisplayName(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'manager':
      return 'Manager Procurement';
    case 'supervisor':
      return 'Supervisor Procurement';
    case 'staf_purchasing':
      return 'Staf Purchasing';
    case 'staf_ttb':
      return 'Staf Dokumen TTB';
    case 'staf_lapangan':
      return 'Staf Serah Terima Lapangan';
    case 'end_user':
      return 'End User / Penerima Barang';
    case 'visitor':
      return 'Visitor (Tamu)';
    case 'user':
    default:
      return 'Staff User (Operasional)';
  }
}

/**
 * Backward compatibility legacy permission array
 */
export interface PermissionItem {
  action: string;
  description: string;
  admin: boolean;
  user: boolean;
  visitor: boolean;
}

export const ROLE_PERMISSIONS: PermissionItem[] = [
  {
    action: 'Dashboard Overview & FPB',
    description: 'Melihat ringkasan pipeline pengadaan, status No FPB, dan alur PIC',
    admin: true,
    user: true,
    visitor: true,
  },
  {
    action: 'Rincian Item Barang (PDF e-FPB)',
    description: 'Melihat rincian daftar item barang & tarik ulang data PDF e-FPB',
    admin: true,
    user: true,
    visitor: true,
  },
  {
    action: 'Analisis Risiko & SLA',
    description: 'Memeriksa peringatan bottleneck & analisis risiko pengadaan berkas',
    admin: true,
    user: true,
    visitor: false,
  },
  {
    action: 'Cek Stok Gudang (Accurate)',
    description: 'Memeriksa data ketersediaan persediaan barang di gudang Accurate',
    admin: true,
    user: true,
    visitor: false,
  },
  {
    action: 'Validasi Lintas Modul & TimeMark',
    description: 'Pengecekan bukti foto TimeMark dan validasi modul internal',
    admin: true,
    user: true,
    visitor: false,
  },
  {
    action: 'Eskalasi PIC via WhatsApp',
    description: 'Melakukan eskalasi langsung pengingat berkas ke kontak PIC',
    admin: true,
    user: true,
    visitor: false,
  },
  {
    action: 'Posisi Kapal & Monitoring Armada',
    description: 'Memantau peta pergerakan real-time armada kapal laut',
    admin: true,
    user: true,
    visitor: false,
  },
  {
    action: 'Admin Settings & Manajemen Akun',
    description: 'Menambah, mengubah, mengatur status, dan menghapus pengguna/visitor',
    admin: true,
    user: false,
    visitor: false,
  },
];
