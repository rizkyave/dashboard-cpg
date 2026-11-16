'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  Calendar,
  ShieldCheck,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  UserX,
  Sparkles,
} from 'lucide-react';
import { ApprovalDelegation } from '@/types/delegation';
import { isDelegationActive } from '@/utils/delegationHelper';
import { useAuth } from '@/context/AuthContext';

interface DelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelegationChanged?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function DelegationModal({
  isOpen,
  onClose,
  onDelegationChanged,
  showToast,
}: DelegationModalProps) {
  const { user, users, isAdmin, isManager } = useAuth();

  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');

  // Form State
  const [delegatorUsername, setDelegatorUsername] = useState<string>('');
  const [delegateUsername, setDelegateUsername] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState<string>('Cuti Tahunan');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch delegations on open
  useEffect(() => {
    if (isOpen) {
      fetchDelegations();
    }
  }, [isOpen]);

  const fetchDelegations = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/approval-delegations');
      const data = await res.json();
      if (data.success && Array.isArray(data.delegations)) {
        setDelegations(data.delegations);
      }
    } catch (e) {
      console.warn('Gagal memuat delegasi:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter kandidat pejabat yang bisa mendelegasikan wewenang (Supervisor, Manager, Admin)
  const delegatorCandidates = users.filter((u) => {
    const r = (u.role || '').toLowerCase();
    return (
      r === 'manager' ||
      r === 'supervisor' ||
      r === 'spv_purchasing' ||
      r === 'spv_logistik' ||
      r === 'admin'
    );
  });

  // Filter kandidat penerima delegasi (Plh)
  const delegateCandidates = users.filter((u) => {
    return u.username.toLowerCase() !== delegatorUsername.toLowerCase();
  });

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!delegatorUsername || !delegateUsername) {
      setErrorMsg('Pejabat cuti dan pejabat pengganti (Plh) wajib dipilih.');
      return;
    }

    if (delegatorUsername === delegateUsername) {
      setErrorMsg('Pejabat pengganti tidak boleh sama dengan pejabat yang cuti.');
      return;
    }

    if (startDate > endDate) {
      setErrorMsg('Tanggal mulai cuti tidak boleh melebihi tanggal selesai.');
      return;
    }

    const delegatorObj = users.find((u) => u.username === delegatorUsername);
    const delegateObj = users.find((u) => u.username === delegateUsername);

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/approval-delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegatorUsername,
          delegatorName: delegatorObj?.name || delegatorUsername,
          delegatorRole: delegatorObj?.role || 'supervisor',
          delegateUsername,
          delegateName: delegateObj?.name || delegateUsername,
          delegateRole: delegateObj?.role || 'supervisor',
          startDate,
          endDate,
          reason,
          status: 'ACTIVE',
          createdBy: user?.name || user?.username || 'admin',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan delegasi cuti.');
      }

      if (showToast) {
        showToast(
          `Delegasi wewenang Plh aktif untuk ${delegateObj?.name} a.n. ${delegatorObj?.name}!`,
          'success'
        );
      }

      setDelegations(data.delegations || []);
      setActiveTab('list');
      setReason('Cuti Tahunan');
      if (onDelegationChanged) onDelegationChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan sistem saat menyimpan delegasi.';
      setErrorMsg(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTerminateDelegation = async (delId: string, delegatorName: string) => {
    if (!confirm(`Apakah Anda yakin ingin MENGAKHIRI delegasi cuti a.n. ${delegatorName} lebih awal? Wewenang akan langsung kembali normal ke pejabat asal.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/approval-delegations?id=${delId}&terminate=true`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengakhiri delegasi.');
      }

      if (showToast) {
        showToast('Masa delegasi Plh telah diakhiri. Wewenang kembali normal.', 'info');
      }

      setDelegations(data.delegations || []);
      if (onDelegationChanged) onDelegationChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengakhiri delegasi.';
      if (showToast) showToast(msg, 'error');
    }
  };

  const handleDeleteDelegation = async (delId: string) => {
    if (!confirm('Hapus rekaman delegasi ini dari riwayat?')) return;

    try {
      const res = await fetch(`/api/approval-delegations?id=${delId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menghapus delegasi.');
      }

      if (showToast) showToast('Data riwayat delegasi berhasil dihapus.', 'info');
      setDelegations(data.delegations || []);
      if (onDelegationChanged) onDelegationChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus delegasi.';
      if (showToast) showToast(msg, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                Manajemen Delegasi Wewenang Cuti (Plh)
              </h3>
              <p className="text-xs text-muted-foreground">
                Pelimpahan wewenang tanda tangan sementara saat Supervisor / Manajer cuti atau tugas luar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-border bg-muted/20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 border-b-2 font-semibold text-xs flex items-center gap-1.5 transition ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="size-3.5" />
            <span>Daftar Delegasi ({delegations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 border-b-2 font-semibold text-xs flex items-center gap-1.5 transition ${
              activeTab === 'add'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus className="size-3.5" />
            <span>Tambah Delegasi Cuti Baru</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'list' ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Memuat data delegasi wewenang...
                </div>
              ) : delegations.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="size-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                    <UserCheck className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Belum Ada Delegasi Cuti Aktif</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      Saat ini seluruh alur pengesahan berjalan normal sesuai role definitif masing-masing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>Buat Delegasi Sekarang</span>
                  </button>
                </div>
              ) : (
                delegations.map((d) => {
                  const isActiveNow = isDelegationActive(d);
                  return (
                    <div
                      key={d.id}
                      className={`p-4 rounded-xl border transition ${
                        isActiveNow
                          ? 'border-emerald-500/40 bg-emerald-500/5 shadow-2xs'
                          : 'border-border bg-muted/20 opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                isActiveNow
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}
                            >
                              {isActiveNow ? '● AKTIF BERJALAN (PLH)' : 'NONAKTIF / BERAKHIR'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Alasan: <strong className="text-foreground">{d.reason}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm pt-1 flex-wrap">
                            <div className="font-semibold text-foreground">
                              {d.delegatorName}{' '}
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({d.delegatorRole.toUpperCase()})
                              </span>
                            </div>
                            <ArrowRight className="size-3.5 text-muted-foreground" />
                            <div className="font-bold text-indigo-600 dark:text-indigo-400">
                              {d.delegateName}{' '}
                              <span className="text-[10px] text-indigo-500 font-semibold">(Plh Sah)</span>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                            <Calendar className="size-3.5 text-muted-foreground" />
                            <span>
                              Masa Berlaku: <strong className="text-foreground">{d.startDate}</strong> s/d{' '}
                              <strong className="text-foreground">{d.endDate}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isActiveNow && (
                            <button
                              type="button"
                              onClick={() => handleTerminateDelegation(d.id, d.delegatorName)}
                              className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold transition cursor-pointer"
                              title="Akhiri masa cuti lebih awal (kembalikan wewenang sekarang)"
                            >
                              Akhiri Lebih Awal
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDelegation(d.id)}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-rose-600 transition cursor-pointer"
                            title="Hapus rekaman delegasi"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateDelegation} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="size-4" />
                  Prinsip Delegasi Berjangka (Plh)
                </p>
                <p className="opacity-90 leading-relaxed">
                  Selama periode cuti yang ditentukan, sistem otomatis memberikan wewenang tanda tangan pada slot pejabat yang cuti kepada pejabat pengganti (Plh). Dokumen yang disahkan akan tercatat sah secara hukum dan audit.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Pejabat yang Cuti / Tugas Luar: <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={delegatorUsername}
                    onChange={(e) => setDelegatorUsername(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground cursor-pointer"
                  >
                    <option value="">-- Pilih Pejabat Cuti --</option>
                    {delegatorCandidates.map((u) => (
                      <option key={u.id} value={u.username}>
                        {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Ditugaskan Kepada (Plh): <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={delegateUsername}
                    onChange={(e) => setDelegateUsername(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground cursor-pointer"
                  >
                    <option value="">-- Pilih Pejabat Pengganti (Plh) --</option>
                    {delegateCandidates.map((u) => (
                      <option key={u.id} value={u.username}>
                        {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Tanggal Mulai Cuti: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Tanggal Selesai Cuti: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Alasan / Keperluan Cuti: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Cuti Tahunan, Izin Khusus, Dinas Luar Kota Somber"
                  required
                  className="w-full text-xs rounded-xl border border-border bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="size-3.5 animate-spin" />
                      <span>Mengaktifkan Plh...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>Aktifkan Delegasi Plh</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
