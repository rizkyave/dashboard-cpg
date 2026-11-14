/**
 * Utilitas & Konfigurasi Matriks Otorisasi Berjenjang (SAP Release Strategy)
 * Mengatur threshold nilai tender (Tier 1 <= 5 Jt, Tier 2 <= 30 Jt, Tier 3 > 30 Jt)
 * dan wewenang release persetujuan penerbitan Purchase Order (PO).
 * Dapat disesuaikan (adjust) oleh Admin di Menu Pengaturan.
 */

export interface TenderApprovalTierConfig {
  id: 'tier-1' | 'tier-2' | 'tier-3';
  name: string;
  maxAmount: number; // Dalam Rupiah
  authorizedRole: 'supervisor' | 'manager' | 'direksi';
  authorizedRoleLabel: string;
  scopeDescription: string;
}

export interface TenderApprovalMatrixSettings {
  tier1: TenderApprovalTierConfig;
  tier2: TenderApprovalTierConfig;
  tier3: TenderApprovalTierConfig;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_TENDER_APPROVAL_SETTINGS: TenderApprovalMatrixSettings = {
  tier1: {
    id: 'tier-1',
    name: 'Tier 1',
    maxAmount: 5000000, // Nilai <= 5 Juta
    authorizedRole: 'supervisor',
    authorizedRoleLabel: 'Supervisor Pengadaan',
    scopeDescription: 'Otorisasi langsung pengadaan rutin armada',
  },
  tier2: {
    id: 'tier-2',
    name: 'Tier 2',
    maxAmount: 30000000, // Nilai <= 30 Juta ( > 5 Jt s/d 30 Jt )
    authorizedRole: 'manager',
    authorizedRoleLabel: 'Manager Purchasing',
    scopeDescription: 'Otorisasi tender suku cadang & cat kapal',
  },
  tier3: {
    id: 'tier-3',
    name: 'Tier 3',
    maxAmount: Infinity, // Nilai > 30 Juta
    authorizedRole: 'direksi',
    authorizedRoleLabel: 'Direktur Operasional / Keuangan',
    scopeDescription: 'Otorisasi tender kontrak payung / dok kapal',
  },
};

const STORAGE_KEY = 'CPG_TENDER_APPROVAL_MATRIX_CONFIG_V1';

export function getStoredTenderApprovalSettings(): TenderApprovalMatrixSettings {
  if (typeof window === 'undefined') return DEFAULT_TENDER_APPROVAL_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TENDER_APPROVAL_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      tier1: { ...DEFAULT_TENDER_APPROVAL_SETTINGS.tier1, ...(parsed.tier1 || {}) },
      tier2: { ...DEFAULT_TENDER_APPROVAL_SETTINGS.tier2, ...(parsed.tier2 || {}) },
      tier3: { ...DEFAULT_TENDER_APPROVAL_SETTINGS.tier3, ...(parsed.tier3 || {}) },
      updatedAt: parsed.updatedAt,
      updatedBy: parsed.updatedBy,
    };
  } catch {
    return DEFAULT_TENDER_APPROVAL_SETTINGS;
  }
}

export function saveStoredTenderApprovalSettings(settings: TenderApprovalMatrixSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('cpg-tender-approval-config-changed'));
  } catch (err) {
    console.error('Gagal menyimpan konfigurasi matriks approval:', err);
  }
}

export function determineRequiredApprovalTier(
  amount: number,
  settings: TenderApprovalMatrixSettings = getStoredTenderApprovalSettings()
): TenderApprovalTierConfig {
  if (amount <= settings.tier1.maxAmount) {
    return settings.tier1;
  }
  if (amount <= settings.tier2.maxAmount) {
    return settings.tier2;
  }
  return settings.tier3;
}

export function checkUserCanReleaseTier(
  userRole: string | undefined,
  requiredTier: TenderApprovalTierConfig
): { allowed: boolean; reason?: string } {
  const normRole = String(userRole || '').toLowerCase().trim();

  // Admin selalu memiliki hak release master / override
  if (normRole === 'admin' || normRole.includes('admin') || normRole === 'hermansyah') {
    return { allowed: true };
  }

  // Tier 1: Supervisor, Manager, Direksi
  if (requiredTier.authorizedRole === 'supervisor') {
    if (
      normRole.includes('supervisor') ||
      normRole.includes('manager') ||
      normRole.includes('direksi') ||
      normRole.includes('management')
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Wewenang release Tier 1 memerlukan hak akses minimal Supervisor Pengadaan (Role Anda: ${userRole || 'Staf'}).`,
    };
  }

  // Tier 2: Manager, Direksi
  if (requiredTier.authorizedRole === 'manager') {
    if (
      normRole.includes('manager') ||
      normRole.includes('direksi') ||
      normRole.includes('management')
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Wewenang release Tier 2 memerlukan hak akses Manager Purchasing (Role Anda: ${userRole || 'Staf'}).`,
    };
  }

  // Tier 3: Direksi / Management
  if (requiredTier.authorizedRole === 'direksi') {
    if (normRole.includes('direksi') || normRole.includes('management') || normRole.includes('director')) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Wewenang release Tier 3 memerlukan otorisasi Direktur Operasional / Keuangan (Role Anda: ${userRole || 'Staf'}).`,
    };
  }

  return { allowed: false, reason: 'Hak akses Anda tidak mencukupi untuk me-release penawaran ini.' };
}
