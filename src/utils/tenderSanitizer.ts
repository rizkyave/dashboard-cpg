/**
 * Utilitas untuk memvalidasi & membersihkan item material tender dari
 * anomali baris tanda tangan / footnote / reviewer yang terbawa dari lembar Excel FPB/PPIC.
 */

export function isNonMaterialOrSignature(name?: string, code?: string): boolean {
  if (!name && !code) return false;
  const normName = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  const keywords = [
    'AKNOWLEDGE',
    'ACKNOWLEDGE',
    'REVIEW',
    'REVIEWER',
    'FINANCE',
    'HADISUNARYO',
    'MAKER',
    'CHECKER',
    'APPROVER',
    'APPROVAL',
    'TANDATANGAN',
    'MENGETAHUI',
    'DISETUJUI',
    'DIBUATOLEH',
    'HERMANSYAH',
    'MELINDA',
    'NOORHASANAH',
  ];

  return keywords.some((kw) => {
    const cleanKw = kw.replace(/[^A-Z0-9]/g, '');
    return normName.includes(cleanKw) || normCode.includes(cleanKw);
  });
}

export function sanitizeTenderPackage<T extends { items?: any[] }>(pkg: T): T {
  if (!pkg || !Array.isArray(pkg.items)) return pkg;
  return {
    ...pkg,
    items: pkg.items.filter((it) => !isNonMaterialOrSignature(it?.itemName, it?.itemId)),
  };
}

export function sanitizeTenderPackages<T extends { items?: any[] }>(pkgs: T[]): T[] {
  if (!Array.isArray(pkgs)) return [];
  return pkgs.map(sanitizeTenderPackage);
}
