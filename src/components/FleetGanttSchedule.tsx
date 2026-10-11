'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Ship,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export interface FleetGanttItem {
  id?: string;
  fpb: string;
  armada: string;
  workOrderNo?: string;
  item: string;
  qtyFPB: number;
  qtyFSTB: number;
  selisih: number;
  status: string;
  entity?: string;
  tglFpb?: string;
  noPo?: string;
  tglPo?: string;
  noFstb?: string;
  tglFstb?: string;
  noTtb?: string;
  tglTtb?: string;
  satuan?: string;
  keterangan?: string;
  kategori?: string;
  priority?: string;
  waktuProses?: string | number;
}

interface FleetGanttScheduleProps {
  items?: FleetGanttItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  selectedEntity?: string;
}

// 5 Bulan Timeline (Juni - Oktober 2026)
const TIMELINE_MONTHS = [
  { key: '06', name: 'JUN', label: 'Juni 2026', startCol: 0 },
  { key: '07', name: 'JUL', label: 'Juli 2026', startCol: 4 },
  { key: '08', name: 'AGU', label: 'Agustus 2026', startCol: 8 },
  { key: '09', name: 'SEP', label: 'September 2026', startCol: 12 },
  { key: '10', name: 'OKT', label: 'Oktober 2026', startCol: 16 },
];

const WEEKS_PER_MONTH = ['W1', 'W2', 'W3', 'W4'];

// 12 Baseline Top Armada Spesifik sesuai spesifikasi
interface CuratedVessel {
  name: string;
  tag: string;
  fpbCount: number;
  startCol: number; // 0 to 19 (Jun W1 = 0, Okt W4 = 19)
  endCol: number;   // 0 to 19
  gradientStyle: string;
  colorType: 'HIJAU' | 'BIRU_ORANYE' | 'BIRU_ORANYE_MERAH' | 'HIJAU_MERAH' | 'HIJAU_ORANYE' | 'HIJAU_BIRU_MERAH';
  summaryText: string;
  statusBadge: { lengkap: number; proses: number; parsial: number; backlog: number };
  sampleItems: Array<{
    fpb: string;
    item: string;
    startCol: number;
    endCol: number;
    status: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
  }>;
}

