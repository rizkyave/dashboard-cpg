'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  Filter,
  Layers,
  Loader2,
  MessageCircle,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Ship,
  Sparkles,
  Truck,
  User,
  X,
  Download,
  Printer,
  ChevronRight,
  ChevronLeft,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { AppNotification, NotificationType } from '@/types/notification';
import { TabType } from '@/types/procurement';
import { useAuth } from '@/context/AuthContext';
import { generateDirectWaLink } from '@/utils/whatsappNotifier';

interface NotificationCenterTabProps {
  onNavigateTab?: (tab: TabType) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type DivisionCategory = 'ALL' | 'PURCHASING' | 'MANAGEMENT' | 'LOGISTIK' | 'KAPAL';

// Interface Bukti Foto TTB (Logistik & End User Kapal)
interface TtbPhotoItem {
  name: string;
  url: string;
  takenAt?: string | null;
  source: 'remote_handover' | 'filename_match' | 'serah_terima_history';
  receiverName?: string;
  armada?: string;
  deliveryMethod?: string;
}

export default function NotificationCenterTab({
  onNavigateTab,
  showToast,
}: NotificationCenterTabProps) {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filter States
  const [selectedDivision, setSelectedDivision] = useState<DivisionCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [selectedArmada, setSelectedArmada] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal State Bukti Lampiran Foto (Pihak Logistik & Pihak End User)
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    noTtb: string;
    armada: string;
    isLoading: boolean;
    activeFilter: 'ALL' | 'LOGISTIK' | 'END_USER';
    photos: TtbPhotoItem[];
    selectedPhotoIndex: number;
    error: string | null;
  }>({
    isOpen: false,
    noTtb: '',
    armada: '',
    isLoading: false,
    activeFilter: 'ALL',
    photos: [],
    selectedPhotoIndex: 0,
    error: null,
  });

  // Handler Buka Modal Bukti Foto TTB
  const handleOpenPhotos = async (notif: AppNotification) => {
    const targetTtb = notif.metadata?.noTtb || '';
    if (!targetTtb) {
      showToast?.('Nomor TTB tidak ditemukan pada notifikasi ini.', 'warning');
      return;
    }

    setPhotoModal({
      isOpen: true,
      noTtb: targetTtb,
      armada: notif.metadata?.armada || '',
      isLoading: true,
      activeFilter: 'ALL',
      photos: [],
      selectedPhotoIndex: 0,
      error: null,
    });

    try {
      const res = await fetch(`/api/ttb-photos?ttb=${encodeURIComponent(targetTtb)}&bust=${Date.now()}`);
      if (!res.ok) throw new Error('Gagal mengambil berkas foto TTB');
      const data = await res.json();
      const list: TtbPhotoItem[] = Array.isArray(data.photos) ? data.photos : [];
      setPhotoModal((prev) => ({
        ...prev,
        isLoading: false,
        photos: list,
        selectedPhotoIndex: 0,
        error: list.length === 0 ? 'Belum ada bukti lampiran foto fisik yang diunggah untuk TTB ini.' : null,
      }));
    } catch {
      setPhotoModal((prev) => ({
        ...prev,
        isLoading: false,
        photos: [],
        error: 'Terjadi kendala saat memuat lampiran foto fisik TTB.',
      }));
    }
  };

