import { ApprovalDelegation, DelegationCheckResult } from '@/types/delegation';

/**
 * Memeriksa apakah suatu rekaman delegasi berstatus aktif dan berada dalam rentang tanggal hari ini
 */
export function isDelegationActive(delegation: ApprovalDelegation, checkDateStr?: string): boolean {
  if (delegation.status !== 'ACTIVE') return false;

  const todayStr = checkDateStr || new Date().toISOString().slice(0, 10);
  const start = delegation.startDate.slice(0, 10);
  const end = delegation.endDate.slice(0, 10);

  return todayStr >= start && todayStr <= end;
}

/**
 * Mengambil seluruh delegasi aktif di mana pengguna tertentu bertindak sebagai Plh (penerima wewenang)
 */
export function getActiveDelegationsForDelegate(
  delegations: ApprovalDelegation[],
  delegateUsername?: string,
  checkDateStr?: string
): ApprovalDelegation[] {
  if (!delegateUsername || !Array.isArray(delegations)) return [];
  const uLower = delegateUsername.toLowerCase().trim();

  return delegations.filter((d) => {
    return (
      d.delegateUsername.toLowerCase().trim() === uLower &&
      isDelegationActive(d, checkDateStr)
    );
  });
}

/**
 * Memeriksa apakah pengguna bertindak sebagai Plh untuk target role tertentu (misal: 'spv_purchasing' atau 'spv_logistik')
 */
export function checkUserPlhAuthority(
  activeDelegations: ApprovalDelegation[],
  targetRole: string
): DelegationCheckResult {
  if (!Array.isArray(activeDelegations) || activeDelegations.length === 0) {
    return { isPlh: false };
  }

  const targetLower = targetRole.toLowerCase().trim();

  const matched = activeDelegations.find((d) => {
    const dRole = (d.delegatorRole || '').toLowerCase().trim();
    if (dRole === targetLower) return true;
    if (targetLower === 'spv_purchasing' && (dRole === 'spv_purchasing' || dRole === 'supervisor')) return true;
    if (targetLower === 'spv_logistik' && (dRole === 'spv_logistik' || dRole === 'supervisor')) return true;
    if (targetLower === 'manager' && dRole === 'manager') return true;
    return false;
  });

  if (matched) {
    return {
      isPlh: true,
      delegatorName: matched.delegatorName,
      delegatorRole: matched.delegatorRole,
      reason: matched.reason,
      delegationId: matched.id,
    };
  }

  return { isPlh: false };
}
