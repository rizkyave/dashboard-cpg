import * as XLSX from 'xlsx';
import {
  KapalRekapItem,
  CrewMasterItem,
  LowongItem,
  CadetMonitoringItem,
  AuditLogItem,
  CrewKapalSummary,
} from '@/types/crewKapal';
import {
  initialKapalRekap,
  initialMasterCrew,
  initialLowong,
  initialCadet,
  initialAuditLogs,
  initialCrewSummary,
} from '@/data/initialCrewData';

const STORAGE_KEY_CREW = 'CPG_CREW_KAPAL_DATA_V1';

export interface StoredCrewData {
  summary: CrewKapalSummary;
  kapalRekap: KapalRekapItem[];
  masterCrew: CrewMasterItem[];
  posisiLowong: LowongItem[];
  cadetMonitoring: CadetMonitoringItem[];
  auditLogs: AuditLogItem[];
  lastUpdated: string;
}

export function loadCrewData(): StoredCrewData {
  if (typeof window === 'undefined') {
    return {
      summary: initialCrewSummary,
      kapalRekap: initialKapalRekap,
      masterCrew: initialMasterCrew,
      posisiLowong: initialLowong,
      cadetMonitoring: initialCadet,
      auditLogs: initialAuditLogs,
      lastUpdated: '15 Oktober 2026',
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CREW);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.masterCrew) && parsed.masterCrew.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading stored crew data:', err);
  }

  return {
    summary: initialCrewSummary,
    kapalRekap: initialKapalRekap,
    masterCrew: initialMasterCrew,
    posisiLowong: initialLowong,
    cadetMonitoring: initialCadet,
    auditLogs: initialAuditLogs,
    lastUpdated: '15 Oktober 2026',
  };
}

export function saveCrewData(data: StoredCrewData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CREW, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('cpg_crew_data_changed'));
  } catch (err) {
    console.error('Error saving crew data:', err);
  }
}

export function resetCrewData(): StoredCrewData {
  const base: StoredCrewData = {
    summary: initialCrewSummary,
    kapalRekap: initialKapalRekap,
    masterCrew: initialMasterCrew,
    posisiLowong: initialLowong,
    cadetMonitoring: initialCadet,
    auditLogs: initialAuditLogs,
    lastUpdated: '15 Oktober 2026',
  };
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_CREW);
    window.dispatchEvent(new CustomEvent('cpg_crew_data_changed'));
  }
  return base;
}

/**
 * Export all 5 sheets to Excel .xlsx workbook
 */
