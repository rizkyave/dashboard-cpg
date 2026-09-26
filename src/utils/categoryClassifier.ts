/**
 * Category Classifier for Inventory Items
 * Intelligently classifies inventory items into 6 core operational categories:
 * - Mechanical
 * - Consumable
 * - Electrical
 * - Construction
 * - Jasa
 * - General
 */

export function determineCategory(
  code: string = '',
  desc: string = '',
  itemType: string = ''
): string {
  const c = String(code || '').toUpperCase().trim();
  const d = String(desc || '').toUpperCase().trim();
  const t = String(itemType || '').toUpperCase().trim();
  const text = `${c} ${d} ${t}`;

  // 1. Jasa (Services / Rent / Inspection)
  if (
    c.startsWith('JAS') ||
    c.startsWith('SRV') ||
    t.includes('JASA') ||
    t.includes('SERVICE') ||
    /\b(JASA|SEWA|RENTAL|ONGKOS|BIAYA|SERVICE|REPAIR|PERBAIKAN|OVERHAUL|INSPEKSI|TESTING|SERTIFIKASI|KALIBRASI|CLEANING|EXPEDISI|CARGO|TRANSPORTASI|FORWARDING)\b/.test(text)
  ) {
    return 'Jasa';
  }

  // 2. Electrical (Electrical components, cables, instrumentation, lighting)
  if (
    c.startsWith('EL') ||
    c.startsWith('ELEC') ||
    c.startsWith('INST') ||
    /\b(KABEL|CABLE|LAMPU|LAMP|BULB|MCB|BREAKER|CONTACTOR|RELAY|SWITCH|SAKLAR|SOCKET|STEKER|BATTERY|BATERAI|ACCU|PANEL|TRANSFORMATOR|TRAFO|INVERTER|SOLENOID|SENSOR|FUSE|SEKERING|VOLT|AMPERE|WATT|TERMINAL BLOCK|GENSET|DYNAMO|DINAMO|ALTERNATOR|STATOR|ROTOR|WIRING|PLUG|FITTING|BALLAST|CAPACITOR|KAPASITOR)\b/.test(text)
  ) {
    return 'Electrical';
  }

  // 3. Construction (Building materials, steel plates, piping, structural)
  if (
    c.startsWith('CON') ||
    c.startsWith('SIP') ||
    c.startsWith('STR') ||
    /\b(PLAT|PLATE|BESI|PIPA|PIPE|HOLLOW|SQUARE PIPE|SUDUT|SIKU|WF|H-BEAM|UNP|CNP|SEMEN|CEMENT|PASIR|BATU|CAT|PAINT|THINNER|TINER|ZINC ANODE|EPOXY|PRIMER|COATING|DEMPUL|PLASTER|KERAMIK|SENG|ATAP|BORDES|EXPANDED|GRATING|WIRE MESH|BEAM|CANAL|CHANNEL|TIANG|SCAFFOLDING|TRIPLEK|PLYWOOD|KAYU)\b/.test(text)
  ) {
    return 'Construction';
  }

  // 4. Consumable (PPE, safety, cleaning, office, lubricants, filters, welding consumables)
  if (
    c.startsWith('CON') ||
    c.startsWith('CSM') ||
    c.startsWith('SFT') ||
    /\b(SARUNG TANGAN|GLOVE|MASKER|MASK|HELM|HELMET|SAFETY SHOES|SEPATU SAFETY|KACAMATA SAFETY|BOOTS|WEARPACK|EARPLUG|EARMUFF|HARNESS|APAR|RAGS|MAJUN|TISU|SABUN|DETERGENT|GREASE|GEMUK|OLI|OIL|LUBRICANT|FILTER|ELEMENT|SOLVENT|CLEANER|SEAL TAPE|ISOLASI|TAPE|LAKBAN|LEM|GLUE|SEALANT|SILICONE|GAS OKSIGEN|ACETYLENE|ARGON|ELPIJI|LPG|KAWAT LAS|ELECTRODE|WELDING WIRE|BATU GERINDA|CUTTING WHEEL|GRINDING WHEEL|AMPLAS|SANDPAPER|SPIDOL|KERTAS|PULPEN|KARTON)\b/.test(text)
  ) {
    return 'Consumable';
  }

  // 5. Mechanical (Engines, pumps, valves, bearings, mechanical fasteners, tools, machinery parts)
  if (
    c.startsWith('MEC') ||
    c.startsWith('MECH') ||
    c.startsWith('ENG') ||
    c.startsWith('HYD') ||
    c.startsWith('PMP') ||
    /\b(MESIN|ENGINE|MOTOR|POMPA|PUMP|BEARING|KLAHAR|VALVE|KRAN|KATUP|SEAL|GASKET|O-RING|ORING|BELT|V-BELT|FAN BELT|TIMING BELT|PULLEY|GEAR|GIGI|SPROCKET|RANTAI|CHAIN|COUPLING|KOPEL|SHAFT|AS|PISTON|RING PISTON|CYLINDER|LINER|NOZZLE|INJECTOR|TURBO|TURBOCHARGER|IMPELLER|ROD|CONNECTING ROD|BUSHING|SPRING|PER|BOLT|BAUT|NUT|MUR|SCREW|SEKRUP|WASHER|RING PLAT|FLANGE|ELBOW|TEE|NIPPLE|UNION|FITTING|HOSE|SELANG|HYDRAULIC|PNEUMATIC|WINCH|ANCHOR|JANGKAR|PROPELLER|BALING|RUDDER|KEMUDI|CRANE|HOIST|TOOL|KUNCI|TANG|OBENG|HAMMER|PALU|JACK|DONGKRAK)\b/.test(text)
  ) {
    return 'Mechanical';
  }

  // 6. Default Fallback: General
  return 'General';
}
