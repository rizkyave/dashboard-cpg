import { CrewMasterItem, KapalRekapItem } from '@/types/crewKapal';

/**
 * Normalisasi nama kapal/armada untuk pencocokan toleran
 */
export function normalizeShipNameForMatch(str: string): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .replace(/\b(TK|OB|TB|SPOB|SV|MT|LCT|SP|BG|KM|KL|MV|CRANE BARGE|HOPPER BARGE|CREW BOAT)\b/g, '')
    .replace(/PASIFIC/g, 'PASIFIK')
    .replace(/PACIFIC/g, 'PASIFIK')
    .replace(/TWIN\s*SISTER/g, 'TWINSISTER')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Mencari daftar kru kapal berdasarkan nama armada dari TTB
 */
export function findCrewByArmada(
  armada: string,
  masterCrew: CrewMasterItem[],
  kapalRekap: KapalRekapItem[] = []
): { crewList: CrewMasterItem[]; shipPhone?: string; matchedShipName?: string } {
  if (!armada || armada === '-' || armada.toLowerCase() === 'null') {
    return { crewList: [] };
  }

  const rawQ = armada.trim().toLowerCase();
  const validCrew = masterCrew.filter(
    (c) =>
      c.namaPersonel &&
      c.namaPersonel !== '-' &&
      !c.statusSlot.toLowerCase().includes('lowong')
  );

  // 1. Exact match nama kapal
  let matched = validCrew.filter((c) => c.namaKapal.toLowerCase() === rawQ);
  let matchedShipName = matched[0]?.namaKapal;

  // 2. Normalized exact match
  if (matched.length === 0) {
    const normQ = normalizeShipNameForMatch(armada);
    if (normQ) {
      matched = validCrew.filter(
        (c) => normalizeShipNameForMatch(c.namaKapal) === normQ
      );
      matchedShipName = matched[0]?.namaKapal;
    }
  }

  // 3. Slash split match (e.g. TB CPL 88 / GAJ 02)
  if (matched.length === 0) {
    const normQ = normalizeShipNameForMatch(armada);
    if (normQ) {
      matched = validCrew.filter((c) => {
        const parts = c.namaKapal.split('/').map((p) => normalizeShipNameForMatch(p));
        return parts.some((p) => p && (p === normQ || p.includes(normQ) || normQ.includes(p)));
      });
      matchedShipName = matched[0]?.namaKapal;
    }
  }

  // 4. Substring match
  if (matched.length === 0) {
    const normQ = normalizeShipNameForMatch(armada);
    if (normQ && normQ.length >= 3) {
      matched = validCrew.filter((c) => {
        const normC = normalizeShipNameForMatch(c.namaKapal);
        return normC.includes(normQ) || normQ.includes(normC);
      });
      matchedShipName = matched[0]?.namaKapal;
    }
  }

  // Cari no telepon kapal dari kapalRekap
  let shipPhone: string | undefined;
  if (matchedShipName) {
    const k = kapalRekap.find(
      (kr) => kr.namaKapal.toLowerCase() === matchedShipName?.toLowerCase()
    );
    if (k && k.noTelp && k.noTelp !== '-') {
      shipPhone = k.noTelp;
    }
  } else {
    const normQ = normalizeShipNameForMatch(armada);
    const k = kapalRekap.find(
      (kr) => normalizeShipNameForMatch(kr.namaKapal) === normQ
    );
    if (k && k.noTelp && k.noTelp !== '-') {
      shipPhone = k.noTelp;
      matchedShipName = k.namaKapal;
    }
  }

  // Urutkan kru berdasarkan noKru (hierarki perwira -> AB/Oiler)
  matched.sort((a, b) => (a.noKru || 99) - (b.noKru || 99));

  return { crewList: matched, shipPhone, matchedShipName };
}
