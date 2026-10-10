'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  EntityCode,
  LapseFilterType,
  TabType,
  ProcurementItem,
  ArmadaItem,
  ToastState,
  InventoryItem,
  InventorySummary,
  KapalPosisiItem,
  KapalPosisiSummary,
} from '@/types/procurement';
import { INITIAL_PROCUREMENT_DATA, INITIAL_ARMADA_DATA } from '@/data/initialData';
import { mergeProcurementDatasets, mergeArmadaDatasets, enrichProcurementAndArmada, normalizeFpbKey } from '@/utils/dataMerger';
import { evaluateTransactionStatus } from '@/utils/statusWorkflow';
import { ResetScope } from '@/components/ResetConfirmModal';
import { formatDateDdMmYyDash, extractDateInfo } from '@/utils/formatDate';
import {
  saveStoredProcurement,
  loadStoredProcurement,
  saveStoredArmada,
  loadStoredArmada,
  saveStoredInventory,
  loadStoredInventory,
  saveStoredKapalPosisi,
  loadStoredKapalPosisi,
  saveStoredWorkOrder,
  loadStoredWorkOrder,
  clearStoredData,
} from '@/utils/appStorage';
import { WorkOrderItem, WorkOrderSummary } from '@/types/workOrder';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import KpiCards from '@/components/KpiCards';
import OverviewTab from '@/components/OverviewTab';
import ProcurementTab from '@/components/ProcurementTab';
import ArmadaTab from '@/components/ArmadaTab';
import PosisiKapalTab from '@/components/PosisiKapalTab';
import WorkOrderTab from '@/components/WorkOrderTab';
import ServiceMaintenanceTab from '@/components/ServiceMaintenanceTab';
import {
  ServiceMaintenanceItem,
  ServiceMaintenanceSummary,
  VendorSheetConfig,
} from '@/types/serviceMaintenance';
import {
  saveStoredServiceMaintenance,
  loadStoredServiceMaintenance,
  saveStoredSmVendors,
  loadStoredSmVendors,
  INITIAL_SM_ITEMS,
  INITIAL_SM_SUMMARY,
} from '@/utils/smStorage';
import AnalyticsTab from '@/components/AnalyticsTab';
import InventoryTab from '@/components/InventoryTab';
import TimemarkTab from '@/components/TimemarkTab';
import TtbGalleryTab from '@/components/TtbGalleryTab';
import AdminSettingsTab from '@/components/AdminSettingsTab';
import AuditModal from '@/components/AuditModal';
import NewRecordModal from '@/components/NewRecordModal';
import LoginPage from '@/components/LoginPage';
import { useAuth } from '@/context/AuthContext';

