export type MutationType = 'MASUK' | 'KELUAR';

export type StockStatus = 'AMAN' | 'MENIPIS' | 'HABIS';

export type WarehouseCategory =
  | 'Pelumas & Kimia'
  | 'Filter & Separator'
  | 'Sparepart Mesin'
  | 'Deck, Tali & Jangkar'
  | 'Safety, LSA & FFA'
  | 'Kelistrikan & Navigasi'
  | 'Consumables, Cat & Tools'
  | 'Pipa & Katup (Valves)'
  | 'Lain-lain';

export interface WarehouseStockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: WarehouseCategory;
  satuan: string; // PCS, LTR, DRUM, SET, ROLL, PAIL, MTR, CAN, BTL
  lokasiRak: string; // Contoh: "Rak A-03 Somber", "Pallet Pelumas B-01", "Gudang Besi C-02"
  minStock: number; // Ambang batas peringatan stok menipis
  saldoAwal: number; // Saldo awal periode
  totalMasuk: number; // Akumulasi penerimaan masuk
  totalKeluar: number; // Akumulasi pengeluaran keluar
  sisaStok: number; // Saldo real-time fisik (saldoAwal + totalMasuk - totalKeluar)
  status: StockStatus;
  kondisi: 'Baru' | 'Rekondisi' | 'Baik';
  hargaSatuanPerkiraan?: number; // Nilai estimasi per unit (IDR)
  lastMutationDate: string; // YYYY-MM-DD
  keterangan?: string;
}

export interface WarehouseMutation {
  id: string; // MUT-IN-2026-XXXX atau MUT-OUT-2026-XXXX
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm (WITA)
  jenis: MutationType;
  itemId: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: WarehouseCategory;
  qty: number;
  satuan: string;
  saldoSebelum: number;
  saldoSesudah: number;
  noDokumenRef: string; // No PO, No FSTB, No TTB, No FPB, atau Surat Jalan
  entitas: 'CPL' | 'PPI' | 'HL' | 'GAJ' | 'MIL' | 'SP' | 'SSK' | 'MO' | 'HOLDING';
  sumberAtauTujuan: string; // Nama Kapal, Unit Bengkel Somber, atau Nama Supplier
  picGudang: string; // Default: 'Budi Agustiansyah (Staf Gudang Somber)'
  picPenerimaPengambil: string; // Kru Kapal, Chief Eng, Mualim, Teknisi MTC
  keperluan: string; // Alasan pengeluaran / pengadaan
  status: 'VERIFIED' | 'PENDING';
  catatan?: string;
  createdAt: string;
}

export interface WarehouseSummary {
  totalSKU: number;
  totalFisikUnit: number;
  totalTransaksiMasuk: number;
  totalTransaksiKeluar: number;
  totalQtyMasuk: number;
  totalQtyKeluar: number;
  itemAman: number;
  itemLowStock: number;
  itemOutOfStock: number;
  lastUpdated: string;
}

