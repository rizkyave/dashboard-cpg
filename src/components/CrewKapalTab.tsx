'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  Anchor,
  UserCheck,
  GraduationCap,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Phone,
  MessageSquare,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  X,
  Copy,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowUpDown,
  Building2,
  Calendar,
  Award,
  Layers,
  Upload,
  Ship,
  Plus,
  UserPlus,
} from 'lucide-react';
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
  loadCrewData,
  saveCrewData,
  resetCrewData,
  exportCrewDataToExcel,
  parseCrewWorkbook,
  recalculateCrewKapalData,
  StoredCrewData,
} from '@/utils/crewKapalStorage';

// Helper to convert number to Roman numeral
function toRoman(num: number): string {
  const lookup: [string, number][] = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1],
  ];
  let roman = '';
  for (const [letter, val] of lookup) {
    while (num >= val) {
      roman += letter;
      num -= val;
    }
  }
  return roman || 'I';
}

interface CrewKapalTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function CrewKapalTab({ showToast }: CrewKapalTabProps) {
  const [data, setData] = useState<StoredCrewData>(() => loadCrewData());
  const [activeSubTab, setActiveSubTab] = useState<'rekap' | 'crew' | 'lowong' | 'cadet' | 'audit'>('rekap');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipeKapal, setSelectedTipeKapal] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatusSlot, setSelectedStatusSlot] = useState<string>('ALL');
  const [selectedKapalFilter, setSelectedKapalFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal Detail Kapal & Personel
  const [selectedKapalForModal, setSelectedKapalForModal] = useState<KapalRekapItem | null>(null);
  const [selectedCrewForModal, setSelectedCrewForModal] = useState<CrewMasterItem | null>(null);

  // Modal Tambah Armada / Dept state
  const [isAddArmadaModalOpen, setIsAddArmadaModalOpen] = useState(false);
  const [formArmadaNama, setFormArmadaNama] = useState('');
  const [formArmadaTipe, setFormArmadaTipe] = useState('Tug Boat (TB)');
  const [formArmadaGt, setFormArmadaGt] = useState('');
  const [formArmadaMesin, setFormArmadaMesin] = useState('');
  const [formArmadaTelp, setFormArmadaTelp] = useState('');
  const [formArmadaKuota, setFormArmadaKuota] = useState('10');

  // Modal Tambah Crew state
  const [isAddCrewModalOpen, setIsAddCrewModalOpen] = useState(false);
  const [formCrewNama, setFormCrewNama] = useState('');
  const [formCrewNik, setFormCrewNik] = useState('');
  const [formCrewKapal, setFormCrewKapal] = useState('');
  const [formCrewJabatan, setFormCrewJabatan] = useState('');
  const [formCrewDepartemen, setFormCrewDepartemen] = useState('Deck');
  const [formCrewStatusSlot, setFormCrewStatusSlot] = useState<'AKTIF' | 'CADET (MAGANG)' | 'LOWONG (VACANT)'>('AKTIF');
  const [formCrewHp, setFormCrewHp] = useState('');
  const [formCrewIjazah, setFormCrewIjazah] = useState('');
  const [formCrewTahunIjazah, setFormCrewTahunIjazah] = useState('');
  const [formCrewTglOnBoard, setFormCrewTglOnBoard] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCrewAsalKampus, setFormCrewAsalKampus] = useState('');
  const [formCrewCatatan, setFormCrewCatatan] = useState('');

  // Distinct ship types
  const shipTypes = useMemo(() => {
    const set = new Set<string>();
    data.kapalRekap.forEach((k) => {
      if (k.tipeKapal) set.add(k.tipeKapal);
    });
    return Array.from(set).sort();
  }, [data.kapalRekap]);

  // Distinct ships for crew filter
  const shipNames = useMemo(() => {
    return data.kapalRekap.map((k) => k.namaKapal).sort();
  }, [data.kapalRekap]);

  // Distinct campuses
  const campusStats = useMemo(() => {
    const counts: Record<string, number> = {};
    data.cadetMonitoring.forEach((c) => {
      const camp = c.asalKampus && c.asalKampus !== '-' ? c.asalKampus : 'Belum Terdata';
      counts[camp] = (counts[camp] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data.cadetMonitoring]);

  // Filtered Rekap Kapal
  const filteredKapal = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.kapalRekap.filter((k) => {
      const matchType = selectedTipeKapal === 'ALL' || k.tipeKapal === selectedTipeKapal;
      const matchSearch =
        !q ||
        k.namaKapal.toLowerCase().includes(q) ||
        k.noKapal.toLowerCase().includes(q) ||
        k.tipeKapal.toLowerCase().includes(q) ||
        k.noTelp.includes(q);
      return matchType && matchSearch;
    });
  }, [data.kapalRekap, searchQuery, selectedTipeKapal]);

  // Filtered Master Crew
  const filteredCrew = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.masterCrew.filter((c) => {
      const matchSlot = selectedStatusSlot === 'ALL' || c.statusSlot === selectedStatusSlot;
      const matchDept = selectedDept === 'ALL' || c.departemen.toLowerCase().includes(selectedDept.toLowerCase());
      const matchKapal = selectedKapalFilter === 'ALL' || c.namaKapal === selectedKapalFilter;
      const matchSearch =
        !q ||
        c.namaPersonel.toLowerCase().includes(q) ||
        c.nik.toLowerCase().includes(q) ||
        c.jabatan.toLowerCase().includes(q) ||
        c.namaKapal.toLowerCase().includes(q) ||
        c.ijazah.toLowerCase().includes(q) ||
        c.asalKampus.toLowerCase().includes(q) ||
        c.noHp.includes(q);
      return matchSlot && matchDept && matchKapal && matchSearch;
    });
  }, [data.masterCrew, searchQuery, selectedStatusSlot, selectedDept, selectedKapalFilter]);

  // Filtered Lowong
  const filteredLowong = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.posisiLowong.filter((l) => {
      return (
        !q ||
        l.namaKapal.toLowerCase().includes(q) ||
        l.jabatan.toLowerCase().includes(q) ||
        l.departemen.toLowerCase().includes(q) ||
        l.rekomendasi.toLowerCase().includes(q)
      );
    });
  }, [data.posisiLowong, searchQuery]);

  // Crew on selected vessel for modal
  const crewOnSelectedKapal = useMemo(() => {
    if (!selectedKapalForModal) return [];
    return data.masterCrew.filter(
      (c) => c.namaKapal.toLowerCase() === selectedKapalForModal.namaKapal.toLowerCase()
    );
  }, [data.masterCrew, selectedKapalForModal]);

  // Copy HR Vacant Summary to Clipboard
  const handleCopyHrRequisition = () => {
    const lines = [
      `*KEBUTUHAN AWAK KAPAL (VACANT) PT. CINDARA PRATAMA LINES*`,
      `*Per ${data.lastUpdated} | Total: ${data.posisiLowong.length} Posisi*`,
      '',
    ];

    data.posisiLowong.forEach((l, idx) => {
      const tag = l.isMandatory ? '🚨 [MANDATORI]' : '⚠️ [PRIORITAS]';
      lines.push(`${idx + 1}. ${tag} *${l.namaKapal}* (${l.tipeKapal})`);
      lines.push(`   - Jabatan: *${l.jabatan}* (${l.departemen})`);
      lines.push(`   - Kualifikasi: ${l.kualifikasi}`);
      if (l.noTelpKapal && l.noTelpKapal !== '-') {
        lines.push(`   - Kontak Kapal: ${l.noTelpKapal}`);
      }
      lines.push(`   - Tindak Lanjut: ${l.rekomendasi}`);
      lines.push('');
    });

    lines.push(`_Mohon bagian HR & Crewing segera menindaklanjuti proses rekrutmen / mutasi internal._`);

    navigator.clipboard.writeText(lines.join('\n'));
    if (showToast) {
      showToast('Daftar kebutuhan awak kapal disalin ke clipboard!', 'success');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast?.('Membaca & memproses berkas Excel Data Crew & Armada...', 'info');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const parsed = parseCrewWorkbook(workbook);

      if (parsed.masterCrew.length === 0 && parsed.kapalRekap.length === 0) {
        showToast?.('Tidak ditemukan data kru atau armada yang valid pada berkas Excel.', 'error');
        return;
      }

      setData(parsed);
      saveCrewData(parsed);

      showToast?.(
        `Berhasil memuat ${parsed.masterCrew.length} data kru pada ${parsed.summary.totalArmada} armada kapal!`,
        'success'
      );
    } catch (err: any) {
      console.error('Error uploading crew excel:', err);
      showToast?.(`Gagal memproses berkas Excel: ${err.message || 'Format tidak valid'}`, 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    try {
      exportCrewDataToExcel(data);
      if (showToast) {
        showToast('Berhasil mengunduh berkas Excel Crew & Armada!', 'success');
      }
    } catch (err: any) {
      if (showToast) {
        showToast(`Gagal mengekspor Excel: ${err.message}`, 'error');
      }
    }
  };

  const handleReset = () => {
    if (typeof window !== 'undefined' && !window.confirm('Kembalikan seluruh data kru ke versi standar awal per 15 Oktober 2026?')) {
      return;
    }
    const fresh = resetCrewData();
    setData(fresh);
    if (showToast) {
      showToast('Data crew kapal berhasil di-reset ke versi standar.', 'info');
    }
  };

  // Handler Tambah Armada / Dept
  const handleAddArmada = (e: React.FormEvent) => {
    e.preventDefault();
    const namaClean = formArmadaNama.trim().toUpperCase();
    if (!namaClean) {
      showToast?.('Nama armada / departemen wajib diisi!', 'warning');
      return;
    }

    if (data.kapalRekap.some((k) => k.namaKapal.trim().toUpperCase() === namaClean)) {
      showToast?.(`Armada / departemen "${namaClean}" sudah terdaftar!`, 'warning');
      return;
    }

    const nextNo = data.kapalRekap.length + 1;
    const kuotaNum = Math.max(1, parseInt(formArmadaKuota, 10) || 1);

    const newArmada: KapalRekapItem = {
      no: nextNo,
      noKapal: toRoman(nextNo),
      namaKapal: namaClean,
      tipeKapal: formArmadaTipe,
      gt: formArmadaGt.trim() || '-',
      mesinHp: formArmadaMesin.trim() || '-',
      dayaKwPs: '-',
      noTelp: formArmadaTelp.trim() || '-',
      totalKuota: kuotaNum,
      kruAktif: 0,
      cadet: 0,
      posisiLowong: kuotaNum,
      persentaseTerisi: '0%',
      terisiRatio: 0,
    };

    const newAuditLog: AuditLogItem = {
      no: data.auditLogs.length + 1,
      barisSumber: 'Manual Input',
      kategoriMasalah: 'Penambahan Armada',
      deskripsi: `Penambahan armada/dept ${newArmada.namaKapal} (${newArmada.tipeKapal}) dengan target kuota ${newArmada.totalKuota} kru.`,
    };

    const updatedData = recalculateCrewKapalData(
      [...data.kapalRekap, newArmada],
      data.masterCrew,
      data.posisiLowong,
      data.cadetMonitoring,
      [...data.auditLogs, newAuditLog]
    );

    setData(updatedData);
    saveCrewData(updatedData);

    // Reset Form
    setFormArmadaNama('');
    setFormArmadaTipe('Tug Boat (TB)');
    setFormArmadaGt('');
    setFormArmadaMesin('');
    setFormArmadaTelp('');
    setFormArmadaKuota('10');
    setIsAddArmadaModalOpen(false);

    showToast?.(`Armada / Dept "${namaClean}" berhasil ditambahkan!`, 'success');
  };

  // Handler Tambah Crew
  const handleAddCrew = (e: React.FormEvent) => {
    e.preventDefault();
    const isVacant = formCrewStatusSlot === 'LOWONG (VACANT)';
    const namaPersonelClean = formCrewNama.trim() || (isVacant ? '[POSISI LOWONG]' : '');

    if (!namaPersonelClean && !isVacant) {
      showToast?.('Nama personel kru wajib diisi!', 'warning');
      return;
    }

    const targetKapalName = formCrewKapal.trim() || (data.kapalRekap[0]?.namaKapal ?? '');
    const matchedKapal = data.kapalRekap.find(
      (k) => k.namaKapal.trim().toUpperCase() === targetKapalName.trim().toUpperCase()
    );

    if (!matchedKapal) {
      showToast?.('Pilih armada / kapal penugasan terlebih dahulu!', 'warning');
      return;
    }

    const jabatanClean = formCrewJabatan.trim() || 'Awak Kapal';
    const nextId = (data.masterCrew.length > 0 ? Math.max(...data.masterCrew.map((c) => c.id || 0)) : 0) + 1;
    const existingCrewsOnKapal = data.masterCrew.filter(
      (c) => c.namaKapal.trim().toUpperCase() === matchedKapal.namaKapal.trim().toUpperCase()
    );
    const nextNoKru = existingCrewsOnKapal.length + 1;

    const newCrew: CrewMasterItem = {
      id: nextId,
      noKapal: matchedKapal.noKapal || '-',
      namaKapal: matchedKapal.namaKapal,
      tipeKapal: matchedKapal.tipeKapal,
      noKru: nextNoKru,
      nik: formCrewNik.trim() || (isVacant ? '-' : `CPL-VSL-${String(1000 + data.masterCrew.length).slice(-4)}`),
      namaPersonel: namaPersonelClean,
      statusSlot: formCrewStatusSlot,
      jabatan: jabatanClean,
      departemen: formCrewDepartemen,
      noHp: formCrewHp.trim() || '-',
      ijazah: formCrewIjazah.trim() || '-',
      tahunIjazah: formCrewTahunIjazah.trim() || '-',
      tglOnBoard: formCrewTglOnBoard || new Date().toISOString().split('T')[0],
      statusPenugasan: isVacant ? 'Belum Terisi' : 'Penugasan Baru',
      asalKampus: formCrewAsalKampus.trim() || '-',
      catatanMutasi: formCrewCatatan.trim() || (isVacant ? '-' : 'Penambahan personel via sistem'),
      catatanAudit: 'Input manual form crew',
    };

    let updatedCadet = [...data.cadetMonitoring];
    if (formCrewStatusSlot === 'CADET (MAGANG)') {
      const newCadet: CadetMonitoringItem = {
        no: data.cadetMonitoring.length + 1,
        noKapal: matchedKapal.noKapal,
        namaKapal: matchedKapal.namaKapal,
        namaCadet: namaPersonelClean,
        jabatan: jabatanClean,
        departemen: `${formCrewDepartemen} (Cadet)`,
        noHp: formCrewHp.trim() || '-',
        sertifikat: formCrewIjazah.trim() || 'BST',
        tglOnBoard: formCrewTglOnBoard || new Date().toISOString().split('T')[0],
        asalKampus: formCrewAsalKampus.trim() || '-',
        catatan: formCrewCatatan.trim() || '-',
      };
      updatedCadet.push(newCadet);
    }

    let updatedLowong = [...data.posisiLowong];
    if (formCrewStatusSlot === 'LOWONG (VACANT)') {
      const newLowong: LowongItem = {
        no: data.posisiLowong.length + 1,
        noKapal: matchedKapal.noKapal,
        namaKapal: matchedKapal.namaKapal,
        tipeKapal: matchedKapal.tipeKapal,
        jabatan: jabatanClean,
        departemen: formCrewDepartemen,
        kualifikasi: formCrewIjazah.trim() || 'Sesuai Standar Safe Manning',
        noTelpKapal: matchedKapal.noTelp,
        rekomendasi: 'Prioritas Rekrutmen / Mutasi Internal',
        isMandatory: false,
      };
      updatedLowong.push(newLowong);
    }

    const newAuditLog: AuditLogItem = {
      no: data.auditLogs.length + 1,
      barisSumber: 'Manual Input',
      kategoriMasalah: 'Penambahan Kru',
      deskripsi: `Penambahan personel ${namaPersonelClean} (${jabatanClean} - ${formCrewStatusSlot}) pada armada ${matchedKapal.namaKapal}.`,
    };

    const updatedData = recalculateCrewKapalData(
      data.kapalRekap,
      [...data.masterCrew, newCrew],
      updatedLowong,
      updatedCadet,
      [...data.auditLogs, newAuditLog]
    );

    setData(updatedData);
    saveCrewData(updatedData);

    // Reset Form
    setFormCrewNama('');
    setFormCrewNik('');
    setFormCrewJabatan('');
    setFormCrewDepartemen('Deck');
    setFormCrewStatusSlot('AKTIF');
    setFormCrewHp('');
    setFormCrewIjazah('');
    setFormCrewTahunIjazah('');
    setFormCrewAsalKampus('');
    setFormCrewCatatan('');
    setIsAddCrewModalOpen(false);

    showToast?.(`Personel "${namaPersonelClean}" berhasil ditambahkan ke ${matchedKapal.namaKapal}!`, 'success');
  };

  // Helper formatting WhatsApp URL
  const getWaUrl = (phone: string, text: string) => {
    const clean = phone.replace(/[^0-9]/g, '');
    let formatted = clean;
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    else if (!formatted.startsWith('62')) formatted = '62' + formatted;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Hidden File Input untuk Unggah Excel */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Users className="size-5" />
            </span>
            <div>
              <h1 className="text-base md:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                DATA CREW &amp; MONITORING ARMADA KAPAL
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  TAHUN 2026
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                PT. Cindara Pratama Lines &bull; Rekapitulasi Formasi Kru, Cadet Prala, dan Kebutuhan Awak (Per {data.lastUpdated})
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Tambah Armada & Tambah Crew (Area Kotak Hitam di sebelah kiri Unggah Excel) */}
          <button
            type="button"
            onClick={() => setIsAddArmadaModalOpen(true)}
            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah armada kapal atau departemen baru secara manual"
          >
            <Ship className="size-3.5" />
            <span>+ Tambah Armada / Dept</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!formCrewKapal && data.kapalRekap.length > 0) {
                setFormCrewKapal(data.kapalRekap[0].namaKapal);
              }
              setIsAddCrewModalOpen(true);
            }}
            className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah personel crew baru secara manual"
          >
            <UserPlus className="size-3.5" />
            <span>+ Tambah Crew</span>
          </button>

          {/* Tombol Unggah Excel (Posisi Kotak Hitam di sebelah kiri Ekspor Excel) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Unggah berkas Excel Data Crew & Monitoring Armada Kapal (.xlsx / .xls)"
          >
            <Upload className="size-3.5" />
            <span>{isUploading ? 'Memproses...' : 'Unggah Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Ekspor seluruh 5 sheet ke file Excel (.xlsx)"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Ekspor Excel</span>
          </button>
          <button
            type="button"
            onClick={handleCopyHrRequisition}
            className="h-8 px-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            title="Salin ringkasan posisi lowong untuk WhatsApp HR & Crewing"
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">Salin Kebutuhan HR</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border flex items-center justify-center transition cursor-pointer active:scale-95"
            title="Reset ke data awal"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Armada */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Total Armada</span>
            <Anchor className="size-3.5 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-foreground">{data.summary.totalArmada}</span>
            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded font-semibold">
              Kapal
            </span>
          </div>
        </div>

        {/* Total Kuota Kru */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Total Kuota Kru</span>
            <Layers className="size-3.5 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-foreground">{data.summary.totalKuota}</span>
            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded font-semibold">
              Slot
            </span>
          </div>
        </div>

        {/* Kru Aktif */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Kru Aktif</span>
            <UserCheck className="size-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{data.summary.kruAktif}</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {((data.summary.kruAktif / data.summary.totalKuota) * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Cadet Magang */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Cadet (Prala)</span>
            <GraduationCap className="size-3.5 text-cyan-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">{data.summary.cadet}</span>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded font-semibold">
              Taruna
            </span>
          </div>
        </div>

        {/* Posisi Lowong */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Posisi Lowong</span>
            <AlertTriangle className="size-3.5 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{data.summary.posisiLowong}</span>
            <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded font-semibold animate-pulse">
              Vacant
            </span>
          </div>
        </div>

        {/* Tingkat Keterisian */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Tingkat Keterisian</span>
            <CheckCircle2 className="size-3.5 text-teal-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-foreground">{data.summary.persentaseTerisi}</span>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-semibold">
              Manning
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSubTab('rekap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'rekap'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Anchor className="size-3.5" />
            <span>Rekap Armada (60)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('crew')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'crew'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Users className="size-3.5" />
            <span>Master Crew (633)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('lowong')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'lowong'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <AlertTriangle className="size-3.5" />
            <span>Posisi Lowong (32)</span>
            <span className="size-1.5 rounded-full bg-rose-400 animate-ping" />
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('cadet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'cadet'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <GraduationCap className="size-3.5" />
            <span>Monitoring Cadet (70)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'audit'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Log Audit Data (54)</span>
          </button>
        </div>

        {/* Global Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kapal, personel, NIK, HP..."
            className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: REKAP ARMADA (60 KAPAL) */}
      {activeSubTab === 'rekap' && (
        <div className="space-y-3">
          {/* Tipe Kapal Pills & View Toggle */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setSelectedTipeKapal('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer whitespace-nowrap ${
                  selectedTipeKapal === 'ALL'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua Tipe ({data.kapalRekap.length})
              </button>
              {shipTypes.map((t) => {
                const count = data.kapalRekap.filter((k) => k.tipeKapal === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTipeKapal(t)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer whitespace-nowrap ${
                      selectedTipeKapal === t
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Menampilkan: <strong>{filteredKapal.length}</strong> unit</span>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredKapal.map((kapal) => {
              const isFull = kapal.posisiLowong === 0;
              const hasVacant = kapal.posisiLowong > 0;
              return (
                <div
                  key={kapal.no}
                  onClick={() => setSelectedKapalForModal(kapal)}
                  className={`p-3.5 rounded-xl bg-card border transition flex flex-col justify-between shadow-2xs hover:shadow-md cursor-pointer group ${
                    hasVacant
                      ? 'border-rose-500/30 hover:border-rose-500/60 bg-rose-500/[0.02]'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border shrink-0">
                            #{kapal.noKapal}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground truncate">
                            {kapal.tipeKapal}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-foreground truncate mt-1 group-hover:text-primary transition">
                          {kapal.namaKapal}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isFull
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse'
                        }`}
                      >
                        {kapal.persentaseTerisi}
                      </span>
                    </div>

                    {/* Progress Bar Keterisian */}
                    <div className="space-y-1">
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{
                            width: `${Math.min(100, ((kapal.kruAktif + kapal.cadet) / (kapal.totalKuota || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-4 gap-1 text-center pt-1 border-t border-border/50 text-[10px] font-mono">
                      <div className="bg-muted/40 p-1 rounded">
                        <span className="text-muted-foreground block text-[9px]">Kuota</span>
                        <span className="font-bold text-foreground">{kapal.totalKuota}</span>
                      </div>
                      <div className="bg-emerald-500/10 p-1 rounded text-emerald-700 dark:text-emerald-400">
                        <span className="block text-[9px]">Aktif</span>
                        <span className="font-bold">{kapal.kruAktif}</span>
                      </div>
                      <div className="bg-cyan-500/10 p-1 rounded text-cyan-700 dark:text-cyan-400">
                        <span className="block text-[9px]">Cadet</span>
                        <span className="font-bold">{kapal.cadet}</span>
                      </div>
                      <div
                        className={`p-1 rounded font-bold ${
                          kapal.posisiLowong > 0
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <span className="block text-[9px]">Lowong</span>
                        <span>{kapal.posisiLowong}</span>
                      </div>
                    </div>

                    {/* Specs snippet */}
                    <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span>GT / Mesin:</span>
                        <span className="font-mono text-foreground font-medium">
                          {kapal.gt !== '-' ? `${kapal.gt} GT` : '-'} &bull; {kapal.mesinHp}
                        </span>
                      </div>
                      {kapal.noTelp && kapal.noTelp !== '-' && (
                        <div className="flex items-center justify-between">
                          <span>Telp Kapal:</span>
                          <a
                            href={`tel:${kapal.noTelp}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="size-2.5" />
                            <span>{kapal.noTelp}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Button */}
                  <div className="pt-2 mt-2 border-t border-border flex items-center justify-between text-[11px] font-medium text-primary">
                    <span>Lihat Susunan Kru</span>
                    <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: DATA MASTER CREW (633 PERSONEL) */}
      {activeSubTab === 'crew' && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Slot filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Status:</span>
                <select
                  value={selectedStatusSlot}
                  onChange={(e) => setSelectedStatusSlot(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs font-mono"
                >
                  <option value="ALL">Semua Slot</option>
                  <option value="AKTIF">AKTIF (531)</option>
                  <option value="CADET (MAGANG)">CADET MAGANG (70)</option>
                  <option value="LOWONG (VACANT)">LOWONG VACANT (32)</option>
                </select>
              </div>

              {/* Departemen Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Dept:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs font-mono"
                >
                  <option value="ALL">Semua Departemen</option>
                  <option value="Deck">Deck</option>
                  <option value="Engine">Engine</option>
                  <option value="Catering">Catering / Galley</option>
                </select>
              </div>

              {/* Kapal Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Kapal:</span>
                <select
                  value={selectedKapalFilter}
                  onChange={(e) => setSelectedKapalFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs font-mono max-w-[200px] truncate"
                >
                  <option value="ALL">Semua Kapal (60)</option>
                  {shipNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Total Ditemukan: <strong className="text-foreground font-mono">{filteredCrew.length}</strong> personel
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-mono text-[10.5px] uppercase border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">ID</th>
                    <th className="px-3 py-2.5">Kapal</th>
                    <th className="px-3 py-2.5">Nama Personel</th>
                    <th className="px-3 py-2.5">Jabatan / Dept</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Ijazah / Sertifikat</th>
                    <th className="px-3 py-2.5">Tgl On Board</th>
                    <th className="px-3 py-2.5">Kontak</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-sans">
                  {filteredCrew.map((crew) => {
                    const isVacant = crew.statusSlot === 'LOWONG (VACANT)';
                    const isCadet = crew.statusSlot === 'CADET (MAGANG)';
                    return (
                      <tr
                        key={crew.id}
                        onClick={() => setSelectedCrewForModal(crew)}
                        className={`hover:bg-muted/50 transition cursor-pointer ${
                          isVacant ? 'bg-rose-500/5' : isCadet ? 'bg-cyan-500/5' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          #{crew.id}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-foreground truncate max-w-[150px]" title={crew.namaKapal}>
                            {crew.namaKapal}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Slot #{crew.noKru} &bull; {crew.tipeKapal}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-foreground">
                            {isVacant ? (
                              <span className="text-rose-600 dark:text-rose-400 font-mono italic">
                                [POSISI LOWONG]
                              </span>
                            ) : (
                              crew.namaPersonel
                            )}
                          </div>
                          {crew.nik && crew.nik !== '-' && (
                            <div className="text-[10.5px] font-mono text-muted-foreground">
                              {crew.nik}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{crew.jabatan}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{crew.departemen}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none inline-block ${
                              isVacant
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : isCadet
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {crew.statusSlot}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          <span className="text-foreground font-semibold">{crew.ijazah}</span>
                          {crew.tahunIjazah && crew.tahunIjazah !== '-' && (
                            <span className="text-muted-foreground text-[10px] ml-1">({crew.tahunIjazah})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {crew.tglOnBoard && crew.tglOnBoard !== '-' ? crew.tglOnBoard : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {crew.noHp && crew.noHp !== '-' ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={`tel:${crew.noHp}`}
                                className="text-foreground hover:text-primary transition"
                                title="Telepon"
                              >
                                {crew.noHp}
                              </a>
                              <a
                                href={getWaUrl(
                                  crew.noHp,
                                  `Halo ${crew.namaPersonel} (${crew.jabatan} ${crew.namaKapal}), kami dari Manajemen Operasional PT. Cindara Pratama Lines...`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                                title="Chat WhatsApp"
                              >
                                <MessageSquare className="size-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCrewForModal(crew);
                            }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
                            title="Buka Profil Personel"
                          >
                            <ChevronRight className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: POSISI LOWONG (32 POSISI) */}
      {activeSubTab === 'lowong' && (
        <div className="space-y-3">
          {/* Alert Box Callout */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 space-y-1">
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                Daftar Formasi Kosong yang Membutuhkan Rekrutmen / Mutasi Segera
              </span>
              <span className="px-2 py-0.5 rounded font-mono bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">
                {data.posisiLowong.length} POSISI LOWONG
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Terdapat 8 posisi kategori <strong>MANDATORI (Nakhoda / KKM)</strong> yang wajib segera diisi sesuai regulasi Safe Manning Document kapal niaga.
            </p>
          </div>

          {/* Lowong Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredLowong.map((l) => (
              <div
                key={l.no}
                className={`p-3.5 rounded-xl bg-card border flex flex-col justify-between shadow-2xs space-y-2.5 transition ${
                  l.isMandatory
                    ? 'border-rose-500/40 bg-rose-500/[0.03]'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                      #{l.noKapal} &bull; {l.tipeKapal}
                    </span>
                    <span
                      className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded ${
                        l.isMandatory
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {l.isMandatory ? 'MANDATORI' : 'PRIORITAS'}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-foreground">
                    {l.namaKapal}
                  </h3>

                  <div className="p-2 rounded-lg bg-muted/50 border border-border/50 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Jabatan:</span>
                      <strong className="font-semibold text-rose-600 dark:text-rose-400">{l.jabatan}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Departemen:</span>
                      <span className="font-mono text-foreground">{l.departemen}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Standar Ijazah:</span>
                      <span className="font-mono font-bold text-foreground">{l.kualifikasi}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                    &bull; {l.rekomendasi}
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  {l.noTelpKapal && l.noTelpKapal !== '-' ? (
                    <a
                      href={`tel:${l.noTelpKapal}`}
                      className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Phone className="size-3" />
                      <span>{l.noTelpKapal}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-[10px] italic">Telepon belum ada</span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const text = `🚨 *LOWONGAN CREW PT. CPL*\nKapal: *${l.namaKapal}* (${l.tipeKapal})\nPosisi: *${l.jabatan}* (${l.departemen})\nKualifikasi: *${l.kualifikasi}*\nTindakan: ${l.rekomendasi}`;
                      navigator.clipboard.writeText(text);
                      if (showToast) showToast(`Teks rekrutmen ${l.jabatan} ${l.namaKapal} disalin!`, 'success');
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1 transition cursor-pointer"
                    title="Salin deskripsi lowongan ini"
                  >
                    <Copy className="size-3" />
                    <span>Salin</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: MONITORING CADET (70 TARUNA) */}
      {activeSubTab === 'cadet' && (
        <div className="space-y-4">
          {/* Campus Breakdown Pills */}
          <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="size-4 text-cyan-500" />
                Distribusi Asal Kampus / Sekolah Pelayaran Cadet (Prala)
              </span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400">Total: 70 Taruna</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {campusStats.map(([campus, count]) => (
                <div
                  key={campus}
                  className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-mono text-foreground flex items-center gap-1.5 border border-border"
                >
                  <Building2 className="size-3 text-cyan-500" />
                  <span className="font-medium">{campus}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cadet Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-mono text-[10.5px] uppercase border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">No</th>
                    <th className="px-3 py-2.5">Nama Cadet</th>
                    <th className="px-3 py-2.5">Penempatan Kapal</th>
                    <th className="px-3 py-2.5">Bagian / Dept</th>
                    <th className="px-3 py-2.5">Asal Kampus / Sekolah</th>
                    <th className="px-3 py-2.5">Tgl On Board</th>
                    <th className="px-3 py-2.5">Kontak</th>
                    <th className="px-3 py-2.5">Catatan Mutasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.cadetMonitoring.map((cadet) => (
                    <tr key={cadet.no} className="hover:bg-muted/50 transition">
                      <td className="px-3 py-2 font-mono text-muted-foreground">#{cadet.no}</td>
                      <td className="px-3 py-2">
                        <strong className="text-foreground font-semibold">{cadet.namaCadet}</strong>
                        <div className="text-[10px] font-mono text-muted-foreground">{cadet.sertifikat}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{cadet.namaKapal}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">Kapal #{cadet.noKapal}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
                          {cadet.jabatan}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-foreground font-medium">{cadet.asalKampus || '-'}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {cadet.tglOnBoard}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {cadet.noHp && cadet.noHp !== '-' ? (
                          <div className="flex items-center gap-1.5">
                            <a href={`tel:${cadet.noHp}`} className="text-foreground hover:underline">
                              {cadet.noHp}
                            </a>
                            <a
                              href={getWaUrl(
                                cadet.noHp,
                                `Halo Cadet ${cadet.namaCadet} (${cadet.jabatan} ${cadet.namaKapal}), kami dari Manajemen Operasional PT. CPL...`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              title="Chat WhatsApp"
                            >
                              <MessageSquare className="size-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground italic">
                        {cadet.catatan && cadet.catatan !== '-' ? cadet.catatan : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: LOG AUDIT & STANDARISASI DATA (54 TEMUAN) */}
      {activeSubTab === 'audit' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-4 text-purple-500" />
                Catatan Audit &amp; Pembersihan Data Mentah
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Mendokumentasikan seluruh proses standarisasi tanggal, pemisahan data bocor/tumpuk, dan perbaikan karakter HP agar database 100% terstruktur.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              54 Temuan Diperbaiki
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-mono text-[10.5px] uppercase border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">No</th>
                    <th className="px-3 py-2.5">Baris Sumber</th>
                    <th className="px-3 py-2.5">Kategori Masalah</th>
                    <th className="px-3 py-2.5">Deskripsi Temuan &amp; Tindakan Perbaikan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.auditLogs.map((log) => (
                    <tr key={log.no} className="hover:bg-muted/50 transition">
                      <td className="px-3 py-2 font-mono text-muted-foreground">#{log.no}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">Baris {log.barisSumber}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            log.kategoriMasalah === 'Format Tanggal'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : log.kategoriMasalah === 'Data Bocor / Tertumpuk'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {log.kategoriMasalah}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground font-sans">
                        {log.deskripsi}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DETAIL AWAK KAPAL SPESIFIK */}
      {selectedKapalForModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    KAPAL #{selectedKapalForModal.noKapal}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {selectedKapalForModal.tipeKapal} &bull; {selectedKapalForModal.gt !== '-' ? `${selectedKapalForModal.gt} GT` : ''}
                  </span>
                </div>
                <h2 className="text-base font-bold text-foreground">
                  {selectedKapalForModal.namaKapal}
                </h2>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-3">
                  <span>Mesin: {selectedKapalForModal.mesinHp}</span>
                  {selectedKapalForModal.noTelp && selectedKapalForModal.noTelp !== '-' && (
                    <a
                      href={`tel:${selectedKapalForModal.noTelp}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Phone className="size-3" />
                      <span>{selectedKapalForModal.noTelp}</span>
                    </a>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedKapalForModal(null)}
                className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body: Crew List for this vessel */}
            <div className="p-4 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Susunan Personel On Board ({crewOnSelectedKapal.length} slot):</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Terisi: {selectedKapalForModal.kruAktif} Aktif, {selectedKapalForModal.cadet} Cadet, {selectedKapalForModal.posisiLowong} Lowong
                </span>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground font-mono text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Slot</th>
                      <th className="px-3 py-2">Jabatan</th>
                      <th className="px-3 py-2">Nama Personel / NIK</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Ijazah</th>
                      <th className="px-3 py-2">Tgl On Board</th>
                      <th className="px-3 py-2">Kontak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {crewOnSelectedKapal.map((c) => {
                      const isVacant = c.statusSlot === 'LOWONG (VACANT)';
                      const isCadet = c.statusSlot === 'CADET (MAGANG)';
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-muted/40 transition ${
                            isVacant ? 'bg-rose-500/10' : isCadet ? 'bg-cyan-500/10' : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-mono font-bold text-muted-foreground">
                            #{c.noKru}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-foreground">{c.jabatan}</span>
                            <span className="text-[10px] text-muted-foreground block font-mono">{c.departemen}</span>
                          </td>
                          <td className="px-3 py-2">
                            {isVacant ? (
                              <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                                [POSISI LOWONG / BELUM TERISI]
                              </span>
                            ) : (
                              <div>
                                <span className="font-bold text-foreground">{c.namaPersonel}</span>
                                {c.nik && c.nik !== '-' && (
                                  <span className="text-[10px] font-mono text-muted-foreground block">
                                    {c.nik}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none inline-block ${
                                isVacant
                                  ? 'bg-rose-600 text-white'
                                  : isCadet
                                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {c.statusSlot}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {c.ijazah}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                            {c.tglOnBoard || '-'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {c.noHp && c.noHp !== '-' ? (
                              <a
                                href={`tel:${c.noHp}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {c.noHp}
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-border flex items-center justify-between bg-muted/20">
              <button
                type="button"
                onClick={() => {
                  setFormCrewKapal(selectedKapalForModal.namaKapal);
                  setSelectedKapalForModal(null);
                  setIsAddCrewModalOpen(true);
                }}
                className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
              >
                <UserPlus className="size-3.5" />
                <span>+ Tambah Kru di Armada Ini</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedKapalForModal(null)}
                className="h-8 px-4 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL PROFIL PERSONEL */}
      {selectedCrewForModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-bold">
                  PROFIL AWAK KAPAL #{selectedCrewForModal.id}
                </span>
                <h3 className="text-base font-bold text-foreground mt-1">
                  {selectedCrewForModal.namaPersonel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCrewForModal(null)}
                className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <span className="text-muted-foreground text-[10px] block">Penempatan:</span>
                  <strong className="text-foreground">{selectedCrewForModal.namaKapal}</strong>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    Slot #{selectedCrewForModal.noKru} ({selectedCrewForModal.tipeKapal})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">Jabatan / Dept:</span>
                  <strong className="text-foreground">{selectedCrewForModal.jabatan}</strong>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    {selectedCrewForModal.departemen}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">NIK Personel:</span>
                  <span className="font-mono font-bold text-foreground">{selectedCrewForModal.nik}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Status Slot:</span>
                  <span className="font-mono font-semibold text-foreground">{selectedCrewForModal.statusSlot}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Ijazah / Sertifikat:</span>
                  <span className="font-mono font-bold text-foreground">{selectedCrewForModal.ijazah}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tanggal On Board:</span>
                  <span className="font-mono text-foreground">{selectedCrewForModal.tglOnBoard}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Status Penugasan:</span>
                  <span className="text-foreground">{selectedCrewForModal.statusPenugasan}</span>
                </div>
                {selectedCrewForModal.asalKampus && selectedCrewForModal.asalKampus !== '-' && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Asal Kampus / Sekolah:</span>
                    <span className="text-foreground">{selectedCrewForModal.asalKampus}</span>
                  </div>
                )}
                {selectedCrewForModal.catatanMutasi && selectedCrewForModal.catatanMutasi !== '-' && (
                  <div className="py-1 border-b border-border/50 space-y-0.5">
                    <span className="text-muted-foreground block">Riwayat / Catatan Mutasi:</span>
                    <p className="text-foreground italic">{selectedCrewForModal.catatanMutasi}</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {selectedCrewForModal.noHp && selectedCrewForModal.noHp !== '-' && (
                <div className="pt-2 flex items-center gap-2">
                  <a
                    href={`tel:${selectedCrewForModal.noHp}`}
                    className="flex-1 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold flex items-center justify-center gap-1.5 transition text-xs border border-border"
                  >
                    <Phone className="size-3.5" />
                    <span>Telepon ({selectedCrewForModal.noHp})</span>
                  </a>
                  <a
                    href={getWaUrl(
                      selectedCrewForModal.noHp,
                      `Halo ${selectedCrewForModal.namaPersonel} (${selectedCrewForModal.jabatan} ${selectedCrewForModal.namaKapal}), kami dari Manajemen Operasional PT. Cindara Pratama Lines...`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 transition text-xs shadow-xs"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH ARMADA / DEPARTEMEN BARU */}
      {isAddArmadaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Ship className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Tambah Armada / Departemen
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Daftarkan kapal atau unit operasional baru ke database formasi kru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddArmadaModalOpen(false)}
                className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleAddArmada} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Nama Armada Kapal / Departemen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TB CINDARA 05, SPOB CPL 02, atau KANTOR GAJ"
                  value={formArmadaNama}
                  onChange={(e) => setFormArmadaNama(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Tipe Armada / Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formArmadaTipe}
                    onChange={(e) => setFormArmadaTipe(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Tug Boat (TB)">Tug Boat (TB)</option>
                    <option value="SPOB">SPOB</option>
                    <option value="Supply Vessel (SV)">Supply Vessel (SV)</option>
                    <option value="Motor Tanker (MT)">Motor Tanker (MT)</option>
                    <option value="Oil Barge (OB)">Oil Barge (OB)</option>
                    <option value="Tongkang / Barge (TK)">Tongkang / Barge (TK)</option>
                    <option value="LCT">LCT</option>
                    <option value="Crane Barge">Crane Barge</option>
                    <option value="Crew Boat">Crew Boat</option>
                    <option value="Hopper Barge">Hopper Barge</option>
                    <option value="Kantor / Departemen">Kantor / Departemen</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Target Kuota Kru (Slot) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formArmadaKuota}
                    onChange={(e) => setFormArmadaKuota(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Safe manning kapasitas personil armada
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Gross Tonnage (GT)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 150 GT atau 922"
                    value={formArmadaGt}
                    onChange={(e) => setFormArmadaGt(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Mesin / Tenaga (HP)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2 X 650 HP"
                    value={formArmadaMesin}
                    onChange={(e) => setFormArmadaMesin(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  No. Telepon / Radio Komunikasi Kapal
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 08115916597 atau -"
                  value={formArmadaTelp}
                  onChange={(e) => setFormArmadaTelp(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddArmadaModalOpen(false)}
                  className="h-8 px-4 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <Ship className="size-3.5" />
                  <span>Simpan Armada</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: TAMBAH PERSONEL CREW BARU */}
      {isAddCrewModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Tambah Personel Crew
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Daftarkan kru aktif, cadet magang, atau alokasikan slot posisi kru baru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCrewModalOpen(false)}
                className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleAddCrew} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Nama Lengkap Personel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={formCrewStatusSlot !== 'LOWONG (VACANT)'}
                    placeholder={
                      formCrewStatusSlot === 'LOWONG (VACANT)'
                        ? 'Otomatis: [POSISI LOWONG]'
                        : 'Contoh: Mochammad Firdaus'
                    }
                    value={formCrewNama}
                    onChange={(e) => setFormCrewNama(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    NIK / No. Registrasi
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: CPL-VSL-1480 (Otomatis jika kosong)"
                    value={formCrewNik}
                    onChange={(e) => setFormCrewNik(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Penugasan Armada / Kapal <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCrewKapal}
                    onChange={(e) => setFormCrewKapal(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {data.kapalRekap.map((k) => (
                      <option key={k.no} value={k.namaKapal}>
                        {k.namaKapal} ({k.tipeKapal})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Status Slot Awak <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCrewStatusSlot}
                    onChange={(e) =>
                      setFormCrewStatusSlot(
                        e.target.value as 'AKTIF' | 'CADET (MAGANG)' | 'LOWONG (VACANT)'
                      )
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="AKTIF">AKTIF (Awak Resmi)</option>
                    <option value="CADET (MAGANG)">CADET (MAGANG) (Taruna Prala)</option>
                    <option value="LOWONG (VACANT)">LOWONG (VACANT) (Slot Kosong)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Jabatan / Posisi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="crew-jabatan-list"
                    placeholder="Pilih atau ketik jabatan..."
                    value={formCrewJabatan}
                    onChange={(e) => setFormCrewJabatan(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <datalist id="crew-jabatan-list">
                    <option value="Nakhoda" />
                    <option value="Mualim I" />
                    <option value="Mualim II" />
                    <option value="Mualim III" />
                    <option value="KKM (Chief Engineer)" />
                    <option value="Masinis II" />
                    <option value="Masinis III" />
                    <option value="Juru Mudi" />
                    <option value="Juru Mudi I" />
                    <option value="Juru Mudi II" />
                    <option value="Oiler" />
                    <option value="Oiler I" />
                    <option value="Oiler II" />
                    <option value="Koki" />
                    <option value="Cadet Deck" />
                    <option value="Cadet Engine" />
                    <option value="Staff Operasional" />
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Departemen <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCrewDepartemen}
                    onChange={(e) => setFormCrewDepartemen(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Deck">Deck</option>
                    <option value="Engine">Engine</option>
                    <option value="Office / Darat">Office / Darat</option>
                    <option value="Catering / Umum">Catering / Umum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    No. Handphone / WA
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={formCrewHp}
                    onChange={(e) => setFormCrewHp(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Ijazah / Sertifikat
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: ANT-III, BST, S1"
                    value={formCrewIjazah}
                    onChange={(e) => setFormCrewIjazah(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Tahun Ijazah
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2021"
                    value={formCrewTahunIjazah}
                    onChange={(e) => setFormCrewTahunIjazah(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Tanggal On Board / Mulai
                  </label>
                  <input
                    type="date"
                    value={formCrewTglOnBoard}
                    onChange={(e) => setFormCrewTglOnBoard(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Asal Kampus / Sekolah
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: PIP Semarang, STIP Jakarta"
                    value={formCrewAsalKampus}
                    onChange={(e) => setFormCrewAsalKampus(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Catatan Mutasi / Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Penugasan perdana kru baru atau mutasi internal"
                  value={formCrewCatatan}
                  onChange={(e) => setFormCrewCatatan(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCrewModalOpen(false)}
                  className="h-8 px-4 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <UserPlus className="size-3.5" />
                  <span>Simpan Personel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

