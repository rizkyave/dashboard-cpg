'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Ship,
  FileText,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Trash2,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Send,
  MapPin,
  Check,
  PackageCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { RemoteHandoverTokenData, RemoteHandoverResponse } from '@/types/remoteHandover';

/**
 * Kompresi gambar client-side menggunakan HTML5 Canvas
 * Memastikan resolusi maksimum 1280px dan format JPEG quality 0.65 (< 400 KB)
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    // Jika bukan gambar, kembalikan berkas asli
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxWidth = 1280;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      // Latar belakang putih untuk transparansi
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.65
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export default function RemoteHandoverPage() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'used' | 'expired' | 'not_found'>('valid');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [tokenData, setTokenData] = useState<RemoteHandoverTokenData | null>(null);

  // Form Fields
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverRole, setReceiverRole] = useState<string>('Nakhoda');
  const [customRole, setCustomRole] = useState<string>('');
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // Signature Pad State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitSuccessData, setSubmitSuccessData] = useState<RemoteHandoverTokenData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Ambil & Validasi Token dari Server
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setTokenStatus('not_found');
      setErrorMessage('Token serah terima tidak ditemukan dalam tautan.');
      return;
    }

    const fetchToken = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/remote-handover?token=${encodeURIComponent(token)}&_t=${Date.now()}`);
        const result: RemoteHandoverResponse = await res.json();

        if (res.ok && result.data) {
          setTokenData(result.data);
          setTokenStatus(result.status || (result.data.isUsed ? 'used' : 'valid'));
          if (result.data.isUsed) {
            setSubmitSuccessData(result.data);
          }
          if (result.data.recipientNameTarget && !receiverName) {
            setReceiverName(result.data.recipientNameTarget);
          }
        } else {
          setTokenStatus(result.status || 'not_found');
          setErrorMessage(result.message || result.error || 'Tautan tidak valid atau telah kedaluwarsa.');
        }
      } catch (err) {
        setTokenStatus('not_found');
        setErrorMessage('Gagal menghubungi server untuk memvalidasi tautan.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [token]);

  // 2. Setup Canvas Signature Pad (HiDPI / Retina responsive)
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    if (tokenStatus === 'valid' && !submitSuccess) {
      // Delay sedikit agar DOM selesai ter-render
      const timer = setTimeout(() => {
        initCanvas();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [tokenStatus, submitSuccess]);

  // Canvas Drawing Handlers (Touch & Mouse)
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // 3. Penanganan Foto Bukti (Kamera Ponsel & Kompresi Otomatis)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    try {
      const remainingSlots = 2 - uploadedPhotos.length;
      const targetFiles = Array.from(files).slice(0, remainingSlots);

      for (const file of targetFiles) {
        const compressed = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        setUploadedPhotos((prev) => [...prev, { file: compressed, preview: previewUrl }]);
      }
    } catch (err) {
      console.warn('Kompresi foto gagal:', err);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = (index: number) => {
    setUploadedPhotos((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 4. Submit Konfirmasi Serah Terima
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiverName.trim()) {
      alert('Silakan masukkan nama lengkap penerima.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      alert('Harap unggah minimal 1 foto bukti fisik barang di atas kapal.');
      return;
    }

    if (!hasSignature) {
      alert('Harap bubuhkan tanda tangan digital pada kotak yang disediakan.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureDataUrl = canvas.toDataURL('image/png');

    setIsSubmitting(true);

    // Ambil koordinat GPS (non-blocking jika ditolak/timeout)
    let geolocation: { latitude: number; longitude: number; accuracy?: number } | undefined;
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true,
          });
        });
        geolocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      } catch {
        // Izin GPS ditolak atau timeout — lanjutkan tanpa GPS
      }
    }

    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('receiverName', receiverName.trim());
      const finalRole = receiverRole === 'Lainnya' ? (customRole.trim() || 'Penerima Barang') : receiverRole;
      formData.append('receiverRole', finalRole);
      formData.append('signatureDataUrl', signatureDataUrl);
      formData.append('completionNotes', completionNotes.trim());
      if (geolocation) {
        formData.append('geolocation', JSON.stringify(geolocation));
      }

      uploadedPhotos.forEach((item) => {
        formData.append('photos', item.file);
      });

      const res = await fetch('/api/remote-handover', {
        method: 'PUT',
        body: formData,
      });

      const result: RemoteHandoverResponse = await res.json();
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error || result.message || 'Gagal menyimpan konfirmasi serah terima.');
      }

      setSubmitSuccess(true);
      setSubmitSuccessData(result.data);
    } catch (err) {
      alert(`Terjadi kendala: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER STATES ---

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Loader2 className="size-10 text-indigo-400 animate-spin" />
        <div>
          <h2 className="text-base font-bold">Memuat Dokumen Serah Terima...</h2>
          <p className="text-xs text-slate-400 mt-1">Menghubungkan ke server Cloudflare R2...</p>
        </div>
      </div>
    );
  }

  // State: Token Tidak Dikenali / Error
  if (tokenStatus === 'not_found' || (!tokenData && !submitSuccessData)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="size-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="size-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Tautan Tidak Dikenali</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {errorMessage || 'Tautan serah terima tidak ditemukan atau format token tidak valid. Silakan hubungi Tim Logistik kantor untuk mendapatkan tautan resmi.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // State: Token Kedaluwarsa
  if (tokenStatus === 'expired') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="size-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <Clock className="size-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-400">Tautan Telah Kedaluwarsa</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Tautan konfirmasi serah terima ini telah melewati batas masa aktif (7 hari).
            </p>
            <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-left text-xs space-y-1">
              <div>No. TTB: <strong className="text-white font-mono">{tokenData?.noTtb}</strong></div>
              <div>Armada: <strong className="text-white">{tokenData?.armada}</strong></div>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Silakan hubungi Tim Logistik kantor untuk menerbitkan tautan baru.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // State: Sudah Digunakan / Selesai (Success Screen)
  if (tokenStatus === 'used' || submitSuccess) {
    const data = submitSuccessData || tokenData;
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="size-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="size-9" />
          </div>

          <div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
              Tahap 4/4 Selesai (Resmi)
            </span>
            <h2 className="text-xl font-extrabold text-white mt-2">
              Serah Terima Berhasil Disahkan!
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Tanda terima dan dokumentasi fisik barang telah tersimpan aman di Cloudflare R2 &amp; terarsip resmi di sistem logistik.
            </p>
          </div>

          {/* Rincian Pengesahan */}
          <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Nomor TTB:</span>
              <span className="font-mono font-bold text-indigo-400">{data?.noTtb}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Armada Tujuan:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <Ship className="size-3.5 text-blue-400" />
                <span>{data?.armada}</span>
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Penerima Barang:</span>
              <span className="font-bold text-white">
                {data?.receiverName || '-'} ({data?.receiverRole || 'Nakhoda'})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Waktu Pengesahan:</span>
              <span className="text-slate-300">
                {data?.usedAt ? new Date(data.usedAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 text-center">
            Terima kasih atas konfirmasi Anda. Halaman ini dapat ditutup dengan aman.
          </div>
        </div>
      </div>
    );
  }

  // State Utama: Form Serah Terima Mandiri (Mobile-First)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start pb-12 antialiased">
      
      {/* Top Mobile App Bar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
              CPG
            </div>
            <div>
              <h1 className="text-xs font-bold text-white leading-tight">
                PT. MAPAN INDONESIA LI
              </h1>
              <p className="text-[10px] text-slate-400">Serah Terima Barang Mandiri</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Kapal / Remote
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md px-4 py-4 space-y-4">

        {/* Document Header Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-xs tracking-wide">
              {tokenData?.noTtb}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
              <Ship className="size-3.5 text-blue-400" />
              <span>{tokenData?.armada}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Rincian Barang yang Diterima:
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 font-medium leading-relaxed max-h-36 overflow-y-auto">
              {tokenData?.itemSummary || '-'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
            {tokenData?.noPo && (
              <div>No. PO: <strong className="text-white">{tokenData.noPo}</strong></div>
            )}
            {tokenData?.noFpb && (
              <div>No. FPB: <strong className="text-white">{tokenData.noFpb}</strong></div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-[11px] text-amber-300">
            <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              Harap periksa kecocokan fisik barang di atas kapal sebelum mengisi dan menandatangani tanda terima.
            </span>
          </div>
        </div>

        {/* Form Pengesahan */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Identitas Penerima */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-indigo-400" />
              <span>Identitas Penerima di Kapal</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Lengkap Penerima <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Contoh: Capt. Fajrin / Idham Khalid"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Jabatan di Kapal / Titik Tujuan <span className="text-rose-500">*</span>
              </label>
              <select
                value={receiverRole}
                onChange={(e) => setReceiverRole(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Nakhoda">Nakhoda (Master / Captain)</option>
                <option value="Chief Officer">Chief Officer (Mualim I)</option>
                <option value="Second Officer">Second Officer (Mualim II)</option>
                <option value="Kepala Kamar Mesin (KKM)">Kepala Kamar Mesin (KKM / Chief Eng)</option>
                <option value="Masinis">Masinis (Engineer)</option>
                <option value="Bosun / Mandor">Bosun / Mandor Kapal</option>
                <option value="Staf Lapangan / User">Staf Lapangan / End User</option>
                <option value="Lainnya">Jabatan Lainnya...</option>
              </select>
            </div>

            {receiverRole === 'Lainnya' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sebutkan Jabatan Anda:
                </label>
                <input
                  type="text"
                  required
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Contoh: Juru Mudi / AB"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Unggah Bukti Foto Fisik */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="size-4 text-indigo-400" />
                <span>Foto Bukti Fisik Barang <span className="text-rose-500">*</span></span>
              </h3>
              <span className="text-[11px] font-mono font-semibold text-slate-400">
                {uploadedPhotos.length}/2 Foto
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Ambil foto fisik barang atau kemasan paket yang telah diterima di atas kapal (maksimal 2 foto). Foto otomatis dikompresi hemat kuota internet.
            </p>

            {/* Grid Preview Foto */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {uploadedPhotos.map((item, idx) => (
                <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-rose-600/90 text-white hover:bg-rose-600 transition shadow-xs cursor-pointer"
                    title="Hapus foto"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white">
                    Foto {idx + 1}
                  </span>
                </div>
              ))}

              {/* Tombol Ambil Foto dari Kamera Ponsel */}
              {uploadedPhotos.length < 2 && (
                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-4/3 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-indigo-500/5 flex flex-col items-center justify-center p-3 text-center transition cursor-pointer active:scale-98"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="size-6 text-indigo-400 animate-spin mb-1" />
                      <span className="text-[10px] text-slate-400">Mengompresi...</span>
                    </>
                  ) : (
                    <>
                      <div className="size-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-1.5">
                        <Camera className="size-5" />
                      </div>
                      <span className="text-xs font-bold text-white">Buka Kamera</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">atau Pilih Galeri</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Input Tersembunyi dengan dukungan Kamera Mobile Langsung */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* Signature Canvas Pad */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <PenTool className="size-4 text-indigo-400" />
                <span>Tanda Tangan Digital <span className="text-rose-500">*</span></span>
              </h3>
              {hasSignature && (
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <RotateCcw className="size-3" />
                  <span>Ulangi TTD</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Goreskan tanda tangan digital Anda menggunakan ujung jari pada kotak putih di bawah ini:
            </p>

            <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 bg-white shadow-inner touch-none">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-44 cursor-crosshair block"
              />

              {!hasSignature && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs font-medium select-none">
                  ✍️ Tanda tangan di sini
                </div>
              )}
            </div>
          </div>

          {/* Catatan Tambahan (Opsional) */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Catatan Kondisi Barang (Opsional):
            </label>
            <textarea
              rows={2}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Contoh: Barang diterima lengkap dalam kondisi baik dan tersegel rapi..."
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Tombol Final Konfirmasi */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !receiverName.trim() || uploadedPhotos.length === 0 || !hasSignature}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" />
                  <span>Menyimpan &amp; Membubuhkan TTD...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  <span>Konfirmasi Penerimaan Barang</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-2 leading-relaxed">
              Dengan mengklik tombol di atas, Anda menyatakan bahwa barang telah diterima secara fisik di atas kapal sesuai rincian TTB.
            </p>
          </div>

        </form>

      </main>

    </div>
  );
}

