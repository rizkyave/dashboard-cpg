'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileStack,
  CheckCircle2,
  Clock,
  Download,
  Search,
  RefreshCw,
  FileText,
  Boxes,
  ClipboardCheck,
  Camera,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  Eye,
  Loader2,
  Ship,
  Sparkles,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem, EntityCode } from '@/types/procurement';
import { ENTITIES } from '@/data/initialData';
import {
  DossierBundleItem,
  downloadDossierPdf,
} from '@/utils/pdfBundleCompiler';

interface RingkasanBerkasTabProps {
  procurementData?: ProcurementItem[];
  armadaData?: ArmadaItem[];
  onOpenAuditModal?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function RingkasanBerkasTab({
  procurementData = [],
  armadaData = [],
  onOpenAuditModal,
  showToast,
}: RingkasanBerkasTabProps) {
  // Filter States
  const [activeFilterTab, setActiveFilterTab] = useState<'COMPLETE' | 'ALL' | 'INCOMPLETE'>('COMPLETE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');

  // Loading States
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStep, setDownloadStep] = useState<string>('');

  // Storage Maps for uploaded docs & photos
  const [fstbMap, setFstbMap] = useState<Record<string, { noFstb: string; fileUrl: string }>>({});
  const [ttbMap, setTtbMap] = useState<Record<string, { noTtb: string; fileUrl: string }>>({});
  const [photoMap, setPhotoMap] = useState<Record<string, string[]>>({});
  const [efpbMap, setEfpbMap] = useState<Record<string, string>>({});

  // Fetch softcopy manifests from APIs
  const fetchManifests = async () => {
    setIsLoadingApi(true);
    try {
      const [fstbRes, ttbRes, photosRes, efpbRes] = await Promise.allSettled([
        fetch(`/api/upload-fstb?_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/upload-ttb?_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/ttb-photos?_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/sync-efpb-files?_t=${Date.now()}`).then((r) => r.json()),
      ]);

      // 1. Process FSTB docs
      if (fstbRes.status === 'fulfilled' && Array.isArray(fstbRes.value?.items)) {
        const map: Record<string, { noFstb: string; fileUrl: string }> = {};
        for (const item of fstbRes.value.items) {
          const no = (item.noFstb || item.originalFileName || '').trim().toLowerCase();
          const fpb = (item.noFpb || '').trim().toLowerCase();
          const po = (item.noPo || '').trim().toLowerCase();
          const url = item.fileUrl || `/api/upload-fstb/file?name=${encodeURIComponent(item.renamedFileName)}`;
          if (no) map[no] = { noFstb: item.noFstb || item.originalFileName, fileUrl: url };
          if (fpb) map[fpb] = { noFstb: item.noFstb || item.originalFileName, fileUrl: url };
          if (po) map[po] = { noFstb: item.noFstb || item.originalFileName, fileUrl: url };
        }
        setFstbMap(map);
      }

      // 2. Process TTB docs
      if (ttbRes.status === 'fulfilled' && Array.isArray(ttbRes.value?.items)) {
        const map: Record<string, { noTtb: string; fileUrl: string }> = {};
        for (const item of ttbRes.value.items) {
          const no = (item.noTtb || item.originalFileName || '').trim().toLowerCase();
          const fpb = (item.noFpb || '').trim().toLowerCase();
          const po = (item.noPo || '').trim().toLowerCase();
          const url = item.fileUrl || `/api/upload-ttb/file?name=${encodeURIComponent(item.renamedFileName)}`;
          if (no) map[no] = { noTtb: item.noTtb || item.originalFileName, fileUrl: url };
          if (fpb) map[fpb] = { noTtb: item.noTtb || item.originalFileName, fileUrl: url };
          if (po) map[po] = { noTtb: item.noTtb || item.originalFileName, fileUrl: url };
        }
        setTtbMap(map);
      }

      // 3. Process TTB Photos
      if (photosRes.status === 'fulfilled' && Array.isArray(photosRes.value?.photos)) {
        const map: Record<string, string[]> = {};
        for (const photo of photosRes.value.photos) {
          const ttb = (photo.noTtb || '').trim().toLowerCase();
          const armada = (photo.armada || '').trim().toLowerCase();
          const url = photo.url || `/api/ttb-photos/file?name=${encodeURIComponent(photo.name)}`;
          if (ttb) {
            map[ttb] = map[ttb] ? [...map[ttb], url] : [url];
          }
          if (armada) {
            map[armada] = map[armada] ? [...map[armada], url] : [url];
          }
        }
        setPhotoMap(map);
      }

      // 4. Process e-FPB files
      if (efpbRes.status === 'fulfilled' && Array.isArray(efpbRes.value?.files)) {
        const map: Record<string, string> = {};
        for (const f of efpbRes.value.files) {
          const key = (f.fpbNumber || f.filename || '').trim().toLowerCase();
          if (key) map[key] = f.url || '';
        }
        setEfpbMap(map);
      }
    } catch (err) {
      console.error('Error fetching manifests in RingkasanBerkasTab:', err);
    } finally {
      setIsLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchManifests();
  }, []);

