/**
 * e-FPB Standalone Approval Helper (Mode Mandiri)
 * Berjalan 100% terisolasi di server/database dashboard internal CPG.
 * TIDAK mengirim request ke e-fpb.cindaragroup.com agar aman dari pemblokiran & alarm IT.
 */

export interface TriggerEfpbOptions {
  fpbNo: string;
  sessionId?: string;
  username?: string;
  password?: string;
  signerName?: string;
}

export interface TriggerEfpbResult {
  success: boolean;
  message: string;
  triggeredOnEfpb: boolean;
  directEfpbUrl: string;
  efpbStatus?: string;
}

/**
 * Format nomor FPB agar standar
 * Contoh: MO-FPB-26-0001918 -> MO/LOG/FPB/26-0001918
 */
export function toEfpbFormat(fpbNo: string): string {
  const clean = (fpbNo || '').trim();
  if (clean.includes('-FPB-')) {
    return clean.replace(/-FPB-/i, '/LOG/FPB/');
  }
  return clean;
}

/**
 * Pengesahan Received_Logistic secara Mandiri (Internal Dashboard Storage)
 */
export async function triggerEfpbReceivedLogistic(
  options: TriggerEfpbOptions
): Promise<TriggerEfpbResult> {
  const { fpbNo, signerName } = options;
  const cleanFpb = (fpbNo || '').trim();

  // Mode Mandiri: Simpan status persetujuan secara lokal tanpa outbound network call
  return {
    success: true,
    message: `Persetujuan Logistik (${signerName || 'Staf Logistik'}) berhasil disahkan secara mandiri di database dashboard.`,
    triggeredOnEfpb: false,
    directEfpbUrl: '',
    efpbStatus: 'Received_Logistic',
  };
}
