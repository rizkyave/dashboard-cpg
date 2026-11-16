'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Ship,
  Wind,
  ShieldCheck,
  FileText,
  Pause,
  Play,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Radio,
  Wifi,
  WifiOff,
  ExternalLink,
  Info,
  X,
  Compass,
  AlertTriangle,
  Truck,
  CalendarCheck,
  PackageCheck,
  Navigation,
  Gauge,
} from 'lucide-react';
import { NewsTickerItem, NewsTickerResponse } from '@/types/newsTicker';

const CACHE_KEY = 'CPG_NEWS_TICKER_CACHE_V3';

// Fallback jika tidak ada internet sama sekali sejak pertama kali load
const DEFAULT_OFFLINE_ITEMS: NewsTickerItem[] = [
  {
    id: 'offline-ttb-1',
    category: 'STATUS TTB',
    badge: 'TTB ON-DELIVERY',
    title: 'CPL-TTB-26-07465 • TB KING STAR',
    content: 'Kurir: BARDI • Menuju Pelabuhan Semayang • Menunggu tanda tangan Nakhoda Abdul Rauf Wakano',
    highlight: 'PROSES ANTAR',
    timestamp: 'Offline Fallback',
    severity: 'warning',
  },
  {
    id: 'offline-ttb-2',
    category: 'STATUS TTB',
    badge: 'TTB ON-DELIVERY',
    title: 'MIL-TTB-26-00064 • MT DOMINO',
    content: 'Kurir: AKBAR RAMADHAN • Status: Menuju dermaga / Menunggu serah terima fisik & tanda tangan Mualim II',
    highlight: 'PROSES ANTAR',
    timestamp: 'Offline Fallback',
    severity: 'warning',
  },
  {
    id: 'offline-ttb-3',
    category: 'STATUS TTB',
    badge: 'TTB TERKIRIM',
    title: 'CPL-TTB-26-06278 • MT BLUE PETROL',
    content: 'Kurir: Hermansyah Herman • Berhasil diterima & ditandatangani oleh Nakhoda Kiky di Rede Balikpapan',
    highlight: 'SELESAI TERIMA',
    timestamp: 'Offline Fallback',
    severity: 'success',
  },
  {
    id: 'offline-sched-1',
    category: 'JADWAL PENGANTARAN',
    badge: 'DELIVERY SCHEDULE',
    title: 'Ke AJ PUTRA • Semayang Balikpapan',
    content: 'Jadwal: SENIN • Slot: PAGI (08:00 - 11:30) • Kurir: AGUSSALIM • Diantar Tim Logistik CPG',
    highlight: 'SENIN • AGUSSALIM',
    timestamp: 'Offline Fallback',
    severity: 'info',
  },
  {
    id: 'offline-sched-2',
    category: 'JADWAL PENGANTARAN',
    badge: 'DELIVERY SCHEDULE',
    title: 'Ke AMBER • Somber Kariangau',
    content: 'Jadwal: SENIN • Slot: SIANG (13:00 - 15:30) • Kurir: BARDI • Pengantaran material perawatan kapal',
    highlight: 'SENIN • BARDI',
    timestamp: 'Offline Fallback',
    severity: 'info',
  },
  {
    id: 'offline-sched-3',
    category: 'JADWAL PENGANTARAN',
    badge: 'DELIVERY SCHEDULE',
    title: 'Ke BARONGKO • Semayang Balikpapan',
    content: 'Jadwal: RABU • Slot: SIANG (13:00 - 15:30) • Kurir: ZULFIANSYAH • Pengantaran logistik & sparepart',
    highlight: 'RABU • ZULFIANSYAH',
    timestamp: 'Offline Fallback',
    severity: 'info',
  },
  {
    id: 'offline-armada-1',
    category: 'ARMADA',
    badge: 'CPG FLEET RADAR',
    title: 'Status Armada Aktif CPG',
    content: 'Total 33 Unit Kapal: 22 Beroperasi (ON), 7 Standby (SB), 3 Docking (DK).',
    highlight: '22 Beroperasi',
    timestamp: 'Offline Fallback',
    severity: 'marine',
  },
  {
    id: 'offline-armada-2',
    category: 'ARMADA',
    badge: 'ARMADA [ON]',
    title: 'TB Cindara 3112',
    content: 'Posisi: Kariangau Anchorage • Operasi Towing & Berthing Support Pelabuhan Balikpapan',
    highlight: 'OPERASIONAL',
    timestamp: 'Offline Fallback',
    severity: 'marine',
  },
  {
    id: 'offline-weather',
    category: 'CUACA',
    badge: 'BMKG MARITIM',
    title: 'Prakiraan Teluk Balikpapan',
    content: 'Kondusif Berawan, Suhu 28°C, Angin 6-10 kn, Tinggi Gelombang 0.4 - 0.7m. Aman untuk pengantaran kapal.',
    highlight: 'Kondusif • Gelombang Tenang',
    timestamp: 'Offline Fallback',
    severity: 'info',
  },
  {
    id: 'offline-sop',
    category: 'SOP CPG',
    badge: 'SOP PENGADAAN',
    title: 'Validasi Berjenjang TTB & FSTB',
    content: 'Setiap barang masuk wajib diverifikasi 4 PIC: Staff Logistik, Spv Logistik, Spv Purchasing, Mgr Procurement & pihak kapal.',
    highlight: 'Wajib 4 PIC',
    timestamp: 'Offline Fallback',
    severity: 'info',
  },
];

