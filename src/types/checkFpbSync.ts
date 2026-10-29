export interface CheckFpbRecord {
  fpb: string;
  tglFpb: string;
  armada: string;
  tglCek: string;
  statusCek: string;
  tglApproveWeb: string;
  done: string;
  note: string;
  checker: 'NOOR HASANAH' | 'MELINDA DWI PUTRI' | string;
  checkerLabel: 'Bu Noor' | 'Bu Melinda' | string;
  sourceSheet: 'FBP CHECK BU NOOR' | 'FBP CHECK MELINDA';
  sheetGid: '76614569' | '1411569542';
  sheetUrl: string;
  rowNumber: number;
}

export interface CheckFpbSyncSummary {
  totalRecords: number;
  totalNoor: number;
  totalMelinda: number;
  lastSyncedAt: string;
  sourceSpreadsheetUrl: string;
}

export const BU_NOOR_SHEET_GID = '76614569';
export const MELINDA_SHEET_GID = '1411569542';

export const BU_NOOR_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=76614569#gid=76614569';

export const MELINDA_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=1411569542#gid=1411569542';

export const DEFAULT_CHECK_FPB_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit';