import ToastNotification from '@/components/ToastNotification';
import { PanelLeftOpen, ChevronDown } from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading, isAdmin, isVisitor } = useAuth();

  const [procurementData, setProcurementData] = useState<ProcurementItem[]>(
    INITIAL_PROCUREMENT_DATA
  );
  const [armadaData, setArmadaData] = useState<ArmadaItem[]>(INITIAL_ARMADA_DATA);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedEntity, setSelectedEntity] = useState<EntityCode>('ALL');
  const [selectedLapse, setSelectedLapse] = useState<LapseFilterType>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isKpiHidden, setIsKpiHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('CPG_KPI_HIDDEN') === 'true';
    }
    return false;
  });

  const toggleKpiHidden = () => {
    setIsKpiHidden((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('CPG_KPI_HIDDEN', String(next));
      }
      return next;
    });
  };

  // State untuk modul persediaan barang (Accurate) - dimulai kosong agar pengguna dapat menguji unggah file Excel setiap kali refresh
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);

  // State untuk modul Daily Report Posisi Kapal (Fleet Management System)
  const [kapalPosisiItems, setKapalPosisiItems] = useState<KapalPosisiItem[]>([]);
  const [kapalPosisiSummary, setKapalPosisiSummary] = useState<KapalPosisiSummary | null>(null);
  const [isLoadingPosisiKapal, setIsLoadingPosisiKapal] = useState<boolean>(false);

  // Fungsi untuk menyinkronkan data Posisi Kapal dari FMS (/voyage/daily_index)
  const handleRefreshPosisiKapal = async () => {
    setIsLoadingPosisiKapal(true);
    showToast('Menghubungkan ke Fleet Management System & menarik Posisi Kapal...', 'info');

    try {
      const res = await fetch('/api/posisi-kapal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logistik',
          password: '12345',
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setKapalPosisiItems(data.items);
        if (data.summary) setKapalPosisiSummary(data.summary);
        await saveStoredKapalPosisi(data.items, data.summary || null);
        showToast(
          `Berhasil menarik data Daily Report Posisi Kapal (${data.items.length} unit kapal)!`,
          'success'
        );
      } else {
        throw new Error(data.message || 'Gagal mengambil data posisi kapal.');
      }
    } catch (err: any) {
      console.error('Gagal mengambil data posisi kapal:', err);
      showToast(err.message || 'Gagal menyinkronkan posisi kapal dari FMS.', 'error');
    } finally {
      setIsLoadingPosisiKapal(false);
    }
  };

  // State untuk modul Work Order (Form Responses 1 Google Sheets)
  const [workOrderItems, setWorkOrderItems] = useState<WorkOrderItem[]>([]);
  const [workOrderSummary, setWorkOrderSummary] = useState<WorkOrderSummary | null>(null);
  const [isLoadingWorkOrder, setIsLoadingWorkOrder] = useState<boolean>(false);

  // Fungsi sinkronisasi data Work Order dari Form Responses 1 Google Sheets
  const handleSyncWorkOrder = async () => {
    setIsLoadingWorkOrder(true);
    showToast('Menghubungkan & menyinkronkan data Work Order (Form Responses 1)...', 'info');
    try {
      const res = await fetch('/api/sync-work-order');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setWorkOrderItems(data.items);
        if (data.summary) setWorkOrderSummary(data.summary);
        await saveStoredWorkOrder(data.items, data.summary || null);

        // Sinkronkan nomor WO ke dataset Procurement dan Armada
        setProcurementData((prevProc) => {
          setArmadaData((prevArm) => {
            const enriched = enrichProcurementAndArmada(prevProc, prevArm, data.items);
            saveStoredProcurement(enriched.procurement);
            saveStoredArmada(enriched.armada);
            return enriched.armada;
          });
          const enriched = enrichProcurementAndArmada(prevProc, armadaData, data.items);
          return enriched.procurement;
        });

        showToast(
          `Berhasil menyinkronkan ${data.items.length.toLocaleString('id-ID')} data Work Order & menghubungkannya ke FPB Overview!`,
          'success'
        );
      } else {
        throw new Error(data.message || 'Gagal menyinkronkan data Work Order.');
      }
    } catch (err: any) {
      console.error('Gagal mengambil data Work Order:', err);
      showToast(err.message || 'Gagal menyinkronkan Work Order dari Google Sheets.', 'error');
    } finally {
      setIsLoadingWorkOrder(false);
    }
  };

  // State untuk modul Service & Maintenance (List SM Bengkel Vendor)
  const [smItems, setSmItems] = useState<ServiceMaintenanceItem[]>(INITIAL_SM_ITEMS);
  const [smSummary, setSmSummary] = useState<ServiceMaintenanceSummary | null>(INITIAL_SM_SUMMARY);
  const [isLoadingSm, setIsLoadingSm] = useState<boolean>(false);
  const [smVendors, setSmVendors] = useState<VendorSheetConfig[]>([]);

  // Fungsi sinkronisasi data Service & Maintenance dari Google Sheets seluruh vendor
  const handleSyncSm = async () => {
    setIsLoadingSm(true);
    showToast('Menghubungkan ke Google Sheets vendor SM (Karindo, Surabaya Teknik, dll)...', 'info');
    try {
      const res = await fetch('/api/sync-sm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true, vendors: smVendors }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        if (data.items.length > 0) {
          const existingMap = new Map(smItems.map((i) => [i.id, i]));
          data.items.forEach((it: ServiceMaintenanceItem) => existingMap.set(it.id, it));
          const merged = Array.from(existingMap.values());
          setSmItems(merged);
          if (data.summary) setSmSummary(data.summary);
          await saveStoredServiceMaintenance(merged, data.summary || null);
        }
        showToast(
          data.message || `Berhasil menyinkronkan data SM dari Google Sheets!`,
          'success'
        );
      } else {
        throw new Error(data.message || 'Gagal menyinkronkan data Service & Maintenance.');
      }
    } catch (err: any) {
      console.error('Gagal mengambil data SM:', err);
      showToast(err.message || 'Gagal menyinkronkan data SM dari Google Sheets.', 'error');
    } finally {
      setIsLoadingSm(false);
    }
  };

  const handleUploadSmExcel = (newItems: ServiceMaintenanceItem[]) => {
    const existingMap = new Map(smItems.map((i) => [i.id, i]));
    newItems.forEach((it) => existingMap.set(it.id, it));
    const merged = Array.from(existingMap.values());
    const totalClose = merged.filter((i) => i.status === 'CLOSE').length;
    const totalOpen = merged.filter((i) => i.status === 'OPEN').length;
    const totalHold = merged.filter((i) => i.status === 'HOLD').length;
    const summary: ServiceMaintenanceSummary = {
      totalRecords: merged.length,
      totalClose,
      totalOpen,
      totalHold,
      totalVendors: Array.from(new Set(merged.map((i) => i.vendor))).length,
      lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
    setSmItems(merged);
    setSmSummary(summary);
    saveStoredServiceMaintenance(merged, summary);
  };

  const handleSaveSmVendors = (configs: VendorSheetConfig[]) => {
    setSmVendors(configs);
    saveStoredSmVendors(configs);
  };

  // State untuk sinkronisasi live Google Sheets
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);

  // Fungsi sinkronisasi seluruh data pengadaan dan armada langsung dari Google Sheets
  const handleSyncGoogleSheets = async () => {
    setIsSyncingSheets(true);
    showToast('Menghubungkan ke Google Sheets & mengunduh seluruh data terbaru...', 'info');
    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyinkronkan data Google Sheets.');
      }
      if (data.procurement?.length > 0 || data.armada?.length > 0) {
        handleExcelUpload({
          procurement: data.procurement || [],
          armada: data.armada || [],
        });
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (typeof window !== 'undefined') {
          localStorage.setItem('CPG_LAST_SYNC_TIME', timeStr);
        }
        showToast(
          data.message || `Berhasil menyinkronkan ${data.procurement.length.toLocaleString('id-ID')} data dari Google Sheets!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Sync Sheets Error:', err);
      showToast(err.message || 'Gagal menyinkronkan data dari Google Sheets.', 'error');
    } finally {
      setIsSyncingSheets(false);
    }
  };


  // Fungsi untuk memuat contoh data persediaan default jika diinginkan oleh pengguna
  const handleLoadSampleInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success && data.items) {
        setInventoryItems(data.items);
        if (data.summary) setInventorySummary(data.summary);
        saveStoredInventory(data.items, data.summary || null);
        showToast(
          `Berhasil memuat ${data.items.length.toLocaleString('id-ID')} item persediaan stok default Accurate!`,
          'success'
        );
      }
    } catch (err) {
      console.error('Gagal mengambil data persediaan:', err);
      showToast('Gagal memuat data persediaan default.', 'error');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Auto-collapse sidebar on mobile screen size on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  // Sanitasi data procurement dari storage: selalu evaluasi status agar 100% akurat
  const sanitizeProcItem = (item: any): ProcurementItem => {
    let picAktif = item.picAktif || '-';
    picAktif = picAktif.replace(/\(adm\/finance\)/gi, '(ADM/PRC)');

    const lapse = typeof item.lapse === 'number' && item.lapse >= 0 ? item.lapse : 0;
    const lapseText = item.lapseText || (item.lapse < 0 ? 'TBC' : undefined);

    const baseItem: ProcurementItem = {
      ...item,
      fpb: item.fpb || '',
      entity: item.entity || 'CPL',
      po: item.po || '-',
      date: item.date || item.tglPo || '',
      item: item.item || '',
      peruntukan: item.peruntukan || '',
      lapse,
      lapseText,
      picPch: item.picPch || '-',
      picTtb: item.picTtb || '-',
      picLap: item.picLap || '-',
      picAdm: item.picAdm || '-',
      picAktif,
      statusBadge: item.statusBadge || 'PROSES',
      statusTone: item.statusTone || 'cyan',
      statusPenjelasan: item.statusPenjelasan || '',
    };

    // Evaluasi status dan keterangan secara akurat dari nilai riil tahapan supply chain
    const evalResult = evaluateTransactionStatus(baseItem);
    baseItem.statusBadge = evalResult.statusBadge;
    baseItem.statusTone = evalResult.statusTone;
    baseItem.statusPenjelasan = evalResult.statusPenjelasan;
    if (!baseItem.picAktif || baseItem.picAktif === '-' || baseItem.picAktif.includes('Input PO')) {
      baseItem.picAktif = evalResult.picAktif;
    }

    return baseItem;
  };

  const sanitizeArmItem = (item: any): ArmadaItem => {
    let picAktif = item.picAktif || '-';
    picAktif = picAktif.replace(/\(adm\/finance\)/gi, '(ADM/PRC)');

    const baseArm: ArmadaItem = {
      ...item,
      lapse: typeof item.lapse === 'number' && item.lapse >= 0 ? item.lapse : 0,
      lapseText: item.lapseText || (item.lapse < 0 ? 'TBC' : undefined),
      picAktif,
    };

    const evalResult = evaluateTransactionStatus({
      fpb: baseArm.fpb,
      po: baseArm.noPo,
      tglPo: baseArm.tglPo,
      noFstb: baseArm.noFstb,
      tglFstb: baseArm.tglFstb,
      noTtb: baseArm.noTtb,
      tglTtb: baseArm.tglTtb,
      tglTimLapKePicTtb: baseArm.tglTimLapKePicTtb,
      noSpp: baseArm.noSpp,
      tglKeKeuangan: baseArm.tglKeKeuangan,
      picPch: baseArm.picPch,
      picTtb: baseArm.picTtb,
      picLap: baseArm.picLap,
      picAdm: baseArm.picAdm,
      lapse: baseArm.lapse,
      lapseText: baseArm.lapseText,
      statusArmada: baseArm.status,
    });

    baseArm.statusBadge = evalResult.statusBadge;
    baseArm.statusTone = evalResult.statusTone;
    if (!baseArm.picAktif || baseArm.picAktif === '-') {
      baseArm.picAktif = evalResult.picAktif;
    }

    return baseArm;
  };

  // Memuat data tersimpan dari IndexedDB saat halaman dibuka (TIDAK ADA auto-refresh ke server eksternal saat F5)
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [savedProc, savedArm, savedInv, savedKapal, savedWo, savedSm] = await Promise.all([
          loadStoredProcurement(),
          loadStoredArmada(),
          loadStoredInventory(),
          loadStoredKapalPosisi(),
          loadStoredWorkOrder(),
          loadStoredServiceMaintenance(),
        ]);

        if (!isMounted) return;

        const activeWoItems = (savedWo && savedWo.items) || [];
        if (activeWoItems.length > 0) {
          setWorkOrderItems(activeWoItems);
          if (savedWo?.summary) setWorkOrderSummary(savedWo.summary);
        }

        if (savedProc && savedProc.length > 0) {
          const rawSanitizedProc = savedProc.map(sanitizeProcItem);
          const rawSanitizedArm = (savedArm || []).map(sanitizeArmItem);

          // Cross-enrichment data tersimpan di browser agar nomor PO, TTB, status, dan nomor WO langsung tersinkronisasi
          const enriched = enrichProcurementAndArmada(rawSanitizedProc, rawSanitizedArm, activeWoItems);

          enriched.procurement.sort((a, b) => {
            const timeA = extractDateInfo(a.date).timestamp || 0;
            const timeB = extractDateInfo(b.date).timestamp || 0;
            if (timeA !== timeB) return timeB - timeA;
            const numA = (a.fpb || a.po || '').trim();
            const numB = (b.fpb || b.po || '').trim();
            return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
          });

          enriched.armada.sort((a, b) => {
            const timeA = extractDateInfo(a.tglPo || a.tglFpb).timestamp || 0;
            const timeB = extractDateInfo(b.tglPo || b.tglFpb).timestamp || 0;
            if (timeA !== timeB) return timeB - timeA;
            const numA = (a.fpb || a.noPo || a.noFstb || '').trim();
            const numB = (b.fpb || b.noPo || b.noFstb || '').trim();
            return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
          });

          setProcurementData(enriched.procurement);
          setArmadaData(enriched.armada);

          // Perbarui IndexedDB dengan data bersih yang sudah tersinkronisasi
          saveStoredProcurement(enriched.procurement);
          saveStoredArmada(enriched.armada);
        } else if (savedArm && savedArm.length > 0) {
          const sanitized = savedArm.map(sanitizeArmItem);
          sanitized.sort((a, b) => {
            const timeA = extractDateInfo(a.tglPo || a.tglFpb).timestamp || 0;
            const timeB = extractDateInfo(b.tglPo || b.tglFpb).timestamp || 0;
            if (timeA !== timeB) return timeB - timeA;
            const numA = (a.fpb || a.noPo || a.noFstb || '').trim();
            const numB = (b.fpb || b.noPo || b.noFstb || '').trim();
            return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
          });
          setArmadaData(sanitized);
        }
        if (savedInv && savedInv.items && savedInv.items.length > 0) {
          setInventoryItems(savedInv.items);
          if (savedInv.summary) setInventorySummary(savedInv.summary);
        }
        if (savedKapal && savedKapal.items && savedKapal.items.length > 0) {
          setKapalPosisiItems(savedKapal.items);
          if (savedKapal.summary) setKapalPosisiSummary(savedKapal.summary);
        }
        if (activeWoItems.length === 0) {
          // Sync Work Order on initial load in background if not yet cached
          fetch('/api/sync-work-order')
            .then((r) => r.json())
            .then((res) => {
              if (res.success && Array.isArray(res.items)) {
                setWorkOrderItems(res.items);
                if (res.summary) setWorkOrderSummary(res.summary);
                saveStoredWorkOrder(res.items, res.summary || null);

                // Auto-enrich dataset saat background fetch selesai
                setProcurementData((prevProc) => {
                  setArmadaData((prevArm) => {
                    const reEnriched = enrichProcurementAndArmada(prevProc, prevArm, res.items);
                    saveStoredProcurement(reEnriched.procurement);
                    saveStoredArmada(reEnriched.armada);
                    return reEnriched.armada;
                  });
                  const reEnriched = enrichProcurementAndArmada(prevProc, armadaData, res.items);
                  return reEnriched.procurement;
                });
              }
            })
            .catch((e) => console.warn('Auto-sync Work Order background:', e));
        }

        if (savedSm && savedSm.items && savedSm.items.length > 0) {
          setSmItems(savedSm.items);
          if (savedSm.summary) setSmSummary(savedSm.summary);
        }
        setSmVendors(loadStoredSmVendors());

      } catch (e) {
        console.error('Gagal memuat data tersimpan dari IndexedDB/storage:', e);
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, []);

  const [auditedFpb, setAuditedFpb] = useState<string | null>(null);
  const [auditedPo, setAuditedPo] = useState<string | null>(null);
  const [isNewRecordOpen, setIsNewRecordOpen] = useState<boolean>(false);

  const handleOpenAudit = (fpb: string, po?: string) => {
    setAuditedFpb(fpb);
    setAuditedPo(po || null);
  };

  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  // Filtered dataset
  const filteredProcurement = useMemo(() => {
    let list = [...procurementData];

    // Entity Filter
    if (selectedEntity !== 'ALL') {
      list = list.filter((r) => r.entity === selectedEntity);
    }

    // Lapse Filter
    if (selectedLapse === 'NORMAL') {
      list = list.filter((r) => r.lapse <= 2);
    } else if (selectedLapse === 'WARNING') {
      list = list.filter((r) => r.lapse >= 3 && r.lapse <= 5);
    } else if (selectedLapse === 'CRITICAL') {
      list = list.filter((r) => r.lapse > 5);
    }

    // Search Keyword
    if (searchKeyword.trim() !== '') {
      const q = searchKeyword.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.fpb?.toLowerCase().includes(q) ||
          r.po?.toLowerCase().includes(q) ||
          r.item?.toLowerCase().includes(q) ||
          r.peruntukan?.toLowerCase().includes(q) ||
          r.deptArmada?.toLowerCase().includes(q) ||
          r.entity?.toLowerCase().includes(q) ||
          r.picCheckFpb?.toLowerCase().includes(q) ||
          r.picPch?.toLowerCase().includes(q) ||
          r.picTtb?.toLowerCase().includes(q) ||
          r.picLap?.toLowerCase().includes(q) ||
          r.picAdm?.toLowerCase().includes(q) ||
          r.picAktif?.toLowerCase().includes(q) ||
          r.noFstb?.toLowerCase().includes(q) ||
          r.noTtb?.toLowerCase().includes(q) ||
          r.noSpp?.toLowerCase().includes(q) ||
          r.statusBadge?.toLowerCase().includes(q) ||
          r.statusPenjelasan?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [procurementData, selectedEntity, selectedLapse, searchKeyword]);

  // Filtered armada dataset matching search and entity
  const filteredArmada = useMemo(() => {
    let list = [...armadaData];

    // Entity Filter
    if (selectedEntity !== 'ALL') {
      list = list.filter((r) => r.entity?.trim().toUpperCase() === selectedEntity);
    }

    // Search Keyword
    if (searchKeyword.trim() !== '') {
      const q = searchKeyword.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.fpb?.toLowerCase().includes(q) ||
          r.armada?.toLowerCase().includes(q) ||
          r.item?.toLowerCase().includes(q) ||
          r.keterangan?.toLowerCase().includes(q) ||
          r.kodeBarang?.toLowerCase().includes(q) ||
          r.picCheckFpb?.toLowerCase().includes(q) ||
          r.noPo?.toLowerCase().includes(q) ||
          r.noFstb?.toLowerCase().includes(q) ||
          r.noTtb?.toLowerCase().includes(q) ||
          r.satuan?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q) ||
          r.entity?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [armadaData, selectedEntity, searchKeyword]);

  // Count critical items
  const criticalCount = useMemo(() => {
    return procurementData.filter((r) => r.lapse > 5).length;
  }, [procurementData]);

  // Handlers
  const handleExportCsv = () => {
    if (procurementData.length === 0) {
      showToast('Tidak ada data untuk diekspor. Silakan unggah file Excel terlebih dahulu.', 'warning');
      return;
    }

    let csv =
      'NO_FPB,ENTITAS,NO_PO,TANGGAL,DESKRIPSI_BARANG,PERUNTUKAN,LAPSE_DAY,STATUS_BERKAS,PIC_CHECK_FPB,PIC_PURCHASING,PIC_TTB,PIC_LAPANGAN,PIC_AKTIF\n';
    procurementData.forEach((r) => {
      csv += `"${r.fpb}","${r.entity}","${r.po}","${r.date}","${r.item}","${r.peruntukan}","${r.lapse}","${r.statusBadge}","${r.picCheckFpb || '-'}","${r.picPch}","${r.picTtb}","${r.picLap}","${r.picAktif}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPG_Procurement_Monitoring_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('File CSV berhasil diunduh.', 'success');
  };

  const handleExportInventoryCsv = () => {
    if (!inventoryItems || inventoryItems.length === 0) {
      showToast('Tidak ada data persediaan stok untuk diekspor.', 'warning');
      return;
    }

    let csv = 'KODE_BARANG,NAMA_BARANG,KUANTITAS,HARGA_SATUAN,KATEGORI,PERUSAHAAN\n';
    inventoryItems.forEach((item) => {
      csv += `"${item.itemCode || ''}","${(item.description || '').replace(/"/g, '""')}","${item.quantity || 0}","${item.unitPrice || 0}","${item.category || '-'}","${item.perusahaan || '-'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPG_Stok_Accurate_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('File CSV persediaan stok berhasil diunduh.', 'success');
  };

  const handleInventoryUpload = (items: InventoryItem[], summary?: InventorySummary) => {
    setInventoryItems(items);
    if (summary) setInventorySummary(summary);
    saveStoredInventory(items, summary || null);
  };

  const handleScopedReset = async (scope: ResetScope) => {
    if (scope === 'all') {
      setSelectedEntity('ALL');
      setSelectedLapse('ALL');
      setSearchKeyword('');
      setProcurementData([]);
      setArmadaData([]);
      setInventoryItems([]);
      setInventorySummary(null);
      await clearStoredData('all');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('CPG_LAST_SYNC_TIME');
        localStorage.removeItem('CPG_LAST_EFPB_FILES_SYNC_TIME');
        localStorage.removeItem('CPG_EFPB_FULL_SYNC_COUNT');
      }
      showToast('Seluruh data dashboard berhasil dikosongkan total untuk mode uji coba.', 'info');
    } else if (scope === 'procurement') {
      setProcurementData([]);
      setArmadaData([]);
      await clearStoredData('procurement');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('CPG_LAST_SYNC_TIME');
        localStorage.removeItem('CPG_LAST_EFPB_FILES_SYNC_TIME');
      }
      showToast('Data pengadaan & layanan armada berhasil dikosongkan.', 'info');
    } else if (scope === 'inventory') {
      setInventoryItems([]);
      setInventorySummary(null);
      await clearStoredData('inventory');
      showToast('Data persediaan stok Accurate berhasil dikosongkan.', 'info');
    }
  };

  const handleResetData = () => {
    handleScopedReset('all');
  };

  const handleExcelUpload = (payload: { procurement: ProcurementItem[]; armada: ArmadaItem[] }) => {
    // Smart Merge: menggabungkan data lama & baru secara cerdas tanpa menghapus data yang sudah ada
    const { merged: mergedProc } = mergeProcurementDatasets(
      procurementData,
      payload.procurement || []
    );

    let mergedArm = armadaData;
    if (payload.armada && payload.armada.length > 0) {
      const armResult = mergeArmadaDatasets(armadaData, payload.armada);
      mergedArm = armResult.merged;
    }

    // Cross-enrichment data yang digabungkan agar selalu sinkron dan konsisten
    const enriched = enrichProcurementAndArmada(mergedProc, mergedArm, workOrderItems);

    setProcurementData(enriched.procurement);
    setArmadaData(enriched.armada);

    // Simpan ke IndexedDB (kapasitas besar, tidak terbatas kuota 5MB localStorage)
    saveStoredProcurement(enriched.procurement);
    if (enriched.armada.length > 0) {
      saveStoredArmada(enriched.armada);
    }
  };

  const handleNewRecordSubmit = (item: ProcurementItem) => {
    setProcurementData((prev) => {
      const updated = [item, ...prev];
      saveStoredProcurement(updated);
      return updated;
    });
    showToast(`Berkas ${item.fpb} berhasil ditambahkan ke antrian monitoring.`, 'success');
  };

  // Callback saat nomor Work Order terdeteksi dari parsing PDF e-FPB
  const handleUpdateWorkOrderNo = (fpb: string, woNo: string) => {
    if (!fpb || !woNo) return;
    const fpbKey = normalizeFpbKey(fpb);
    let procChanged = false;
    let armChanged = false;

    setProcurementData((prevProc) => {
      const nextProc = prevProc.map((p) => {
        if (normalizeFpbKey(p.fpb) === fpbKey && p.workOrderNo !== woNo) {
          procChanged = true;
          return { ...p, workOrderNo: woNo };
        }
        return p;
      });
      if (procChanged) {
        saveStoredProcurement(nextProc);
      }
      return nextProc;
    });

    setArmadaData((prevArm) => {
      const nextArm = prevArm.map((a) => {
        if (normalizeFpbKey(a.fpb) === fpbKey && a.workOrderNo !== woNo) {
          armChanged = true;
          return { ...a, workOrderNo: woNo };
        }
        return a;
      });
      if (armChanged) {
        saveStoredArmada(nextArm);
      }
      return nextArm;
    });
  };

  const triggerAiBottleneckAudit = () => {
    if (procurementData.length === 0) {
      showToast('Belum ada data untuk dilihat detailnya. Silakan unggah file Excel.', 'warning');
      return;
    }
    showToast(
      'Memindai seluruh antrian berkas... Menampilkan berkas dengan status kritis (>5 hari).',
      'info'
    );
    setActiveTab('procurement');
    setSelectedLapse('CRITICAL');
  };

  // Efek guard hak akses Admin Settings & Batasan Visitor (Overview & Foto Dokumen)
  useEffect(() => {
    if (isVisitor && activeTab !== 'overview' && activeTab !== 'galeri-ttb' && activeTab !== 'timemark') {
      setActiveTab('overview');
    } else if (!isAdmin && activeTab === 'admin-settings') {
      setActiveTab('overview');
    }
  }, [isVisitor, isAdmin, activeTab]);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    showToast(
      nextState ? 'Sidebar navigasi disembunyikan.' : 'Sidebar navigasi ditampilkan.',
      'info'
    );
  };

  // Proteksi Akses & Tampilan Login
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center selection:bg-primary selection:text-primary-foreground">
        <div className="size-9 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground mt-3 font-mono tracking-wide">
          Memuat CPG Command Center Balikpapan...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* Left Navigation Sidebar running from top to bottom (Studio Admin Style) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedLapse={selectedLapse}
        onSelectLapse={setSelectedLapse}
        totalCount={procurementData?.length ?? 0}
        criticalCount={criticalCount}
        inventoryCount={inventoryItems?.length ?? 0}
        kapalPosisiCount={kapalPosisiItems.length}
        workOrderCount={workOrderItems.length}
        serviceMaintenanceCount={smItems.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onOpenNewRecord={() => setIsNewRecordOpen(true)}
        onExcelUpload={handleExcelUpload}
        showToast={showToast}

      />

      {/* Right Column: Header Bar + Main Content Area + Footer */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header
          searchKeyword={searchKeyword}
          onSearch={setSearchKeyword}
          onExcelUpload={handleExcelUpload}
          onExportCsv={handleExportCsv}
          onResetData={handleResetData}
          onScopedReset={handleScopedReset}
          showToast={showToast}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          procurementData={procurementData}
          armadaData={armadaData}
          inventoryItems={inventoryItems}
          onInventoryUpload={handleInventoryUpload}
          onInventoryExport={handleExportInventoryCsv}
          onRefreshPosisiKapal={handleRefreshPosisiKapal}
          isSyncingPosisiKapal={isLoadingPosisiKapal}
          kapalPosisiCount={kapalPosisiItems.length}
          onNavigateTab={setActiveTab}
        />


        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-8 space-y-4 sm:space-y-6 max-w-[1800px] w-full mx-auto pb-24 lg:pb-8">
          {/* Page Header in clean Studio Admin typography */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                {activeTab === 'overview'
                  ? 'Monitoring Logistik'
                  : activeTab === 'procurement'
                  ? 'Monitoring Berkas Pengadaan'
                  : activeTab === 'armada'
                  ? 'Monitoring Layanan Armada'
                  : activeTab === 'galeri-ttb'
                  ? 'Galeri Foto TTB'
                  : activeTab === 'timemark'
                  ? 'Dokumentasi Foto TimeMark'
                  : activeTab === 'pos-kapal'
                  ? 'Posisi Kapal'
                  : activeTab === 'work-order'
                  ? 'Monitoring Work Order (WO)'
                  : activeTab === 'list-sm'
                  ? 'Monitoring Service & Maintenance (SM) Vendor'
                  : activeTab === 'inventory'
                  ? 'Cek Stok Persediaan Gudang'
                  : activeTab === 'admin-settings'
                  ? 'Pengaturan Administrator & Pengguna'
                  : 'Analisis SLA & Lead Time'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isVisitor && activeTab === 'overview'
                  ? 'Mode Peninjauan Tamu: Silakan masukkan No. FPB, Nama Kapal, atau No. PO pada kolom pencarian di bawah untuk menampilkan data.'
                  : activeTab === 'overview'
                  ? 'Pemantauan terpadu alur pengadaan barang, perputaran berkas fisik divisi, distribusi logistik armada kapal, dan status stok persediaan.'
                  : activeTab === 'procurement'
                  ? 'Daftar transaksi pengadaan PO, verifikasi berkas fisik antar divisi, dan status penyelesaian berkas.'
                  : activeTab === 'armada'
                  ? 'Rekonsiliasi FPB–FSTB & Distribusi Logistik'
                  : activeTab === 'galeri-ttb'
                  ? 'Galeri foto penerimaan dan serah terima dokumen fisik TTB dari server terpusat & Vercel Blob.'
                  : activeTab === 'timemark'
                  ? 'Verifikasi dokumentasi bukti foto fisik lapangan TimeMark dengan pencarian 5 digit nomor FSTB.'
                  : activeTab === 'pos-kapal'
                  ? 'Laporan posisi, rute, aktivitas, status armada dan pekerjaan pemeliharaan kapal.'
                  : activeTab === 'work-order'
                  ? 'Rekap dan Validasi WO Armada'
                  : activeTab === 'list-sm'
                  ? 'Pelacakan pekerjaan jasa perbaikan mesin kapal, bubut, servis bengkel rekanan (Karindo, Surabaya Teknik, Sidomukti, Panca Teknik, Tjokro), dan integrasi FPB-PO.'
                  : activeTab === 'inventory'
                  ? 'Pemeriksaan stok barang konsolidasi Accurate (CPL, Hana Lines, Mandar Ocean) & pencocokan kebutuhan pengadaan.'
                  : activeTab === 'admin-settings'
                  ? 'Kelola akun operasional staf purchasing (User) dan akun tamu/peninjau (Visitor). Tambahkan pengguna baru dan konfigurasi wewenang hak akses.'
                  : 'Distribusi waktu perputaran berkas fisik (lead time) dan beban kerja produktivitas staf PIC operasional.'}
              </p>
            </div>

            {/* Tombol Sembunyikan Ringkasan Metrik KPI */}
            {activeTab !== 'inventory' && activeTab !== 'pos-kapal' && activeTab !== 'work-order' && activeTab !== 'list-sm' && activeTab !== 'admin-settings' && (!isVisitor || searchKeyword.trim() !== '') && (
              <button
                type="button"
                onClick={toggleKpiHidden}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-border bg-card hover:bg-muted transition shadow-xs self-start sm:self-auto shrink-0 cursor-pointer"
                title={isKpiHidden ? 'Tampilkan Ringkasan Metrik' : 'Sembunyikan Ringkasan Metrik'}
              >
                <span>{isKpiHidden ? 'Tampilkan Ringkasan' : 'Sembunyikan Ringkasan'}</span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    isKpiHidden ? '-rotate-90' : ''
                  }`}
                />
              </button>
            )}
          </div>

          {/* 4 Pillar Executive Metric Cards (procurement tabs only) */}
          {activeTab !== 'inventory' && activeTab !== 'pos-kapal' && activeTab !== 'work-order' && activeTab !== 'list-sm' && activeTab !== 'admin-settings' && !isKpiHidden && (!isVisitor || searchKeyword.trim() !== '') && (
            <div className="animate-in fade-in-50 duration-200">
              <KpiCards
                procurementList={filteredProcurement}
                armadaList={filteredArmada}
              />
            </div>
          )}

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <OverviewTab
              items={filteredProcurement}
              totalAllItems={procurementData.length}
              searchKeyword={searchKeyword}
              onSearchKeywordChange={setSearchKeyword}
              onOpenAudit={handleOpenAudit}
              onTriggerAiAudit={triggerAiBottleneckAudit}
              showToast={showToast}
            />
          )}

          {/* Tab 2: Procurement (Sheet 1) */}
          {activeTab === 'procurement' && (
            <ProcurementTab
              items={filteredProcurement}
              totalAllItems={procurementData.length}
              searchKeyword={searchKeyword}
              onSearchKeywordChange={setSearchKeyword}
              onOpenNewRecord={() => setIsNewRecordOpen(true)}
              onOpenAudit={handleOpenAudit}
              showToast={showToast}
            />
          )}

          {/* Tab 3: Armada (Sheet 2) */}
          {activeTab === 'armada' && (
            <ArmadaTab
              items={filteredArmada}
              searchKeyword={searchKeyword}
              onSearchKeywordChange={setSearchKeyword}
              onOpenAudit={handleOpenAudit}
              initialEntity={selectedEntity}
              showToast={showToast}
            />
          )}

          {/* Tab Posisi Kapal (FMS Daily Report) */}
          {activeTab === 'pos-kapal' && (
            <PosisiKapalTab
              items={kapalPosisiItems}
              summary={kapalPosisiSummary}
              isLoading={isLoadingPosisiKapal}
              onRefresh={handleRefreshPosisiKapal}
              showToast={showToast}
            />
          )}

          {/* Tab Work Order (Form Responses 1 Google Sheets) */}
          {activeTab === 'work-order' && (
            <WorkOrderTab
              items={workOrderItems}
              summary={workOrderSummary}
              isLoading={isLoadingWorkOrder}
              onRefresh={handleSyncWorkOrder}
              onOpenAudit={handleOpenAudit}
              showToast={showToast}
            />
          )}

          {/* Tab List SM: Service & Maintenance Bengkel/Vendor (Google Sheets) */}
          {activeTab === 'list-sm' && (
            <ServiceMaintenanceTab
              items={smItems}
              summary={smSummary}
              isLoading={isLoadingSm}
              onRefreshAll={handleSyncSm}
              onUploadExcel={handleUploadSmExcel}
              onOpenAudit={handleOpenAudit}
              vendorConfigs={smVendors}
              onSaveVendorConfigs={handleSaveSmVendors}
              showToast={showToast}
            />
          )}

          {/* Tab Galeri Seluruh Foto TTB (Vercel Blob / Server) */}
          {activeTab === 'galeri-ttb' && (
            <TtbGalleryTab showToast={showToast} />
          )}


          {/* Tab TimeMark: Dokumentasi & Bukti Foto */}
          {activeTab === 'timemark' && (
            <TimemarkTab
              armadaItems={armadaData}
              procurementItems={procurementData}
              onOpenAudit={handleOpenAudit}
              showToast={showToast}
            />
          )}

          {/* Tab 4: Analytics */}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              items={filteredProcurement}
              onSyncSheets={handleSyncGoogleSheets}
              isSyncingSheets={isSyncingSheets}
            />
          )}

          {/* Tab 5: Inventory / Cek Persediaan (Sheet Accurate) */}
          {activeTab === 'inventory' && (
            <InventoryTab
              items={inventoryItems}
              summary={inventorySummary}
              isLoading={isLoadingInventory}
              procurementItems={procurementData}
              armadaItems={armadaData}
              onUpdateInventory={(newItems, newSummary) => {
                setInventoryItems(newItems);
                if (newSummary) setInventorySummary(newSummary);
              }}
              onLoadSampleInventory={handleLoadSampleInventory}
              showToast={showToast}
            />
          )}

          {/* Tab 6: Admin Settings - Manajemen Pengguna & Visitor */}
          {activeTab === 'admin-settings' && (
            <AdminSettingsTab showToast={showToast} />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto bg-card border-t border-border px-4 sm:px-5 lg:px-8 py-3.5 text-xs text-muted-foreground mb-16 lg:mb-0">
          <div className="max-w-[1850px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <div>
              <p className="text-foreground font-medium text-xs">
                PT Cindara Pratama Lines &bull; CPG Holding Procurement System
              </p>
              <p className="text-[11px] text-muted-foreground">
                Pusat Operasional Somber & Kariangau, Balikpapan, Kalimantan Timur
              </p>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="text-muted-foreground">
                Security: <strong className="text-emerald-700 dark:text-emerald-400 font-medium">Encrypted Local Sandbox</strong>
              </span>
              <span className="text-border">|</span>
              <span className="text-muted-foreground">CPG Enterprise Dashboard &bull; Next.js</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalCount={procurementData.length}
        criticalCount={criticalCount}
        onOpenSidebar={() => setIsSidebarCollapsed(false)}
      />

      {/* Audit Modal */}
      {auditedFpb && (
        <AuditModal
          fpbNumber={auditedFpb}
          targetPo={auditedPo}
          procurementList={procurementData}
          armadaList={armadaData}
          inventoryItems={inventoryItems}
          onClose={() => {
            setAuditedFpb(null);
            setAuditedPo(null);
          }}
          showToast={showToast}
          onUpdateWorkOrderNo={handleUpdateWorkOrderNo}
        />
      )}

      {/* New Record Modal */}
      <NewRecordModal
        isOpen={isNewRecordOpen}
        onClose={() => setIsNewRecordOpen(false)}
        onSubmit={handleNewRecordSubmit}
      />

      {/* Toast Notification */}
      <ToastNotification toast={toast} />
    </div>
  );
}
