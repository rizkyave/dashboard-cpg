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
} from '@/types/procurement';
import { INITIAL_PROCUREMENT_DATA, INITIAL_ARMADA_DATA } from '@/data/initialData';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import KpiCards from '@/components/KpiCards';
import OverviewTab from '@/components/OverviewTab';
import ProcurementTab from '@/components/ProcurementTab';
import ArmadaTab from '@/components/ArmadaTab';
import AnalyticsTab from '@/components/AnalyticsTab';
import InventoryTab from '@/components/InventoryTab';
import TimemarkTab from '@/components/TimemarkTab';
import AuditModal from '@/components/AuditModal';
import NewRecordModal from '@/components/NewRecordModal';
import ToastNotification from '@/components/ToastNotification';
import { PanelLeftOpen } from 'lucide-react';

export default function DashboardPage() {
  // Data dimulai dalam kondisi kosong agar pengguna dapat melakukan pengujian unggah file Excel sendiri setiap kali refresh
  const [procurementData, setProcurementData] = useState<ProcurementItem[]>(
    INITIAL_PROCUREMENT_DATA
  );
  const [armadaData, setArmadaData] = useState<ArmadaItem[]>(INITIAL_ARMADA_DATA);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedEntity, setSelectedEntity] = useState<EntityCode>('ALL');
  const [selectedLapse, setSelectedLapse] = useState<LapseFilterType>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // State untuk modul persediaan barang (Accurate) - dimulai kosong agar pengguna dapat menguji unggah file Excel setiap kali refresh
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);

  // Fungsi untuk memuat contoh data persediaan default jika diinginkan oleh pengguna
  const handleLoadSampleInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success && data.items) {
        setInventoryItems(data.items);
        if (data.summary) setInventorySummary(data.summary);
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

  const handleResetData = () => {
    setSelectedEntity('ALL');
    setSelectedLapse('ALL');
    setSearchKeyword('');
    setProcurementData([]);
    setArmadaData([]);
    setInventoryItems([]);
    setInventorySummary(null);
    showToast('Seluruh data berhasil dikosongkan. Siap untuk unggah file Excel baru.', 'info');
  };

  const handleExcelUpload = (payload: { procurement: ProcurementItem[]; armada: ArmadaItem[] }) => {
    setProcurementData(payload.procurement);
    if (payload.armada && payload.armada.length > 0) {
      setArmadaData(payload.armada);
    }
  };

  const handleNewRecordSubmit = (item: ProcurementItem) => {
    setProcurementData((prev) => [item, ...prev]);
    showToast(`Berkas ${item.fpb} berhasil ditambahkan ke antrian monitoring.`, 'success');
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

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    showToast(
      nextState ? 'Sidebar navigasi disembunyikan.' : 'Sidebar navigasi ditampilkan.',
      'info'
    );
  };

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
          showToast={showToast}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          inventoryItems={inventoryItems}
          onInventoryUpload={(items, summary) => {
            setInventoryItems(items);
            if (summary) setInventorySummary(summary);
          }}
        />

        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-8 space-y-4 sm:space-y-6 max-w-[1800px] w-full mx-auto pb-24 lg:pb-8">
          {/* Page Header in clean Studio Admin typography */}
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              {activeTab === 'overview'
                ? 'Pipeline Overview'
                : activeTab === 'procurement'
                ? 'Monitoring Berkas Pengadaan'
                : activeTab === 'armada'
                ? 'Monitoring Layanan Armada'
                : activeTab === 'inventory'
                ? 'Cek Stok Persediaan Gudang'
                : 'Analisis SLA & Lead Time'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {activeTab === 'overview'
                ? 'Keep tabs on lead quality, open opportunities, and conversion rates across the current sales cycle.'
                : activeTab === 'procurement'
                ? 'Daftar transaksi pengadaan PO, verifikasi berkas fisik antar divisi, dan status penyelesaian berkas.'
                : activeTab === 'armada'
                ? 'Pencocokan kuantitas FPB vs FSTB, unit kapal armada, dan realisasi distribusi logistik lapangan.'
                : activeTab === 'inventory'
                ? 'Pemeriksaan stok barang konsolidasi Accurate (CPL, Hana Lines, Mandar Ocean) & pencocokan kebutuhan pengadaan.'
                : 'Distribusi waktu perputaran berkas fisik (lead time) dan beban kerja produktivitas staf PIC operasional.'}
            </p>
          </div>

          {/* 4 Pillar Executive Metric Cards (procurement tabs only) */}
          {activeTab !== 'inventory' && (
            <KpiCards
              procurementList={filteredProcurement}
              armadaList={filteredArmada}
            />
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
          {activeTab === 'analytics' && <AnalyticsTab items={filteredProcurement} />}

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
