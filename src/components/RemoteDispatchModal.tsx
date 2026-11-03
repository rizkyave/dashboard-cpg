'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  Truck,
  Ship,
  Phone,
  User,
  UserCheck,
  FileText,
  Eye,
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
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCheck,
  PhoneCall,
  Clock,
  RotateCcw,
} from 'lucide-react';
import {
  ShippingMethod,
  RemoteHandoverTokenData,
  RemoteHandoverResponse,
} from '@/types/remoteHandover';
import { CrewMasterItem } from '@/types/crewKapal';
import { loadCrewData } from '@/utils/crewKapalStorage';
import { findCrewByArmada } from '@/utils/crewMatcher';
import TtbMediaModal from './TtbMediaModal';

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
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('Diantar Tim Logistik');
  const [carrierContact, setCarrierContact] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [recipientNameTarget, setRecipientNameTarget] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTokenData, setActiveTokenData] = useState<RemoteHandoverTokenData | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isTtbCopied, setIsTtbCopied] = useState<boolean>(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);
  const [showTtbDetailModal, setShowTtbDetailModal] = useState<boolean>(false);
  const [showWaPreview, setShowWaPreview] = useState<boolean>(false);

  // Informasi kru dan kontak kapal berdasarkan targetTtb.armada
  const [crewInfo, setCrewInfo] = useState<{
    crewList: CrewMasterItem[];
    shipPhone?: string;
    matchedShipName?: string;
  }>({ crewList: [] });
  const [selectedCrewId, setSelectedCrewId] = useState<string>('');

  // Kru yang sedang dipilih
  const selectedCrew = useMemo(() => {
    if (!selectedCrewId) return null;
    return crewInfo.crewList.find((c) => String(c.id) === selectedCrewId) || null;
  }, [selectedCrewId, crewInfo.crewList]);

  // Muat kru kapal dan nomor telepon kapal secara otomatis saat modal terbuka
  useEffect(() => {
    if (!isOpen || !targetTtb?.armada) {
      setCrewInfo({ crewList: [] });
      setSelectedCrewId('');
      return;
    }

    try {
      const stored = loadCrewData();
      const res = findCrewByArmada(
        targetTtb.armada,
        stored.masterCrew || [],
        stored.kapalRekap || []
      );
      setCrewInfo(res);
      setSelectedCrewId('');
    } catch (err) {
      console.warn('Gagal memuat kru kapal:', err);
    }
  }, [isOpen, targetTtb?.armada]);

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

  // Buat teks pesan WhatsApp
  const generateMessageText = (link: string): string => {
    return `*KONFIRMASI SERAH TERIMA BARANG (TTB)*
*CINDARA PRATAMA GROUP LOGISTIK DIV*

Yth. *${recipientNameTarget.trim() || 'Nakhoda / Perwira Kapal'}*
Armada: *${targetTtb.armada}*

Berikut informasi pengiriman barang:
📄 *No. TTB:* ${targetTtb.noTtb}
📦 *Rincian Barang:*
${targetTtb.itemSummary || '-'}
${targetTtb.noPo ? `📑 *No. PO:* ${targetTtb.noPo}\n` : ''}${targetTtb.noFpb ? `📋 *No. FPB:* ${targetTtb.noFpb}\n` : ''}🚚 *Ekspedisi / Pembawa:* ${shippingMethod} - ${carrierContact || '-'}${trackingNumber ? `\n🏷️ *No. Resi:* ${trackingNumber}` : ''}

Mohon untuk memeriksa fisik barang saat tiba di kapal dan melakukan konfirmasi penerimaan serta tanda tangan digital langsung melalui tautan mandiri berikut:
👉 ${link || '(Tautan akan diterbitkan setelah tombol diklik)'}

_Catatan: Tautan ini berlaku selama 7 hari tanpa perlu login. Cukup foto fisik barang dan bubuhkan tanda tangan di layar ponsel._
Terima kasih.`;
  };

  // Buat URL tautan WhatsApp
  const buildWhatsAppMessage = (link: string): string => {
    const cleanPhone = formatPhoneNumber(recipientPhone);
    const text = generateMessageText(link);
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
            title: '📦 TTB Dikirim',
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

  const handleCopyTtbNumber = async () => {
    try {
      await navigator.clipboard.writeText(targetTtb.noTtb);
      setIsTtbCopied(true);
      showToast?.(`Nomor TTB ${targetTtb.noTtb} disalin!`, 'info');
      setTimeout(() => setIsTtbCopied(false), 2000);
    } catch {}
  };

  const handleOpenWhatsApp = () => {
    if (!shareUrl) return;
    const waUrl = buildWhatsAppMessage(shareUrl);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Inisial untuk avatar kru
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'CR';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Modal - Elegan & Tepat Sasaran */}
        <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0 ring-4 ring-indigo-500/10">
              <Share2 className="size-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Opsi Pengantaran & Disposisi Logistik
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                  <Sparkles className="size-3" />
                  <span>Disposisi Serah Terima</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Tentukan metode pengantaran barang ke armada dan kirim notifikasi serah terima ke kru kapal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body - Bersih & Lega tanpa Overlap */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          
          {/* Card Ringkasan Dokumen TTB - Kartu Logistik Modern */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-muted/60 via-muted/30 to-background border border-border/80 shadow-xs space-y-3">
            {/* Baris Atas: Nomor TTB & Armada Tujuan */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                  <FileText className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{targetTtb.noTtb}</span>
                  <button
                    type="button"
                    onClick={handleCopyTtbNumber}
                    className="p-1 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 rounded transition text-indigo-600 dark:text-indigo-400 cursor-pointer ml-0.5"
                    title="Salin No TTB"
                  >
                    {isTtbCopied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTtbDetailModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition cursor-pointer active:scale-95 shadow-2xs"
                  title="Lihat rincian dokumen TTB"
                >
                  <Eye className="size-3.5" />
                  <span>Lihat TTB</span>
                </button>
              </div>

              {/* Badge Armada & Kontak Kapal */}
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 shadow-2xs">
                  <Ship className="size-3.5 text-blue-500 shrink-0" />
                  <span>{targetTtb.armada}</span>
                </span>
                {crewInfo.shipPhone && crewInfo.shipPhone !== '-' ? (
                  <a
                    href={`https://wa.me/${formatPhoneNumber(crewInfo.shipPhone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline transition"
                    title="Hubungi telepon kapal langsung"
                  >
                    <Phone className="size-3 text-emerald-500" />
                    <span>Telp Kapal: {crewInfo.shipPhone}</span>
                  </a>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Telp kapal belum tercatat</span>
                )}
              </div>
            </div>

            {/* Rincian Fisik Barang */}
            <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-start gap-2">
              <PackageCheck className="size-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-foreground">Barang: </span>
                <span className="text-foreground/80 leading-relaxed">{targetTtb.itemSummary || '-'}</span>
              </div>
            </div>

            {/* Nomor PO & FPB */}
            {(targetTtb.noPo || targetTtb.noFpb) && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                {targetTtb.noPo && (
                  <span>PO: <strong className="font-mono text-foreground">{targetTtb.noPo}</strong></span>
                )}
                {targetTtb.noFpb && (
                  <span>FPB: <strong className="font-mono text-foreground">{targetTtb.noFpb}</strong></span>
                )}
              </div>
            )}
          </div>

          {/* Banner Jika Token Sudah Aktif (Active View) */}
          {activeTokenData && shareUrl && (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 space-y-3 shadow-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <CheckCircle2 className="size-4.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300">
                    Tautan Serah Terima Aktif
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  Berlaku 7 Hari
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground select-all shadow-inner focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
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
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="size-4" />
                  <span>Kirim ke WhatsApp Penerima</span>
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
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
          <form onSubmit={handleGenerateLink} className="space-y-4">
            
            {/* Pilihan Metode Pengiriman: 3 Card Elegan */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-2">
                Pilih Metode Pengiriman:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'Diantar Tim Logistik', label: 'Diantar Tim Logistik', icon: Truck, desc: 'Kurir internal / logistik CPG' },
                  { id: 'Titip Armada', label: 'Titip Armada', icon: Ship, desc: 'Via kapal perintis / armada lain' },
                  { id: 'Travel / Mobil Titipan', label: 'Travel / Mobil', icon: Car, desc: 'Via supir / ekspedisi darat' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected =
                    shippingMethod === item.id ||
                    (item.id === 'Titip Armada' && shippingMethod === 'Kapal Perintis / Kapal Lain') ||
                    (item.id === 'Diantar Tim Logistik' && shippingMethod === 'Ekspedisi Lokal');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setShippingMethod(item.id as ShippingMethod)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer relative overflow-hidden group ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 shadow-sm ring-2 ring-indigo-500/30'
                          : 'border-border/80 bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`size-7 rounded-xl flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-muted text-muted-foreground group-hover:text-foreground'
                          }`}
                        >
                          <Icon className="size-4" />
                        </div>
                        {isSelected && (
                          <span className="size-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-foreground'}`}>
                          {item.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nama Kurir / Petugas Pengantar (Satu Kolom Memanjang Penuh) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Nama Kurir / Petugas Pengantar <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <User className="size-4" />
                </div>
                <input
                  type="text"
                  required
                  value={carrierContact}
                  onChange={(e) => setCarrierContact(e.target.value)}
                  placeholder={
                    shippingMethod === 'Diantar Tim Logistik'
                      ? 'Cth: Agus Salim (Tim Logistik Lapangan)'
                      : shippingMethod === 'Titip Armada'
                      ? 'Cth: Capt. Ridwan (TB King Star) / Kru Pembawa'
                      : 'Cth: Travel Barokah - Bpk. Anto'
                  }
                  className="w-full text-xs sm:text-sm pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden transition shadow-2xs"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Nama petugas logistik internal atau pihak perantara yang membawa dan mengantar barang ke kapal.
              </p>
            </div>

            {/* Dropdown Kru Kapal Otomatis & Profil Kru Terpilih */}
            {crewInfo.crewList.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/25 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <UserCheck className="size-4 text-blue-600 dark:text-blue-400" />
                    <span>Pilih Kru Kapal {crewInfo.matchedShipName || targetTtb.armada}:</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                    {crewInfo.crewList.length} Personel Aktif
                  </span>
                </div>

                <div className="relative">
                  <select
                    value={selectedCrewId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSelectedCrewId(cId);
                      if (!cId) return;
                      const c = crewInfo.crewList.find((item) => String(item.id) === cId);
                      if (c) {
                        const picName =
                          c.jabatan && c.jabatan !== '-'
                            ? `${c.namaPersonel} (${c.jabatan})`
                            : c.namaPersonel;
                        setRecipientNameTarget(picName);
                        if (c.noHp && c.noHp !== '-' && c.noHp.trim().length >= 6) {
                          setRecipientPhone(c.noHp.trim());
                        } else if (crewInfo.shipPhone && crewInfo.shipPhone !== '-' && !recipientPhone) {
                          setRecipientPhone(crewInfo.shipPhone);
                        }
                      }
                    }}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-background border border-blue-300 dark:border-blue-700/80 text-foreground focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium cursor-pointer shadow-2xs transition"
                  >
                    <option value="">-- Pilih Kru Kapal (Otomatis isi Nama & No. WA) --</option>
                    {crewInfo.crewList.map((crew) => (
                      <option key={crew.id} value={String(crew.id)}>
                        {crew.namaPersonel} — {crew.jabatan || 'Crew'} {crew.noHp && crew.noHp !== '-' ? `(WA: ${crew.noHp})` : '(No WA tidak tercatat)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kartu Profil Kru Terpilih (Interaktif & Keren) */}
                {selectedCrew ? (
                  <div className="p-3 rounded-xl bg-background/90 border border-blue-500/30 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {getInitials(selectedCrew.namaPersonel)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-xs sm:text-sm truncate">
                          {selectedCrew.namaPersonel}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                            {selectedCrew.jabatan || 'Kru Kapal'}
                          </span>
                          {selectedCrew.noHp && selectedCrew.noHp !== '-' && (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                              📱 {selectedCrew.noHp}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCrewId('')}
                      className="text-xs text-muted-foreground hover:text-rose-500 transition px-2 py-1 rounded-lg hover:bg-muted cursor-pointer shrink-0"
                      title="Ganti atau reset pilihan kru"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    💡 <em>Memilih salah satu kru di atas otomatis mengisi kolom No. WhatsApp dan Nama PIC di bawah. Anda tetap bebas menyuntingnya secara manual.</em>
                  </p>
                )}
              </div>
            )}

            {/* Nomor WhatsApp & Nama PIC Input (LEGA, PADDING 40px, NO OVERLAP) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="text-xs font-semibold text-foreground">
                    Nomor WhatsApp Penerima <span className="text-rose-500">*</span>
                  </label>
                  {crewInfo.shipPhone && crewInfo.shipPhone !== '-' && (
                    <button
                      type="button"
                      onClick={() => setRecipientPhone(crewInfo.shipPhone || '')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline cursor-pointer"
                      title="Klik untuk mengisi dengan nomor telepon kapal"
                    >
                      <PhoneCall className="size-3" />
                      <span>Gunakan No. Kapal</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <Phone className="size-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="Cth: 08123456789 atau 6281..."
                    className="w-full text-xs sm:text-sm pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden transition shadow-2xs font-mono"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Nomor tujuan pengiriman pesan WhatsApp konfirmasi serah terima.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Nama PIC Penerima di Kapal <span className="text-[11px] font-normal text-muted-foreground">(Opsional)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <User className="size-4" />
                  </div>
                  <input
                    type="text"
                    value={recipientNameTarget}
                    onChange={(e) => setRecipientNameTarget(e.target.value)}
                    placeholder="Cth: Capt. Fajrin / Mualim I"
                    className="w-full text-xs sm:text-sm pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden transition shadow-2xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Nama nakhoda / mualim penerima barang di armada kapal.
                </p>
              </div>
            </div>

            {/* Live Interactive WhatsApp Chat Mockup / Preview */}
            <div className="rounded-2xl border border-border/80 overflow-hidden bg-card transition-all">
              <button
                type="button"
                onClick={() => setShowWaPreview(!showWaPreview)}
                className="w-full px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition flex items-center justify-between text-xs font-bold text-foreground cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Pratinjau Pesan WhatsApp ke Penerima</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                    Live Chat Bubble
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-[11px] font-normal">{showWaPreview ? 'Sembunyikan' : 'Buka'}</span>
                  {showWaPreview ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </button>

              {showWaPreview && (
                <div className="p-4 bg-slate-900 text-slate-100 font-sans space-y-2 border-t border-border animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span>WhatsApp Preview ({recipientPhone ? formatPhoneNumber(recipientPhone) : 'Nomor Belum Diisi'})</span>
                    </span>
                    <span className="font-mono text-[10px]">Simulasi Tampilan Ponsel</span>
                  </div>

                  {/* WhatsApp Chat Balloon */}
                  <div className="max-w-md ml-auto bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-xs p-3.5 shadow-md space-y-2 text-xs leading-relaxed">
                    <div className="font-bold text-emerald-200">
                      KONFIRMASI SERAH TERIMA BARANG (TTB)
                    </div>
                    <div className="text-[11px] text-emerald-100 font-semibold">
                      CINDARA PRATAMA GROUP LOGISTIK DIV
                    </div>
                    <div className="pt-1 text-[11px]">
                      Yth. <strong className="text-white">{recipientNameTarget.trim() || 'Nakhoda / Perwira Kapal'}</strong><br />
                      Armada: <strong className="text-white">{targetTtb.armada}</strong>
                    </div>
                    <div className="text-[11px] bg-black/20 p-2 rounded-lg space-y-0.5 font-mono">
                      <div>📄 <strong>TTB:</strong> {targetTtb.noTtb}</div>
                      <div>📦 <strong>Barang:</strong> {targetTtb.itemSummary || '-'}</div>
                      <div>🚚 <strong>Metode:</strong> {shippingMethod} ({carrierContact || 'Pembawa'})</div>
                      {trackingNumber && <div>🏷️ <strong>Resi:</strong> {trackingNumber}</div>}
                    </div>
                    <div className="text-[11px]">
                      👉 <span className="underline text-emerald-300 font-mono break-all">{shareUrl || 'https://dashboard-cpg.../terima-ttb/contoh-token'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-300/80 pt-1">
                      <Clock className="size-3" />
                      <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="size-3.5 text-sky-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Terbitkan Tautan Mandiri */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !carrierContact.trim() || !recipientPhone.trim()}
                className="w-full px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Menerbitkan Tautan Mandiri...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4.5" />
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
        <div className="px-5 py-3.5 border-t border-border bg-muted/40 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-indigo-500 shrink-0" />
            <span className="truncate">
              Petugas Disposisi: <strong className="text-foreground">{dispatchedBy}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Modal Detail & Pratinjau Dokumen TTB */}
      {showTtbDetailModal && (
        <TtbMediaModal
          isOpen={showTtbDetailModal}
          onClose={() => setShowTtbDetailModal(false)}
          noTtb={targetTtb.noTtb}
          fpb={targetTtb.noFpb}
          po={targetTtb.noPo}
          armada={targetTtb.armada}
          showToast={showToast}
        />
      )}
    </div>
  );
}
