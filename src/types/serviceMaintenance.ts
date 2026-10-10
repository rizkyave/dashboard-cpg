export interface ServiceMaintenanceItem {
  id: string;
  no: number;
  vendor: string;
  dept: string;
  tglBarangTurun: string;
  bapbLink?: string;
  tglKeVendor: string;
  quotKeAdmin: string;
  noFpb: string;
  inputFpb: string;
  noPo: string;
  tglPo: string;
  item: string;
  ket: string;
  type: string;
  tglSelesai: string;
  status: 'CLOSE' | 'OPEN' | 'HOLD' | string;
  sourceSheet?: string;
}

export interface ServiceMaintenanceSummary {
  totalRecords: number;
  totalClose: number;
  totalOpen: number;
  totalHold: number;
  totalVendors: number;
  lastUpdated: string;
}

export interface VendorSheetConfig {
  id: string;
  name: string;
  sheetUrl: string;
  lastSyncTime?: string;
  itemCount?: number;
}

export const DEFAULT_SM_VENDORS: VendorSheetConfig[] = [
  {
    id: 'karindo',
    name: 'SM - KARINDO',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1-e6AEzPZGdcPvgt00G-v-YGZQ3QWfQS235gRnryZrW8/edit?gid=0#gid=0',
  },
  {
    id: 'surabaya-teknik',
    name: 'SM - SURABAYA TEKNIK',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1_91YaEEbkaWtiu8Wbqq4c1-nAFLF0HHgqF9GxxPwe6w/edit?gid=0#gid=0',
  },
  {
    id: 'sidomukti',
    name: 'SM - SIDOMUKTI',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/10X9MhkC1v0F2odwyGCqzSbOnAiLiV3b9Qj3vm26Y0wE/edit?gid=0#gid=0',
  },
  {
    id: 'panca-teknik',
    name: 'SM - PANCA TEKNIK',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1XZketB4RDQy0luvvKJCeoyQIBOUW36fCoQOOeInbbrs/edit?gid=0#gid=0',
  },
  {
    id: 'tjokro',
    name: 'SM - TJOKRO BERSAUDARA',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1fPwOvy5YHNVvoiPrl8uHqosGqrRRN1GG_F5zcji5abs/edit?gid=0#gid=0',
  },
  {
    id: 'balikpapan-diesel',
    name: 'SM - BALIKPAPAN DIESEL',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1JzMDir-8SAYarTmRpYsVwiqMewOMHNfM61rUJL-4sD0/edit?gid=0#gid=0',
  },
  {
    id: 'solusi-diesel',
    name: 'SM - SOLUSI DIESEL',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1rVNVzVXXDr92ds2s6iZC576wMRE6WSWSIlBVLQHaFrQ/edit?gid=0#gid=0',
  },
];

