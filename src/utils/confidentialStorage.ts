export interface ConfidentialConfig {
  pin: string;
  allowedRoles: string[];
  allowedUsers: string[];
  autoRevealForAdmin: boolean;
  maskStyle: 'dots' | 'blur' | 'redacted';
  updatedAt?: string;
  updatedBy?: string;
}

const STORAGE_KEY_CONFIG = 'CPG_CONFIDENTIAL_SECURITY_CONFIG';
const SESSION_KEY_UNLOCKED = 'CPG_CONFIDENTIAL_SESSION_UNLOCKED';
export const CONFIDENTIAL_CHANGE_EVENT = 'cpg:confidential-change';

const DEFAULT_CONFIG: ConfidentialConfig = {
  pin: 'CPG2026',
  allowedRoles: ['admin', 'manager'],
  allowedUsers: ['admin', 'hermansyah', 'direksi'],
  autoRevealForAdmin: false,
  maskStyle: 'dots',
  updatedAt: '2026-11-07',
  updatedBy: 'System Default',
};

export function getConfidentialConfig(): ConfidentialConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfidentialConfig(updates: Partial<ConfidentialConfig>, updatedBy: string = 'Admin'): ConfidentialConfig {
  const current = getConfidentialConfig();
  const nextConfig: ConfidentialConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(nextConfig));
      window.dispatchEvent(new CustomEvent(CONFIDENTIAL_CHANGE_EVENT, { detail: { action: 'config-updated' } }));
    } catch {
      // Ignore storage error
    }
  }

  return nextConfig;
}

export function verifyConfidentialPin(inputPin: string): boolean {
  const config = getConfidentialConfig();
  const cleanInput = (inputPin || '').trim();
  const targetPin = (config.pin || 'CPG2026').trim();
  return cleanInput === targetPin;
}

export function isConfidentialUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_KEY_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setConfidentialUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY_UNLOCKED, unlocked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(CONFIDENTIAL_CHANGE_EVENT, { detail: { unlocked } }));
  } catch {
    // Ignore storage error
  }
}

export function isUserAuthorizedForConfidential(user: any): boolean {
  if (!user) return false;
  const config = getConfidentialConfig();

  const username = (user.username || user.email || user.name || '').toLowerCase();
  const role = (user.role || '').toLowerCase();

  const isRoleAllowed = config.allowedRoles.map((r) => r.toLowerCase()).includes(role);
  const isUserAllowed = config.allowedUsers.map((u) => u.toLowerCase()).includes(username);

  return isRoleAllowed || isUserAllowed;
}

