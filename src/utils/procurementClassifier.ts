import initialInventoryData from '@/data/initialInventoryData.json';

/**
 * Intelligent Maritime Procurement Classifier
 * 
 * Powered by:
 * 1. 10,024 Corporate Master Inventory Database (exact & normalized lookup).
 * 2. Multi-tier Maritime & Marine Engineering Taxonomy (Caterpillar, Yanmar, Cummins, Mitsubishi,
 *    hydraulic systems, propulsion, deck/rigging, SOLAS, electrical, sounding pastes, technical chemicals).
 * 3. Deep Sub-Category Breakdown Engine for executive drilldowns.
 * 4. Contextual Semantic Inference (peruntukan, armada, work order, keterangan).
 */

export interface ClassificationResult {
  category: string;
  subCategory: string;
  confidence: 'database' | 'heuristic' | 'context' | 'fallback';
  matchedRule?: string;
}

export interface CategoryDetailMeta {
  count: number;
  percentage: number;
  subCategories: Record<string, number>;
  topItems: { name: string; count: number }[];
}

export interface FleetClassificationSummary {
  categories: Record<string, number>;
  subCategories: Record<string, number>;
  categoryDetails: Record<string, CategoryDetailMeta>;
  intellectualMetrics: {
    totalItems: number;
    classifiedCount: number;
    unclassifiedCount: number;
    classificationRate: number;
    dbMatchedCount: number;
    heuristicMatchedCount: number;
  };
}

