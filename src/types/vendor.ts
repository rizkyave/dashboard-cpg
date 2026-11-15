/**
 * Master Data Vendor / Rekanan Terdaftar (DPT - Daftar Penyedia Terseleksi)
 * PT Cindara Pratama Lines (CPG)
 */

export type VendorStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'BLACKLISTED';

export type VendorLegalType = 'PT' | 'CV' | 'UD' | 'KOPERASI' | 'PERORANGAN' | 'LAINNYA';

export type VendorCategory =
  | 'SPARE_PART_MESIN'      // Sparepart Mesin, Generator, Pompa, Filter
  | 'DECK_MOORING_TALI'     // Tali Tambat, Wire Rope, Jangkar, Shackle, Mooring
  | 'SAFETY_NAVIGASI'       // Alat Navigasi, Radio, Radar, Pyrotechnics, LSA/FFA
  | 'BUNKER_PELUMAS'        // BBM Marine, Oli Mesin, Grease, Kimia Perkapalan
  | 'JASA_DOCKING_REPAIR'   // Docking, Sandblasting, Pengelasan, Overhaul Mesin
  | 'LOGISTIK_TRANSPORT'    // Forwarding, Ekspedisi, Sewa Truk/Tugboat, Crane
  | 'GENERAL_SUPPLIER';     // Perlengkapan Kru, Alat Kebersihan, Cat, Hardware

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  SPARE_PART_MESIN: 'Sparepart Mesin & Generator',
  DECK_MOORING_TALI: 'Deck, Mooring & Tali Tambat',
  SAFETY_NAVIGASI: 'Safety LSA/FFA & Alat Navigasi',
  BUNKER_PELUMAS: 'Bunker, Pelumas & Kimia Marine',
  JASA_DOCKING_REPAIR: 'Jasa Docking, Repair & Las',
  LOGISTIK_TRANSPORT: 'Logistik & Transportasi Laut/Darat',
  GENERAL_SUPPLIER: 'General Marine Supplier & Hardware',
};

export interface RegisteredVendor {
  id: string; // e.g. "VND-CPG-001"
  code: string; // e.g. "SBT-001"
  name: string; // e.g. "PT. Samudra Bahari Teknik"
  legalType: VendorLegalType;
  npwp: string;
  nib?: string;
  categories: VendorCategory[];
  picName: string;
  picPhone: string; // WA format: e.g. "081288776655"
  picEmail: string;
  officeAddress?: string;
  city?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  status: VendorStatus;
  accessToken: string; // Token otentikasi unik untuk link tender
  isVerified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  rating?: number; // 1.0 - 5.0
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VendorVerificationResult {
  isValid: boolean;
  vendor?: RegisteredVendor;
  error?: string;
}
