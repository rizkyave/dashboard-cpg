'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Upload,
  Search,
  Filter,
  Package,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Trash2,
  Grid,
  List as ListIcon,
  RefreshCw,
  Plus,
  Eye,
  FileText,
  Anchor,
} from 'lucide-react';
import { FotoLapangan } from '@/types/fotoLapangan';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { getAllFotos, deleteFotoLapangan } from '@/utils/fotoLapanganStorage';
import UploadFotoLapanganModal from './UploadFotoLapanganModal';
import FotoLapanganViewerModal from './FotoLapanganViewerModal';

interface FotoLapanganTabProps {
  procurementItems: ProcurementItem[];
  armadaItems: ArmadaItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function FotoLapanganTab({
  procurementItems,
  armadaItems,
  onOpenAudit,
  showToast,
}: FotoLapanganTabProps) {
  const [fotos, setFotos] = useState<FotoLapangan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPic, setSelectedPic] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [viewerTarget, setViewerTarget] = useState<{
    noTtb?: string;
    noFstb?: string;
    fpb?: string;
    item?: string;
    armada?: string;
  } | null>(null);

  const [uploadPreFill, setUploadPreFill] = useState<{
    noTtb?: string;
    fpb?: string;
    noPo?: string;
    noFstb?: string;
    item?: string;
    armada?: string;
    picLap?: string;
  } | null>(null);

