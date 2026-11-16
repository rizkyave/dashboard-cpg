'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Folder,
  FolderPlus,
  Upload,
  Search,
  Filter,
  Eye,
  Download,
  Trash2,
  ExternalLink,
  Shield,
  Anchor,
  BookOpen,
  CheckSquare,
  Calendar,
  Clock,
  Tag,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { SopDocument, SopFolder, RegulasiSopData } from '@/types/regulasiSop';
import { useAuth } from '@/context/AuthContext';

const FOLDER_COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue: {
    bg: 'bg-blue-500/10 hover:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  purple: {
    bg: 'bg-purple-500/10 hover:bg-purple-500/15',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    badge: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  emerald: {
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  amber: {
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  teal: {
    bg: 'bg-teal-500/10 hover:bg-teal-500/15',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500/20 hover:border-teal-500/40',
    badge: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
  },
  cyan: {
    bg: 'bg-cyan-500/10 hover:bg-cyan-500/15',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    badge: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  },
  rose: {
    bg: 'bg-rose-500/10 hover:bg-rose-500/15',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20 hover:border-rose-500/40',
    badge: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
};

export default function RegulasiSopTab() {
  const { user, isAdmin } = useAuth();
  const isManagerOrAdmin = isAdmin || user?.role === 'manager' || user?.role === 'direksi';

  const [folders, setFolders] = useState<SopFolder[]>([]);
  const [documents, setDocuments] = useState<SopDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [viewerDoc, setViewerDoc] = useState<SopDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);

  // Form Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadDocNumber, setUploadDocNumber] = useState<string>('');
  const [uploadFolderId, setUploadFolderId] = useState<string>('');
  const [uploadVersion, setUploadVersion] = useState<string>('v1.0');
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadSummary, setUploadSummary] = useState<string>('');
  const [uploadTags, setUploadTags] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Folder Baru State
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderCode, setNewFolderCode] = useState<string>('');
  const [newFolderDesc, setNewFolderDesc] = useState<string>('');
  const [newFolderColor, setNewFolderColor] = useState<'blue' | 'purple' | 'emerald' | 'amber' | 'teal'>('blue');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Muat data dari API
  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/regulasi-sop?_t=${Date.now()}`);
      const json = await res.json();
      if (json.success) {
        setFolders(json.folders || []);
        setDocuments(json.documents || []);
        if (json.folders?.length > 0 && !uploadFolderId) {
          setUploadFolderId(json.folders[0].id);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data SOP:', err);
      showToast('Gagal memuat data regulasi SOP.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Dokumen
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Filter Folder
      if (selectedFolderId !== 'ALL' && doc.folderId !== selectedFolderId) {
        return false;
      }
      // Filter Status
      if (selectedStatus !== 'ALL' && doc.status !== selectedStatus) {
        return false;
      }
      // Filter Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchNumber = doc.docNumber.toLowerCase().includes(q);
        const matchSummary = doc.summary.toLowerCase().includes(q);
        const matchTags = doc.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchNumber && !matchSummary && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [documents, selectedFolderId, selectedStatus, searchQuery]);

  // Hitung jumlah dokumen per folder
  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    documents.forEach((d) => {
      map[d.folderId] = (map[d.folderId] || 0) + 1;
    });
    return map;
  }, [documents]);

  // Handler Render Folder Icon
  const renderFolderIcon = (iconName: string, colorClass: string) => {
    switch (iconName) {
      case 'Shield':
        return <Shield className={`size-5 ${colorClass}`} />;
      case 'Anchor':
        return <Anchor className={`size-5 ${colorClass}`} />;
      case 'BookOpen':
        return <BookOpen className={`size-5 ${colorClass}`} />;
      case 'CheckSquare':
        return <CheckSquare className={`size-5 ${colorClass}`} />;
      default:
        return <FileText className={`size-5 ${colorClass}`} />;
    }
  };

  // Submit Upload Dokumen
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadDocNumber.trim() || !uploadFolderId) {
      showToast('Harap lengkapi Judul, Nomor Dokumen, dan Folder Kategori.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (uploadFile) {
        formData.append('file', uploadFile);
      }
      formData.append('title', uploadTitle);
      formData.append('docNumber', uploadDocNumber);
      formData.append('folderId', uploadFolderId);
      formData.append('version', uploadVersion);
      formData.append('effectiveDate', uploadDate);
      formData.append('summary', uploadSummary);
      formData.append('tags', uploadTags);
      formData.append('uploadedBy', user?.username || 'admin');
      formData.append('uploadedByName', user?.name || 'Administrator');

      const res = await fetch('/api/regulasi-sop', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengunggah file.');
      }

      showToast(`Dokumen "${uploadTitle}" berhasil ditambahkan ke folder!`, 'success');
      setIsUploadModalOpen(false);
      // Reset form
      setUploadFile(null);
      setUploadTitle('');
      setUploadDocNumber('');
      setUploadSummary('');
      setUploadTags('');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Terjadi kesalahan saat upload.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Buat Folder Baru
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !newFolderCode.trim()) {
      showToast('Harap isi Nama dan Kode Folder.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/regulasi-sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_folder',
          name: newFolderName,
          code: newFolderCode,
          description: newFolderDesc,
          color: newFolderColor,
          icon: 'Folder',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membuat folder.');
      }

      showToast(`Folder "${newFolderName}" berhasil dibuat!`, 'success');
      setIsFolderModalOpen(false);
      setNewFolderName('');
      setNewFolderCode('');
      setNewFolderDesc('');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuat folder.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Dokumen
  const handleDeleteDocument = async (docId: string, title: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus dokumen "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/regulasi-sop?docId=${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus dokumen.');
      }

      showToast('Dokumen berhasil dihapus.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menghapus dokumen.', 'error');
    }
  };

  // Buka Viewer & Increment Counter
  const handleOpenViewer = async (doc: SopDocument) => {
    setViewerDoc(doc);
    // Kirim patch increment view count secara asinkron
    fetch('/api/regulasi-sop', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: doc.id, action: 'increment_view' }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="size-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-card via-card to-muted/40 border border-border shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                Pusat Dokumen Resmi CPG
              </span>
              <span className="text-xs text-muted-foreground">• Standar ISO &amp; Tata Kelola</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="size-6 text-cyan-500" />
              Pusat Regulasi &amp; SOP
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Portal repositori terpadu untuk pedoman operasional pengadaan, tata kelola perusahaan (SK Direksi), standar K3 maritim, dan formulir baku PT Cindara Pratama Lines.
            </p>
          </div>

          {/* Action Buttons (Admin & Manager Only) */}
          <div className="flex items-center gap-2 shrink-0">
            {isManagerOrAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <FolderPlus className="size-3.5 text-cyan-500" />
                  <span className="hidden sm:inline">Buat Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <Upload className="size-3.5" />
                  <span>Unggah SOP Baru</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Segarkan Data SOP"
            >
              <RotateCcw className={`size-4 ${isLoading ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Folder Kategori */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Direktori Folder Kategori
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {folders.length} Folder
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedFolderId('ALL')}
            className={`text-xs font-semibold transition cursor-pointer ${
              selectedFolderId === 'ALL'
                ? 'text-cyan-500 underline'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Lihat Semua Dokumen ({documents.length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const colorCfg = FOLDER_COLOR_MAP[folder.color] || FOLDER_COLOR_MAP.blue;
            const count = folderCounts[folder.id] || 0;

            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer group relative overflow-hidden select-none active:scale-[0.98] ${
                  isSelected
                    ? 'ring-2 ring-cyan-500 shadow-md bg-card border-cyan-500/40'
                    : `${colorCfg.bg} ${colorCfg.border} bg-card`
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg bg-background border border-border shadow-xs group-hover:scale-105 transition-transform">
                    {renderFolderIcon(folder.icon, colorCfg.text)}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${colorCfg.badge}`}
                  >
                    {count} SOP
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-semibold tracking-wider text-muted-foreground">
                    {folder.code}
                  </div>
                  <h3 className="text-xs font-bold text-foreground group-hover:text-cyan-500 transition-colors line-clamp-1">
                    {folder.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {folder.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & Toolbar Dokumen */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan judul, nomor SOP, isi, atau tagar..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border shrink-0">
            {['ALL', 'ACTIVE', 'UNDER_REVIEW'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  selectedStatus === st
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'ALL' ? 'Semua Status' : st === 'ACTIVE' ? 'Aktif' : 'Dalam Review'}
              </button>
            ))}
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded-md text-xs transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-card text-cyan-500 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Tampilan Grid Card"
            >
              <Layers className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1 rounded-md text-xs transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-card text-cyan-500 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Tampilan Tabel Berkas"
            >
              <FileSpreadsheet className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Daftar Dokumen */}
      {filteredDocuments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border border-dashed space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <FileText className="size-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Tidak Ada Dokumen SOP Ditemukan</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Tidak ada file yang cocok dengan kriteria pencarian atau folder yang dipilih.
            </p>
          </div>
          {(searchQuery || selectedFolderId !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedFolderId('ALL');
                setSelectedStatus('ALL');
              }}
              className="px-3 py-1.5 rounded-lg bg-muted text-xs font-semibold text-foreground hover:bg-muted/80 transition"
            >
              Reset Filter Pencarian
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const folder = folders.find((f) => f.id === doc.folderId);
            const colorCfg = folder ? FOLDER_COLOR_MAP[folder.color] || FOLDER_COLOR_MAP.blue : FOLDER_COLOR_MAP.blue;

            return (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-card border border-border hover:border-cyan-500/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-foreground border border-border">
                      {doc.docNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                        {doc.version}
                      </span>
                      <span
                        className={`size-2 rounded-full ${
                          doc.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={doc.status === 'ACTIVE' ? 'SOP Berlaku Aktif' : 'Dalam Peninjauan'}
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h3
                      onClick={() => handleOpenViewer(doc)}
                      className="text-sm font-bold text-foreground group-hover:text-cyan-500 transition-colors cursor-pointer line-clamp-2"
                      title={doc.title}
                    >
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                      <Folder className="size-3 text-cyan-500 shrink-0" />
                      <span className="truncate">{folder?.name || 'SOP CPG'}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {doc.summary}
                  </p>

                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {doc.tags.slice(0, 4).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted/80 text-muted-foreground border border-border/80"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Info & Actions */}
                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                  <div className="text-[10px] font-mono text-muted-foreground">
                    <div>Berlaku: {doc.effectiveDate}</div>
                    <div className="text-slate-400">{(doc.fileSize / 1024 / 1024).toFixed(1)} MB • {doc.fileType.toUpperCase()}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Baca Dokumen */}
                    <button
                      type="button"
                      onClick={() => handleOpenViewer(doc)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Baca Dokumen Langsung"
                    >
                      <Eye className="size-3.5" />
                      <span>Baca</span>
                    </button>

                    {/* Unduh */}
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        download={doc.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                        title="Unduh Berkas PDF"
                      >
                        <Download className="size-3.5" />
                      </a>
                    )}

                    {/* Hapus (Admin only) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
                        className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition cursor-pointer"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                  <th className="py-3 px-4">No. Dokumen</th>
                  <th className="py-3 px-4">Judul Dokumen SOP</th>
                  <th className="py-3 px-4">Folder Kategori</th>
                  <th className="py-3 px-4">Versi</th>
                  <th className="py-3 px-4">Tgl Berlaku</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((doc) => {
                  const folder = folders.find((f) => f.id === doc.folderId);
                  return (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                        {doc.docNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div
                          onClick={() => handleOpenViewer(doc)}
                          className="font-bold text-foreground hover:text-cyan-500 transition cursor-pointer line-clamp-1"
                        >
                          {doc.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {doc.summary}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
                          {folder?.name || 'SOP CPG'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                        {doc.version}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {doc.effectiveDate}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenViewer(doc)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            <span>Buka</span>
                          </button>

                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              download={doc.fileName}
                              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Unduh"
                            >
                              <Download className="size-3.5" />
                            </a>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id, doc.title)}
                              className="p-1 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                              title="Hapus"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: In-App Document Viewer & Reader                  */}
      {/* ======================================================== */}
      {viewerDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in-50">
          <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                      {viewerDoc.docNumber}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Versi: {viewerDoc.version} • Berlaku: {viewerDoc.effectiveDate}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                    {viewerDoc.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {viewerDoc.fileUrl && (
                  <a
                    href={viewerDoc.fileUrl}
                    download={viewerDoc.fileName}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                  >
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline">Unduh PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewerDoc(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Info Card Ringkasan Resmi */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <Info className="size-4" />
                  <span>Ikhtisar Pedoman &amp; Tata Kelola</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {viewerDoc.summary}
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>Diupload Oleh: <strong className="text-slate-200">{viewerDoc.uploadedByName || viewerDoc.uploadedBy}</strong></span>
                  <span>&bull;</span>
                  <span>Tanggal Terbit: <strong className="text-slate-200">{viewerDoc.effectiveDate}</strong></span>
                  <span>&bull;</span>
                  <span>Dibaca: <strong className="text-cyan-400">{(viewerDoc.viewCount || 0) + 1}x</strong></span>
                </div>
              </div>

              {/* PDF Container / Fallback Interactive Document Text */}
              {viewerDoc.fileUrl ? (
                <div className="w-full h-[520px] rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                  <iframe
                    src={viewerDoc.fileUrl}
                    title={viewerDoc.title}
                    className="w-full h-full border-none"
                  />
                </div>
              ) : (
                /* Virtual Document Content Reader jika belum ada file binary */
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/90 space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-cyan-400 font-bold text-xs uppercase tracking-wider">
                        PT Cindara Pratama Lines &bull; Salinan Resmi SOP
                      </div>
                      <div className="text-sm font-bold text-white mt-1">{viewerDoc.title}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-400">
                      <div>Status: <span className="text-emerald-400 font-bold">TERVERIFIKASI</span></div>
                      <div>Klasifikasi: Internal Perusahaan</div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-300">
                      1. TUJUAN &amp; RUANG LINGKUP
                    </h4>
                    <p>
                      Pedoman ini disusun sebagai acuan baku dan mengikat bagi seluruh unit kerja terkait di lingkungan PT Cindara Pratama Lines (CPG), galangan PT Galangan Aliran Jaya (GAJ), dan seluruh armada kapal untuk menjamin konsistensi, transparansi, serta akuntabilitas proses.
                    </p>

                    <h4 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-300 pt-2">
                      2. KETENTUAN UTAMA
                    </h4>
                    <p className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                      {viewerDoc.summary}
                    </p>

                    <h4 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-300 pt-2">
                      3. TANGGUNG JAWAB &amp; SANKSI
                    </h4>
                    <p>
                      Setiap pelanggaran terhadap prosedur ini akan ditindaklanjuti sesuai peraturan ketenagakerjaan dan pakta integritas perusahaan. Pengawasan berkala dilakukan oleh Divisi Internal Audit dan Management Representative.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
              <div>Portal Regulasi &amp; SOP CPG &bull; Sistem Terpadu Pengadaan</div>
              <button
                type="button"
                onClick={() => setViewerDoc(null)}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer"
              >
                Tutup Dokumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Form Upload Dokumen SOP Baru                     */}
      {/* ======================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl text-foreground space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                  <Upload className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Unggah Dokumen SOP Baru</h3>
                  <p className="text-[10px] text-muted-foreground">Tambahkan berkas pedoman resmi ke folder kategori</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              {/* Folder Kategori */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Folder Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={uploadFolderId}
                  onChange={(e) => setUploadFolderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-cyan-500/30"
                  required
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.code}] {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Judul Dokumen */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Judul Dokumen SOP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Contoh: SOP Validasi Dokumen TTB 4 PIC"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/30"
                  required
                />
              </div>

              {/* Nomor Dokumen & Versi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Nomor Dokumen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadDocNumber}
                    onChange={(e) => setUploadDocNumber(e.target.value)}
                    placeholder="SOP-CPG-LOG-001"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Versi</label>
                  <input
                    type="text"
                    value={uploadVersion}
                    onChange={(e) => setUploadVersion(e.target.value)}
                    placeholder="v1.0"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              {/* Tanggal Efektif */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Tanggal Berlaku</label>
                <input
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              {/* Ringkasan */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Ikhtisar / Ringkasan SOP</label>
                <textarea
                  value={uploadSummary}
                  onChange={(e) => setUploadSummary(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan secara ringkas maksud, alur kerja, dan kewenangan dalam SOP ini..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              {/* File Upload PDF */}
              <div>
                <label className="font-semibold text-foreground block mb-1">File Dokumen (PDF)</label>
                <input
                  type="file"
                  accept=".pdf, .docx, .xlsx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-600 hover:file:bg-cyan-500/20 cursor-pointer"
                />
              </div>

              {/* Tagar */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Tagar / Kata Kunci</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="Pisahkan dengan koma: TTB, Validasi, 4 PIC, Logistik"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Mengunggah...' : 'Simpan & Publikasikan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Form Buat Folder Kategori Baru                   */}
      {/* ======================================================== */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl text-foreground space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                  <FolderPlus className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Buat Folder Kategori Baru</h3>
                  <p className="text-[10px] text-muted-foreground">Kelompokkan dokumen SOP sesuai departemen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Nama Folder <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Contoh: SOP Perawatan Mesin Kapal"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-cyan-500/30"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Kode Singkat Folder <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFolderCode}
                  onChange={(e) => setNewFolderCode(e.target.value)}
                  placeholder="Contoh: SOP-MTC"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-mono focus:ring-2 focus:ring-cyan-500/30 uppercase"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Warna Tema Folder</label>
                <select
                  value={newFolderColor}
                  onChange={(e: any) => setNewFolderColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-cyan-500/30"
                >
                  <option value="blue">Biru (Logistik & Purchasing)</option>
                  <option value="purple">Ungu (Direksi & Tata Kelola)</option>
                  <option value="emerald">Hijau (K3 & Keselamatan)</option>
                  <option value="amber">Amber (Gudang & Armada)</option>
                  <option value="teal">Teal (Formulir Baku)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Deskripsi Singkat</label>
                <textarea
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  rows={2}
                  placeholder="Deskripsi dokumen yang disimpan di dalam folder ini..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                >
                  {isSubmitting ? 'Membuat...' : 'Buat Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
