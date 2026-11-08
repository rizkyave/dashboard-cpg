export type ScheduleDay = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT';
export type ScheduleWeek = 'W1' | 'W2'; // W1: Minggu Ini, W2: Minggu Depan
export type DeliveryTimeSlot = 'PAGI (08:00 - 11:30)' | 'SIANG (13:00 - 15:30)' | 'SORE (15:30 - 18:00)' | 'FLEKSIBEL';
export type DeliveryScheduleStatus = 'PLANNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'RESCHEDULED' | 'CANCELLED';

export interface CourierPerson {
  name: string;
  nik: string;
  phone: string;
  jabatan: string;
  avatar?: string;
}

export interface DeliveryScheduleItem {
  id: string;
  // Informasi Kapal & Posisi
  shipName: string;
  cleanShipName: string;
  callSign?: string;
  shipPosition: string; // Lokasi labuh cth: Somber, Semayang, Kariangau, Muara Jawa
  clusterArea: 'SOMBER_KARIANGAU' | 'SEMAYANG_BALIKPAPAN' | 'MUARA_JAWA_SAMARINDA' | 'LUAR_TRANSIT' | 'LAINNYA';
  shipStatus: 'ON' | 'SB' | 'MT' | 'BD' | 'DK' | string;
  detailStatus?: string;
  
  // Informasi Dokumen Pengadaan & Barang
  noTtb?: string;
  noFpb?: string;
  noPo?: string;
  itemDescription?: string;
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  
  // Alokasi Penjadwalan 5 Hari
  targetWeek: ScheduleWeek;
  scheduledDay: ScheduleDay;
  scheduledDate: string; // Format: YYYY-MM-DD (cth: 2026-11-09)
  timeSlot: DeliveryTimeSlot;
  
  // Penugasan Kurir (5 Personel Tim Delivery)
  courier: CourierPerson;
  transportMethod: 'Diantar Tim Logistik' | 'Titip Armada' | 'Travel / Mobil' | string;
  
  // Status & Catatan
  status: DeliveryScheduleStatus;
  notes?: string;
  
  // Asistensi Cerdas AI
  isAiSuggested?: boolean;
  aiClusteringReason?: string;
  priorityScore?: number;
  
  // Metadata Audit
  scheduledBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WeekDateRange {
  weekKey: ScheduleWeek;
  weekLabel: string;
  startDate: string; // YYYY-MM-DD (Senin)
  endDate: string; // YYYY-MM-DD (Jumat)
  days: {
    day: ScheduleDay;
    date: string; // YYYY-MM-DD
    formattedDate: string; // Cth: Senin, 09 Nov 2026
    shortDate: string; // Cth: 09 Nov
  }[];
}

export interface ScheduleSummaryMetrics {
  totalScheduled: number;
  completedCount: number;
  pendingCount: number;
  urgentCount: number;
  byDay: Record<ScheduleDay, number>;
  byCourier: Record<string, number>;
  byCluster: Record<string, number>;
}
