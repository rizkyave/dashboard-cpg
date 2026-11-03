'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Camera,
  FlipHorizontal,
  Settings2,
  Images,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useCameraWatermark,
  WatermarkPosition,
  WatermarkFontSize,
  CapturedPhoto,
} from '@/hooks/useCameraWatermark';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface CameraWatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  docNumber?: string;
  docType?: 'TTB' | 'FSTB' | 'PO';
  onPhotoCaptured?: (dataUrl: string, filename: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type ActiveTab = 'camera' | 'settings' | 'gallery';

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}
function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
      <span className="text-xs text-foreground font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          checked ? 'bg-amber-500' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

// ─────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────

export default function CameraWatermarkModal({
  isOpen,
  onClose,
  docNumber,
  docType,
  onPhotoCaptured,
  showToast,
}: CameraWatermarkModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('camera');

  const {
    videoRef,
    canvasRef,
    overlayCanvasRef,
    isCameraReady,
    cameraError,
    facingMode,
    toggleFacingMode,
    startCamera,
    stopCamera,
    geoInfo,
    isLoadingGeo,
    requestGeo,
    settings,
    updateSettings,
    saveSettingsToStorage,
    capturePhoto,
    capturedPhotos,
    removePhoto,
    clearPhotos,
  } = useCameraWatermark({
    userName: user?.name ?? '',
    userJabatan: user?.jabatan ?? '',
    docNumber,
    docType,
  });

  // Start camera when modal opens; stop when it closes
  useEffect(() => {
    if (isOpen) {
      startCamera();
      requestGeo();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleCapture = useCallback(() => {
    const photo = capturePhoto();
    if (photo) {
      showToast?.('📸 Foto berhasil diambil dengan watermark!', 'success');
      onPhotoCaptured?.(photo.dataUrl, photo.filename);
      setActiveTab('gallery');
    } else {
      showToast?.('Gagal mengambil foto. Pastikan kamera aktif.', 'error');
    }
  }, [capturePhoto, onPhotoCaptured, showToast]);

  const handleDownload = useCallback((photo: CapturedPhoto) => {
    const a = document.createElement('a');
    a.href = photo.dataUrl;
    a.download = photo.filename;
    a.click();
  }, []);

  const handleUseInForm = useCallback(
    (photo: CapturedPhoto) => {
      onPhotoCaptured?.(photo.dataUrl, photo.filename);
      showToast?.(`Foto "${photo.filename}" digunakan di formulir.`, 'success');
      onClose();
    },
    [onPhotoCaptured, showToast, onClose]
  );

  const handleSaveSettings = useCallback(() => {
    saveSettingsToStorage();
    showToast?.('Pengaturan kamera disimpan.', 'success');
  }, [saveSettingsToStorage, showToast]);

  if (!isOpen) return null;

  // ── Render ───────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      {/* Hidden capture canvas */}
      <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} className="hidden" />

      <div className="relative flex flex-col w-full max-w-2xl bg-background overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Camera className="size-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Kamera Watermark CPG</h2>
              {docNumber && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  {docType ?? 'DOC'}: {docNumber}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Tab Nav ── */}
        <div className="flex border-b border-border bg-card shrink-0">
          {(
            [
              { id: 'camera', label: 'Kamera', icon: Camera },
              { id: 'settings', label: 'Pengaturan', icon: Settings2 },
              {
                id: 'gallery',
                label: `Galeri${capturedPhotos.length > 0 ? ` (${capturedPhotos.length})` : ''}`,
                icon: Images,
              },
            ] as { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition border-b-2 cursor-pointer ${
                activeTab === id
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* ═══ CAMERA TAB ═══ */}
          {activeTab === 'camera' && (
            <div className="flex flex-col h-full">
              {/* Video container */}
              <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden" style={{ minHeight: 280 }}>
                {cameraError ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center max-w-xs">
                    <AlertCircle className="size-10 text-red-500" />
                    <p className="text-sm text-red-400 font-medium">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Coba Lagi
                    </button>
                  </div>
                ) : (
                  <>
                    {!isCameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Loader2 className="size-10 text-amber-500 animate-spin" />
                      </div>
                    )}
                    {/* Live video */}
                    <video
                      ref={videoRef as React.RefObject<HTMLVideoElement>}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-contain"
                      style={{ display: isCameraReady ? 'block' : 'none' }}
                    />
                    {/* Watermark overlay canvas */}
                    <canvas
                      ref={overlayCanvasRef as React.RefObject<HTMLCanvasElement>}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ objectFit: 'contain' }}
                    />
                  </>
                )}

                {/* GPS indicator */}
                <div className="absolute top-2 left-2 z-20">
                  {isLoadingGeo ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-[10px] text-amber-400 font-mono">
                      <Loader2 className="size-3 animate-spin" /> GPS...
                    </span>
                  ) : geoInfo?.latitude ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-[10px] text-emerald-400 font-mono">
                      <MapPin className="size-3" /> GPS OK
                    </span>
                  ) : geoInfo?.error ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-[10px] text-red-400 font-mono">
                      <MapPin className="size-3" /> No GPS
                    </span>
                  ) : null}
                </div>

                {/* Flip camera button */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title={`Kamera ${facingMode === 'environment' ? 'Belakang' : 'Depan'} — Klik untuk balik`}
                  className="absolute top-2 right-2 z-20 size-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
                >
                  <FlipHorizontal className="size-4" />
                </button>
              </div>

              {/* Capture button bar */}
              <div className="flex items-center justify-center gap-4 p-4 bg-card border-t border-border shrink-0">
                {/* Thumbnail of last photo */}
                {capturedPhotos[0] && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('gallery')}
                    className="size-12 rounded-xl overflow-hidden border-2 border-amber-500 shrink-0 cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedPhotos[0].dataUrl}
                      alt="Foto terakhir"
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}

                {/* Main capture button */}
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!isCameraReady || !!cameraError}
                  className="size-16 rounded-full bg-white border-4 border-amber-500 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Ambil Foto"
                >
                  <Camera className="size-6 text-amber-600" />
                </button>

                {/* Settings shortcut */}
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="size-12 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Pengaturan Watermark"
                >
                  <SlidersHorizontal className="size-5" />
                </button>
              </div>
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {activeTab === 'settings' && (
            <div className="p-4 space-y-5">
              {/* Visibility toggles */}
              <section className="bg-card border border-border rounded-xl p-4 space-y-0.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Tampilkan di Watermark
                </h3>
                <ToggleRow
                  label="Logo CPG"
                  checked={settings.showLogo}
                  onChange={(v) => updateSettings({ showLogo: v })}
                />
                <div className="border-t border-border/50" />
                <ToggleRow
                  label="Tanggal & Waktu"
                  checked={settings.showDateTime}
                  onChange={(v) => updateSettings({ showDateTime: v })}
                />
                <div className="border-t border-border/50" />
                <ToggleRow
                  label="Nama & Jabatan User"
                  checked={settings.showUserName}
                  onChange={(v) => updateSettings({ showUserName: v })}
                />
                <div className="border-t border-border/50" />
                {docNumber && (
                  <>
                    <ToggleRow
                      label={`Nomor Dokumen (${docType ?? 'DOC'})`}
                      checked={settings.showDocNumber}
                      onChange={(v) => updateSettings({ showDocNumber: v })}
                    />
                    <div className="border-t border-border/50" />
                  </>
                )}
                <ToggleRow
                  label="Koordinat GPS"
                  checked={settings.showGpsCoords}
                  onChange={(v) => updateSettings({ showGpsCoords: v })}
                />
                <div className="border-t border-border/50" />
                <ToggleRow
                  label="Nama Kota / Lokasi"
                  checked={settings.showCityName}
                  onChange={(v) => updateSettings({ showCityName: v })}
                />
              </section>

              {/* Position & Font */}
              <section className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tampilan
                </h3>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Posisi Watermark
                  </label>
                  <select
                    value={settings.position}
                    onChange={(e) =>
                      updateSettings({ position: e.target.value as WatermarkPosition })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="bottom-left">Pojok Kiri Bawah</option>
                    <option value="bottom-right">Pojok Kanan Bawah</option>
                    <option value="top-left">Pojok Kiri Atas</option>
                    <option value="top-right">Pojok Kanan Atas</option>
                    <option value="bottom-center">Bawah Tengah</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Ukuran Font Watermark
                  </label>
                  <select
                    value={settings.fontSize}
                    onChange={(e) =>
                      updateSettings({ fontSize: e.target.value as WatermarkFontSize })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="small">Kecil</option>
                    <option value="medium">Sedang (Default)</option>
                    <option value="large">Besar</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Label Kustom (opsional)
                  </label>
                  <input
                    type="text"
                    value={settings.customLabel}
                    onChange={(e) => updateSettings({ customLabel: e.target.value })}
                    placeholder="Cth: Gudang Somber"
                    maxLength={60}
                    className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground">
                      Opacity Background Watermark
                    </label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {settings.bgOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.bgOpacity}
                    onChange={(e) => updateSettings({ bgOpacity: Number(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>
              </section>

              {/* GPS info */}
              {geoInfo && (
                <section className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Info GPS
                  </h3>
                  {geoInfo.error && !geoInfo.latitude ? (
                    <div className="flex items-center gap-2 text-xs text-red-500">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>{geoInfo.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-1 text-xs text-foreground font-mono">
                      <p>Lat: {geoInfo.latitude.toFixed(6)}</p>
                      <p>Lon: {geoInfo.longitude.toFixed(6)}</p>
                      {geoInfo.cityName && (
                        <p className="text-muted-foreground">📍 {geoInfo.cityName}</p>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={requestGeo}
                    disabled={isLoadingGeo}
                    className="mt-2 h-7 px-3 rounded-lg bg-muted border border-border text-xs font-medium text-foreground hover:bg-card transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isLoadingGeo ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <MapPin className="size-3" />
                    )}
                    Perbarui Lokasi
                  </button>
                </section>
              )}

              {/* Save settings */}
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Save className="size-3.5" />
                Simpan Pengaturan
              </button>
            </div>
          )}

          {/* ═══ GALLERY TAB ═══ */}
          {activeTab === 'gallery' && (
            <div className="p-4 space-y-4">
              {capturedPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Images className="size-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada foto. Buka tab Kamera dan ambil foto.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('camera')}
                    className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Buka Kamera
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {capturedPhotos.length} foto diambil
                    </span>
                    <button
                      type="button"
                      onClick={clearPhotos}
                      className="text-xs text-red-500 hover:text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="size-3" /> Hapus Semua
                    </button>
                  </div>

                  <div className="space-y-3">
                    {capturedPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="bg-card border border-border rounded-xl overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.dataUrl}
                          alt={photo.filename}
                          className="w-full max-h-52 object-contain bg-black"
                        />
                        <div className="p-3 space-y-2">
                          <p className="text-[11px] font-mono text-muted-foreground truncate">
                            {photo.filename}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleDownload(photo)}
                              className="h-7 px-3 rounded-lg bg-muted border border-border text-xs font-medium text-foreground hover:bg-card transition cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Download className="size-3" /> Download
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUseInForm(photo)}
                              className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="size-3" /> Gunakan di Form
                            </button>
                            <button
                              type="button"
                              onClick={() => removePhoto(photo.id)}
                              className="h-7 px-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition cursor-pointer inline-flex items-center gap-1.5 ml-auto"
                            >
                              <Trash2 className="size-3" /> Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
