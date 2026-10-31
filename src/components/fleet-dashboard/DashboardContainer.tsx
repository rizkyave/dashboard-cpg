'use client';

import React, { useState, useMemo, useRef } from 'react';
import { GlobalFilterState, KPIMetrics, ArmadaDataPoint, MonthlyTrendPoint } from './types';
import REAL_FLEET_DATA from '@/data/realFleetData.json';
import {
  TOP_FLEET_COLORS,
  MONTH_NAMES_ID,
  normalizeArmadaName,
  isMarineArmada,
  parseDateObj,
} from './utils';

import GlobalFilterBar from './GlobalFilterBar';
import KPISummary from './KPISummary';
import TopArmadaDonutChart from './TopArmadaDonutChart';
import TopArmadaDemandBar from './TopArmadaDemandBar';
import MonthlyTrendChart from './MonthlyTrendChart';
import OperationalSummaryWidget from './OperationalSummaryWidget';
import ArmadaGanttSchedule from './ArmadaGanttSchedule';
import RemainderArmadaModal from './RemainderArmadaModal';
import ExecutiveTalkingPoints from './ExecutiveTalkingPoints';

interface DashboardContainerProps {
  items?: any[];
  onOpenAudit?: (item: any) => void;
  initialMonth?: string;
  initialYear?: string;
  selectedArmadaProp?: string | null;
  onSelectArmadaProp?: (armadaName: string | null) => void;
}

