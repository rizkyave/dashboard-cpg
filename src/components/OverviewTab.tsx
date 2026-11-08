'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Layers,
  Copy,
  Download,
  Filter,
  X,
  Sparkles,
  Ship,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Camera,
  History,
  RotateCcw,
  Check,
  ChevronRight,
  Package,
  SlidersHorizontal,
  FileSpreadsheet,
  Building2,
  Trash2,
  ArrowUpDown,
  Table as TableIcon,
  LayoutGrid,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProcurementItem } from '@/types/procurement';
import { useAuth } from '@/context/AuthContext';
import { evaluateFiveDivisionWorkflow } from '@/utils/statusWorkflow';
import WorkflowTrafficLight from './WorkflowTrafficLight';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { buildSisaLayananFpbMap } from '@/utils/sisaLayananParser';
import { loadStoredSisaLayanan } from '@/utils/sisaLayananStorage';
import TtbMediaModal from './TtbMediaModal';
import { formatDateDdMmYyDash } from '@/utils/formatDate';
import { openTimemarkWithFstb } from '@/utils/timemark';
import { FpbReviewRecord } from '@/types/fpbReview';

interface OverviewTabProps {
  items: ProcurementItem[];
  totalAllItems: number;
  searchKeyword?: string;
  onSearchKeywordChange?: (kw: string) => void;
  onOpenAudit: (fpb: string, po?: string) => void;
  onTriggerAiAudit?: () => void;
  sisaLayananItems?: SisaLayananItem[];
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateTab?: (tab: string, targetFpb?: string) => void;
}

interface RecentSearchItem {
  id: string;
  mode: 'universal' | 'multi-fpb';
  text: string;
  timestamp: number;
}

const STORAGE_KEY_RECENT = 'CPG_QUICK_SEARCH_RECENT';

