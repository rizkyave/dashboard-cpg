export interface FotoLapangan {
  id: string;
  noTtb: string; // Kunci integrasi utama (No. TTB)
  fpb?: string;
  noPo?: string;
  noFstb?: string;
  itemDescription?: string;
  armada?: string;
  picLapangan: string; // PIC Tim Lapangan (misal: AGUS, HERY)
  tanggal: string; // Format YYYY-MM-DD
  waktu?: string; // Format HH:mm:ss
  dataUrl: string; // Data URL Base64 image
  catatan?: string; // Catatan fisik / kondisi barang
  fileSizeKb?: number;
  fileName?: string;
  createdAt: number;
}

export interface UploadFotoPayload {
  noTtb: string;
  fpb?: string;
  noPo?: string;
  noFstb?: string;
  itemDescription?: string;
  armada?: string;
  picLapangan: string;
  tanggal: string;
  dataUrl: string;
  catatan?: string;
  fileSizeKb?: number;
  fileName?: string;
}