interface BottomNewsTickerProps {
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function BottomNewsTicker({ onCollapsedChange }: BottomNewsTickerProps) {
  const [items, setItems] = useState<NewsTickerItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speedMode, setSpeedMode] = useState<'relaxed' | 'slow' | 'normal'>('relaxed');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<NewsTickerItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Notify parent component about collapse state
  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      onCollapsedChange?.(next);
      return next;
    });
  };

  // Muat data dari localStorage (Offline Cache)
  const loadFromCache = (): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(parsed.items);
        setIsCached(true);
        if (parsed.timestamp) {
          const dt = new Date(parsed.timestamp);
          setCacheTimestamp(dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        }
        return true;
      }
    } catch (e) {
      console.warn('Gagal membaca cache news ticker:', e);
    }
    return false;
  };

  // Simpan data ke localStorage
  const saveToCache = (newItems: NewsTickerItem[]) => {
    try {
      if (typeof window === 'undefined') return;
      const payload = {
        items: newItems,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      setIsCached(false);
      setCacheTimestamp(null);
    } catch (e) {
      console.warn('Gagal menyimpan cache news ticker:', e);
    }
  };

  // Fetch dari API
  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/news-ticker', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NewsTickerResponse = await res.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items);
        saveToCache(data.items);
        setIsOnline(true);
        setIsCached(false);
      } else {
        throw new Error('Empty payload');
      }
    } catch {
      // Jika fetch gagal (koneksi putus / server offline), gunakan cache atau fallback
      const hasCache = loadFromCache();
      if (!hasCache) {
        setItems(DEFAULT_OFFLINE_ITEMS);
        setIsCached(true);
        setCacheTimestamp('Default Offline');
      }
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load & listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        fetchFeed();
      };

      const handleOffline = () => {
        setIsOnline(false);
        loadFromCache();
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Coba load cache dulu agar instan muncul (zero layout shift)
      loadFromCache();

      // Lalu fetch versi terbarunya
      fetchFeed();

      // Refresh berkala setiap 2 menit jika online
      const interval = setInterval(() => {
        if (navigator.onLine) {
          fetchFeed();
        }
      }, 120 * 1000);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(interval);
      };
    }
  }, []);

  // Duplicate items untuk continuous smooth scrolling
  const displayItems = useMemo(() => {
    if (items.length === 0) return DEFAULT_OFFLINE_ITEMS;
    return [...items, ...items];
  }, [items]);

  // Helper render ikon sesuai kategori
  const renderCategoryIcon = (category: string, severity?: string) => {
    switch (category) {
      case 'STATUS TTB':
        return severity === 'success' ? (
          <PackageCheck className="size-3.5 text-emerald-400 shrink-0" />
        ) : (
          <Truck className="size-3.5 text-amber-400 shrink-0" />
        );
      case 'JADWAL PENGANTARAN':
        return <CalendarCheck className="size-3.5 text-blue-400 shrink-0" />;
      case 'ARMADA':
        return <Ship className="size-3.5 text-cyan-400 shrink-0" />;
      case 'CUACA':
        return <Wind className="size-3.5 text-teal-400 shrink-0" />;
      case 'SOP CPG':
        return <FileText className="size-3.5 text-violet-400 shrink-0" />;
      case 'SAFETY':
        return <ShieldCheck className="size-3.5 text-purple-400 shrink-0" />;
      default:
        return <Radio className="size-3.5 text-cyan-400 shrink-0" />;
    }
  };

  // Helper render badge styling
  const getBadgeClass = (category: string, severity: string) => {
    if (category === 'STATUS TTB') {
      return severity === 'success'
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        : 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    if (category === 'JADWAL PENGANTARAN') {
      return severity === 'warning'
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
    if (category === 'ARMADA') {
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    }
    if (category === 'CUACA') {
      return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    }
    if (category === 'SOP CPG') {
      return 'bg-violet-500/20 text-violet-300 border-violet-500/40';
    }
    if (severity === 'success') {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  };

  // State collapsed: Mini Dock Pill di Pojok Kanan Bawah
  if (isCollapsed) {
    return (
      <div className="fixed bottom-2 right-3 sm:right-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/70 text-slate-300 hover:text-white backdrop-blur-xl shadow-2xl transition-all cursor-pointer active:scale-95"
          title="Buka kembali Live News Ticker CPG"
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-mono font-semibold tracking-wide text-cyan-300 group-hover:text-cyan-200">
            CPG LIVE FEED
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">&bull; {items.length} Update</span>
          <ChevronUp className="size-3.5 text-slate-400 group-hover:text-cyan-300 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Ticker Bar Full Width di Bawah Layar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 h-8 sm:h-9 bg-slate-950/92 border-t border-slate-800/80 backdrop-blur-xl flex items-center shadow-[0_-8px_25px_rgba(0,0,0,0.5)] select-none transition-all duration-300"
        role="region"
        aria-label="CPG Live Fleet & Maritime Weather Ticker"
      >
        {/* Left Anchor: Brand Badge & Status Online/Offline */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3.5 h-full bg-slate-900/90 border-r border-slate-800/90 shrink-0 z-10">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isOnline && !isCached ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline && !isCached ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wider text-cyan-300 uppercase whitespace-nowrap">
              LIVE FEED
            </span>
          </div>

          {/* Offline / Cached Pill */}
          {(!isOnline || isCached) && (
            <span
              className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300"
              title={cacheTimestamp ? `Data tersimpan offline (${cacheTimestamp})` : 'Mode offline aktif'}
            >
              <WifiOff className="size-2.5" />
              OFFLINE CACHE
            </span>
          )}
        </div>

        {/* Marquee Viewport */}
        <div
          className="relative flex-1 h-full overflow-hidden flex items-center group cursor-pointer"
          title="Klik pada kabar untuk melihat detail lengkap (Hover mouse untuk jeda gerakan)"
        >
          <div
            className={`animate-marquee flex items-center gap-6 sm:gap-8 px-4 ${
              isPaused ? 'is-paused' : ''
            }`}
            style={{
              animationDuration:
                speedMode === 'relaxed' ? '100s' : speedMode === 'slow' ? '140s' : '70s',
            }}
          >
            {displayItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                onClick={() => setSelectedItem(item)}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition group/item shrink-0 cursor-pointer"
              >
                {/* Category Icon */}
                {renderCategoryIcon(item.category, item.severity)}

                {/* Badge Category */}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${getBadgeClass(
                    item.category,
                    item.severity
                  )}`}
                >
                  {item.badge}
                </span>

                {/* Title */}
                <span className="font-semibold text-white group-hover/item:text-cyan-300 transition-colors">
                  {item.title}
                </span>

                {/* Separator */}
                <span className="text-slate-500">&bull;</span>

                {/* Content */}
                <span className="text-slate-300 text-[11px] max-w-[420px] truncate group-hover/item:text-slate-100">
                  {item.content}
                </span>

                {/* Optional Highlight Pill */}
                {item.highlight && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-slate-800/90 text-cyan-300 border border-slate-700/80">
                    {item.highlight}
                  </span>
                )}

                {/* Spacing Divider */}
                <span className="text-slate-700 select-none ml-2">/</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Controls: Pause/Play, Speed Toggle, Refresh, Collapse */}
        <div className="flex items-center gap-1 px-2 h-full bg-slate-900/90 border-l border-slate-800/90 shrink-0 z-10">
          {/* Pause / Play */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
            title={isPaused ? 'Lanjutkan gerakan teks (Play)' : 'Jeda gerakan teks (Pause)'}
          >
            {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={() =>
              setSpeedMode((prev) =>
                prev === 'relaxed' ? 'slow' : prev === 'slow' ? 'normal' : 'relaxed'
              )
            }
            className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition cursor-pointer flex items-center gap-1"
            title={`Kecepatan: ${
              speedMode === 'relaxed'
                ? 'Santai / Perlahan (100 detik)'
                : speedMode === 'slow'
                ? 'Sangat Lambat (140 detik)'
                : 'Cepat (70 detik)'
            } • Klik untuk mengganti kecepatan`}
          >
            <Gauge className="size-3 text-cyan-400" />
            <span className="hidden sm:inline">
              {speedMode === 'relaxed' ? 'Santai' : speedMode === 'slow' ? 'Pelan' : 'Cepat'}
            </span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchFeed}
            disabled={isLoading}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer disabled:opacity-50"
            title="Perbarui kabar armada & cuaca sekarang"
          >
            <RotateCw className={`size-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Minimize / Collapse */}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
            title="Sembunyikan ke pojok bawah (Minimize)"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Detail Saat Salah Satu Kabar Diklik */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {renderCategoryIcon(selectedItem.category, selectedItem.severity)}
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getBadgeClass(
                      selectedItem.category,
                      selectedItem.severity
                    )}`}
                  >
                    {selectedItem.badge}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1">{selectedItem.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-xs space-y-3 leading-relaxed text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200">
                {selectedItem.content}
              </div>

              {selectedItem.highlight && (
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400 font-mono">Status Ringkas:</span>
                  <span className="font-semibold text-cyan-300 font-mono bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/50">
                    {selectedItem.highlight}
                  </span>
                </div>
              )}

              {selectedItem.timestamp && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">Pembaruan:</span>
                  <span className="text-slate-300 font-mono">{selectedItem.timestamp}</span>
                </div>
              )}

              <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-800/80">
                Sumber: CPG Maritime Network &amp; Sistem Pengadaan Terintegrasi PT Cindara Pratama Lines
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