    // PDF Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    noDoc: string;
    docType: 'TTB' | 'FSTB';
    fileUrl: string | null;
    isLoading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    title: '',
    noDoc: '',
    docType: 'TTB',
    fileUrl: null,
    isLoading: false,
    error: null,
  });

  // Filter foto berdasarkan pihak (Logistik vs End User)
  const filteredModalPhotos = useMemo(() => {
    if (photoModal.activeFilter === 'LOGISTIK') {
      return photoModal.photos.filter((p) => p.source !== 'remote_handover');
    }
    if (photoModal.activeFilter === 'END_USER') {
      return photoModal.photos.filter((p) => p.source === 'remote_handover');
    }
    return photoModal.photos;
  }, [photoModal.photos, photoModal.activeFilter]);

  const countLogistik = useMemo(
    () => photoModal.photos.filter((p) => p.source !== 'remote_handover').length,
    [photoModal.photos]
  );
  const countEndUser = useMemo(
    () => photoModal.photos.filter((p) => p.source === 'remote_handover').length,
    [photoModal.photos]
  );

  const activePhoto = filteredModalPhotos[photoModal.selectedPhotoIndex] || filteredModalPhotos[0] || null;

  // 1. Fetch Notifikasi dari API
  const fetchNotifications = async (isManual = false) => {
    if (!user) return;
    if (isManual) setIsRefreshing(true);
    else if (notifications.length === 0) setIsLoading(true);

    try {
      const res = await fetch(
        `/api/notifications?username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(
          user.role
        )}&_t=${Date.now()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
          if (isManual) {
            showToast?.('Data notifikasi berhasil disegarkan.', 'success');
          }
        }
      }
    } catch (err) {
      if (isManual) {
        showToast?.('Gagal menyegarkan data notifikasi.', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(() => fetchNotifications(false), 20000);
    return () => clearInterval(timer);
  }, [user]);

  // 2. Mark as read / unread
  const toggleReadStatus = async (notifId: string, currentIsRead: boolean) => {
    if (!user) return;
    const action = currentIsRead ? 'MARK_AS_UNREAD' : 'MARK_AS_READ';

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notificationId: notifId,
          username: user.username,
        }),
      });

      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notifId) return n;
          const newReadBy = currentIsRead
            ? n.readBy.filter((u) => u !== user.username)
            : [...n.readBy, user.username];
          return { ...n, readBy: newReadBy };
        })
      );

      setUnreadCount((prev) => (currentIsRead ? prev + 1 : Math.max(0, prev - 1)));
      showToast?.(
        currentIsRead ? 'Notifikasi ditandai belum dibaca.' : 'Notifikasi ditandai telah dibaca.',
        'info'
      );
    } catch {
      showToast?.('Gagal memperbarui status notifikasi.', 'error');
    }
  };

  // 3. Mark all as read
  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    setIsRefreshing(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MARK_AS_READ',
          notificationId: 'ALL',
          username: user.username,
        }),
      });

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readBy: n.readBy.includes(user.username) ? n.readBy : [...n.readBy, user.username],
        }))
      );
      setUnreadCount(0);
      showToast?.('Semua notifikasi berhasil ditandai telah dibaca.', 'success');
    } catch {
      showToast?.('Gagal menandai semua notifikasi.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 4. Klasifikasi Unit Kerja berdasarkan NotificationType
  const getNotificationDivision = (type?: NotificationType): DivisionCategory => {
    switch (type) {
      case 'FSTB_UPLOADED':
        return 'PURCHASING';
      case 'FSTB_VALIDATED':
      case 'TTB_VALIDATED':
        return 'MANAGEMENT';
      case 'TTB_UPLOADED':
      case 'TTB_DISPATCHED':
        return 'LOGISTIK';
      case 'SERAH_TERIMA_COMPLETED':
        return 'KAPAL';
      default:
        return 'LOGISTIK';
    }
  };

  const getDivisionBadgeInfo = (div: DivisionCategory) => {
    switch (div) {
      case 'PURCHASING':
        return {
          label: 'Pengadaan / Purchasing',
          icon: <Package className="size-3" />,
          colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
      case 'MANAGEMENT':
        return {
          label: 'Manajemen & Validasi',
          icon: <ShieldCheck className="size-3" />,
          colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        };
      case 'LOGISTIK':
        return {
          label: 'Logistik & Disposisi',
          icon: <Truck className="size-3" />,
          colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'KAPAL':
        return {
          label: 'Kru Kapal & Lapangan',
          icon: <Ship className="size-3" />,
          colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      default:
        return {
          label: 'Umum / Operasional',
          icon: <Layers className="size-3" />,
          colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        };
    }
  };

  const getTypeStyle = (type?: NotificationType) => {
    switch (type) {
      case 'FSTB_UPLOADED':
        return {
          icon: <Package className="size-4.5" />,
          bgClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
          titleColor: 'text-amber-700 dark:text-amber-300',
        };
      case 'FSTB_VALIDATED':
        return {
          icon: <FileSignature className="size-4.5" />,
          bgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          titleColor: 'text-emerald-700 dark:text-emerald-300',
        };
      case 'TTB_UPLOADED':
        return {
          icon: <PackageCheck className="size-4.5" />,
          bgClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
          titleColor: 'text-blue-700 dark:text-blue-300',
        };
      case 'TTB_VALIDATED':
        return {
          icon: <ShieldCheck className="size-4.5" />,
          bgClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
          titleColor: 'text-indigo-700 dark:text-indigo-300',
        };
      case 'TTB_DISPATCHED':
        return {
          icon: <Truck className="size-4.5" />,
          bgClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
          titleColor: 'text-sky-700 dark:text-sky-300',
        };
      case 'SERAH_TERIMA_COMPLETED':
        return {
          icon: <CheckCircle2 className="size-4.5" />,
          bgClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
          titleColor: 'text-teal-700 dark:text-teal-300',
        };
      default:
        return {
          icon: <Bell className="size-4.5" />,
          bgClass: 'bg-primary/15 text-primary border-primary/30',
          titleColor: 'text-primary',
        };
    }
  };

  // 5. Resolusi Dokumen PDF saat tombol Buka Dokumen diklik
  const handleOpenDocument = async (notif: AppNotification) => {
    const noTtb = notif.metadata?.noTtb;
    const noFstb = notif.metadata?.noFstb;
    const targetDoc = noTtb || noFstb;

    if (!targetDoc) {
      if (notif.linkTab && onNavigateTab) {
        onNavigateTab(notif.linkTab as TabType);
      }
      return;
    }

    const docType = noTtb ? 'TTB' : 'FSTB';
    const cleanDoc = targetDoc.replace(/[^a-zA-Z0-9_-]/g, '');

    setPreviewDoc({
      isOpen: true,
      title: `${docType}: ${targetDoc}`,
      noDoc: targetDoc,
      docType,
      fileUrl: null,
      isLoading: true,
      error: null,
    });

    try {
      let resolvedUrl: string | null = null;

      if (noTtb) {
        // Cek riwayat TTB R2
        const resTtb = await fetch(`/api/upload-ttb?ttb=${encodeURIComponent(cleanDoc)}&_t=${Date.now()}`);
        if (resTtb.ok) {
          const dataTtb = await resTtb.json();
          if (dataTtb.success && Array.isArray(dataTtb.items) && dataTtb.items.length > 0) {
            const found = dataTtb.items.find((d: any) => d.fileUrl) || dataTtb.items[0];
            if (found?.fileUrl) resolvedUrl = found.fileUrl;
          }
        }

        // Cek validasi dokumen R2 jika belum ketemu
        if (!resolvedUrl) {
          const resVal = await fetch(`/api/validasi-dokumen?type=TTB&q=${encodeURIComponent(cleanDoc)}&_t=${Date.now()}`);
          if (resVal.ok) {
            const dataVal = await resVal.json();
            if (dataVal.success && Array.isArray(dataVal.records) && dataVal.records.length > 0) {
              const found = dataVal.records.find((d: any) => d.fileUrl) || dataVal.records[0];
              if (found?.fileUrl) resolvedUrl = found.fileUrl;
            }
          }
        }
      } else if (noFstb) {
        // Cek FSTB
        const resFstb = await fetch(`/api/validasi-dokumen?type=FSTB&q=${encodeURIComponent(cleanDoc)}&_t=${Date.now()}`);
        if (resFstb.ok) {
          const dataFstb = await resFstb.json();
          if (dataFstb.success && Array.isArray(dataFstb.records) && dataFstb.records.length > 0) {
            const found = dataFstb.records.find((d: any) => d.fileUrl) || dataFstb.records[0];
            if (found?.fileUrl) resolvedUrl = found.fileUrl;
          }
        }
      }

      if (resolvedUrl) {
        setPreviewDoc((prev) => ({
          ...prev,
          fileUrl: resolvedUrl,
          isLoading: false,
          error: null,
        }));
      } else {
        // Fallback langsung ke API R2 atau r2-file
        const fallbackUrl = `/api/r2-file?key=ttb-documents/${encodeURIComponent(cleanDoc)}.pdf`;
        setPreviewDoc((prev) => ({
          ...prev,
          fileUrl: fallbackUrl,
          isLoading: false,
          error: null,
        }));
      }
    } catch (err) {
      setPreviewDoc((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Gagal memuat pratinjau berkas scan PDF resmi.',
      }));
    }
  };

  // Navigasi ke Modul Terkait
  const handleNavigateToModule = (notif: AppNotification) => {
    if (!onNavigateTab) return;
    if (notif.linkTab) {
      onNavigateTab(notif.linkTab as TabType);
      return;
    }
    switch (notif.type) {
      case 'FSTB_UPLOADED':
        onNavigateTab('upload-fstb');
        break;
      case 'FSTB_VALIDATED':
      case 'TTB_VALIDATED':
        onNavigateTab('validasi-dokumen');
        break;
      case 'TTB_UPLOADED':
        onNavigateTab('upload-ttb');
        break;
      case 'TTB_DISPATCHED':
      case 'SERAH_TERIMA_COMPLETED':
        onNavigateTab('serah-terima-lapangan');
        break;
      default:
        onNavigateTab('overview');
    }
  };

  // 6. Daftar Armada Unik dari Data Notifikasi
  const uniqueArmadaList = useMemo(() => {
    const setArmada = new Set<string>();
    notifications.forEach((n) => {
      if (n.metadata?.armada && n.metadata.armada.trim() !== '-') {
        setArmada.add(n.metadata.armada.trim());
      }
    });
    return Array.from(setArmada).sort();
  }, [notifications]);

  // 7. Filtering Notifikasi
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // Filter Divisi / Seksi
      if (selectedDivision !== 'ALL') {
        const div = getNotificationDivision(notif.type);
        if (div !== selectedDivision) return false;
      }

      // Filter Status Baca
      const isRead = Boolean(user && notif.readBy.includes(user.username));
      if (statusFilter === 'UNREAD' && isRead) return false;
      if (statusFilter === 'READ' && !isRead) return false;

      // Filter Armada
      if (selectedArmada !== 'ALL') {
        if (notif.metadata?.armada !== selectedArmada) return false;
      }

      // Search Keyword
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchTitle = notif.title.toLowerCase().includes(q);
        const matchMsg = notif.message.toLowerCase().includes(q);
        const matchTtb = notif.metadata?.noTtb?.toLowerCase().includes(q);
        const matchFstb = notif.metadata?.noFstb?.toLowerCase().includes(q);
        const matchPo = notif.metadata?.noPo?.toLowerCase().includes(q);
        const matchFpb = notif.metadata?.noFpb?.toLowerCase().includes(q);
        const matchArmada = notif.metadata?.armada?.toLowerCase().includes(q);
        const matchSender = notif.senderName?.toLowerCase().includes(q);
        const matchRecipient = notif.metadata?.recipientName?.toLowerCase().includes(q);
        const matchCarrier = notif.metadata?.carrierContact?.toLowerCase().includes(q);

        if (
          !matchTitle &&
          !matchMsg &&
          !matchTtb &&
          !matchFstb &&
          !matchPo &&
          !matchFpb &&
          !matchArmada &&
          !matchSender &&
          !matchRecipient &&
          !matchCarrier
        ) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, selectedDivision, statusFilter, selectedArmada, searchKeyword, user]);

  // Metrics Count
  const metrics = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !user || !n.readBy.includes(user.username)).length;
    const dispatched = notifications.filter((n) => n.type === 'TTB_DISPATCHED').length;
    const completed = notifications.filter((n) => n.type === 'SERAH_TERIMA_COMPLETED').length;
    const validated = notifications.filter(
      (n) => n.type === 'TTB_VALIDATED' || n.type === 'FSTB_VALIDATED'
    ).length;
    return { total, unread, dispatched, completed, validated };
  }, [notifications, user]);

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} hari lalu`;
    } catch {
      return '';
    }
  };

  const formatExactTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ' ' +
        d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WITA'
      );
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ── HEADER HALAMAN ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="size-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <BellRing className="size-5.5 animate-bounce-subtle" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Pusat Notifikasi &amp; Log Aktivitas Pekerjaan
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                Realtime Sync Aktif
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Monitoring riwayat pekerjaan operasional, alur disposisi, pengesahan dokumen, dan serah terima kapal secara terpusat lintas seksi unit kerja.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchNotifications(true)}
            disabled={isRefreshing}
            className="h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Segarkan Notifikasi dari Server"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          {metrics.unread > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={isRefreshing}
              className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-primary-foreground transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm shadow-primary/20 active:scale-98"
            >
              <CheckCheck className="size-4" />
              <span>Tandai Semua Dibaca ({metrics.unread})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── METRICS SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Notifikasi */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Total Notifikasi</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-foreground font-mono mt-0.5">
              {metrics.total}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Seluruh riwayat kerja</p>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Layers className="size-5" />
          </div>
        </div>

        {/* Card 2: Belum Dibaca */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Belum Dibaca</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-rose-500 font-mono mt-0.5">
              {metrics.unread}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Perlu perhatian Anda</p>
          </div>
          <div className="size-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
            <Bell className="size-5" />
          </div>
        </div>

        {/* Card 3: Disposisi & Ekspedisi */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Disposisi &amp; Titipan</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-sky-500 font-mono mt-0.5">
              {metrics.dispatched}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Barang dalam perjalanan</p>
          </div>
          <div className="size-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
            <Truck className="size-5" />
          </div>
        </div>

        {/* Card 4: Serah Terima Selesai */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Serah Terima Sah (TTD)</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-500 font-mono mt-0.5">
              {metrics.completed}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Diterima lengkap di kapal</p>
          </div>
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
        </div>
      </div>

      {/* ── KLASIFIKASI SEKSI / UNIT KERJA (INTERACTIVE TABS) ── */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          {/* Tab ALL */}
          <button
            type="button"
            onClick={() => setSelectedDivision('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              selectedDivision === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Layers className="size-3.5" />
            <span>Semua Seksi</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDivision === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {notifications.length}
            </span>
          </button>

          {/* Tab Purchasing */}
          <button
            type="button"
            onClick={() => setSelectedDivision('PURCHASING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              selectedDivision === 'PURCHASING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Package className="size-3.5 text-amber-400" />
            <span>Pengadaan / Purchasing</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDivision === 'PURCHASING'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {notifications.filter((n) => getNotificationDivision(n.type) === 'PURCHASING').length}
            </span>
          </button>

          {/* Tab Management / Approval */}
          <button
            type="button"
            onClick={() => setSelectedDivision('MANAGEMENT')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              selectedDivision === 'MANAGEMENT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <ShieldCheck className="size-3.5 text-indigo-400" />
            <span>Manajemen &amp; Pengesahan</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDivision === 'MANAGEMENT'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {notifications.filter((n) => getNotificationDivision(n.type) === 'MANAGEMENT').length}
            </span>
          </button>

          {/* Tab Logistik */}
          <button
            type="button"
            onClick={() => setSelectedDivision('LOGISTIK')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              selectedDivision === 'LOGISTIK'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Truck className="size-3.5 text-blue-400" />
            <span>Logistik &amp; Disposisi</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDivision === 'LOGISTIK'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {notifications.filter((n) => getNotificationDivision(n.type) === 'LOGISTIK').length}
            </span>
          </button>

          {/* Tab Kru Kapal */}
          <button
            type="button"
            onClick={() => setSelectedDivision('KAPAL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              selectedDivision === 'KAPAL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Ship className="size-3.5 text-emerald-400" />
            <span>Kru Kapal &amp; Lapangan</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDivision === 'KAPAL'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {notifications.filter((n) => getNotificationDivision(n.type) === 'KAPAL').length}
            </span>
          </button>
        </div>

        {/* ── BAR PENCARIAN & FILTER TAMBAHAN ── */}
        <div className="pt-2 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Cari No. TTB, PO, FPB, Armada, Kru Penerima, atau Petugas..."
              className="w-full text-xs pl-8.5 pr-8 py-2 rounded-xl bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Status Baca */}
            <div className="inline-flex rounded-xl p-0.5 bg-muted border border-border text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('UNREAD')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'UNREAD'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Belum Dibaca</span>
                {metrics.unread > 0 && (
                  <span className="size-1.5 rounded-full bg-rose-500 inline-block" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('READ')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  statusFilter === 'READ'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sudah Dibaca
              </button>
            </div>

            {/* Filter Armada Kapal */}
            {uniqueArmadaList.length > 0 && (
              <select
                value={selectedArmada}
                onChange={(e) => setSelectedArmada(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Semua Armada ({uniqueArmadaList.length} Kapal)</option>
                {uniqueArmadaList.map((armada) => (
                  <option key={armada} value={armada}>
                    🚢 {armada}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── DAFTAR NOTIFIKASI PEKERJAAN (LIST VIEW) ── */}
      <div className="space-y-3">
        {isLoading && notifications.length === 0 ? (
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3 shadow-xs">
            <Loader2 className="size-8 text-primary animate-spin mx-auto" />
            <p className="text-xs font-semibold text-foreground">Memuat Notifikasi Pekerjaan...</p>
            <p className="text-[11px] text-muted-foreground">Mengambil riwayat log kerja dari Cloudflare R2</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3 shadow-xs">
            <Sparkles className="size-10 text-muted-foreground/30 mx-auto" />
            <h4 className="text-sm font-bold text-foreground">Tidak Ada Notifikasi yang Sesuai</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {searchKeyword || selectedDivision !== 'ALL' || statusFilter !== 'ALL' || selectedArmada !== 'ALL'
                ? 'Tidak ditemukan notifikasi pekerjaan dengan kriteria filter saat ini. Coba ubah atau reset filter Anda.'
                : 'Belum ada notifikasi pekerjaan yang tercatat di sistem. Semua pekerjaan telah selesai dan mutakhir.'}
            </p>
            {(searchKeyword || selectedDivision !== 'ALL' || statusFilter !== 'ALL' || selectedArmada !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDivision('ALL');
                  setStatusFilter('ALL');
                  setSelectedArmada('ALL');
                  setSearchKeyword('');
                }}
                className="mt-2 px-3 py-1.5 rounded-xl bg-muted hover:bg-card border border-border text-xs font-semibold text-foreground transition cursor-pointer"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = Boolean(!user || !notif.readBy.includes(user.username));
            const div = getNotificationDivision(notif.type);
            const divInfo = getDivisionBadgeInfo(div);
            const typeStyle = getTypeStyle(notif.type);

            const hasDocument = Boolean(notif.metadata?.noTtb || notif.metadata?.noFstb);

            const waLink = generateDirectWaLink({
              type: notif.type,
              noFstb: notif.metadata?.noFstb,
              noTtb: notif.metadata?.noTtb,
              armada: notif.metadata?.armada,
              noPo: notif.metadata?.noPo,
              noFpb: notif.metadata?.noFpb,
              uploaderName: notif.senderName,
              uploaderRole: notif.senderRole,
              itemSummary: notif.metadata?.itemSummary,
              recipientName: notif.metadata?.recipientName,
              recipientRole: notif.metadata?.recipientRole,
              courierName: notif.metadata?.courierName,
              carrierContact: notif.metadata?.carrierContact,
              shippingMethod: notif.metadata?.shippingMethod,
              notes: notif.metadata?.notes,
            });

            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-150 shadow-xs relative ${
                  isUnread
                    ? 'bg-card border-primary/40 shadow-primary/5 ring-1 ring-primary/20'
                    : 'bg-card/70 border-border hover:border-border/80 hover:bg-card'
                }`}
              >
                {/* Unread Top-Left Glow Indicator */}
                {isUnread && (
                  <span className="absolute top-3 right-3 size-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse" />
                )}

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Column: Icon + Core Content */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Icon Type */}
                    <div
                      className={`size-10 sm:size-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${typeStyle.bgClass}`}
                    >
                      {typeStyle.icon}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Header Line: Badges & Timestamp */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Division Tag */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-semibold text-[10px] border ${divInfo.colorClass}`}
                        >
                          {divInfo.icon}
                          <span>{divInfo.label}</span>
                        </span>

                        {/* Relative & Exact Time */}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{formatRelativeTime(notif.createdAt)}</span>
                          <span className="text-muted-foreground/40">&bull;</span>
                          <span className="font-mono text-[10px]">{formatExactTime(notif.createdAt)}</span>
                        </span>
                      </div>

                      {/* Notification Title */}
                      <h3 className={`text-sm sm:text-base font-bold leading-snug ${typeStyle.titleColor}`}>
                        {notif.title.replace(/\s*via Pihak Ketiga \/ Remote/gi, '').replace(/\s*\(Remote \/ Pihak Ketiga\)/gi, '')}
                      </h3>

                      {/* Notification Message */}
                      <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                        {notif.message}
                      </p>

                      {/* Metadata Chips Grid */}
                      <div className="pt-1.5 flex items-center gap-2 flex-wrap text-xs">
                        {notif.metadata?.noTtb && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[11px]">
                            <FileText className="size-3" />
                            <span>TTB: {notif.metadata.noTtb}</span>
                          </div>
                        )}

                        {notif.metadata?.noFstb && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold text-[11px]">
                            <Package className="size-3" />
                            <span>FSTB: {notif.metadata.noFstb}</span>
                          </div>
                        )}

                        {notif.metadata?.armada && notif.metadata.armada !== '-' && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                            <Ship className="size-3 text-blue-500" />
                            <span>{notif.metadata.armada}</span>
                          </div>
                        )}

                        {notif.metadata?.noPo && (
                          <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                            PO: {notif.metadata.noPo}
                          </span>
                        )}

                        {notif.metadata?.noFpb && (
                          <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                            FPB: {notif.metadata.noFpb}
                          </span>
                        )}

                        {notif.senderName && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <User className="size-3" />
                            <span>Oleh: <strong className="text-foreground">{notif.senderName}</strong></span>
                          </span>
                        )}

                        {notif.metadata?.recipientName && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Penerima: {notif.metadata.recipientName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Direct Interactive Actions */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Tombol Buka Dokumen Terkait */}
                      {hasDocument && (
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(notif)}
                          className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 active:scale-98"
                          title="Buka Berkas Scan PDF Resmi"
                        >
                          <FileText className="size-3.5" />
                          <span>Buka Dokumen</span>
                        </button>
                      )}

                      {/* Tombol Buka di Tab Modul */}
                      <button
                        type="button"
                        onClick={() => handleNavigateToModule(notif)}
                        className="h-8 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        title="Buka Modul Spesifik di Dashboard"
                      >
                        <ExternalLink className="size-3" />
                        <span>Modul Terkait</span>
                      </button>

                      {/* Tombol Bukti Foto Fisik (Pihak Logistik & End User) */}
                      {Boolean(notif.metadata?.noTtb) && (
                        <button
                          type="button"
                          onClick={() => handleOpenPhotos(notif)}
                          className="h-8 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-teal-600/20 active:scale-98"
                          title="Lihat Bukti Foto Fisik TTB (Pihak Logistik & Pihak Kapal/End User)"
                        >
                          <Camera className="size-3.5" />
                          <span>Bukti Foto</span>
                        </button>
                      )}

                      {/* Tombol Kirim ke WhatsApp */}
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-98"
                        title="Kirim pesan rincian pekerjaan langsung ke WhatsApp PIC"
                      >
                        <MessageCircle className="size-3.5" />
                        <span>Kirim WA</span>
                      </a>

                      {/* Toggle Read / Unread Status */}
                      <button
                        type="button"
                        onClick={() => toggleReadStatus(notif.id, !isUnread)}
                        className={`size-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                          isUnread
                            ? 'bg-muted/80 hover:bg-muted border-border text-foreground'
                            : 'bg-background hover:bg-muted border-border text-muted-foreground'
                        }`}
                        title={isUnread ? 'Tandai sudah dibaca' : 'Tandai belum dibaca'}
                      >
                        {isUnread ? <Check className="size-4 text-emerald-600" /> : <EyeOff className="size-3.5" />}
                      </button>
                    </div>

                    <span className="text-[10px] text-muted-foreground/60 hidden md:inline">
                      ID: {notif.id.slice(0, 12)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>


      {/* ── MODAL GALERI BUKTI FOTO FISIK TTB (LOGISTIK & END USER) ── */}
      {photoModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-3.5 bg-muted/60 border-b border-border flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Camera className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      Bukti Foto Fisik TTB: <span className="font-mono text-teal-600 dark:text-teal-400">{photoModal.noTtb}</span>
                    </h3>
                    {photoModal.armada && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300">
                        <Ship className="size-3" />
                        <span>{photoModal.armada}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Dokumentasi Fisik Barang dari Pihak Logistik &amp; Pihak End User (Kru Kapal)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activePhoto && (
                  <>
                    <a
                      href={activePhoto.url}
                      download={activePhoto.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      title="Unduh Berkas Foto"
                    >
                      <Download className="size-3.5" />
                      <span className="hidden sm:inline">Unduh</span>
                    </a>
                    <a
                      href={activePhoto.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Buka Foto Resolusi Asli di Tab Baru"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="hidden sm:inline">Tab Baru</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPhotoModal((prev) => ({ ...prev, isOpen: false, photos: [] }))}
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Filter Tab: Semua, Pihak Logistik, Pihak End User */}
            <div className="px-5 py-2.5 bg-background border-b border-border flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="inline-flex rounded-xl p-0.5 bg-muted border border-border text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setPhotoModal((prev) => ({ ...prev, activeFilter: 'ALL', selectedPhotoIndex: 0 }))
                  }
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    photoModal.activeFilter === 'ALL'
                      ? 'bg-background text-foreground shadow-2xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Semua Foto ({photoModal.photos.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPhotoModal((prev) => ({ ...prev, activeFilter: 'LOGISTIK', selectedPhotoIndex: 0 }))
                  }
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    photoModal.activeFilter === 'LOGISTIK'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Truck className="size-3" />
                  <span>Pihak Logistik ({countLogistik})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPhotoModal((prev) => ({ ...prev, activeFilter: 'END_USER', selectedPhotoIndex: 0 }))
                  }
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    photoModal.activeFilter === 'END_USER'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Ship className="size-3" />
                  <span>Pihak Kapal / End User ({countEndUser})</span>
                </button>
              </div>

              {filteredModalPhotos.length > 1 && (
                <div className="text-xs text-muted-foreground">
                  Foto {photoModal.selectedPhotoIndex + 1} dari {filteredModalPhotos.length}
                </div>
              )}
            </div>

            {/* Konten Foto View */}
            <div className="flex-1 bg-slate-950 relative min-h-0 flex flex-col justify-center items-center overflow-hidden">
              {photoModal.isLoading ? (
                <div className="p-8 text-center text-white space-y-3">
                  <Loader2 className="size-8 animate-spin text-teal-400 mx-auto" />
                  <p className="text-xs font-semibold">Mengambil Bukti Lampiran Foto...</p>
                  <p className="text-[11px] text-slate-400">Sinkronisasi Cloudflare R2 &amp; Riwayat Serah Terima</p>
                </div>
              ) : photoModal.error || filteredModalPhotos.length === 0 ? (
                <div className="p-8 text-center text-white space-y-3 max-w-md">
                  <div className="size-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                    <ImageIcon className="size-6" />
                  </div>
                  <h4 className="text-sm font-bold">
                    {photoModal.activeFilter === 'LOGISTIK'
                      ? 'Belum Ada Foto dari Pihak Logistik'
                      : photoModal.activeFilter === 'END_USER'
                      ? 'Belum Ada Foto dari Pihak End User / Kapal'
                      : 'Belum Ada Bukti Foto Fisik'}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {photoModal.error ||
                      'Tidak ada foto fisik yang tercatat untuk kategori ini. Foto akan muncul otomatis setelah staf logistik atau penerima di kapal mengunggah dokumentasi barang.'}
                  </p>
                </div>
              ) : activePhoto ? (
                <div className="w-full h-full flex flex-col relative">
                  {/* Foto Image Box */}
                  <div className="flex-1 relative flex items-center justify-center p-2 min-h-0 overflow-hidden">
                    <img
                      src={activePhoto.url}
                      alt={activePhoto.name}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
                    />

                    {/* Badge Sumber di Pojok Kiri Atas Foto */}
                    <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                      {activePhoto.source === 'remote_handover' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600/90 text-white backdrop-blur-sm shadow-md border border-emerald-400/30">
                          <Ship className="size-3.5" />
                          <span>Pihak Kapal / End User (Tanda Terima Mandiri)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-600/90 text-white backdrop-blur-sm shadow-md border border-blue-400/30">
                          <Truck className="size-3.5" />
                          <span>Pihak Logistik Lapangan (Pengiriman Darat)</span>
                        </span>
                      )}
                    </div>

                    {/* Tombol Panah Prev / Next Navigasi */}
                    {filteredModalPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoModal((prev) => ({
                              ...prev,
                              selectedPhotoIndex:
                                (prev.selectedPhotoIndex - 1 + filteredModalPhotos.length) %
                                filteredModalPhotos.length,
                            }))
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-sm border border-white/20"
                          title="Foto Sebelumnya"
                        >
                          <ChevronLeft className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoModal((prev) => ({
                              ...prev,
                              selectedPhotoIndex: (prev.selectedPhotoIndex + 1) % filteredModalPhotos.length,
                            }))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-sm border border-white/20"
                          title="Foto Selanjutnya"
                        >
                          <ChevronRight className="size-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Metadata Bar Bawah Foto */}
                  <div className="bg-slate-900/90 border-t border-slate-800 px-5 py-3 text-xs text-slate-300 flex items-center justify-between gap-4 flex-wrap shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      {activePhoto.takenAt && (
                        <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-800 px-2.5 py-1 rounded-md text-amber-400 border border-amber-400/20">
                          <Clock className="size-3" />
                          <span>{activePhoto.takenAt}</span>
                        </span>
                      )}
                      {activePhoto.receiverName && (
                        <span className="flex items-center gap-1 text-[11px] bg-slate-800 px-2.5 py-1 rounded-md text-emerald-400 border border-emerald-400/20">
                          <User className="size-3" />
                          <span>PIC: <strong>{activePhoto.receiverName}</strong></span>
                        </span>
                      )}
                      {activePhoto.armada && (
                        <span className="flex items-center gap-1 text-[11px] bg-slate-800 px-2.5 py-1 rounded-md text-blue-400 border border-blue-400/20">
                          <Ship className="size-3" />
                          <span>{activePhoto.armada}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate max-w-xs" title={activePhoto.name}>
                      {activePhoto.name}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Thumbnail Strip (Jika Foto > 1) */}
            {filteredModalPhotos.length > 1 && (
              <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center gap-2 overflow-x-auto shrink-0">
                {filteredModalPhotos.map((photo, idx) => {
                  const isSelected = idx === photoModal.selectedPhotoIndex;
                  return (
                    <button
                      key={photo.name + idx}
                      type="button"
                      onClick={() => setPhotoModal((prev) => ({ ...prev, selectedPhotoIndex: idx }))}
                      className={`size-14 rounded-xl border-2 overflow-hidden shrink-0 transition cursor-pointer relative ${
                        isSelected ? 'border-teal-500 ring-2 ring-teal-500/30' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                      <span
                        className={`absolute bottom-0 inset-x-0 text-[8px] text-center font-bold py-0.5 text-white ${
                          photo.source === 'remote_handover' ? 'bg-emerald-600/90' : 'bg-blue-600/90'
                        }`}
                      >
                        {photo.source === 'remote_handover' ? 'Kapal' : 'Logistik'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer Modal */}
            <div className="px-5 py-2.5 bg-muted/50 border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span className="font-mono text-[11px]">
                TTB: {photoModal.noTtb} &bull; Total {filteredModalPhotos.length} foto tersedia
              </span>
              <button
                type="button"
                onClick={() => setPhotoModal((prev) => ({ ...prev, isOpen: false, photos: [] }))}
                className="px-3.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL IN-APP PDF VIEWER (TERINTEGRASI) ── */}
      {previewDoc.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-muted/60 border-b border-border flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileText className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">
                    {previewDoc.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Pratinjau Dokumen Resmi Terverifikasi (Cloudflare R2 Storage)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {previewDoc.fileUrl && (
                  <>
                    <a
                      href={previewDoc.fileUrl}
                      download={`${previewDoc.noDoc}.pdf`}
                      className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      title="Unduh PDF Resmi"
                    >
                      <Download className="size-3.5" />
                      <span className="hidden sm:inline">Unduh</span>
                    </a>
                    <a
                      href={previewDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Buka Dokumen di Tab Baru"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="hidden sm:inline">Tab Baru</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewDoc((prev) => ({ ...prev, isOpen: false, fileUrl: null }))}
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Content / iFrame Viewer */}
            <div className="flex-1 bg-slate-900 relative min-h-0">
              {previewDoc.isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3">
                  <Loader2 className="size-8 animate-spin text-indigo-400" />
                  <p className="text-xs font-semibold">Memuat Berkas PDF Resmi...</p>
                </div>
              ) : previewDoc.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                  <div className="size-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                    <X className="size-6" />
                  </div>
                  <h4 className="text-sm font-bold">{previewDoc.error}</h4>
                  <p className="text-xs text-slate-400 max-w-md">
                    Dokumen scan PDF untuk {previewDoc.noDoc} belum diunggah atau tautan penyimpanan Cloudflare R2 sedang diperbarui.
                  </p>
                </div>
              ) : previewDoc.fileUrl ? (
                <iframe
                  src={`${previewDoc.fileUrl}#view=FitH&toolbar=1`}
                  className="w-full h-full border-0"
                  title={previewDoc.title}
                />
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span className="font-mono text-[11px]">{previewDoc.noDoc}</span>
              <button
                type="button"
                onClick={() => setPreviewDoc((prev) => ({ ...prev, isOpen: false, fileUrl: null }))}
                className="px-3.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition"
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