export function exportCrewDataToExcel(data: StoredCrewData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Armada
  const rekapRows = data.kapalRekap.map((k) => ({
    'No': k.no,
    'No. Kapal': k.noKapal,
    'Nama Kapal': k.namaKapal,
    'Tipe Kapal': k.tipeKapal,
    'GT': k.gt,
    'Mesin (HP)': k.mesinHp,
    'Daya (KW/PS)': k.dayaKwPs,
    'No. Telp / Call Kapal': k.noTelp,
    'Total Kuota': k.totalKuota,
    'Kru Aktif': k.kruAktif,
    'Cadet': k.cadet,
    'Posisi Lowong': k.posisiLowong,
    'Persentase Terisi': k.persentaseTerisi,
  }));
  const wsRekap = XLSX.utils.json_to_sheet(rekapRows);
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Ringkasan Armada');

  // Sheet 2: Master Crew
  const crewRows = data.masterCrew.map((c) => ({
    'No. ID': c.id,
    'No. Kapal': c.noKapal,
    'Nama Kapal': c.namaKapal,
    'Tipe Kapal': c.tipeKapal,
    'No. Kru': c.noKru,
    'NIK': c.nik,
    'Nama Personel': c.namaPersonel,
    'Status Slot': c.statusSlot,
    'Jabatan': c.jabatan,
    'Departemen': c.departemen,
    'No. Handphone': c.noHp,
    'Ijazah / Sertifikat': c.ijazah,
    'Tahun Ijazah': c.tahunIjazah,
    'Tgl On Board': c.tglOnBoard,
    'Status Penugasan': c.statusPenugasan,
    'Asal Kampus / Sekolah': c.asalKampus,
    'Riwayat Mutasi': c.catatanMutasi,
    'Catatan Audit': c.catatanAudit,
  }));
  const wsCrew = XLSX.utils.json_to_sheet(crewRows);
  XLSX.utils.book_append_sheet(wb, wsCrew, 'Data Master Crew');

  // Sheet 3: Posisi Lowong
  const lowongRows = data.posisiLowong.map((l) => ({
    'No': l.no,
    'No. Kapal': l.noKapal,
    'Nama Kapal': l.namaKapal,
    'Tipe Kapal': l.tipeKapal,
    'Jabatan yang Dibutuhkan': l.jabatan,
    'Departemen': l.departemen,
    'Kualifikasi Standar': l.kualifikasi,
    'No. Telp Kapal': l.noTelpKapal,
    'Rekomendasi Tindakan HR': l.rekomendasi,
  }));
  const wsLowong = XLSX.utils.json_to_sheet(lowongRows);
  XLSX.utils.book_append_sheet(wb, wsLowong, 'Posisi Lowong');

  // Sheet 4: Monitoring Cadet
  const cadetRows = data.cadetMonitoring.map((cad) => ({
    'No': cad.no,
    'No. Kapal': cad.noKapal,
    'Nama Kapal': cad.namaKapal,
    'Nama Cadet': cad.namaCadet,
    'Jabatan': cad.jabatan,
    'Departemen': cad.departemen,
    'No. Handphone': cad.noHp,
    'Sertifikat': cad.sertifikat,
    'Tgl On Board': cad.tglOnBoard,
    'Asal Kampus': cad.asalKampus,
    'Catatan': cad.catatan,
  }));
  const wsCadet = XLSX.utils.json_to_sheet(cadetRows);
  XLSX.utils.book_append_sheet(wb, wsCadet, 'Monitoring Cadet');

  // Sheet 5: Log Audit
  const auditRows = data.auditLogs.map((a) => ({
    'No': a.no,
    'Baris Sumber': a.barisSumber,
    'Kategori Masalah': a.kategoriMasalah,
    'Deskripsi Temuan': a.deskripsi,
  }));
  const wsAudit = XLSX.utils.json_to_sheet(auditRows);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Log Audit Data');

  XLSX.writeFile(wb, `DATA_CREW_KAPAL_PT_CPL_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function findHeaderRow(rows: any[][], requiredCols: string[]): number {
  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const rowStr = (rows[r] || []).map((x) => String(x || '').trim().toUpperCase()).join(' | ');
    const allFound = requiredCols.every((col) => rowStr.includes(col.toUpperCase()));
    if (allFound) return r;
  }
  return -1;
}

function formatExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return String(val).trim();
}

function formatExcelPhone(val: any): string {
  if (!val) return '';
  let str = String(val).trim().replace(/[`\s]/g, '');
  if (str.startsWith('8') && str.length >= 10 && str.length <= 13) {
    str = '0' + str;
  }
  return str;
}

/**
 * Parsing berkas Excel Data Crew & Monitoring Armada Kapal
 * Mendukung template lengkap 5 sheet maupun sheet Master Crew tunggal.
 */