export default function DashboardContainer({
  items,
  onOpenAudit,
  initialMonth = '10', // Default: Oktober 2026
  initialYear = '2026',
  selectedArmadaProp,
  onSelectArmadaProp,
}: DashboardContainerProps) {
  const ganttRef = useRef<HTMLDivElement>(null);
  const [isRemainderModalOpen, setIsRemainderModalOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  // ==========================================================================
  // 1. STATE MANAJEMEN & FILTER GLOBAL TERPUSAT (Single Source of Truth)
  // ==========================================================================
  const [filterState, setFilterState] = useState<GlobalFilterState>({
    tahun: initialYear,
    bulan: initialMonth,
    entitas: 'ALL',
    selectedArmadaId: selectedArmadaProp && selectedArmadaProp !== 'ALL' ? selectedArmadaProp : null,
    statusFilter: 'ALL',
    searchTerm: '',
    focusTop12Only: true, // Default: Fokus 12 Besar Murni (Skala 100%)
    fleetTypeFilter: 'ALL', // 'ALL' | 'MARINE' | 'OFFICE_SITE'
  });

  // Sinkronisasi jika prop armada dari luar berubah
  React.useEffect(() => {
    if (selectedArmadaProp !== undefined) {
      const nextId = !selectedArmadaProp || selectedArmadaProp === 'ALL' ? null : selectedArmadaProp;
      setFilterState((prev) => {
        if (prev.selectedArmadaId === nextId) return prev;
        return {
          ...prev,
          selectedArmadaId: nextId,
        };
      });
    }
  }, [selectedArmadaProp]);

  const handleFilterChange = (updates: Partial<GlobalFilterState>) => {
    setFilterState((prev) => {
      if (updates.selectedArmadaId !== undefined && updates.selectedArmadaId !== prev.selectedArmadaId) {
        onSelectArmadaProp?.(updates.selectedArmadaId);
      }
      return {
        ...prev,
        ...updates,
      };
    });
  };

  const handleScrollToGantt = () => {
    if (ganttRef.current) {
      ganttRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ==========================================================================
  // 2. DATA SOURCE: Menggabungkan data riil props atau fallback database kurasi
  // ==========================================================================
  const rawDataSource = useMemo(() => {
    if (items && items.length > 0) return items;

    const expanded: any[] = [];
    (REAL_FLEET_DATA as any[]).forEach((v) => {
      (v.sampleItems || []).forEach((item: any, idx: number) => {
        const col = item.startCol !== undefined ? item.startCol : (idx % 20);
        const mOffset = Math.floor(col / 4); // 0=Jun, 1=Jul, 2=Agu, 3=Sep, 4=Okt
        const mStr = String(6 + Math.min(4, Math.max(0, mOffset))).padStart(2, '0');
        const dStr = String(1 + (col % 4) * 7).padStart(2, '0');
        expanded.push({
          armada: v.name,
          entity: v.tag,
          fpb: item.fpb,
          item: item.item,
          qtyFPB: item.qtyFpb || 1,
          qtyFSTB: item.status === 'LENGKAP' ? 1 : 0,
          selisih: item.status === 'LENGKAP' ? 0 : 1,
          status: item.status,
          date: `2026-${mStr}-${dStr}`,
          tglFpb: `${dStr}/${mStr}/2026`,
          noPo: `PO-26-0${1000 + idx}`,
        });
      });
    });
    return expanded;
  }, [items]);

  // ==========================================================================
  // 3. FILTERING DINAMIS REAL-TIME DENGAN NORMALISASI PENAMAAN
  // ==========================================================================
  const filteredData = useMemo(() => {
    return rawDataSource.filter((it) => {
      // 1. Normalisasi nama armada
      const rawName = (it.armada || (it as any).deptArmada || '').trim();
      if (!rawName || rawName === '-' || rawName.length < 2) return false;

      // 2. Filter Entitas
      if (filterState.entitas !== 'ALL') {
        const ent = (it.entity || '').trim().toUpperCase();
        if (ent && ent !== filterState.entitas.toUpperCase()) {
          return false;
        }
      }

      // 3. Filter Periode Bulan & Tahun
      const dateVal = it.tglFpb || it.date || it.tglPo || it.tglFstb;
      const d = parseDateObj(dateVal);

      if (d) {
        if (filterState.tahun !== 'ALL') {
          if (String(d.getFullYear()) !== filterState.tahun) return false;
        }
        if (filterState.bulan !== 'ALL') {
          const mStr = String(d.getMonth() + 1).padStart(2, '0');
          if (mStr !== filterState.bulan) return false;
        }
      } else {
        if (filterState.bulan !== 'ALL' && filterState.bulan !== '10') {
          return false;
        }
      }

      // 4. Filter Status
      if (filterState.statusFilter !== 'ALL') {
        const statusUpper = (it.status || '').toUpperCase();
        const qFpb = Number(it.qtyFPB) || 0;
        const qFstb = Number(it.qtyFSTB) || 0;
        const qSel = it.selisih !== undefined ? Number(it.selisih) : Math.max(0, qFpb - qFstb);

        const isComp = statusUpper.includes('LENGKAP') || statusUpper.includes('CLOSE') || statusUpper.includes('SELESAI') || (qSel === 0 && qFstb > 0);
        const isPart = !isComp && (statusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0));
        const isBacklog = !isComp && (statusUpper.includes('BACKLOG') || statusUpper.includes('KRITIS') || (qFstb === 0 && qSel > 0));

        if (filterState.statusFilter === 'LENGKAP' && !isComp) return false;
        if (filterState.statusFilter === 'PROSES' && (isComp || isPart || isBacklog)) return false;
        if (filterState.statusFilter === 'PARSIAL' && !isPart) return false;
        if (filterState.statusFilter === 'BACKLOG' && !isBacklog) return false;
      }

      // 5. Filter Search Term
      if (filterState.searchTerm.trim() !== '') {
        const q = filterState.searchTerm.toLowerCase().trim();
        const norm = normalizeArmadaName(rawName).toLowerCase();
        const match =
          norm.includes(q) ||
          (it.fpb && it.fpb.toLowerCase().includes(q)) ||
          (it.item && it.item.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [rawDataSource, filterState]);

  // ==========================================================================
  // 4. AGREGASI DONUT CHART: TOP 12 ARMADA + "ARMADA LAINNYA" (Total 100%)
  // ==========================================================================
  const { topArmadas, totalFpbPeriod, remainderArmadas, totalFpbAllArmadas } = useMemo(() => {
    // Saring berdasarkan tipe unit: Kapal Saja vs Semua
    let dataForFleet = filteredData;
    if (filterState.fleetTypeFilter === 'MARINE') {
      dataForFleet = dataForFleet.filter((it) => isMarineArmada(it.armada || (it as any).deptArmada));
    } else if (filterState.fleetTypeFilter === 'OFFICE_SITE') {
      dataForFleet = dataForFleet.filter((it) => !isMarineArmada(it.armada || (it as any).deptArmada));
    }

    const vesselMap = new Map<string, {
      id: string;
      name: string;
      tag: string;
      fpbs: Set<string>;
      qtyFPB: number;
      qtyFSTB: number;
      backlogQty: number;
      items: any[];
    }>();

    for (const it of dataForFleet) {
      const rawName = (it.armada || (it as any).deptArmada || '').trim();
      const normName = normalizeArmadaName(rawName);

      let tag = it.entity?.trim().toUpperCase() || '';
      if (!tag || tag === 'ALL' || tag.length > 5) {
        if (it.fpb && it.fpb.includes('-')) {
          tag = it.fpb.split('-')[0].trim().toUpperCase();
        }
      }
      if (!tag) tag = 'CPL';

      let entry = vesselMap.get(normName);
      if (!entry) {
        entry = {
          id: normName,
          name: normName,
          tag,
          fpbs: new Set(),
          qtyFPB: 0,
          qtyFSTB: 0,
          backlogQty: 0,
          items: [],
        };
        vesselMap.set(normName, entry);
      }

      if (it.fpb) entry.fpbs.add(it.fpb.trim());
      const qFpb = Number(it.qtyFPB) || 0;
      const qFstb = Number(it.qtyFSTB) || 0;
      const qSel = it.selisih !== undefined ? Number(it.selisih) : Math.max(0, qFpb - qFstb);

      entry.qtyFPB += qFpb;
      entry.qtyFSTB += qFstb;
      entry.backlogQty += qSel;
      entry.items.push(it);
    }

    const allVessels = Array.from(vesselMap.values()).map((v) => ({
      ...v,
      fpbCount: Math.max(v.fpbs.size, 1),
    }));

    allVessels.sort((a, b) => b.fpbCount - a.fpbCount);

    const totalFpbAll = allVessels.reduce((acc, curr) => acc + curr.fpbCount, 0);

    const top12 = allVessels.slice(0, 12);
    const remainder = allVessels.slice(12);

    const top12Fpb = top12.reduce((acc, curr) => acc + curr.fpbCount, 0);
    const remainderFpb = remainder.reduce((acc, curr) => acc + curr.fpbCount, 0);

    const remainderList: ArmadaDataPoint[] = remainder.map((v) => ({
      id: v.id,
      name: v.name,
      normalizedName: v.name,
      tag: v.tag,
      fpbCount: v.fpbCount,
      qtyFPB: v.qtyFPB,
      qtyFSTB: v.qtyFSTB,
      backlogQty: v.backlogQty,
      percentage: totalFpbAll > 0 ? (v.fpbCount / totalFpbAll) * 100 : 0,
      color: '#64748B',
      items: v.items,
      isMarine: isMarineArmada(v.name),
    }));

    // Basis pembagi: jika fokus 12 besar = top12Fpb (100% Top 12), jika tidak = totalFpbAll
    const divisor = filterState.focusTop12Only
      ? (top12Fpb > 0 ? top12Fpb : 1)
      : (totalFpbAll > 0 ? totalFpbAll : 1);

    const list: ArmadaDataPoint[] = top12.map((v, idx) => ({
      id: v.id,
      name: v.name,
      normalizedName: v.name,
      tag: v.tag,
      fpbCount: v.fpbCount,
      qtyFPB: v.qtyFPB,
      qtyFSTB: v.qtyFSTB,
      backlogQty: v.backlogQty,
      percentage: (v.fpbCount / divisor) * 100,
      color: TOP_FLEET_COLORS[idx] || '#64748B',
      items: v.items,
      isMarine: isMarineArmada(v.name),
    }));

    // Jika TIDAK fokus 12 besar murni dan ada remainder, tambahkan irisan 'Armada Lainnya'
    if (!filterState.focusTop12Only && remainder.length > 0) {
      const remainderQtyFPB = remainder.reduce((acc, curr) => acc + curr.qtyFPB, 0);
      const remainderQtyFSTB = remainder.reduce((acc, curr) => acc + curr.qtyFSTB, 0);
      const remainderBacklog = remainder.reduce((acc, curr) => acc + curr.backlogQty, 0);
      const remainderItems = remainder.flatMap((r) => r.items);

      list.push({
        id: 'OTHERS',
        name: 'Armada Lainnya',
        normalizedName: 'Armada Lainnya',
        tag: 'OTHER',
        fpbCount: remainderFpb,
        qtyFPB: remainderQtyFPB,
        qtyFSTB: remainderQtyFSTB,
        backlogQty: remainderBacklog,
        percentage: (remainderFpb / divisor) * 100,
        color: TOP_FLEET_COLORS[12] || '#64748B',
        items: remainderItems,
      });
    }

    // KUNCI KONSISTENSI: Jika ada armada spesifik yang sedang dipilih (misal SPOB CINTIANA PRATAMA),
    // pastikan kapal tersebut SELALU masuk ke dalam `list` meskipun di bulan terpilih ia berada di peringkat 13+ (di luar top 12).
    if (
      filterState.selectedArmadaId &&
      filterState.selectedArmadaId !== 'OTHERS' &&
      filterState.selectedArmadaId !== 'Armada Lainnya'
    ) {
      const selectedArmadaName = filterState.selectedArmadaId;
      const foundIdx = allVessels.findIndex((v) => v.name === selectedArmadaName);

      if (foundIdx !== -1) {
        const found = allVessels[foundIdx];
        const isAlreadyInTop12 = foundIdx < 12;

        if (!isAlreadyInTop12) {
          list.push({
            id: found.id,
            name: found.name,
            normalizedName: found.name,
            tag: found.tag,
            fpbCount: found.fpbCount,
            qtyFPB: found.qtyFPB,
            qtyFSTB: found.qtyFSTB,
            backlogQty: found.backlogQty,
            percentage: divisor > 0 ? (found.fpbCount / divisor) * 100 : 0,
            color: '#38BDF8', // Cyan spotlight
            items: found.items,
            isMarine: isMarineArmada(found.name),
            realRank: foundIdx + 1,
          });
        }
      } else {
        // Kapal ini 0 FPB di bulan terpilih (tidak ada pengajuan sama sekali)
        list.push({
          id: selectedArmadaName,
          name: selectedArmadaName,
          normalizedName: selectedArmadaName,
          tag: 'CPL',
          fpbCount: 0,
          qtyFPB: 0,
          qtyFSTB: 0,
          backlogQty: 0,
          percentage: 0,
          color: '#38BDF8',
          items: [],
          isMarine: isMarineArmada(selectedArmadaName),
          realRank: allVessels.length + 1,
        });
      }
    }

    return {
      topArmadas: list,
      totalFpbPeriod: filterState.focusTop12Only ? top12Fpb : totalFpbAll,
      remainderArmadas: remainderList,
      totalFpbAllArmadas: totalFpbAll,
    };
  }, [filteredData, filterState.focusTop12Only, filterState.fleetTypeFilter, filterState.selectedArmadaId]);

  // ==========================================================================
  // 5. KALKULASI TREN BULANAN SINKRON DENGAN ARMADA TERPILIH / 12 BESAR
  // ==========================================================================
  const monthlyTrendData = useMemo<MonthlyTrendPoint[]>(() => {
    const monthKeys = ['06', '07', '08', '09', '10'];
    const map = new Map<string, { fpbSet: Set<string>; qFpb: number; qFstb: number }>();

    monthKeys.forEach((mk) => {
      map.set(mk, { fpbSet: new Set(), qFpb: 0, qFstb: 0 });
    });

    const top12Names = new Set(topArmadas.filter((a) => a.id !== 'OTHERS').map((a) => a.name));
    const remainderNames = new Set(remainderArmadas.map((r) => r.name));

    rawDataSource.forEach((it) => {
      const rawName = (it.armada || (it as any).deptArmada || '').trim();
      if (!rawName || rawName === '-' || rawName.length < 2) return;
      const norm = normalizeArmadaName(rawName);

      // 1. FILTER ARMADA SPESIFIK JIKA DIPILIH!
      if (filterState.selectedArmadaId) {
        if (filterState.selectedArmadaId === 'OTHERS' || filterState.selectedArmadaId === 'Armada Lainnya') {
          if (!remainderNames.has(norm)) return;
        } else {
          if (norm !== filterState.selectedArmadaId) return;
        }
      } else {
        // Jika tidak ada armada spesifik:
        // Cek filter tipe unit (Kapal Laut vs Kantor/Site)
        if (filterState.fleetTypeFilter === 'MARINE' && !isMarineArmada(norm)) {
          return;
        } else if (filterState.fleetTypeFilter === 'OFFICE_SITE' && isMarineArmada(norm)) {
          return;
        }

        // Cek fokus 12 besar
        if (filterState.focusTop12Only && !top12Names.has(norm)) {
          return;
        }
      }

      // 2. Filter entitas jika ada
      if (filterState.entitas !== 'ALL') {
        const ent = (it.entity || '').trim().toUpperCase();
        if (ent && ent !== filterState.entitas.toUpperCase()) {
          return;
        }
      }

      const d = parseDateObj(it.tglFpb || it.date || it.tglPo || it.tglFstb);
      if (!d) return;

      if (filterState.tahun !== 'ALL' && String(d.getFullYear()) !== filterState.tahun) {
        return;
      }

      const mKey = String(d.getMonth() + 1).padStart(2, '0');
      const entry = map.get(mKey);
      if (entry) {
        const fpbKey = it.fpb ? it.fpb.trim() : (it.noPo || `${norm}-${d.getTime()}`);
        entry.fpbSet.add(fpbKey);
        entry.qFpb += Number(it.qtyFPB) || 0;
        entry.qFstb += Number(it.qtyFSTB) || 0;
      }
    });

    return monthKeys.map((mk) => {
      const entry = map.get(mk);
      const totalFpb = entry ? entry.fpbSet.size : 0;
      const qFpb = entry ? entry.qFpb : 0;
      const qFstb = entry ? entry.qFstb : 0;

      return {
        monthKey: mk,
        monthName: MONTH_NAMES_ID[mk]?.slice(0, 3) || mk,
        totalFpb,
        qtyFPB: qFpb,
        qtyFSTB: qFstb,
      };
    });
  }, [
    rawDataSource,
    filterState.selectedArmadaId,
    filterState.focusTop12Only,
    filterState.fleetTypeFilter,
    filterState.entitas,
    filterState.tahun,
    topArmadas,
    remainderArmadas,
  ]);

  // ==========================================================================
  // 6. KALKULASI METRIK KPI (Dukungan Respons Saat Armada Dipilih / Fokus 12 Besar)
  // ==========================================================================
  const kpiMetrics = useMemo<KPIMetrics>(() => {
    let targetData = filteredData;

    // Saring berdasarkan tipe unit: Kapal Saja vs Semua
    if (filterState.fleetTypeFilter === 'MARINE') {
      targetData = targetData.filter((it) => isMarineArmada(it.armada || (it as any).deptArmada));
    } else if (filterState.fleetTypeFilter === 'OFFICE_SITE') {
      targetData = targetData.filter((it) => !isMarineArmada(it.armada || (it as any).deptArmada));
    }

    if (filterState.selectedArmadaId) {
      if (filterState.selectedArmadaId === 'OTHERS' || filterState.selectedArmadaId === 'Armada Lainnya') {
        const remainderNames = new Set(remainderArmadas.map((r) => r.name));
        targetData = targetData.filter((it) => {
          const rawName = (it.armada || (it as any).deptArmada || '').trim();
          return remainderNames.has(normalizeArmadaName(rawName));
        });
      } else {
        targetData = targetData.filter((it) => {
          const rawName = (it.armada || (it as any).deptArmada || '').trim();
          return normalizeArmadaName(rawName) === filterState.selectedArmadaId;
        });
      }
    } else if (filterState.focusTop12Only) {
      // Jika mode fokus 12 besar aktif dan tidak memilih 1 kapal, batasi data KPI HANYA ke 12 besar!
      const top12Names = new Set(topArmadas.filter((a) => a.id !== 'OTHERS').map((t) => t.name));
      targetData = targetData.filter((it) => {
        const rawName = (it.armada || (it as any).deptArmada || '').trim();
        return top12Names.has(normalizeArmadaName(rawName));
      });
    }

    const fpbSet = new Set<string>();
    let totalQtyFPB = 0;
    let totalQtyFSTB = 0;
    let totalBacklogQty = 0;
    let backlogItemCount = 0;
    let partialItemCount = 0;
    let completeItemCount = 0;
    let processItemCount = 0;
    const vesselSet = new Set<string>();

    for (const it of targetData) {
      if (it.fpb) fpbSet.add(it.fpb.trim());
      const rawName = (it.armada || (it as any).deptArmada || '').trim();
      if (rawName) vesselSet.add(normalizeArmadaName(rawName));

      const qFpb = Number(it.qtyFPB) || 0;
      const qFstb = Number(it.qtyFSTB) || 0;
      const qSel = it.selisih !== undefined ? Number(it.selisih) : Math.max(0, qFpb - qFstb);

      totalQtyFPB += qFpb;
      totalQtyFSTB += qFstb;
      totalBacklogQty += qSel;

      const statusUpper = (it.status || '').toUpperCase();
      if (
        (qSel === 0 && qFstb > 0) ||
        ((statusUpper.includes('LENGKAP') || statusUpper.includes('CLOSE') || statusUpper.includes('SELESAI')) && !(qFstb === 0 && qSel > 0))
      ) {
        completeItemCount++;
      } else if (statusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0)) {
        partialItemCount++;
      } else if (
        statusUpper.includes('PROSES') ||
        (it.noPo && it.noPo !== '-' && !statusUpper.includes('BACKLOG') && !statusUpper.includes('KRITIS') && !statusUpper.includes('OPEN') && qFstb === 0)
      ) {
        processItemCount++;
      } else {
        backlogItemCount++;
      }
    }

    const totalFpb = Math.max(fpbSet.size, targetData.length > 0 ? 1 : 0);
    const fulfillmentRate = totalQtyFPB > 0 ? Math.round((totalQtyFSTB / totalQtyFPB) * 100) : 0;
    const topVessel = topArmadas[0];
    const topVesselRealization =
      topVessel && topVessel.qtyFPB > 0
        ? Math.round((topVessel.qtyFSTB / topVessel.qtyFPB) * 100)
        : 100;

    return {
      totalFpb,
      totalQtyFPB,
      totalQtyFSTB,
      fulfillmentRate,
      totalBacklogQty,
      backlogItemCount,
      partialItemCount,
      completeItemCount,
      processItemCount,
      vesselCount: vesselSet.size,
      topVesselName: topVessel?.name || '-',
      topVesselFpb: topVessel?.fpbCount || 0,
      topVesselRealization,
      top12ConcentrationPct:
        totalFpbAllArmadas > 0
          ? Math.round((totalFpbPeriod / totalFpbAllArmadas) * 100)
          : 100,
      totalAllArmadasFpb: totalFpbAllArmadas,
    };
  }, [
    filteredData,
    filterState.selectedArmadaId,
    filterState.focusTop12Only,
    filterState.fleetTypeFilter,
    topArmadas,
    remainderArmadas,
    totalFpbPeriod,
    totalFpbAllArmadas,
  ]);

  const activePeriodLabel =
    filterState.bulan !== 'ALL'
      ? `${MONTH_NAMES_ID[filterState.bulan] || filterState.bulan} ${filterState.tahun !== 'ALL' ? filterState.tahun : '2026'}`
      : filterState.tahun !== 'ALL'
      ? `Tahun ${filterState.tahun}`
      : 'Semua Periode';

  return (
    <div
      className={`bg-slate-950 text-slate-100 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4 transition ${
        presentationMode ? 'ring-2 ring-sky-500/50 shadow-2xl p-6' : ''
      }`}
    >
      {/* 1. Global Filter Bar Terpusat (Single-Row Compact) */}
      <GlobalFilterBar
        filterState={filterState}
        onFilterChange={handleFilterChange}
        totalFpbCount={totalFpbPeriod}
        totalVesselCount={kpiMetrics.vesselCount}
      />

      {/* 2. Kartu KPI Eksekutif (Tinggi Seragam h-24, Aligned Baselines) */}
      <KPISummary
        metrics={kpiMetrics}
        selectedArmadaName={filterState.selectedArmadaId}
        onClearSelectedArmada={() => handleFilterChange({ selectedArmadaId: null })}
        periodLabel={activePeriodLabel}
      />

      {/* 2.5 Poin Narasi Presentasi Eksekutif (Executive Talking Points) */}
      <ExecutiveTalkingPoints
        metrics={kpiMetrics}
        topArmadas={topArmadas}
        focusTop12Only={filterState.focusTop12Only ?? true}
        fleetTypeFilter={filterState.fleetTypeFilter ?? 'ALL'}
        periodLabel={activePeriodLabel}
        totalAllFpb={totalFpbAllArmadas}
        presentationMode={presentationMode}
        onTogglePresentationMode={() => setPresentationMode((prev) => !prev)}
      />

      {/* 3. Sistem Grid 2-Kolom Seimbang (Equal Height & Flush Baselines) */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        {/* Kolom Kiri (col-span-12 lg:col-span-7): Donut Chart + Horizontal Bar Di Bawahnya */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 justify-between">
          {/* Card 1: Donut Chart 2D Top Armada (Horizontal Inline Compact) */}
          <div className="flex-1">
            <TopArmadaDonutChart
              armadaList={topArmadas}
              totalFpb={totalFpbPeriod}
              selectedArmadaId={filterState.selectedArmadaId}
              onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
              periodLabel={activePeriodLabel}
              focusTop12Only={filterState.focusTop12Only ?? true}
              onToggleFocusTop12={(val) => handleFilterChange({ focusTop12Only: val })}
              fleetTypeFilter={filterState.fleetTypeFilter ?? 'ALL'}
              onFleetTypeChange={(val) => handleFilterChange({ fleetTypeFilter: val })}
              remainderCount={remainderArmadas.length}
              onOpenRemainderModal={() => setIsRemainderModalOpen(true)}
            />
          </div>

          {/* Card 2: Top Armada Diminta vs Realisasi (Horizontal Bar Chart) */}
          <div className="flex-1">
            <TopArmadaDemandBar
              armadaList={topArmadas}
              selectedArmadaId={filterState.selectedArmadaId}
              onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
            />
          </div>
        </div>

        {/* Kolom Kanan (col-span-12 lg:col-span-5): Tren Bulanan + Widget Status SLA Mini-Gantt */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 justify-between">
          {/* Card 1: Tren Permintaan Bulanan (Combo Bar + Line) */}
          <div className="flex-1">
            <MonthlyTrendChart
              data={monthlyTrendData}
              activeMonth={filterState.bulan}
              onSelectMonth={(m) => handleFilterChange({ bulan: m })}
              selectedArmadaName={filterState.selectedArmadaId}
              onClearSelectedArmada={() => handleFilterChange({ selectedArmadaId: null })}
            />
          </div>

          {/* Card 2: Widget Ringkasan Status Operasional & SLA Mini-Gantt Preview (Flush dengan Kolom Kiri) */}
          <div className="flex-1">
            <OperationalSummaryWidget
              metrics={kpiMetrics}
              selectedPeriod={filterState.bulan}
              onScrollToGantt={handleScrollToGantt}
            />
          </div>
        </div>
      </div>

      {/* 4. Sub-Chart Gantt Timeline Terhubung Dinamis */}
      <div ref={ganttRef}>
        <ArmadaGanttSchedule
          items={filteredData}
          selectedArmadaId={filterState.selectedArmadaId}
          onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
          selectedPeriod={filterState.bulan}
          onOpenAudit={onOpenAudit}
        />
      </div>

      {/* 5. Modal Rincian Armada di Luar 12 Besar */}
      <RemainderArmadaModal
        isOpen={isRemainderModalOpen}
        onClose={() => setIsRemainderModalOpen(false)}
        remainderList={remainderArmadas}
        totalFpbAll={totalFpbAllArmadas}
        totalRemainderFpb={remainderArmadas.reduce((sum, r) => sum + r.fpbCount, 0)}
        onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
        onFocusTop12Only={() => handleFilterChange({ focusTop12Only: true })}
      />
    </div>
  );
}
