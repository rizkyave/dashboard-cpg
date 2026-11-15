'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Tag,
  KeyRound,
  Filter,
} from 'lucide-react';
import {
  RegisteredVendor,
  VendorCategory,
  VendorStatus,
  VendorLegalType,
  VENDOR_CATEGORY_LABELS,
} from '@/types/vendor';

interface Props {
  isAdmin: boolean;
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export default function VendorManagementCard({ isAdmin, showToast }: Props) {
  const [vendors, setVendors] = useState<RegisteredVendor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedVendor, setSelectedVendor] = useState<RegisteredVendor | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formLegalType, setFormLegalType] = useState<VendorLegalType>('PT');
  const [formNpwp, setFormNpwp] = useState('');
  const [formNib, setFormNib] = useState('');
  const [formCategories, setFormCategories] = useState<VendorCategory[]>(['GENERAL_SUPPLIER']);
  const [formPicName, setFormPicName] = useState('');
  const [formPicPhone, setFormPicPhone] = useState('');
  const [formPicEmail, setFormPicEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Balikpapan');
  const [formBankName, setFormBankName] = useState('Bank Mandiri');
  const [formBankAccountNumber, setFormBankAccountNumber] = useState('');
  const [formBankAccountHolder, setFormBankAccountHolder] = useState('');
  const [formStatus, setFormStatus] = useState<VendorStatus>('ACTIVE');
  const [formNotes, setFormNotes] = useState('');

  // Fetch Vendors
  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vendors?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.vendors)) {
          setVendors(json.vendors);
        }
      }
    } catch {
      showToast?.('Gagal memuat master data vendor DPT.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && !v.categories.includes(categoryFilter as VendorCategory)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = v.name.toLowerCase().includes(q);
        const matchCode = v.code.toLowerCase().includes(q);
        const matchNpwp = v.npwp.toLowerCase().includes(q);
        const matchPic = v.picName.toLowerCase().includes(q);
        const matchPhone = v.picPhone.includes(q);
        if (!matchName && !matchCode && !matchNpwp && !matchPic && !matchPhone) return false;
      }
      return true;
    });
  }, [vendors, searchQuery, statusFilter, categoryFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => v.status === 'ACTIVE').length;
    const pending = vendors.filter((v) => v.status === 'PENDING').length;
    const blacklisted = vendors.filter((v) => v.status === 'BLACKLISTED').length;
    return { total, active, pending, blacklisted };
  }, [vendors]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormName('');
    setFormLegalType('PT');
    setFormNpwp('');
    setFormNib('');
    setFormCategories(['GENERAL_SUPPLIER']);
    setFormPicName('');
    setFormPicPhone('');
    setFormPicEmail('');
    setFormAddress('');
    setFormCity('Balikpapan');
    setFormBankName('Bank Mandiri');
    setFormBankAccountNumber('');
    setFormBankAccountHolder('');
    setFormStatus('ACTIVE');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (vendor: RegisteredVendor) => {
    setSelectedVendor(vendor);
    setFormName(vendor.name);
    setFormLegalType(vendor.legalType);
    setFormNpwp(vendor.npwp);
    setFormNib(vendor.nib || '');
    setFormCategories(vendor.categories || ['GENERAL_SUPPLIER']);
    setFormPicName(vendor.picName);
    setFormPicPhone(vendor.picPhone);
    setFormPicEmail(vendor.picEmail);
    setFormAddress(vendor.officeAddress || '');
    setFormCity(vendor.city || 'Balikpapan');
    setFormBankName(vendor.bankName || '');
    setFormBankAccountNumber(vendor.bankAccountNumber || '');
    setFormBankAccountHolder(vendor.bankAccountHolder || '');
    setFormStatus(vendor.status);
    setFormNotes(vendor.notes || '');
    setIsEditModalOpen(true);
  };

  // Submit Add
  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNpwp.trim()) {
      showToast?.('Nama Vendor dan NPWP wajib diisi.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_VENDOR',
          vendor: {
            name: formName.trim(),
            legalType: formLegalType,
            npwp: formNpwp.trim(),
            nib: formNib.trim() || undefined,
            categories: formCategories,
            picName: formPicName.trim() || 'PIC Komersial',
            picPhone: formPicPhone.trim(),
            picEmail: formPicEmail.trim(),
            officeAddress: formAddress.trim(),
            city: formCity.trim(),
            bankName: formBankName.trim(),
            bankAccountNumber: formBankAccountNumber.trim(),
            bankAccountHolder: formBankAccountHolder.trim() || formName.trim(),
            status: formStatus,
            notes: formNotes.trim(),
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast?.(`Vendor ${formName} berhasil didaftarkan ke DPT.`, 'success');
        setIsAddModalOpen(false);
        fetchVendors();
      } else {
        showToast?.(json.message || 'Gagal mendaftarkan vendor.', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit
  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_VENDOR',
          vendor: {
            id: selectedVendor.id,
            name: formName.trim(),
            legalType: formLegalType,
            npwp: formNpwp.trim(),
            nib: formNib.trim() || undefined,
            categories: formCategories,
            picName: formPicName.trim(),
            picPhone: formPicPhone.trim(),
            picEmail: formPicEmail.trim(),
            officeAddress: formAddress.trim(),
            city: formCity.trim(),
            bankName: formBankName.trim(),
            bankAccountNumber: formBankAccountNumber.trim(),
            bankAccountHolder: formBankAccountHolder.trim(),
            status: formStatus,
            notes: formNotes.trim(),
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast?.('Data vendor berhasil diperbarui.', 'success');
        setIsEditModalOpen(false);
        fetchVendors();
      } else {
        showToast?.(json.message || 'Gagal memperbarui vendor.', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (vendor: RegisteredVendor, newStatus: VendorStatus) => {
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_STATUS',
          vendorId: vendor.id,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast?.(`Status vendor ${vendor.name} diubah menjadi ${newStatus}.`, 'info');
        fetchVendors();
      } else {
        showToast?.(json.message || 'Gagal mengubah status.', 'error');
      }
    } catch {
      showToast?.('Gagal menghubungi server.', 'error');
    }
  };

  // Delete Vendor
  const handleDeleteVendor = async (vendor: RegisteredVendor) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus vendor "${vendor.name}" dari DPT CPG?`)) {
      return;
    }

    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_VENDOR',
          vendorId: vendor.id,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast?.(`Vendor ${vendor.name} berhasil dihapus dari DPT.`, 'success');
        fetchVendors();
      } else {
        showToast?.(json.message || 'Gagal menghapus vendor.', 'error');
      }
    } catch {
      showToast?.('Gagal menghapus vendor.', 'error');
    }
  };

  // Copy Token
  const handleCopyToken = (vendor: RegisteredVendor) => {
    navigator.clipboard.writeText(vendor.accessToken);
    setCopiedTokenId(vendor.id);
    showToast?.(`Kode akses resmi untuk ${vendor.name} berhasil disalin!`, 'success');
    setTimeout(() => setCopiedTokenId(null), 3000);
  };

  const toggleCategorySelection = (cat: VendorCategory) => {
    setFormCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Building2 className="size-4" />
            </span>
            <h3 className="text-sm font-bold text-foreground">
              Daftar Penyedia Terseleksi (DPT / Master Rekanan CPG)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Sistem Registrasi Sah
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Hanya rekanan yang berstatus <strong>AKTIF</strong> dalam master DPT ini yang memiliki hak akses dan dapat mengirimkan penawaran pada seluruh paket tender CPG.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchVendors}
            disabled={isLoading}
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Segarkan data DPT"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Daftarkan Rekanan Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-border bg-muted/20">
          <span className="text-[11px] text-muted-foreground">Total Rekanan DPT:</span>
          <p className="text-base font-bold text-foreground font-mono mt-0.5">{metrics.total}</p>
        </div>
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Rekanan Aktif (Valid):</span>
          <p className="text-base font-bold text-emerald-800 dark:text-emerald-200 font-mono mt-0.5">
            {metrics.active}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <span className="text-[11px] text-amber-700 dark:text-amber-300">Menunggu Verifikasi:</span>
          <p className="text-base font-bold text-amber-800 dark:text-amber-200 font-mono mt-0.5">
            {metrics.pending}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10">
          <span className="text-[11px] text-rose-700 dark:text-rose-300">Blacklist (Ditolak):</span>
          <p className="text-base font-bold text-rose-800 dark:text-rose-200 font-mono mt-0.5">
            {metrics.blacklisted}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between text-xs">
        <div className="relative flex-1">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama perusahaan, NPWP, nama PIC, nomor WhatsApp..."
            className="w-full h-8 pl-8 pr-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-border bg-background text-foreground text-xs"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif (DPT Valid)</option>
            <option value="PENDING">Pending Verifikasi</option>
            <option value="INACTIVE">Non-Aktif</option>
            <option value="BLACKLISTED">Blacklisted</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-border bg-background text-foreground text-xs"
          >
            <option value="ALL">Semua Kategori</option>
            {Object.entries(VENDOR_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5">ID / Kode</th>
              <th className="px-3 py-2.5">Nama Perusahaan &amp; Legalitas</th>
              <th className="px-3 py-2.5">Kategori Komoditas</th>
              <th className="px-3 py-2.5">Kontak PIC &amp; WhatsApp</th>
              <th className="px-3 py-2.5">Rekening Bank</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-sans">
            {filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  {isLoading ? 'Memuat data rekanan...' : 'Tidak ada rekanan DPT yang sesuai dengan kriteria pencarian.'}
                </td>
              </tr>
            ) : (
              filteredVendors.map((vendor) => {
                const isCopied = copiedTokenId === vendor.id;
                return (
                  <tr key={vendor.id} className="hover:bg-muted/30 transition">
                    {/* ID / Kode */}
                    <td className="px-3 py-2.5 font-mono text-[11px] align-top">
                      <div className="font-bold text-foreground">{vendor.code}</div>
                      <span className="text-[10px] text-muted-foreground">{vendor.id}</span>
                    </td>

                    {/* Nama Perusahaan & NPWP */}
                    <td className="px-3 py-2.5 align-top space-y-1">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <span>{vendor.name}</span>
                        {vendor.status === 'ACTIVE' && (
                          <span title="Terverifikasi DPT">
                            <ShieldCheck className="size-3.5 text-emerald-600 inline" />
                          </span>
                        )}
                        {vendor.status === 'BLACKLISTED' && (
                          <span title="Blacklisted">
                            <ShieldAlert className="size-3.5 text-rose-600 inline" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <p>NPWP: <span className="font-mono text-foreground font-semibold">{vendor.npwp}</span></p>
                        {vendor.nib && <p>NIB: <span className="font-mono">{vendor.nib}</span></p>}
                        {vendor.city && (
                          <p className="flex items-center gap-1">
                            <MapPin className="size-2.5" />
                            <span>{vendor.city}</span>
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Kategori Komoditas */}
                    <td className="px-3 py-2.5 align-top space-y-1 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {(vendor.categories || []).map((cat) => (
                          <span
                            key={cat}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border"
                          >
                            {VENDOR_CATEGORY_LABELS[cat] || cat}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* PIC & WhatsApp */}
                    <td className="px-3 py-2.5 align-top space-y-1 text-[11px]">
                      <div className="font-semibold text-foreground">{vendor.picName}</div>
                      <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-mono text-[10px]">
                        <Phone className="size-3" />
                        <span>{vendor.picPhone}</span>
                      </div>
                      {vendor.picEmail && (
                        <div className="flex items-center gap-1 text-muted-foreground text-[10px] truncate max-w-[150px]">
                          <Mail className="size-3" />
                          <span>{vendor.picEmail}</span>
                        </div>
                      )}
                    </td>

                    {/* Rekening Bank */}
                    <td className="px-3 py-2.5 align-top space-y-0.5 text-[11px]">
                      {vendor.bankAccountNumber ? (
                        <>
                          <div className="font-semibold text-foreground flex items-center gap-1">
                            <CreditCard className="size-3 text-sky-600" />
                            <span>{vendor.bankName}</span>
                          </div>
                          <p className="font-mono text-[10px] text-foreground font-bold">
                            {vendor.bankAccountNumber}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            a.n. {vendor.bankAccountHolder || vendor.name}
                          </p>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Belum diinput</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 align-top text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          vendor.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : vendor.status === 'PENDING'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : vendor.status === 'BLACKLISTED'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {vendor.status === 'ACTIVE'
                          ? 'AKTIF'
                          : vendor.status === 'PENDING'
                          ? 'PENDING'
                          : vendor.status === 'BLACKLISTED'
                          ? 'BLACKLIST'
                          : 'NON-AKTIF'}
                      </span>
                    </td>

                    {/* Aksi */}
                    <td className="px-3 py-2.5 align-top text-right space-x-1 whitespace-nowrap">
                      {/* Salin Access Token */}
                      <button
                        type="button"
                        onClick={() => handleCopyToken(vendor)}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                        title="Salin Kode Akses Portal Resmi Rekanan"
                      >
                        {isCopied ? (
                          <Check className="size-3.5 text-emerald-600" />
                        ) : (
                          <KeyRound className="size-3.5 text-sky-600" />
                        )}
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(vendor)}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                            title="Edit Data Rekanan"
                          >
                            <Edit2 className="size-3.5" />
                          </button>

                          {vendor.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(vendor, 'BLACKLISTED')}
                              className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition cursor-pointer"
                              title="Blacklist Rekanan"
                            >
                              <ShieldAlert className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(vendor, 'ACTIVE')}
                              className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition cursor-pointer"
                              title="Aktifkan Rekanan"
                            >
                              <CheckCircle2 className="size-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteVendor(vendor)}
                            className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition cursor-pointer"
                            title="Hapus dari DPT"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: ADD / EDIT VENDOR */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Building2 className="size-4 text-emerald-600" />
                <span>{isAddModalOpen ? 'Pendaftaran Rekanan Baru (DPT CPG)' : `Edit Data: ${formName}`}</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <XCircle className="size-4" />
              </button>
            </div>

            <form onSubmit={isAddModalOpen ? handleCreateVendor : handleUpdateVendor} className="space-y-4">
              {/* Bagian 1: Legalitas Perusahaan */}
              <div className="space-y-2">
                <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  1. Legalitas Perusahaan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Bentuk Badan Usaha *
                    </label>
                    <select
                      value={formLegalType}
                      onChange={(e) => setFormLegalType(e.target.value as VendorLegalType)}
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    >
                      <option value="PT">PT (Perseroan Terbatas)</option>
                      <option value="CV">CV (Persekutuan Komanditer)</option>
                      <option value="UD">UD (Usaha Dagang)</option>
                      <option value="KOPERASI">Koperasi</option>
                      <option value="PERORANGAN">Perorangan</option>
                      <option value="LAINNYA">Lainnya</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nama Resmi Perusahaan (Sesuai Akta) *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Contoh: PT. Samudra Bahari Teknik"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nomor Pokok Wajib Pajak (NPWP) *
                    </label>
                    <input
                      type="text"
                      value={formNpwp}
                      onChange={(e) => setFormNpwp(e.target.value)}
                      placeholder="Contoh: 01.452.889.3-042.000"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nomor Induk Berusaha (NIB)
                    </label>
                    <input
                      type="text"
                      value={formNib}
                      onChange={(e) => setFormNib(e.target.value)}
                      placeholder="Contoh: 9120004561234"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Bidang Usaha & Komoditas */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  2. Kualifikasi Bidang Komoditas Pengadaan
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.entries(VENDOR_CATEGORY_LABELS) as [VendorCategory, string][]).map(([k, label]) => {
                    const isChecked = formCategories.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleCategorySelection(k)}
                        className={`p-2 rounded-lg border text-left text-[11px] font-medium transition cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-semibold'
                            : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="truncate pr-1">{label}</span>
                        {isChecked && <Check className="size-3 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bagian 3: PIC & Kontak WhatsApp */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  3. Kontak Penanggung Jawab (PIC Resmi)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nama PIC Komersial
                    </label>
                    <input
                      type="text"
                      value={formPicName}
                      onChange={(e) => setFormPicName(e.target.value)}
                      placeholder="Contoh: Bpk. Hendra Gunawan"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nomor WhatsApp PIC (Untuk Blast Tender) *
                    </label>
                    <input
                      type="text"
                      value={formPicPhone}
                      onChange={(e) => setFormPicPhone(e.target.value)}
                      placeholder="Contoh: 081288776655"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Email Resmi Perusahaan
                    </label>
                    <input
                      type="email"
                      value={formPicEmail}
                      onChange={(e) => setFormPicEmail(e.target.value)}
                      placeholder="sales@perusahaan.co.id"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Alamat Kantor / Workshop
                    </label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Jl. Pelabuhan Semayang No. 45"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Kota Operasional
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="Balikpapan"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 4: Rekening Bank Perusahaan */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  4. Rekening Bank Resmi (Untuk Penerbitan PO &amp; Finance)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nama Bank
                    </label>
                    <input
                      type="text"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      placeholder="Bank Mandiri / BCA / BNI"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nomor Rekening
                    </label>
                    <input
                      type="text"
                      value={formBankAccountNumber}
                      onChange={(e) => setFormBankAccountNumber(e.target.value)}
                      placeholder="149-00-1122334-5"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nama Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      value={formBankAccountHolder}
                      onChange={(e) => setFormBankAccountHolder(e.target.value)}
                      placeholder="Atas nama PT / CV resmi"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 5: Status & Catatan */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  5. Status &amp; Catatan Khusus
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Status Rekanan di DPT
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as VendorStatus)}
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-bold"
                    >
                      <option value="ACTIVE">AKTIF (Bisa Ikut Tender)</option>
                      <option value="PENDING">PENDING (Menunggu Verifikasi)</option>
                      <option value="INACTIVE">NON-AKTIF (Ditangguhkan)</option>
                      <option value="BLACKLISTED">BLACKLIST (Dilarang Ikut Tender)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Catatan Evaluasi / Rekam Jejak
                    </label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Catatan kelebihan, pengalaman proyek, atau histori layanan..."
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : isAddModalOpen ? 'Simpan Rekanan ke DPT' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