export function parseCrewWorkbook(wb: XLSX.WorkBook): StoredCrewData {
  let masterCrew: CrewMasterItem[] = [];
  let kapalRekap: KapalRekapItem[] = [];
  let posisiLowong: LowongItem[] = [];
  let cadetMonitoring: CadetMonitoringItem[] = [];
  let auditLogs: AuditLogItem[] = [];

  // 1. Data Master Crew
  const crewSheetName = wb.SheetNames.find((s) => /master|crew/i.test(s));
  if (crewSheetName) {
    const sheet = wb.Sheets[crewSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const hIdx =
      findHeaderRow(rows, ['Nama Personel']) !== -1
        ? findHeaderRow(rows, ['Nama Personel'])
        : findHeaderRow(rows, ['NIK', 'Jabatan']);

    if (hIdx !== -1) {
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: hIdx, defval: '' });
      masterCrew = json
        .map((r, i) => {
          return {
            id: Number(r['No. ID'] || r['No'] || i + 1),
            noKapal: String(r['No. Kapal'] || r['No Kapal'] || '').trim(),
            namaKapal: String(r['Nama Kapal'] || '').trim(),
            tipeKapal: String(r['Tipe Kapal'] || '').trim(),
            noKru: Number(r['No. Kru'] || r['No Kru'] || i + 1),
            nik: String(r['NIK'] || '').trim(),
            namaPersonel: String(r['Nama Personel'] || r['Nama'] || '').trim(),
            statusSlot: String(r['Status Slot'] || 'AKTIF').trim(),
            jabatan: String(r['Jabatan'] || '').trim(),
            departemen: String(r['Departemen'] || '').trim(),
            noHp: formatExcelPhone(r['No. Handphone'] || r['No Handphone'] || r['No HP'] || ''),
            ijazah: String(r['Ijazah / Sertifikat'] || r['Ijazah'] || '').trim(),
            tahunIjazah: String(r['Tahun Ijazah'] || '-').trim(),
            tglOnBoard: formatExcelDate(r['Tgl On Board'] || r['Tanggal On Board'] || ''),
            statusPenugasan: String(r['Status Penugasan'] || '-').trim(),
            asalKampus: String(r['Asal Kampus / Sekolah (Cadet)'] || r['Asal Kampus'] || '-').trim(),
            catatanMutasi: String(r['Riwayat / Catatan Mutasi'] || r['Riwayat Mutasi'] || '-').trim(),
            catatanAudit: String(r['Catatan Audit Data'] || r['Catatan Audit'] || '-').trim(),
          };
        })
        .filter((c) => c.namaKapal && c.namaPersonel);
    }
  }

  // 2. Ringkasan Rekap Armada
  const rekapSheetName = wb.SheetNames.find((s) => /rekap|armada/i.test(s));
  if (rekapSheetName) {
    const sheet = wb.Sheets[rekapSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const hIdx =
      findHeaderRow(rows, ['Nama Kapal', 'Total Kuota']) !== -1
        ? findHeaderRow(rows, ['Nama Kapal', 'Total Kuota'])
        : findHeaderRow(rows, ['Nama Kapal', 'Kuota']);

    if (hIdx !== -1) {
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: hIdx, defval: '' });
      kapalRekap = json
        .map((r, i) => {
          const totalKuota = Number(r['Total Kuota'] || r['Kuota'] || 0);
          const kruAktif = Number(r['Kru Aktif'] || 0);
          const cadet = Number(r['Cadet'] || 0);
          const posisiLowong = Number(r['Posisi Lowong'] || 0);
          const terisi = kruAktif + cadet;
          const ratio = totalKuota > 0 ? (terisi / totalKuota) * 100 : 100;
          return {
            no: Number(r['No'] || i + 1),
            noKapal: String(r['No. Kapal'] || r['No Kapal'] || '').trim(),
            namaKapal: String(r['Nama Kapal'] || '').trim(),
            tipeKapal: String(r['Tipe Kapal'] || '').trim(),
            gt: String(r['GT'] || '').trim(),
            mesinHp: String(r['Mesin (HP)'] || r['Mesin'] || '').trim(),
            dayaKwPs: String(r['Daya (KW/PS)'] || r['Daya'] || '').trim(),
            noTelp: formatExcelPhone(r['No. Telp / Call Kapal'] || r['No. Telp'] || ''),
            totalKuota,
            kruAktif,
            cadet,
            posisiLowong,
            persentaseTerisi: String(r['Persentase Terisi'] || Math.round(ratio) + '%'),
            terisiRatio: ratio,
          };
        })
        .filter((k) => k.namaKapal);
    }
  }

  // 3. Posisi Lowong
  const lowongSheetName = wb.SheetNames.find((s) => /lowong|vacant/i.test(s));
  if (lowongSheetName) {
    const sheet = wb.Sheets[lowongSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const hIdx = findHeaderRow(rows, ['Jabatan', 'Kapal']);
    if (hIdx !== -1) {
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: hIdx, defval: '' });
      posisiLowong = json
        .map((r, i) => {
          const rec = String(r['Rekomendasi Tindakan HR'] || r['Rekomendasi'] || '').trim();
          const jab = String(
            r['Jabatan yang Dibutuhkan'] || r['Jabatan Dibutuhkan'] || r['Jabatan'] || ''
          ).trim();
          const isMandatory = rec.toUpperCase().includes('MANDATORI') || /nakhoda|kkm/i.test(jab);
          return {
            no: Number(r['No'] || i + 1),
            noKapal: String(r['No. Kapal'] || '').trim(),
            namaKapal: String(r['Nama Kapal'] || '').trim(),
            tipeKapal: String(r['Tipe Kapal'] || '').trim(),
            jabatan: jab,
            departemen: String(r['Departemen'] || '').trim(),
            kualifikasi: String(
              r['Kualifikasi Ijazah Standar'] || r['Kualifikasi Standar'] || r['Kualifikasi'] || ''
            ).trim(),
            noTelpKapal: formatExcelPhone(r['No. Telp Kapal'] || ''),
            rekomendasi: rec,
            isMandatory,
          };
        })
        .filter((l) => l.namaKapal && l.jabatan);
    }
  }

  // 4. Monitoring Cadet
  const cadetSheetName = wb.SheetNames.find((s) => /cadet|taruna|prala/i.test(s));
  if (cadetSheetName) {
    const sheet = wb.Sheets[cadetSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const hIdx =
      findHeaderRow(rows, ['Nama Cadet', 'Nama Kapal']) !== -1
        ? findHeaderRow(rows, ['Nama Cadet', 'Nama Kapal'])
        : findHeaderRow(rows, ['Nama Cadet']);

    if (hIdx !== -1) {
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: hIdx, defval: '' });
      cadetMonitoring = json
        .map((r, i) => {
          return {
            no: Number(r['No'] || i + 1),
            noKapal: String(r['No. Kapal'] || '').trim(),
            namaKapal: String(r['Nama Kapal'] || '').trim(),
            namaCadet: String(r['Nama Cadet'] || r['Nama'] || '').trim(),
            jabatan: String(r['Jabatan'] || 'Cadet').trim(),
            departemen: String(r['Departemen'] || '').trim(),
            noHp: formatExcelPhone(r['No. Handphone'] || r['No HP'] || ''),
            sertifikat: String(r['Sertifikat'] || 'BST').trim(),
            tglOnBoard: formatExcelDate(r['Tgl On Board'] || ''),
            asalKampus: String(
              r['Asal Kampus / Sekolah Pelayaran'] || r['Asal Kampus'] || '-'
            ).trim(),
            catatan: String(r['Catatan'] || '-').trim(),
          };
        })
        .filter((c) => c.namaCadet);
    }
  }

  // 5. Log Audit Data
  const auditSheetName = wb.SheetNames.find((s) => /audit|log/i.test(s));
  if (auditSheetName) {
    const sheet = wb.Sheets[auditSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const hIdx = findHeaderRow(rows, ['Kategori Masalah', 'Deskripsi']);
    if (hIdx !== -1) {
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { range: hIdx, defval: '' });
      auditLogs = json
        .map((r, i) => {
          return {
            no: Number(r['No'] || i + 1),
            barisSumber: r['Baris Sumber'] || '',
            kategoriMasalah: String(r['Kategori Masalah'] || '').trim(),
            deskripsi: String(
              r['Deskripsi Temuan & Tindakan Perbaikan'] ||
                r['Deskripsi Temuan'] ||
                r['Deskripsi'] ||
                ''
            ).trim(),
          };
        })
        .filter((a) => a.kategoriMasalah || a.deskripsi);
    }
  }

  // Fallback: Jika hanya sheet Master Crew yang diunggah, hitung rekap & lowong otomatis
  if (kapalRekap.length === 0 && masterCrew.length > 0) {
    const vesselMap = new Map<string, any>();
    masterCrew.forEach((c) => {
      if (!vesselMap.has(c.namaKapal)) {
        vesselMap.set(c.namaKapal, {
          namaKapal: c.namaKapal,
          noKapal: c.noKapal,
          tipeKapal: c.tipeKapal,
          totalKuota: 0,
          kruAktif: 0,
          cadet: 0,
          posisiLowong: 0,
        });
      }
      const v = vesselMap.get(c.namaKapal);
      v.totalKuota++;
      if (c.statusSlot === 'AKTIF') v.kruAktif++;
      else if (c.statusSlot === 'CADET (MAGANG)') v.cadet++;
      else if (c.statusSlot === 'LOWONG (VACANT)') v.posisiLowong++;
    });

    let vIdx = 1;
    vesselMap.forEach((v) => {
      const terisi = v.kruAktif + v.cadet;
      const ratio = v.totalKuota > 0 ? (terisi / v.totalKuota) * 100 : 100;
      kapalRekap.push({
        no: vIdx++,
        noKapal: v.noKapal,
        namaKapal: v.namaKapal,
        tipeKapal: v.tipeKapal,
        gt: '',
        mesinHp: '',
        dayaKwPs: '',
        noTelp: '',
        totalKuota: v.totalKuota,
        kruAktif: v.kruAktif,
        cadet: v.cadet,
        posisiLowong: v.posisiLowong,
        persentaseTerisi: Math.round(ratio) + '%',
        terisiRatio: ratio,
      });
    });
  }

  if (posisiLowong.length === 0 && masterCrew.length > 0) {
    masterCrew
      .filter((c) => c.statusSlot === 'LOWONG (VACANT)')
      .forEach((c, idx) => {
        const isMandatory = /nakhoda|kkm/i.test(c.jabatan);
        posisiLowong.push({
          no: idx + 1,
          noKapal: c.noKapal,
          namaKapal: c.namaKapal,
          tipeKapal: c.tipeKapal,
          jabatan: c.jabatan,
          departemen: c.departemen,
          kualifikasi: c.ijazah || 'Sesuai Standar Safe Manning',
          noTelpKapal: '',
          rekomendasi: isMandatory ? 'MANDATORI: Segera rekrut / mutasi' : 'Prioritas Rekrutmen',
          isMandatory,
        });
      });
  }

  if (cadetMonitoring.length === 0 && masterCrew.length > 0) {
    masterCrew
      .filter((c) => c.statusSlot === 'CADET (MAGANG)')
      .forEach((c, idx) => {
        cadetMonitoring.push({
          no: idx + 1,
          noKapal: c.noKapal,
          namaKapal: c.namaKapal,
          namaCadet: c.namaPersonel,
          jabatan: c.jabatan,
          departemen: c.departemen,
          noHp: c.noHp,
          sertifikat: c.ijazah || 'BST',
          tglOnBoard: c.tglOnBoard,
          asalKampus: c.asalKampus,
          catatan: c.catatanAudit || '-',
        });
      });
  }

  const totalArmada = kapalRekap.length;
  const totalKuota = kapalRekap.reduce((acc, k) => acc + k.totalKuota, 0);
  const kruAktif = masterCrew.filter((c) => c.statusSlot === 'AKTIF').length;
  const cadet = masterCrew.filter((c) => c.statusSlot === 'CADET (MAGANG)').length;
  const lowong =
    masterCrew.filter((c) => c.statusSlot === 'LOWONG (VACANT)').length || posisiLowong.length;
  const pTerisi = totalKuota > 0 ? ((kruAktif + cadet) / totalKuota * 100).toFixed(1) + '%' : '0%';

  const now = new Date();
  const lastUpdated = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    summary: {
      totalArmada,
      totalKuota,
      kruAktif,
      cadet,
      posisiLowong: lowong,
      persentaseTerisi: pTerisi,
    },
    kapalRekap,
    masterCrew,
    posisiLowong,
    cadetMonitoring,
    auditLogs,
    lastUpdated,
  };
}

