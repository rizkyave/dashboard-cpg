/**
 * Mesin Deteksi Cerdas Metadata & Armada Kapal untuk Upload FSTB (Form Serah Terima Barang)
 * 
 * Menggabungkan 4 Lapisan Deteksi:
 * Layer 1: In-Browser PDF Text Stream Extractor (membaca teks 'USER : [ARMADA]', 'FSTB No', 'DO No')
 * Layer 2: Master Fleet Matcher (520+ armada resmi CPG dari realFleetData & database relasi)
 * Layer 3: Relational Reference Database (7.898 arsip FSTB dari doc-relation-reference)
 * Layer 4: Interactive Quick Lookup & Datalist Autocomplete
 */

import { extractFstbComponents } from './fstbRename';
import { resolveDocRelation } from './docRelationResolver';
import docRelationRef from '@/data/doc-relation-reference.json';
import realFleetData from '@/data/realFleetData.json';

export interface FstbDetectedMetadata {
  noFstb: string;
  armada: string;
  doNo: string;
  noFpb: string;
  receivedDate?: string;
  isAutoMatched: boolean;
  matchSource?: string;
}

export interface FstbSuggestionItem {
  noFstb: string;
  armada: string;
  noFpb?: string;
  doNo?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// 1. KOMPILASI MASTER DAFTAR ARMADA & UNIT OPERASIONAL CPG
// ---------------------------------------------------------------------------
const armadaSet = new Set<string>();

// Dari realFleetData (525 armada/unit)
if (Array.isArray(realFleetData)) {
  for (const f of realFleetData as any[]) {
    if (f.name && typeof f.name === 'string' && f.name.trim()) {
      armadaSet.add(f.name.trim().toUpperCase());
    }
  }
}

// Dari doc-relation-reference (byFstb & byTtb)
const rawRef = docRelationRef as any;
if (rawRef?.byFstb) {
  for (const key of Object.keys(rawRef.byFstb)) {
    const item = rawRef.byFstb[key];
    if (item?.armada && typeof item.armada === 'string' && item.armada.trim()) {
      armadaSet.add(item.armada.trim().toUpperCase());
    }
  }
}

// Tambahan alias armada strategis maritim CPG
const strategicArmadas = [
  'TB KING STAR', 'TK CPL 250', 'TK CPL 235', 'SPOB CINTIANA PRATAMA',
  'TB MUARA MEGA', 'MT DEWA YANI', 'MT DOMINO', 'TB PMI ABADI',
  'SPOB SEA LION', 'SPOB CINDARA', 'UB CMPL 01', 'OFFICE GAJ', 'WORKSHOP',
  'TK CINDARA 1100', 'SPEED BOAT KENARI', 'MT BLUE PETROL', 'TRUCK TANKI B 9067 FFU',
  'TB BAHTERA', 'TB ROYAL REY 07', 'TK ROYAL REY 300', 'TK ROYAL REY 350',
  'SPOB OCEAN MANDAR', 'SPOB MUARA MAS JAYA', 'TB TWINSISTER', 'TB COASTWAY',
];
for (const s of strategicArmadas) {
  armadaSet.add(s.toUpperCase());
}

export const MASTER_ARMADA_LIST: string[] = Array.from(armadaSet).sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' })
);

// ---------------------------------------------------------------------------
// 2. IN-BROWSER PDF TEXT EXTRACTOR
// ---------------------------------------------------------------------------
/**
 * Mengekstrak token teks literal dari berkas PDF (stream latin1 / Tj operators)
 * Berjalan sangat cepat langsung di browser client (< 10 ms).
 */
