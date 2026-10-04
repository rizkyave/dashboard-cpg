export type UserRole = 'admin' | 'user' | 'visitor';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  department?: string;
  email?: string;
  avatar?: string;
  lastLogin?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
}

export interface UserAccount extends AuthUser {
  password?: string;
  createdAt?: string;
}

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