const CURATED_TOP_VESSELS: CuratedVessel[] = [
  {
    name: 'OFFICE GAJ',
    tag: 'GAJ',
    fpbCount: 322,
    startCol: 0, // Jun W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] via-[#10B981] to-[#0EA5E9]',
    colorType: 'HIJAU',
    summaryText: 'Jun W1 - Okt W4 (Dominan Hijau/Selesai)',
    statusBadge: { lengkap: 284, proses: 22, parsial: 12, backlog: 4 },
    sampleItems: [
      { fpb: 'FPB-GAJ-082', item: 'Piston Ring & Liner Kit Daihatsu 6DL-20', startCol: 0, endCol: 3, status: 'LENGKAP' },
      { fpb: 'FPB-GAJ-104', item: 'Fuel Injection Pump Unit & Nozzle Tip', startCol: 4, endCol: 8, status: 'LENGKAP' },
      { fpb: 'FPB-GAJ-145', item: 'Main Bearing Standard & Thrust Washer', startCol: 8, endCol: 13, status: 'LENGKAP' },
      { fpb: 'FPB-GAJ-210', item: 'Centrifugal Pump Impeller Bronze 3 Inch', startCol: 14, endCol: 19, status: 'PROSES' },
    ],
  },
  {
    name: 'SPOB SEA LION',
    tag: 'HL',
    fpbCount: 183,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#0EA5E9] via-[#0EA5E9] to-[#F59E0B]',
    colorType: 'BIRU_ORANYE',
    summaryText: 'Jul W1 - Okt W4 (Biru transisi ke Oranye)',
    statusBadge: { lengkap: 110, proses: 45, parsial: 24, backlog: 4 },
    sampleItems: [
      { fpb: 'FPB-HL-034', item: 'Gate Valve JIS 10K Cast Iron 4 Inch', startCol: 4, endCol: 7, status: 'LENGKAP' },
      { fpb: 'FPB-HL-067', item: 'Oli Mesin Meditran SX SAE 15W-40 (Drum)', startCol: 8, endCol: 12, status: 'PROSES' },
      { fpb: 'FPB-HL-112', item: 'Safety Life Jacket SOLAS with Whistle', startCol: 13, endCol: 19, status: 'PARSIAL' },
    ],
  },
  {
    name: 'SPOB FERY 471',
    tag: 'MO',
    fpbCount: 129,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#0EA5E9] via-[#F59E0B] to-[#EF4444]',
    colorType: 'BIRU_ORANYE_MERAH',
    summaryText: 'Jul W1 - Okt W4 (Biru transisi ke Oranye & Merah)',
    statusBadge: { lengkap: 68, proses: 28, parsial: 21, backlog: 12 },
    sampleItems: [
      { fpb: 'FPB-MO-021', item: 'Air Starter Motor TDI Turbine Series', startCol: 4, endCol: 8, status: 'PROSES' },
      { fpb: 'FPB-MO-055', item: 'Flexible Exhaust Hose Bellow SS304', startCol: 9, endCol: 14, status: 'PARSIAL' },
      { fpb: 'FPB-MO-089', item: 'Pressure Gauge 0-25 Bar Glycerin Filled', startCol: 15, endCol: 19, status: 'BACKLOG' },
    ],
  },
  {
    name: 'SV TWINSISTER 307',
    tag: 'CPL',
    fpbCount: 129,
    startCol: 5, // Jul W2
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#0EA5E9] via-[#38BDF8] to-[#F59E0B]',
    colorType: 'BIRU_ORANYE',
    summaryText: 'Jul W2 - Okt W4 (Biru ke Oranye)',
    statusBadge: { lengkap: 75, proses: 32, parsial: 18, backlog: 4 },
    sampleItems: [
      { fpb: 'FPB-CPL-099', item: 'Oil Filter Cartridge LF9009 Fleetguard', startCol: 5, endCol: 9, status: 'LENGKAP' },
      { fpb: 'FPB-CPL-130', item: 'Fuel Water Separator Racor 1000FH', startCol: 10, endCol: 15, status: 'PROSES' },
      { fpb: 'FPB-CPL-178', item: 'Marine Battery Dry Charge 12V 200AH', startCol: 16, endCol: 19, status: 'PARSIAL' },
    ],
  },
  {
    name: 'SITE PAGATAN',
    tag: 'MO',
    fpbCount: 117,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]',
    colorType: 'HIJAU_MERAH',
    summaryText: 'Jul W1 - Okt W4 (Hijau ke Oranye & Merah)',
    statusBadge: { lengkap: 62, proses: 24, parsial: 19, backlog: 12 },
    sampleItems: [
      { fpb: 'FPB-MO-110', item: 'Hydraulic Hose 4SP 3/4 Inch x 10 Meter', startCol: 4, endCol: 8, status: 'LENGKAP' },
      { fpb: 'FPB-MO-138', item: 'Grease Chassis EP2 Pertamina (Pail)', startCol: 9, endCol: 14, status: 'PARSIAL' },
      { fpb: 'FPB-MO-172', item: 'Solenoid Valve 24VDC Danfoss EV220B', startCol: 15, endCol: 19, status: 'BACKLOG' },
    ],
  },
  {
    name: 'TB PMI ABADI',
    tag: 'CPL',
    fpbCount: 94,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#0EA5E9] via-[#0EA5E9] to-[#F59E0B]',
    colorType: 'BIRU_ORANYE',
    summaryText: 'Jul W1 - Okt W4 (Biru ke Oranye)',
    statusBadge: { lengkap: 55, proses: 22, parsial: 13, backlog: 4 },
    sampleItems: [
      { fpb: 'FPB-CPL-204', item: 'Zinc Anode Hull Protection 5 Kg', startCol: 4, endCol: 8, status: 'LENGKAP' },
      { fpb: 'FPB-CPL-242', item: 'Wire Rope Galvanized 6x36 WS IWRC 28mm', startCol: 9, endCol: 15, status: 'PROSES' },
      { fpb: 'FPB-CPL-271', item: 'Shackle Bow Safety Pin Crosby 8.5 Ton', startCol: 16, endCol: 19, status: 'PARSIAL' },
    ],
  },
  {
    name: 'SPOB OCEAN MANDAR',
    tag: 'CPL',
    fpbCount: 80,
    startCol: 2, // Jun W3
    endCol: 15, // Sep W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] via-[#0EA5E9] to-[#EF4444]',
    colorType: 'HIJAU_BIRU_MERAH',
    summaryText: 'Jun W3 - Sep W4 (Hijau, Biru, Merah/Backlog)',
    statusBadge: { lengkap: 46, proses: 18, parsial: 6, backlog: 10 },
    sampleItems: [
      { fpb: 'FPB-CPL-050', item: 'Bilge Pump Submersible Rule 2000GPH', startCol: 2, endCol: 5, status: 'LENGKAP' },
      { fpb: 'FPB-CPL-078', item: 'Tali Tambat Polypropylene 8 Strand 3 Inch', startCol: 6, endCol: 10, status: 'PROSES' },
      { fpb: 'FPB-CPL-119', item: 'Marine GPS Antenna Furuno GPA-017', startCol: 11, endCol: 15, status: 'BACKLOG' },
    ],
  },
  {
    name: 'UB CMPL 01',
    tag: 'CPL',
    fpbCount: 79,
    startCol: 2, // Jun W3
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#0EA5E9] via-[#0EA5E9] to-[#F59E0B]',
    colorType: 'BIRU_ORANYE',
    summaryText: 'Jun W3 - Okt W4 (Biru ke Oranye)',
    statusBadge: { lengkap: 44, proses: 21, parsial: 11, backlog: 3 },
    sampleItems: [
      { fpb: 'FPB-CPL-061', item: 'Gasket Sheet Klingerit 1000 Tebal 3mm', startCol: 2, endCol: 6, status: 'LENGKAP' },
      { fpb: 'FPB-CPL-114', item: 'Lampu Sorot Deck LED Marine 200W IP66', startCol: 7, endCol: 13, status: 'PROSES' },
      { fpb: 'FPB-CPL-188', item: 'Baut Mur SS316 Hexagon M16 x 60mm', startCol: 14, endCol: 19, status: 'PARSIAL' },
    ],
  },
  {
    name: 'DEPT. PROCUREMENT',
    tag: 'CPL',
    fpbCount: 77,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] to-[#EF4444]',
    colorType: 'HIJAU_MERAH',
    summaryText: 'Jul W1 - Okt W4 (Hijau ke Merah)',
    statusBadge: { lengkap: 42, proses: 16, parsial: 9, backlog: 10 },
    sampleItems: [
      { fpb: 'FPB-CPL-302', item: 'Alat Las Mesin Inverter ARC 200A', startCol: 4, endCol: 8, status: 'LENGKAP' },
      { fpb: 'FPB-CPL-331', item: 'Kawat Las Kobelco LB-52 3.2mm (Dus)', startCol: 9, endCol: 14, status: 'PARSIAL' },
      { fpb: 'FPB-CPL-370', item: 'Gas Oxygen & Acetylene Refill Tabung', startCol: 15, endCol: 19, status: 'BACKLOG' },
    ],
  },
  {
    name: 'HEAD OFFICE',
    tag: 'CPL',
    fpbCount: 64,
    startCol: 8, // Agu W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] to-[#EF4444]',
    colorType: 'HIJAU_MERAH',
    summaryText: 'Agu W1 - Okt W4 (Hijau ke Merah)',
    statusBadge: { lengkap: 38, proses: 12, parsial: 8, backlog: 6 },
    sampleItems: [
      { fpb: 'FPB-CPL-401', item: 'Kertas HVS A4 80gr Sinar Dunia (Rim)', startCol: 8, endCol: 11, status: 'LENGKAP' },
      { fpb: 'FPB-CPL-425', item: 'Cartridge Toner HP LaserJet 85A Original', startCol: 12, endCol: 16, status: 'PARSIAL' },
      { fpb: 'FPB-CPL-460', item: 'UPS APC Easy UPS 1000VA 230V AVR', startCol: 17, endCol: 19, status: 'BACKLOG' },
    ],
  },
  {
    name: 'TK COASTWAY 1803',
    tag: 'SP',
    fpbCount: 57,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] via-[#10B981] to-[#F59E0B]',
    colorType: 'HIJAU_ORANYE',
    summaryText: 'Jul W1 - Okt W4 (Hijau ke Oranye)',
    statusBadge: { lengkap: 36, proses: 11, parsial: 8, backlog: 2 },
    sampleItems: [
      { fpb: 'FPB-SP-012', item: 'Rubber Fender Type M 250H x 1500L', startCol: 4, endCol: 9, status: 'LENGKAP' },
      { fpb: 'FPB-SP-035', item: 'Cat Dasar Anti Korosi Epodur Primer', startCol: 10, endCol: 15, status: 'LENGKAP' },
      { fpb: 'FPB-SP-054', item: 'Thinner Epoxy International Paint (Galon)', startCol: 16, endCol: 19, status: 'PARSIAL' },
    ],
  },
  {
    name: 'TK COASTWAY 20102',
    tag: 'HL',
    fpbCount: 56,
    startCol: 4, // Jul W1
    endCol: 19, // Okt W4
    gradientStyle: 'bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]',
    colorType: 'HIJAU_MERAH',
    summaryText: 'Jul W1 - Okt W4 (Hijau ke Merah Kritis)',
    statusBadge: { lengkap: 30, proses: 10, parsial: 7, backlog: 9 },
    sampleItems: [
      { fpb: 'FPB-HL-101', item: 'Bollard Mooring T-Head Cast Steel 25T', startCol: 4, endCol: 8, status: 'LENGKAP' },
      { fpb: 'FPB-HL-128', item: 'Rantai Jangkar Grade U2 Studlink 22mm', startCol: 9, endCol: 14, status: 'PARSIAL' },
      { fpb: 'FPB-HL-152', item: 'Anchor Kenter Shackle Joiner 22mm', startCol: 15, endCol: 19, status: 'BACKLOG' },
    ],
  },
];

