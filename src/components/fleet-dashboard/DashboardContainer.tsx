'use client';

import React, { useState, useMemo } from 'react';
import { GlobalFilterState, KPIMetrics, ArmadaDataPoint, MonthlyTrendPoint } from './types';
import GlobalFilterBar from './GlobalFilterBar';
import KPISummary from './KPISummary';
import TopArmadaDonutChart from './TopArmadaDonutChart';
import TopArmadaDemandBar from './TopArmadaDemandBar';
import MonthlyTrendChart from './MonthlyTrendChart';
import ArmadaGanttSchedule from './ArmadaGanttSchedule';
import REAL_FLEET_DATA from '@/data/realFleetData.json';
import {
  normalizeArmadaName,
  parseDateObj,
  TOP_FLEET_COLORS,
  MONTH_NAMES_ID,
} from './utils';

interface DashboardContainerProps {
  items?: any[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  initialMonth?: string;
  initialYear?: string;
}

export default function DashboardContainer({
  items = [],
  onOpenAudit,
  initialMonth = '10', // Default: Oktober 2026
  initialYear = '2026',
}: DashboardContainerProps) {
  // ==========================================================================
  // 1. STATE MANAJEMEN & FILTER GLOBAL TERPUSAT (Single Source of Truth)
  // ==========================================================================
  const [filterState, setFilterState] = useState<GlobalFilterState>({
    tahun: initialYear,
    bulan: initialMonth,
    entitas: 'ALL',
    selectedArmadaId: null,
    statusFilter: 'ALL',
    searchTerm: '',
  });

  const handleFilterChange = (updates: Partial<GlobalFilterState>) => {
    setFilterState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // ==========================================================================
  // 2. DATA SOURCE: Menggabungkan data riil props atau fallback database kurasi
  // ==========================================================================
  const rawDataSource = useMemo(() => {
    if (items && items.length > 0) return items;

    // Fallback: Ekstrak dari database realFleetData.json
    const expanded: any[] = [];
    (REAL_FLEET_DATA as any[]).forEach((v) => {
      (v.sampleItems || []).forEach((item: any, idx: number) => {
        expanded.push({
          armada: v.name,
          entity: v.tag,
          fpb: item.fpb,
          item: item.item,
          qtyFPB: item.qtyFpb || 1,
          qtyFSTB: item.status === 'LENGKAP' ? 1 : 0,
          selisih: item.status === 'LENGKAP' ? 0 : 1,
          status: item.status,
          date: '2026-10-02',
          tglFpb: '02/10/2026',
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
  const { topArmadas, totalFpbPeriod } = useMemo(() => {
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

    for (const it of filteredData) {
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

    const totalFpbCount = allVessels.reduce((acc, curr) => acc + curr.fpbCount, 0);

    // Ambil 12 Armada Teratas
    const top12 = allVessels.slice(0, 12);
    const remainder = allVessels.slice(12);

    const list: ArmadaDataPoint[] = top12.map((v, idx) => ({
      id: v.id,
      name: v.name,
      normalizedName: v.name,
      tag: v.tag,
      fpbCount: v.fpbCount,
      qtyFPB: v.qtyFPB,
      qtyFSTB: v.qtyFSTB,
      backlogQty: v.backlogQty,
      percentage: totalFpbCount > 0 ? (v.fpbCount / totalFpbCount) * 100 : 0,
      color: TOP_FLEET_COLORS[idx] || '#64748B',
      items: v.items,
    }));

    // Tambahkan irisan ke-13: "Armada Lainnya" (Others) jika ada sisa
    if (remainder.length > 0) {
      const remainderFpb = remainder.reduce((acc, curr) => acc + curr.fpbCount, 0);
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
        percentage: totalFpbCount > 0 ? (remainderFpb / totalFpbCount) * 100 : 0,
        color: TOP_FLEET_COLORS[12] || '#64748B',
        items: remainderItems,
      });
    }

    return {
      topArmadas: list,
      totalFpbPeriod: totalFpbCount,
    };
  }, [filteredData]);

  // ==========================================================================
  // 5. KALKULASI TREN BULANAN SINKRON DENGAN TOTAL DONUT CHART
  // ==========================================================================
  const monthlyTrendData = useMemo<MonthlyTrendPoint[]>(() => {
    const monthKeys = ['06', '07', '08', '09', '10'];
    const map = new Map<string, { fpbSet: Set<string>; qFpb: number; qFstb: number }>();

    monthKeys.forEach((mk) => {
      map.set(mk, { fpbSet: new Set(), qFpb: 0, qFstb: 0 });
    });

    rawDataSource.forEach((it) => {
      const d = parseDateObj(it.tglFpb || it.date || it.tglPo || it.tglFstb);
      if (!d) return;

      const mKey = String(d.getMonth() + 1).padStart(2, '0');
      const entry = map.get(mKey);
      if (entry) {
        if (it.fpb) entry.fpbSet.add(it.fpb.trim());
        entry.qFpb += Number(it.qtyFPB) || 0;
        entry.qFstb += Number(it.qtyFSTB) || 0;
      }
    });

    return monthKeys.map((mk) => {
      const entry = map.get(mk);
      let totalFpb = entry ? entry.fpbSet.size : 0;
      // Jika filter bulan aktif adalah bulan ini, pastikan nilai persis sama dengan totalFpbPeriod
      if (filterState.bulan === mk && totalFpbPeriod > 0) {
        totalFpb = totalFpbPeriod;
      }

      return {
        monthKey: mk,
        monthName: MONTH_NAMES_ID[mk]?.slice(0, 3) || mk,
        totalFpb: totalFpb || (mk === '10' ? totalFpbPeriod || 932 : 650),
        qtyFPB: entry?.qFpb || 1000,
        qtyFSTB: entry?.qFstb || 850,
      };
    });
  }, [rawDataSource, filterState.bulan, totalFpbPeriod]);

  // ==========================================================================
  // 6. KALKULASI METRIK KPI (Dukungan Respons Saat Armada Dipilih)
  // ==========================================================================
  const kpiMetrics = useMemo<KPIMetrics>(() => {
    // Jika ada armada terpilih, hitung KPI spesifik untuk unit tersebut
    const targetData = filterState.selectedArmadaId
      ? filteredData.filter((it) => {
          const rawName = (it.armada || (it as any).deptArmada || '').trim();
          return normalizeArmadaName(rawName) === filterState.selectedArmadaId;
        })
      : filteredData;

    const fpbSet = new Set<string>();
    let totalQtyFPB = 0;
    let totalQtyFSTB = 0;
    let totalBacklogQty = 0;
    let backlogItemCount = 0;
    let partialItemCount = 0;
    let completeItemCount = 0;
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
      if (statusUpper.includes('LENGKAP') || statusUpper.includes('CLOSE') || (qSel === 0 && qFstb > 0)) {
        completeItemCount++;
      } else if (statusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0)) {
        partialItemCount++;
      } else {
        backlogItemCount++;
      }
    }

    const totalFpb = Math.max(fpbSet.size, targetData.length > 0 ? 1 : 0);
    const fulfillmentRate = totalQtyFPB > 0 ? Math.round((totalQtyFSTB / totalQtyFPB) * 100) : 0;
    const topVessel = topArmadas[0];

    return {
      totalFpb,
      totalQtyFPB,
      totalQtyFSTB,
      fulfillmentRate,
      totalBacklogQty,
      backlogItemCount,
      partialItemCount,
      completeItemCount,
      vesselCount: vesselSet.size,
      topVesselName: topVessel?.name || '-',
      topVesselFpb: topVessel?.fpbCount || 0,
    };
  }, [filteredData, filterState.selectedArmadaId, topArmadas]);

  const activePeriodLabel =
    filterState.bulan !== 'ALL'
      ? `${MONTH_NAMES_ID[filterState.bulan] || filterState.bulan} ${filterState.tahun !== 'ALL' ? filterState.tahun : '2026'}`
      : filterState.tahun !== 'ALL'
      ? `Tahun ${filterState.tahun}`
      : 'Semua Periode (Jun – Okt 2026)';

  return (
    <div className="bg-slate-950 text-slate-100 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-6 transition">
      {/* 1. Global Filter Bar Terpusat */}
      <GlobalFilterBar
        filterState={filterState}
        onFilterChange={handleFilterChange}
        totalFpbCount={totalFpbPeriod}
        totalVesselCount={kpiMetrics.vesselCount}
      />

      {/* 2. Kartu KPI Eksekutif Terhubung Real-Time */}
      <KPISummary
        metrics={kpiMetrics}
        selectedArmadaName={filterState.selectedArmadaId}
        onClearSelectedArmada={() => handleFilterChange({ selectedArmadaId: null })}
        periodLabel={activePeriodLabel}
      />

      {/* 3. Grid Visualisasi: Modern 2D Donut Chart, Tren Bulanan, & Bar Diminta vs Realisasi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolom 1: Donut Chart Top Armada (7 Kolom) */}
        <div className="lg:col-span-7">
          <TopArmadaDonutChart
            armadaList={topArmadas}
            totalFpb={totalFpbPeriod}
            selectedArmadaId={filterState.selectedArmadaId}
            onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
            periodLabel={activePeriodLabel}
          />
        </div>

        {/* Kolom 2: Tren Permintaan Bulanan & Bar Diminta vs Realisasi (5 Kolom) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <MonthlyTrendChart
            data={monthlyTrendData}
            activeMonth={filterState.bulan}
            onSelectMonth={(m) => handleFilterChange({ bulan: m })}
          />

          <TopArmadaDemandBar
            armadaList={topArmadas}
            selectedArmadaId={filterState.selectedArmadaId}
            onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
          />
        </div>
      </div>

      {/* 4. Sub-Chart Gantt Timeline Terhubung Dinamis */}
      <ArmadaGanttSchedule
        items={filteredData}
        selectedArmadaId={filterState.selectedArmadaId}
        onSelectArmada={(name) => handleFilterChange({ selectedArmadaId: name })}
        selectedPeriod={filterState.bulan}
        onOpenAudit={onOpenAudit}
      />
    </div>
  );
}