  // Consolidate Items from Procurement & Armada lists
  const dossierItems = useMemo<DossierBundleItem[]>(() => {
    const rawList: (ProcurementItem | ArmadaItem)[] = [
      ...procurementData,
      ...armadaData,
    ];

    const dedupeMap = new Map<string, DossierBundleItem>();

    for (const row of rawList) {
      const rowAny = row as any;
      const fpb = String(rowAny.fpb || '').trim();
      const po = String(rowAny.po || rowAny.noPo || '').trim();
      const armada = String(rowAny.dept || rowAny.namaKapal || 'Armada CPG').trim();
      const itemDesc = String(rowAny.item || rowAny.namaBarang || 'Material Pengadaan').trim();

      // Skip invalid rows without FPB or PO
      if (!fpb && !po) continue;

      const normFpb = fpb.toLowerCase();
      const normPo = po.toLowerCase();
      const normArmada = armada.toLowerCase();

      const key = `${normFpb}_${normPo}_${normArmada}_${itemDesc.slice(0, 20).toLowerCase()}`;
      if (dedupeMap.has(key)) continue;

      // Check softcopy FSTB
      const explicitFstb = String(rowAny.noFstb || rowAny.fstb || '').trim();
      const fstbLookup = fstbMap[normFpb] || (normPo ? fstbMap[normPo] : undefined) || (explicitFstb ? fstbMap[explicitFstb.toLowerCase()] : undefined);
      const hasFstbDoc = Boolean(fstbLookup?.fileUrl || explicitFstb);
      const noFstb = fstbLookup?.noFstb || explicitFstb || '';
      const fstbPdfUrl = fstbLookup?.fileUrl || (noFstb ? `/api/upload-fstb/file?name=${encodeURIComponent(noFstb)}.pdf` : undefined);

      // Check softcopy TTB
      const explicitTtb = String(rowAny.noTtb || rowAny.ttb || '').trim();
      const ttbLookup = ttbMap[normFpb] || (normPo ? ttbMap[normPo] : undefined) || (explicitTtb ? ttbMap[explicitTtb.toLowerCase()] : undefined);
      const hasTtbDoc = Boolean(ttbLookup?.fileUrl || explicitTtb);
      const noTtb = ttbLookup?.noTtb || explicitTtb || '';
      const ttbPdfUrl = ttbLookup?.fileUrl || (noTtb ? `/api/upload-ttb/file?name=${encodeURIComponent(noTtb)}.pdf` : undefined);

      // Check Photos
      const photoLookup = (noTtb ? photoMap[noTtb.toLowerCase()] : undefined) || photoMap[normArmada] || [];
      const hasPhotos = photoLookup.length > 0;

      // Check FPB PDF
      const efpbUrl = efpbMap[normFpb] || `/api/parse-fpb-pdf?fpb=${encodeURIComponent(fpb)}&raw=true`;
      const hasFpbDoc = Boolean(fpb);

      const entity = String(rowAny.entity || rowAny.perusahaan || 'CPL');

      dedupeMap.set(key, {
        id: String(row.id || key),
        fpb,
        po: po || undefined,
        entity,
        armada,
        item: itemDesc,
        qty: (row as any).qty || (row as any).jumlah || 1,
        unit: (row as any).unit || (row as any).satuan || 'Pcs',
        tglFpb: ('tgl' in row ? (row as any).tgl : (row as any).tglFpb) || undefined,
        tglPo: ('tglPo' in row ? (row as any).tglPo : undefined),
        picPch: ('picPch' in row ? row.picPch : undefined),
        noFstb: noFstb || undefined,
        tglFstb: ('tglFstb' in row ? (row as any).tglFstb : undefined),
        noTtb: noTtb || undefined,
        tglTtb: ('tglTtb' in row ? (row as any).tglTtb : undefined),
        hasFpbDoc,
        hasFstbDoc,
        hasTtbDoc,
        hasPhotos,
        fpbPdfUrl: efpbUrl,
        fstbPdfUrl,
        ttbPdfUrl,
        photoUrls: photoLookup,
      });
    }

    return Array.from(dedupeMap.values());
  }, [procurementData, armadaData, fstbMap, ttbMap, photoMap, efpbMap]);

