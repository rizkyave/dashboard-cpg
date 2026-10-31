'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Ship,
  Building2,
  RefreshCw,
  Download,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Layers,
  Calendar,
  UserCheck,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  Tag,
  Plus,
  Settings,
  Edit3,
  Save,
  X,
  FileCode,
  Zap,
  CalendarDays,
  Send,
  HelpCircle,
} from 'lucide-react';
import { StockTaliItem, StockTaliSummary } from '@/types/stockTali';
import initialStockTaliData from '@/data/stock-tali-data.json';

interface StockTaliSubTabProps {
  showToast?: (message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
  onCountChange?: (count: number) => void;
}

const GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=2021352613#gid=2021352613';

// Badge warna untuk entitas PT
const PT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CPL: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  HL: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  MIL: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  GAJ: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  MO: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
};

// Opsi staf PIC TTB & Lapangan standar
const PIC_TTB_OPTIONS = ['FIFI', 'IDHAM', 'DAVILA', 'HERMANSYAH', 'TRI', 'OTHER'];
const PIC_LAP_OPTIONS = ['HAMKA', 'AKBAR', 'ZUL', 'AGUS', 'DEDY', 'RIZAL', 'OTHER'];
const PT_OPTIONS = ['CPL', 'HL', 'MIL', 'GAJ', 'MO'];

// Helpers format tanggal DD-MM-YYYY <-> YYYY-MM-DD
function toInputDate(val?: string): string {
  if (!val) return '';
  const s = val.trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 2 && parts[2]?.length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return s;
}

function fromInputDate(val?: string): string {
  if (!val) return '';
  const s = val.trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return s;
}