/**
 * Recalculate summary and ship statistics from current arrays
 */
export function recalculateCrewKapalData(
  kapalRekap: KapalRekapItem[],
  masterCrew: CrewMasterItem[],
  posisiLowong: LowongItem[],
  cadetMonitoring: CadetMonitoringItem[],
  auditLogs: AuditLogItem[]
): StoredCrewData {
  const updatedKapal = kapalRekap.map((k) => {
    const crewsForKapal = masterCrew.filter(
      (c) => c.namaKapal.trim().toUpperCase() === k.namaKapal.trim().toUpperCase()
    );
    const aktif = crewsForKapal.filter((c) => c.statusSlot === 'AKTIF').length;
    const cadet = crewsForKapal.filter((c) => c.statusSlot === 'CADET (MAGANG)').length;
    const lowongFromCrew = crewsForKapal.filter((c) => c.statusSlot === 'LOWONG (VACANT)').length;
    const kuota = Math.max(k.totalKuota || 0, aktif + cadet + lowongFromCrew, crewsForKapal.length);
    const lowong = Math.max(lowongFromCrew, kuota - (aktif + cadet));
    const ratio = kuota > 0 ? (aktif + cadet) / kuota : 0;
    const persentaseTerisi = (ratio * 100).toFixed(0) + '%';

    return {
      ...k,
      totalKuota: kuota,
      kruAktif: aktif,
      cadet,
      posisiLowong: lowong,
      persentaseTerisi,
      terisiRatio: ratio,
    };
  });

  const totalArmada = updatedKapal.length;
  const totalKuota = updatedKapal.reduce((acc, k) => acc + (k.totalKuota || 0), 0);
  const kruAktif = masterCrew.filter((c) => c.statusSlot === 'AKTIF').length;
  const cadet = masterCrew.filter((c) => c.statusSlot === 'CADET (MAGANG)').length;
  const lowong = updatedKapal.reduce((acc, k) => acc + (k.posisiLowong || 0), 0);
  const ratio = totalKuota > 0 ? (kruAktif + cadet) / totalKuota : 0;
  const persentaseTerisi = (ratio * 100).toFixed(1) + '%';

  const now = new Date();
  const lastUpdated = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    summary: {
      totalArmada,
      totalKuota,
      kruAktif,
      cadet,
      posisiLowong: lowong,
      persentaseTerisi,
    },
    kapalRekap: updatedKapal,
    masterCrew,
    posisiLowong,
    cadetMonitoring,
    auditLogs,
    lastUpdated,
  };
}