  // Load photos from IndexedDB
  const loadFotos = async () => {
    setIsLoading(true);
    try {
      const data = await getAllFotos();
      setFotos(data);
    } catch (err) {
      console.error('Failed to load photos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFotos();
    const handleUpdate = () => loadFotos();
    window.addEventListener('foto-lapangan-updated', handleUpdate);
    return () => window.removeEventListener('foto-lapangan-updated', handleUpdate);
  }, []);

  // Suggestions for autocomplete TTB
  const availableTtbSuggestions = useMemo(() => {
    const list: Array<{
      noTtb: string;
      fpb?: string;
      noPo?: string;
      noFstb?: string;
      item?: string;
      armada?: string;
      picLap?: string;
    }> = [];
    const seen = new Set<string>();

    procurementItems.forEach((p) => {
      if (p.noTtb && p.noTtb.trim() && p.noTtb.trim() !== '-' && !seen.has(p.noTtb.trim())) {
        seen.add(p.noTtb.trim());
        list.push({
          noTtb: p.noTtb.trim(),
          fpb: p.fpb,
          noPo: p.po,
          noFstb: p.noFstb,
          item: p.item,
          armada: p.deptArmada,
          picLap: p.picLap,
        });
      }
    });

    armadaItems.forEach((a) => {
      if (a.noTtb && a.noTtb.trim() && a.noTtb.trim() !== '-' && !seen.has(a.noTtb.trim())) {
        seen.add(a.noTtb.trim());
        list.push({
          noTtb: a.noTtb.trim(),
          fpb: a.fpb,
          noPo: a.noPo,
          noFstb: a.noFstb,
          item: a.item,
          armada: a.armada,
          picLap: a.picLap,
        });
      }
    });

    return list;
  }, [procurementItems, armadaItems]);

  // Unique PICs from saved fotos
  const picOptions = useMemo(() => {
    const set = new Set<string>(['AGUS', 'HERY']);
    fotos.forEach((f) => {
      if (f.picLapangan) set.add(f.picLapangan.toUpperCase());
    });
    return Array.from(set);
  }, [fotos]);

  // Filtered photos
  const filteredFotos = useMemo(() => {
    return fotos.filter((f) => {
      const matchSearch =
        !searchTerm.trim() ||
        f.noTtb.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.fpb && f.fpb.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.noFstb && f.noFstb.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.armada && f.armada.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.itemDescription && f.itemDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.catatan && f.catatan.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPic =
        selectedPic === 'ALL' ||
        f.picLapangan?.toUpperCase() === selectedPic.toUpperCase();

      return matchSearch && matchPic;
    });
  }, [fotos, searchTerm, selectedPic]);

  // KPIs
  const totalFotos = fotos.length;
  const uniqueTtbs = useMemo(() => {
    const set = new Set(fotos.map((f) => f.noTtb));
    return set.size;
  }, [fotos]);

  const handleDelete = async (id: string, ttb: string) => {
    if (!confirm(`Hapus foto dokumentasi untuk TTB ${ttb}?`)) return;
    try {
      await deleteFotoLapangan(id);
      showToast?.('Foto lapangan berhasil dihapus', 'info');
      await loadFotos();
    } catch (err) {
      showToast?.('Gagal menghapus foto', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-13 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Camera className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Portal Foto Lapangan (In-App)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                100% Internal System
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Dokumentasi fisik penerimaan barang tim lapangan terintegrasi langsung dengan Nomor TTB & berkas audit pengadaan tanpa ketergantungan portal eksternal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => loadFotos()}
            className="h-10 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition shadow-xs"
            title="Refresh Data Foto"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => {
              setUploadPreFill(null);
              setIsUploadOpen(true);
            }}
            className="flex-1 md:flex-none h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Plus className="size-4" />
            <span>Upload Foto Lapangan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Foto Tersimpan</span>
            <Camera className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground font-mono">
              {totalFotos}
            </span>
            <span className="text-[11px] text-muted-foreground">berkas foto</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">No. TTB Terverifikasi</span>
            <ShieldCheck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {uniqueTtbs}
            </span>
            <span className="text-[11px] text-muted-foreground">nomor TTB</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">PIC Lapangan Aktif</span>
            <User className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
              {picOptions.length}
            </span>
            <span className="text-[11px] text-muted-foreground">personil (Agus, Hery, dll)</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Tersedia Berkas Excel</span>
            <Package className="size-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">
              {availableTtbSuggestions.length}
            </span>
            <span className="text-[11px] text-muted-foreground">target TTB siap foto</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari No. TTB, FPB, FSTB, Armada, atau deskripsi..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={selectedPic}
              onChange={(e) => setSelectedPic(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium"
            >
              <option value="ALL">Semua PIC</option>
              {picOptions.map((p) => (
                <option key={p} value={p}>
                  PIC: {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 self-end sm:self-auto shrink-0 bg-muted/40">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
              viewMode === 'grid'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid className="size-3.5" />
            <span>Grid</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
              viewMode === 'table'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListIcon className="size-3.5" />
            <span>Tabel</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredFotos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/50 space-y-4">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Camera className="size-8" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">
              {fotos.length === 0 ? 'Belum Ada Foto Lapangan yang Diunggah' : 'Tidak Ditemukan Foto yang Sesuai'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {fotos.length === 0
                ? 'Gunakan tombol Upload Foto Lapangan di atas untuk mengunggah foto penerimaan fisik dan mengintegrasikannya dengan nomor TTB.'
                : 'Coba ubah kata kunci pencarian atau filter PIC lapangan.'}
            </p>
          </div>
          {fotos.length === 0 && (
            <button
              onClick={() => {
                setUploadPreFill(null);
                setIsUploadOpen(true);
              }}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-2 transition"
            >
              <Upload className="size-4" />
              <span>Unggah Foto Pertama Sekarang</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFotos.map((foto) => (
            <div
              key={foto.id}
              className="group bg-card border border-border rounded-xl overflow-hidden shadow-xs hover:shadow-md hover:border-blue-500/50 transition flex flex-col"
            >
              {/* Image Preview Box */}
              <div
                onClick={() => {
                  setViewerTarget({
                    noTtb: foto.noTtb,
                    noFstb: foto.noFstb,
                    fpb: foto.fpb,
                    item: foto.itemDescription,
                    armada: foto.armada,
                  });
                  setIsViewerOpen(true);
                }}
                className="relative aspect-4/3 bg-black/90 cursor-pointer overflow-hidden flex items-center justify-center"
              >
                <img
                  src={foto.dataUrl}
                  alt={`Foto TTB ${foto.noTtb}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <span className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5">
                    <Eye className="size-4" />
                    <span>Perbesar</span>
                  </span>
                </div>
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-600/90 text-white shadow-xs">
                    {foto.noTtb}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white/90">
                    {foto.tanggal}
                  </span>
                </div>
              </div>

              {/* Card Meta Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground truncate">
                      {foto.armada || 'Armada Kapal'}
                    </span>
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {foto.picLapangan}
                    </span>
                  </div>

                  {foto.itemDescription && (
                    <p className="text-[11px] text-muted-foreground truncate" title={foto.itemDescription}>
                      {foto.itemDescription}
                    </p>
                  )}

                  {foto.catatan && (
                    <p className="text-[11px] text-muted-foreground/80 line-clamp-2 italic bg-muted/30 p-1.5 rounded border border-border/50">
                      "{foto.catatan}"
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-1.5 text-xs">
                  {foto.fpb && onOpenAudit ? (
                    <button
                      onClick={() => onOpenAudit(foto.fpb!)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-mono"
                      title="Buka Berkas Audit FPB"
                    >
                      <FileText className="size-3" />
                      <span>{foto.fpb}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {foto.noFstb || '-'}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setViewerTarget({
                          noTtb: foto.noTtb,
                          noFstb: foto.noFstb,
                          fpb: foto.fpb,
                          item: foto.itemDescription,
                          armada: foto.armada,
                        });
                        setIsViewerOpen(true);
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
                      title="Lihat Foto"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(foto.id, foto.noTtb)}
                      className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition"
                      title="Hapus Foto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-16">Foto</th>
                  <th className="py-3 px-4">Nomor TTB</th>
                  <th className="py-3 px-4">Tanggal & Waktu</th>
                  <th className="py-3 px-4">PIC Lapangan</th>
                  <th className="py-3 px-4">Armada / Kapal</th>
                  <th className="py-3 px-4">Referensi FPB / FSTB</th>
                  <th className="py-3 px-4">Catatan Fisik</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFotos.map((foto) => (
                  <tr key={foto.id} className="hover:bg-muted/30 transition">
                    <td className="py-2.5 px-4">
                      <div
                        onClick={() => {
                          setViewerTarget({
                            noTtb: foto.noTtb,
                            noFstb: foto.noFstb,
                            fpb: foto.fpb,
                            item: foto.itemDescription,
                            armada: foto.armada,
                          });
                          setIsViewerOpen(true);
                        }}
                        className="size-11 rounded-lg bg-black/80 overflow-hidden cursor-pointer border border-border hover:opacity-80 transition shrink-0"
                      >
                        <img
                          src={foto.dataUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                      {foto.noTtb}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-muted-foreground">
                      {foto.tanggal} {foto.waktu ? `(${foto.waktu})` : ''}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px]">
                        {foto.picLapangan}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-foreground">
                      {foto.armada || '-'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs">
                      {foto.fpb && onOpenAudit ? (
                        <button
                          onClick={() => onOpenAudit(foto.fpb!)}
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <FileText className="size-3" />
                          <span>{foto.fpb}</span>
                        </button>
                      ) : (
                        foto.noFstb || '-'
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground truncate max-w-xs" title={foto.catatan}>
                      {foto.catatan || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setViewerTarget({
                              noTtb: foto.noTtb,
                              noFstb: foto.noFstb,
                              fpb: foto.fpb,
                              item: foto.itemDescription,
                              armada: foto.armada,
                            });
                            setIsViewerOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Buka Viewer"
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(foto.id, foto.noTtb)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition"
                          title="Hapus Foto"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pop-up Box: Form Upload Foto Lapangan */}
      {isUploadOpen && (
        <UploadFotoLapanganModal
          isOpen={isUploadOpen}
          onClose={() => {
            setIsUploadOpen(false);
            setUploadPreFill(null);
          }}
          defaultNoTtb={uploadPreFill?.noTtb || ''}
          defaultFpb={uploadPreFill?.fpb || ''}
          defaultNoPo={uploadPreFill?.noPo || ''}
          defaultNoFstb={uploadPreFill?.noFstb || ''}
          defaultItem={uploadPreFill?.item || ''}
          defaultArmada={uploadPreFill?.armada || ''}
          defaultPicLap={uploadPreFill?.picLap || 'AGUS'}
          availableOptions={availableTtbSuggestions}
          onSuccess={(saved) => {
            loadFotos();
            setViewerTarget({
              noTtb: saved.noTtb,
              noFstb: saved.noFstb,
              fpb: saved.fpb,
              item: saved.itemDescription,
              armada: saved.armada,
            });
            setIsViewerOpen(true);
          }}
          showToast={showToast}
        />
      )}

      {/* Pop-up Box: Viewer Galeri Foto Lapangan */}
      {isViewerOpen && (
        <FotoLapanganViewerModal
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false);
            setViewerTarget(null);
          }}
          noTtb={viewerTarget?.noTtb}
          noFstb={viewerTarget?.noFstb}
          fpb={viewerTarget?.fpb}
          item={viewerTarget?.item}
          armada={viewerTarget?.armada}
          onOpenUpload={(ttb) => {
            setIsViewerOpen(false);
            setUploadPreFill({ noTtb: ttb });
            setIsUploadOpen(true);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
