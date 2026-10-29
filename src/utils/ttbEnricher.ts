import { UploadedTtbItem } from '@/types/ttbUpload';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';

/**
 * Normalisasi nomor TTB (menghilangkan spasi, strip, dan karakter non-alphanumeric, uppercase)
 */
export function normalizeTtbNumber(str: string): string {
  if (!str) return '';
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Ekstraksi angka saja dari nomor TTB (misal CPL-TTB-26-07618 -> 2607618)
 */
export function extractTtbDigits(str: string): string {
  if (!str) return '';
  return str.replace(/\D/g, '');
}

/**
 * Ekstraksi kode prefix entitas (CPL, HL, MO, GAJ, MIL, SP, PPI, SSK)
 */
export function extractEntityPrefix(str: string): string {
  if (!str) return '';
  const m = str.match(/^(CPL|HL|MO|GAJ|MIL|SP|PPI|SSK)/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Sumber data untuk pengayaan metadata TTB
 */
export interface TtbEnrichmentSources {
  procurementItems?: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  sisaLayananItems?: SisaLayananItem[];
  docRelationRef?: any;
  budiTtbRecords?: any[];
}

/**
 * Perkaya satu record UploadedTtbItem dengan data dari Monitoring Internal & referensi
 */
export function enrichSingleTtbItem(
  item: UploadedTtbItem,
  sources: TtbEnrichmentSources
): UploadedTtbItem {
  const updated: UploadedTtbItem = { ...item };
  const rawTtb = (updated.noTtb || updated.cleanNoTtb || updated.renamedFileName || '')
    .replace(/\.pdf$/i, '')
    .trim();

  const clean = normalizeTtbNumber(rawTtb);
  const digits = extractTtbDigits(rawTtb);
  const tail5 = digits.length >= 5 ? digits.slice(-5) : digits;
  const prefix = extractEntityPrefix(rawTtb);

  // 1. Cari di Monitoring Internal (procurementItems)
  if (sources.procurementItems && sources.procurementItems.length > 0) {
    const procMatch = sources.procurementItems.find((p) => {
      const pRaw = (p.noTtb || (p as any).ttb || '').trim();
      if (!pRaw || pRaw === '-') return false;
      const pClean = normalizeTtbNumber(pRaw);
      if (pClean === clean) return true;

      const pDigits = extractTtbDigits(pRaw);
      const pPrefix = extractEntityPrefix(pRaw) || (p.entity || '').toUpperCase();

      const prefixMatch = !prefix || !pPrefix || prefix === pPrefix;
      if (prefixMatch) {
        if (digits && pDigits && digits === pDigits) return true;
        if (tail5 && pDigits && pDigits.endsWith(tail5)) return true;
      }
      return false;
    });

    if (procMatch) {
      // 1. Armada / Unit (Prioritas dari Monitoring Internal)
      const arm = (procMatch.deptArmada || procMatch.peruntukan || '').trim();
      if (arm && arm !== '-') {
        updated.armada = arm;
      }

      // 2. No. FPB (Prioritas dari Monitoring Internal)
      const fpb = (procMatch.fpb || '').trim();
      if (fpb && fpb !== '-') {
        updated.noFpb = fpb;
      }

      // 3. No. PO (Prioritas dari Monitoring Internal)
      const po = (procMatch.po || procMatch.noPo || '').trim();
      if (po && po !== '-') {
        updated.noPo = po;
      } else {
        // Jika di monitoring internal belum ada nomor PO, reset PO agar tidak memakai dummy PO lama
        updated.noPo = '-';
      }

      // 4. Pengunggah / PIC Logistik TTB (Prioritas dari Monitoring Internal)
      const pic = (procMatch.picTtb || (procMatch as any).creator || procMatch.picPch || '').trim();
      if (pic && pic !== '-') {
        const picUpper = pic.toUpperCase();
        let resolvedName = picUpper;
        if (picUpper === 'FIFI' || picUpper.includes('HAFIFAH')) {
          resolvedName = 'FIFI';
          updated.uploaderUsername = 'nurul.hafifah';
          updated.uploaderNik = 'MP-DAO-0490';
          updated.uploaderJabatan = 'Admin Logistik TTB';
        } else if (picUpper.includes('IDHAM')) {
          resolvedName = 'IDHAM KHALID';
          updated.uploaderUsername = 'idham.khalid';
          updated.uploaderNik = 'MP-DAO-0534';
          updated.uploaderJabatan = 'Admin Logistik';
        } else if (picUpper.includes('DAVILA') || picUpper.includes('VILA')) {
          resolvedName = 'DAVILA ZALIANTI PUTRI';
          updated.uploaderUsername = 'davila.zalianti';
          updated.uploaderNik = 'MP-DAO-0662';
          updated.uploaderJabatan = 'Admin Logistik';
        }
        updated.uploaderName = resolvedName;
        updated.isAutoStamped = true;
      }
    }
  }

  // 2. Cari di Data Armada (armadaItems)
  if (sources.armadaItems && sources.armadaItems.length > 0) {
    if (!updated.armada || updated.armada === '-' || !updated.noPo || updated.noPo === '-') {
      const armMatch = sources.armadaItems.find((a) => {
        const aRaw = (a.noTtb || '').trim();
        if (!aRaw || aRaw === '-') return false;
        const aClean = normalizeTtbNumber(aRaw);
        if (aClean === clean) return true;
        const aDigits = extractTtbDigits(aRaw);
        return digits && aDigits && digits === aDigits;
      });

      if (armMatch) {
        if (!updated.armada || updated.armada === '-' || updated.armada === 'SEMUA ARMADA') {
          if (armMatch.armada && armMatch.armada !== '-') updated.armada = armMatch.armada;
        }
        if (!updated.noPo || updated.noPo === '-') {
          if (armMatch.noPo && armMatch.noPo !== '-') updated.noPo = armMatch.noPo;
        }
        if (!updated.noFpb || updated.noFpb === '-') {
          if (armMatch.fpb && armMatch.fpb !== '-') updated.noFpb = armMatch.fpb;
        }
      }
    }
  }

  // 3. Cari di Data Sisa Layanan (sisaLayananItems)
  if (sources.sisaLayananItems && sources.sisaLayananItems.length > 0) {
    if (!updated.armada || updated.armada === '-' || !updated.noPo || updated.noPo === '-') {
      const sisaMatch = sources.sisaLayananItems.find((s) => {
        const sRaw = (s.noTtb || '').trim();
        if (!sRaw || sRaw === '-') return false;
        const sClean = normalizeTtbNumber(sRaw);
        if (sClean === clean) return true;
        const sDigits = extractTtbDigits(sRaw);
        return digits && sDigits && digits === sDigits;
      });

      if (sisaMatch) {
        if (!updated.armada || updated.armada === '-' || updated.armada === 'SEMUA ARMADA') {
          if (sisaMatch.departement && sisaMatch.departement !== '-') updated.armada = sisaMatch.departement;
        }
        if (!updated.noPo || updated.noPo === '-') {
          if (sisaMatch.noPo && sisaMatch.noPo !== '-') updated.noPo = sisaMatch.noPo;
        }
        if (!updated.noFpb || updated.noFpb === '-') {
          if (sisaMatch.noFpb && sisaMatch.noFpb !== '-') updated.noFpb = sisaMatch.noFpb;
        }
      }
    }
  }

  // 4. Cari di Google Sheet TTB Pak Budi (budiTtbRecords)
  if (sources.budiTtbRecords && Array.isArray(sources.budiTtbRecords)) {
    const budiMatch = sources.budiTtbRecords.find((b) => {
      const bRaw = (b.ttbAccurate || '').trim();
      if (!bRaw) return false;
      const bClean = normalizeTtbNumber(bRaw);
      if (bClean === clean) return true;
      const bDigits = extractTtbDigits(bRaw);
      return (tail5 && bDigits.endsWith(tail5)) || (digits && bDigits === digits);
    });

    if (budiMatch) {
      if (!updated.armada || updated.armada === '-' || updated.armada === 'SEMUA ARMADA') {
        if (budiMatch.deptArmada && budiMatch.deptArmada !== '-') updated.armada = budiMatch.deptArmada;
      }
      if (!updated.noFpb || updated.noFpb === '-') {
        if (budiMatch.noFpb && budiMatch.noFpb !== '-') updated.noFpb = budiMatch.noFpb;
      }
      if (!updated.uploaderName || updated.uploaderName === '-') {
        if (budiMatch.picTtb && budiMatch.picTtb !== '-') {
          updated.uploaderName = budiMatch.picTtb.toUpperCase();
          updated.uploaderJabatan = 'Staf Logistik CPG';
          updated.isAutoStamped = true;
        }
      }
    }
  }

  // 5. Cari di Referensi Relasi Dokumen (docRelationRef.byTtb)
  if (sources.docRelationRef && sources.docRelationRef.byTtb) {
    const byTtb = sources.docRelationRef.byTtb;
    let relMatch: any = byTtb[rawTtb] || byTtb[clean];

    if (!relMatch) {
      // Cari berbasis digits / tail5
      for (const k of Object.keys(byTtb)) {
        const kDigits = extractTtbDigits(k);
        const kPrefix = extractEntityPrefix(k);
        const prefixMatch = !prefix || !kPrefix || prefix === kPrefix;
        if (prefixMatch && (kDigits === digits || (tail5 && kDigits.endsWith(tail5)))) {
          relMatch = byTtb[k];
          break;
        }
      }
    }

    if (relMatch) {
      if (!updated.armada || updated.armada === '-' || updated.armada === 'SEMUA ARMADA') {
        if (relMatch.armada && relMatch.armada !== '-') updated.armada = relMatch.armada;
      }
      if (!updated.noPo || updated.noPo === '-') {
        if (relMatch.po && relMatch.po !== '-') updated.noPo = relMatch.po;
      }
      if (!updated.noFpb || updated.noFpb === '-') {
        if (relMatch.fpb && relMatch.fpb !== '-') updated.noFpb = relMatch.fpb;
      }
    }
  }

  // 6. Fallback Pengunggah Standar jika belum tercatat di sistem
  if (!updated.uploaderName || updated.uploaderName === '-') {
    updated.uploaderName = 'STAF LOGISTIK CPG';
    updated.isAutoStamped = true;
  }

  return updated;
}

/**
 * Perkaya kumpulan UploadedTtbItem secara massal
 */
export function enrichTtbRecords(
  items: UploadedTtbItem[],
  sources: TtbEnrichmentSources
): UploadedTtbItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => enrichSingleTtbItem(item, sources));
}

