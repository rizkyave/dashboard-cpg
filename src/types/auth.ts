import { TabType } from './procurement';

export type UserRole = 'admin' | 'staf_ttb' | 'staf_lapangan' | 'visitor' | 'user';

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
  | 'Update Status'
  | 'Read-only'
  | 'Dilarang';

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
    staf_ttb: RolePermissionRule;
    staf_lapangan: RolePermissionRule;
    visitor: RolePermissionRule;
  };
}

export const MODULE_PERMISSIONS_MATRIX: ModulePermissionItem[] = [
  // ==========================================
  // KATEGORI 1: DASHBOARDS
  // ==========================================
  {
    tabId: 'overview',
    category: 'Dashboards',
    name: 'Overview',
    description: 'Ringkasan visual KPI monitoring procurement, pipeline lead time, dan status pengadaan',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      staf_lapangan: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      visitor: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
    },
  },
  {
    tabId: 'procurement',
    category: 'Dashboards',
    name: 'Procurement',
    description: 'Monitoring alur berkas FPB-PO, SLA lead time, verifikasi barang sisa layanan',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'View & Verifikasi', badgeTone: 'blue', notes: 'View & verifikasi kecocokan dokumen PO/FPB' },
      staf_lapangan: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'armada',
    category: 'Dashboards',
    name: 'Layanan Armada',
    description: 'Monitoring layanan armada kapal, status FSTB, dan log servis operasional',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Input & Upload', badgeTone: 'emerald', notes: 'Input update operasional & servis armada' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'upload-fstb',
    category: 'Dashboards',
    name: 'Upload FSTB',
    description: 'Upload berkas FSTB resmi ke Cloudflare R2 / Drive dengan penamaan otomatis no. FSTB',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'Upload & Kelola', badgeTone: 'emerald', notes: 'Full access upload berkas FSTB ke cloud' },
      staf_lapangan: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'upload-ttb',
    category: 'Dashboards',
    name: 'Upload TTB',
    description: 'Upload berkas TTB resmi ke Cloudflare R2 / Drive dengan penamaan otomatis no. TTB',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'Upload & Kelola', badgeTone: 'emerald', notes: 'Full access upload berkas ke cloud' },
      staf_lapangan: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'serah-terima-lapangan',
    category: 'Dashboards',
    name: 'Serah Terima Lap.',
    description: 'Portal input data serah terima barang di lapangan/dermaga berbasis referensi TTB',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Full Access', badgeTone: 'emerald', notes: 'Input data fisik & upload bukti serah terima' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'galeri-ttb',
    category: 'Dashboards',
    name: 'Galeri Foto TTB',
    description: 'Katalog arsip foto serah terima TTB dari lapangan dan pencarian dokumen',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'Upload & Kelola', badgeTone: 'emerald', notes: 'Upload, view, dan kelola arsip foto TTB' },
      staf_lapangan: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      visitor: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
    },
  },
  {
    tabId: 'timemark',
    category: 'Dashboards',
    name: 'Foto TimeMark',
    description: 'Dokumentasi foto berstempel waktu (5 Digit No. Lambung) pembongkaran muatan',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Input & Upload', badgeTone: 'emerald', notes: 'Upload bukti foto timestamp pangkalan' },
      visitor: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
    },
  },

  // ==========================================
  // KATEGORI 2: MODUL TAMBAHAN
  // ==========================================
  {
    tabId: 'inventory',
    category: 'Modul Tambahan',
    name: 'Cek Persediaan',
    description: 'Pengecekan fisik stok gudang dan katalog persediaan konsolidasi Accurate CPG',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'Read-only', badgeTone: 'slate', notes: 'Read-only untuk validasi fisik stok' },
      staf_lapangan: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'pos-kapal',
    category: 'Modul Tambahan',
    name: 'Posisi Kapal',
    description: 'Monitoring posisi koordinat harian kapal FMS dan status operasional laut',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Update Status', badgeTone: 'sky', notes: 'Update status pekerjaan lapangan' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'crew-kapal',
    category: 'Modul Tambahan',
    name: 'Crew & Armada',
    description: 'Database 60 kapal & 633 kru kapal aktif CPG, kontak nahkoda, & alokasi armada',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Read-only', badgeTone: 'slate', notes: 'Akses kontak nahkoda / kru' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'work-order',
    category: 'Modul Tambahan',
    name: 'List WO',
    description: 'Monitoring surat perintah kerja (WO) lapangan & log tindak lanjut perbaikan',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Update Status', badgeTone: 'sky', notes: 'Update status pekerjaan lapangan' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'list-sm',
    category: 'Modul Tambahan',
    name: 'List SM',
    description: 'Monitoring Service & Maintenance armada pada bengkel vendor rekanan',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: true, level: 'Update Status', badgeTone: 'sky', notes: 'Pantau & update servis kapal' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'sisa-layanan',
    category: 'Modul Tambahan',
    name: 'Sisa Layanan',
    description: 'Laporan rekonsiliasi sisa layanan gabungan FPB-PO-FSTB-TTB seluruh unit',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      staf_lapangan: { allowed: true, level: 'Read-only', badgeTone: 'slate' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },

  // ==========================================
  // KATEGORI 3: MODUL KHUSUS
  // ==========================================
  {
    tabId: 'analytics',
    category: 'Modul Khusus',
    name: 'Analytics',
    description: 'Analisis bottleneck SLA pengadaan, evaluasi vendor, dan performa PIC',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
  {
    tabId: 'admin-settings',
    category: 'Modul Khusus',
    name: 'Admin Settings',
    description: 'Manajemen hak akses RBAC, pembuatan user kredensial, dan konfigurasi sistem',
    permissions: {
      admin: { allowed: true, level: 'Full Access', badgeTone: 'purple' },
      staf_ttb: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      staf_lapangan: { allowed: false, level: 'Dilarang', badgeTone: 'rose', notes: 'Menu disembunyikan' },
      visitor: { allowed: false, level: 'Dilarang', badgeTone: 'rose' },
    },
  },
];

/**
 * Helper RBAC: Menentukan apakah sebuah role memiliki izin mengakses tab/modul tertentu.
 */
export function canAccessTab(role: UserRole | undefined, tab: TabType): boolean {
  if (!role || role === 'admin') return true;

  if (role === 'visitor') {
    return tab === 'overview' || tab === 'galeri-ttb' || tab === 'timemark';
  }

  if (role === 'staf_ttb') {
    const forbidden: TabType[] = [
      'serah-terima-lapangan',
      'timemark',
      'armada',
      'pos-kapal',
      'crew-kapal',
      'work-order',
      'list-sm',
      'analytics',
      'admin-settings',
    ];
    return !forbidden.includes(tab);
  }

  if (role === 'staf_lapangan') {
    const forbidden: TabType[] = ['upload-fstb', 'upload-ttb', 'analytics', 'admin-settings'];
    return !forbidden.includes(tab);
  }

  if (role === 'user') {
    return tab !== 'admin-settings';
  }

  return true;
}

/**
 * Helper RBAC: Nama tampilan peran user
 */
export function getRoleDisplayName(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'staf_ttb':
      return 'Staf Dokumen TTB';
    case 'staf_lapangan':
      return 'Staf Serah Terima Lapangan';
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