export interface SyncedContactResult {
  name: string;
  phone: string;
  role?: string;
  dept?: string;
  armada?: string;
  matchedFrom: 'crew' | 'armada' | 'default' | 'none';
}

const DEFAULT_EFPB_CONTACTS: Record<string, { name: string; phone: string; role: string; dept: string }> = {
  'YULIANINGSIH AMANDA': {
    name: 'Yulianingsih Amanda',
    phone: '081254332901',
    role: 'Staf Operasional / Pembuat e-FPB',
    dept: 'DEPT OPERATION',
  },
  'SUJATMIKO': {
    name: 'Sujatmiko',
    phone: '08115916597',
    role: 'Staf Lapangan / Pembuat e-FPB',
    dept: 'OFFICE GAJ',
  },
  "JIHAAN NADA'A UTAMI": {
    name: "Jihaan Nada'a Utami",
    phone: '081255678910',
    role: 'Adm. Operasional / Pembuat e-FPB',
    dept: 'DPA',
  },
  'IQBAL POLEJIWA': {
    name: 'Iqbal Polejiwa',
    phone: '081347665544',
    role: 'Port Captain / Operasional Kapal',
    dept: 'CPL',
  },
  'SALMAN': {
    name: 'Salman',
    phone: '081349361659',
    role: 'Staf Lapangan / Pengadaan',
    dept: 'OFFICE GAJ',
  },
};

