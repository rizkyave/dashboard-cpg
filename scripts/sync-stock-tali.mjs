import fs from 'fs';
import path from 'path';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/export?format=csv&gid=2021352613';
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'stock-tali-data.json');

export function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  }

  // Line 0 is Title: LAPORAN MUTASI BARANG STOCK TALI
  // Line 1 is Headers
  const startIndex = lines[0].toLowerCase().includes('laporan mutasi') ? 2 : 1;
  const items = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 2) continue;
    const no = cols[0] || '';
    const pt = cols[1] || '';
    const deptArmada = cols[2] || '';
    if (!no && !deptArmada && !pt) continue;

    items.push({
      no: no,
      pt: pt,
      deptArmada: deptArmada,
      noFpb: cols[3] || '',
      picTtb: cols[4] || '',
      ttb: cols[5] || '',
      tglInputTtb: cols[6] || '',
      tglKeTimLapangan: cols[7] || '',
      keterangan: cols[8] || '',
      lapseDay1: cols[9] || '',
      picLapangan: cols[10] || '',
      tglBarangDiantar: cols[11] || '',
      keteranganAntar: cols[12] || '',
      tglTimLapKePicTtb: cols[13] || '',
      lapseDay2: cols[14] || '',
      tglTtbKePicPch: cols[15] || '',
      keteranganPch: cols[16] || '',
      lapseDay3: cols[17] || '',
    });
  }

  return items;
}

async function run() {
  console.log('Fetching Google Sheet GID 2021352613...');
  const res = await fetch(SHEET_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
  }
  const csv = await res.text();
  const items = parseCsvRows(csv);
  console.log(`Successfully parsed ${items.length} rows.`);

  const payload = {
    updatedAt: new Date().toISOString(),
    sourceUrl: 'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=2021352613#gid=2021352613',
    total: items.length,
    items: items,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Saved to ${OUTPUT_FILE}`);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