export default function OverviewTab({
  items = [],
  totalAllItems = 0,
  searchKeyword = '',
  onSearchKeywordChange,
  onOpenAudit,
  sisaLayananItems = [],
  showToast,
  onNavigateTab,
}: OverviewTabProps) {
  const { isVisitor } = useAuth();

  // Mode pencarian: 'universal' (Cari Bebas) vs 'multi-fpb' (Banyak FPB Sekaligus)
  const [searchMode, setSearchMode] = useState<'universal' | 'multi-fpb'>('universal');

  // Input states
  const [universalQuery, setUniversalQuery] = useState<string>(searchKeyword || '');
  const [multiFpbText, setMultiFpbText] = useState<string>('');

  // Sinkronisasi data pengajuan e-FPB dari server e-FPB kapal
  const [efpbReviews, setEfpbReviews] = useState<FpbReviewRecord[]>([]);
  const [isLoadingEfpb, setIsLoadingEfpb] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingEfpb(true);
    fetch('/api/review-fpb')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (isMounted && res && res.success && Array.isArray(res.data)) {
          setEfpbReviews(res.data);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat e-fpb untuk pencarian cepat:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingEfpb(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter parameter
  const [searchScope, setSearchScope] = useState<'ALL' | 'FPB' | 'PO' | 'VESSEL' | 'ITEM' | 'DOC'>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<'ALL' | 'DONE' | 'PROCESS' | 'PENDING' | 'KURANG'>('ALL');

  // View presentation mode
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  // TTB Media modal state
  const [selectedTtbMedia, setSelectedTtbMedia] = useState<{
    noTtb?: string;
    noFstb?: string;
    fpb?: string;
    po?: string;
    item?: string;
    armada?: string;
    entity?: string;
    statusBadge?: string;
    picPch?: string;
    picTtb?: string;
    picLap?: string;
    picAdm?: string;
  } | null>(null);

  // Sync external searchKeyword
  useEffect(() => {
    if (searchKeyword && searchKeyword !== universalQuery) {
      setUniversalQuery(searchKeyword);
    }
  }, [searchKeyword]);

  // Load stored recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RECENT);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 8));
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const saveRecentSearch = (text: string, mode: 'universal' | 'multi-fpb') => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.text.toLowerCase() !== trimmed.toLowerCase());
      const updated: RecentSearchItem[] = [
        { id: `${Date.now()}`, mode, text: trimmed, timestamp: Date.now() },
        ...filtered,
      ].slice(0, 8);

      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      return updated;
    });
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY_RECENT);
    } catch {
      // Ignore
    }
    showToast?.('Riwayat pencarian telah dibersihkan.', 'info');
  };

  // Database Sisa Layanan (untuk nama barang presisi & status fisik)
  const [internalSisaLayanan, setInternalSisaLayanan] = useState<SisaLayananItem[]>(sisaLayananItems || []);

  useEffect(() => {
    if (sisaLayananItems && sisaLayananItems.length > 0) {
      setInternalSisaLayanan(sisaLayananItems);
    } else {
      loadStoredSisaLayanan()
        .then((stored) => {
          if (stored && stored.items && stored.items.length > 0) {
            setInternalSisaLayanan(stored.items);
          }
        })
        .catch(() => {});
    }
  }, [sisaLayananItems]);

  const activeSisa = sisaLayananItems && sisaLayananItems.length > 0 ? sisaLayananItems : internalSisaLayanan;
  const sisaMap = useMemo(() => buildSisaLayananFpbMap(activeSisa), [activeSisa]);

  // Parsing Multi-FPB Token List
  const parsedMultiFpbTokens = useMemo(() => {
    if (!multiFpbText.trim()) return [];
    return Array.from(
      new Set(
        multiFpbText
          .split(/[\n,;\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length >= 2)
      )
    );
  }, [multiFpbText]);

  // Daftar Entitas PT Unik untuk Filter
  const availableEntities = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.entity) set.add(it.entity.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  // Status apakah ada kueri aktif
  const hasActiveQuery = useMemo(() => {
    if (searchMode === 'universal') {
      return universalQuery.trim().length > 0;
    }
    return parsedMultiFpbTokens.length > 0;
  }, [searchMode, universalQuery, parsedMultiFpbTokens]);

  // Filtering & Search Execution
  const filteredResults = useMemo(() => {
    if (!hasActiveQuery) return [];

    let matched = items;

    // 1. Logika Mode Pencarian
    if (searchMode === 'universal') {
      const q = universalQuery.trim().toLowerCase();

      matched = matched.filter((row) => {
        const fpb = (row.fpb || '').toLowerCase();
        const po = (row.po || '').toLowerCase();
        const armada = (row.deptArmada || '').toLowerCase();
        const itemDesc = (row.item || '').toLowerCase();
        const fstb = (row.noFstb || '').toLowerCase();
        const ttb = (row.noTtb || '').toLowerCase();
        const entity = (row.entity || '').toLowerCase();
        const pic = `${row.picPch || ''} ${row.picTtb || ''} ${row.picLap || ''} ${row.picAdm || ''}`.toLowerCase();

        // Scope filter
        if (searchScope === 'FPB') return fpb.includes(q);
        if (searchScope === 'PO') return po.includes(q);
        if (searchScope === 'VESSEL') return armada.includes(q);
        if (searchScope === 'ITEM') return itemDesc.includes(q);
        if (searchScope === 'DOC') return fstb.includes(q) || ttb.includes(q);

        // Universal (ALL)
        return (
          fpb.includes(q) ||
          po.includes(q) ||
          armada.includes(q) ||
          itemDesc.includes(q) ||
          fstb.includes(q) ||
          ttb.includes(q) ||
          entity.includes(q) ||
          pic.includes(q)
        );
      });
    } else {
      // Multi-FPB Mode: mencocokkan jika No. FPB memuat salah satu token
      matched = matched.filter((row) => {
        const rowFpbUpper = (row.fpb || '').toUpperCase();
        return parsedMultiFpbTokens.some((token) => rowFpbUpper.includes(token));
      });
    }

    // 2. Filter Entitas
    if (selectedEntity !== 'ALL') {
      matched = matched.filter((row) => (row.entity || '').toUpperCase() === selectedEntity);
    }

    // 3. Filter Status Alur
    if (selectedWorkflowStatus !== 'ALL') {
      matched = matched.filter((row) => {
        const workflow = evaluateFiveDivisionWorkflow(row);
        const statusText = (row.statusBadge || '').toUpperCase();

        if (selectedWorkflowStatus === 'DONE') {
          return workflow.isComplete || statusText.includes('SELESAI') || statusText.includes('DONE');
        }
        if (selectedWorkflowStatus === 'PROCESS') {
          return !workflow.isComplete && !statusText.includes('KURANG') && !statusText.includes('BATAL');
        }
        if (selectedWorkflowStatus === 'PENDING') {
          return !row.po || row.po === '-' || row.po === 'PENDING';
        }
        if (selectedWorkflowStatus === 'KURANG') {
          return statusText.includes('KURANG') || statusText.includes('SELISIH');
        }
        return true;
      });
    }

    return matched;
  }, [
    items,
    hasActiveQuery,
    searchMode,
    universalQuery,
    parsedMultiFpbTokens,
    searchScope,
    selectedEntity,
    selectedWorkflowStatus,
  ]);

  // Statistik Breakdown Hasil Pencarian
  const searchStats = useMemo(() => {
    if (!hasActiveQuery) {
      return { total: 0, done: 0, onProcess: 0, noPo: 0, multiVessel: 0 };
    }

    let done = 0;
    let onProcess = 0;
    let noPo = 0;

    filteredResults.forEach((row) => {
      const wf = evaluateFiveDivisionWorkflow(row);
      const isDone = wf.isComplete || (row.statusBadge || '').toUpperCase().includes('SELESAI');
      const isNoPo = !row.po || row.po === '-' || row.po === 'PENDING';

      if (isDone) done++;
      else if (isNoPo) noPo++;
      else onProcess++;
    });

    return {
      total: filteredResults.length,
      done,
      onProcess,
      noPo,
    };
  }, [filteredResults, hasActiveQuery]);

  // Analisis Multi-FPB: token mana yang ditemukan vs tidak ditemukan
  const multiFpbReconciliation = useMemo(() => {
    if (searchMode !== 'multi-fpb' || parsedMultiFpbTokens.length === 0) return null;

    const matchedTokens = new Set<string>();
    filteredResults.forEach((row) => {
      const rowFpbUpper = (row.fpb || '').toUpperCase();
      parsedMultiFpbTokens.forEach((token) => {
        if (rowFpbUpper.includes(token)) {
          matchedTokens.add(token);
        }
      });
    });

    const notFoundTokens = parsedMultiFpbTokens.filter((token) => !matchedTokens.has(token));

    return {
      totalQueried: parsedMultiFpbTokens.length,
      foundCount: matchedTokens.size,
      notFoundCount: notFoundTokens.length,
      notFoundTokens,
    };
  }, [searchMode, parsedMultiFpbTokens, filteredResults]);

  // Pencarian Terintegrasi ke Antrean Server e-FPB Kapal (Review & Analisa)
  const matchedEfpb = useMemo(() => {
    if (!hasActiveQuery || efpbReviews.length === 0) return [];

    if (searchMode === 'universal') {
      const q = universalQuery.trim().toLowerCase();
      if (!q) return [];
      return efpbReviews.filter((rec) => {
        const fpb = (rec.fpbNo || '').toLowerCase();
        const orig = (rec.originalFpb || '').toLowerCase();
        const armada = (rec.armada || '').toLowerCase();
        const entity = (rec.entity || '').toLowerCase();
        const purpose = (rec.purpose || '').toLowerCase();
        const itemsMatch = (rec.items || []).some(
          (it) => it.itemName?.toLowerCase().includes(q) || it.itemCode?.toLowerCase().includes(q)
        );

        if (searchScope === 'FPB') return fpb.includes(q) || orig.includes(q);
        if (searchScope === 'VESSEL') return armada.includes(q);
        if (searchScope === 'ITEM') return itemsMatch;
        if (searchScope === 'PO' || searchScope === 'DOC') return false;

        return (
          fpb.includes(q) ||
          orig.includes(q) ||
          armada.includes(q) ||
          entity.includes(q) ||
          purpose.includes(q) ||
          itemsMatch
        );
      });
    } else {
      // Multi-FPB Mode
      return efpbReviews.filter((rec) => {
        const fpbUpper = (rec.fpbNo || '').toUpperCase();
        return parsedMultiFpbTokens.some((token) => fpbUpper.includes(token));
      });
    }
  }, [hasActiveQuery, searchMode, universalQuery, searchScope, parsedMultiFpbTokens, efpbReviews]);

  // Handler eksekusi search universal
  const handleUniversalSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (universalQuery.trim()) {
      saveRecentSearch(universalQuery, 'universal');
      onSearchKeywordChange?.(universalQuery);
    }
  };

  // Handler eksekusi search multi-fpb
  const handleMultiFpbSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (parsedMultiFpbTokens.length > 0) {
      saveRecentSearch(`${parsedMultiFpbTokens.length} FPB Massal (${parsedMultiFpbTokens.slice(0, 2).join(', ')}...)`, 'multi-fpb');
    }
  };

  // Klik shortcut pencarian cepat
  const applyQuickShortcut = (text: string, scope: 'ALL' | 'FPB' | 'PO' | 'VESSEL' | 'ITEM' = 'ALL') => {
    setSearchMode('universal');
    setUniversalQuery(text);
    setSearchScope(scope);
    saveRecentSearch(text, 'universal');
    onSearchKeywordChange?.(text);
  };

  // Reset pencarian
  const handleResetSearch = () => {
    setUniversalQuery('');
    setMultiFpbText('');
    setSearchScope('ALL');
    setSelectedEntity('ALL');
    setSelectedWorkflowStatus('ALL');
    onSearchKeywordChange?.('');
  };

  // Salin Rangkuman Status ke WhatsApp
  const handleCopyWaReport = () => {
    if (filteredResults.length === 0) return;

    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const queryDesc =
      searchMode === 'universal'
        ? `"${universalQuery}"`
        : `${parsedMultiFpbTokens.length} FPB Massal (${parsedMultiFpbTokens.slice(0, 3).join(', ')}${parsedMultiFpbTokens.length > 3 ? '...' : ''})`;

    const lines = [
      `*LAPORAN STATUS PENGADAAN & LOGISTIK CPG*`,
      `📅 Waktu: ${dateStr}`,
      `🔍 Kueri Pencarian: ${queryDesc}`,
      `📊 Total Ditemukan: *${filteredResults.length} Dokumen* (${searchStats.done} Selesai, ${searchStats.onProcess} Proses, ${searchStats.noPo} Belum PO)`,
      ``,
      `*Rincian Dokumen Terlacak:*`,
      ...filteredResults.slice(0, 25).map((row, idx) => {
        const wf = evaluateFiveDivisionWorkflow(row);
        const statusIcon = wf.isComplete ? '✅' : row.po ? '⏳' : '⚠️';
        const armada = row.deptArmada || row.entity || 'Armada CPG';
        const poInfo = row.po && row.po !== '-' ? `PO: *${row.po}*` : `_Belum Terbit PO_`;
        const itemDesc = (row.item || '-').slice(0, 50);

        return `${idx + 1}. ${statusIcon} *${row.fpb}* | ${armada}\n   • ${poInfo}\n   • Barang: ${itemDesc}\n   • Status: ${row.statusBadge || 'Dalam Proses'}`;
      }),
      filteredResults.length > 25 ? `\n_...dan ${filteredResults.length - 25} dokumen lainnya tercatat di sistem._\n` : '',
      ``,
      `_Monitoring Terintegrasi Sistem Pengadaan CPG Web_`,
    ];

    const message = lines.filter(Boolean).join('\n');
    navigator.clipboard.writeText(message);
    showToast?.('Laporan status pengadaan berhasil disalin ke clipboard format WhatsApp!', 'success');
  };

  // Export hasil pencarian ke Excel
  const handleExportExcel = () => {
    if (filteredResults.length === 0) return;

    const exportRows = filteredResults.map((r, idx) => ({
      No: idx + 1,
      'No. FPB': r.fpb || '-',
      'No. PO': r.po || '-',
      'Tanggal PO': r.date || '-',
      'Nama Kapal / Armada': r.deptArmada || '-',
      Entitas: r.entity || '-',
      'Nama Material / Kebutuhan': r.item || '-',
      'No. FSTB': r.noFstb || '-',
      'No. TTB': r.noTtb || '-',
      'Status Berkas': r.statusBadge || '-',
      'Lama Waktu (Hari)': r.lapse !== undefined ? r.lapse : '-',
      'PIC Purchasing': r.picPch || '-',
      'PIC TTB': r.picTtb || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil_Pencarian');

    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Pencarian_Pengadaan_CPG_${dateStamp}.xlsx`);
    showToast?.(`File Excel dengan ${exportRows.length} data berhasil diunduh!`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HERO SECTION: ADVANCED SEARCH COMMAND CENTER */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-8 shadow-sm relative overflow-hidden">
        {/* Glow Background Accent */}
        <div className="absolute -top-24 -right-24 size-72 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-72 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Header Title & Mode Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/20">
                  <Search className="size-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Pencarian Cepat Dokumen &amp; Pengadaan
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Lacak berkas FPB, PO, FSTB, material sisa layanan, dan posisi divisi logistik secara instan.
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Selector Pills */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-2xl border border-border self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSearchMode('universal')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  searchMode === 'universal'
                    ? 'bg-card text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Search className="size-3.5 text-purple-500" />
                <span>Cari Bebas</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('multi-fpb')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  searchMode === 'multi-fpb'
                    ? 'bg-card text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="size-3.5 text-indigo-500" />
                <span>Multi-FPB Sekaligus</span>
              </button>
            </div>
          </div>

          {/* SEARCH INPUT BAR */}
          {searchMode === 'universal' ? (
            <form onSubmit={handleUniversalSubmit} className="space-y-3">
              <div className="relative flex items-center shadow-lg shadow-black/[0.03] rounded-2xl overflow-hidden border-2 border-purple-500/30 focus-within:border-purple-600 transition bg-background">
                <Search className="size-5 text-muted-foreground ml-4 pointer-events-none" />
                <input
                  type="text"
                  value={universalQuery}
                  onChange={(e) => {
                    setUniversalQuery(e.target.value);
                    onSearchKeywordChange?.(e.target.value);
                  }}
                  placeholder="Ketik No. FPB (misal 0003374), No. PO, Nama Kapal (TB KING STAR), atau Nama Barang..."
                  className="w-full h-14 pl-3 pr-24 text-sm sm:text-base font-medium bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  autoFocus
                />
                <div className="absolute right-3 flex items-center gap-1.5">
                  {universalQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUniversalQuery('');
                        onSearchKeywordChange?.('');
                      }}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                      title="Hapus Kueri"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition"
                  >
                    <span>Cari</span>
                  </button>
                </div>
              </div>

              {/* Advanced Parameters Filter Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-muted-foreground font-semibold flex items-center gap-1 text-[11px]">
                  <SlidersHorizontal className="size-3 text-purple-500" />
                  <span>Cari Berdasarkan:</span>
                </span>

                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'ALL', label: 'Semua Bidang' },
                    { id: 'FPB', label: 'No. FPB' },
                    { id: 'PO', label: 'No. PO' },
                    { id: 'VESSEL', label: 'Nama Kapal' },
                    { id: 'ITEM', label: 'Nama Barang' },
                    { id: 'DOC', label: 'No. FSTB/TTB' },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSearchScope(sc.id as any)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-xs ${
                        searchScope === sc.id
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-border hidden sm:block" />

                {/* Filter Entitas */}
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="h-7 px-2.5 rounded-lg border border-border bg-background text-[11px] font-medium text-foreground focus:outline-none"
                >
                  <option value="ALL">Semua Entitas PT</option>
                  {availableEntities.map((ent) => (
                    <option key={ent} value={ent}>
                      {ent}
                    </option>
                  ))}
                </select>

                {/* Filter Status Alur */}
                <select
                  value={selectedWorkflowStatus}
                  onChange={(e) => setSelectedWorkflowStatus(e.target.value as any)}
                  className="h-7 px-2.5 rounded-lg border border-border bg-background text-[11px] font-medium text-foreground focus:outline-none"
                >
                  <option value="ALL">Semua Status Berkas</option>
                  <option value="DONE">✅ Sudah Selesai (FSTB/TTB Selesai)</option>
                  <option value="PROCESS">⏳ Sedang Dalam Alur Divisi</option>
                  <option value="PENDING">⚠️ Belum Terbit PO</option>
                  <option value="KURANG">🔴 Selisih Fisik / Kurang Kirim</option>
                </select>
              </div>
            </form>
          ) : (
            /* MULTI-FPB BATCH SEARCH MODE */
            <form onSubmit={handleMultiFpbSubmit} className="space-y-3">
              <div className="bg-background border-2 border-indigo-500/30 focus-within:border-indigo-600 rounded-2xl p-3 shadow-lg shadow-black/[0.03] transition space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <Layers className="size-3.5" />
                    <span>Paste Daftar Banyak Nomor FPB (Bisa dari Excel / WhatsApp):</span>
                  </span>
                  <span className="font-mono text-[11px]">
                    Terdeteksi: <strong>{parsedMultiFpbTokens.length} FPB Unik</strong>
                  </span>
                </div>

                <textarea
                  rows={4}
                  value={multiFpbText}
                  onChange={(e) => setMultiFpbText(e.target.value)}
                  placeholder={`Contoh:\n0003374\n0001123\n0000032\n(atau pisahkan dengan koma/spasi: CPL-FPB-26-0003374, HL-FPB-26-0001123)`}
                  className="w-full text-xs sm:text-sm font-mono bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-none leading-relaxed"
                />

                {/* Parsed Chips Preview */}
                {parsedMultiFpbTokens.length > 0 && (
                  <div className="pt-2 border-t border-border flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
                    {parsedMultiFpbTokens.map((tok) => (
                      <span
                        key={tok}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                      >
                        <span>{tok}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newTokens = parsedMultiFpbTokens.filter((t) => t !== tok);
                            setMultiFpbText(newTokens.join('\n'));
                          }}
                          className="hover:text-rose-500 cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setMultiFpbText('')}
                    disabled={!multiFpbText}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer"
                  >
                    Kosongkan Teks
                  </button>

                  <button
                    type="submit"
                    disabled={parsedMultiFpbTokens.length === 0}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition"
                  >
                    <Search className="size-3.5" />
                    <span>Lacak {parsedMultiFpbTokens.length} FPB Sekaligus</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SHORTCUT PENCARIAN POPULER & RECENT SEARCHES (Tampil jika belum ada kueri) */}
          {!hasActiveQuery && (
            <div className="space-y-4 pt-2">
              {/* Shortcut Populer */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Pencarian Cepat Populer:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickShortcut('TB KING STAR', 'VESSEL')}
                    className="px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Ship className="size-3.5 text-sky-500" />
                    <span>TB KING STAR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickShortcut('TK CPL 250', 'VESSEL')}
                    className="px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Ship className="size-3.5 text-sky-500" />
                    <span>TK CPL 250</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickShortcut('MEDITRAN', 'ITEM')}
                    className="px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Package className="size-3.5 text-amber-500" />
                    <span>Pelumas Meditran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickShortcut('TALI', 'ITEM')}
                    className="px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Package className="size-3.5 text-indigo-500" />
                    <span>Tali Mooring PP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('universal');
                      setUniversalQuery('');
                      setSelectedWorkflowStatus('PENDING');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <AlertCircle className="size-3.5" />
                    <span>FPB Belum Terbit PO</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('universal');
                      setUniversalQuery('');
                      setSelectedWorkflowStatus('KURANG');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <AlertTriangle className="size-3.5" />
                    <span>Selisih / Kurang Kirim</span>
                  </button>
                </div>
              </div>

              {/* Riwayat Pencarian Terakhir */}
              {recentSearches.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <History className="size-3" />
                      <span>Riwayat Pencarian Terakhir</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRecent}
                      className="text-muted-foreground hover:text-foreground text-[10px] normal-case hover:underline cursor-pointer"
                    >
                      Bersihkan Riwayat
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {recentSearches.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => {
                          if (rec.mode === 'multi-fpb') {
                            setSearchMode('multi-fpb');
                          } else {
                            setSearchMode('universal');
                            setUniversalQuery(rec.text);
                            onSearchKeywordChange?.(rec.text);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 border border-border/80 transition cursor-pointer"
                      >
                        <Clock className="size-3 opacity-60" />
                        <span>{rec.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* REKAPITULASI HASIL PENCARIAN (Hanya Tampil Saat Ada Kueri) */}
      {hasActiveQuery && (
        <div className="space-y-4">
          {/* Summary Action Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold text-foreground">
                  Ditemukan {filteredResults.length.toLocaleString('id-ID')} Dokumen
                </span>
                <span className="text-xs text-muted-foreground">
                  (dari total {totalAllItems.toLocaleString('id-ID')} berkas sistem)
                </span>
              </div>

              {/* Pill Stats */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {searchStats.done} Selesai Penuh
                </span>
                <span className="px-2 py-0.5 rounded-full font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20">
                  {searchStats.onProcess} Dalam Alur Divisi
                </span>
                <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  {searchStats.noPo} Belum Terbit PO
                </span>
                {matchedEfpb.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                    <Sparkles className="size-3" />
                    <span>{matchedEfpb.length} di Antrean e-FPB</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <button
                type="button"
                onClick={handleCopyWaReport}
                className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                title="Salin rekapitulasi status berkas untuk dikirim via WhatsApp"
              >
                <Copy className="size-3.5 text-emerald-600" />
                <span>Salin Ringkasan WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                title="Unduh hasil pencarian dalam bentuk file Excel"
              >
                <Download className="size-3.5 text-indigo-600" />
                <span>Export Excel</span>
              </button>

              {/* Toggle Tampilan Card / Table */}
              <div className="flex items-center p-0.5 bg-muted rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                  }`}
                  title="Tampilan Tabel Detail"
                >
                  <TableIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'card' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                  }`}
                  title="Tampilan Kartu"
                >
                  <LayoutGrid className="size-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetSearch}
                className="px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 cursor-pointer transition"
                title="Bersihkan Pencarian"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Banner Rekonsiliasi Multi-FPB (Jika dalam mode multi-fpb) */}
          {multiFpbReconciliation && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                <div className="font-bold flex items-center gap-2">
                  <FileCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Rekonsiliasi Pencarian: Ditemukan {multiFpbReconciliation.foundCount} dari {multiFpbReconciliation.totalQueried} FPB yang dicari
                  </span>
                </div>
                {multiFpbReconciliation.notFoundCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    {multiFpbReconciliation.notFoundCount} FPB Tidak Terdaftar
                  </span>
                )}
              </div>

              {multiFpbReconciliation.notFoundCount > 0 && (
                <div className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold">Periksa nomor FPB berikut:</span>
                  {multiFpbReconciliation.notFoundTokens.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-rose-500/15 font-mono text-[11px] font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KARTU PENCARIAN E-FPB (Jika ditemukan berkas pengajuan di server e-FPB) */}
          {matchedEfpb.length > 0 && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background border border-indigo-500/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-2 flex-wrap">
                      <span>Ditemukan di Server e-FPB ({matchedEfpb.length} Berkas)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Tahap Review &amp; Analisa (Belum Terbit PO)
                      </span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Pengajuan ini masuk langsung dari armada kapal dan sedang dianalisis ketersediaan stok gudang / disposisi purchasing sebelum diterbitkan PO.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matchedEfpb.map((rec) => (
                  <div
                    key={rec.id || rec.fpbNo}
                    className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs space-y-2.5 hover:border-indigo-500/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                            {rec.entity || 'CPG'}
                          </span>
                          <span className="font-mono font-extrabold text-xs text-foreground">
                            {rec.fpbNo}
                          </span>
                          {rec.urgency === 'URGENT' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                              URGENT
                            </span>
                          )}
                          {rec.priorityLevel && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              {rec.priorityLevel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            <Ship className="size-3.5 text-sky-600" />
                            {rec.armada || 'Armada Kapal'}
                          </span>
                          <span>&bull;</span>
                          <span>Tgl: {rec.date || '-'}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shrink-0">
                        {rec.reviewStatus === 'APPROVED_PO'
                          ? 'Disetujui PO'
                          : rec.reviewStatus === 'FULFILL_STOCK'
                          ? 'Penuhi Stok'
                          : rec.reviewStatus === 'REJECTED'
                          ? 'Ditolak'
                          : 'Menunggu Analisa'}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl space-y-1">
                      <p className="line-clamp-2">
                        <strong className="text-foreground">Keperluan:</strong> {rec.purpose || '-'}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>📦 {rec.items?.length || 0} Item Material</span>
                        <span>&bull;</span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">
                          PO: Belum ada
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        Status Logistik: <strong>{rec.isReceivedLogistik ? 'Diterima' : 'Menunggu'}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {rec.pdfUrl && (
                          <a
                            href={`/api/review-fpb/pdf?fpbNo=${encodeURIComponent(rec.fpbNo)}&type=raw`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-bold text-foreground hover:bg-muted transition flex items-center gap-1"
                            title="Buka Softcopy PDF e-FPB"
                          >
                            <FileText className="size-3 text-rose-500" />
                            <span>PDF</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onNavigateTab?.('review-fpb', rec.fpbNo)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Buka dokumen ini di menu Review & Analisa FPB"
                        >
                          <span>Buka di Review FPB</span>
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABEL / KARTU HASIL PENCARIAN PENGADAAN */}
          {filteredResults.length === 0 ? (
            matchedEfpb.length > 0 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm">Dokumen Terdaftar di Antrean e-FPB Kapal (Belum Terbit PO)</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Nomor berkas yang Anda cari berhasil ditemukan pada antrean <strong>Review &amp; Analisa e-FPB</strong> di atas. Berkas ini belum muncul di {totalAllItems.toLocaleString('id-ID')} rekapitulasi database pengadaan karena berstatus pengajuan baru armada dan belum diproses menjadi dokumen Purchase Order (PO).
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground space-y-3">
                <AlertCircle className="size-12 mx-auto text-amber-500/50" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Dokumen Tidak Ditemukan</h3>
                  <p className="text-xs max-w-md mx-auto">
                    Tidak ada dokumen yang cocok dengan kueri pencarian Anda di database pengadaan maupun pengajuan e-FPB kapal. Pastikan ejaan nomor FPB/PO sudah benar, atau coba gunakan sebagian digit saja (misal: 4 digit terakhir).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold cursor-pointer transition"
                >
                  Kembali ke Pencarian Baru
                </button>
              </div>
            )
          ) : viewMode === 'table' ? (
            /* TAMPILAN TABEL DETAIL */
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-3.5">Dokumen &amp; Kapal</th>
                      <th className="py-3 px-3">Rincian Material / Kebutuhan</th>
                      <th className="py-3 px-3">No. PO &amp; Tanggal</th>
                      <th className="py-3 px-3">FSTB &amp; TTB</th>
                      <th className="py-3 px-3 text-center">Alur 5 Divisi (SLA)</th>
                      <th className="py-3 px-3 text-center">Status Berkas</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredResults.slice(0, 100).map((row, idx) => {
                      const sisaInfo = sisaMap.get(row.fpb || '');
                      const workflow = evaluateFiveDivisionWorkflow(row);
                      const isCompleted = workflow.isComplete;

                      return (
                        <tr key={`${row.fpb}-${row.po || idx}`} className="hover:bg-muted/40 transition">
                          {/* Dokumen FPB & Armada */}
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-foreground font-mono flex items-center gap-1.5">
                              <span>{row.fpb}</span>
                              {row.entity && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary">
                                  {row.entity}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-medium mt-0.5 flex items-center gap-1">
                              <Ship className="size-3 text-sky-500" />
                              <span className="truncate max-w-[180px]">{row.deptArmada || 'Armada CPG'}</span>
                            </div>
                          </td>

                          {/* Rincian Material */}
                          <td className="py-3 px-3 max-w-xs sm:max-w-sm">
                            <div className="font-semibold text-foreground truncate">{row.item || '-'}</div>
                            {sisaInfo && sisaInfo.totalItemsCount > 0 && (
                              <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1 truncate">
                                <span>{sisaInfo.totalItemsCount} item tercatat di Sisa Layanan</span>
                              </div>
                            )}
                          </td>

                          {/* No. PO & Tanggal */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {row.po && row.po !== '-' ? (
                              <div>
                                <div className="font-bold text-foreground font-mono">{row.po}</div>
                                {row.date && (
                                  <div className="text-[10px] text-muted-foreground">{formatDateDdMmYyDash(row.date)}</div>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                Belum Terbit PO
                              </span>
                            )}
                          </td>

                          {/* FSTB & TTB */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              {row.noFstb && row.noFstb !== '-' ? (
                                <div className="text-foreground">FSTB: {row.noFstb}</div>
                              ) : (
                                <div className="text-muted-foreground/60">FSTB: -</div>
                              )}
                              {row.noTtb && row.noTtb !== '-' ? (
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold">TTB: {row.noTtb}</div>
                              ) : (
                                <div className="text-muted-foreground/60">TTB: -</div>
                              )}
                            </div>
                          </td>

                          {/* Alur 5 Divisi */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <WorkflowTrafficLight item={row} />
                            {row.lapse !== undefined && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                SLA: {row.lapse} hari
                              </div>
                            )}
                          </td>

                          {/* Status Berkas */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCompleted
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : (row.statusBadge || '').includes('KURANG')
                                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                  : 'bg-sky-500/10 text-sky-600 border border-sky-500/20'
                              }`}
                            >
                              {row.statusBadge || 'DALAM PROSES'}
                            </span>
                          </td>

                          {/* Tombol Aksi */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenAudit(row.fpb, row.po)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition cursor-pointer"
                                title="Buka Detail Audit Jejak Berkas"
                              >
                                <ExternalLink className="size-3.5" />
                              </button>

                              {(row.noTtb || row.noFstb) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedTtbMedia({
                                      noTtb: row.noTtb,
                                      noFstb: row.noFstb,
                                      fpb: row.fpb,
                                      po: row.po,
                                      item: row.item,
                                      armada: row.deptArmada,
                                      entity: row.entity,
                                      statusBadge: row.statusBadge,
                                      picPch: row.picPch,
                                      picTtb: row.picTtb,
                                      picLap: row.picLap,
                                      picAdm: row.picAdm,
                                    })
                                  }
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition cursor-pointer"
                                  title="Lihat Foto Bukti Serah Terima TTB"
                                >
                                  <Camera className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredResults.length > 100 && (
                <div className="p-3 bg-muted/40 border-t border-border text-center text-xs text-muted-foreground">
                  Menampilkan 100 hasil teratas dari total {filteredResults.length.toLocaleString('id-ID')} dokumen. Gunakan filter untuk mempersempit.
                </div>
              )}
            </div>
          ) : (
            /* TAMPILAN KARTU INTERAKTIF */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResults.slice(0, 60).map((row, idx) => {
                const sisaInfo = sisaMap.get(row.fpb || '');
                const workflow = evaluateFiveDivisionWorkflow(row);
                const isCompleted = workflow.isComplete;

                return (
                  <div
                    key={`${row.fpb}-${row.po || idx}`}
                    className="bg-card border border-border hover:border-purple-500/40 rounded-2xl p-4 shadow-2xs space-y-3 transition group"
                  >
                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-foreground font-mono text-sm">{row.fpb}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Ship className="size-3.5 text-sky-500" />
                          <span className="font-medium">{row.deptArmada || 'Armada CPG'}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : (row.statusBadge || '').includes('KURANG')
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            : 'bg-sky-500/10 text-sky-600 border border-sky-500/20'
                        }`}
                      >
                        {row.statusBadge || 'PROSES'}
                      </span>
                    </div>

                    {/* Deskripsi Barang */}
                    <div className="p-2.5 rounded-xl bg-muted/60 text-xs space-y-1">
                      <div className="font-semibold text-foreground line-clamp-2">{row.item || '-'}</div>
                      {sisaInfo && sisaInfo.totalItemsCount > 0 && (
                        <div className="text-[10px] text-purple-600 dark:text-purple-400">
                          {sisaInfo.totalItemsCount} item terdaftar di Sisa Layanan
                        </div>
                      )}
                    </div>

                    {/* Meta Info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">No. PO:</span>
                        <span className="font-mono font-bold text-foreground">{row.po || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">No. FSTB / TTB:</span>
                        <span className="font-mono text-foreground">{row.noFstb || row.noTtb || '-'}</span>
                      </div>
                    </div>

                    {/* Alur & Tombol Aksi */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <WorkflowTrafficLight item={row} />

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenAudit(row.fpb, row.po)}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>Audit</span>
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL FOTO TTB */}
      {selectedTtbMedia && (
        <TtbMediaModal
          isOpen={true}
          onClose={() => setSelectedTtbMedia(null)}
          noTtb={selectedTtbMedia.noTtb}
          noFstb={selectedTtbMedia.noFstb}
          fpb={selectedTtbMedia.fpb}
          po={selectedTtbMedia.po}
          item={selectedTtbMedia.item}
          armada={selectedTtbMedia.armada}
          entity={selectedTtbMedia.entity}
          showToast={showToast}
        />
      )}
    </div>
  );
}
