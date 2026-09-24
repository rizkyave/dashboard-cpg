'use client';

import React, { useState, useMemo } from 'react';
import {
  EntityCode,
  LapseFilterType,
  TabType,
  ProcurementItem,
  ArmadaItem,
  ToastState,
} from '@/types/procurement';
import { INITIAL_PROCUREMENT_DATA, INITIAL_ARMADA_DATA } from '@/data/initialData';
import Header from '@/components/Header';
import EntityFilterBar from '@/components/EntityFilterBar';
import Sidebar from '@/components/Sidebar';
import KpiCards from '@/components/KpiCards';
import OverviewTab from '@/components/OverviewTab';
import ProcurementTab from '@/components/ProcurementTab';
import ArmadaTab from '@/components/ArmadaTab';
import AnalyticsTab from '@/components/AnalyticsTab';
import AuditModal from '@/components/AuditModal';
import NewRecordModal from '@/components/NewRecordModal';
import ToastNotification from '@/components/ToastNotification';
import { PanelLeftOpen } from 'lucide-react';

export default function DashboardPage() {
  // Data dimulai dalam kondisi kosong agar pengguna dapat melakukan pengujian unggah file Excel sendiri
  const [procurementData, setProcurementData] = useState<ProcurementItem[]>(
    INITIAL_PROCUREMENT_DATA
  );
  const [armadaData, setArmadaData] = useState<ArmadaItem[]>(INITIAL_ARMADA_DATA);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedEntity, setSelectedEntity] = useState<EntityCode>('ALL');
  const [selectedLapse, setSelectedLapse] = useState<LapseFilterType>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

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
      'NO_FPB,ENTITAS,NO_PO,TANGGAL,DESKRIPSI_BARANG,PERUNTUKAN,LAPSE_DAY,STATUS_BERKAS,PIC_PURCHASING,PIC_TTB,PIC_LAPANGAN,PIC_AKTIF\n';
    procurementData.forEach((r) => {
      csv += `"${r.fpb}","${r.entity}","${r.po}","${r.date}","${r.item}","${r.peruntukan}","${r.lapse}","${r.statusBadge}","${r.picPch}","${r.picTtb}","${r.picLap}","${r.picAktif}"\n`;
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
      showToast('Belum ada data untuk diaudit. Silakan unggah file Excel.', 'warning');
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
    <div className="flex flex-col min-h-screen relative overflow-x-hidden">
      {/* Header with Sidebar Toggle Button */}
      <Header
        searchKeyword={searchKeyword}
        onSearch={setSearchKeyword}
        onExcelUpload={handleExcelUpload}
        onExportCsv={handleExportCsv}
        onResetData={handleResetData}
        showToast={showToast}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      {/* Entity Selection Bar */}
      <EntityFilterBar
        selectedEntity={selectedEntity}
        onSelectEntity={(code) => {
          setSelectedEntity(code);
          showToast(`Menampilkan data entitas: ${code}`, 'info');
        }}
      />

      {/* Main Layout: Left Sidebar + Right Content Area */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1850px] mx-auto relative">
        {/* Left Navigation Sidebar with Smooth CSS Transition */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          selectedLapse={selectedLapse}
          onSelectLapse={setSelectedLapse}
          totalCount={procurementData.length}
          criticalCount={criticalCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Right Content Area with Smooth Width Transition */}
        <main className="flex-1 min-w-0 p-4 lg:p-7 space-y-6 transition-all duration-300 ease-in-out">
          {/* Smooth Fade & Slide Banner for Quick Reopen when Collapsed */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isSidebarCollapsed
                ? 'max-h-16 opacity-100 mb-2 translate-y-0'
                : 'max-h-0 opacity-0 mb-0 -translate-y-2 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <button
                onClick={toggleSidebar}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-2 transition-all duration-200 shadow-lg shadow-cyan-950/40 group hover:scale-[1.02] active:scale-95"
              >
                <PanelLeftOpen className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Buka Menu Navigasi Samping</span>
              </button>
              <span className="text-[11px] text-slate-500 font-mono">
                &bull; Mode Layar Penuh Aktif
              </span>
            </div>
          </div>

          {/* 4 Pillar Executive Metric Cards (strictly filtered to active search & entity) */}
          <KpiCards
            procurementList={filteredProcurement}
            armadaList={filteredArmada}
          />

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <OverviewTab
              items={filteredProcurement}
              totalAllItems={procurementData.length}
              searchKeyword={searchKeyword}
              onSearchKeywordChange={setSearchKeyword}
              onOpenAudit={handleOpenAudit}
              onTriggerAiAudit={triggerAiBottleneckAudit}
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
            />
          )}

          {/* Tab 4: Analytics */}
          {activeTab === 'analytics' && <AnalyticsTab items={filteredProcurement} />}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto bg-[#070b16] border-t border-slate-800/80 px-4 lg:px-8 py-4 text-xs text-slate-400">
        <div className="max-w-[1850px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <div>
            <p className="text-slate-300 font-semibold">
              PT Cindara Pratama Lines &bull; CPG Holding Procurement System
            </p>
            <p className="text-[11px] text-slate-500">
              Pusat Operasional Somber & Kariangau, Balikpapan, Kalimantan Timur
            </p>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="text-slate-400">
              Security: <strong className="text-emerald-400">Encrypted Local Sandbox</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400">Powered by Gemini 3 Flash Architecture &bull; Next.js</span>
          </div>
        </div>
      </footer>

      {/* Audit Modal */}
      <AuditModal
        fpbNumber={auditedFpb}
        targetPo={auditedPo}
        procurementList={procurementData}
        armadaList={armadaData}
        onClose={() => {
          setAuditedFpb(null);
          setAuditedPo(null);
        }}
        showToast={showToast}
      />

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
