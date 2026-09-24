import { ProcurementItem, ArmadaItem } from '@/types/procurement';

// Data awal dikosongkan untuk pengujian unggah file Excel mandiri oleh pengguna
export const INITIAL_PROCUREMENT_DATA: ProcurementItem[] = [];

export const INITIAL_ARMADA_DATA: ArmadaItem[] = [];

export const ENTITIES: { code: string; label: string }[] = [
  { code: 'ALL', label: 'SEMUA GRUP (8)' },
  { code: 'CPL', label: 'CPL (Cindara Pratama Lines)' },
  { code: 'PPI', label: 'PPI (Petro Perkasa Indonesia)' },
  { code: 'HL', label: 'HL (Hana Lines)' },
  { code: 'GAJ', label: 'GAJ (Galangan Aliran Jaya)' },
  { code: 'MIL', label: 'MIL (Mapan Indonesia Lines)' },
  { code: 'SP', label: 'SP (Sinar Pasifik)' },
  { code: 'SSK', label: 'SSK (Sinar Surya Konstruksi)' },
  { code: 'MO', label: 'MO (Marine Operation)' },
];