/**
 * Cari kontak personel atau armada kapal dari database Awak & Armada
 */
export function findCrewOrArmadaContact(
  requesterName?: string,
  armadaName?: string
): SyncedContactResult {
  const cleanReq = (requesterName || '').trim();
  const cleanArmada = (armadaName || '').trim();

  const data = loadCrewData();

  // 1. Cari berdasarkan Nama Personel di masterCrew
  if (cleanReq) {
    const reqUpper = cleanReq.toUpperCase();
    const reqTokens = reqUpper.split(/\s+/).filter((t) => t.length > 2);

    const matchedCrew = data.masterCrew.find((c) => {
      const cUpper = c.namaPersonel.trim().toUpperCase();
      if (!cUpper || cUpper.includes('[POSISI LOWONG]')) return false;
      if (cUpper === reqUpper) return true;
      if (cUpper.includes(reqUpper) || reqUpper.includes(cUpper)) return true;

      // Partial multi-token match
      const cTokens = cUpper.split(/\s+/).filter((t) => t.length > 2);
      const matches = reqTokens.filter((rt) => cTokens.some((ct) => ct.includes(rt) || rt.includes(ct)));
      return matches.length >= Math.min(2, reqTokens.length);
    });

    if (matchedCrew && matchedCrew.noHp && matchedCrew.noHp !== '-') {
      return {
        name: matchedCrew.namaPersonel,
        phone: matchedCrew.noHp,
        role: matchedCrew.jabatan,
        dept: matchedCrew.departemen,
        armada: matchedCrew.namaKapal,
        matchedFrom: 'crew',
      };
    }
  }

  // 2. Cari dari direktori default e-FPB jika belum ada di masterCrew
  if (cleanReq) {
    const reqUpper = cleanReq.toUpperCase();
    for (const [key, val] of Object.entries(DEFAULT_EFPB_CONTACTS)) {
      if (reqUpper === key || reqUpper.includes(key) || key.includes(reqUpper)) {
        return {
          name: val.name,
          phone: val.phone,
          role: val.role,
          dept: val.dept,
          armada: val.dept,
          matchedFrom: 'default',
        };
      }
    }
  }

  // 3. Cari berdasarkan Nama Armada / Kapal di kapalRekap
  if (cleanArmada) {
    const armadaUpper = cleanArmada.toUpperCase();
    const matchedKapal = data.kapalRekap.find((k) => {
      const kUpper = k.namaKapal.trim().toUpperCase();
      return kUpper === armadaUpper || armadaUpper.includes(kUpper) || kUpper.includes(armadaUpper);
    });

    if (matchedKapal && matchedKapal.noTelp && matchedKapal.noTelp !== '-') {
      return {
        name: cleanReq || matchedKapal.namaKapal,
        phone: matchedKapal.noTelp,
        role: 'Kontak Radio / Telp Kapal',
        dept: matchedKapal.tipeKapal,
        armada: matchedKapal.namaKapal,
        matchedFrom: 'armada',
      };
    }
  }

  return {
    name: cleanReq || '-',
    phone: '',
    matchedFrom: 'none',
  };
}