function getTodayIndo(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const INITIAL_STOCK_TALI_FORM: Partial<StockTaliItem> = {
  pt: 'CPL',
  deptArmada: '',
  noFpb: '',
  picTtb: 'FIFI',
  ttb: '',
  tglInputTtb: '',
  tglKeTimLapangan: '',
  keterangan: 'STOCK GAJ TALI',
  picLapangan: 'HAMKA',
  tglBarangDiantar: '',
  keteranganAntar: '',
  tglTimLapKePicTtb: '',
  tglTtbKePicPch: '',
  keteranganPch: '',
};

export default function StockTaliSubTab({ showToast, onCountChange }: StockTaliSubTabProps) {
  // Data state
  const [items, setItems] = useState<StockTaliItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cpg_stock_tali_items');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return (initialStockTaliData.items as StockTaliItem[]) || [];
  });

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return initialStockTaliData.updatedAt || new Date().toISOString();
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedPicTtb, setSelectedPicTtb] = useState<string>('ALL');
  const [selectedPicLap, setSelectedPicLap] = useState<string>('ALL');
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'DIANTAR' | 'BALIK_TTB' | 'TUTUP_PCH' | 'PENDING'>('ALL');

  // Sorting state
  const [sortField, setSortField] = useState<keyof StockTaliItem>('no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modals state (Tambah / Edit / Webhook)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<StockTaliItem | null>(null);
  const [formData, setFormData] = useState<Partial<StockTaliItem>>(INITIAL_STOCK_TALI_FORM);
  const [modalActiveTab, setModalActiveTab] = useState<'IDENTITAS' | 'TTB' | 'LAPANGAN' | 'PCH'>('IDENTITAS');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Webhook settings state
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isWebhookConfigured, setIsWebhookConfigured] = useState<boolean>(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<{ checked: boolean; active: boolean; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Fetch data awal dan konfigurasi webhook dari API
  useEffect(() => {
    async function loadInitial() {
      try {
        const res = await fetch('/api/sync-stock-tali');
        const json = await res.json();
        if (json.success) {
          if (Array.isArray(json.items) && json.items.length > 0) {
            setItems(json.items);
            setLastSyncTime(json.updatedAt);
            try {
              localStorage.setItem('cpg_stock_tali_items', JSON.stringify(json.items));
              localStorage.setItem('cpg_stock_tali_updatedAt', json.updatedAt);
            } catch {}
          }
          if (json.webhookUrl) {
            setWebhookUrl(json.webhookUrl);
            setIsWebhookConfigured(true);

            // Tes koneksi latar belakang
            fetch('/api/sync-stock-tali', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'test_webhook', webhookUrl: json.webhookUrl }),
            })
              .then((r) => r.json())
              .then((testRes) => {
                setWebhookStatus({
                  checked: true,
                  active: testRes.success,
                  message: testRes.message,
                });
              })
              .catch(() => {
                setWebhookStatus({
                  checked: true,
                  active: false,
                  message: 'Tidak dapat menjangkau server Google Apps Script.',
                });
              });
          }
        }
      } catch (err) {
        console.warn('Gagal fetch /api/sync-stock-tali, menggunakan data fallback lokal:', err);
      }
    }
    loadInitial();
  }, []);

  // Sync handler (Tarik langsung dari Google Sheets)
  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-stock-tali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_csv', url: GOOGLE_SHEET_URL }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.items)) {
        setItems(json.items);
        setLastSyncTime(json.updatedAt);
        try {
          localStorage.setItem('cpg_stock_tali_items', JSON.stringify(json.items));
          localStorage.setItem('cpg_stock_tali_updatedAt', json.updatedAt);
        } catch {}
        showToast?.(
          json.message || `Berhasil menyinkronkan ${json.items.length} mutasi stock tali dari Google Sheets!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal menyinkronkan Google Sheets.', 'warning');
      }
    } catch (err: any) {
      showToast?.(`Error: ${err.message || 'Gagal menghubungi server'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // ========================================================
  // Action Handlers: Tambah, Edit, dan Auto-Save Google Sheets
  // ========================================================
  const handleOpenAddModal = () => {
    const maxNo = items.reduce((acc, it) => {
      const n = parseInt(it.no || '0', 10);
      return !isNaN(n) && n > acc ? n : acc;
    }, 0);

    setFormData({
      ...INITIAL_STOCK_TALI_FORM,
      no: String(maxNo + 1),
      tglInputTtb: getTodayIndo(),
      tglKeTimLapangan: getTodayIndo(),
    });
    setEditingItem(null);
    setModalActiveTab('IDENTITAS');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: StockTaliItem) => {
    setEditingItem(item);
    setFormData({
      no: item.no || '',
      pt: item.pt || 'CPL',
      deptArmada: item.deptArmada || '',
      noFpb: item.noFpb || '',
      picTtb: item.picTtb || 'FIFI',
      ttb: item.ttb || '',
      tglInputTtb: item.tglInputTtb || '',
      tglKeTimLapangan: item.tglKeTimLapangan || '',
      keterangan: item.keterangan || '',
      lapseDay1: item.lapseDay1 || '',
      picLapangan: item.picLapangan || 'HAMKA',
      tglBarangDiantar: item.tglBarangDiantar || '',
      keteranganAntar: item.keteranganAntar || '',
      tglTimLapKePicTtb: item.tglTimLapKePicTtb || '',
      lapseDay2: item.lapseDay2 || '',
      tglTtbKePicPch: item.tglTtbKePicPch || '',
      keteranganPch: item.keteranganPch || '',
      lapseDay3: item.lapseDay3 || '',
    });
    setModalActiveTab('IDENTITAS');
    setIsEditModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.deptArmada && !formData.ttb && !formData.noFpb) {
      showToast?.('Armada/Dept atau Nomor TTB/FPB wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    const isNew = !editingItem;

    try {
      const res = await fetch('/api/sync-stock-tali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isNew ? 'create_row' : 'update_row',
          data: formData,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setItems((prev) => {
          let updated: StockTaliItem[];
          if (isNew) {
            const newItem: StockTaliItem = json.item || {
              no: formData.no || String(prev.length + 1),
              pt: formData.pt || 'CPL',
              deptArmada: formData.deptArmada || '-',
              noFpb: formData.noFpb || '',
              picTtb: formData.picTtb || 'FIFI',
              ttb: formData.ttb || '',
              tglInputTtb: formData.tglInputTtb || '',
              tglKeTimLapangan: formData.tglKeTimLapangan || '',
              keterangan: formData.keterangan || 'STOCK GAJ TALI',
              lapseDay1: formData.lapseDay1 || '',
              picLapangan: formData.picLapangan || 'HAMKA',
              tglBarangDiantar: formData.tglBarangDiantar || '',
              keteranganAntar: formData.keteranganAntar || '',
              tglTimLapKePicTtb: formData.tglTimLapKePicTtb || '',
              lapseDay2: formData.lapseDay2 || '',
              tglTtbKePicPch: formData.tglTtbKePicPch || '',
              keteranganPch: formData.keteranganPch || '',
              lapseDay3: formData.lapseDay3 || '',
            };
            updated = [newItem, ...prev];
          } else {
            updated = prev.map((it) => {
              if (it.no && it.no === formData.no) {
                return { ...it, ...formData } as StockTaliItem;
              }
              if (editingItem && it.ttb === editingItem.ttb && it.deptArmada === editingItem.deptArmada) {
                return { ...it, ...formData } as StockTaliItem;
              }
              return it;
            });
          }
          try {
            localStorage.setItem('cpg_stock_tali_items', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        if (json.googleSync) {
          showToast?.(
            `✓ ${isNew ? 'Mutasi baru berhasil ditambah' : 'Perubahan tersimpan'} & AUTO-SAVE ke Google Sheet berhasil!`,
            'success'
          );
        } else if (isWebhookConfigured) {
          showToast?.(
            `⚠️ Data tersimpan di sistem web, namun GAGAL auto-save ke Google Sheets: ${json.googleSyncResult?.message || json.message}`,
            'warning'
          );
        } else {
          showToast?.(
            `✓ Data tersimpan di database lokal. (Hubungkan Webhook untuk auto-save langsung ke Google Sheets)`,
            'info'
          );
        }

        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
      } else {
        showToast?.(json.message || 'Gagal menyimpan data.', 'error');
      }
    } catch (err: any) {
      showToast?.(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick 1-Click Update Langsung dari Baris Tabel
  const handleQuickStatusUpdate = async (item: StockTaliItem, updates: Partial<StockTaliItem>, label: string) => {
    const updatedItem: StockTaliItem = { ...item, ...updates };

    // 1. Optimistic Update State
    setItems((prev) => {
      const next = prev.map((it) => (it.no === item.no ? updatedItem : it));
      try {
        localStorage.setItem('cpg_stock_tali_items', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Kirim update ke server & auto-save Google Sheets
    try {
      const res = await fetch('/api/sync-stock-tali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_row',
          data: updatedItem,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.googleSync) {
          showToast?.(`✓ ${label} untuk No. ${item.no} (${item.deptArmada}) tersimpan & AUTO-SAVE ke Google Sheet!`, 'success');
        } else {
          showToast?.(`✓ ${label} No. ${item.no} berhasil diperbarui di web.`, 'info');
        }
      } else {
        showToast?.(json.message || 'Gagal auto-save.', 'warning');
      }
    } catch (err: any) {
      showToast?.(`Gagal auto-save: ${err.message}`, 'error');
    }
  };

  // Webhook Configuration Handlers
  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      const res = await fetch('/api/sync-stock-tali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_webhook_url',
          webhookUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsWebhookConfigured(!!webhookUrl.trim());
        showToast?.(json.message, 'success');
      } else {
        showToast?.(json.message || 'Gagal menyimpan webhook.', 'error');
      }
    } catch (err: any) {
      showToast?.(`Error: ${err.message}`, 'error');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      showToast?.('Silakan masukkan URL Webhook Apps Script terlebih dahulu.', 'warning');
      return;
    }
    setIsTestingWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await fetch('/api/sync-stock-tali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_webhook',
          webhookUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebhookStatus({ checked: true, active: true, message: json.message });
        showToast?.(json.message, 'success');
      } else {
        setWebhookStatus({ checked: true, active: false, message: json.message });
        showToast?.(json.message, 'warning');
      }
    } catch (err: any) {
      setWebhookStatus({ checked: true, active: false, message: err.message });
      showToast?.(`Gagal tes webhook: ${err.message}`, 'error');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      const res = await fetch('/api/sync-stock-tali?script=true');
      const json = await res.json();
      if (json.success && json.script) {
        navigator.clipboard.writeText(json.script);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
        showToast?.('Skrip Google Apps Script untuk Mutasi Stock Tali berhasil disalin ke clipboard!', 'success');
      } else {
        showToast?.('Gagal mengambil skrip dari server.', 'warning');
      }
    } catch (err: any) {
      showToast?.(`Error: ${err.message}`, 'error');
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'NO',
      'PT',
      'DEPT/ ARMADA',
      'NO. FPB',
      'PIC TTB',
      'TTB',
      'TANGGAL INPUT TTB',
      'TANGGAL KE TIM LAPANGAN',
      'KETERANGAN',
      'LAPSE DAY',
      'PIC LAPANGAN',
      'TANGGAL BARANG DI DIANTAR',
      'KETERANGAN ANTAR',
      'TANGGAL TIM LAP KE PIC TTB',
      'LAPSE DAY 2',
      'TANGGAL TTB KE PIC PCH',
      'KETERANGAN PCH',
      'LAPSE DAY 3',
    ];

    const rows = filteredItems.map((item) => [
      item.no,
      item.pt,
      `"${item.deptArmada.replace(/"/g, '""')}"`,
      item.noFpb,
      item.picTtb,
      item.ttb,
      item.tglInputTtb,
      item.tglKeTimLapangan,
      `"${item.keterangan.replace(/"/g, '""')}"`,
      item.lapseDay1,
      item.picLapangan,
      item.tglBarangDiantar,
      `"${item.keteranganAntar.replace(/"/g, '""')}"`,
      item.tglTimLapKePicTtb,
      item.lapseDay2,
      item.tglTtbKePicPch,
      `"${item.keteranganPch.replace(/"/g, '""')}"`,
      item.lapseDay3,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `laporan_mutasi_stock_tali_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Berhasil mengekspor data ke file CSV!', 'success');
  };

  // Distinct Filter Options
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.pt) set.add(it.pt.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  const picTtbOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.picTtb) set.add(it.picTtb.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  const picLapOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.picLapangan) set.add(it.picLapangan.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  const armadaSuggestions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.deptArmada && it.deptArmada !== '-') set.add(it.deptArmada.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  // Overall KPI Calculation
  const kpi = useMemo<StockTaliSummary>(() => {
    const armadas = new Set<string>();
    const pts = new Set<string>();
    const ptCounts: Record<string, number> = {};
    const picTtbCounts: Record<string, number> = {};
    const picLapCounts: Record<string, number> = {};

    let terkirim = 0;
    let kembaliTtb = 0;
    let tutupPch = 0;

    for (const it of items) {
      if (it.deptArmada) armadas.add(it.deptArmada);
      if (it.pt) {
        pts.add(it.pt);
        ptCounts[it.pt] = (ptCounts[it.pt] || 0) + 1;
      }
      if (it.picTtb) {
        picTtbCounts[it.picTtb] = (picTtbCounts[it.picTtb] || 0) + 1;
      }
      if (it.picLapangan) {
        picLapCounts[it.picLapangan] = (picLapCounts[it.picLapangan] || 0) + 1;
      }

      if (it.tglBarangDiantar && it.tglBarangDiantar !== '-' && it.tglBarangDiantar !== '/') {
        terkirim++;
      }
      if (it.tglTimLapKePicTtb && it.tglTimLapKePicTtb !== '-' && it.tglTimLapKePicTtb !== '/') {
        kembaliTtb++;
      }
      if (it.tglTtbKePicPch && it.tglTtbKePicPch !== '-' && it.tglTtbKePicPch !== '/') {
        tutupPch++;
      }
    }

    return {
      totalItems: items.length,
      totalArmada: armadas.size,
      totalEntitas: pts.size,
      terkirimLapangan: terkirim,
      kembaliKeTtb: kembaliTtb,
      tutupSiklusPch: tutupPch,
      dalamProses: items.length - tutupPch,
      ptCounts,
      picTtbCounts,
      picLapCounts,
    };
  }, [items]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = item.no.toLowerCase().includes(q);
        const matchFpb = item.noFpb.toLowerCase().includes(q);
        const matchTtb = item.ttb.toLowerCase().includes(q);
        const matchArmada = item.deptArmada.toLowerCase().includes(q);
        const matchKet = item.keterangan.toLowerCase().includes(q);
        const matchKetAntar = item.keteranganAntar.toLowerCase().includes(q);
        const matchKetPch = item.keteranganPch.toLowerCase().includes(q);
        if (!matchNo && !matchFpb && !matchTtb && !matchArmada && !matchKet && !matchKetAntar && !matchKetPch) {
          return false;
        }
      }

      // PT
      if (selectedEntity !== 'ALL' && item.pt.toUpperCase() !== selectedEntity) {
        return false;
      }

      // PIC TTB
      if (selectedPicTtb !== 'ALL' && item.picTtb.toUpperCase() !== selectedPicTtb) {
        return false;
      }

      // PIC Lapangan
      if (selectedPicLap !== 'ALL' && item.picLapangan.toUpperCase() !== selectedPicLap) {
        return false;
      }

      // Status
      if (selectedStatus === 'DIANTAR') {
        if (!item.tglBarangDiantar || item.tglBarangDiantar === '-' || item.tglBarangDiantar === '/') {
          return false;
        }
      } else if (selectedStatus === 'BALIK_TTB') {
        if (!item.tglTimLapKePicTtb || item.tglTimLapKePicTtb === '-' || item.tglTimLapKePicTtb === '/') {
          return false;
        }
      } else if (selectedStatus === 'TUTUP_PCH') {
        if (!item.tglTtbKePicPch || item.tglTtbKePicPch === '-' || item.tglTtbKePicPch === '/') {
          return false;
        }
      } else if (selectedStatus === 'PENDING') {
        if (item.tglTtbKePicPch && item.tglTtbKePicPch !== '-' && item.tglTtbKePicPch !== '/') {
          return false;
        }
      }

      return true;
    });
  }, [items, searchQuery, selectedEntity, selectedPicTtb, selectedPicLap, selectedStatus]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA: string | number = a[sortField] || '';
      let valB: string | number = b[sortField] || '';

      if (sortField === 'no') {
        valA = parseInt(String(valA), 10) || 0;
        valB = parseInt(String(valB), 10) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / (pageSize === -1 ? sortedItems.length || 1 : pageSize)));
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return sortedItems;
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleSort = (field: keyof StockTaliItem) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedEntity('ALL');
    setSelectedPicTtb('ALL');
    setSelectedPicLap('ALL');
    setSelectedKategori('ALL');
    setSelectedStatus('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedEntity !== 'ALL' ||
    selectedPicTtb !== 'ALL' ||
    selectedPicLap !== 'ALL' ||
    selectedStatus !== 'ALL';

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* ======================================================== */}
      {/* 1. Header Hub & Action Bar                                */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Package className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Laporan Mutasi Barang Stock Tali &amp; Gudang Galangan
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live 2-Way Sync (Input &amp; Auto-Save)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="size-3" />
                  Sheet GID: 2021352613
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Input langsung dari web, edit di tempat, dan sinkron otomatis ke Google Sheets. Pemantauan 3 fase: Gudang TTB ➔ Serah Terima Tim Lapangan ➔ Arsip Purchasing.
                {lastSyncTime && (
                  <span className="ml-2 text-[11px] text-muted-foreground/80">
                    • Terakhir sinkron:{' '}
                    {new Date(lastSyncTime).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Tambah Mutasi, Auto-Save Sheet, Sync, Export, Open */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Tambah Mutasi Baru */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
            title="Tambah Baris Mutasi Baru & Auto-Save ke Google Sheets"
          >
            <Plus className="size-4" />
            <span>Tambah Mutasi</span>
          </button>

          {/* Tombol Pengaturan Webhook Google Sheets */}
          <button
            type="button"
            onClick={() => setIsWebhookModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer relative"
            title="Pengaturan Auto-Save Google Sheets (2-Way Live Sync)"
          >
            <Zap className={`size-3.5 ${isWebhookConfigured ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            <span>Auto-Save Sheet</span>
            {isWebhookConfigured ? (
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" title="Webhook Google Sheets Aktif" />
            ) : (
              <span className="size-2 rounded-full bg-amber-400" title="Webhook belum disetel" />
            )}
          </button>

          {/* Buka Google Sheet Asli */}
          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs"
            title="Buka Tab Sheet Asli di Google Sheets (GID: 2021352613)"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            <span>Buka Sheet</span>
          </a>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Ekspor baris terfilter ke format CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          {/* Sinkronkan Google Sheets */}
          <button
            type="button"
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Tarik pembaruan data mutasi stock tali langsung dari Google Sheets"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sheet'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Top Summary KPI Cards                                  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Mutasi */}
        <div
          onClick={() => handleResetFilters()}
          className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Mutasi
            </span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {kpi.totalItems}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Semua transaksi stok</p>
        </div>

        {/* Armada Terlayani */}
        <div
          onClick={() => setSelectedEntity('ALL')}
          className="p-4 rounded-xl bg-card border border-border hover:border-blue-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Armada / Dept
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition">
              <Ship className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {kpi.totalArmada}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Dari 5 entitas PT</p>
        </div>

        {/* Terkirim ke Lapangan */}
        <div
          onClick={() => setSelectedStatus('DIANTAR')}
          className="p-4 rounded-xl bg-card border border-border hover:border-emerald-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Terkirim Lapangan
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition">
              <Truck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {kpi.terkirimLapangan}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {kpi.totalItems > 0 ? Math.round((kpi.terkirimLapangan / kpi.totalItems) * 100) : 0}% telah diantar
          </p>
        </div>

        {/* Berkas Balik ke TTB */}
        <div
          onClick={() => setSelectedStatus('BALIK_TTB')}
          className="p-4 rounded-xl bg-card border border-border hover:border-teal-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Kembali ke TTB
            </span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500 group-hover:scale-110 transition">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
            {kpi.kembaliKeTtb}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Fisik balik ke PIC TTB</p>
        </div>

        {/* Ke PIC Purchasing */}
        <div
          onClick={() => setSelectedStatus('TUTUP_PCH')}
          className="p-4 rounded-xl bg-card border border-border hover:border-indigo-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tutup ke PCH
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {kpi.tutupSiklusPch}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            {kpi.totalItems - kpi.tutupSiklusPch} menunggu serah terima
          </p>
        </div>

        {/* Entitas Terbanyak */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Top Entitas
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">CPL</span>
            <span className="text-xs text-muted-foreground font-medium">
              ({kpi.ptCounts['CPL'] || 0} mutasi)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            HL ({kpi.ptCounts['HL'] || 0}) • GAJ ({kpi.ptCounts['GAJ'] || 0}) • MIL ({kpi.ptCounts['MIL'] || 0})
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Filter & Search Bar                                    */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari No. FPB, No. TTB, Armada, Keterangan barang atau tujuan..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter PT */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">PT:</span>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PT ({items.length})</option>
                {entityOptions.map((pt) => (
                  <option key={pt} value={pt}>
                    PT {pt}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter PIC TTB */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">PIC TTB:</span>
              <select
                value={selectedPicTtb}
                onChange={(e) => {
                  setSelectedPicTtb(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PIC TTB</option>
                {picTtbOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter PIC Lapangan */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">PIC Lapangan:</span>
              <select
                value={selectedPicLap}
                onChange={(e) => {
                  setSelectedPicLap(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PIC Lapangan</option>
                {picLapOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg bg-muted/60 hover:bg-muted transition cursor-pointer"
                title="Reset semua filter"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Pills Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50 text-xs">
          <span className="text-muted-foreground font-medium text-[11px] mr-1">Status Alur:</span>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('ALL');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedStatus === 'ALL'
                ? 'bg-foreground text-background shadow-xs'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Semua ({items.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('DIANTAR');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedStatus === 'DIANTAR'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <Truck className="size-3" />
            <span>Sudah Diantar Lapangan ({kpi.terkirimLapangan})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('BALIK_TTB');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedStatus === 'BALIK_TTB'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400'
            }`}
          >
            <CheckCircle2 className="size-3" />
            <span>Bukti Fisik Balik ke TTB ({kpi.kembaliKeTtb})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('TUTUP_PCH');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedStatus === 'TUTUP_PCH'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            <UserCheck className="size-3" />
            <span>Tutup ke Purchasing ({kpi.tutupSiklusPch})</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Interactive Data Table                                 */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Table Sub-Header Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              Menampilkan <strong className="text-foreground">{paginatedItems.length}</strong> dari{' '}
              <strong className="text-foreground">{filteredItems.length}</strong> mutasi
            </span>
            {hasActiveFilters && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                Filter Aktif
              </span>
            )}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs rounded-lg border border-border bg-background focus:outline-none"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="-1">Semua ({filteredItems.length})</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            {/* Top Multi-Header: Column Groups */}
            <thead>
              <tr className="border-b border-border bg-muted/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th colSpan={4} className="py-2 px-3 border-r border-border text-center bg-blue-500/5 text-blue-600 dark:text-blue-400">
                  1. Identitas &amp; Unit Penerima
                </th>
                <th colSpan={5} className="py-2 px-3 border-r border-border text-center bg-purple-500/5 text-purple-600 dark:text-purple-400">
                  2. Logistik Gudang (TTB)
                </th>
                <th colSpan={5} className="py-2 px-3 border-r border-border text-center bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                  3. Pengantaran Tim Lapangan
                </th>
                <th colSpan={4} className="py-2 px-3 border-r border-border text-center bg-amber-500/5 text-amber-600 dark:text-amber-400">
                  4. Tutup Siklus (Ke Purchasing)
                </th>
                <th colSpan={1} className="py-2 px-3 text-center bg-muted text-foreground">
                  Aksi Web
                </th>
              </tr>

              {/* Bottom Column Headers */}
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                {/* 1. Identitas */}
                <th
                  onClick={() => handleSort('no')}
                  className="py-3 px-3 text-center w-12 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>No</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pt')}
                  className="py-3 px-3 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>PT</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('deptArmada')}
                  className="py-3 px-3 min-w-[150px] cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Dept / Armada</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[110px] border-r border-border">
                  <span>No. FPB</span>
                </th>

                {/* 2. Logistik TTB */}
                <th className="py-3 px-3 min-w-[110px]">
                  <span>No. TTB</span>
                </th>
                <th
                  onClick={() => handleSort('picTtb')}
                  className="py-3 px-3 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>PIC TTB</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Tgl Input TTB</span>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Ke Tim Lapangan</span>
                </th>
                <th className="py-3 px-3 min-w-[150px] border-r border-border">
                  <span>Keterangan Stok</span>
                </th>

                {/* 3. Tim Lapangan */}
                <th
                  onClick={() => handleSort('picLapangan')}
                  className="py-3 px-3 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>PIC Lapangan</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Tgl Diantar</span>
                </th>
                <th className="py-3 px-3 min-w-[130px]">
                  <span>Ket. Antar / Lokasi</span>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Fisik Balik ke TTB</span>
                </th>
                <th className="py-3 px-2 text-center border-r border-border">
                  <span>Lapse</span>
                </th>

                {/* 4. Tutup Siklus Purchasing */}
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>TTB ke PIC PCH</span>
                </th>
                <th className="py-3 px-3 min-w-[120px]">
                  <span>Ket. PCH</span>
                </th>
                <th className="py-3 px-2 text-center">
                  <span>Lapse</span>
                </th>
                <th className="py-3 px-3 text-center border-r border-border">
                  <span>Status Alur</span>
                </th>

                {/* Aksi */}
                <th className="py-3 px-3 text-center w-28 whitespace-nowrap">
                  <span>Aksi</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="size-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">Tidak ada data mutasi yang cocok dengan filter.</p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Reset semua filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const ptStyle = PT_COLORS[item.pt] || {
                    bg: 'bg-muted',
                    text: 'text-foreground',
                    border: 'border-border',
                  };

                  const isTerkirim = item.tglBarangDiantar && item.tglBarangDiantar !== '-' && item.tglBarangDiantar !== '/';
                  const isKembaliTtb = item.tglTimLapKePicTtb && item.tglTimLapKePicTtb !== '-' && item.tglTimLapKePicTtb !== '/';
                  const isTutupPch = item.tglTtbKePicPch && item.tglTtbKePicPch !== '-' && item.tglTtbKePicPch !== '/';

                  return (
                    <tr
                      key={`${item.no}-${item.ttb}-${idx}`}
                      className="hover:bg-muted/40 transition-colors group cursor-pointer"
                      onClick={() => handleOpenEditModal(item)}
                    >
                      {/* 1. No */}
                      <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                        {item.no}
                      </td>

                      {/* 2. PT */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${ptStyle.bg} ${ptStyle.text} ${ptStyle.border}`}
                        >
                          {item.pt}
                        </span>
                      </td>

                      {/* 3. Dept / Armada */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Ship className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{item.deptArmada}</span>
                        </div>
                      </td>

                      {/* 4. No. FPB */}
                      <td className="py-2.5 px-3 border-r border-border">
                        {item.noFpb ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="font-mono font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                              {item.noFpb}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(item.noFpb, `fpb-${item.no}`);
                              }}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                              title="Salin No FPB"
                            >
                              {copiedKey === `fpb-${item.no}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/70 italic px-1.5 py-0.5 rounded bg-muted/30">
                            Mutasi Langsung
                          </span>
                        )}
                      </td>

                      {/* 5. No. TTB */}
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-1">
                          <span className="font-mono font-bold text-primary">
                            {item.ttb || '-'}
                          </span>
                          {item.ttb && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(item.ttb, `ttb-${item.no}`);
                              }}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                              title="Salin No TTB"
                            >
                              {copiedKey === `ttb-${item.no}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 6. PIC TTB */}
                      <td className="py-2.5 px-3">
                        {item.picTtb ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {item.picTtb}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 7. Tgl Input TTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                        {item.tglInputTtb || '-'}
                      </td>

                      {/* 8. Tgl ke Tim Lapangan */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.tglKeTimLapangan ? (
                          <span className="font-medium text-foreground">{item.tglKeTimLapangan}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 9. Keterangan Stok */}
                      <td className="py-2.5 px-3 border-r border-border">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground">
                          <Tag className="size-3 text-muted-foreground" />
                          <span>{item.keterangan || 'STOCK GAJ'}</span>
                        </span>
                      </td>

                      {/* 10. PIC Lapangan */}
                      <td className="py-2.5 px-3">
                        {item.picLapangan ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Truck className="size-3" />
                            <span>{item.picLapangan}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 11. Tgl Barang Diantar */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isTerkirim ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            <span>{item.tglBarangDiantar}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Menunggu antaran</span>
                        )}
                      </td>

                      {/* 12. Keterangan Antar / Lokasi */}
                      <td className="py-2.5 px-3">
                        {item.keteranganAntar ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {item.keteranganAntar}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 13. Tgl Tim Lap ke PIC TTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isKembaliTtb ? (
                          <span className="text-foreground font-medium">{item.tglTimLapKePicTtb}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 14. Lapse Lapangan */}
                      <td className="py-2.5 px-2 text-center border-r border-border text-muted-foreground font-mono">
                        {item.lapseDay2 || '-'}
                      </td>

                      {/* 15. Tgl TTB ke PIC PCH */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isTutupPch ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            {item.tglTtbKePicPch}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Menunggu Arsip PCH
                          </span>
                        )}
                      </td>

                      {/* 16. Keterangan PCH */}
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {item.keteranganPch || '-'}
                      </td>

                      {/* 17. Lapse Hari 3 */}
                      <td className="py-2.5 px-2 text-center text-muted-foreground font-mono">
                        {item.lapseDay3 && item.lapseDay3 !== '/' ? item.lapseDay3 : '-'}
                      </td>

                      {/* 18. Status Alur Badge */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-border">
                        {isTutupPch ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <CheckCircle2 className="size-3" />
                            Selesai Siklus
                          </span>
                        ) : isKembaliTtb ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                            <CheckCircle2 className="size-3" />
                            Fisik di TTB
                          </span>
                        ) : isTerkirim ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Truck className="size-3" />
                            Terkirim Kapal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="size-3" />
                            Dalam Proses
                          </span>
                        )}
                      </td>

                      {/* 19. Aksi Web: Edit & 1-Click Fast Progress */}
                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Edit Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition cursor-pointer"
                            title="Edit data mutasi stok"
                          >
                            <Edit3 className="size-3" />
                            <span>Edit</span>
                          </button>

                          {/* 1-Click Status Quick Actions */}
                          {!isTerkirim ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(item, { tglBarangDiantar: getTodayIndo() }, 'Tandai Diantar')}
                              className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/30 transition cursor-pointer"
                              title="Tandai telah diantar hari ini"
                            >
                              🚚 Antar
                            </button>
                          ) : !isKembaliTtb ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(item, { tglTimLapKePicTtb: getTodayIndo() }, 'Fisik Balik ke TTB')}
                              className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-teal-500/10 hover:bg-teal-500 text-teal-600 hover:text-white border border-teal-500/30 transition cursor-pointer"
                              title="Fisik balik ke PIC TTB hari ini"
                            >
                              📦 Balik TTB
                            </button>
                          ) : !isTutupPch ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(item, { tglTtbKePicPch: getTodayIndo() }, 'Tutup ke Purchasing')}
                              className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white border border-indigo-500/30 transition cursor-pointer"
                              title="Serahkan ke PIC Purchasing hari ini"
                            >
                              🤝 Ke PCH
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {sortedItems.length > 0 && pageSize !== -1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Halaman <strong className="text-foreground">{currentPage}</strong> dari{' '}
              <strong className="text-foreground">{totalPages}</strong> (Total{' '}
              <strong className="text-foreground">{sortedItems.length}</strong> baris)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </button>

              <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. Modal Tambah / Edit Mutasi Stok                        */}
      {/* ======================================================== */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Package className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {isAddModalOpen ? 'Tambah Mutasi Barang Stock Tali & Gudang' : `Edit Mutasi Stok No. ${formData.no}`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Data akan langsung tersimpan di sistem dan otomatis di-update ke Google Sheet (GID: 2021352613).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Step Navigation Tabs */}
            <div className="flex border-b border-border bg-muted/20 px-5 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setModalActiveTab('IDENTITAS')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition cursor-pointer ${
                  modalActiveTab === 'IDENTITAS'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Ship className="size-3.5" />
                <span>1. Identitas &amp; Unit</span>
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('TTB')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition cursor-pointer ${
                  modalActiveTab === 'TTB'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Package className="size-3.5" />
                <span>2. Logistik TTB</span>
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('LAPANGAN')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition cursor-pointer ${
                  modalActiveTab === 'LAPANGAN'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Truck className="size-3.5" />
                <span>3. Tim Lapangan</span>
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('PCH')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition cursor-pointer ${
                  modalActiveTab === 'PCH'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCheck className="size-3.5" />
                <span>4. Tutup ke PCH</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: IDENTITAS */}
              {modalActiveTab === 'IDENTITAS' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* No Urut */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        No. Urut Mutasi:
                      </label>
                      <input
                        type="text"
                        value={formData.no || ''}
                        onChange={(e) => setFormData({ ...formData, no: e.target.value })}
                        placeholder="Otomatis"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Entitas PT */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Entitas PT: <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.pt || 'CPL'}
                        onChange={(e) => setFormData({ ...formData, pt: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {PT_OPTIONS.map((pt) => (
                          <option key={pt} value={pt}>
                            PT {pt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dept / Armada */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Dept / Armada Kapal Penerima: <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          list="armada-options"
                          value={formData.deptArmada || ''}
                          onChange={(e) => setFormData({ ...formData, deptArmada: e.target.value.toUpperCase() })}
                          placeholder="Ketik atau pilih nama kapal (cth: MT BLUE PETROL, TB KING STAR, GAJ 02)..."
                          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                        />
                        <datalist id="armada-options">
                          {armadaSuggestions.map((arm) => (
                            <option key={arm} value={arm} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* No FPB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        No. FPB (Jika ada):
                      </label>
                      <input
                        type="text"
                        value={formData.noFpb || ''}
                        onChange={(e) => setFormData({ ...formData, noFpb: e.target.value })}
                        placeholder="Contoh: 003374 (Kosongkan bila mutasi langsung)"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      />
                    </div>

                    {/* Keterangan Stok Barang */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Keterangan Barang / Stok:
                      </label>
                      <input
                        type="text"
                        value={formData.keterangan || ''}
                        onChange={(e) => setFormData({ ...formData, keterangan: e.target.value.toUpperCase() })}
                        placeholder="Contoh: STOCK GAJ TALI, OLI, FILTER..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TTB LOGISTIK */}
              {modalActiveTab === 'TTB' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* No TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nomor Dokumen TTB Resmi: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.ttb || ''}
                        onChange={(e) => setFormData({ ...formData, ttb: e.target.value.toUpperCase() })}
                        placeholder="Contoh: 06078 atau D0/26/00254"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono font-bold"
                      />
                    </div>

                    {/* PIC TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        PIC Pembuat TTB (Gudang):
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={formData.picTtb || 'FIFI'}
                          onChange={(e) => setFormData({ ...formData, picTtb: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {PIC_TTB_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Tgl Input TTB */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-foreground">
                          Tanggal Input TTB:
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, tglInputTtb: getTodayIndo() })}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Gunakan Hari Ini
                        </button>
                      </div>
                      <input
                        type="date"
                        value={toInputDate(formData.tglInputTtb)}
                        onChange={(e) => setFormData({ ...formData, tglInputTtb: fromInputDate(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Tgl Ke Tim Lapangan */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-foreground">
                          Tanggal Serah ke Tim Lapangan:
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, tglKeTimLapangan: getTodayIndo() })}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Gunakan Hari Ini
                        </button>
                      </div>
                      <input
                        type="date"
                        value={toInputDate(formData.tglKeTimLapangan)}
                        onChange={(e) => setFormData({ ...formData, tglKeTimLapangan: fromInputDate(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TIM LAPANGAN */}
              {modalActiveTab === 'LAPANGAN' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* PIC Lapangan */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Petugas Lapangan (Pengantar):
                      </label>
                      <select
                        value={formData.picLapangan || 'HAMKA'}
                        onChange={(e) => setFormData({ ...formData, picLapangan: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {PIC_LAP_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tgl Barang Diantar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-foreground">
                          Tanggal Barang Diantar ke Kapal:
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, tglBarangDiantar: getTodayIndo() })}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Hari Ini
                        </button>
                      </div>
                      <input
                        type="date"
                        value={toInputDate(formData.tglBarangDiantar)}
                        onChange={(e) => setFormData({ ...formData, tglBarangDiantar: fromInputDate(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Keterangan Antar / Lokasi */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Keterangan Antar / Lokasi Serah Terima:
                      </label>
                      <input
                        type="text"
                        value={formData.keteranganAntar || ''}
                        onChange={(e) => setFormData({ ...formData, keteranganAntar: e.target.value.toUpperCase() })}
                        placeholder="Contoh: KE DEWI SRI, DERMAGA CPL, TITIP POSKO..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Tgl Fisik Balik ke TTB */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-foreground">
                          Tanggal Bukti Fisik Balik ke PIC TTB:
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, tglTimLapKePicTtb: getTodayIndo() })}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Hari Ini
                        </button>
                      </div>
                      <input
                        type="date"
                        value={toInputDate(formData.tglTimLapKePicTtb)}
                        onChange={(e) => setFormData({ ...formData, tglTimLapKePicTtb: fromInputDate(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: TUTUP KE PURCHASING */}
              {modalActiveTab === 'PCH' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tgl TTB ke PIC PCH */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-foreground">
                          Tanggal TTB Diserahkan ke PIC PCH:
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, tglTtbKePicPch: getTodayIndo() })}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Hari Ini
                        </button>
                      </div>
                      <input
                        type="date"
                        value={toInputDate(formData.tglTtbKePicPch)}
                        onChange={(e) => setFormData({ ...formData, tglTtbKePicPch: fromInputDate(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Keterangan PCH */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Keterangan Purchasing / Arsip:
                      </label>
                      <input
                        type="text"
                        value={formData.keteranganPch || ''}
                        onChange={(e) => setFormData({ ...formData, keteranganPch: e.target.value })}
                        placeholder="Contoh: Sudah diarsip, menunggu laporan bulanan..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      <span>Alur Penutupan Mutasi Stok:</span>
                    </p>
                    <p>
                      Ketika tanggal serah terima ke PIC PCH terisi, mutasi ini secara otomatis berstatus <strong>"Selesai Siklus (Tutup ke PCH)"</strong> dan tercatat rapi di Google Sheets GID 2021352613.
                    </p>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className={`size-3.5 ${isWebhookConfigured ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <span>
                    {isWebhookConfigured ? 'Auto-save Google Sheets Aktif' : 'Tersimpan lokal (Webhook belum disetel)'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setIsEditModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="size-3.5" />
                        <span>Simpan &amp; Sinkronkan ke Sheet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. Modal Pengaturan Webhook Auto-Save Google Sheets       */}
      {/* ======================================================== */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Zap className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Pengaturan Auto-Save Google Sheets (2-Way Live Sync)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hubungkan form web langsung dengan Tab Mutasi Stock Tali &amp; Gudang (GID: 2021352613).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Status Webhook Card */}
              <div
                className={`p-3.5 rounded-xl border text-xs ${
                  webhookStatus?.active
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : isWebhookConfigured
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {webhookStatus?.active
                        ? 'Webhook Google Sheets Aktif & Terhubung!'
                        : isWebhookConfigured
                        ? 'URL Webhook Tersimpan'
                        : 'Webhook Belum Dihubungkan'}
                    </span>
                    <p className="mt-0.5 opacity-90 text-[11px]">
                      {webhookStatus?.message ||
                        (isWebhookConfigured
                          ? 'Setiap kali mutasi stok ditambah atau diedit dari web, data otomatis di-push ke Google Sheet.'
                          : 'Tempelkan Webhook Apps Script di bawah untuk mengaktifkan sinkronisasi otomatis 2 arah.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Input URL Webhook */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  URL Webhook Google Apps Script (Web App URL):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook || !webhookUrl.trim()}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50"
                  >
                    {isTestingWebhook ? 'Mentes...' : 'Tes Koneksi'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingWebhook ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>

              {/* Tombol Salin Skrip Apps Script */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground">Skrip Google Apps Script Siap Pakai</span>
                    <p className="text-[11px] text-muted-foreground">
                      Skrip ini dirancang khusus untuk Sheet GID 2021352613.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
                  >
                    {copiedScript ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    <span>{copiedScript ? 'Tersalin!' : 'Salin Skrip Webhook'}</span>
                  </button>
                </div>

                {/* Petunjuk Langkah Pemasangan */}
                <ol className="list-decimal list-inside text-[11px] text-muted-foreground space-y-1.5 pl-1 pt-1 border-t border-border/60">
                  <li>
                    Buka Google Sheet: <a href={GOOGLE_SHEET_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Mutasi Stock Tali &amp; Gudang ↗</a>.
                  </li>
                  <li>
                    Klik menu atas: <strong>Ekstensi (Extensions)</strong> ➔ <strong>Apps Script</strong>.
                  </li>
                  <li>
                    Hapus kode bawaan, lalu klik tombol <strong>"Salin Skrip Webhook"</strong> di atas dan tempelkan (Paste).
                  </li>
                  <li>
                    Klik tombol biru <strong>Terapkan (Deploy)</strong> di pojok kanan atas ➔ <strong>Penerapan baru (New deployment)</strong>.
                  </li>
                  <li>
                    Pilih jenis <strong>Aplikasi web (Web app)</strong>:
                    <ul className="list-disc list-inside pl-4 mt-0.5 space-y-0.5 text-[10px]">
                      <li>Jalankan sebagai: <em>Saya (email Anda)</em></li>
                      <li className="font-semibold text-rose-600 dark:text-rose-400">
                        Siapa yang memiliki akses: <u>Siapa saja (Anyone)</u>
                      </li>
                    </ul>
                  </li>
                  <li>
                    Salin <strong>URL Aplikasi Web</strong> yang berakhiran <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">/exec</code>, tempel pada input di atas, lalu klik <strong>Tes Koneksi</strong> &amp; <strong>Simpan</strong>.
                  </li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
