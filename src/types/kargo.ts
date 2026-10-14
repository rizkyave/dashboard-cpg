export type CargoServiceType = 'Reguler' | 'Express' | 'Kargo Darat' | 'Kargo Laut';

export type CargoStatus =
  | 'Draft'
  | 'Diproses'
  | 'Dalam Perjalanan'
  | 'Tiba di Tujuan'
  | 'Selesai';

export interface CargoSender {
  nama: string;
  telepon: string;
  alamat: string;
  kota: string;
}

export interface CargoReceiver {
  nama: string;
  telepon: string;
  alamat: string;
  kotaTujuan: string;
}

export interface CargoGoods {
  jenis: string;
  beratKg: number;
  panjangCm: number;
  lebarCm: number;
  tinggiCm: number;
  volumeCbm: number;
  koli: number;
  keterangan?: string;
}

export interface CargoAlurPic {
  // Tahap 1: Pembuatan Order / FPB (Admin / Sales)
  tahap1: {
    picSales: string;
    tglFpb: string;
    noFpb: string;
    catatan?: string;
    selesai: boolean;
  };
  // Tahap 2: Purchasing / Booking Armada (Vendor / Ruang Kargo)
  tahap2: {
    picPurchasing: string;
    noBookingPo: string;
    tglBooking: string;
    vendorArmada?: string;
    selesai: boolean;
  };
  // Tahap 3: Serah Terima Barang / FSTB (Dikerjakan bersama PIC Purchasing / Pembuat PO yang sama)
  tahap3: {
    picFstb: string; // SINKRON OTOMATIS dengan tahap2.picPurchasing
    noFstb: string;
    tglFstb: string;
    selesai: boolean;
  };
  // Tahap 4: Pencatatan TTB (Tanda Terima Barang di Gudang Hub Transit)
  tahap4: {
    picTtb: string;
    noTtb: string;
    tglTtb: string;
    namaGudangHub?: string;
    selesai: boolean;
  };
  // Tahap 5: Tim Lapangan / Kurir Pengantar (Pengantaran Door-to-Door)
  tahap5: {
    picKurirLap: string;
    tglDiterimaKurir?: string;
    tglDiantar?: string;
    namaPenerimaAkhir?: string;
    selesai: boolean;
  };
  // Tahap 6: Administrasi Akhir & Penagihan Keuangan (SPP / Invoice)
  tahap6: {
    picFinance: string;
    noInvoice?: string;
    tglLunas?: string;
    statusBayar: 'Belum Lunas' | 'Lunas';
    selesai: boolean;
  };
}

export interface CargoTrackingEvent {
  timestamp: string;
  tahapIndex: 1 | 2 | 3 | 4 | 5 | 6;
  lokasi: string;
  status: string;
  keterangan: string;
  pic: string;
}

export interface CargoShipment {
  id: string;
  resi: string; // Format: CRG-2026-XXXXX
  tglOrder: string;
  pengirim: CargoSender;
  penerima: CargoReceiver;
  barang: CargoGoods;
  layanan: CargoServiceType;
  status: CargoStatus;
  estimasiHari: string;
  ongkir: number;
  biayaOperasional: number;
  alurPic: CargoAlurPic;
  riwayatTracking: CargoTrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CargoFilterState {
  searchQuery: string;
  status: 'ALL' | CargoStatus;
  layanan: 'ALL' | CargoServiceType;
  kotaTujuan: string;
}

export interface CargoSummaryMetrics {
  totalPengiriman: number;
  aktif: number;
  dalamPerjalanan: number;
  selesai: number;
  draft: number;
  totalPendapatan: number;
  totalBiaya: number;
  totalLabaKotor: number;
  onTimeRate: number; // Persentase ketepatan
}

