export interface ChangelogItem {
  type: 'feature' | 'improvement' | 'security' | 'fix' | 'ui';
  title: string;
  description: string;
  module: string;
  impact: string;
}

export interface SystemVersionRelease {
  version: string;
  buildNumber: string;
  releaseDate: string;
  releaseTimestamp: string;
  title: string;
  summary: string;
  author: string;
  badge: 'Latest' | 'Stable' | 'Milestone';
  items: ChangelogItem[];
}

export const SYSTEM_CURRENT_VERSION = 'v2.6.0';
export const SYSTEM_BUILD_NUMBER = 'CPG-BUILD-20261031.1030';

export const SYSTEM_CHANGELOG: SystemVersionRelease[] = [
  {
    version: 'v2.6.0',
    buildNumber: 'CPG-BUILD-20261031.1030',
    releaseDate: '31 Oktober 2026',
    releaseTimestamp: '2026-10-31T10:30:00+08:00',
    title: 'Optimasi Mode Tablet Kiosk Serah Terima & Integrasi RBAC End User',
    summary:
      'Pembaruan besar pada antarmuka tablet/iPad Kiosk serah terima lapangan, restrukturisasi kolom aksi & otorisasi status logistik, standardisasi font proporsional, serta integrasi role End User pada toolbar matriks hak akses.',
    author: 'Administrator & Core DevOps CPG Hub',
    badge: 'Latest',
    items: [
      {
        type: 'ui',
        title: 'Perapian Tata Letak & Perataan Vertikal Kolom AKSI',
        description:
          'Menyeragamkan perataan vertikal seluruh baris tabel (align-middle) agar tombol tidak menempel ke garis bawah. Menetapkan hierarki tombol konsisten: tombol utama (Pilih TTB, Lanjut TTD, Input TTD, Lihat Berkas) selalu di sisi kanan, sedangkan tombol pendukung (Titip Remote, Link WA) selalu di sisi kiri.',
        module: 'Serah Terima Lapangan (Mode Tablet / iPad Kiosk)',
        impact: 'Tampilan rapi, navigasi sentuh lebih presisi dan konsisten di setiap baris.',
      },
      {
        type: 'improvement',
        title: 'Restrukturisasi Otorisasi: "Status Logistik" & "Siap Kirim"',
        description:
          'Mengubah header kolom "Otorisasi Manager & Logistik" menjadi lebih ringkas "Status Logistik". Mengganti teks badge dari "Disetujui Manager (Siap Kirim)" menjadi "Siap Kirim", dan keterangan otorisasi menjadi "Administrasi Lengkap" dengan tooltip nama manajer yang mengesahkan.',
        module: 'Serah Terima Lapangan',
        impact: 'Keterangan lugas, ringkas, dan fokus pada kepastian administrasi barang untuk tim lapangan.',
      },
      {
        type: 'improvement',
        title: 'Peningkatan Ukuran Font Proporsional Tabel Kiosk',
        description:
          'Memperbesar ukuran font header tabel (14-16px font-black), nomor TTB resmi (16-18px font-black mono), dan tanggal terbit TTB (14-16px font-bold) agar mudah dibaca dari jarak pandang tablet tanpa memecah responsivitas layout.',
        module: 'Serah Terima Lapangan (Kiosk Mode)',
        impact: 'Data nomor TTB dan tanggal terbit sangat jelas terbaca oleh kru kapal dan kurir di lapangan.',
      },
      {
        type: 'improvement',
        title: 'Penyempurnaan Status TTD Digital: "Sudah Ditandatangani dan Diterima"',
        description:
          'Memperjelas status penerimaan akhir dari sebelumnya "Sudah Ditandatangani" menjadi "Sudah Ditandatangani dan Diterima" untuk menegaskan bahwa serah terima fisik barang telah tuntas.',
        module: 'Serah Terima Lapangan',
        impact: 'Status hukum serah terima fisik barang menjadi tidak ambigu.',
      },
      {
        type: 'feature',
        title: 'Akun Generic Tunggal untuk End User (Kru Armada & Lapangan)',
        description:
          'Menerapkan konsolidasi akun tunggal bersama (generic shared account: @enduser) untuk seluruh kapal dan armada. Memudahkan seluruh kru kapal mengakses portal tanpa kendala lupa password, sementara pencatatan tanda terima fisik TTB tetap mencatat nama asli dan tanda tangan kru penerima.',
        module: 'Manajemen Pengguna & Autentikasi',
        impact: 'Administrasi akun praktis, menghilangkan beban pengelolaan ratusan akun individual kapal.',
      },
      {
        type: 'feature',
        title: 'Integrasi Role "End User" pada Toolbar Pengalihan Cepat RBAC',
        description:
          'Menambahkan opsi role "📦 End User (Penerima Barang)" pada menu dropdown "1. Role Pemakai Target" di toolbar pengalihan cepat matriks hak akses. Memungkinkan Admin mengubah wewenang multi-modul untuk role End User secara instan serentak.',
        module: 'Admin Settings & RBAC Matriks',
        impact: 'Mempermudah konfigurasi wewenang modul kru kapal dan penerima akhir barang lintas armada.',
      },
      {
        type: 'improvement',
        title: 'Penyederhanaan Layout Kompak Tabel Lapangan',
        description:
          'Menghilangkan kolom NO. FPB/PO dan item barang yang redundan pada tabel tablet serah terima lapangan agar ruang pandang lebih lega dan fokus pada proses verifikasi fisik dan TTD.',
        module: 'Serah Terima Lapangan',
        impact: 'Menghemat ruang layar hingga 35%, mengurangi scrolling berlebih di tablet.',
      },
      {
        type: 'ui',
        title: 'Penebalan Scrollbar Touch-Friendly untuk Tablet & iPad',
        description:
          'Mengatur ketebalan horizontal scrollbar tabel menjadi 12px dengan kontras warna thumb yang jelas agar nyaman digeser menggunakan jari di layar sentuh iPad/Chrome/Safari.',
        module: 'Tabel Monitoring & Serah Terima Lapangan',
        impact: 'Navigasi tabel horizontal menjadi sangat responsif untuk pengguna tablet.',
      },
      {
        type: 'improvement',
        title: 'Format Tanggal Baku Indonesia (DD/MM/YYYY)',
        description:
          'Mengubah format tanggal terbit FPB dan TTB menjadi format baku dd/mm/yyyy yang mudah dipahami oleh seluruh staf operasional.',
        module: 'Tabel Monitoring Procurement & Lapangan',
        impact: 'Menghilangkan kebingungan antara format bulan dan hari pada penanggalan.',
      },
      {
        type: 'security',
        title: 'Pembersihan Kredensial Halaman Login (Zero-Trust Standard)',
        description:
          'Menghilangkan kotak petunjuk kredensial demo pada halaman masuk web demi mematuhi standar keamanan akses internal PT Cindara Pratama Lines.',
        module: 'Halaman Login & Autentikasi',
        impact: 'Mencegah kebocoran akun dan memastikan hanya staf resmi yang dapat masuk.',
      },
    ],
  },
  {
    version: 'v2.5.0',
    buildNumber: 'CPG-BUILD-20261029.1600',
    releaseDate: '29 Oktober 2026',
    releaseTimestamp: '2026-10-29T16:00:00+08:00',
    title: 'Cloudflare R2 Storage, TTD Digital Canvas & Stempel Dokumen Otomatis',
    summary:
      'Integrasi penyimpanan berkas cloud R2 berkecepatan tinggi, fitur tanda tangan digital berbasis canvas bersertifikat, dan stempel QR-code otomatis pada berkas TTB & FSTB.',
    author: 'Administrator & Core DevOps CPG Hub',
    badge: 'Stable',
    items: [
      {
        type: 'feature',
        title: 'Penyimpanan Cloud R2 Terintegrasi',
        description:
          'Implementasi sinkronisasi dokumen TTB dan FSTB langsung ke bucket Cloudflare R2 dengan jalur URL aman dan token masa berlaku.',
        module: 'Cloud R2 Storage & Pengarsipan Berkas',
        impact: 'Akses unduh berkas cepat dan kapasitas penyimpanan dokumen tidak terbatas.',
      },
      {
        type: 'feature',
        title: 'Canvas Tanda Tangan Digital & Sertifikat Kredensial',
        description:
          'Modul tanda tangan digital interaktif dengan kemampuan gambar langsung di layar, unggah tanda tangan PNG transparan, dan pembuatan sertifikat TTD unik.',
        module: 'Admin Settings & Validasi Digital',
        impact: 'Dokumen serah terima sah secara digital dan dapat diverifikasi keasliannya.',
      },
      {
        type: 'improvement',
        title: 'Stempel Otomatis Status Berkas TTB',
        description:
          'Otomatisasi pembubuhan stempel persetujuan manajer logistik begitu berkas selesai diverifikasi di sistem.',
        module: 'Validasi & TTD Dokumen TTB',
        impact: 'Mengurangi waktu tunggu fisik dari 2 hari menjadi instan.',
      },
    ],
  },
  {
    version: 'v2.4.0',
    buildNumber: 'CPG-BUILD-20261026.1400',
    releaseDate: '26 Oktober 2026',
    releaseTimestamp: '2026-10-26T14:00:00+08:00',
    title: 'Pre-Dispatch Checking & Token Titipan Remote Serah Terima',
    summary:
      'Alur kerja pemeriksaan fisik barang sebelum keberangkatan kurir (Pre-Dispatch), serta disposisi titipan pihak ketiga (travel/kapal perintis) via tautan WhatsApp mandiri.',
    author: 'Administrator & Core DevOps CPG Hub',
    badge: 'Milestone',
    items: [
      {
        type: 'feature',
        title: 'Sistem Disposisi Titipan Remote via WhatsApp',
        description:
          'Fitur penerbitan token unik dan tautan mandiri serah terima untuk pengiriman barang via ekspedisi laut pihak ketiga tanpa kehadiran kurir internal.',
        module: 'Serah Terima Lapangan & WhatsApp Gateway',
        impact: 'Kru kapal di pelabuhan terpencil dapat menandatangani penerimaan langsung dari HP.',
      },
      {
        type: 'feature',
        title: 'Pemeriksaan Pra-Keberangkatan (Pre-Dispatch Verification)',
        description:
          'Checklist fisik barang, foto kemasan, dan validasi kurir sebelum barang diangkut dari gudang logistik.',
        module: 'Logistik & Serah Terima Lapangan',
        impact: 'Mengurangi risiko barang salah kirim atau rusak di jalan.',
      },
    ],
  },
  {
    version: 'v2.0.0',
    buildNumber: 'CPG-BUILD-20261015.0800',
    releaseDate: '15 Oktober 2026',
    releaseTimestamp: '2026-10-15T08:00:00+08:00',
    title: 'Peluncuran Arsitektur Multi-Entitas CPG Procurement Hub',
    summary:
      'Arsitektur inti sistem pengadaan terpadu lintas 5 entitas PT Cindara Pratama Lines dengan sinkronisasi Google Sheets, matriks RBAC 17 modul, dan pelacakan armada.',
    author: 'Administrator & Core DevOps CPG Hub',
    badge: 'Milestone',
    items: [
      {
        type: 'feature',
        title: 'Platform Pengadaan Terpadu 5 Entitas PT CPG',
        description:
          'Dashboard monitoring real-time menghubungkan FPB, PO, FSTB, dan TTB dari seluruh unit armada dan departemen operasional.',
        module: 'Core System & Monitoring Procurement',
        impact: 'Visibilitas pengadaan end-to-end terpusat dalam satu aplikasi terintegrasi.',
      },
      {
        type: 'feature',
        title: 'Matriks Hak Akses Berbasis Role (17 Modul RBAC)',
        description:
          'Sistem kontrol akses granular untuk 8 role pengguna (Admin, Manager, Supervisor, Staf Purchasing, Staf TTB, Staf Lapangan, End User, Visitor).',
        module: 'Admin Settings & Keamanan Sistem',
        impact: 'Pemisahan wewenang operasional yang ketat dan audit trail lengkap.',
      },
    ],
  },
];

