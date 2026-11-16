export interface ApprovalDelegation {
  id: string;
  delegatorUsername: string; // Username pejabat yang cuti (misal: "rahmahwati")
  delegatorName: string; // Nama lengkap pejabat yang cuti
  delegatorRole: string; // Role pejabat yang cuti (misal: "spv_purchasing", "manager")
  delegateUsername: string; // Username pejabat pengganti / Plh (misal: "hermansyahz")
  delegateName: string; // Nama lengkap pejabat pengganti
  delegateRole: string; // Role pejabat pengganti
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string; // Alasan cuti (misal: "Cuti Tahunan", "Dinas Luar")
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface DelegationCheckResult {
  isPlh: boolean;
  delegatorName?: string;
  delegatorRole?: string;
  reason?: string;
  delegationId?: string;
}