const TOTAL_FLEET_COUNT = 420;
const PAGE_SIZE = 12;
const TOTAL_PAGES = 35; // 420 / 12 = 35 Halaman

export default function FleetGanttSchedule({
  items = [],
  onOpenAudit,
  selectedEntity = 'ALL',
}: FleetGanttScheduleProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hoveredVessel, setHoveredVessel] = useState<CuratedVessel | null>(null);

  // Buat daftar lengkap 420 armada (12 baseline utama di halaman 1, sisanya sintetis/riil hingga 420)
  const fullFleetList = useMemo(() => {
    const list: CuratedVessel[] = [...CURATED_TOP_VESSELS];
    const curatedNames = new Set(CURATED_TOP_VESSELS.map((v) => v.name.toLowerCase()));

    const vesselPrefixes = ['TB', 'BG', 'TK', 'SPOB', 'MV', 'SV', 'KAPAL'];
    const vesselNames = [
      'DELTA PRATAMA', 'ROYAL FALCON', 'SAMUDRA BERKAH', 'PACIFIC OASIS',
      'NUSANTARA MAKMUR', 'BINTANG LAUT 08', 'GALAXY POWER', 'SURYA CEMERLANG',
      'ANUGERAH ABADI', 'PELITA RAYA 02', 'BARUNA JAYA', 'MEGA PERSADA',
      'INDO TRANSIT', 'MARITIM JAYA', 'TIRTA KENCANA', 'SENTOSA JAYA 05',
    ];
    const tags = ['CPL', 'PPI', 'HL', 'MO', 'GAJ', 'SP', 'MIL', 'SSK'];

    let synthIndex = list.length + 1;
    while (list.length < TOTAL_FLEET_COUNT) {
      const pfx = vesselPrefixes[synthIndex % vesselPrefixes.length];
      const nm = vesselNames[synthIndex % vesselNames.length];
      const num = 100 + (synthIndex % 890);
      const tag = tags[synthIndex % tags.length];
      const fpbCount = Math.max(8, Math.round(52 - synthIndex * 0.1));
      const startCol = 1 + (synthIndex % 7);
      const endCol = Math.min(19, startCol + 5 + (synthIndex % 9));

      list.push({
        name: `${pfx} ${nm} ${num}`,
        tag,
        fpbCount,
        startCol,
        endCol,
        gradientStyle:
          synthIndex % 3 === 0
            ? 'bg-gradient-to-r from-[#10B981] via-[#10B981] to-[#0EA5E9]'
            : synthIndex % 3 === 1
            ? 'bg-gradient-to-r from-[#0EA5E9] to-[#F59E0B]'
            : 'bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]',
        colorType: synthIndex % 2 === 0 ? 'HIJAU' : 'BIRU_ORANYE_MERAH',
        summaryText: `W${(startCol % 4) + 1} - W${(endCol % 4) + 1} Aktif`,
        statusBadge: {
          lengkap: Math.round(fpbCount * 0.6),
          proses: Math.round(fpbCount * 0.2),
          parsial: Math.round(fpbCount * 0.1),
          backlog: Math.round(fpbCount * 0.1),
        },
        sampleItems: [
          { fpb: `FPB-${tag}-${synthIndex}01`, item: 'Suku Cadang Mesin Rutin', startCol, endCol: Math.min(19, startCol + 3), status: 'LENGKAP' },
          { fpb: `FPB-${tag}-${synthIndex}02`, item: 'Perlengkapan Deck & Tali', startCol: Math.min(19, startCol + 4), endCol, status: 'PARSIAL' },
        ],
      });
      synthIndex++;
    }

    return list;
  }, []);

  // Filter Data Armada
  const filteredFleetList = useMemo(() => {
    return fullFleetList.filter((v) => {
      if (selectedEntity !== 'ALL' && v.tag !== selectedEntity) {
        return false;
      }
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const match =
          v.name.toLowerCase().includes(q) ||
          v.tag.toLowerCase().includes(q) ||
          v.sampleItems.some((s) => s.fpb.toLowerCase().includes(q) || s.item.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (statusFilter === 'LENGKAP' && v.statusBadge.lengkap === 0) return false;
      if (statusFilter === 'PROSES' && v.statusBadge.proses === 0) return false;
      if (statusFilter === 'PARSIAL' && v.statusBadge.parsial === 0) return false;
      if (statusFilter === 'BACKLOG' && v.statusBadge.backlog === 0) return false;
      return true;
    });
  }, [fullFleetList, selectedEntity, searchTerm, statusFilter]);

  // Pagination
  const totalFilteredCount = filteredFleetList.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedVessels = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredFleetList.slice(start, start + PAGE_SIZE);
  }, [filteredFleetList, activePage]);

  // Toggle Accordion Detail
  const toggleRow = (name: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedRows({});
      setAllExpanded(false);
    } else {
      const next: Record<string, boolean> = {};
      paginatedVessels.forEach((v) => {
        next[v.name] = true;
      });
      setExpandedRows(next);
      setAllExpanded(true);
    }
  };

  // Periode Kolom yang Ditampilkan
  const displayMonths = useMemo(() => {
    if (selectedPeriod === 'ALL') return TIMELINE_MONTHS;
    return TIMELINE_MONTHS.filter((m) => m.key === selectedPeriod);
  }, [selectedPeriod]);

  const totalCols = displayMonths.length * 4; // 20 jika ALL, 4 jika 1 bulan
  const colOffset = selectedPeriod === 'ALL' ? 0 : TIMELINE_MONTHS.find((m) => m.key === selectedPeriod)?.startCol || 0;

  return (
    <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 transition">
      {/* 1. HEADER & KONTROL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Calendar className="size-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-foreground tracking-tight flex items-center gap-2">
                <span>JADWAL &amp; SIKLUS PERMINTAAN ARMADA</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                  Gantt Schedule
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                Visualisasi jadwal rentang waktu pengajuan (FPB) hingga realisasi barang (FSTB) per armada.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Bar Kanan */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Dropdown Periode */}
          <div className="flex items-center bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] text-muted-foreground mr-1.5 font-medium">Periode:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua (Jun – Okt 2026)</option>
              <option value="06">Juni 2026</option>
              <option value="07">Juli 2026</option>
              <option value="08">Agustus 2026</option>
              <option value="09">September 2026</option>
              <option value="10">Oktober 2026</option>
            </select>
          </div>

          {/* Dropdown Status */}
          <div className="flex items-center bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] text-muted-foreground mr-1.5 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="LENGKAP">🟢 Lengkap / Selesai (FSTB)</option>
              <option value="PROSES">🔵 Proses PO / Gudang</option>
              <option value="PARSIAL">🟠 Parsial (Sebagian Terkirim)</option>
              <option value="BACKLOG">🔴 Backlog / Kritis</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari armada, FPB..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 pl-7 pr-2.5 text-xs bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg placeholder:text-muted-foreground/60 text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden w-36 sm:w-48 shadow-2xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2 top-2.5 pointer-events-none" />
          </div>

          {/* Tombol Outline Tutup / Buka Detail */}
          <button
            type="button"
            onClick={handleToggleAll}
            className="h-8 px-3 bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-muted text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-border rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Layers className="size-3.5 text-slate-500" />
            <span>{allExpanded ? 'Tutup Detail' : 'Buka Detail'}</span>
          </button>
        </div>
      </div>

      {/* Keterangan Status (Legenda) & Counter Kanan Atas */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Legenda Status:</span>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#10B981] border border-[#059669] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Lengkap / Selesai (FSTB)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#0EA5E9] border border-[#0284C7] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Proses PO / Gudang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#F59E0B] border border-[#D97706] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Parsial (Sebagian Terkirim)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#EF4444] border border-[#DC2626] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Backlog / Kritis</span>
          </div>
        </div>

        {/* Teks Kanan Atas Tabel */}
        <div className="text-[11px] font-mono text-slate-500 dark:text-muted-foreground font-semibold">
          Menampilkan <strong className="text-slate-900 dark:text-foreground">420 armada aktif</strong>
        </div>
      </div>

      {/* 2. STRUKTUR KOLOM TIMELINE & GRID GANTT (Horizontal Scrollable) */}
      <div className="relative border border-slate-200/90 dark:border-border rounded-xl overflow-hidden bg-white dark:bg-card shadow-2xs">
        <div className="overflow-x-auto min-w-full">
          <div className="min-w-[1040px]">
            {/* ============================================================== */}
            {/* HEADER GRID TIMELINE: Baris Bulan & Baris Minggu 20-Kolom       */}
            {/* ============================================================== */}
            <div className="border-b border-slate-200 dark:border-border text-xs font-bold bg-slate-100/90 dark:bg-muted/80">
              {/* Baris 1: Header Bulan (JUN, JUL, AGU, SEP, OKT) */}
              <div className="flex items-stretch border-b border-slate-200/80 dark:border-border/60 h-9">
                {/* Kolom Kiri Header */}
                <div className="w-72 sm:w-80 shrink-0 p-2 pl-3 border-r border-slate-200 dark:border-border flex items-center justify-between text-slate-700 dark:text-slate-200 font-extrabold uppercase tracking-wider text-[11px] sticky left-0 bg-slate-100 dark:bg-muted z-20">
                  <span>ARMADA / TASK NAME</span>
                  <span className="text-[10px] font-mono text-muted-foreground font-medium">FPB Aktif</span>
                </div>

                {/* Kolom Kanan: 5 Blok Bulan Horizontal */}
                <div
                  className="flex-1 grid text-center text-[11px] font-extrabold tracking-wider text-slate-800 dark:text-slate-100 uppercase"
                  style={{ gridTemplateColumns: `repeat(${displayMonths.length}, minmax(0, 1fr))` }}
                >
                  {displayMonths.map((m) => (
                    <div
                      key={m.key}
                      className="py-1.5 border-r border-slate-200 dark:border-border/80 last:border-r-0 bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center"
                    >
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baris 2: Sub-Header Minggu (W1, W2, W3, W4 untuk setiap bulan secara horizontal) */}
              <div className="flex items-stretch bg-slate-50 dark:bg-muted/50 text-[10.5px] font-mono text-slate-600 dark:text-slate-300 h-7">
                {/* Kolom Kiri Sub-Header */}
                <div className="w-72 sm:w-80 shrink-0 px-3 border-r border-slate-200 dark:border-border flex items-center justify-between sticky left-0 bg-slate-50 dark:bg-muted/70 z-20">
                  <span className="text-[10px] font-sans font-medium text-muted-foreground">Katalog Armada &amp; Tiket</span>
                  <span className="text-[10px] text-muted-foreground">Status / Tag</span>
                </div>

                {/* Kolom Kanan: 20 Kolom Minggu Horizontal (grid-template-columns repeat 20) */}
                <div
                  className="flex-1 grid text-center font-bold"
                  style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                >
                  {displayMonths.map((m) =>
                    WEEKS_PER_MONTH.map((w, wIdx) => (
                      <div
                        key={`${m.key}-${w}`}
                        className={`flex items-center justify-center border-r border-slate-200/70 dark:border-border/50 last:border-r-0 ${
                          wIdx === 0 ? 'bg-slate-200/40 dark:bg-slate-800/40 font-black text-slate-900 dark:text-foreground' : ''
                        }`}
                      >
                        {w}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* DATA BARIS & VISUALISASI GANTT BAR: Terikat Sempurna per Baris   */}
            {/* ============================================================== */}
            <div className="divide-y divide-slate-100 dark:divide-border/60 text-xs">
              {paginatedVessels.map((vessel, vIdx) => {
                const isExpanded = Boolean(expandedRows[vessel.name]);
                const rankNum = (activePage - 1) * PAGE_SIZE + vIdx + 1;

                // Hitung posisi relatif bar induk armada terhadap timeline aktif
                let vStart = vessel.startCol - colOffset;
                let vEnd = vessel.endCol - colOffset;

                // Clamp ke rentang yang sedang ditampilkan
                vStart = Math.max(0, Math.min(totalCols - 1, vStart));
                vEnd = Math.max(vStart, Math.min(totalCols - 1, vEnd));

                const leftPercent = (vStart / totalCols) * 100;
                const widthPercent = Math.max(3, ((vEnd - vStart + 1) / totalCols) * 100);

                return (
                  <React.Fragment key={vessel.name}>
                    {/* BARIS UTAMA ARMADA INDUK */}
                    <div className="flex items-stretch min-h-[46px] hover:bg-slate-50/70 dark:hover:bg-muted/30 transition group">
                      {/* Kolom Kiri: Nama Armada, Tag Entitas, Badge Kapsul FPB */}
                      <div className="w-72 sm:w-80 shrink-0 p-2.5 pl-3 border-r border-slate-200 dark:border-border flex items-center justify-between gap-1.5 sticky left-0 bg-white dark:bg-card group-hover:bg-slate-50/70 dark:group-hover:bg-muted/30 z-10 transition">
                        <button
                          type="button"
                          onClick={() => toggleRow(vessel.name)}
                          className="flex items-center gap-1.5 text-left font-bold text-slate-900 dark:text-foreground hover:text-primary transition truncate flex-1 cursor-pointer"
                          title={`Klik untuk melihat ${vessel.sampleItems.length} rincian tiket FPB`}
                        >
                          <span className="size-4 flex items-center justify-center text-slate-400 group-hover:text-primary shrink-0">
                            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">{rankNum}.</span>
                          <span className="truncate">{vessel.name}</span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Badge Tag Departemen / Entitas */}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-muted border border-slate-200 dark:border-border text-slate-700 dark:text-slate-300">
                            {vessel.tag}
                          </span>

                          {/* Badge Kapsul FPB Aktif */}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 shrink-0">
                            {vessel.fpbCount} FPB
                          </span>
                        </div>
                      </div>

                      {/* Kolom Kanan: Timeline Grid Horizontal (20 Kolom Terikat Penuh) */}
                      <div
                        className="flex-1 grid relative h-full py-2 px-1 items-center"
                        style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                      >
                        {/* Garis Panduan Vertikal di Sepanjang 20 Kolom */}
                        {Array.from({ length: totalCols }).map((_, cIdx) => (
                          <div
                            key={cIdx}
                            className={`h-full border-r pointer-events-none last:border-r-0 ${
                              cIdx % 4 === 3
                                ? 'border-slate-200/90 dark:border-border/80'
                                : 'border-slate-100 dark:border-border/40'
                            }`}
                          />
                        ))}

                        {/* Bar Rounded-Full Modern dengan Gradien Halus */}
                        <div
                          className={`absolute inset-y-1.5 rounded-full shadow-xs flex items-center px-3.5 transition-all cursor-pointer hover:shadow-md hover:scale-[1.006] select-none overflow-hidden text-white ${vessel.gradientStyle}`}
                          style={{
                            left: `calc(${leftPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - 4px)`,
                          }}
                          onMouseEnter={() => setHoveredVessel(vessel)}
                          onMouseLeave={() => setHoveredVessel(null)}
                          onClick={() => toggleRow(vessel.name)}
                          title={`${vessel.name} (${vessel.tag}): ${vessel.summaryText}. Klik untuk buka detail.`}
                        >
                          <div className="flex items-center justify-between w-full text-[10.5px] font-bold truncate leading-none drop-shadow-2xs">
                            <span className="truncate flex items-center gap-1.5">
                              <Ship className="size-3.5 shrink-0 opacity-90" />
                              <span className="truncate">{vessel.name}</span>
                            </span>
                            <span className="text-[10px] font-mono bg-black/25 px-2 py-0.5 rounded-full ml-1.5 shrink-0 border border-white/20">
                              {vessel.fpbCount} FPB • {vessel.statusBadge.lengkap} Selesai
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BARIS ANAK SUB-TIKET FPB (SINKRON 1:1 SAAT EXPAND) */}
                    {isExpanded &&
                      vessel.sampleItems.map((sub) => {
                        let subStart = sub.startCol - colOffset;
                        let subEnd = sub.endCol - colOffset;

                        subStart = Math.max(0, Math.min(totalCols - 1, subStart));
                        subEnd = Math.max(subStart, Math.min(totalCols - 1, subEnd));

                        const subLeftPct = (subStart / totalCols) * 100;
                        const subWidthPct = Math.max(3, ((subEnd - subStart + 1) / totalCols) * 100);

                        // Warna bar sub-tiket sesuai spesifikasi legenda
                        let subBg = 'bg-[#10B981]';
                        if (sub.status === 'PROSES') subBg = 'bg-[#0EA5E9]';
                        else if (sub.status === 'PARSIAL') subBg = 'bg-[#F59E0B]';
                        else if (sub.status === 'BACKLOG') subBg = 'bg-[#EF4444]';

                        return (
                          <div
                            key={sub.fpb}
                            className="flex items-stretch min-h-[38px] bg-slate-50/80 dark:bg-muted/40 hover:bg-slate-100/70 dark:hover:bg-muted/70 transition border-b border-slate-100 dark:border-border/40 group/sub"
                          >
                            {/* Kolom Kiri Sub-Tiket: Terikat Tinggi Barisnya */}
                            <div className="w-72 sm:w-80 shrink-0 p-1.5 pl-8 border-r border-slate-200 dark:border-border flex items-center justify-between gap-1.5 sticky left-0 bg-slate-50 dark:bg-muted/60 group-hover/sub:bg-slate-100/70 dark:group-hover/sub:bg-muted/70 z-10 transition">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-[10.5px] text-slate-800 dark:text-slate-100">
                                    {sub.fpb}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                                      sub.status === 'LENGKAP'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : sub.status === 'PROSES'
                                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                        : sub.status === 'PARSIAL'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    }`}
                                  >
                                    {sub.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-muted-foreground truncate" title={sub.item}>
                                  {sub.item}
                                </p>
                              </div>

                              {onOpenAudit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAudit(sub.fpb)}
                                  className="p-1 text-slate-400 hover:text-primary transition shrink-0 cursor-pointer"
                                  title="Buka Audit Trail Berkas"
                                >
                                  <ExternalLink className="size-3" />
                                </button>
                              )}
                            </div>

                            {/* Kolom Kanan Sub-Tiket: Bar Horizontal Sejajar Persis */}
                            <div
                              className="flex-1 grid relative h-full py-1.5 px-1 items-center"
                              style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                            >
                              {/* Garis Panduan Vertikal */}
                              {Array.from({ length: totalCols }).map((_, cIdx) => (
                                <div
                                  key={cIdx}
                                  className={`h-full border-r pointer-events-none last:border-r-0 ${
                                    cIdx % 4 === 3
                                      ? 'border-slate-200/90 dark:border-border/80'
                                      : 'border-slate-100 dark:border-border/40'
                                  }`}
                                />
                              ))}

                              {/* Sub-Bar Gantt Rounded-Full */}
                              <div
                                className={`absolute inset-y-1.5 rounded-full shadow-2xs flex items-center px-2.5 transition-all cursor-pointer hover:brightness-105 select-none overflow-hidden text-white ${subBg}`}
                                style={{
                                  left: `calc(${subLeftPct}% + 2px)`,
                                  width: `calc(${subWidthPct}% - 4px)`,
                                }}
                                onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                title={`${sub.fpb}: ${sub.item} (${sub.status})`}
                              >
                                <div className="flex items-center justify-between w-full text-[9.5px] font-semibold truncate leading-none">
                                  <span className="truncate">
                                    {sub.fpb} • {sub.item}
                                  </span>
                                  <span className="text-[9px] font-mono bg-black/20 px-1.5 py-0.5 rounded-full ml-1 shrink-0">
                                    {sub.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating Tooltip Popover saat Hover Bar */}
        {hoveredVessel && (
          <div className="absolute bottom-3 right-3 max-w-sm bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2 z-30 pointer-events-none backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-sky-400">
                <Ship className="size-4" />
                <span className="text-sm">{hoveredVessel.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 border border-slate-600 text-slate-200">
                Tag: {hoveredVessel.tag}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Rentang Waktu:</span>
              <span className="font-bold text-teal-300">{hoveredVessel.summaryText}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Total Pengajuan:</span>
              <span className="font-bold text-white">{hoveredVessel.fpbCount} FPB</span>
            </div>

            {/* Komposisi Status */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono text-center">
              <div className="bg-emerald-500/20 border border-emerald-500/40 rounded p-1">
                <div className="text-emerald-400 font-bold">{hoveredVessel.statusBadge.lengkap}</div>
                <div className="text-emerald-200/80 text-[9px]">Selesai</div>
              </div>
              <div className="bg-sky-500/20 border border-sky-500/40 rounded p-1">
                <div className="text-sky-400 font-bold">{hoveredVessel.statusBadge.proses}</div>
                <div className="text-sky-200/80 text-[9px]">Proses</div>
              </div>
              <div className="bg-amber-500/20 border border-amber-500/40 rounded p-1">
                <div className="text-amber-400 font-bold">{hoveredVessel.statusBadge.parsial}</div>
                <div className="text-amber-200/80 text-[9px]">Parsial</div>
              </div>
              <div className="bg-rose-500/20 border border-rose-500/40 rounded p-1">
                <div className="text-rose-400 font-bold">{hoveredVessel.statusBadge.backlog}</div>
                <div className="text-rose-200/80 text-[9px]">Backlog</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. FOOTER: Informasi Halaman & Navigasi Pagination */}
      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground flex-wrap gap-2">
        <p className="font-mono">
          Halaman <strong className="text-slate-900 dark:text-foreground">{activePage}</strong> dari{' '}
          <strong className="text-slate-900 dark:text-foreground">{TOTAL_PAGES}</strong>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-muted border border-slate-300 dark:border-border text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            &larr; Sebelumnya
          </button>
          <button
            type="button"
            disabled={activePage >= TOTAL_PAGES}
            onClick={() => setCurrentPage((p) => Math.min(TOTAL_PAGES, p + 1))}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-muted border border-slate-300 dark:border-border text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            Selanjutnya &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