/**
 * Sinkronisasi nomor WhatsApp / telepon personel langsung ke database Awak & Armada
 */
export function syncCrewContact(
  name: string,
  phone: string,
  armada?: string
): StoredCrewData {
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const data = loadCrewData();

  if (!cleanName || !cleanPhone) return data;

  const nameUpper = cleanName.toUpperCase();
  const targetIdx = data.masterCrew.findIndex(
    (c) => c.namaPersonel.trim().toUpperCase() === nameUpper
  );

  let updatedMasterCrew = [...data.masterCrew];

  if (targetIdx >= 0) {
    updatedMasterCrew[targetIdx] = {
      ...updatedMasterCrew[targetIdx],
      noHp: cleanPhone,
    };
  } else {
    // Tambah person baru ke master crew
    const nextId = (data.masterCrew.length > 0 ? Math.max(...data.masterCrew.map((c) => c.id || 0)) : 0) + 1;
    const targetArmada = armada?.trim().toUpperCase() || 'DEPT OPERATION';
    const matchedKapal = data.kapalRekap.find((k) => k.namaKapal.toUpperCase() === targetArmada);

    const newCrew: CrewMasterItem = {
      id: nextId,
      noKapal: matchedKapal?.noKapal || 'OPS',
      namaKapal: targetArmada,
      tipeKapal: matchedKapal?.tipeKapal || 'Kantor / Departemen',
      noKru: 1,
      nik: `CPL-STAFF-${String(1000 + data.masterCrew.length).slice(-4)}`,
      namaPersonel: cleanName,
      statusSlot: 'AKTIF',
      jabatan: 'Pembuat e-FPB / Staf Operasional',
      departemen: 'Office / Darat',
      noHp: cleanPhone,
      ijazah: 'S1 / Sarjana',
      tahunIjazah: '2021',
      tglOnBoard: new Date().toISOString().split('T')[0],
      statusPenugasan: 'Staf Pembuat e-FPB',
      asalKampus: '-',
      catatanMutasi: 'Disinkronkan otomatis dari Review FPB',
      catatanAudit: 'Sinkronisasi kontak user FPB',
    };

    updatedMasterCrew.push(newCrew);
  }

  const updatedData = recalculateCrewKapalData(
    data.kapalRekap,
    updatedMasterCrew,
    data.posisiLowong,
    data.cadetMonitoring,
    data.auditLogs
  );

  saveCrewData(updatedData);
  return updatedData;
}


