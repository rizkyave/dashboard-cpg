'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  MessageCircle,
  Package,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { AppNotification } from '@/types/notification';
import { useAuth } from '@/context/AuthContext';
import { generateDirectWaLink } from '@/utils/whatsappNotifier';

interface NotificationBellProps {
  onNavigateTab?: (tab: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function NotificationBell({ onNavigateTab, showToast }: NotificationBellProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Polling notifikasi setiap 20 detik
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/notifications?username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(
          user.role
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (err) {
      // Background poll silently fails
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Tandai satu notifikasi sudah dibaca
  const markAsRead = async (notifId: string) => {
    if (!user) return;
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MARK_AS_READ',
          notificationId: notifId,
          username: user.username,
        }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, readBy: [...n.readBy, user.username] } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  // Tandai semua notifikasi sudah dibaca
  const markAllAsRead = async () => {
    if (!user) return;
    setLoading(true);
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
        prev.map((n) => ({ ...n, readBy: [...n.readBy, user.username] }))
      );
      setUnreadCount(0);
      showToast?.('Semua notifikasi ditandai telah dibaca.', 'info');
    } catch {
      showToast?.('Gagal menandai notifikasi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.linkTab && onNavigateTab) {
      onNavigateTab(notif.linkTab);
      setIsOpen(false);
    }
  };

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

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Tombol Lonceng Notifikasi */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-2 rounded-lg border transition cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-primary/10 border-primary text-primary'
            : 'bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground'
        }`}
        title="Notifikasi Pekerjaan"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel Notifikasi */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header Panel */}
          <div className="p-3.5 bg-muted/60 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Bell className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Notifikasi Pekerjaan</h4>
                <p className="text-[10px] text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Semua pesan sudah dibaca'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={loading}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="size-3.5" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>

          {/* List Notifikasi */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Sparkles className="size-8 mx-auto mb-2 opacity-30 text-emerald-500" />
                <p className="text-xs font-medium text-foreground">Tidak Ada Notifikasi Baru</p>
                <p className="text-[11px] mt-1">
                  Saat ada dokumen FSTB, TTB, atau serah terima lapangan baru, info pekerjaan akan muncul di sini.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !user || !notif.readBy.includes(user.username);
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

                const getIconConfig = () => {
                  switch (notif.type) {
                    case 'FSTB_UPLOADED':
                      return {
                        icon: <Package className="size-4" />,
                        className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      };
                    case 'FSTB_VALIDATED':
                      return {
                        icon: <FileSignature className="size-4" />,
                        className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                      };
                    case 'TTB_UPLOADED':
                      return {
                        icon: <PackageCheck className="size-4" />,
                        className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                      };
                    case 'TTB_VALIDATED':
                      return {
                        icon: <ShieldCheck className="size-4" />,
                        className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
                      };
                    case 'TTB_DISPATCHED':
                      return {
                        icon: <Truck className="size-4" />,
                        className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
                      };
                    case 'SERAH_TERIMA_COMPLETED':
                      return {
                        icon: <CheckCircle2 className="size-4" />,
                        className: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
                      };
                    default:
                      return {
                        icon: <Package className="size-4" />,
                        className: 'bg-primary/15 text-primary',
                      };
                  }
                };

                const iconCfg = getIconConfig();

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 transition cursor-pointer flex gap-3 hover:bg-muted/50 ${
                      isUnread ? 'bg-primary/[0.04]' : 'bg-card'
                    }`}
                  >
                    {/* Icon Indikator */}
                    <div className="shrink-0 mt-0.5">
                      <div
                        className={`size-8 rounded-xl flex items-center justify-center ${iconCfg.className}`}
                      >
                        {iconCfg.icon}
                      </div>
                    </div>

                    {/* Konten Notifikasi */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h5
                          className={`text-xs font-semibold truncate ${
                            isUnread ? 'text-foreground font-bold' : 'text-muted-foreground'
                          }`}
                        >
                          {notif.title}
                        </h5>
                        {isUnread && (
                          <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Tag Rincian & Waktu */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{formatRelativeTime(notif.createdAt)}</span>
                        </div>

                        {/* Tombol Teruskan via WhatsApp */}
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium transition cursor-pointer border border-emerald-500/20"
                          title="Kirim / Teruskan info pekerjaan ini via WhatsApp"
                        >
                          <MessageCircle className="size-3" />
                          <span>Kirim ke WA</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-muted/40 border-t border-border text-center text-[10px] text-muted-foreground flex items-center justify-between px-3">
            <span>Role: {user?.jabatan || user?.role || 'User'}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
              Realtime Sync Aktif
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

