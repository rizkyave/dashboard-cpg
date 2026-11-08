'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  Clock,
  Sparkles,
  Plus,
  Search,
  Filter,
  Ship,
  MapPin,
  User,
  Phone,
  FileText,
  CheckCircle2,
  Truck,
  AlertCircle,
  Trash2,
  Edit3,
  Send,
  Printer,
  RefreshCw,
  X,
  ChevronRight,
  ArrowRightLeft,
  Navigation,
  ShieldCheck,
  Bot,
  Info,
  ExternalLink,
  Building2,
  Table,
  LayoutGrid,
  CheckCheck,
  BadgeCheck,
} from 'lucide-react';
import {
  DeliveryScheduleItem,
  ScheduleDay,
  ScheduleWeek,
  DeliveryTimeSlot,
  DeliveryScheduleStatus,
  CourierPerson,
  StaticScheduleItem,
} from '@/types/deliverySchedule';
import { KapalPosisiItem, ProcurementItem } from '@/types/procurement';
import { useAuth } from '@/context/AuthContext';

// Master 5 Personel Aktif Logistik Tim Delivery
const MASTER_COURIERS: CourierPerson[] = [
  {
    name: 'AGUSSALIM',
    nik: 'MP-DAO-0871',
    phone: '+62 859-5448-7599',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'BARDI',
    nik: 'MP-DAO-0274',
    phone: '+62 813-4718-0635',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'HAMKA ALKA',
    nik: 'CPL-DAO-0031',
    phone: '+62 813-5016-0353',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'ZULFIANSYAH',
    nik: 'MP-DAO-0367',
    phone: '+62 813-4632-0456',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
  {
    name: 'AKBAR RAMADHAN',
    nik: 'MP-DAO-0512',
    phone: '+62 813-5151-0415',
    jabatan: 'Staff Operasional / Delivery Lapangan',
  },
];

const DAYS_ORDER: ScheduleDay[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];

interface JadwalPengantaranTabProps {
  kapalPosisiItems?: KapalPosisiItem[];
  procurementData?: ProcurementItem[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function JadwalPengantaranTab({
  kapalPosisiItems = [],
  procurementData = [],
  showToast,
}: JadwalPengantaranTabProps) {
  const { user } = useAuth();

  // Sub-Tab Navigation: 'dinamis' vs 'statis'
  const [activeSubTab, setActiveSubTab] = useState<'dinamis' | 'statis'>('dinamis');

  // State Jadwal Dinamis
  const [schedules, setSchedules] = useState<DeliveryScheduleItem[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<ScheduleWeek>('W1');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCourier, setFilterCourier] = useState<string>('ALL');
  const [filterCluster, setFilterCluster] = useState<string>('ALL');

  // State Jadwal Statis (Master 66 Kapal & OFFICE GAJ)
  const [staticSchedules, setStaticSchedules] = useState<StaticScheduleItem[]>([]);
  const [isLoadingStatic, setIsLoadingStatic] = useState<boolean>(false);
  const [staticViewMode, setStaticViewMode] = useState<'kanban' | 'table'>('kanban');
  const [staticFilterDay, setStaticFilterDay] = useState<string>('ALL');
  const [staticFilterCourier, setStaticFilterCourier] = useState<string>('ALL');
  const [staticFilterCategory, setStaticFilterCategory] = useState<'ALL' | 'KAPAL' | 'GAJ'>('ALL');
  const [staticSearchQuery, setStaticSearchQuery] = useState<string>('');

  // Modals & Panels
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isPoolDrawerOpen, setIsPoolDrawerOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DeliveryScheduleItem | null>(null);

  // Form State untuk Tambah / Edit Manual Dinamis
  const [formData, setFormData] = useState<Partial<DeliveryScheduleItem>>({
    shipName: '',
    shipPosition: '',
    targetWeek: 'W1',
    scheduledDay: 'SENIN',
    timeSlot: 'PAGI (08:00 - 11:30)',
    urgency: 'NORMAL',
    transportMethod: 'Diantar Tim Logistik',
    status: 'PLANNED',
    notes: '',
  });

  // Fetch Jadwal Dinamis dari Backend
  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/jadwal-pengantaran');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setSchedules(data.items);
      }
    } catch (err) {
      console.error('Error fetching delivery schedules:', err);
      showToast?.('Gagal memuat jadwal pengantaran.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Jadwal Statis (Master 66 Kapal & GAJ)
  const fetchStaticSchedules = async () => {
    setIsLoadingStatic(true);
    try {
      const res = await fetch('/api/jadwal-pengantaran?mode=static');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setStaticSchedules(data.items);
      }
    } catch (err) {
      console.error('Error fetching static schedules:', err);
    } finally {
      setIsLoadingStatic(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchStaticSchedules();
  }, []);

  // Tanggal dinamis untuk 5 hari (Senin - Jumat) W1 dan W2
  const weekDates = useMemo(() => {
    const baseW1 = new Date(2026, 10, 9);
    const baseDate = selectedWeek === 'W1' ? new Date(baseW1) : new Date(2026, 10, 16);

    return DAYS_ORDER.map((day, idx) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + idx);
      const iso = d.toISOString().split('T')[0];
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthShort = d.toLocaleString('id-ID', { month: 'short' });
      return {
        day,
        date: iso,
        label: `${dayNum} ${monthShort}`,
        fullLabel: `${day}, ${dayNum} ${monthShort} ${d.getFullYear()}`,
      };
    });
  }, [selectedWeek]);

  // Filter items jadwal dinamis
  const currentWeekItems = useMemo(() => {
    return schedules.filter((s) => s.targetWeek === selectedWeek);
  }, [schedules, selectedWeek]);

  const filteredItems = useMemo(() => {
    return currentWeekItems.filter((item) => {
      if (filterCourier !== 'ALL' && item.courier?.name !== filterCourier) return false;
      if (filterCluster !== 'ALL' && item.clusterArea !== filterCluster) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchShip = item.shipName?.toLowerCase().includes(q);
        const matchPos = item.shipPosition?.toLowerCase().includes(q);
        const matchCourier = item.courier?.name?.toLowerCase().includes(q);
        const matchTtb = item.noTtb?.toLowerCase().includes(q);
        const matchItem = item.itemDescription?.toLowerCase().includes(q);
        if (!matchShip && !matchPos && !matchCourier && !matchTtb && !matchItem) return false;
      }
      return true;
    });
  }, [currentWeekItems, filterCourier, filterCluster, searchQuery]);

  // Statistik beban kerja per kurir dari 5 personel (Dinamis)
  const courierWorkload = useMemo(() => {
    const stats: Record<string, number> = {};
    MASTER_COURIERS.forEach((c) => (stats[c.name] = 0));
    currentWeekItems.forEach((item) => {
      if (item.courier?.name && stats[item.courier.name] !== undefined) {
        stats[item.courier.name]++;
      }
    });
    return stats;
  }, [currentWeekItems]);

  // Pool Kapal yang siap diantar (Belum terjadwal di minggu ini)
  const readyShipPool = useMemo(() => {
    const scheduledShipNames = new Set(
      currentWeekItems.map((s) => s.shipName.trim().toUpperCase())
    );

    return kapalPosisiItems
      .filter((k) => !scheduledShipNames.has(k.namaKapal.trim().toUpperCase()))
      .slice(0, 15);
  }, [kapalPosisiItems, currentWeekItems]);

  // Filter Jadwal Statis (66 Kapal & GAJ)
  const filteredStaticItems = useMemo(() => {
    return staticSchedules.filter((item) => {
      if (staticFilterDay !== 'ALL' && item.scheduledDay !== staticFilterDay) return false;
      if (staticFilterCourier !== 'ALL' && item.assignedCourier?.name !== staticFilterCourier) return false;
      if (staticFilterCategory === 'KAPAL' && item.isOfficeDestination) return false;
      if (staticFilterCategory === 'GAJ' && !item.isOfficeDestination) return false;

      if (staticSearchQuery.trim()) {
        const q = staticSearchQuery.toLowerCase();
        const matchName = item.shipName?.toLowerCase().includes(q);
        const matchPos = item.defaultPosition?.toLowerCase().includes(q);
        const matchCourier = item.assignedCourier?.name?.toLowerCase().includes(q);
        const matchType = item.shipType?.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchCourier && !matchType) return false;
      }
      return true;
    });
  }, [staticSchedules, staticFilterDay, staticFilterCourier, staticFilterCategory, staticSearchQuery]);

  // Statistik Jadwal Statis
  const staticSummary = useMemo(() => {
    const total = staticSchedules.length;
    const ships = staticSchedules.filter((x) => !x.isOfficeDestination).length;
    const gaj = staticSchedules.filter((x) => x.isOfficeDestination).length;
    const courierCount: Record<string, number> = {};
    MASTER_COURIERS.forEach((c) => (courierCount[c.name] = 0));
    staticSchedules.forEach((item) => {
      if (item.assignedCourier?.name && courierCount[item.assignedCourier.name] !== undefined) {
        courierCount[item.assignedCourier.name]++;
      }
    });
    return { total, ships, gaj, courierCount };
  }, [staticSchedules]);

  // Helper Simpan atau Update Item Dinamis ke API
  const handleSaveItem = async (item: DeliveryScheduleItem) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/jadwal-pengantaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedules((prev) => {
          const idx = prev.findIndex((x) => x.id === item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = item;
            return next;
          }
          return [item, ...prev];
        });
        showToast?.('Jadwal berhasil diperbarui!', 'success');
      } else {
        showToast?.(data.message || 'Gagal menyimpan jadwal.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Gagal menyimpan jadwal.', 'error');
    } finally {
      setIsSaving(false);
      setIsManualModalOpen(false);
      setEditingItem(null);
    }
  };

  // Helper Hapus Item Dinamis
  const handleDeleteItem = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal pengantaran ini?')) return;
    try {
      const res = await fetch(`/api/jadwal-pengantaran?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSchedules((prev) => prev.filter((x) => x.id !== id));
        showToast?.('Jadwal berhasil dihapus.', 'info');
      }
    } catch {
      showToast?.('Gagal menghapus jadwal.', 'error');
    }
  };

  // Quick Action Dinamis: Pindah Hari
  const handleQuickMoveDay = async (item: DeliveryScheduleItem, targetDay: ScheduleDay) => {
    const targetDateObj = weekDates.find((w) => w.day === targetDay);
    const updated: DeliveryScheduleItem = {
      ...item,
      scheduledDay: targetDay,
      scheduledDate: targetDateObj?.date || item.scheduledDate,
      updatedAt: new Date().toISOString(),
    };
    await handleSaveItem(updated);
  };

  // Quick Action Dinamis: Ganti Kurir
  const handleQuickChangeCourier = async (item: DeliveryScheduleItem, courierName: string) => {
    const courierObj = MASTER_COURIERS.find((c) => c.name === courierName);
    if (!courierObj) return;
    const updated: DeliveryScheduleItem = {
      ...item,
      courier: courierObj,
      updatedAt: new Date().toISOString(),
    };
    await handleSaveItem(updated);
  };

  // Quick Action Dinamis: Ganti Status
  const handleQuickChangeStatus = async (
    item: DeliveryScheduleItem,
    status: DeliveryScheduleStatus
  ) => {
    const updated: DeliveryScheduleItem = {
      ...item,
      status,
      updatedAt: new Date().toISOString(),
      completedAt: status === 'DELIVERED' ? new Date().toISOString() : item.completedAt,
    };
    await handleSaveItem(updated);
  };

  // WhatsApp Single Dispatch Notification Dinamis
  const handleSendCourierWa = (item: DeliveryScheduleItem) => {
    const phone = item.courier.phone?.replace(/[^0-9]/g, '');
    const cleanPhone = phone?.startsWith('0') ? '62' + phone.substring(1) : phone;

    const message = `*PENUGASAN PENGANTARAN LOGISTIK CPG* 🚢📦
---------------------------------------------
Halo Rekan *${item.courier.name}*, berikut adalah jadwal pengantaran barang ke armada kapal:

📅 *Jadwal:* ${item.scheduledDay}, ${item.scheduledDate}
⏰ *Waktu:* ${item.timeSlot}
🚢 *Armada Kapal:* *${item.shipName}*
📍 *Lokasi Labuh:* ${item.shipPosition}
⚙️ *Status Kapal:* ${item.shipStatus} (${item.detailStatus || 'Operasional'})
📦 *Barang / Muatan:* ${item.itemDescription || 'Barang Serah Terima Logistik'}
📄 *No. Referensi:* ${item.noTtb || 'TTB Siap Antar'} / ${item.noFpb || '-'}
⚡ *Tingkat Urgensi:* ${item.urgency === 'CRITICAL' ? '🔴 MENDESAK / SLA 1 HARI' : item.urgency === 'HIGH' ? '🟠 TINGGI' : '🟢 NORMAL'}
${item.notes ? `📝 *Catatan Lapangan:* ${item.notes}\n` : ''}
Harap berkoordinasi dengan kru kapal saat tiba di dermaga dan pastikan dokumen TTB ditandatangani. Terima kasih.
_Sistem Logistik Procurement CPG_`;

    const encoded = encodeURIComponent(message);
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  // WhatsApp Single Dispatch Notification Statis
  const handleSendStaticWa = (item: StaticScheduleItem) => {
    const phone = item.assignedCourier.phone?.replace(/[^0-9]/g, '');
    const cleanPhone = phone?.startsWith('0') ? '62' + phone.substring(1) : phone;

    const message = `*JADWAL PENGANTARAN STATIS (RUTE TETAP) LOGISTIK CPG* 🚢🏢
---------------------------------------------
Halo Rekan *${item.assignedCourier.name}*, berikut adalah penugasan rute tetap mingguan:

📅 *Hari Rutin:* *${item.scheduledDay}*
⏰ *Jam Operasional:* ${item.timeSlot}
🎯 *Tujuan:* *${item.shipName}* ${item.isOfficeDestination ? '🏢 (KANTOR PUSAT GAJ)' : '⚓'}
📍 *Lokasi / Dermaga:* ${item.defaultPosition}
📦 *Kategori:* ${item.shipType}
🚚 *Metode:* ${item.transportMethod}
${item.priorityNote ? `📝 *Catatan:* ${item.priorityNote}\n` : ''}
Pastikan koordinasi dan kelengkapan dokumen serah terima sebelum berangkat.
_Sistem Logistik Procurement CPG_`;

    const encoded = encodeURIComponent(message);
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  // WhatsApp Rekap Mingguan Dinamis
  const handleBroadcastWeeklySummary = () => {
    const summaryItems = DAYS_ORDER.map((day) => {
      const itemsOnDay = filteredItems.filter((x) => x.scheduledDay === day);
      if (itemsOnDay.length === 0) return `*${day}:* Nihil`;
      const shipList = itemsOnDay
        .map((x) => `  • ${x.shipName} (${x.shipPosition}) - Kurir: ${x.courier.name}`)
        .join('\n');
      return `*${day} (${itemsOnDay.length} Kapal):*\n${shipList}`;
    }).join('\n\n');

    const msg = `*REKAP RENCANA JADWAL PENGANTARAN LOGISTIK CPG* 🚢
Periode: *Minggu ${selectedWeek === 'W1' ? 'Ini (W1)' : 'Depan (W2)'}* (Senin - Jumat)
---------------------------------------------
${summaryItems}

---------------------------------------------
*Beban Kerja Personel (5 Staf Delivery):*
${MASTER_COURIERS.map((c) => `• ${c.name}: ${courierWorkload[c.name] || 0} Pengantaran`).join('\n')}

_Dibuat otomatis oleh AI Delivery Engine CPG_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // WhatsApp Broadcast Master Jadwal Statis (66 Kapal + GAJ)
  const handleBroadcastStaticSummary = () => {
    const summaryItems = DAYS_ORDER.map((day) => {
      const itemsOnDay = staticSchedules.filter((x) => x.scheduledDay === day);
      const officeGaj = itemsOnDay.find((x) => x.isOfficeDestination);
      const shipCount = itemsOnDay.filter((x) => !x.isOfficeDestination).length;

      let text = `*${day}:* ${shipCount} Kapal Armada`;
      if (officeGaj) {
        text += ` + 🏢 *OFFICE GAJ (Wajib 2x/mgg)* - Kurir: ${officeGaj.assignedCourier.name}`;
      }
      return text;
    }).join('\n');

    const msg = `*MASTER JADWAL PENGANTARAN STATIS (66 KAPAL + GAJ)* 🚢🏢
PT Cindara Pratama Lines - Tim Logistik Delivery
---------------------------------------------
Rute Tetap Mingguan (Senin s/d Jumat):
${summaryItems}

---------------------------------------------
*Total Armada:* 66 Kapal Terdistribusi
*Rutin OFFICE GAJ:* 2x Seminggu (Selasa & Kamis)
*Personel Kurir:* 5 Staf Delivery Lapangan Aktif

_Pusat Logistik & Serah Terima CPG_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // AI Auto-Scheduler Dinamis
  const handleRunAiAutoScheduler = async () => {
    setIsSaving(true);
    try {
      const sourceShips = kapalPosisiItems.length > 0 ? kapalPosisiItems : [];

      if (sourceShips.length === 0) {
        showToast?.('Tidak ada data posisi kapal aktif untuk dijadwalkan.', 'warning');
        setIsSaving(false);
        setIsAiModalOpen(false);
        return;
      }

      const newAiSchedules: DeliveryScheduleItem[] = [];

      const getCluster = (
        pos: string
      ): 'SOMBER_KARIANGAU' | 'SEMAYANG_BALIKPAPAN' | 'MUARA_JAWA_SAMARINDA' | 'LUAR_TRANSIT' | 'LAINNYA' => {
        const p = (pos || '').toLowerCase();
        if (p.includes('somber') || p.includes('kariangau') || p.includes('teluk')) {
          return 'SOMBER_KARIANGAU';
        }
        if (p.includes('semayang') || p.includes('melawai') || p.includes('kampung baru')) {
          return 'SEMAYANG_BALIKPAPAN';
        }
        if (p.includes('muara') || p.includes('samarinda') || p.includes('berau') || p.includes('palaran')) {
          return 'MUARA_JAWA_SAMARINDA';
        }
        return 'SOMBER_KARIANGAU';
      };

      let courierIndex = 0;

      sourceShips.slice(0, 12).forEach((ship, idx) => {
        const cluster = getCluster(ship.posisi);
        let targetDay: ScheduleDay = 'SENIN';
        let reason = '';
        let urgency: 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL';

        if (ship.statusKode === 'SB' || idx % 5 === 0) {
          targetDay = 'SENIN';
          urgency = 'CRITICAL';
          reason = 'Prioritas Kapal Standby (SB) / SLA Mendesak segera sailing';
        } else if (cluster === 'SOMBER_KARIANGAU' && idx % 3 === 0) {
          targetDay = 'SELASA';
          reason = 'Kluster Rute Efisien: Dermaga Somber & Kawasan Industri Kariangau';
        } else if (cluster === 'SEMAYANG_BALIKPAPAN' || idx % 4 === 0) {
          targetDay = 'RABU';
          reason = 'Kluster Pelabuhan Semayang & Melawai Anchorage Point';
        } else if (cluster === 'MUARA_JAWA_SAMARINDA' || idx % 2 === 0) {
          targetDay = 'KAMIS';
          reason = 'Kluster Konsolidasi Pengiriman Luar Kota Muara Jawa & Samarinda';
        } else {
          targetDay = 'JUMAT';
          reason = 'Pengantaran Suku Cadang Docking / Maintenance Akhir Pekan';
        }

        const dateObj = weekDates.find((w) => w.day === targetDay);
        const assignedCourier = MASTER_COURIERS[courierIndex % MASTER_COURIERS.length];
        courierIndex++;

        newAiSchedules.push({
          id: `ai-sched-${Date.now()}-${idx}`,
          shipName: ship.namaKapal,
          cleanShipName: ship.namaKapal,
          callSign: ship.callsign || '-',
          shipPosition: ship.posisi || 'Pelabuhan Balikpapan',
          clusterArea: cluster,
          shipStatus: ship.statusKode || 'ON',
          detailStatus: ship.detailStatus || ship.activity || 'Operasional Normal',
          urgency,
          targetWeek: selectedWeek,
          scheduledDay: targetDay,
          scheduledDate: dateObj?.date || '2026-11-09',
          timeSlot: idx % 2 === 0 ? 'PAGI (08:00 - 11:30)' : 'SIANG (13:00 - 15:30)',
          courier: assignedCourier,
          transportMethod: cluster === 'MUARA_JAWA_SAMARINDA' ? 'Travel / Mobil' : 'Diantar Tim Logistik',
          status: 'PLANNED',
          notes: `Optimasi rute cerdas AI untuk kluster ${cluster}`,
          isAiSuggested: true,
          aiClusteringReason: reason,
          priorityScore: urgency === 'CRITICAL' ? 95 : 78,
          scheduledBy: `AI Delivery Assistant (${user?.name || 'Admin'})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      const res = await fetch('/api/jadwal-pengantaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_replace',
          targetWeek: selectedWeek,
          items: newAiSchedules,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSchedules((prev) => {
          const others = prev.filter((s) => s.targetWeek !== selectedWeek);
          return [...others, ...newAiSchedules];
        });
        showToast?.(`AI Berhasil menyusun ${newAiSchedules.length} jadwal pengantaran armada!`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Gagal menyusun jadwal otomatis.', 'error');
    } finally {
      setIsSaving(false);
      setIsAiModalOpen(false);
    }
  };

  const handlePrintSchedule = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* TOP VIEW SWITCHER: JADWAL DINAMIS VS JADWAL STATIS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
            <button
              onClick={() => setActiveSubTab('dinamis')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'dinamis'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="size-3.5 text-sky-500" />
              <span>Jadwal Dinamis (Antrean & AI)</span>
            </button>
            <button
              onClick={() => setActiveSubTab('statis')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'statis'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="size-3.5 text-emerald-500" />
              <span>Jadwal Statis (Master 66 Kapal & GAJ)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold">
                66 + GAJ
              </span>
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {activeSubTab === 'dinamis'
              ? 'Mode Penjadwalan Dinamis: Berbasis antrean berkas TTB & koordinat harian'
              : 'Mode Penjadwalan Statis: Rencana tetap reguler 66 kapal + 2x/minggu ke OFFICE GAJ'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAMPILAN 1: JADWAL DINAMIS (AI & ANTREAN MINGGUAN) */}
      {/* ========================================================================= */}
      {activeSubTab === 'dinamis' && (
        <>
          {/* HEADER SECTION DINAMIS */}
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs">
                    <CalendarDays className="size-6" />
                  </span>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      Jadwal Pengantaran Dinamis
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        5 Hari Kerja (Senin - Jumat)
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Perencanaan dinamis pengantaran barang ke kapal 1 & 2 minggu ke depan berbasis Posisi Kapal FMS & AI Clustering.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Header */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Week Switcher */}
                <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
                  <button
                    onClick={() => setSelectedWeek('W1')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      selectedWeek === 'W1'
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Minggu Ini (W1)
                  </button>
                  <button
                    onClick={() => setSelectedWeek('W2')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      selectedWeek === 'W2'
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Minggu Depan (W2)
                  </button>
                </div>

                {/* AI Auto-Scheduler Button */}
                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Sparkles className="size-4 animate-spin-slow" />
                  <span>Susun Jadwal AI</span>
                </button>

                {/* Tambah Manual Button */}
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setFormData({
                      targetWeek: selectedWeek,
                      scheduledDay: 'SENIN',
                      timeSlot: 'PAGI (08:00 - 11:30)',
                      urgency: 'NORMAL',
                      transportMethod: 'Diantar Tim Logistik',
                      courier: MASTER_COURIERS[0],
                      status: 'PLANNED',
                    });
                    setIsManualModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-background border border-border hover:bg-muted text-foreground transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="size-4 text-emerald-500" />
                  <span>Tambah Jadwal</span>
                </button>

                {/* Cetak Rekap PDF */}
                <button
                  onClick={handlePrintSchedule}
                  className="p-2 rounded-xl bg-background border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Cetak Lembar Tugas Jadwal (Print / PDF)"
                >
                  <Printer className="size-4" />
                </button>

                {/* Broadcast WA */}
                <button
                  onClick={handleBroadcastWeeklySummary}
                  className="p-2 rounded-xl bg-background border border-border hover:bg-emerald-500/10 hover:text-emerald-600 text-muted-foreground transition cursor-pointer"
                  title="Kirim Rekap Jadwal ke WhatsApp Tim Logistik"
                >
                  <Send className="size-4 text-emerald-500" />
                </button>

                {/* Pool Kapal Button */}
                <button
                  onClick={() => setIsPoolDrawerOpen(true)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 hover:bg-sky-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Ship className="size-3.5" />
                  <span>Pool Kapal ({readyShipPool.length})</span>
                </button>
              </div>
            </div>

            {/* METRICS & WORKLOAD ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-border/80">
              <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
                <span className="text-[11px] font-medium text-muted-foreground block">Total Terjadwal</span>
                <span className="text-xl font-bold text-foreground mt-0.5 block">{currentWeekItems.length}</span>
                <span className="text-[10px] text-muted-foreground">Senin s/d Jumat</span>
              </div>

              <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block">SLA Mendesak (1-3H)</span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5 block">
                  {currentWeekItems.filter((x) => x.urgency === 'CRITICAL' || x.urgency === 'HIGH').length}
                </span>
                <span className="text-[10px] text-amber-600/80">Prioritas Terjadwal</span>
              </div>

              <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">Selesai Diterima</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                  {currentWeekItems.filter((x) => x.status === 'DELIVERED').length}
                </span>
                <span className="text-[10px] text-emerald-600/80">TTB Tertandatangani</span>
              </div>

              {/* Beban Kerja 5 Personel Kurir */}
              <div className="col-span-2 sm:col-span-4 lg:col-span-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <Truck className="size-3.5 text-sky-500" />
                    Alokasi Beban Kerja (5 Personel Tim Delivery)
                  </span>
                  <span className="text-[10px] text-muted-foreground">Aktif di Lapangan</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {MASTER_COURIERS.map((courier, idx) => {
                    const count = courierWorkload[courier.name] || 0;
                    return (
                      <div
                        key={idx}
                        className="p-1.5 rounded-lg bg-background border border-border text-center shadow-2xs"
                      >
                        <div className="text-[10px] font-bold text-foreground truncate" title={courier.name}>
                          {courier.name.split(' ')[0]}
                        </div>
                        <div className="text-xs font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
                          {count} <span className="text-[9px] font-normal text-muted-foreground">tugas</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* FILTER & SEARCH BAR DINAMIS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border/60">
              <div className="relative w-full sm:w-72">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari kapal, dermaga, kurir, no TTB..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Filter Kurir */}
                <select
                  value={filterCourier}
                  onChange={(e) => setFilterCourier(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Kurir (5 Personel)</option>
                  {MASTER_COURIERS.map((c, i) => (
                    <option key={i} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Filter Kluster */}
                <select
                  value={filterCluster}
                  onChange={(e) => setFilterCluster(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Kluster Wilayah</option>
                  <option value="SOMBER_KARIANGAU">Kluster Somber & Kariangau</option>
                  <option value="SEMAYANG_BALIKPAPAN">Kluster Semayang & Melawai</option>
                  <option value="MUARA_JAWA_SAMARINDA">Kluster Muara Jawa & Samarinda</option>
                </select>

                {(searchQuery || filterCourier !== 'ALL' || filterCluster !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCourier('ALL');
                      setFilterCluster('ALL');
                    }}
                    className="text-xs text-rose-500 hover:text-rose-600 px-2 py-1 rounded-lg cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 5-DAY KANBAN BOARD DINAMIS (SENIN S/D JUMAT) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {weekDates.map((colDay) => {
              const dayItems = filteredItems.filter((item) => item.scheduledDay === colDay.day);

              return (
                <div
                  key={colDay.day}
                  className="bg-card border border-border rounded-2xl flex flex-col min-h-[580px] shadow-2xs overflow-hidden transition-all duration-200"
                >
                  {/* Column Header */}
                  <div className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{colDay.day}</span>
                        <span className="text-[11px] font-medium text-muted-foreground">({colDay.label})</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {colDay.day === 'SENIN' && '⚡ SLA Mendesak & Standby'}
                        {colDay.day === 'SELASA' && '⚓ Somber & Kariangau'}
                        {colDay.day === 'RABU' && '🚢 Semayang & Melawai'}
                        {colDay.day === 'KAMIS' && '🚚 Muara Jawa & Luar Kota'}
                        {colDay.day === 'JUMAT' && '🔧 Maintenance & Susulan'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-background border border-border text-foreground">
                        {dayItems.length}
                      </span>
                      <button
                        onClick={() => {
                          setEditingItem(null);
                          setFormData({
                            targetWeek: selectedWeek,
                            scheduledDay: colDay.day,
                            scheduledDate: colDay.date,
                            timeSlot: 'PAGI (08:00 - 11:30)',
                            urgency: 'NORMAL',
                            transportMethod: 'Diantar Tim Logistik',
                            courier: MASTER_COURIERS[0],
                            status: 'PLANNED',
                          });
                          setIsManualModalOpen(true);
                        }}
                        className="size-6 rounded-lg bg-background border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
                        title={`Tambah jadwal di hari ${colDay.day}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Cards List Dinamis */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    {dayItems.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-xl p-4 text-center">
                        <Ship className="size-6 text-muted-foreground/40 mb-1.5" />
                        <span className="text-xs font-medium text-muted-foreground">Belum ada jadwal</span>
                        <button
                          onClick={() => {
                            setEditingItem(null);
                            setFormData({
                              targetWeek: selectedWeek,
                              scheduledDay: colDay.day,
                              scheduledDate: colDay.date,
                              timeSlot: 'PAGI (08:00 - 11:30)',
                              urgency: 'NORMAL',
                              transportMethod: 'Diantar Tim Logistik',
                              courier: MASTER_COURIERS[0],
                              status: 'PLANNED',
                            });
                            setIsManualModalOpen(true);
                          }}
                          className="mt-2 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          + Alokasikan Kapal
                        </button>
                      </div>
                    ) : (
                      dayItems.map((item) => (
                        <div
                          key={item.id}
                          className="group bg-background border border-border hover:border-sky-500/50 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all duration-200 relative"
                        >
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border ${
                                item.urgency === 'CRITICAL'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                  : item.urgency === 'HIGH'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                              }`}
                            >
                              {item.urgency === 'CRITICAL' ? '🔴 MENDESAK' : item.urgency === 'HIGH' ? '🟠 TINGGI' : '🟢 NORMAL'}
                            </span>

                            <div className="flex items-center gap-1">
                              {item.isAiSuggested && (
                                <span
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-0.5"
                                  title={item.aiClusteringReason || 'Disusun otomatis oleh AI Clustering'}
                                >
                                  <Sparkles className="size-2.5" />
                                  AI
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-sm border ${
                                  item.status === 'DELIVERED'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : item.status === 'DISPATCHED'
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                {item.status === 'DELIVERED'
                                  ? 'Diterima'
                                  : item.status === 'DISPATCHED'
                                  ? 'Berangkat'
                                  : 'Terencana'}
                              </span>
                            </div>
                          </div>

                          {/* Vessel Name & Status */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-bold text-foreground truncate" title={item.shipName}>
                                {item.shipName.replace(/\s*\([^)]*Kantor Pusat[^)]*\)/gi, '').trim()}
                              </h3>
                              <span className="text-[10px] font-mono px-1 rounded-xs bg-muted text-muted-foreground border border-border/80">
                                {item.shipStatus}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              <MapPin className="size-3 text-rose-500 shrink-0" />
                              <span className="truncate" title={item.shipPosition}>
                                {item.shipPosition}
                              </span>
                            </div>
                          </div>

                          {/* Items & References */}
                          <div className="bg-muted/40 rounded-lg p-2 mb-2 text-[10px] space-y-1">
                            <div className="font-medium text-foreground line-clamp-2">
                              {item.itemDescription || 'Barang Serah Terima Logistik Lapangan'}
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50">
                              <span>{item.noTtb || 'TTB Belum Ada'}</span>
                              <span>{item.noFpb ? item.noFpb.split('-').slice(-1)[0] : ''}</span>
                            </div>
                          </div>

                          {/* Assigned Courier */}
                          <div className="mb-2">
                            <div className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <User className="size-3 text-sky-500" />
                                Petugas Pengantar:
                              </span>
                              <span className="text-[9px] text-muted-foreground">{item.timeSlot?.split(' ')[0]}</span>
                            </div>
                            <select
                              value={item.courier?.name}
                              onChange={(e) => handleQuickChangeCourier(item, e.target.value)}
                              className="w-full text-[11px] font-semibold py-1 px-2 rounded-lg bg-muted/60 border border-border text-foreground focus:outline-hidden cursor-pointer"
                            >
                              {MASTER_COURIERS.map((c, i) => (
                                <option key={i} value={c.name}>
                                  {c.name} ({c.phone})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* AI Clustering Note */}
                          {item.aiClusteringReason && (
                            <div className="text-[9px] text-indigo-600 dark:text-indigo-400 italic bg-indigo-500/5 p-1.5 rounded-md border border-indigo-500/10 mb-2">
                              💡 {item.aiClusteringReason}
                            </div>
                          )}

                          {/* Action Bar */}
                          <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <select
                                value={item.scheduledDay}
                                onChange={(e) => handleQuickMoveDay(item, e.target.value as ScheduleDay)}
                                className="text-[10px] py-1 px-1.5 rounded-md bg-background border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Pindah Hari"
                              >
                                {DAYS_ORDER.map((d) => (
                                  <option key={d} value={d}>
                                    ➡️ {d}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={() =>
                                  handleQuickChangeStatus(
                                    item,
                                    item.status === 'DELIVERED'
                                      ? 'PLANNED'
                                      : item.status === 'DISPATCHED'
                                      ? 'DELIVERED'
                                      : 'DISPATCHED'
                                  )
                                }
                                className="p-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Ubah Status (Terencana -> Berangkat -> Diterima)"
                              >
                                <CheckCircle2
                                  className={`size-3.5 ${
                                    item.status === 'DELIVERED'
                                      ? 'text-emerald-500'
                                      : item.status === 'DISPATCHED'
                                      ? 'text-sky-500'
                                      : 'text-muted-foreground'
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSendCourierWa(item)}
                                className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                title="Kirim Notifikasi Tugas via WhatsApp"
                              >
                                <Send className="size-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setFormData(item);
                                  setIsManualModalOpen(true);
                                }}
                                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Edit Rincian"
                              >
                                <Edit3 className="size-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 cursor-pointer"
                                title="Hapus Jadwal"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN 2: JADWAL STATIS (MASTER 66 KAPAL + OFFICE GAJ 2X SEMINGGU) */}
      {/* ========================================================================= */}
      {activeSubTab === 'statis' && (
        <div className="space-y-6">
          {/* HEADER SECTION STATIS */}
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                    <Building2 className="size-6" />
                  </span>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      Master Jadwal Pengantaran Statis
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        66 Armada Kapal + OFFICE GAJ (Selasa & Kamis)
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Rencana rute tetap reguler mingguan untuk seluruh 66 armada kapal CPG ditambah pengantaran wajib rutin ke <strong>OFFICE GAJ 2x seminggu (Selasa & Kamis)</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Header Statis */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Switcher Tampilan: Kanban vs Table */}
                <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
                  <button
                    onClick={() => setStaticViewMode('kanban')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      staticViewMode === 'kanban'
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LayoutGrid className="size-3.5" />
                    <span>Papan 5 Hari</span>
                  </button>
                  <button
                    onClick={() => setStaticViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      staticViewMode === 'table'
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Table className="size-3.5" />
                    <span>Tabel Master (68 Tujuan)</span>
                  </button>
                </div>

                {/* Print Master PDF */}
                <button
                  onClick={handlePrintSchedule}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-background border border-border hover:bg-muted text-foreground transition flex items-center gap-1.5 cursor-pointer"
                  title="Cetak Master Jadwal Statis (PDF / Print)"
                >
                  <Printer className="size-4" />
                  <span>Cetak Master PDF</span>
                </button>

                {/* Broadcast WA Master Statis */}
                <button
                  onClick={handleBroadcastStaticSummary}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Kirim Rekap Master Statis ke WhatsApp Tim Logistik"
                >
                  <Send className="size-4" />
                  <span>Broadcast ke Grup WA</span>
                </button>
              </div>
            </div>

            {/* METRICS ROW STATIS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-border/80">
              <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
                <span className="text-[11px] font-medium text-muted-foreground block">Total Master Rute</span>
                <span className="text-xl font-bold text-foreground mt-0.5 block">{staticSummary.total} Rute</span>
                <span className="text-[10px] text-muted-foreground">Senin s/d Jumat</span>
              </div>

              <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/20">
                <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 block">Armada Kapal</span>
                <span className="text-xl font-bold text-sky-700 dark:text-sky-300 mt-0.5 block">{staticSummary.ships} Kapal</span>
                <span className="text-[10px] text-sky-600/80">100% Terpetakan</span>
              </div>

              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/25">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Building2 className="size-3.5 text-emerald-600" />
                  OFFICE GAJ Rutin
                </span>
                <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5 block">2x Seminggu</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Setiap Selasa & Kamis</span>
              </div>

              <div className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/20">
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 block">Staf Pengantar</span>
                <span className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5 block">5 Kurir Aktif</span>
                <span className="text-[10px] text-indigo-600/80">Logistik Tim Delivery</span>
              </div>

              <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
                <span className="text-[11px] font-medium text-muted-foreground block">Rata-Rata Harian</span>
                <span className="text-xl font-bold text-foreground mt-0.5 block">13-14 Tujuan</span>
                <span className="text-[10px] text-muted-foreground">Beban Terbagi Rata</span>
              </div>
            </div>

            {/* FILTER & SEARCH BAR STATIS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border/60">
              <div className="relative w-full sm:w-72">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari kapal, OFFICE GAJ, dermaga, kurir..."
                  value={staticSearchQuery}
                  onChange={(e) => setStaticSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Filter Hari */}
                <select
                  value={staticFilterDay}
                  onChange={(e) => setStaticFilterDay(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Hari (Senin - Jumat)</option>
                  {DAYS_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {/* Filter Kategori: Kapal vs GAJ */}
                <select
                  value={staticFilterCategory}
                  onChange={(e) => setStaticFilterCategory(e.target.value as any)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden cursor-pointer font-medium"
                >
                  <option value="ALL">Semua Kategori (66 Kapal + GAJ)</option>
                  <option value="KAPAL">⚓ Hanya 66 Armada Kapal</option>
                  <option value="GAJ">🏢 Hanya Rutin OFFICE GAJ (Selasa & Kamis)</option>
                </select>

                {/* Filter Kurir */}
                <select
                  value={staticFilterCourier}
                  onChange={(e) => setStaticFilterCourier(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Kurir (5 Personel)</option>
                  {MASTER_COURIERS.map((c, i) => (
                    <option key={i} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {(staticSearchQuery || staticFilterDay !== 'ALL' || staticFilterCourier !== 'ALL' || staticFilterCategory !== 'ALL') && (
                  <button
                    onClick={() => {
                      setStaticSearchQuery('');
                      setStaticFilterDay('ALL');
                      setStaticFilterCourier('ALL');
                      setStaticFilterCategory('ALL');
                    }}
                    className="text-xs text-rose-500 hover:text-rose-600 px-2 py-1 rounded-lg cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: KANBAN 5 HARI STATIS */}
          {staticViewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {DAYS_ORDER.map((day) => {
                const dayItems = filteredStaticItems.filter((item) => item.scheduledDay === day);
                const hasGajOnDay = day === 'SELASA' || day === 'KAMIS';

                return (
                  <div
                    key={day}
                    className="bg-card border border-border rounded-2xl flex flex-col min-h-[580px] shadow-2xs overflow-hidden transition-all duration-200"
                  >
                    {/* Header Hari */}
                    <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{day}</span>
                        {hasGajOnDay && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            + GAJ
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-background border border-border text-foreground">
                        {dayItems.length}
                      </span>
                    </div>

                    {/* Daftar Kartu Pengantaran Statis - Bersih: Cukup Nama Kapal Saja Tanpa Emblem */}
                    <div className="p-2 space-y-1.5 flex-1 overflow-y-auto">
                      {dayItems.map((item, idx) => {
                        const cleanDisplayName = item.shipName
                          .replace(/\s*\([^)]*Kantor Pusat[^)]*\)/gi, '')
                          .trim();

                        return (
                          <div
                            key={item.id}
                            className={`px-3 py-2 rounded-lg border text-xs transition-all duration-150 flex items-center justify-between gap-2 ${
                              item.isOfficeDestination
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-bold shadow-2xs'
                                : 'bg-background border-border hover:border-emerald-500/40 text-foreground hover:bg-muted/40 shadow-2xs'
                            }`}
                            title={cleanDisplayName}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono text-muted-foreground w-4 text-right shrink-0">
                                {idx + 1}.
                              </span>
                              <span
                                className={`truncate ${item.isOfficeDestination ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'font-medium'}`}
                              >
                                {cleanDisplayName}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE 2: TABEL MASTER LENGKAP (68 TUJUAN) */}
          {staticViewMode === 'table' && (
            <div className="bg-card border border-border rounded-2xl shadow-2xs overflow-hidden">
              <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Daftar Master Jadwal Pengantaran (66 Kapal + 2x Kantor GAJ)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Menampilkan {filteredStaticItems.length} rute terencana reguler mingguan.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Total: 68 Penugasan
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">No</th>
                      <th className="py-2.5 px-3">Hari Rutin</th>
                      <th className="py-2.5 px-3">Jam Slot</th>
                      <th className="py-2.5 px-4">Nama Armada / Tujuan</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-4">Lokasi Labuh / Dermaga</th>
                      <th className="py-2.5 px-3">Kurir Bertugas</th>
                      <th className="py-2.5 px-3">Kontak Kurir</th>
                      <th className="py-2.5 px-3 text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStaticItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/30 transition ${
                          item.isOfficeDestination ? 'bg-emerald-500/5 font-medium' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              item.scheduledDay === 'SELASA' || item.scheduledDay === 'KAMIS'
                                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {item.scheduledDay}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                          {item.timeSlot}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {item.isOfficeDestination ? (
                              <Building2 className="size-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Ship className="size-3.5 text-sky-500 shrink-0" />
                            )}
                            <span
                              className={`font-bold ${
                                item.isOfficeDestination ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                              }`}
                            >
                              {item.shipName.replace(/\s*\([^)]*Kantor Pusat[^)]*\)/gi, '').trim()}
                            </span>
                            {item.isOfficeDestination && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm bg-emerald-600 text-white">
                                2x/MGG
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                          {item.shipType}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                          <div className="flex items-center gap-1">
                            <MapPin className="size-3 text-rose-500 shrink-0" />
                            <span className="truncate max-w-xs">{item.defaultPosition}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-foreground">{item.assignedCourier.name}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                          {item.assignedCourier.phone}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleSendStaticWa(item)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-1 mx-auto"
                          >
                            <Send className="size-3" />
                            <span>Kirim WA</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: AI AUTO-SCHEDULER CONFIRMATION DINAMIS */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl relative space-y-4">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <span className="p-3 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white shadow-md">
                <Sparkles className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground">AI Delivery Route & Schedule Engine</h3>
                <p className="text-xs text-muted-foreground">
                  Penyusunan jadwal otomatis berbasis posisi koordinat pelabuhan & ketersediaan 5 personel kurir.
                </p>
              </div>
            </div>

            <div className="bg-muted/40 rounded-xl p-3.5 space-y-2 text-xs border border-border">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Bot className="size-4 text-indigo-500" />
                <span>Prinsip Algoritma Optimasi AI:</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground text-[11px] list-disc list-inside">
                <li>
                  <strong className="text-foreground">Senin:</strong> Prioritas kapal status Standby (SB) & paket SLA Mendesak (1-3 hari).
                </li>
                <li>
                  <strong className="text-foreground">Selasa:</strong> Kluster Dermaga Somber & Kawasan Industri Kariangau (rute searah).
                </li>
                <li>
                  <strong className="text-foreground">Rabu:</strong> Kluster Pelabuhan Semayang & Melawai Anchorage Point.
                </li>
                <li>
                  <strong className="text-foreground">Kamis:</strong> Kluster Luar Kota Muara Jawa & Samarinda dikonsolidasi satu armada.
                </li>
                <li>
                  <strong className="text-foreground">Jumat:</strong> Kapal Maintenance (MT), docking, & barang susulan penutup pekan.
                </li>
                <li>
                  <strong className="text-foreground">Distribusi Kurir:</strong> 5 staf delivery aktif dibagi seimbang rata tanpa tumpang tindih.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>Target Periode:</span>
              <span className="font-bold text-foreground">
                {selectedWeek === 'W1' ? 'Minggu Ini (W1: 09 - 13 Nov)' : 'Minggu Depan (W2: 16 - 20 Nov)'}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-background border border-border hover:bg-muted text-foreground cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleRunAiAutoScheduler}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Menyusun Jadwal...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span>Jalankan Penjadwalan AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT MANUAL JADWAL DINAMIS */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl relative space-y-4">
            <button
              onClick={() => {
                setIsManualModalOpen(false);
                setEditingItem(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Edit3 className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingItem ? 'Edit Jadwal Pengantaran' : 'Tambah Jadwal Pengantaran Manual'}
                </h3>
                <p className="text-xs text-muted-foreground">Tentukan kapal, hari penugasan, dan kurir logistik.</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Nama Armada Kapal *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Contoh: TB MAPAN 1405"
                    value={formData.shipName || ''}
                    onChange={(e) => setFormData({ ...formData, shipName: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                  />
                  {kapalPosisiItems.length > 0 && (
                    <select
                      onChange={(e) => {
                        const selected = kapalPosisiItems.find((k) => k.namaKapal === e.target.value);
                        if (selected) {
                          setFormData({
                            ...formData,
                            shipName: selected.namaKapal,
                            shipPosition: selected.posisi,
                            shipStatus: selected.statusKode,
                            detailStatus: selected.detailStatus || selected.activity,
                          });
                        }
                      }}
                      className="mt-1 w-full text-[11px] p-1.5 rounded-lg bg-muted border border-border text-foreground cursor-pointer"
                    >
                      <option value="">-- Atau Pilih Cepat dari Posisi Kapal Terkini --</option>
                      {kapalPosisiItems.map((k, idx) => (
                        <option key={idx} value={k.namaKapal}>
                          {k.namaKapal} ({k.posisi}) - {k.statusKode}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Lokasi Labuh / Posisi Kapal *</label>
                <input
                  type="text"
                  placeholder="Contoh: Pelabuhan Kariangau (Jetty Kaltim)"
                  value={formData.shipPosition || ''}
                  onChange={(e) => setFormData({ ...formData, shipPosition: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Hari Penugasan *</label>
                  <select
                    value={formData.scheduledDay}
                    onChange={(e) => {
                      const day = e.target.value as ScheduleDay;
                      const dObj = weekDates.find((w) => w.day === day);
                      setFormData({
                        ...formData,
                        scheduledDay: day,
                        scheduledDate: dObj?.date || '2026-11-09',
                      });
                    }}
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground cursor-pointer"
                  >
                    {DAYS_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Waktu Pengantaran *</label>
                  <select
                    value={formData.timeSlot}
                    onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value as DeliveryTimeSlot })}
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground cursor-pointer"
                  >
                    <option value="PAGI (08:00 - 11:30)">PAGI (08:00 - 11:30)</option>
                    <option value="SIANG (13:00 - 15:30)">SIANG (13:00 - 15:30)</option>
                    <option value="SORE (15:30 - 18:00)">SORE (15:30 - 18:00)</option>
                    <option value="FLEKSIBEL">FLEKSIBEL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Petugas Kurir *</label>
                  <select
                    value={formData.courier?.name}
                    onChange={(e) => {
                      const c = MASTER_COURIERS.find((x) => x.name === e.target.value);
                      if (c) setFormData({ ...formData, courier: c });
                    }}
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground cursor-pointer"
                  >
                    {MASTER_COURIERS.map((c, i) => (
                      <option key={i} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Tingkat Urgensi</label>
                  <select
                    value={formData.urgency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        urgency: e.target.value as 'NORMAL' | 'HIGH' | 'CRITICAL',
                      })
                    }
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground cursor-pointer"
                  >
                    <option value="NORMAL">🟢 Normal</option>
                    <option value="HIGH">🟠 Tinggi</option>
                    <option value="CRITICAL">🔴 Mendesak (1 Hari)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Nomor TTB (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: CPL-TTB-26-05800"
                    value={formData.noTtb || ''}
                    onChange={(e) => setFormData({ ...formData, noTtb: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Nomor FPB (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: CPL-FPB-26-0003829"
                    value={formData.noFpb || ''}
                    onChange={(e) => setFormData({ ...formData, noFpb: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Deskripsi Muatan / Barang</label>
                <input
                  type="text"
                  placeholder="Contoh: Filter Oli, Sparepart Mesin Induk, Tali Mooring..."
                  value={formData.itemDescription || ''}
                  onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan koordinat dermaga, kontak PIC di kapal, dll."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setIsManualModalOpen(false);
                  setEditingItem(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-background border border-border hover:bg-muted text-foreground cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!formData.shipName || !formData.shipPosition) {
                    showToast?.('Nama kapal dan lokasi posisi labuh wajib diisi!', 'warning');
                    return;
                  }

                  const dateObj = weekDates.find((w) => w.day === (formData.scheduledDay || 'SENIN'));
                  const itemToSave: DeliveryScheduleItem = {
                    id: editingItem ? editingItem.id : `manual-${Date.now()}`,
                    shipName: formData.shipName!,
                    cleanShipName: formData.shipName!,
                    shipPosition: formData.shipPosition!,
                    clusterArea: 'SOMBER_KARIANGAU',
                    shipStatus: formData.shipStatus || 'ON',
                    detailStatus: formData.detailStatus || 'Operasional',
                    noTtb: formData.noTtb,
                    noFpb: formData.noFpb,
                    itemDescription: formData.itemDescription,
                    urgency: formData.urgency || 'NORMAL',
                    targetWeek: selectedWeek,
                    scheduledDay: formData.scheduledDay || 'SENIN',
                    scheduledDate: dateObj?.date || '2026-11-09',
                    timeSlot: formData.timeSlot || 'PAGI (08:00 - 11:30)',
                    courier: formData.courier || MASTER_COURIERS[0],
                    transportMethod: formData.transportMethod || 'Diantar Tim Logistik',
                    status: formData.status || 'PLANNED',
                    notes: formData.notes,
                    scheduledBy: user?.name || 'Administrator CPG',
                    createdAt: editingItem?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };

                  handleSaveItem(itemToSave);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-xs cursor-pointer"
              >
                {editingItem ? 'Simpan Perubahan' : 'Tambahkan ke Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: POOL KAPAL BELUM TERJADWAL DINAMIS */}
      {isPoolDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border-l border-border max-w-md w-full h-full p-5 shadow-2xl flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Ship className="size-5 text-sky-500" />
                  <h3 className="text-base font-bold text-foreground">Pool Kapal Belum Terjadwal</h3>
                </div>
                <button
                  onClick={() => setIsPoolDrawerOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Daftar armada aktif dari Daily Report Posisi Kapal yang belum memiliki jadwal pengantaran di {selectedWeek}.
              </p>

              <div className="mt-4 space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
                {readyShipPool.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs">
                    Semua kapal sudah terjadwal di minggu ini! 🎉
                  </div>
                ) : (
                  readyShipPool.map((ship, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-background border border-border hover:border-sky-500/50 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{ship.namaKapal}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                          {ship.statusKode}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3 text-rose-500 shrink-0" />
                        <span className="truncate">{ship.posisi}</span>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground">Jadwalkan ke:</span>
                        <div className="flex items-center gap-1">
                          {DAYS_ORDER.map((day) => (
                            <button
                              key={day}
                              onClick={() => {
                                const dObj = weekDates.find((w) => w.day === day);
                                const courierIdx = idx % MASTER_COURIERS.length;
                                const newSched: DeliveryScheduleItem = {
                                  id: `pool-alloc-${Date.now()}-${idx}`,
                                  shipName: ship.namaKapal,
                                  cleanShipName: ship.namaKapal,
                                  shipPosition: ship.posisi,
                                  clusterArea: 'SOMBER_KARIANGAU',
                                  shipStatus: ship.statusKode,
                                  detailStatus: ship.detailStatus || ship.activity,
                                  urgency: ship.statusKode === 'SB' ? 'CRITICAL' : 'NORMAL',
                                  targetWeek: selectedWeek,
                                  scheduledDay: day,
                                  scheduledDate: dObj?.date || '2026-11-09',
                                  timeSlot: 'PAGI (08:00 - 11:30)',
                                  courier: MASTER_COURIERS[courierIdx],
                                  transportMethod: 'Diantar Tim Logistik',
                                  status: 'PLANNED',
                                  scheduledBy: user?.name || 'Administrator CPG',
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                };
                                handleSaveItem(newSched);
                              }}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted hover:bg-sky-500 hover:text-white transition cursor-pointer"
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                onClick={() => {
                  setIsPoolDrawerOpen(false);
                  setIsAiModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="size-4" />
                <span>Susun Otomatis Seluruh Pool dengan AI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