// Canonical Primary Categories
export const CANONICAL_CATEGORIES = [
  'Suku Cadang Mesin',
  'Pipa & Hose Hidrolik',
  'Peralatan Listrik',
  'Gasket, Packing & Seal',
  'Fasteners & Hardware',
  'Pompa & Valve',
  'Material Logam & Las',
  'Cat & Zinc Anode',
  'Pelumas & Oli',
  'Kimia, Pembersih & Sounding',
  'Perlengkapan Deck & Tali',
  'Safety & K3 Maritim',
  'Alat Kerja Bengkel (Tools)',
  'Perlengkapan Akomodasi',
  'Navigasi & Komunikasi',
  'Kendaraan & Roda',
  'Jasa & Perbaikan',
  'Consumables & ATK',
  'Umum / Lainnya',
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

// Master mapping from initialInventoryData.json kategoriUtama to Canonical Category & Sub-category
const MASTER_INVENTORY_CATEGORY_MAP: Record<string, { category: CanonicalCategory; defaultSub: string }> = {
  'Permesinan & Mesin Kapal': { category: 'Suku Cadang Mesin', defaultSub: 'Komponen Internal Mesin' },
  'Filter & Separator': { category: 'Suku Cadang Mesin', defaultSub: 'Sistem Filtrasi Mesin' },
  'Transmisi, Bearing & Penggerak': { category: 'Suku Cadang Mesin', defaultSub: 'Bantalan & Transmisi' },
  'Pompa, Kompresor & HVAC': { category: 'Pompa & Valve', defaultSub: 'Pompa & Kompresor Kapal' },
  'Perpipaan, Selang & Sambungan': { category: 'Pipa & Hose Hidrolik', defaultSub: 'Pipa, Hose & Sambungan' },
  'Gasket, Packing & Seals': { category: 'Gasket, Packing & Seal', defaultSub: 'Gasket, Packing & Seal' },
  'Fasteners & Hardware': { category: 'Fasteners & Hardware', defaultSub: 'Baut, Mur & Hardware' },
  'Kelistrikan & Instrumentasi': { category: 'Peralatan Listrik', defaultSub: 'Kelistrikan & Instrumentasi' },
  'Material Logam & Konstruksi': { category: 'Material Logam & Las', defaultSub: 'Plat Besi & Konstruksi' },
  'Perkakas, Alat Kerja & Workshop': { category: 'Alat Kerja Bengkel (Tools)', defaultSub: 'Perkakas & Alat Bengkel' },
  'Cat, Lem & Perekat': { category: 'Cat & Zinc Anode', defaultSub: 'Cat Marine & Pelapis' },
  'Kimia & Pembersih Teknis': { category: 'Kimia, Pembersih & Sounding', defaultSub: 'Kimia & Pembersih Teknis' },
  'Pelumas & Gemuk': { category: 'Pelumas & Oli', defaultSub: 'Oli Mesin & Grease' },
  'Perlengkapan Dek & Rigging': { category: 'Perlengkapan Deck & Tali', defaultSub: 'Tali & Perlengkapan Dek' },
  'Keselamatan Kerja & SOLAS (Safety)': { category: 'Safety & K3 Maritim', defaultSub: 'Keselamatan Kerja & SOLAS' },
  'Pakaian Kerja & APD': { category: 'Safety & K3 Maritim', defaultSub: 'Pakaian Kerja & APD' },
  'Navigasi & Komunikasi Kapal': { category: 'Navigasi & Komunikasi', defaultSub: 'Perangkat Navigasi & Radio' },
  'Perlengkapan Mess, Dapur & Housekeeping': { category: 'Perlengkapan Akomodasi', defaultSub: 'Mess, Dapur & Akomodasi' },
  'Jasa & Layanan Operasional': { category: 'Jasa & Perbaikan', defaultSub: 'Jasa & Layanan Teknis' },
  'Administrasi, Dokumen & IT Kantor': { category: 'Consumables & ATK', defaultSub: 'Dokumen & ATK Kapal' },
  'Kesehatan & P3K Kapal': { category: 'Safety & K3 Maritim', defaultSub: 'Kotak Obat & P3K Kapal' },
  'Bahan Bakar & Kargo Minyak': { category: 'Pelumas & Oli', defaultSub: 'Bahan Bakar & Kargo Minyak' },
  'Akun Finansial & Biaya': { category: 'Jasa & Perbaikan', defaultSub: 'Biaya & Akun Operasional' },
};

// In-Memory Database Index
interface MasterIndexEntry {
  category: CanonicalCategory;
  subCategory: string;
}

const masterDescriptionIndex = new Map<string, MasterIndexEntry>();
let isIndexBuilt = false;

function buildMasterIndex() {
  if (isIndexBuilt) return;
  try {
    const list = initialInventoryData as any[];
    if (Array.isArray(list)) {
      list.forEach((item) => {
        const desc = (item.description || '').trim().toLowerCase();
        if (!desc) return;

        const rawCat = item.kategoriUtama || item.category || '';
        const rawSub = item.subKategori || '';

        let targetCat: CanonicalCategory = 'Umum / Lainnya';
        let targetSub = rawSub || 'Umum';

        const mapInfo = MASTER_INVENTORY_CATEGORY_MAP[rawCat];
        if (mapInfo) {
          targetCat = mapInfo.category;
          targetSub = rawSub || mapInfo.defaultSub;
        } else if (rawCat.includes('Material & Perlengkapan Operasional')) {
          // Sub-kategori specific mapping inside Material & Perlengkapan Operasional
          const sLower = rawSub.toLowerCase();
          if (sLower.includes('actuator') || sLower.includes('fitting') || sLower.includes('machino') || sLower.includes('adapter')) {
            targetCat = 'Pipa & Hose Hidrolik';
            targetSub = 'Fitting & Sambungan Selang';
          } else if (sLower.includes('shackle') || sLower.includes('swivel') || sLower.includes('kili') || sLower.includes('anting')) {
            targetCat = 'Perlengkapan Deck & Tali';
            targetSub = 'Shackle & Rigging';
          } else if (sLower.includes('busi') || sLower.includes('oil pan') || sLower.includes('oil cooler') || sLower.includes('push rod') || sLower.includes('tensioner') || sLower.includes('plunger') || sLower.includes('governoor')) {
            targetCat = 'Suku Cadang Mesin';
            targetSub = 'Komponen Mesin';
          } else if (sLower.includes('busbar') || sLower.includes('elcb') || sLower.includes('junction') || sLower.includes('plc') || sLower.includes('mppt') || sLower.includes('transformer') || sLower.includes('thermocouple') || sLower.includes('cable shoe') || sLower.includes('encoder')) {
            targetCat = 'Peralatan Listrik';
            targetSub = 'Panel & Otomasi Listrik';
          } else if (sLower.includes('zinc')) {
            targetCat = 'Cat & Zinc Anode';
            targetSub = 'Zinc Anode Proteksi Katodik';
          } else if (sLower.includes('hru') || sLower.includes('mob') || sLower.includes('ear muff') || sLower.includes('ear plug') || sLower.includes('seat belt')) {
            targetCat = 'Safety & K3 Maritim';
            targetSub = 'Keselamatan Kerja & APD';
          } else if (sLower.includes('wiper') || sLower.includes('gardan') || sLower.includes('shock') || sLower.includes('spackboard')) {
            targetCat = 'Kendaraan & Roda';
            targetSub = 'Suku Cadang Kendaraan';
          } else if (sLower.includes('kunci') || sLower.includes('fuller') || sLower.includes('gauge') || sLower.includes('brush') || sLower.includes('sikat') || sLower.includes('cup brush')) {
            targetCat = 'Alat Kerja Bengkel (Tools)';
            targetSub = 'Perkakas & Sikat Bengkel';
          } else if (sLower.includes('kain majun') || sLower.includes('deterjen') || sLower.includes('sabun')) {
            targetCat = 'Consumables & ATK';
            targetSub = 'Pembersih & Majun Operasional';
          } else if (sLower.includes('absorbent') || sLower.includes('dispersant') || sLower.includes('chemical')) {
            targetCat = 'Kimia, Pembersih & Sounding';
            targetSub = 'Chemical & Absorbent Pad';
          } else if (sLower.includes('repair') || sLower.includes('service') || sLower.includes('freight')) {
            targetCat = 'Jasa & Perbaikan';
            targetSub = 'Jasa & Layanan';
          } else {
            targetCat = 'Consumables & ATK';
            targetSub = rawSub || 'Perlengkapan Operasional';
          }
        }

        if (targetCat !== 'Umum / Lainnya' && !masterDescriptionIndex.has(desc)) {
          masterDescriptionIndex.set(desc, {
            category: targetCat,
            subCategory: targetSub,
          });
        }
      });
    }
  } catch (err) {
    console.error('Failed to index initial inventory data:', err);
  } finally {
    isIndexBuilt = true;
  }
}

// Normalize search text (remove part punctuation, excess spaces)
export function normalizeProcurementText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[,\/#!$%\^&\*;:{}=\_`~()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent Classifier Function
 */
export function classifyProcurementItem(
  rawItemText: string,
  it?: {
    item?: string;
    kategori?: string;
    keterangan?: string;
    peruntukan?: string;
    sisaMatch?: { primaryName?: string; allItems?: { nama?: string }[] };
    workOrderNo?: string;
    deptArmada?: string;
    armada?: string;
  }
): ClassificationResult {
  buildMasterIndex();

  const itemPrimary = (it?.item || '').trim();
  const sisaPrimary = it?.sisaMatch?.primaryName || '';
  const validItem = itemPrimary && itemPrimary !== '-' && itemPrimary.length > 2 ? itemPrimary : sisaPrimary;
  const rawCat = (it?.kategori || '').trim();
  const rawKet = (it?.keterangan || it?.peruntukan || '').trim();

  // 1. Direct Master Database Lookup
  const directKey = (validItem || rawItemText || '').toLowerCase().trim();
  if (directKey && masterDescriptionIndex.has(directKey)) {
    const entry = masterDescriptionIndex.get(directKey)!;
    return {
      category: entry.category,
      subCategory: entry.subCategory,
      confidence: 'database',
      matchedRule: 'Master Inventory DB Exact Match',
    };
  }

  // Combined text for deep domain heuristics
  const fullText = normalizeProcurementText(`${validItem} ${rawCat} ${rawKet} ${rawItemText}`);

  // 2. High-Priority Domain Rules (Indonesian & International Maritime Engineering Taxonomy)

  // A. Fasteners & Hardware (High priority to avoid dumping into ATK/Lainnya)
  if (
    /\b(baut|bolt|mur|nut|stud\s*bolt|studbolt|u-bolt|u\s*bolt|dynabolt|dinabolt|angkur|anchor\s*bolt|washer|ring\s*plat|ring\s*ver|spring\s*washer|sekrup|screw|tapping\s*screw|roofing|rivet|paku\s*keling|blind\s*rivet|allen\s*bolt|baut\s*l|baut\s*tanem|grub\s*screw|eyebolt|eye\s*bolt|eye\s*nut|mur\s*topi|nyloc|gembok|padlock|engsel|hinge|grendel|slot\s*pintu|door\s*closer|baut\s*roda|baut\s*flange)\b/.test(
      fullText
    ) ||
    /\b(m[0-9]{1,2}\s*x\s*[0-9]{1,3}|sus\s*304|sus\s*316|baja\s*8\.8|grade\s*8\.8|b7\s*stud)\b/.test(fullText)
  ) {
    let sub = 'Baut & Mur Hexagonal';
    if (fullText.includes('stud') || fullText.includes('as drat') || fullText.includes('all thread')) sub = 'Stud Bolt & As Drat';
    else if (fullText.includes('washer') || fullText.includes('ring plat') || fullText.includes('ring ver')) sub = 'Ring Plat & Washer';
    else if (fullText.includes('dynabolt') || fullText.includes('angkur') || fullText.includes('u-bolt') || fullText.includes('u bolt')) sub = 'U-Bolt & Dynabolt';
    else if (fullText.includes('sekrup') || fullText.includes('screw') || fullText.includes('rivet')) sub = 'Sekrup & Rivet';
    else if (fullText.includes('gembok') || fullText.includes('engsel') || fullText.includes('padlock')) sub = 'Gembok & Kunci Hardware';
    return { category: 'Fasteners & Hardware', subCategory: sub, confidence: 'heuristic', matchedRule: 'Fasteners & Hardware' };
  }

  // B. Gasket, Packing & Sealant (Vital maritime isolation category)
  if (
    /\b(gasket|packing|paking|perpak|klingerit|klinger|tombo|valqua|spiral\s*wound|swg|o-ring|oring|oil\s*seal|seal\s*kit|gland\s*packing|ptfe|teflon\s*sheet|teflon\s*tape|seal\s*tape|mechanical\s*seal|mekanikal\s*sil|silicone\s*sealant|threebond|loctite\s*567|loctite\s*242|loctite\s*518|auto\s*sealer|pure\s*graphite|asbestos\s*rope|perbunan|viton|dust\s*seal|wiper\s*seal|v-ring)\b/.test(
      fullText
    )
  ) {
    let sub = 'Gasket Lembaran & Klingerit';
    if (fullText.includes('spiral wound') || fullText.includes('swg')) sub = 'Spiral Wound & Flange Gasket';
    else if (fullText.includes('o-ring') || fullText.includes('oring') || fullText.includes('viton')) sub = 'O-Ring & Sealing Ring';
    else if (fullText.includes('oil seal') || fullText.includes('seal kit') || fullText.includes('mechanical seal')) sub = 'Oil Seal & Mechanical Seal';
    else if (fullText.includes('gland packing') || fullText.includes('pure graphite') || fullText.includes('tali paking')) sub = 'Gland Packing & Cord';
    else if (fullText.includes('sealant') || fullText.includes('silicone') || fullText.includes('loctite') || fullText.includes('threebond')) sub = 'Lem Gasket & Sealant';
    return { category: 'Gasket, Packing & Seal', subCategory: sub, confidence: 'heuristic', matchedRule: 'Gasket & Packing' };
  }

  // C. Kimia, Pembersih & Sounding (Bunker & maritime chemical operations)
  if (
    /\b(water\s*finding|kolor\s*kut|gasoline\s*gauging|pasta\s*air|pasta\s*minyak|pasta\s*sounding|sounding\s*paste|oil\s*dispersant|osd|dispersan|degreaser|carbon\s*remover|rust\s*remover|penetrant|penetrating|wd-40|wd40|rexco|contact\s*cleaner|electro\s*cleaner|descaler|scale\s*remover|cooling\s*water\s*treatment|kaporit|chlorine|absorbent\s*pad|oil\s*boom|spill\s*kit|kain\s*majun|majun\s*katun)\b/.test(
      fullText
    )
  ) {
    let sub = 'Chemical Pembersih & Degreaser';
    if (fullText.includes('water finding') || fullText.includes('kolor kut') || fullText.includes('pasta') || fullText.includes('sounding')) sub = 'Pasta Ukur Minyak / Air (Sounding)';
    else if (fullText.includes('dispersant') || fullText.includes('osd')) sub = 'Oil Spill Dispersant (OSD)';
    else if (fullText.includes('absorbent') || fullText.includes('majun') || fullText.includes('spill kit')) sub = 'Kain Majun & Absorbent Spill Kit';
    else if (fullText.includes('rust remover') || fullText.includes('wd-40') || fullText.includes('wd40') || fullText.includes('penetrant')) sub = 'Anti Karat & Penetrant Spray';
    return { category: 'Kimia, Pembersih & Sounding', subCategory: sub, confidence: 'heuristic', matchedRule: 'Kimia & Sounding' };
  }

  // D. Suku Cadang Mesin Utama & Propulsi
  if (
    /\b(filter|fuel\s*filter|oil\s*filter|air\s*filter|lube\s*oil\s*filter|separator|strainer\s*fuel|donaldson|fleetguard|sakura|baldwin|mann\s*filter|piston|liner|ring\s*piston|ring\s*set|cylinder\s*head|silinder|combustion|injector|injektor|nozzle|nosel|fip|bosch\s*pump|feed\s*pump|plunger|delivery\s*valve|rocker\s*arm|push\s*rod|camshaft|noken\s*as|crankshaft|kruk\s*as|conrod|connecting\s*rod|stang\s*piston|metal\s*jalan|metal\s*duduk|main\s*bearing|conrod\s*bearing|thrust\s*washer|turbo|turbocharger|cartridge\s*turbo|intercooler|aftercooler|radiator|thermostat|termostat|cooler|oil\s*cooler|heat\s*exchanger|impeler\s*karet|v-belt|fanbelt|fan\s*belt|timing\s*belt|pulley|puli|bearing|laher|klaker|koyo|nsk|skf|ntn|asahi|bushing|bush\s*metal|propeller|propeler|baling|stern\s*tube|cutlass\s*bearing|rudder|kemudi|daun\s*kemudi|as\s*kemudi|advance\s*gearbox|gearbox|clutch|kampas\s*kopling|flywheel|mesin|engine|caterpillar|yanmar|cummins|mitsubishi|weichai|deutz|perkins|komatsu|denso|bosch)\b/.test(
      fullText
    )
  ) {
    let sub = 'Komponen Internal Mesin';
    if (fullText.includes('filter') || fullText.includes('separator') || fullText.includes('strainer fuel') || fullText.includes('donaldson') || fullText.includes('fleetguard') || fullText.includes('sakura')) sub = 'Sistem Filtrasi Mesin';
    else if (fullText.includes('piston') || fullText.includes('liner') || fullText.includes('silinder') || fullText.includes('cylinder')) sub = 'Silinder, Piston & Liner';
    else if (fullText.includes('injector') || fullText.includes('nozzle') || fullText.includes('fip') || fullText.includes('bosch pump') || fullText.includes('plunger')) sub = 'Sistem Bahan Bakar & Injeksi';
    else if (fullText.includes('bearing') || fullText.includes('laher') || fullText.includes('klaker') || fullText.includes('koyo') || fullText.includes('skf') || fullText.includes('nsk')) sub = 'Bantalan Putar (Bearing)';
    else if (fullText.includes('v-belt') || fullText.includes('fan belt') || fullText.includes('fanbelt') || fullText.includes('pulley') || fullText.includes('gearbox') || fullText.includes('clutch')) sub = 'Transmisi, Gearbox & Belt';
    else if (fullText.includes('turbo') || fullText.includes('intercooler')) sub = 'Turbocharger & Exhaust';
    else if (fullText.includes('radiator') || fullText.includes('cooler') || fullText.includes('thermostat')) sub = 'Radiator & Sistem Pendingin';
    else if (fullText.includes('propeller') || fullText.includes('rudder') || fullText.includes('stern tube') || fullText.includes('kemudi')) sub = 'Propulsi, As Baling & Kemudi';
    return { category: 'Suku Cadang Mesin', subCategory: sub, confidence: 'heuristic', matchedRule: 'Engine & Propulsion' };
  }

  // E. Sistem Pipa, Hose & Fitting Hidrolik
  if (
    /\b(hose|selang|hidrolik|hydraulic|pipa|pipe|tubing|flange|flens|nepel|nipple|niple|double\s*nepel|bush\s*nepel|elbow|reducer|tee|camlock|quick\s*coupler|quick\s*coupling|watermur|water\s*mur|union|klem\s*pipa|hose\s*clamp|t-bolt|jubilee|pipa\s*sch|sch\s*40|sch\s*80|seamless|pipa\s*hitam|pipa\s*galvanis|toyo\s*spring|spiral\s*hose|selang\s*kawat|crimping\s*hose|bunker\s*hose|selang\s*bunker)\b/.test(
      fullText
    )
  ) {
    let sub = 'Fitting, Nepel & Sambungan';
    if (fullText.includes('hidrolik') || fullText.includes('hydraulic') || fullText.includes('crimping') || fullText.includes('hose r')) sub = 'Hose Tekanan & Hidrolik';
    else if (fullText.includes('flange') || fullText.includes('flens') || fullText.includes('jis 10k') || fullText.includes('ansi 150')) sub = 'Flange & Sambungan Flens';
    else if (fullText.includes('camlock') || fullText.includes('quick coupler')) sub = 'Camlock & Quick Coupler Bunker';
    else if (fullText.includes('selang') || fullText.includes('toyo') || fullText.includes('bunker')) sub = 'Selang Minyak & Transfer';
    else if (fullText.includes('pipa') || fullText.includes('pipe') || fullText.includes('sch')) sub = 'Pipa Baja, Besi & Seamless';
    return { category: 'Pipa & Hose Hidrolik', subCategory: sub, confidence: 'heuristic', matchedRule: 'Piping & Hydraulic' };
  }

  // F. Pompa, Kompresor & Valve
  if (
    /\b(pompa|pump|valve|kran|stop\s*kran|ball\s*valve|gate\s*valve|globe\s*valve|check\s*valve|butterfly\s*valve|safety\s*valve|relief\s*valve|foot\s*valve|tusen\s*klep|impeller|impeler|kompresor|compressor|airman|swan|shark|strainer|y-strainer|basket\s*strainer|ejector|sight\s*glass|diaphragm|solenoid\s*valve|actuator\s*valve|ebara|grundfos|torishima|ksb)\b/.test(
      fullText
    )
  ) {
    let sub = 'Pompa Sentrifugal & Transfer';
    if (fullText.includes('valve') || fullText.includes('kran') || fullText.includes('klep')) sub = 'Katup & Valve Kapal (Gate/Globe/Check)';
    else if (fullText.includes('kompresor') || fullText.includes('compressor')) sub = 'Kompresor Udara & Tabung Tekanan';
    else if (fullText.includes('impeller') || fullText.includes('strainer') || fullText.includes('sight glass')) sub = 'Impeller & Saringan Pompa (Strainer)';
    return { category: 'Pompa & Valve', subCategory: sub, confidence: 'heuristic', matchedRule: 'Pump & Valve' };
  }

  // G. Peralatan Listrik, Instrumentasi & Otomasi
  if (
    /\b(kabel|cable|supreme|jembo|eterna|kabelmetal|nyy|nym|nymhy|marine\s*cable|lampu|lamp|bulb|led|sorot|floodlight|searchlight|accu|aki|battery|baterai|yuasa|gs\s*astra|rocket|mcb|mccb|acb|kontaktor|contactor|relay|trafo|transformer|inverter|genset|generator|dinamo|dynamo|alternator|starter\s*motor|carbon\s*brush|avr|saklar|switch|terminal|skun|fuse|sekring|schneider|abb|chint|pressure\s*gauge|manometer|multimeter|avometer|sensor|tachometer|hour\s*meter|running\s*hour|listrik|electric|voltage)\b/.test(
      fullText
    )
  ) {
    let sub = 'Kabel & Instalasi Penerangan';
    if (fullText.includes('lampu') || fullText.includes('lamp') || fullText.includes('led') || fullText.includes('floodlight')) sub = 'Lampu & Penerangan Kapal';
    else if (fullText.includes('accu') || fullText.includes('aki') || fullText.includes('battery') || fullText.includes('baterai')) sub = 'Aki & Baterai Cadangan Kapal';
    else if (fullText.includes('mcb') || fullText.includes('mccb') || fullText.includes('kontaktor') || fullText.includes('relay') || fullText.includes('panel')) sub = 'Panel Listrik, MCB & Breaker';
    else if (fullText.includes('genset') || fullText.includes('alternator') || fullText.includes('dynamo') || fullText.includes('avr') || fullText.includes('starter motor')) sub = 'Generator, Dinamo & AVR';
    else if (fullText.includes('gauge') || fullText.includes('manometer') || fullText.includes('sensor') || fullText.includes('meter')) sub = 'Instrumen Ukur & Sensor';
    return { category: 'Peralatan Listrik', subCategory: sub, confidence: 'heuristic', matchedRule: 'Electrical & Automation' };
  }

  // H. Cat, Coating & Zinc Anode (Cathodic protection & marine paints)
  if (
    /\b(cat|paint|marine\s*paint|primer|epoxy|antifouling|anti-fouling|af\s*paint|topside|deck\s*paint|boottopping|jotun|international\s*paint|chugoku|hempel|kansai|thinner|tiner|redusol|zinc\s*anode|anoda|zink\s*anode|aluminium\s*anode|sacrificial\s*anode|kuas|brush|roller\s*cat|kape|scraper|dempul|sanpolac|autofill|coating|polyurethane)\b/.test(
      fullText
    )
  ) {
    let sub = 'Cat Marine & Anti-Fouling';
    if (fullText.includes('anode') || fullText.includes('anoda')) sub = 'Zinc Anode Proteksi Katodik';
    else if (fullText.includes('thinner') || fullText.includes('tiner')) sub = 'Thinner & Pelarut Cat';
    else if (fullText.includes('dempul') || fullText.includes('sanpolac') || fullText.includes('kuas') || fullText.includes('roller')) sub = 'Dempul, Kuas & Perlengkapan Cat';
    else if (fullText.includes('epoxy') || fullText.includes('primer')) sub = 'Primer & Epoxy Coating';
    return { category: 'Cat & Zinc Anode', subCategory: sub, confidence: 'heuristic', matchedRule: 'Paint & Cathodic' };
  }

  // I. Pelumas, Oli & Grease
  if (
    /\b(oli|oil|pelumas|lubricant|grease|gemuk|meditran|turalik|rored|salyx|pertamina\s*marine|delo|rimula|tellus|rando|omala|corena|sae\s*40|15w-40|vg\s*46|vg\s*68|coolant|air\s*radiator|grease\s*ep|chassis\s*grease)\b/.test(
      fullText
    )
  ) {
    let sub = 'Oli Mesin Diesel Kapal';
    if (fullText.includes('turalik') || fullText.includes('hidrolik') || fullText.includes('hydraulic') || fullText.includes('tellus') || fullText.includes('vg 46')) sub = 'Oli Hidrolik Kapal';
    else if (fullText.includes('rored') || fullText.includes('gear') || fullText.includes('omala')) sub = 'Oli Gear & Transmisi';
    else if (fullText.includes('grease') || fullText.includes('gemuk')) sub = 'Gemuk / Grease Pelumas';
    else if (fullText.includes('coolant') || fullText.includes('radiator')) sub = 'Radiator Coolant & Cairan Pendingin';
    return { category: 'Pelumas & Oli', subCategory: sub, confidence: 'heuristic', matchedRule: 'Lubricants & Oil' };
  }

  // J. Material Logam, Plat, Profil & Pengelasan
  if (
    /\b(plat|plate|besi|baja|plat\s*kapal|marine\s*plate|bordes|strip\s*bar|siku|angle\s*bar|hollow|unp|wf|h-beam|round\s*bar|as\s*bulat|kawat\s*las|welding|elektroda|rb-26|rd-260|lb-52|kobe\s*steel|nikko\s*steel|batu\s*gerinda|batu\s*gurinda|cutting\s*disc|grinding\s*disc|amplas|sandpaper|flap\s*disc|stang\s*las|blender\s*las|cutting\s*torch|spandek|galvalum|grating|expanda)\b/.test(
      fullText
    )
  ) {
    let sub = 'Plat Besi & Baja Kapal';
    if (fullText.includes('kawat las') || fullText.includes('welding') || fullText.includes('elektroda') || fullText.includes('rb-26') || fullText.includes('lb-52')) sub = 'Kawat Las & Perlengkapan Pengelasan';
    else if (fullText.includes('gerinda') || fullText.includes('gurinda') || fullText.includes('amplas') || fullText.includes('cutting disc')) sub = 'Batu Gerinda, Amplas & Potong';
    else if (fullText.includes('siku') || fullText.includes('hollow') || fullText.includes('unp') || fullText.includes('wf') || fullText.includes('round bar')) sub = 'Besi Profil (Siku, Hollow, UNP, WF)';
    else if (fullText.includes('spandek') || fullText.includes('galvalum') || fullText.includes('grating')) sub = 'Konstruksi Galvalum & Grating';
    return { category: 'Material Logam & Las', subCategory: sub, confidence: 'heuristic', matchedRule: 'Steel & Welding' };
  }

  // K. Perlengkapan Deck, Mooring & Rigging
  if (
    /\b(tali|rope|tros|tali\s*tambat|mooring|tali\s*pp|polypropylene|tali\s*manila|cirtex|sling|seling|wire\s*rope|webbing\s*sling|round\s*sling|jangkar|anchor|rantai|chain|rantai\s*jangkar|shackle|segel|segel\s*omega|crosby|turnbuckle|jarum\s*keras|kuku\s*macan|wire\s*clip|thimble|causen|winch|capstan|fairlead|bollard|fender|fender\s*ban|terpal|tarpaulin|penutup\s*palka|kenter\s*shackle)\b/.test(
      fullText
    )
  ) {
    let sub = 'Tali Tros & Tambat Kapal';
    if (fullText.includes('seling') || fullText.includes('sling') || fullText.includes('wire rope') || fullText.includes('webbing')) sub = 'Wire Rope & Webbing Sling';
    else if (fullText.includes('shackle') || fullText.includes('segel') || fullText.includes('turnbuckle') || fullText.includes('jarum keras') || fullText.includes('kuku macan')) sub = 'Shackle, Kuku Macan & Jarum Keras';
    else if (fullText.includes('jangkar') || fullText.includes('rantai') || fullText.includes('anchor')) sub = 'Jangkar & Rantai Kapal';
    else if (fullText.includes('fender') || fullText.includes('bollard')) sub = 'Fender & Perlengkapan Dermaga';
    else if (fullText.includes('terpal')) sub = 'Terpal & Penutup Palka';
    return { category: 'Perlengkapan Deck & Tali', subCategory: sub, confidence: 'heuristic', matchedRule: 'Deck & Mooring' };
  }

  // L. Keselamatan Maritim & APD (Safety & SOLAS)
  if (
    /\b(safety|pemadam|apar|fire\s*extinguisher|lifebuoy|life\s*buoy|ring\s*buoy|pelampung|lifejacket|life\s*jacket|lampu\s*mob|hrd|hydrostatic\s*release|flare|red\s*hand|smoke\s*signal|parachute|scba|helm\s*safety|safety\s*helmet|sepatu\s*safety|safety\s*shoes|boot\s*safety|sarung\s*tangan|safety\s*glove|kacamata\s*safety|ear\s*plug|ear\s*muff|wearpack|coverall|baju\s*kerja|rompi\s*safety|safety\s*vest|p3k|first\s*aid|gas\s*detector|respirator)\b/.test(
      fullText
    )
  ) {
    let sub = 'Alat Pelindung Diri (APD)';
    if (fullText.includes('apar') || fullText.includes('pemadam') || fullText.includes('fire extinguisher')) sub = 'APAR & Tabung Pemadam Api';
    else if (fullText.includes('lifejacket') || fullText.includes('lifebuoy') || fullText.includes('pelampung')) sub = 'Lifejacket & Pelampung Penolong';
    else if (fullText.includes('flare') || fullText.includes('smoke signal') || fullText.includes('parachute') || fullText.includes('hrd')) sub = 'Piroteknik & Isyarat Bahaya SOLAS';
    else if (fullText.includes('wearpack') || fullText.includes('coverall') || fullText.includes('seragam')) sub = 'Wearpack & Pakaian Kerja Lapangan';
    else if (fullText.includes('p3k') || fullText.includes('first aid') || fullText.includes('gas detector') || fullText.includes('scba')) sub = 'Kotak P3K & Detektor Gas Medis';
    return { category: 'Safety & K3 Maritim', subCategory: sub, confidence: 'heuristic', matchedRule: 'Safety & SOLAS' };
  }

  // M. Alat Kerja Bengkel & Perkakas (Tools)
  if (
    /\b(kunci|wrench|spanner|kunci\s*pas|kunci\s*ring|kunci\s*inggris|kunci\s*pipa|kunci\s*sok|obeng|screwdriver|tang|pliers|tang\s*buaya|palu|hammer|bodem|dongkrak|jack|bottle\s*jack|chain\s*block|lever\s*block|takel|bor|drill|mata\s*bor|gergaji|hacksaw|tracker|treker|puller|ragum|vice|kikir|file|sikat\s*kawat|cup\s*brush|meteran|measuring\s*tape|jangka\s*sorong|caliper|sounding\s*tape|bandul\s*sounding|perkakas|toolbox)\b/.test(
      fullText
    )
  ) {
    let sub = 'Kunci Ring, Pas & Soket';
    if (fullText.includes('dongkrak') || fullText.includes('chain block') || fullText.includes('lever block') || fullText.includes('takel')) sub = 'Dongkrak, Chain Block & Takel';
    else if (fullText.includes('kunci pipa') || fullText.includes('pipe wrench')) sub = 'Kunci Pipa & Chain Tong';
    else if (fullText.includes('tang') || fullText.includes('obeng') || fullText.includes('palu')) sub = 'Tang, Obeng & Palu';
    else if (fullText.includes('treker') || fullText.includes('tracker') || fullText.includes('ragum')) sub = 'Treker Bearing & Ragum Meja';
    else if (fullText.includes('bor') || fullText.includes('kikir') || fullText.includes('gergaji')) sub = 'Mata Bor, Kikir & Alat Potong';
    else if (fullText.includes('sounding tape') || fullText.includes('meteran') || fullText.includes('caliper')) sub = 'Pita Ukur & Sounding Tape';
    return { category: 'Alat Kerja Bengkel (Tools)', subCategory: sub, confidence: 'heuristic', matchedRule: 'Workshop Tools' };
  }

  // N. Navigasi, Komunikasi & IT Kapal
  if (
    /\b(navigasi|radio|vhf|ssb|walkie|ht|handy\s*talkie|transceiver|antena|antenna|radar|gps|gps\s*plotter|ais|echo\s*sounder|sounder|kompas|compass|clinometer|barometer|anemometer|cctv|printer|tinta|cartridge|ribbon|komputer|laptop|pc|monitor|hardisk|hdd|ups|stabilizer)\b/.test(
      fullText
    )
  ) {
    let sub = 'Radio Komunikasi (VHF / SSB / HT)';
    if (fullText.includes('radar') || fullText.includes('gps') || fullText.includes('ais') || fullText.includes('sounder') || fullText.includes('kompas')) sub = 'Navigasi Elektronik (GPS/Radar/AIS)';
    else if (fullText.includes('printer') || fullText.includes('tinta') || fullText.includes('laptop') || fullText.includes('komputer') || fullText.includes('cctv')) sub = 'Komputer, IT & CCTV Kapal';
    return { category: 'Navigasi & Komunikasi', subCategory: sub, confidence: 'heuristic', matchedRule: 'Navigation & Telecom' };
  }

  // O. Perlengkapan Akomodasi & Galley
  if (
    /\b(ac|air\s*conditioner|ac\s*split|remote\s*ac|freon|kompresor\s*ac|kipas|fan|exhaust|kulkas|freezer|showcase|kasur|bed|sprei|bantal|selimut|dapur|galley|kompor|stove|rice\s*cooker|blender|dispenser|water\s*heater|pemanas|gas\s*lpg|tabung\s*gas|toilet|kloset|saniter|shower|wastafel|akomodasi)\b/.test(
      fullText
    )
  ) {
    let sub = 'Peralatan Galley & Dapur Kapal';
    if (fullText.includes('ac') || fullText.includes('air conditioner') || fullText.includes('freon') || fullText.includes('kipas')) sub = 'Pendingin Udara (AC) & Ventilasi';
    else if (fullText.includes('kulkas') || fullText.includes('freezer')) sub = 'Kulkas & Pendingin Bahan Makanan';
    else if (fullText.includes('kasur') || fullText.includes('sprei') || fullText.includes('bantal')) sub = 'Perlengkapan Tidur & Mess Crew';
    else if (fullText.includes('toilet') || fullText.includes('shower') || fullText.includes('kloset') || fullText.includes('wastafel')) sub = 'Sanitasi & Kamar Mandi Kapal';
    return { category: 'Perlengkapan Akomodasi', subCategory: sub, confidence: 'heuristic', matchedRule: 'Accommodation & Galley' };
  }

  // P. Jasa, Perbaikan & Docking
  if (
    /\b(jasa|ongkos|sewa|perbaikan|service|servis|overhaul|bubut|kalibrasi|inspeksi|sertifikasi|docking|dock\s*yard|replating|cleaning\s*tangki|gas\s*freeing|rewinding|gulung\s*dinamo|sewa\s*crane|sewa\s*klotok|freight|ekspedisi|transportasi|spk)\b/.test(
      fullText
    )
  ) {
    let sub = 'Jasa Perbaikan & Servis Mesin';
    if (fullText.includes('docking') || fullText.includes('replating') || fullText.includes('survey bki')) sub = 'Jasa Docking & Shipyard';
    else if (fullText.includes('bubut') || fullText.includes('fabrikasi') || fullText.includes('las')) sub = 'Jasa Bubut & Fabrikasi Logam';
    else if (fullText.includes('rewinding') || fullText.includes('gulung')) sub = 'Jasa Rewinding Dinamo & Kelistrikan';
    else if (fullText.includes('sewa') || fullText.includes('ongkos') || fullText.includes('freight') || fullText.includes('transportasi')) sub = 'Sewa Alat & Jasa Transportasi Logistik';
    else if (fullText.includes('kalibrasi') || fullText.includes('inspeksi') || fullText.includes('gas freeing')) sub = 'Jasa Kalibrasi & Inspeksi Safety';
    return { category: 'Jasa & Perbaikan', subCategory: sub, confidence: 'heuristic', matchedRule: 'Services & Docking' };
  }

  // Q. Kendaraan & Logistik Operasional Roda
  if (
    /\b(ban\s*luar|ban\s*dalam|velg|flap\s*ban|tambal\s*ban|wiper|shockbreaker|shock\s*absorber|kampas\s*rem|brake\s*pad|kendaraan|mobil|truk|truck|forklift|gardan)\b/.test(
      fullText
    )
  ) {
    let sub = 'Ban & Roda Kendaraan';
    if (fullText.includes('kampas rem') || fullText.includes('shockbreaker') || fullText.includes('wiper')) sub = 'Suku Cadang Mobil & Truk';
    return { category: 'Kendaraan & Roda', subCategory: sub, confidence: 'heuristic', matchedRule: 'Vehicles & Logistics' };
  }

  // R. Consumables & ATK Kantor / Logistik
  if (
    /\b(kertas|kertas\s*hvs|buku|log\s*book|jurnal|oil\s*record|atk|spidol|pulpen|stempel|tinta\s*stempel|stapler|lakban|isolasi|solasi|sapu|pel|kantong\s*sampah|sabun|deterjen|bayclin|sunlight|rinso|plastik|banner|stiker|bendera)\b/.test(
      fullText
    )
  ) {
    let sub = 'Alat Tulis Kantor (ATK)';
    if (fullText.includes('log book') || fullText.includes('jurnal') || fullText.includes('oil record')) sub = 'Buku Jurnal & Log Book Resmi';
    else if (fullText.includes('sapu') || fullText.includes('pel') || fullText.includes('kantong sampah') || fullText.includes('sabun') || fullText.includes('deterjen')) sub = 'Housekeeping & Perlengkapan Bersih';
    else if (fullText.includes('lakban') || fullText.includes('isolasi') || fullText.includes('tape')) sub = 'Lakban & Pita Perekat';
    else if (fullText.includes('bendera') || fullText.includes('banner')) sub = 'Bendera Isyarat & Spanduk';
    return { category: 'Consumables & ATK', subCategory: sub, confidence: 'heuristic', matchedRule: 'Consumables & ATK' };
  }

  // 3. Fallback: Contextual Inspection from Armada or Work Order
  if (it?.workOrderNo && it.workOrderNo.startsWith('WO-ENG')) {
    return { category: 'Suku Cadang Mesin', subCategory: 'Komponen Mesin (Konteks WO)', confidence: 'context', matchedRule: 'WO Context Engine' };
  }
  if (it?.workOrderNo && it.workOrderNo.startsWith('WO-ELC')) {
    return { category: 'Peralatan Listrik', subCategory: 'Kelistrikan (Konteks WO)', confidence: 'context', matchedRule: 'WO Context Electric' };
  }

  // Final fallback
  return {
    category: 'Umum / Lainnya',
    subCategory: 'Barang Operasional Lainnya',
    confidence: 'fallback',
    matchedRule: 'Unrecognized Generic',
  };
}

/**
 * Palette mapping for charts
 */
export const CATEGORY_COLOR_PALETTE: Record<string, string> = {
  'Suku Cadang Mesin': '#0284c7', // Sky Blue
  'Pipa & Hose Hidrolik': '#0d9488', // Teal
  'Peralatan Listrik': '#7c3aed', // Purple
  'Gasket, Packing & Seal': '#f97316', // Orange
  'Fasteners & Hardware': '#8b5cf6', // Indigo Violet
  'Pompa & Valve': '#06b6d4', // Cyan
  'Material Logam & Las': '#ea580c', // Rust Orange
  'Cat & Zinc Anode': '#ec4899', // Pink / Rose
  'Pelumas & Oli': '#eab308', // Amber / Gold
  'Kimia, Pembersih & Sounding': '#14b8a6', // Light Teal
  'Perlengkapan Deck & Tali': '#4f46e5', // Deep Indigo
  'Safety & K3 Maritim': '#10b981', // Emerald
  'Alat Kerja Bengkel (Tools)': '#6366f1', // Soft Indigo
  'Perlengkapan Akomodasi': '#38bdf8', // Light Sky
  'Navigasi & Komunikasi': '#2563eb', // Royal Blue
  'Kendaraan & Roda': '#e11d48', // Crimson Red
  'Jasa & Perbaikan': '#64748b', // Slate Gray
  'Consumables & ATK': '#84cc16', // Lime Green
  'Umum / Lainnya': '#94a3b8', // Muted Slate
};

export function getCategoryColor(cat: string): string {
  return CATEGORY_COLOR_PALETTE[cat] || '#64748b';
}

/**
 * Builds aggregated summary of categories, sub-categories, and drilldown details
 */
export function buildFleetClassificationSummary(items: any[]): FleetClassificationSummary {
  const categories: Record<string, number> = {};
  const subCategories: Record<string, number> = {};
  const categoryDetails: Record<string, CategoryDetailMeta> = {};

  CANONICAL_CATEGORIES.forEach((c) => {
    categories[c] = 0;
    categoryDetails[c] = {
      count: 0,
      percentage: 0,
      subCategories: {},
      topItems: [],
    };
  });

  let classifiedCount = 0;
  let dbMatchedCount = 0;
  let heuristicMatchedCount = 0;
  const itemFreqByCategory: Record<string, Record<string, number>> = {};

  items.forEach((it) => {
    const rawItem = (it.item || '').trim();
    const sisaPrimary = it.sisaMatch?.primaryName || '';
    const validItem = rawItem && rawItem !== '-' && rawItem.length > 2 ? rawItem : sisaPrimary;
    const text = `${validItem} ${it.kategori || ''} ${it.keterangan || (it as any).peruntukan || ''}`.trim();

    const result = classifyProcurementItem(text, it);
    const cat = result.category;
    const sub = result.subCategory;

    categories[cat] = (categories[cat] || 0) + 1;
    subCategories[sub] = (subCategories[sub] || 0) + 1;

    if (!categoryDetails[cat]) {
      categoryDetails[cat] = {
        count: 0,
        percentage: 0,
        subCategories: {},
        topItems: [],
      };
    }
    categoryDetails[cat].count++;
    categoryDetails[cat].subCategories[sub] = (categoryDetails[cat].subCategories[sub] || 0) + 1;

    // Item frequency
    if (validItem) {
      if (!itemFreqByCategory[cat]) itemFreqByCategory[cat] = {};
      itemFreqByCategory[cat][validItem] = (itemFreqByCategory[cat][validItem] || 0) + 1;
    }

    if (cat !== 'Umum / Lainnya') {
      classifiedCount++;
    }
    if (result.confidence === 'database') {
      dbMatchedCount++;
    } else if (result.confidence === 'heuristic') {
      heuristicMatchedCount++;
    }
  });

  const total = items.length;

  // Calculate percentages and top items
  Object.keys(categoryDetails).forEach((cat) => {
    const cMeta = categoryDetails[cat];
    cMeta.percentage = total > 0 ? Math.round((cMeta.count / total) * 100) : 0;

    const freqs = itemFreqByCategory[cat] || {};
    cMeta.topItems = Object.entries(freqs)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  const unclassifiedCount = categories['Umum / Lainnya'] || 0;
  const classificationRate = total > 0 ? Math.round(((total - unclassifiedCount) / total) * 100) : 100;

  return {
    categories,
    subCategories,
    categoryDetails,
    intellectualMetrics: {
      totalItems: total,
      classifiedCount,
      unclassifiedCount,
      classificationRate,
      dbMatchedCount,
      heuristicMatchedCount,
    },
  };
}

