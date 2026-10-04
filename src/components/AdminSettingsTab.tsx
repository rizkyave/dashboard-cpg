'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Eye,
  Search,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  KeyRound,
  Building,
  Mail,
  Calendar,
  Lock,
  UserCheck,
  UserX,
  AlertTriangle,
  Info,
  Check,
  X,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthUser, UserAccount, UserRole, ROLE_PERMISSIONS } from '@/types/auth';

interface AdminSettingsTabProps {
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AdminSettingsTab({ showToast }: AdminSettingsTabProps) {
  const { user: currentUser, users, createUser, updateUser, deleteUser, refreshUsers } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form State for Add User
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newDepartment, setNewDepartment] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Edit User
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editDepartment, setEditDepartment] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  // Delete Target
  const [targetDeleteUser, setTargetDeleteUser] = useState<AuthUser | null>(null);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q));

      return matchRole && matchQuery;
    });
  }, [users, roleFilter, searchQuery]);

  // Metric counts
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const userStaffCount = users.filter((u) => u.role === 'user').length;
  const visitorCount = users.filter((u) => u.role === 'visitor').length;

  const handleOpenAddModal = (presetRole?: UserRole) => {
    setNewUsername('');
    setNewName('');
    setNewPassword('');
    setNewRole(presetRole || 'user');
    setNewDepartment(presetRole === 'visitor' ? 'Tamu / Observer Eksternal' : '');
    setNewEmail('');
    setIsAddModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim()) {
      showToast('Mohon isi Username dan Nama Lengkap.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createUser({
        username: newUsername,
        name: newName,
        password: newPassword || (newUsername.trim() + '123'),
        role: newRole,
        department: newDepartment,
        email: newEmail,
      });

      if (res.success) {
        showToast(
          'Berhasil menambahkan akun ' + newRole.toUpperCase() + ': ' + newName,
          'success'
        );
        setIsAddModalOpen(false);
      } else {
        showToast(res.message || 'Gagal menambahkan akun.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (userItem: AuthUser) => {
    setEditingUser(userItem);
    setEditName(userItem.name);
    setEditRole(userItem.role);
    setEditDepartment(userItem.department || '');
    setEditEmail(userItem.email || '');
    setEditStatus(userItem.status);
    setEditPassword('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      const updates: any = {
        name: editName.trim(),
        role: editRole,
        department: editDepartment.trim(),
        email: editEmail.trim(),
        status: editStatus,
      };
      if (editPassword.trim()) {
        updates.password = editPassword.trim();
      }

      const res = await updateUser(editingUser.id, updates);
      if (res.success) {
        showToast('Data akun ' + editingUser.username + ' berhasil diperbarui.', 'success');
        setIsEditModalOpen(false);
      } else {
        showToast(res.message || 'Gagal memperbarui akun.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui akun.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userItem: AuthUser) => {
    if (userItem.id === currentUser?.id) {
      showToast('Tidak dapat menonaktifkan akun yang sedang digunakan.', 'warning');
      return;
    }
    const nextStatus = userItem.status === 'active' ? 'inactive' : 'active';
    const res = await updateUser(userItem.id, { status: nextStatus });
    if (res.success) {
      showToast(
        'Akun ' + userItem.username + ' berhasil di' + (nextStatus === 'active' ? 'aktifkan' : 'nonaktifkan') + '.',
        'success'
      );
    } else {
      showToast(res.message || 'Gagal mengubah status akun.', 'error');
    }
  };

  const handleOpenDelete = (userItem: AuthUser) => {
    if (userItem.id === currentUser?.id) {
      showToast('Tidak dapat menghapus akun Anda sendiri.', 'warning');
      return;
    }
    setTargetDeleteUser(userItem);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetDeleteUser) return;
    setIsSubmitting(true);
    try {
      const res = await deleteUser(targetDeleteUser.id);
      if (res.success) {
        showToast('Akun ' + targetDeleteUser.username + ' berhasil dihapus.', 'success');
        setIsDeleteModalOpen(false);
      } else {
        showToast(res.message || 'Gagal menghapus akun.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus akun.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Top Banner & Header */}
      <div className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <ShieldCheck className="size-5" />
            </span>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Admin Settings &bull; Manajemen Pengguna & Visitor
            </h1>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Kelola akses staf purchasing, tim operasional (User), dan akun tamu peninjau (Visitor). Atur wewenang input pengadaan, pengunggahan berkas, atau akses mode monitor baca-saja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          {/* Quick Add Visitor */}
          <button
            onClick={() => handleOpenAddModal('visitor')}
            className="flex-1 md:flex-initial h-9 px-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Visitor Khusus Tamu / Pemantau Read-Only"
          >
            <Eye className="size-4" />
            <span>+ Tambah Visitor</span>
          </button>

          {/* Quick Add User */}
          <button
            onClick={() => handleOpenAddModal('user')}
            className="flex-1 md:flex-initial h-9 px-4 rounded-lg bg-foreground text-background hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer active:scale-95"
          >
            <UserPlus className="size-4" />
            <span>+ Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Total Akun Terdaftar</span>
            <Users className="size-4 text-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{totalUsers}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Semua entitas & tingkatan hak akses
          </span>
        </div>

        <div className="bg-card border border-purple-500/20 bg-purple-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
            <span className="text-xs font-medium">Administrator</span>
            <Shield className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {adminCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Kontrol penuh & kelola user
          </span>
        </div>

        <div className="bg-card border border-sky-500/20 bg-sky-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 mb-2">
            <span className="text-xs font-medium">Staf User (Operasional)</span>
            <UserCheck className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">
            {userStaffCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Input FPB, upload, sync data
          </span>
        </div>

        <div className="bg-card border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-medium">Visitor (Tamu Peninjau)</span>
            <Eye className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {visitorCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Mode monitor (Akses baca saja)
          </span>
        </div>
      </div>

      {/* Filter and User List Section */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {/* Table Controls Bar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/20">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, username, role, atau departemen..."
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['ALL', 'admin', 'user', 'visitor'] as const).map((r) => {
              const isActive = roleFilter === r;
              const label =
                r === 'ALL'
                  ? 'Semua Akun'
                  : r === 'admin'
                  ? 'Admin'
                  : r === 'user'
                  ? 'Staff User'
                  : 'Visitor';

              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-foreground text-background font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Role / Peran</th>
                <th className="py-3 px-4">Departemen & Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Terdaftar</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Users className="size-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-xs">Tidak ada data pengguna yang cocok</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Coba ganti kata kunci pencarian atau filter role.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const isCurrent = item.id === currentUser?.id;
                  const isMasterAdmin = item.username === 'admin' || item.username === 'hermansyah';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Avatar & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                              item.role === 'admin'
                                ? 'bg-linear-to-tr from-purple-600 to-indigo-600'
                                : item.role === 'visitor'
                                ? 'bg-linear-to-tr from-emerald-600 to-teal-600'
                                : 'bg-linear-to-tr from-sky-600 to-blue-600'
                            }`}
                          >
                            {item.avatar || item.name[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                              <span>{item.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              @{item.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {item.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            <Shield className="size-3" />
                            <span>Administrator</span>
                          </span>
                        ) : item.role === 'visitor' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <Eye className="size-3" />
                            <span>Visitor (Read-Only)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                            <UserCheck className="size-3" />
                            <span>Staff User</span>
                          </span>
                        )}
                      </td>

                      {/* Departemen & Email */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-foreground font-medium text-[11px]">
                            {item.department || '-'}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {item.email || '-'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer disabled:cursor-not-allowed ${
                            item.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                          }`}
                          title={isCurrent ? 'Akun aktif' : 'Klik untuk mengubah status'}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              item.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
                            }`}
                          />
                          <span>{item.status === 'active' ? 'Aktif' : 'Nonaktif'}</span>
                        </button>
                      </td>

                      {/* Created date */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                            title="Edit Akun & Hak Akses"
                          >
                            <Edit2 className="size-3.5" />
                          </button>

                          {!isCurrent && !isMasterAdmin && (
                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Hapus Akun"
                            >
                              <Trash2 className="size-3.5" />
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
      </div>

      {/* Role Permissions Matrix Section */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Matriks Hak Akses & Perizinan (Role Permissions)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Tinjauan hak akses antara Administrator, User Staf, dan Visitor Tamu
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border text-muted-foreground text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Modul / Tindakan</th>
                <th className="py-2.5 px-3">Deskripsi Wewenang</th>
                <th className="py-2.5 px-3 text-center w-28">👑 Admin</th>
                <th className="py-2.5 px-3 text-center w-28">👤 User</th>
                <th className="py-2.5 px-3 text-center w-28">👁️ Visitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROLE_PERMISSIONS.map((perm, idx) => (
                <tr key={idx} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground">
                    {perm.action}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                    {perm.description}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {perm.admin ? (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-rose-500/10 text-rose-500">
                        <X className="size-3.5 stroke-[3]" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {perm.user ? (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-rose-500/10 text-rose-500">
                        <X className="size-3.5 stroke-[3]" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {perm.visitor ? (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-muted text-muted-foreground/60" title="Tidak diizinkan (Read-Only)">
                        <X className="size-3.5 stroke-[3]" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: TAMBAH PENGGUNA / VISITOR                               */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div
                className={`size-10 rounded-xl flex items-center justify-center text-white ${
                  newRole === 'visitor' ? 'bg-emerald-600' : 'bg-primary'
                }`}
              >
                {newRole === 'visitor' ? <Eye className="size-5" /> : <UserPlus className="size-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {newRole === 'visitor' ? 'Tambah Akun Visitor (Tamu)' : 'Tambah Pengguna Baru'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Buat akun kredensial untuk staf logistik atau tamu peninjau
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tipe Akun (Role)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'admin'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Shield className="size-3.5" />
                      <span>Admin</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Full Access
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('user')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'user'
                        ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <UserCheck className="size-3.5" />
                      <span>Staff User</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Operasional
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('visitor');
                      if (!newDepartment) setNewDepartment('Tamu / Observer Eksternal');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'visitor'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Eye className="size-3.5" />
                      <span>Visitor</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Read-Only
                    </span>
                  </button>
                </div>

                {/* Role Description Helper */}
                <div className="mt-2 p-2 rounded-lg bg-muted/40 border border-border text-[10px] text-muted-foreground">
                  {newRole === 'visitor' && (
                    <p>
                      <strong>Peran Visitor:</strong> Akun ini hanya dapat melihat dashboard, tabel pengadaan, posisi armada, dan inventaris. Tombol tambah data, upload excel, sync, dan reset dinonaktifkan.
                    </p>
                  )}
                  {newRole === 'user' && (
                    <p>
                      <strong>Peran Staff User:</strong> Dapat melakukan input data pengadaan FPB/PO, sinkronisasi Google Sheets, dan unggah foto lapangan.
                    </p>
                  )}
                  {newRole === 'admin' && (
                    <p>
                      <strong>Peran Administrator:</strong> Akses mutlak ke seluruh fitur sistem, termasuk menu <em>Admin Settings</em> untuk mengelola user & visitor.
                    </p>
                  )}
                </div>
              </div>

              {/* Username & Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="misal: ahmad_logistik"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="misal: Ahmad Dahlan"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Password & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Password Awal
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={newUsername ? newUsername + '123' : 'default: username123'}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Bila kosong, default: username123
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Departemen / Instansi
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="misal: Purchasing / Auditor Tamu"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="misal: user@cindaragroup.com"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT PENGGUNA                                           */}
      {/* ============================================================== */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Edit2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Edit Akun: @{editingUser.username}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Ubah data nama, perbarui role hak akses, atau reset password
                </p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tipe Akun (Role)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRole('admin')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editRole === 'admin'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <div className="font-bold text-xs">👑 Admin</div>
                    <span className="text-[9px] text-muted-foreground">Full Control</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('user')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editRole === 'user'
                        ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <div className="font-bold text-xs">👤 Staff User</div>
                    <span className="text-[9px] text-muted-foreground">Operasional</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('visitor')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editRole === 'visitor'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <div className="font-bold text-xs">👁️ Visitor</div>
                    <span className="text-[9px] text-muted-foreground">Read-Only</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Departemen / Instansi
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Status Akun
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reset Password Baru (Opsional)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: KONFIRMASI HAPUS                                        */}
      {/* ============================================================== */}
      {isDeleteModalOpen && targetDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="size-6" />
            </div>

            <h3 className="text-base font-bold text-foreground">Hapus Akun Pengguna?</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Apakah Anda yakin ingin menghapus akun <strong>@{targetDeleteUser.username}</strong> ({targetDeleteUser.name})? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