export async function extractPdfTextTokens(file: File): Promise<string[]> {
  try {
    // Ambil 384 KB awal dokumen (cukup untuk header & metadata FSTB)
    const slice = file.slice(0, 384 * 1024);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Decode ke string biner latin1
    let binary = '';
    const chunkSize = 16384;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }

    const strings: string[] = [];
    
    // Pola 1: Literal text operator (text) Tj
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(binary)) !== null) {
      const s = match[1].trim();
      if (s && s !== ':') strings.push(s);
    }

    // Pola 2: Hex string text operator <484558> Tj
    const hexTjRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
    while ((match = hexTjRegex.exec(binary)) !== null) {
      const hex = match[1];
      if (hex.length % 2 === 0 && hex.length >= 4) {
        let decoded = '';
        for (let c = 0; c < hex.length; c += 2) {
          decoded += String.fromCharCode(parseInt(hex.substr(c, 2), 16));
        }
        decoded = decoded.trim();
        if (decoded && decoded !== ':') strings.push(decoded);
      }
    }

    return strings;
  } catch (err) {
    console.warn('[fstbDetector] Gagal ekstraksi teks PDF client-side:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 3. PENCARIAN PINTAR RELASI DOKUMEN FSTB (No. FSTB -> Kapal, PO, FPB)
// ---------------------------------------------------------------------------
/**
 * Mencari relasi dari nomor FSTB menggunakan database referensi 7.898 FSTB CPG.
 */
export function lookupFstbRelation(inputFstb: string): {
  canonicalFstb?: string;
  armada?: string;
  poNumber?: string;
  fpbNumber?: string;
} {
  if (!inputFstb || !inputFstb.trim()) return {};

  const clean = inputFstb.trim().toUpperCase();
  const digits = clean.replace(/\D/g, '');

  // 1. Gunakan resolveDocRelation bawaan
  try {
    const resolved = resolveDocRelation('FSTB', clean);
    if (resolved?.armada || resolved?.poNumber || resolved?.fpbNumber) {
      return {
        canonicalFstb: clean,
        armada: resolved.armada,
        poNumber: resolved.poNumber,
        fpbNumber: resolved.fpbNumber,
      };
    }
  } catch {}

  // 2. Pencarian langsung ke indeks rawRef.byFstb
  if (rawRef?.byFstb) {
    let found = rawRef.byFstb[clean] || (digits ? rawRef.byFstb[digits] : null);

    if (!found && digits && digits.length >= 4) {
      const prefix = extractFstbComponents(clean).prefix;
      const key = Object.keys(rawRef.byFstb).find((k) => {
        const kDigits = k.replace(/\D/g, '');
        const matchDigits = kDigits === digits || kDigits.endsWith(digits) || digits.endsWith(kDigits);
        if (!matchDigits) return false;
        if (prefix) {
          const kPrefix = k.split('-')[0].toUpperCase();
          if (kPrefix && kPrefix !== prefix) return false;
        }
        return true;
      });
      if (key) found = rawRef.byFstb[key];
    }

    if (found) {
      return {
        canonicalFstb: clean,
        armada: found.armada || undefined,
        poNumber: found.po || undefined,
        fpbNumber: found.fpb || undefined,
      };
    }
  }

  return {};
}

// ---------------------------------------------------------------------------
// 4. MESIN UTAMA: DETEKSI LENGKAP METADATA FSTB DARI FILE
// ---------------------------------------------------------------------------
/**
 * Mendeteksi Nomor FSTB, Nama Armada / Kapal, No. DO/PO, No. FPB, dan Tanggal FSTB
 * secara otomatis dengan memeriksa:
 * 1. Teks dalam berkas PDF (jika berupa PDF).
 * 2. Pola penamaan berkas (filename regex).
 * 3. Database relasi internal (doc-relation-reference 7.898 FSTB).
 * 4. Master armada CPG (520+ armada & kapal).
 */
export async function detectFstbMetadata(
  file: File,
  suggestions: FstbSuggestionItem[] = []
): Promise<FstbDetectedMetadata> {
  const fileName = file.name;
  const isPdf = fileName.toLowerCase().endsWith('.pdf');

  let detectedNoFstb = '';
  let detectedArmada = '';
  let detectedDoNo = '';
  let detectedNoFpb = '';
  let detectedDate: string | undefined;
  let matchSource = '';

  // ---------------------------------------------------------
  // TAHAP 1: EKSTRAKSI DARI KONTEN TEKS PDF (JIKA BERKAS PDF)
  // ---------------------------------------------------------
  if (isPdf) {
    const pdfTokens = await extractPdfTextTokens(file);

    if (pdfTokens.length > 0) {
      for (let i = 0; i < pdfTokens.length; i++) {
        const token = pdfTokens[i];

        // 1. Deteksi Nomor FSTB dari PDF
        if (!detectedNoFstb) {
          const fstbMatch = token.match(/([A-Z]{2,6}-FSTB-\d{2}-\d{3,6}|FSTB-\d{2}-\d{3,6})/i);
          if (fstbMatch) {
            detectedNoFstb = fstbMatch[1].toUpperCase();
          } else if (/FSTB\s*No\.?/i.test(token) && pdfTokens[i + 1]) {
            const next = pdfTokens[i + 1];
            const nextMatch = next.match(/([A-Z]{2,6}-FSTB-\d{2}-\d{3,6}|FSTB-\d{2}-\d{3,6})/i);
            if (nextMatch) detectedNoFstb = nextMatch[1].toUpperCase();
          }
        }

        // 2. Deteksi DO No. / PO No. dari PDF
        if (!detectedDoNo) {
          const poMatch = token.match(/([A-Z]{2,6}-PO-\d{2}-\d{3,6}|PO-\d{2}-\d{3,6})/i);
          if (poMatch) {
            detectedDoNo = poMatch[1].toUpperCase();
          } else if (/DO\s*No\.?/i.test(token) && pdfTokens[i + 1]) {
            const next = pdfTokens[i + 1];
            const nextMatch = next.match(/([A-Z]{2,6}-PO-\d{2}-\d{3,6}|PO-\d{2}-\d{3,6})/i);
            if (nextMatch) detectedDoNo = nextMatch[1].toUpperCase();
          }
        }

        // 3. Deteksi Tanggal FSTB dari PDF
        if (!detectedDate) {
          const dateMatch = token.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
          if (dateMatch && (/Date/i.test(pdfTokens[i - 1] || '') || dateMatch[1].length >= 8)) {
            // Ubah format DD/MM/YYYY ke YYYY-MM-DD untuk input date
            const parts = dateMatch[1].split(/[/-]/);
            if (parts.length === 3) {
              const d = parts[0].padStart(2, '0');
              const m = parts[1].padStart(2, '0');
              const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              detectedDate = `${y}-${m}-${d}`;
            }
          }
        }

        // 4. Deteksi Nama Armada / USER dari PDF
        if (!detectedArmada) {
          const upperToken = token.toUpperCase();

          // Cek jika token cocok dengan salah satu Master Armada
          for (const arm of MASTER_ARMADA_LIST) {
            if (
              upperToken === arm ||
              (arm.length >= 6 && upperToken.includes(arm)) ||
              (upperToken.length >= 6 && arm.includes(upperToken))
            ) {
              // Hindari mencocokkan nama PT perusahaan atau nama modul
              if (
                !upperToken.startsWith('PT ') &&
                !upperToken.includes('FORM SERAH') &&
                !upperToken.includes('FSTB') &&
                !upperToken.includes('PURCHASING')
              ) {
                detectedArmada = arm;
                matchSource = `Isi PDF: ${arm}`;
                break;
              }
            }
          }

          // Cek pola awalan jenis kapal maritim (TB, TK, SPOB, MT, BG, dll.)
          if (!detectedArmada) {
            const vMatch = token.match(/\b(TB|TK|SPOB|MT|KM|BG|OB|TRUCK|OFFICE|WORKSHOP)\s+[A-Z0-9\s]{2,25}\b/i);
            if (
              vMatch &&
              !token.includes('PT ') &&
              !token.includes('FORM ') &&
              !token.includes('FSTB') &&
              !token.includes('PO ')
            ) {
              const cleanedArm = vMatch[0].trim().toUpperCase();
              detectedArmada = cleanedArm;
              matchSource = `Isi PDF (Pola Kapal): ${cleanedArm}`;
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------
  // TAHAP 2: EKSTRAKSI NOMOR FSTB DARI NAMA BERKAS (FALLBACK)
  // ---------------------------------------------------------
  if (!detectedNoFstb) {
    const comp = extractFstbComponents(fileName);
    if (comp.canonicalFstb) {
      detectedNoFstb = comp.canonicalFstb;
    }
  }

  // ---------------------------------------------------------
  // TAHAP 3: LOOKUP RELASI DATABASE (7.898 FSTB CPG)
  // ---------------------------------------------------------
  if (detectedNoFstb && (!detectedArmada || !detectedDoNo || !detectedNoFpb)) {
    const rel = lookupFstbRelation(detectedNoFstb);
    if (rel.armada && !detectedArmada) {
      detectedArmada = rel.armada;
      matchSource = matchSource || `Database Relasi FSTB: ${rel.armada}`;
    }
    if (rel.poNumber && !detectedDoNo) {
      detectedDoNo = rel.poNumber;
    }
    if (rel.fpbNumber && !detectedNoFpb) {
      detectedNoFpb = rel.fpbNumber;
    }
  }

  // ---------------------------------------------------------
  // TAHAP 4: MATCHING KE DATASET SARAN (SUGGESTIONS DARI APP)
  // ---------------------------------------------------------
  if (suggestions.length > 0 && (!detectedArmada || !detectedDoNo)) {
    const targetNum = detectedNoFstb
      ? detectedNoFstb.replace(/\D/g, '')
      : extractFstbComponents(fileName).rawNumber;

    if (targetNum) {
      const padded = targetNum.padStart(5, '0');
      const foundSugg = suggestions.find((s) => {
        const cleanS = s.noFstb.replace(/\D/g, '');
        return cleanS.endsWith(targetNum) || cleanS.endsWith(padded);
      });

      if (foundSugg) {
        if (!detectedNoFstb) detectedNoFstb = foundSugg.noFstb;
        if (!detectedArmada && foundSugg.armada) {
          detectedArmada = foundSugg.armada;
          matchSource = matchSource || `Dataset Saran: ${foundSugg.armada}`;
        }
        if (!detectedDoNo && foundSugg.doNo) detectedDoNo = foundSugg.doNo;
        if (!detectedNoFpb && foundSugg.noFpb) detectedNoFpb = foundSugg.noFpb;
      }
    }
  }

  // ---------------------------------------------------------
  // TAHAP 5: EKSTRAKSI NAMA KAPAL DARI NAMA BERKAS (FILENAME)
  // ---------------------------------------------------------
  if (!detectedArmada) {
    const cleanFileName = fileName.toUpperCase().replace(/[_\-.]+/g, ' ');
    for (const arm of MASTER_ARMADA_LIST) {
      if (arm.length >= 4 && cleanFileName.includes(arm)) {
        detectedArmada = arm;
        matchSource = matchSource || `Nama Berkas: ${arm}`;
        break;
      }
    }
  }

  return {
    noFstb: detectedNoFstb,
    armada: detectedArmada,
    doNo: detectedDoNo,
    noFpb: detectedNoFpb,
    receivedDate: detectedDate,
    isAutoMatched: Boolean(detectedNoFstb && detectedArmada),
    matchSource: matchSource || undefined,
  };
}
