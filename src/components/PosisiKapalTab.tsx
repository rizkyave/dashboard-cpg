'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Navigation,
  RefreshCw,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Anchor,
  Clock,
  Compass,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Ship,
  Wrench,
  Calendar,
  X,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  MapPin,
  Map as MapIcon,
} from 'lucide-react';
import { KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';

interface PosisiKapalTabProps {
  items: KapalPosisiItem[];
  summary: KapalPosisiSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function PosisiKapalTab({
  items,
  summary,
  isLoading,
  onRefresh,
  showToast,
}: PosisiKapalTabProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, ON, SB, MT, BD, DK
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'map'>('map');
  const [selectedMapZone, setSelectedMapZone] = useState<string>('ALL');
  const [hoveredMapZone, setHoveredMapZone] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState<'nusantara' | 'kaltim'>('nusantara');
  const [isSummaryHidden, setIsSummaryHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('CPG_POS_KAPAL_SUMMARY_HIDDEN') === 'true';
    }
    return false;
  });

  const toggleSummaryHidden = () => {
    setIsSummaryHidden((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('CPG_POS_KAPAL_SUMMARY_HIDDEN', String(next));
      }
      return next;
    });
  };

  // Advanced Search Specific Filters
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [searchKapal, setSearchKapal] = useState<string>('');
  const [searchPosisi, setSearchPosisi] = useState<string>('');
  const [searchActivity, setSearchActivity] = useState<string>('');
  const [searchKerusakan, setSearchKerusakan] = useState<string>('');

  const hasActiveAdvancedSearch = Boolean(
    searchKapal || searchPosisi || searchActivity || searchKerusakan
  );

  // Top Lokasi / Titik Kirim Terbanyak untuk filter cepat
  const topLocations = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => {
      const loc = (it.posisi || '').trim();
      if (!loc || loc === '-') return;
      counts.set(loc, (counts.get(loc) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  // Proyeksi Geografis Real (Lon/Lat -> SVG 900x480) & Kontur Garis Pantai Indonesia
  const geoBounds = useMemo(
    () =>
      mapZoom === 'kaltim'
        ? { minLon: 114.6, maxLon: 119.8, maxLat: 3.6, minLat: -4.2 }
        : { minLon: 95.0, maxLon: 129.0, maxLat: 6.4, minLat: -10.8 },
    [mapZoom]
  );

  const projectGeo = useCallback(
    (lat: number, lon: number) => {
      const padX = 28;
      const padY = 24;
      const w = 900 - padX * 2;
      const h = 480 - padY * 2;
      const x = padX + ((lon - geoBounds.minLon) / (geoBounds.maxLon - geoBounds.minLon)) * w;
      const y = padY + ((geoBounds.maxLat - lat) / (geoBounds.maxLat - geoBounds.minLat)) * h;
      return { x, y };
    },
    [geoBounds]
  );

  const islandPaths = useMemo(() => {
    const toPath = (coords: [number, number][]) =>
      coords
        .map(([lon, lat], idx) => {
          const { x, y } = projectGeo(lat, lon);
          return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ') + ' Z';

    const toOpenPath = (coords: [number, number][]) =>
      coords
        .map(([lon, lat], idx) => {
          const { x, y } = projectGeo(lat, lon);
          return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');

    // Kontur Geografis Multi-Titik Pulau Indonesia [lon, lat]
    const sumatra: [number, number][] = [
      [95.3, 5.5], [96.6, 5.2], [97.9, 4.9], [98.7, 3.8], [99.8, 3.0], [101.4, 1.7],
      [102.6, 1.2], [103.6, 0.4], [104.4, -0.8], [104.9, -1.9], [105.7, -2.5], [105.9, -4.2],
      [105.8, -5.8], [104.6, -5.5], [103.5, -4.9], [102.2, -3.8], [101.2, -2.5], [100.3, -1.0],
      [99.3, 0.5], [98.5, 1.8], [97.4, 3.2], [96.1, 4.4],
    ];
    const batamBintan: [number, number][] = [
      [103.85, 1.18], [104.65, 1.18], [104.62, 0.82], [103.92, 0.85],
    ];
    const bangkaBelitung: [number, number][] = [
      [105.2, -1.6], [106.2, -1.8], [106.8, -2.9], [105.9, -3.0], [105.3, -2.3],
    ];
    const jawa: [number, number][] = [
      [105.9, -6.0], [106.8, -6.1], [107.8, -6.2], [108.6, -6.7], [110.4, -6.9],
      [111.5, -6.7], [112.7, -7.2], [113.8, -7.7], [114.4, -8.2], [114.1, -8.7],
      [112.5, -8.4], [110.6, -8.2], [109.0, -7.7], [107.6, -7.5], [106.4, -7.0], [105.5, -6.7],
    ];
    const baliNusa: [number, number][] = [
      [114.6, -8.2], [115.6, -8.3], [116.5, -8.4], [117.8, -8.5], [119.0, -8.6],
      [120.5, -8.5], [122.4, -8.4], [123.0, -8.7], [121.2, -8.9], [119.5, -8.8],
      [117.2, -9.0], [115.3, -8.8], [114.5, -8.4],
    ];
    const sumbaTimor: [number, number][] = [
      [119.1, -9.5], [120.5, -9.8], [120.2, -10.2], [119.0, -9.8],
    ];
    const kalimantan: [number, number][] = [
      [109.1, 0.1], [108.9, 1.0], [109.7, 1.9], [111.2, 2.6], [112.9, 3.2],
      [114.3, 4.4], [115.4, 5.2], [116.8, 6.8], [117.7, 6.4], [118.4, 5.5],
      [118.6, 4.7], [117.9, 4.1], [117.6, 3.3], [117.6, 2.3], [118.4, 1.6],
      [119.0, 1.0], [118.0, 0.6], [117.6, 0.1], [117.5, -0.5], [117.25, -0.9],
      [117.0, -1.05], [116.84, -1.27], [116.78, -1.12], [116.71, -1.28], [116.45, -1.8],
      [116.3, -2.5], [116.2, -3.2], [115.8, -3.7], [114.5, -3.5], [113.3, -3.2],
      [112.0, -3.0], [110.9, -3.0], [110.0, -2.1], [109.4, -1.0],
    ];
    const sulawesi: [number, number][] = [
      [119.4, -5.2], [119.6, -4.0], [118.9, -2.7], [119.3, -1.5], [119.8, -0.8],
      [120.3, 0.4], [120.9, 1.2], [122.4, 1.1], [124.2, 1.2], [125.1, 1.5],
      [124.8, 0.7], [123.3, 0.4], [121.6, 0.3], [120.4, -0.4], [121.3, -1.3],
      [122.9, -0.8], [123.2, -1.4], [122.1, -2.2], [122.7, -3.8], [122.6, -4.6],
      [121.8, -4.4], [121.4, -3.5], [120.8, -4.3], [120.3, -4.9], [119.9, -5.5],
    ];
    const maluku: [number, number][] = [
      [127.4, 1.7], [128.4, 1.2], [128.6, 0.2], [127.8, -0.7], [127.2, 0.4],
    ];
    const mahakamRiver: [number, number][] = [
      [116.55, -0.45], [116.95, -0.52], [117.15, -0.5], [117.32, -0.62], [117.46, -0.75],
    ];

    return {
      sumatra: toPath(sumatra),
      batamBintan: toPath(batamBintan),
      bangkaBelitung: toPath(bangkaBelitung),
      jawa: toPath(jawa),
      baliNusa: toPath(baliNusa),
      sumbaTimor: toPath(sumbaTimor),
      kalimantan: toPath(kalimantan),
      sulawesi: toPath(sulawesi),
      maluku: toPath(maluku),
      mahakamRiver: toOpenPath(mahakamRiver),
    };
  }, [projectGeo]);

  // Zona Koordinat Geografis Real Titik Kirim Armada CPG
  const MAP_ZONES = useMemo(
    () => [
      {
        id: 'SUMATRA_BATAM',
        name: 'Batam & Sumatra',
        shortLabel: 'Batam / Sumatra',
        lat: 1.12,
        lon: 104.05,
        keywords: ['batam', 'riau', 'dumai', 'palembang', 'jambi', 'lampung', 'sumatra', 'sumatera', 'belawan', 'medan', 'karimun', 'natuna'],
      },
      {
        id: 'JAWA_BARAT',
        name: 'Jawa & Surabaya',
        shortLabel: 'Jawa / Surabaya',
        lat: -7.2,
        lon: 112.73,
        keywords: ['surabaya', 'gresik', 'lamongan', 'tuban', 'semarang', 'jakarta', 'tanjung priok', 'merak', 'cilegon', 'banten', 'jawa', 'cilacap', 'cirebon'],
      },
      {
        id: 'KALSEL_KOTABARU',
        name: 'Kalsel & Kotabaru',
        shortLabel: 'Kalsel / Kotabaru',
        lat: -3.28,
        lon: 116.18,
        keywords: ['banjarmasin', 'taboneo', 'batulicin', 'kotabaru', 'satui', 'asam', 'tanah bumbu', 'kalsel', 'sampit', 'kumai', 'pangkalan bun', 'trisakti'],
      },
      {
        id: 'SOMBER_KARIANGAU',
        name: 'Somber & Kariangau',
        shortLabel: 'Somber / Kariangau',
        lat: -1.21,
        lon: 116.79,
        nusantaraDx: -20,
        nusantaraDy: -18,
        keywords: ['somber', 'kariangau', 'kampung baru', 'teluk balikpapan', 'docking', 'galangan', 'ukm', 'penajam', 'lawe'],
      },
      {
        id: 'SEMAYANG_BALIKPAPAN',
        name: 'Balikpapan & Semayang',
        shortLabel: 'Balikpapan Hub',
        lat: -1.27,
        lon: 116.84,
        isMainHub: true,
        keywords: ['balikpapan', 'semayang', 'melawai', 'gaj', 'sudirman', 'klandasan', 'bpn', 'manggar', 'senipah', 'handil'],
      },
      {
        id: 'MUARA_JAWA_SAMARINDA',
        name: 'Samarinda & Muara Jawa',
        shortLabel: 'Samarinda / Mahakam',
        lat: -0.78,
        lon: 117.24,
        nusantaraDx: 18,
        nusantaraDy: -14,
        keywords: ['samarinda', 'muara jawa', 'sanga', 'mahakam', 'bontang', 'muara berau', 'tenggarong', 'separi', 'loa janan', 'marangkayu'],
      },
      {
        id: 'KALTARA_BERAU',
        name: 'Berau & Kaltara',
        shortLabel: 'Berau / Tarakan',
        lat: 2.75,
        lon: 117.55,
        keywords: ['berau', 'tarakan', 'nunukan', 'bunyu', 'tanjung redeb', 'bulungan', 'kaltara', 'malinau', 'sangkulirang'],
      },
      {
        id: 'SULAWESI',
        name: 'Sulawesi & Morowali',
        shortLabel: 'Sulawesi',
        lat: -2.55,
        lon: 121.6,
        keywords: ['makassar', 'morowali', 'kendari', 'palu', 'bitung', 'manado', 'luwuk', 'sulawesi', 'kolaka', 'pomalaa', 'parepare', 'mamuju'],
      },
      {
        id: 'AREA_LAIN',
        name: 'Area Operasional Lain',
        shortLabel: 'Area Lain / Offshore',
        lat: -2.1,
        lon: 119.2,
        keywords: [],
      },
    ],
    []
  );

  const classifyDeliveryZone = (posisiStr: string) => {
    const lower = (posisiStr || '').toLowerCase();
    for (const z of MAP_ZONES) {
      if (z.keywords.length > 0 && z.keywords.some((kw) => lower.includes(kw))) {
        return z.id;
      }
    }
    return 'AREA_LAIN';
  };

  // Status Badge Styling Helper
  const getStatusBadge = (statusKode: string, detailStatus?: string) => {
    switch (statusKode) {
      case 'ON':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
          bar: 'bg-emerald-500',
          label: 'ON - Operating / Beroperasi',
        };
      case 'SB':
        return {
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500',
          bar: 'bg-blue-500',
          label: detailStatus ? `SB (${detailStatus}) - Standby` : 'SB - Standby',
        };
      case 'MT':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          bar: 'bg-amber-500',
          label: 'MT - Maintenance',
        };
      case 'BD':
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500',
          bar: 'bg-rose-500',
          label: 'BD - Breakdown',
        };
      case 'DK':
        return {
          bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
          dot: 'bg-purple-500',
          bar: 'bg-purple-500',
          label: 'DK - Docking',
        };
      default:
        return {
          bg: 'bg-muted text-muted-foreground border-border',
          dot: 'bg-muted-foreground',
          bar: 'bg-muted-foreground/40',
          label: statusKode || 'Unknown',
        };
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && item.statusKode !== statusFilter) {
        return false;
      }

      // 2. Global Search
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const matchNama = item.namaKapal.toLowerCase().includes(q);
        const matchCall = item.callsign?.toLowerCase().includes(q);
        const matchPos = item.posisi.toLowerCase().includes(q);
        const matchAct = item.activity.toLowerCase().includes(q);
        const matchKer = item.kerusakan?.toLowerCase().includes(q);
        const matchKet = item.keterangan?.toLowerCase().includes(q);
        const matchStat = item.statusKode.toLowerCase().includes(q);
        const matchDetail = item.detailStatus?.toLowerCase().includes(q);

        if (
          !matchNama &&
          !matchCall &&
          !matchPos &&
          !matchAct &&
          !matchKer &&
          !matchKet &&
          !matchStat &&
          !matchDetail
        ) {
          return false;
        }
      }

      // 3. Advanced Search: Spesifik Nama Kapal
      if (searchKapal.trim() !== '') {
        const qk = searchKapal.toLowerCase().trim();
        const matchNama = item.namaKapal.toLowerCase().includes(qk);
        const matchCall = item.callsign?.toLowerCase().includes(qk);
        if (!matchNama && !matchCall) return false;
      }

      // 4. Advanced Search: Spesifik Posisi Kapal
      if (searchPosisi.trim() !== '') {
        const qp = searchPosisi.toLowerCase().trim();
        if (!item.posisi.toLowerCase().includes(qp)) return false;
      }

      // 5. Advanced Search: Spesifik Aktivitas / Rute
      if (searchActivity.trim() !== '') {
        const qa = searchActivity.toLowerCase().trim();
        if (!item.activity.toLowerCase().includes(qa)) return false;
      }

      // 6. Advanced Search: Spesifik Kerusakan / Keterangan
      if (searchKerusakan.trim() !== '') {
        const qk = searchKerusakan.toLowerCase().trim();
        const matchKer = item.kerusakan?.toLowerCase().includes(qk);
        const matchKet = item.keterangan?.toLowerCase().includes(qk);
        if (!matchKer && !matchKet) return false;
      }

      return true;
    });
  }, [
    items,
    statusFilter,
    searchTerm,
    searchKapal,
    searchPosisi,
    searchActivity,
    searchKerusakan,
  ]);

  // Kelompokkan armada terfilter berdasarkan zona peta titik kirim + proyeksikan koordinat
  const mapZoneGroups = useMemo(() => {
    const grouped = new Map<string, KapalPosisiItem[]>();
    MAP_ZONES.forEach((z) => grouped.set(z.id, []));
    filteredItems.forEach((it) => {
      const zId = classifyDeliveryZone(it.posisi);
      grouped.get(zId)?.push(it);
    });
    return MAP_ZONES.map((z) => {
      const zoneItems = grouped.get(z.id) || [];
      const pt = projectGeo(z.lat, z.lon);
      const dx = mapZoom === 'nusantara' && 'nusantaraDx' in z ? (z.nusantaraDx || 0) : 0;
      const dy = mapZoom === 'nusantara' && 'nusantaraDy' in z ? (z.nusantaraDy || 0) : 0;
      const x = pt.x + dx;
      const y = pt.y + dy;
      const inBounds = x >= 15 && x <= 885 && y >= 15 && y <= 465;
      const onCount = zoneItems.filter((i) => i.statusKode === 'ON').length;
      const sbCount = zoneItems.filter((i) => i.statusKode === 'SB').length;
      const issueCount = zoneItems.filter((i) => ['MT', 'BD', 'DK'].includes(i.statusKode)).length;
      return {
        ...z,
        x,
        y,
        inBounds,
        items: zoneItems,
        onCount,
        sbCount,
        issueCount,
      };
    });
  }, [filteredItems, MAP_ZONES, projectGeo, mapZoom]);

  const activeMapZoneObj = useMemo(() => {
    if (selectedMapZone === 'ALL') return null;
    return mapZoneGroups.find((z) => z.id === selectedMapZone) || null;
  }, [mapZoneGroups, selectedMapZone]);

  const hudFocusZoneObj = useMemo(() => {
    if (hoveredMapZone) {
      return mapZoneGroups.find((z) => z.id === hoveredMapZone) || null;
    }
    return activeMapZoneObj || mapZoneGroups.find((z) => z.isMainHub) || null;
  }, [hoveredMapZone, activeMapZoneObj, mapZoneGroups]);

  const mapSidebarItems = activeMapZoneObj ? activeMapZoneObj.items : filteredItems;

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════
          HEADER & KPI METRICS
          ═══════════════════════════════════════════════════════════ */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-500/[0.06] via-card to-teal-500/[0.05] border border-border shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-sm shrink-0">
                <MapPin className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                    Titik Kirim Armada
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {items.length} Unit Terdata
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Referensi lokasi sandar, aktivitas harian, dan kesiapan armada untuk pengiriman logistik
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleSummaryHidden}
              className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title={isSummaryHidden ? 'Tampilkan Ringkasan Armada' : 'Sembunyikan Ringkasan Armada'}
            >
              <span>{isSummaryHidden ? 'Tampilkan Ringkasan' : 'Sembunyikan Ringkasan'}</span>
              <ChevronDown
                className={`size-3 transition-transform duration-200 ${
                  isSummaryHidden ? '-rotate-90' : ''
                }`}
              />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer ${
                isLoading
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 cursor-wait'
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Menyinkronkan...' : 'Refresh Titik Kirim'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        {!isSummaryHidden && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-border/60 animate-in fade-in-50 duration-200">
          {/* Total Kapal */}
          <div className="p-2.5 rounded-xl bg-background border border-border/80">
            <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Ship className="size-3 text-muted-foreground" />
              <span>Total Armada</span>
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5 font-mono">
              {items.length} <span className="text-xs font-normal text-muted-foreground">Unit</span>
            </div>
          </div>

          {/* ON (Operating) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'ON' ? 'ALL' : 'ON')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'ON'
                ? 'bg-emerald-500/15 border-emerald-500/40'
                : 'bg-background hover:bg-emerald-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              <span>Operasi (ON)</span>
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              {summary ? summary.totalON : items.filter((i) => i.statusKode === 'ON').length}
            </div>
          </div>

          {/* SB (Standby) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'SB' ? 'ALL' : 'SB')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'SB'
                ? 'bg-blue-500/15 border-blue-500/40'
                : 'bg-background hover:bg-blue-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-blue-500"></span>
              <span>Standby (SB)</span>
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
              {summary ? summary.totalSB : items.filter((i) => i.statusKode === 'SB').length}
            </div>
          </div>

          {/* MT (Maintenance) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'MT' ? 'ALL' : 'MT')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'MT'
                ? 'bg-amber-500/15 border-amber-500/40'
                : 'bg-background hover:bg-amber-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500"></span>
              <span>Maintenance (MT)</span>
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
              {summary ? summary.totalMT : items.filter((i) => i.statusKode === 'MT').length}
            </div>
          </div>

          {/* BD (Breakdown) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'BD' ? 'ALL' : 'BD')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'BD'
                ? 'bg-rose-500/15 border-rose-500/40'
                : 'bg-background hover:bg-rose-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-500"></span>
              <span>Breakdown (BD)</span>
            </div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
              {summary ? summary.totalBD : items.filter((i) => i.statusKode === 'BD').length}
            </div>
          </div>

          {/* DK (Docking) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'DK' ? 'ALL' : 'DK')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'DK'
                ? 'bg-purple-500/15 border-purple-500/40'
                : 'bg-background hover:bg-purple-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-purple-500"></span>
              <span>Docking (DK)</span>
            </div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
              {summary ? summary.totalDK : items.filter((i) => i.statusKode === 'DK').length}
            </div>
          </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FILTER & ADVANCED SEARCH CONTROLS
          ═══════════════════════════════════════════════════════════ */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        {/* Row 1: Search Bar & Toggle Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama kapal, call sign, posisi, atau aktivitas..."
                className="w-full h-8 pl-8 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Advanced Search Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedSearch((prev) => !prev)}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
                hasActiveAdvancedSearch
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold'
                  : showAdvancedSearch
                  ? 'bg-muted text-foreground border-border'
                  : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Advanced Search</span>
              <span className="sm:hidden">Adv</span>
              {hasActiveAdvancedSearch && <span className="size-1.5 rounded-full bg-amber-500"></span>}
              <ChevronDown
                className={`size-3 transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-sky-500 text-white shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MapIcon className="size-3" />
                <span>Peta</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="size-3" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="size-3" />
                <span>Kartu</span>
              </button>
            </div>

            {(statusFilter !== 'ALL' || searchTerm || hasActiveAdvancedSearch) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchTerm('');
                  setSearchKapal('');
                  setSearchPosisi('');
                  setSearchActivity('');
                  setSearchKerusakan('');
                }}
                className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Search Collapsible Panel */}
        {showAdvancedSearch && (
          <div className="p-3 rounded-xl bg-muted/30 border border-border/80 space-y-2.5 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3 text-amber-500" />
                <span>Pencarian Spesifik Kolom Titik Kirim Armada</span>
              </span>
              {hasActiveAdvancedSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKapal('');
                    setSearchPosisi('');
                    setSearchActivity('');
                    setSearchKerusakan('');
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-400 flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="size-3" />
                  <span>Bersihkan Filter Kolom</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Nama Kapal / Call Sign:
                </label>
                <input
                  type="text"
                  value={searchKapal}
                  onChange={(e) => setSearchKapal(e.target.value)}
                  placeholder="Cth: Cindara, Amber, PNUA..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Posisi / Lokasi / Jetty:
                </label>
                <input
                  type="text"
                  value={searchPosisi}
                  onChange={(e) => setSearchPosisi(e.target.value)}
                  placeholder="Cth: Balikpapan, GAJ, Jetty UKM..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Aktivitas / Kegiatan:
                </label>
                <input
                  type="text"
                  value={searchActivity}
                  onChange={(e) => setSearchActivity(e.target.value)}
                  placeholder="Cth: Bunker, Loading, Perawatan..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Status Terakhir / Keterangan:
                </label>
                <input
                  type="text"
                  value={searchKerusakan}
                  onChange={(e) => setSearchKerusakan(e.target.value)}
                  placeholder="Cth: Pompa, Main Engine, Ovrh..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Filter Status Badges & Top Titik Kirim */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-medium mr-1 shrink-0">
              Status Kapal:
            </span>
            {[
              { id: 'ALL', label: `Semua (${items.length})` },
              { id: 'ON', label: 'Operasi (ON)' },
              { id: 'SB', label: 'Standby (SB)' },
              { id: 'MT', label: 'Maintenance (MT)' },
              { id: 'BD', label: 'Breakdown (BD)' },
              { id: 'DK', label: 'Docking (DK)' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border shrink-0 cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {topLocations.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium mr-1 shrink-0 flex items-center gap-1">
                <MapPin className="size-3 text-sky-500" />
                <span>Titik Ramai:</span>
              </span>
              {topLocations.map((loc) => {
                const isSelected = searchPosisi.toLowerCase() === loc.name.toLowerCase();
                return (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => setSearchPosisi(isSelected ? '' : loc.name)}
                    className={`h-6 px-2 rounded-md text-[11px] font-medium transition whitespace-nowrap border shrink-0 flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/40 font-semibold'
                        : 'bg-muted/40 text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted'
                    }`}
                  >
                    <span className="truncate max-w-[140px]">{loc.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({loc.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DATA VIEW (TABLE OR CARDS)
          ═══════════════════════════════════════════════════════════ */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
          <Ship className="size-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">Tidak Ada Data Titik Kirim Armada</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {items.length === 0
              ? 'Data belum ditarik dari server operasional. Silakan klik tombol "Refresh Titik Kirim" di atas.'
              : 'Tidak ditemukan data kapal yang cocok dengan filter atau kata kunci pencarian Anda.'}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="mt-2 h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Tarik Data Sekarang</span>
            </button>
          )}
        </div>
      ) : viewMode === 'map' ? (
        /* Interactive Futuristic Geographic Maritime Map View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Interactive SVG Maritime Command Map */}
          <div className="lg:col-span-8 rounded-2xl bg-[#030b17] border border-sky-900/50 shadow-xl overflow-hidden flex flex-col">
            {/* Map Top HUD Bar */}
            <div className="px-4 py-2.5 border-b border-sky-900/50 bg-[#061224]/90 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2.5 bg-teal-400" />
                </span>
                <span className="font-bold text-slate-100 tracking-wide">
                  Peta Geografis Titik Kirim Armada
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {filteredItems.length} Unit
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Zoom Level Toggle */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setMapZoom('nusantara')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      mapZoom === 'nusantara'
                        ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Nusantara
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapZoom('kaltim')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      mapZoom === 'kaltim'
                        ? 'bg-teal-500/25 text-teal-200 border border-teal-400/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Fokus Kaltim
                  </button>
                </div>

                {selectedMapZone !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedMapZone('ALL')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-mono cursor-pointer transition"
                  >
                    Reset Zona
                  </button>
                )}
              </div>
            </div>

            {/* SVG Map Canvas */}
            <div className="relative w-full aspect-[16/9] min-h-[340px] bg-gradient-to-br from-[#020813] via-[#06162a] to-[#081f38] select-none overflow-hidden">
              {(() => {
                const hubNode =
                  mapZoneGroups.find((z) => z.id === 'SEMAYANG_BALIKPAPAN') || mapZoneGroups[0];
                const meridians =
                  mapZoom === 'kaltim' ? [115, 116, 117, 118, 119] : [100, 105, 110, 115, 120, 125];
                const parallels =
                  mapZoom === 'kaltim' ? [3, 2, 1, 0, -1, -2, -3, -4] : [5, 0, -5, -10];
                const referenceCities =
                  mapZoom === 'kaltim'
                    ? [
                        { name: 'TARAKAN', lat: 3.3, lon: 117.6 },
                        { name: 'BONTANG', lat: 0.13, lon: 117.48 },
                        { name: 'SAMARINDA', lat: -0.5, lon: 117.15 },
                        { name: 'BALIKPAPAN', lat: -1.26, lon: 116.83 },
                        { name: 'BANJARMASIN', lat: -3.32, lon: 114.59 },
                      ]
                    : [
                        { name: 'BATAM', lat: 1.1, lon: 104.0 },
                        { name: 'JAKARTA', lat: -6.2, lon: 106.8 },
                        { name: 'SURABAYA', lat: -7.25, lon: 112.75 },
                        { name: 'MAKASSAR', lat: -5.14, lon: 119.42 },
                      ];

                return (
                  <svg
                    viewBox="0 0 900 480"
                    className="w-full h-full"
                    role="img"
                    aria-label="Peta Geografis Titik Kirim Armada"
                  >
                    <defs>
                      <radialGradient id="oceanBathymetry" cx="56%" cy="48%" r="65%">
                        <stop offset="0%" stopColor="#0c2b4b" stopOpacity="0.6" />
                        <stop offset="55%" stopColor="#06172c" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#020813" stopOpacity="1" />
                      </radialGradient>

                      <linearGradient id="landMassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#133356" />
                        <stop offset="100%" stopColor="#0a1e36" />
                      </linearGradient>

                      <linearGradient id="kaltimFocusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#164069" />
                        <stop offset="100%" stopColor="#0d2947" />
                      </linearGradient>

                      <radialGradient id="hubAura" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.32" />
                        <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                      </radialGradient>

                      <linearGradient id="radarBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                      </linearGradient>

                      <filter id="coastGlow" x="-10%" y="-10%" width="120%" height="120%">
                        <feGaussianBlur stdDeviation="2.2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>

                      <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>

                      <pattern id="tacticalGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path
                          d="M 30 0 L 0 0 0 30"
                          fill="none"
                          stroke="#1e4976"
                          strokeWidth="0.4"
                          strokeOpacity="0.22"
                        />
                      </pattern>
                    </defs>

                    {/* Deep Ocean Background & Tactical Grid */}
                    <rect width="900" height="480" fill="url(#oceanBathymetry)" />
                    <rect width="900" height="480" fill="url(#tacticalGrid)" />

                    {/* Geographic Graticule (Lat/Lon Lines) */}
                    {meridians.map((lon) => {
                      const { x } = projectGeo(0, lon);
                      return (
                        <g key={`lon-${lon}`}>
                          <line
                            x1={x}
                            y1={16}
                            x2={x}
                            y2={464}
                            stroke="#38bdf8"
                            strokeWidth="0.5"
                            strokeOpacity="0.16"
                            strokeDasharray="2 4"
                          />
                          <text
                            x={x + 3}
                            y={24}
                            fill="#38bdf8"
                            fillOpacity="0.4"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            {lon}°E
                          </text>
                        </g>
                      );
                    })}
                    {parallels.map((lat) => {
                      const { y } = projectGeo(lat, geoBounds.minLon);
                      return (
                        <g key={`lat-${lat}`}>
                          <line
                            x1={16}
                            y1={y}
                            x2={884}
                            y2={y}
                            stroke={lat === 0 ? '#2dd4bf' : '#38bdf8'}
                            strokeWidth={lat === 0 ? '0.8' : '0.5'}
                            strokeOpacity={lat === 0 ? '0.28' : '0.15'}
                            strokeDasharray={lat === 0 ? '6 3' : '2 4'}
                          />
                          <text
                            x={22}
                            y={y - 4}
                            fill={lat === 0 ? '#5eead4' : '#38bdf8'}
                            fillOpacity="0.45"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            {lat === 0 ? '0° EQ' : lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Radar Rings & Animated Sweep centered on Balikpapan Hub */}
                    <g opacity="0.9">
                      <circle cx={hubNode.x} cy={hubNode.y} r="135" fill="url(#hubAura)" />
                      <circle
                        cx={hubNode.x}
                        cy={hubNode.y}
                        r="70"
                        fill="none"
                        stroke="#2dd4bf"
                        strokeWidth="0.7"
                        strokeOpacity="0.28"
                        strokeDasharray="3 4"
                      />
                      <circle
                        cx={hubNode.x}
                        cy={hubNode.y}
                        r="145"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="0.7"
                        strokeOpacity="0.18"
                        strokeDasharray="4 6"
                      />
                      <circle
                        cx={hubNode.x}
                        cy={hubNode.y}
                        r="240"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="0.6"
                        strokeOpacity="0.12"
                        strokeDasharray="5 8"
                      />
                      {/* Animated Rotating Radar Sector */}
                      <g transform={`translate(${hubNode.x}, ${hubNode.y})`}>
                        <g>
                          <path
                            d="M 0 0 L 145 -38 A 150 150 0 0 1 145 38 Z"
                            fill="url(#radarBeamGrad)"
                          />
                          <line
                            x1="0"
                            y1="0"
                            x2="145"
                            y2="-38"
                            stroke="#2dd4bf"
                            strokeWidth="0.8"
                            strokeOpacity="0.45"
                          />
                          <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 0 0"
                            to="360 0 0"
                            dur="12s"
                            repeatCount="indefinite"
                          />
                        </g>
                      </g>
                    </g>

                    {/* Realistic Multi-Point Indonesian Archipelago Coastlines */}
                    <g filter="url(#coastGlow)">
                      <path
                        d={islandPaths.sumatra}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.42"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <path
                        d={islandPaths.batamBintan}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.45"
                        strokeWidth="1"
                      />
                      <path
                        d={islandPaths.bangkaBelitung}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.35"
                        strokeWidth="1"
                      />
                      <path
                        d={islandPaths.jawa}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.45"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <path
                        d={islandPaths.baliNusa}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.38"
                        strokeWidth="1"
                      />
                      <path
                        d={islandPaths.sumbaTimor}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.3"
                        strokeWidth="0.9"
                      />
                      {/* Kalimantan (Primary Focus with Mahakam Delta & Teluk Balikpapan) */}
                      <path
                        d={islandPaths.kalimantan}
                        fill="url(#kaltimFocusGrad)"
                        stroke="#2dd4bf"
                        strokeOpacity="0.65"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      {/* Mahakam River Trace */}
                      <path
                        d={islandPaths.mahakamRiver}
                        fill="none"
                        stroke="#38bdf8"
                        strokeOpacity="0.4"
                        strokeWidth={mapZoom === 'kaltim' ? '2' : '1'}
                        strokeLinecap="round"
                      />
                      <path
                        d={islandPaths.sulawesi}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.45"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <path
                        d={islandPaths.maluku}
                        fill="url(#landMassGrad)"
                        stroke="#38bdf8"
                        strokeOpacity="0.32"
                        strokeWidth="1"
                      />
                    </g>

                    {/* Sea & Region Watermarks */}
                    {mapZoom === 'nusantara' ? (
                      <>
                        <text
                          x={projectGeo(-1.5, 118.2).x}
                          y={projectGeo(-1.5, 118.2).y}
                          fill="#38bdf8"
                          fillOpacity="0.28"
                          fontSize="8.5"
                          fontFamily="monospace"
                          letterSpacing="2"
                        >
                          SELAT MAKASSAR
                        </text>
                        <text
                          x={projectGeo(-5.2, 110.2).x}
                          y={projectGeo(-5.2, 110.2).y}
                          fill="#38bdf8"
                          fillOpacity="0.25"
                          fontSize="8.5"
                          fontFamily="monospace"
                          letterSpacing="2"
                        >
                          LAUT JAWA
                        </text>
                        <text
                          x={projectGeo(0.2, 112.2).x}
                          y={projectGeo(0.2, 112.2).y}
                          fill="#94a3b8"
                          fillOpacity="0.32"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          letterSpacing="3"
                        >
                          KALIMANTAN
                        </text>
                      </>
                    ) : (
                      <>
                        <text
                          x={projectGeo(-1.2, 118.2).x}
                          y={projectGeo(-1.2, 118.2).y}
                          fill="#38bdf8"
                          fillOpacity="0.32"
                          fontSize="10"
                          fontFamily="monospace"
                          letterSpacing="3"
                        >
                          SELAT MAKASSAR
                        </text>
                        <text
                          x={projectGeo(0.5, 115.1).x}
                          y={projectGeo(0.5, 115.1).y}
                          fill="#94a3b8"
                          fillOpacity="0.3"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                          letterSpacing="3"
                        >
                          KALIMANTAN TIMUR
                        </text>
                      </>
                    )}

                    {/* Reference City Micro-Markers */}
                    {referenceCities.map((city) => {
                      const pt = projectGeo(city.lat, city.lon);
                      return (
                        <g key={city.name} transform={`translate(${pt.x}, ${pt.y})`} opacity="0.65">
                          <rect x="-1.5" y="-1.5" width="3" height="3" fill="#94a3b8" />
                          <text
                            x="5"
                            y="2.5"
                            fill="#94a3b8"
                            fontSize="7.5"
                            fontFamily="monospace"
                            letterSpacing="0.8"
                          >
                            {city.name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Animated Logistics Route Arcs from Balikpapan Hub */}
                    {mapZoneGroups
                      .filter((z) => z.items.length > 0 && z.id !== 'SEMAYANG_BALIKPAPAN' && z.inBounds)
                      .map((z) => {
                        const midX = (hubNode.x + z.x) / 2;
                        const midY = (hubNode.y + z.y) / 2 - (mapZoom === 'kaltim' ? 20 : 26);
                        const isSelected = selectedMapZone === z.id || hoveredMapZone === z.id;
                        const pathD = `M ${hubNode.x} ${hubNode.y} Q ${midX} ${midY} ${z.x} ${z.y}`;
                        return (
                          <g key={`route-${z.id}`}>
                            <path
                              d={pathD}
                              fill="none"
                              stroke={isSelected ? '#2dd4bf' : '#38bdf8'}
                              strokeWidth={isSelected ? '2' : '1.1'}
                              strokeOpacity={isSelected ? '0.85' : '0.35'}
                              strokeDasharray="6 5"
                            >
                              <animate
                                attributeName="stroke-dashoffset"
                                from="22"
                                to="0"
                                dur="1.6s"
                                repeatCount="indefinite"
                              />
                            </path>
                            <circle r={isSelected ? '3' : '2'} fill={isSelected ? '#5eead4' : '#7dd3fc'}>
                              <animateMotion dur="2.6s" repeatCount="indefinite" path={pathD} />
                            </circle>
                          </g>
                        );
                      })}

                    {/* Interactive Delivery Hub Nodes */}
                    {mapZoneGroups
                      .filter((z) => z.inBounds)
                      .map((z) => {
                        const count = z.items.length;
                        const isSelected = selectedMapZone === z.id;
                        const isHovered = hoveredMapZone === z.id;
                        const isEmpty = count === 0;
                        const pinRadius = isEmpty ? 7 : Math.min(18, 10 + Math.sqrt(count) * 1.5);
                        const fillCol = isEmpty
                          ? '#1e293b'
                          : z.isMainHub
                          ? '#14b8a6'
                          : isSelected
                          ? '#f59e0b'
                          : '#0ea5e9';

                        return (
                          <g
                            key={z.id}
                            transform={`translate(${z.x}, ${z.y})`}
                            onClick={() => setSelectedMapZone(isSelected ? 'ALL' : z.id)}
                            onMouseEnter={() => setHoveredMapZone(z.id)}
                            onMouseLeave={() => setHoveredMapZone(null)}
                            className="cursor-pointer"
                            filter={!isEmpty ? 'url(#nodeGlow)' : undefined}
                          >
                            {/* Outer Target Reticle when Selected/Hovered */}
                            {(isSelected || isHovered) && (
                              <circle
                                r={pinRadius + 10}
                                fill="none"
                                stroke={fillCol}
                                strokeWidth="1.2"
                                strokeDasharray="3 3"
                                strokeOpacity="0.9"
                              />
                            )}

                            {/* Pulse Aura Ring */}
                            {!isEmpty && (
                              <circle
                                r={pinRadius + 5}
                                fill={fillCol}
                                fillOpacity={isSelected ? '0.28' : '0.14'}
                                stroke={fillCol}
                                strokeOpacity={isSelected ? '0.85' : '0.4'}
                                strokeWidth="1"
                              />
                            )}

                            {/* Main Pin Core */}
                            <circle
                              r={pinRadius}
                              fill={fillCol}
                              stroke={isSelected ? '#ffffff' : '#020617'}
                              strokeWidth={isSelected ? '2.2' : '1.5'}
                            />

                            {/* Unit Count */}
                            <text
                              y="3.5"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={count >= 10 ? '9.5' : '10'}
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              {count}
                            </text>

                            {/* Status Micro-Indicators (ON=Emerald, Issue=Rose) */}
                            {!isEmpty && z.onCount > 0 && (
                              <circle
                                cx={pinRadius * 0.72}
                                cy={-pinRadius * 0.72}
                                r="3"
                                fill="#10b981"
                                stroke="#020617"
                                strokeWidth="1"
                              />
                            )}
                            {!isEmpty && z.issueCount > 0 && (
                              <circle
                                cx={-pinRadius * 0.72}
                                cy={-pinRadius * 0.72}
                                r="3"
                                fill="#f43f5e"
                                stroke="#020617"
                                strokeWidth="1"
                              />
                            )}

                            {/* Futuristic Label Pill */}
                            <g transform={`translate(0, ${pinRadius + 13})`}>
                              <rect
                                x="-54"
                                y="-8.5"
                                width="108"
                                height="15"
                                rx="4"
                                fill="#020813"
                                fillOpacity="0.88"
                                stroke={isSelected || isHovered ? '#2dd4bf' : '#1e3a5f'}
                                strokeWidth="0.9"
                              />
                              <text
                                y="1.5"
                                textAnchor="middle"
                                fill={isSelected ? '#5eead4' : isEmpty ? '#64748b' : '#e2e8f0'}
                                fontSize="8"
                                fontFamily="monospace"
                                fontWeight={isSelected ? 'bold' : 'normal'}
                              >
                                {z.shortLabel}
                              </text>
                            </g>
                          </g>
                        );
                      })}

                    {/* HUD Corner Targeting Brackets */}
                    <g stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.5" fill="none">
                      <path d="M 10 26 L 10 10 L 26 10" />
                      <path d="M 874 10 L 890 10 L 890 26" />
                      <path d="M 10 454 L 10 470 L 26 470" />
                      <path d="M 874 470 L 890 470 L 890 454" />
                    </g>

                    {/* Futuristic Compass Rose */}
                    <g transform="translate(852, 48)">
                      <circle r="19" fill="#020813" fillOpacity="0.75" stroke="#1e3a5f" strokeWidth="1" />
                      <circle r="15" fill="none" stroke="#38bdf8" strokeOpacity="0.25" strokeWidth="0.7" strokeDasharray="2 2" />
                      <path d="M 0 -13 L 3.5 0 L 0 13 L -3.5 0 Z" fill="#2dd4bf" fillOpacity="0.85" />
                      <path d="M -13 0 L 0 -3.5 L 13 0 L 0 3.5 Z" fill="#64748b" fillOpacity="0.5" />
                      <text y="-15" textAnchor="middle" fill="#5eead4" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                        N
                      </text>
                    </g>
                  </svg>
                );
              })()}

              {/* Bottom-Left HUD Telemetry Readout Overlay */}
              {hudFocusZoneObj && (
                <div className="absolute bottom-3 left-3 pointer-events-none hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#020813]/85 backdrop-blur-md border border-sky-500/30 text-[10px] font-mono text-slate-300 shadow-lg">
                  <div>
                    <span className="text-sky-400 font-bold">{hudFocusZoneObj.shortLabel.toUpperCase()}</span>
                    <div className="text-[9px] text-slate-400">
                      {hudFocusZoneObj.lat < 0
                        ? `${Math.abs(hudFocusZoneObj.lat).toFixed(2)}°S`
                        : `${hudFocusZoneObj.lat.toFixed(2)}°N`}{' '}
                      / {hudFocusZoneObj.lon.toFixed(2)}°E
                    </div>
                  </div>
                  <div className="h-5 w-px bg-slate-700/80" />
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">ON:{hudFocusZoneObj.onCount}</span>
                    <span className="text-amber-400">SB:{hudFocusZoneObj.sbCount}</span>
                    <span className="text-rose-400">MT/BD/DK:{hudFocusZoneObj.issueCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Zone Vessel List */}
          <div className="lg:col-span-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col max-h-[460px] overflow-hidden">
            <div className="p-3.5 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">
                  {activeMapZoneObj ? 'Titik Kirim Terpilih' : 'Semua Titik Kirim'}
                </div>
                <h4 className="text-sm font-bold text-foreground truncate">
                  {activeMapZoneObj ? activeMapZoneObj.name : 'Seluruh Wilayah Armada'}
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                {mapSidebarItems.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/70">
              {mapSidebarItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Tidak ada armada di zona ini. Klik titik lain pada peta.
                </div>
              ) : (
                mapSidebarItems.map((item) => {
                  const badge = getStatusBadge(item.statusKode, item.detailStatus);
                  return (
                    <div key={item.id} className="p-3 hover:bg-muted/30 transition space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1.5 truncate">
                          <Ship className="size-3.5 text-sky-500 shrink-0" />
                          <span className="truncate">{item.namaKapal}</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${badge.bg}`}
                        >
                          <span className={`size-1.5 rounded-full ${badge.dot}`} />
                          <span>{item.statusKode}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-foreground/90 font-medium">
                        <MapPin className="size-3 text-rose-500 shrink-0" />
                        <span className="truncate">{item.posisi}</span>
                      </div>
                      {item.activity && (
                        <div className="text-[10.5px] text-muted-foreground line-clamp-2 pl-4">
                          {item.activity}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5 w-10 text-center">#</th>
                  <th className="p-3.5">Nama Kapal</th>
                  <th className="p-3.5">Titik Kirim / Lokasi</th>
                  <th className="p-3.5">Aktivitas Terkini</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Catatan Teknis / Kendala</th>
                  <th className="p-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item, idx) => {
                  const badge = getStatusBadge(item.statusKode, item.detailStatus);
                  return (
                    <tr key={item.id} className="hover:bg-sky-500/[0.03] transition group">
                      <td className="p-3.5 text-center font-mono text-[11px] text-muted-foreground">
                        {idx + 1}
                      </td>
                      {/* Nama Kapal & Call Sign */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Ship className="size-3.5 text-sky-500/80 shrink-0" />
                          <span>{item.namaKapal}</span>
                        </div>
                        {item.callsign && (
                          <div className="mt-0.5 pl-5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium">
                              {item.callsign}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Titik Kirim / Lokasi */}
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/40 border border-border/60 font-medium text-foreground">
                          <MapPin className="size-3 text-rose-500 shrink-0" />
                          <span>{item.posisi}</span>
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="p-3.5 max-w-[260px]">
                        <div className="text-foreground leading-snug">{item.activity}</div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                        >
                          <span className={`size-1.5 rounded-full ${badge.dot}`}></span>
                          <span>{item.statusKode}</span>
                          {item.detailStatus && (
                            <span className="text-[9px] opacity-80">({item.detailStatus})</span>
                          )}
                        </span>
                      </td>

                      {/* Kerusakan */}
                      <td className="p-3.5 max-w-[240px]">
                        {item.kerusakan && item.kerusakan !== '-' ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <Wrench className="size-3 shrink-0" />
                            <span>{item.kerusakan}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>

                      {/* Keterangan */}
                      <td className="p-3.5 max-w-[200px] text-muted-foreground">
                        {item.keterangan && item.keterangan !== '-' ? (
                          <span>{item.keterangan}</span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const badge = getStatusBadge(item.statusKode, item.detailStatus);
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-card border border-border shadow-xs hover:shadow-md hover:border-sky-500/30 transition overflow-hidden flex flex-col"
              >
                <div className={`h-1 w-full ${badge.bar}`} />
                <div className="p-4 space-y-2.5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                        <Ship className="size-4 text-sky-500 shrink-0" />
                        <span>{item.namaKapal}</span>
                      </h4>
                      {item.callsign && (
                        <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {item.callsign}
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badge.bg}`}
                    >
                      <span className={`size-1.5 rounded-full ${badge.dot}`}></span>
                      <span>{item.statusKode}</span>
                      {item.detailStatus && <span>({item.detailStatus})</span>}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-2 border-t border-border/60">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/70 text-foreground">
                      <MapPin className="size-3.5 text-rose-500 shrink-0" />
                      <span className="font-semibold">{item.posisi}</span>
                    </div>

                    <div className="text-muted-foreground text-[11px] leading-relaxed flex items-start gap-1.5">
                      <Activity className="size-3.5 text-sky-500/70 shrink-0 mt-0.5" />
                      <span>{item.activity}</span>
                    </div>
                  </div>

                  {item.kerusakan && item.kerusakan !== '-' && (
                    <div className="mt-auto pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                        <Wrench className="size-3 shrink-0" />
                        <span>{item.kerusakan}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