  // Filter Logic
  const filteredItems = useMemo(() => {
    return dossierItems.filter((item) => {
      // 1. Filter Tab (COMPLETE = 4/4, INCOMPLETE = <4, ALL = All)
      const isComplete = item.hasFpbDoc && item.hasFstbDoc && item.hasTtbDoc && item.hasPhotos;
      if (activeFilterTab === 'COMPLETE' && !isComplete) return false;
      if (activeFilterTab === 'INCOMPLETE' && isComplete) return false;

      // 2. Entity Filter
      if (selectedEntity !== 'ALL') {
        const itemEnt = (item.entity || '').toUpperCase();
        if (itemEnt !== selectedEntity) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          item.fpb.toLowerCase().includes(q) ||
          (item.po && item.po.toLowerCase().includes(q)) ||
          item.armada.toLowerCase().includes(q) ||
          item.item.toLowerCase().includes(q) ||
          (item.noFstb && item.noFstb.toLowerCase().includes(q)) ||
          (item.noTtb && item.noTtb.toLowerCase().includes(q)) ||
          (item.picPch && item.picPch.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [dossierItems, activeFilterTab, selectedEntity, searchQuery]);

  // Metrics KPI
  const metrics = useMemo(() => {
    let totalComplete = 0;
    let missingFstb = 0;
    let missingTtb = 0;
    let missingPhotos = 0;

    for (const item of dossierItems) {
      if (item.hasFpbDoc && item.hasFstbDoc && item.hasTtbDoc && item.hasPhotos) {
        totalComplete++;
      }
      if (!item.hasFstbDoc) missingFstb++;
      if (!item.hasTtbDoc) missingTtb++;
      if (!item.hasPhotos) missingPhotos++;
    }

    return {
      totalItems: dossierItems.length,
      totalComplete,
      missingFstb,
      missingTtb,
      missingPhotos,
    };
  }, [dossierItems]);

  // Handle Download Single PDF Dossier
  const handleDownload = async (item: DossierBundleItem) => {
    setDownloadingId(item.id);
    setDownloadStep('Memulai kompilasi...');
    try {
      showToast?.(`Mempersiapkan kompilasi berkas untuk ${item.fpb || item.po}...`, 'info');
      const res = await downloadDossierPdf(item, (step) => {
        setDownloadStep(step);
      });
      showToast?.(
        `Sukses mengunduh ${res.fileName} (${res.totalPages} halaman)!`,
        'success'
      );
    } catch (err: any) {
      console.error('Kompilasi error:', err);
      showToast?.(
        err.message || 'Gagal mengompilasi berkas PDF. Silakan periksa kembali berkas terkait.',
        'error'
      );
    } finally {
      setDownloadingId(null);
      setDownloadStep('');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileStack className="size-4 sm:size-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
              Ringkasan Berkas Lengkap &amp; Kompilasi Dossier
            </h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Menampilkan data <strong>FPB, FSTB, TTB, dan FOTO</strong> yang telah selesai secara administrasi dalam 1 kolom. Klik tombol unduh untuk mengompilasi semua berkas menjadi <strong>1 file PDF utuh</strong> untuk arsip &amp; audit keuangan.
          </p>
        </div>

        <button
          onClick={fetchManifests}
          disabled={isLoadingApi}
          className="self-start md:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Segarkan data softcopy dari Cloudflare R2 & Server e-FPB"
        >
          <RefreshCw className={`size-3.5 ${isLoadingApi ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          <span>{isLoadingApi ? 'Menyinkronkan...' : 'Refresh Berkas'}</span>
        </button>
      </div>

      {/* KPI 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: 100% Selesai */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-emerald-500/30 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none transition group-hover:scale-110" />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-mono">
              Selesai Administrasi (4/4)
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.totalComplete.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span>Siap dikompilasi ke 1 file PDF</span>
          </div>
        </div>

        {/* Card 2: Menunggu FSTB */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Belum Ada FSTB
            </span>
            <Boxes className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.missingFstb.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
            Menunggu serah terima barang
          </div>
        </div>

        {/* Card 3: Menunggu TTB */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Belum Ada TTB
            </span>
            <ClipboardCheck className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.missingTtb.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Menunggu tanda terima logistik
          </div>
        </div>

        {/* Card 4: Menunggu Foto Lapangan */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Belum Ada Foto
            </span>
            <Camera className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.missingPhotos.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            Menunggu dokumentasi fisik
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border shadow-xs">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/80 self-start md:self-auto">
          <button
            onClick={() => setActiveFilterTab('COMPLETE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeFilterTab === 'COMPLETE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Lengkap Selesai ({metrics.totalComplete})
          </button>
          <button
            onClick={() => setActiveFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeFilterTab === 'ALL'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Semua Data ({metrics.totalItems})
          </button>
          <button
            onClick={() => setActiveFilterTab('INCOMPLETE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeFilterTab === 'INCOMPLETE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Belum Lengkap ({metrics.totalItems - metrics.totalComplete})
          </button>
        </div>

        {/* Right: Search & Entity Select */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          {/* Entity Filter */}
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono font-medium text-foreground focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
            title="Filter Entitas Perusahaan CPG"
          >
            {ENTITIES.map((ent) => (
              <option key={ent.code} value={ent.code}>
                {ent.label}
              </option>
            ))}
          </select>

          {/* Quick Search Bar */}
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari FPB, PO, FSTB, TTB, barang, kapal..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table: 1-Column Administrasi + 1-Click Compile Button */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-3.5 min-w-[180px]">Armada &amp; Entitas</th>
                <th className="py-3 px-3.5 min-w-[220px]">Identitas Pengadaan (FPB / PO / Item)</th>
                {/* 1 KOLOM KELENGKAPAN ADMINISTRASI: FPB, FSTB, TTB, FOTO */}
                <th className="py-3 px-3.5 min-w-[260px] bg-emerald-500/5 border-x border-emerald-500/20">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                    <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Kelengkapan Administrasi (FPB &bull; FSTB &bull; TTB &bull; FOTO)</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 w-52 text-center">Aksi Kompilasi 1-Klik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileStack className="size-8 text-muted-foreground/40" />
                      <span className="font-semibold text-foreground text-sm">
                        Tidak ada data berkas yang sesuai filter
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Coba ubah kata kunci pencarian atau ganti filter tab ke &ldquo;Semua Data&rdquo;.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isComplete =
                    item.hasFpbDoc && item.hasFstbDoc && item.hasTtbDoc && item.hasPhotos;

                  const isDownloadingThis = downloadingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition group"
                    >
                      {/* No */}
                      <td className="py-3 px-3.5 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>

                      {/* Armada & Entitas */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Ship className="size-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          <span className="truncate">{item.armada}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">
                            {item.entity || 'CPG'}
                          </span>
                          {item.tglFpb && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Tgl: {item.tglFpb}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Identitas Pengadaan */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-foreground">
                            {item.fpb}
                          </span>
                          {item.po && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                              PO: {item.po}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2" title={item.item}>
                          {item.item}
                        </div>
                        {item.picPch && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            PIC PCH: {item.picPch}
                          </div>
                        )}
                      </td>

                      {/* 1 KOLOM KELENGKAPAN ADMINISTRASI TERPADU */}
                      <td className="py-3 px-3.5 bg-emerald-500/5 border-x border-emerald-500/20">
                        <div className="space-y-1.5">
                          {/* 4 Pilar Badges */}
                          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10.5px]">
                            {/* 1. FPB */}
                            <div
                              className={`px-2 py-1 rounded flex items-center justify-between border ${
                                item.hasFpbDoc
                                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-semibold'
                                  : 'bg-muted text-muted-foreground/70 border-border'
                              }`}
                              title={item.hasFpbDoc ? 'Dokumen e-FPB resmi tersedia' : 'Dokumen FPB belum ada'}
                            >
                              <span className="flex items-center gap-1">
                                <FileText className="size-3 shrink-0" />
                                <span>FPB</span>
                              </span>
                              <span>{item.hasFpbDoc ? '✓' : '-'}</span>
                            </div>

                            {/* 2. FSTB */}
                            <div
                              className={`px-2 py-1 rounded flex items-center justify-between border ${
                                item.hasFstbDoc
                                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-semibold'
                                  : 'bg-muted text-muted-foreground/70 border-border'
                              }`}
                              title={item.hasFstbDoc ? `FSTB Resmi: ${item.noFstb || 'Tersedia'}` : 'FSTB belum ada'}
                            >
                              <span className="flex items-center gap-1">
                                <Boxes className="size-3 shrink-0" />
                                <span>FSTB</span>
                              </span>
                              <span>{item.hasFstbDoc ? '✓' : '-'}</span>
                            </div>

                            {/* 3. TTB */}
                            <div
                              className={`px-2 py-1 rounded flex items-center justify-between border ${
                                item.hasTtbDoc
                                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-semibold'
                                  : 'bg-muted text-muted-foreground/70 border-border'
                              }`}
                              title={item.hasTtbDoc ? `TTB Resmi: ${item.noTtb || 'Tersedia'}` : 'TTB belum ada'}
                            >
                              <span className="flex items-center gap-1">
                                <ClipboardCheck className="size-3 shrink-0" />
                                <span>TTB</span>
                              </span>
                              <span>{item.hasTtbDoc ? '✓' : '-'}</span>
                            </div>

                            {/* 4. FOTO */}
                            <div
                              className={`px-2 py-1 rounded flex items-center justify-between border ${
                                item.hasPhotos
                                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-semibold'
                                  : 'bg-muted text-muted-foreground/70 border-border'
                              }`}
                              title={item.hasPhotos ? `${item.photoUrls?.length || 1} Foto Bukti Fisik Lapangan` : 'Foto belum ada'}
                            >
                              <span className="flex items-center gap-1">
                                <Camera className="size-3 shrink-0" />
                                <span>FOTO</span>
                              </span>
                              <span>{item.hasPhotos ? `${item.photoUrls?.length || 1}✓` : '-'}</span>
                            </div>
                          </div>

                          {/* Status Ringkasan Baris */}
                          <div className="flex items-center justify-between pt-0.5">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                                SELESAI ADMINISTRASI (4/4)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="size-3 text-amber-500" />
                                BELUM LENGKAP ({[item.hasFpbDoc, item.hasFstbDoc, item.hasTtbDoc, item.hasPhotos].filter(Boolean).length}/4)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Aksi 1-Klik Kompilasi File */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            disabled={isDownloadingThis}
                            className={`w-full h-8 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer ${
                              isComplete
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                : 'bg-foreground text-background hover:opacity-90'
                            } disabled:opacity-50`}
                            title="Kompilasi & Download seluruh berkas menjadi 1 file PDF utuh"
                          >
                            {isDownloadingThis ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span className="text-[11px] truncate">{downloadStep || 'Memproses...'}</span>
                              </>
                            ) : (
                              <>
                                <Download className="size-3.5 shrink-0" />
                                <span>{isComplete ? 'Unduh 1 PDF Lengkap' : 'Unduh Berkas PDF'}</span>
                              </>
                            )}
                          </button>

                          {onOpenAuditModal && (
                            <button
                              type="button"
                              onClick={() => onOpenAuditModal(item.fpb, item.po)}
                              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <Eye className="size-3" />
                              <span>Lihat Detail Audit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2 font-mono">
          <span>
            Menampilkan <strong>{filteredItems.length}</strong> tiket berkas pengadaan
          </span>
          <span className="text-[11px]">
            Format berkas: <strong>PDF A4 Standar (Cover Resmi + FPB + FSTB + TTB + Foto Fisik)</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
