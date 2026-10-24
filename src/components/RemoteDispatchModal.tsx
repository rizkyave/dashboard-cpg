'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Truck,
  Ship,
  Phone,
  User,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Share2,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  PackageCheck,
  MessageCircle,
  Car,
} from 'lucide-react';
import {
  ShippingMethod,
  RemoteHandoverTokenData,
  RemoteHandoverResponse,
} from '@/types/remoteHandover';

export interface RemoteDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTtb: {
    noTtb: string;
    cleanNoTtb?: string;
    armada: string;
    noFpb?: string;
    noPo?: string;
    itemSummary: string;
    fileUrl?: string;
  };
  dispatchedBy: string;
  onSuccess?: (data: RemoteHandoverTokenData) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function RemoteDispatchModal({
  isOpen,
  onClose,
  targetTtb,
  dispatchedBy,
  onSuccess,
  showToast,
}: RemoteDispatchModalProps) {
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('Travel / Mobil Titipan');
  const [carrierContact, setCarrierContact] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [recipientNameTarget, setRecipientNameTarget] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTokenData, setActiveTokenData] = useState<RemoteHandoverTokenData | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);

  // Cek apakah TTB ini sudah memiliki token remote aktif sebelumnya
  useEffect(() => {
    if (!isOpen || !targetTtb?.noTtb) return;

    let isMounted = true;
    setIsLoadingExisting(true);

    const checkExisting = async () => {
      try {
        const clean = targetTtb.cleanNoTtb || targetTtb.noTtb;
        const res = await fetch(`/api/remote-handover?noTtb=${encodeURIComponent(clean)}&_t=${Date.now()}`);
        if (res.ok) {
          const data: RemoteHandoverResponse = await res.json();
          if (isMounted && data.success && data.data && !data.data.isUsed) {
            setActiveTokenData(data.data);
            const host = window.location.host;
            const proto = window.location.protocol;
            setShareUrl(`${proto}//${host}/terima-ttb/${data.data.token}`);
            setShippingMethod(data.data.shippingMethod);
            setCarrierContact(data.data.carrierContact);
            setTrackingNumber(data.data.trackingNumber || '');
            setRecipientPhone(data.data.recipientPhone);
            setRecipientNameTarget(data.data.recipientNameTarget || '');
          }
        }
      } catch (err) {
        console.warn('Gagal cek token remote aktif:', err);
      } finally {
        if (isMounted) setIsLoadingExisting(false);
      }
    };

    checkExisting();
    return () => {
      isMounted = false;
    };
  }, [isOpen, targetTtb]);

  if (!isOpen) return null;

  // Format nomor WhatsApp internasional (cth: 0812 -> 62812)
  const formatPhoneNumber = (phone: string): string => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '628' + clean.slice(1);
    }
    return clean;
  };

  // Buat pesan WhatsApp yang siap dikirim
  const buildWhatsAppMessage = (link: string): string => {
    const cleanPhone = formatPhoneNumber(recipientPhone);
    const text =
`*KONFIRMASI SERAH TERIMA BARANG (TTB)*
*PT. MAPAN INDONESIA LI / CPL*

Yth. *${recipientNameTarget.trim() || 'Nakhoda / Perwira Kapal'}*
Armada: *${targetTtb.armada}*

Berikut informasi pengiriman barang via ekspedisi / titipan pihak ketiga:
📄 *No. TTB:* ${targetTtb.noTtb}
📦 *Rincian Barang:*
${targetTtb.itemSummary || '-'}
${targetTtb.noPo ? `📑 *No. PO:* ${targetTtb.noPo}\n` : ''}${targetTtb.noFpb ? `📋 *No. FPB:* ${targetTtb.noFpb}\n` : ''}🚚 *Ekspedisi / Pembawa:* ${shippingMethod} - ${carrierContact}${trackingNumber ? `\n🏷️ *No. Resi:* ${trackingNumber}` : ''}

Mohon untuk memeriksa fisik barang saat tiba di kapal dan melakukan konfirmasi penerimaan serta tanda tangan digital langsung melalui tautan mandiri berikut:
👉 ${link}

_Catatan: Tautan ini berlaku selama 7 hari tanpa perlu login. Cukup foto fisik barang dan bubuhkan tanda tangan di layar ponsel._
Terima kasih.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!carrierContact.trim()) {
      showToast?.('Nama perantara / kontak pembawa wajib diisi.', 'error');
      return;
    }

    const cleanPhone = formatPhoneNumber(recipientPhone);
    if (!cleanPhone || cleanPhone.length < 9) {
      showToast?.('Nomor WhatsApp penerima tidak valid. Masukkan minimal 10 digit angka.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/remote-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ttbId: targetTtb.cleanNoTtb || targetTtb.noTtb,
          noTtb: targetTtb.noTtb,
          cleanNoTtb: targetTtb.cleanNoTtb,
          armada: targetTtb.armada,
          noFpb: targetTtb.noFpb,
          noPo: targetTtb.noPo,
          itemSummary: targetTtb.itemSummary,
          fileUrl: targetTtb.fileUrl,
          shippingMethod,
          carrierContact: carrierContact.trim(),
          trackingNumber: trackingNumber.trim(),
          recipientPhone: cleanPhone,
          recipientNameTarget: recipientNameTarget.trim(),
          dispatchedBy,
        }),
      });

      const result: RemoteHandoverResponse = await res.json();
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error || result.message || 'Gagal menerbitkan tautan serah terima.');
      }

      setActiveTokenData(result.data);
      const host = window.location.host;
      const proto = window.location.protocol;
      const generatedUrl = result.shareUrl || `${proto}//${host}/terima-ttb/${result.data.token}`;
      setShareUrl(generatedUrl);

      showToast?.('Tautan serah terima mandiri berhasil diterbitkan!', 'success');

      // Kirim Notifikasi In-App & WA Gateway: Pengiriman Pihak Ketiga / Remote
      try {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'TTB_DISPATCHED',
            title: '📦 TTB Dikirim via Pihak Ketiga / Remote',
            message: `Pengiriman TTB ${targetTtb.noTtb} ke ${targetTtb.armada || 'armada'} dititipkan via ${shippingMethod} (${carrierContact.trim() || 'Pembawa'}). Tautan serah terima mandiri telah diterbitkan.`,
            senderName: dispatchedBy || 'Petugas Disposisi',
            senderUsername: 'logistik',
            senderRole: 'Staf Logistik',
            targetRole: 'manager',
            linkTab: 'serah-terima',
            metadata: {
              noTtb: targetTtb.noTtb,
              armada: targetTtb.armada,
              noPo: targetTtb.noPo,
              noFpb: targetTtb.noFpb,
              shippingMethod,
              carrierContact: carrierContact.trim(),
              recipientName: recipientNameTarget.trim(),
              itemSummary: targetTtb.itemSummary,
            },
          }),
        }).catch(() => {});
      } catch {}

      onSuccess?.(result.data);
    } catch (err) {
      showToast?.((err as Error).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      showToast?.('Tautan berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      showToast?.('Gagal menyalin tautan.', 'error');
    }
  };

  const handleOpenWhatsApp = () => {
    if (!shareUrl) return;
    const waUrl = buildWhatsAppMessage(shareUrl);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 sm:size-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Share2 className="size-5 sm:size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Pengiriman Pihak Ketiga / Remote
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  Tautan Mandiri Kapal
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kirim barang via kapal perintis, travel, atau ekspedisi tanpa kehadiran kurir internal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Ringkasan Dokumen TTB */}
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                {targetTtb.noTtb}
              </span>
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Ship className="size-3.5 text-blue-500" />
                <span>{targetTtb.armada}</span>
              </span>
            </div>

            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Barang: </span>
              <span className="line-clamp-2">{targetTtb.itemSummary || '-'}</span>
            </div>

            {(targetTtb.noPo || targetTtb.noFpb) && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                {targetTtb.noPo && <span>PO: <strong className="text-foreground">{targetTtb.noPo}</strong></span>}
                {targetTtb.noFpb && <span>FPB: <strong className="text-foreground">{targetTtb.noFpb}</strong></span>}
              </div>
            )}
          </div>

          {/* Jika Token Sudah Pernah Diterbitkan (Active View) */}
          {activeTokenData && shareUrl && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    Tautan Serah Terima Aktif
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Berlaku 7 Hari
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg bg-background border border-border text-foreground select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  title="Salin Tautan"
                >
                  {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <MessageCircle className="size-4" />
                  <span>Kirim ke WhatsApp Nakhoda</span>
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  title="Buka Tautan Pratinjau Mobile"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Uji Tautan</span>
                </a>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Penerima di kapal dapat langsung membuka link tersebut melalui ponsel tanpa perlu masuk/login.
              </p>
            </div>
          )}

          {/* Form Input Disposisi Titipan */}
          <form onSubmit={handleGenerateLink} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Metode Pengiriman Titipan:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'Travel / Mobil Titipan', label: 'Travel / Mobil', icon: Car },
                  { id: 'Kapal Perintis / Kapal Lain', label: 'Kapal Perintis', icon: Ship },
                  { id: 'Ekspedisi Lokal', label: 'Ekspedisi Lokal', icon: Truck },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = shippingMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setShippingMethod(item.id as ShippingMethod)}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs ring-1 ring-indigo-500'
                          : 'border-border bg-background hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className={`size-4 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama Perantara / Kontak Pembawa <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={carrierContact}
                    onChange={(e) => setCarrierContact(e.target.value)}
                    placeholder="Cth: Travel Barokah - Bpk. Anto"
                    className="w-full text-xs pl-8.5 pr-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nomor Resi / Dokumen Titipan (Opsional)
                </label>
                <div className="relative">
                  <FileText className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Cth: KPL-PRT-0982 / Resi #123"
                    className="w-full text-xs pl-8.5 pr-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nomor WhatsApp Penerima (Nakhoda/Mualim) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="Cth: 08123456789 atau 6281..."
                    className="w-full text-xs pl-8.5 pr-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Nomor ini akan digunakan sebagai tujuan kirim pesan WA.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama PIC Penerima di Kapal (Opsional)
                </label>
                <div className="relative">
                  <User className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recipientNameTarget}
                    onChange={(e) => setRecipientNameTarget(e.target.value)}
                    placeholder="Cth: Capt. Fajrin / Mualim I"
                    className="w-full text-xs pl-8.5 pr-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !carrierContact.trim() || !recipientPhone.trim()}
                className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Menerbitkan Tautan...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    <span>
                      {activeTokenData ? 'Perbarui & Buat Ulang Tautan' : 'Buat Tautan Serah Terima Mandiri'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Modal */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-muted/40 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-indigo-500" />
            <span>Petugas Disposisi: <strong className="text-foreground">{dispatchedBy}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}

