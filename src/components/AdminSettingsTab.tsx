
import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Eye,
  Briefcase,
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
  UploadCloud,
  Truck,
  Layers,
  Boxes,
  Camera,
  Images,
  FileSpreadsheet,
  FileSignature,
  PenTool,
  BadgeCheck,
  Download,
  Eraser,
  Copy,
  Upload,
  ShieldAlert,
  RefreshCw,
  Award,
  ShoppingCart,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  AuthUser,
  UserAccount,
  UserRole,
  ModuleCategory,
  RolePermissionRule,
  MODULE_PERMISSIONS_MATRIX,
  getRoleDisplayName,
  DigitalSignatureInfo,
} from '@/types/auth';

interface AdminSettingsTabProps {
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AdminSettingsTab({ showToast }: AdminSettingsTabProps) {
  const { user: currentUser, users, createUser, updateUser, deleteUser, refreshUsers, resetDefaults } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Digital Signature Modal State (Admin Only)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureTargetUser, setSignatureTargetUser] = useState<AuthUser | null>(null);
  const [signatureTab, setSignatureTab] = useState<'view' | 'upload' | 'draw'>('view');
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string>('');
  const [signeeTitle, setSigneeTitle] = useState<string>('');
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  const [penColor, setPenColor] = useState<string>('#1e3a8a');
  const [copiedCertId, setCopiedCertId] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Canvas Drawing Ref & State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Form State for Add User
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newNik, setNewNik] = useState('');
  const [newJabatan, setNewJabatan] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newDepartment, setNewDepartment] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Edit User
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editNik, setEditNik] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
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
        (u.nik && u.nik.toLowerCase().includes(q)) ||
        (u.jabatan && u.jabatan.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q));

      return matchRole && matchQuery;
    });
  }, [users, roleFilter, searchQuery]);

  // Metric counts
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const managerCount = users.filter((u) => u.role === 'manager').length;
  const supervisorCount = users.filter((u) => u.role === 'supervisor').length;
  const stafPurchasingCount = users.filter((u) => u.role === 'staf_purchasing').length;
  const stafTtbCount = users.filter((u) => u.role === 'staf_ttb').length;
  const stafLapanganCount = users.filter((u) => u.role === 'staf_lapangan').length;
  const visitorCount = users.filter((u) => u.role === 'visitor').length;

  // Filter category for Matrix table
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<'ALL' | ModuleCategory>('ALL');

  const visibleCategories = useMemo<ModuleCategory[]>(() => {
    if (matrixCategoryFilter === 'ALL') {
      return ['Dashboards', 'Modul Tambahan', 'Modul Khusus'];
    }
    return [matrixCategoryFilter];
  }, [matrixCategoryFilter]);

  const renderPermissionBadge = (rule: RolePermissionRule) => {
    if (!rule.allowed) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground/60 border border-border/50 whitespace-nowrap"
          title={rule.notes || 'Tidak Ada Akses (Dibatasi)'}
        >
          <X className="size-3" />
          <span>Dilarang</span>
        </span>
      );
    }

    const toneClasses = {
      purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
      amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
      rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    }[rule.badgeTone || 'emerald'];

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${toneClasses}`}
        title={rule.notes}
      >
        <Check className="size-3 stroke-[2.5]" />
        <span>{rule.level}</span>
      </span>
    );
  };

  const handleOpenAddModal = (presetRole?: UserRole) => {
    setNewUsername('');
    setNewName('');
    setNewNik('');
    setNewJabatan('');
    setNewPassword('');
    const targetRole = presetRole || 'staf_ttb';
    setNewRole(targetRole);
    setNewDepartment(
      targetRole === 'admin'
        ? 'Management Information System'
        : targetRole === 'manager' || targetRole === 'supervisor' || targetRole === 'staf_purchasing'
        ? 'Purchasing & Procurement'
        : targetRole === 'visitor'
        ? 'Purchasing & Procurement'
        : targetRole === 'staf_ttb'
        ? 'Dokumen & Arsip TTB Logistik'
        : targetRole === 'staf_lapangan'
        ? 'Operasional Lapangan & Dermaga'
        : ''
    );
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
        nik: newNik.trim() || undefined,
        jabatan: newJabatan.trim() || undefined,
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
    setEditNik(userItem.nik || '');
    setEditJabatan(userItem.jabatan || '');
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
        nik: editNik.trim() || undefined,
        jabatan: editJabatan.trim() || undefined,
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

  const handleSyncOfficialEmployees = () => {
    if (!isAdmin) {
      showToast('Akses ditolak: Hanya Administrator yang berwenang menyinkronkan data karyawan.', 'warning');
      return;
    }
    if (
      window.confirm(
        'Sinkronisasi 25 data karyawan CPG sesuai data resmi terkini? Akun default akan diperbarui lengkap dengan NIK dan Jabatan resmi.'
      )
    ) {
      resetDefaults();
      showToast('Berhasil menyinkronkan data 25 karyawan resmi CPG.', 'success');
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

  // =========================================================================
  // DIGITAL SIGNATURE & AUTHENTICATION HANDLERS (ADMIN ONLY)
  // =========================================================================
  const getDefaultSigneeTitle = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Head of Management Information System';
      case 'manager':
        return 'Manager Procurement & Supply Chain';
      case 'supervisor':
        return 'Supervisor Procurement & Purchasing';
      case 'staf_purchasing':
        return 'Staf Purchasing & Pengadaan';
      case 'staf_ttb':
        return 'Staf Dokumen TTB Logistik';
      case 'staf_lapangan':
        return 'Staf Serah Terima Lapangan & Dermaga';
      case 'user':
        return 'Staf Operasional Logistik';
      case 'visitor':
        return 'Tamu / Observer Eksternal';
      default:
        return 'Staf Operasional';
    }
  };

  const handleOpenSignatureModal = (targetUser?: AuthUser) => {
    if (!isAdmin) {
      showToast('Akses ditolak: Hanya Administrator yang berwenang mengelola tanda tangan digital.', 'warning');
      return;
    }

    const target = targetUser || users.find((u) => u.id === currentUser?.id) || users[0] || null;
    if (!target) {
      showToast('Tidak ada data pengguna yang dipilih.', 'warning');
      return;
    }

    setSignatureTargetUser(target);
    setUploadedPreviewUrl(target.signature?.signatureDataUrl || '');
    setSigneeTitle(target.signature?.signeeTitle || getDefaultSigneeTitle(target.role));
    setVerificationNotes(
      target.signature?.notes ||
        'Spesimen tanda tangan digital sah otentifikasi sistem pengadaan dan logistik maritim.'
    );
    setSignatureTab(target.signature?.signatureDataUrl ? 'view' : 'upload');
    setHasDrawn(false);
    setIsSignatureModalOpen(true);
  };

  const handleSwitchSignatureUser = (newUserId: string) => {
    const target = users.find((u) => u.id === newUserId);
    if (!target) return;
    setSignatureTargetUser(target);
    setUploadedPreviewUrl(target.signature?.signatureDataUrl || '');
    setSigneeTitle(target.signature?.signeeTitle || getDefaultSigneeTitle(target.role));
    setVerificationNotes(
      target.signature?.notes ||
        'Spesimen tanda tangan digital sah otentifikasi sistem pengadaan dan logistik maritim.'
    );
    setSignatureTab(target.signature?.signatureDataUrl ? 'view' : 'upload');
    setHasDrawn(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleSignatureFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Mohon pilih berkas gambar (PNG transparan, JPG, SVG, atau WebP).', 'warning');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 3MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedPreviewUrl(dataUrl);
      showToast('Berkas gambar tanda tangan berhasil dimuat.', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleDropSignatureFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSignatureFileSelect(e.dataTransfer.files[0]);
    }
  };

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSaveSignature = async () => {
    if (!isAdmin) {
      showToast('Akses ditolak: Hanya Administrator yang berwenang menyimpan tanda tangan digital.', 'error');
      return;
    }
    if (!signatureTargetUser) return;

    let finalDataUrl = uploadedPreviewUrl;

    if (signatureTab === 'draw') {
      if (!hasDrawn || !canvasRef.current) {
        showToast('Mohon goreskan tanda tangan terlebih dahulu pada kanvas.', 'warning');
        return;
      }
      finalDataUrl = canvasRef.current.toDataURL('image/png');
    }

    if (!finalDataUrl) {
      showToast('Mohon upload berkas gambar atau gores tanda tangan pada kanvas.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const rolePrefix =
        signatureTargetUser.role === 'admin'
          ? 'ADM'
          : signatureTargetUser.role === 'manager'
          ? 'MGR'
          : signatureTargetUser.role === 'supervisor'
          ? 'SPV'
          : signatureTargetUser.role === 'staf_purchasing'
          ? 'PCH'
          : signatureTargetUser.role === 'staf_ttb'
          ? 'TTB'
          : signatureTargetUser.role === 'staf_lapangan'
          ? 'LAP'
          : signatureTargetUser.role === 'visitor'
          ? 'VIS'
          : 'OPR';

      const certificateId =
        signatureTargetUser.signature?.certificateId ||
        `CPG-AUTH-2026-${rolePrefix}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const newSignature: DigitalSignatureInfo = {
        signatureDataUrl: finalDataUrl,
        uploadedAt: new Date().toISOString(),
        verifiedBy: currentUser?.username || 'admin',
        verifiedByName: currentUser?.name || 'Administrator CPG',
        certificateId,
        signeeTitle: signeeTitle.trim() || getDefaultSigneeTitle(signatureTargetUser.role),
        notes:
          verificationNotes.trim() ||
          'Spesimen tanda tangan digital sah otentifikasi sistem',
        status: 'verified',
      };

      const res = await updateUser(signatureTargetUser.id, { signature: newSignature });
      if (res.success) {
        showToast(
          `Tanda tangan digital @${signatureTargetUser.username} (${signatureTargetUser.name}) berhasil diverifikasi dan disimpan.`,
          'success'
        );
        setIsSignatureModalOpen(false);
      } else {
        showToast(res.message || 'Gagal menyimpan tanda tangan digital.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSignature = async () => {
    if (!isAdmin) {
      showToast('Akses ditolak: Hanya Administrator yang berwenang mencabut tanda tangan digital.', 'error');
      return;
    }
    if (!signatureTargetUser) return;

    if (!window.confirm(`Apakah Anda yakin ingin mencabut dan menghapus spesimen tanda tangan digital untuk @${signatureTargetUser.username}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateUser(signatureTargetUser.id, { signature: undefined });
      if (res.success) {
        showToast(`Tanda tangan digital @${signatureTargetUser.username} berhasil dicabut.`, 'success');
        setUploadedPreviewUrl('');
        setHasDrawn(false);
        clearCanvas();
        setIsSignatureModalOpen(false);
      } else {
        showToast(res.message || 'Gagal menghapus tanda tangan digital.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus tanda tangan digital.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSignature = () => {
    const dataUrl = uploadedPreviewUrl || signatureTargetUser?.signature?.signatureDataUrl;
    if (!dataUrl || !signatureTargetUser) {
      showToast('Tidak ada spesimen tanda tangan untuk diunduh.', 'warning');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `TTD_CPG_${signatureTargetUser.username}_${signatureTargetUser.signature?.certificateId || 'specimen'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Spesimen tanda tangan digital berhasil diunduh.', 'info');
  };

  const handleCopyCertId = (certId: string) => {
    navigator.clipboard.writeText(certId);
    setCopiedCertId(true);
    setTimeout(() => setCopiedCertId(false), 2000);
    showToast(`ID Sertifikat ${certId} disalin ke papan klip.`, 'info');
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
            Kelola akses manajerial, supervisor, staf purchasing, staf logistik/TTB, tim operasional (User), dan akun tamu peninjau (Visitor). Atur wewenang otorisasi, validasi &amp; TTD digital, atau akses mode monitor baca-saja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          {/* Quick Add Manager */}
          <button
            onClick={() => handleOpenAddModal('manager')}
            className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Manager Procurement (Otorisasi & TTD Digital)"
          >
            <Briefcase className="size-3.5" />
            <span>+ Manager</span>
          </button>

          {/* Quick Add Supervisor */}
          <button
            onClick={() => handleOpenAddModal('supervisor')}
            className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Supervisor Procurement (Approval FSTB & TTD Digital)"
          >
            <Award className="size-3.5" />
            <span>+ Supervisor</span>
          </button>

          {/* Quick Add Staf Purchasing */}
          <button
            onClick={() => handleOpenAddModal('staf_purchasing')}
            className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Staf Purchasing (Delivered By FSTB & Validasi TTB)"
          >
            <ShoppingCart className="size-3.5" />
            <span>+ Staf Purchasing</span>
          </button>

          {/* Quick Add Staf TTB */}
          <button
            onClick={() => handleOpenAddModal('staf_ttb')}
            className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Staf Dokumen TTB (Upload & Pengarsipan)"
          >
            <UploadCloud className="size-3.5" />
            <span>+ Staf TTB</span>
          </button>

          {/* Quick Add Staf Lapangan */}
          <button
            onClick={() => handleOpenAddModal('staf_lapangan')}
            className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Staf Serah Terima Lapangan & TimeMark"
          >
            <Truck className="size-3.5" />
            <span>+ Staf Lapangan</span>
          </button>

          {/* Quick Add Visitor */}
          <button
            onClick={() => handleOpenAddModal('visitor')}
            className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
            title="Tambah Akun Visitor Khusus Tamu / Pemantau Read-Only"
          >
            <Eye className="size-3.5" />
            <span>+ Visitor</span>
          </button>

          {/* Quick Add User */}
          <button
            onClick={() => handleOpenAddModal('user')}
            className="flex-1 md:flex-initial h-9 px-3.5 rounded-lg bg-foreground text-background hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
          >
            <UserPlus className="size-3.5" />
            <span>+ Pengguna</span>
          </button>

          {/* Quick Digital Signature Modal for Admin */}
          {isAdmin && (
            <button
              onClick={() => handleOpenSignatureModal()}
              className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
              title="Upload atau Atur Tanda Tangan Digital Staf & Otentifikasi Dokumen"
            >
              <FileSignature className="size-3.5" />
              <span>+ Tanda Tangan Digital</span>
            </button>
          )}

          {/* Sync 25 CPG Personnel for Admin */}
          {isAdmin && (
            <button
              onClick={handleSyncOfficialEmployees}
              className="flex-1 md:flex-initial h-9 px-3 rounded-lg border border-slate-500/30 bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
              title="Sinkronisasi / Muat 25 Karyawan Resmi CPG (NIK, Jabatan, Role)"
            >
              <RefreshCw className="size-3.5" />
              <span>Sinkron 25 Karyawan</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards - 8 Kolom Sesuai RBAC Logistik Maritim */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {/* Total Akun */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Total Akun</span>
            <Users className="size-4 text-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{totalUsers}</div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Semua tingkatan
          </span>
        </div>

        {/* Administrator */}
        <div className="bg-card border border-purple-500/20 bg-purple-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
            <span className="text-xs font-medium">Admin</span>
            <Shield className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {adminCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Kontrol penuh
          </span>
        </div>

        {/* Manager Procurement */}
        <div className="bg-card border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
            <span className="text-xs font-medium">Manager</span>
            <Briefcase className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-300">
            {managerCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Otorisasi &amp; TTD
          </span>
        </div>

        {/* Supervisor Procurement */}
        <div className="bg-card border border-violet-500/20 bg-violet-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-violet-600 dark:text-violet-400 mb-2">
            <span className="text-xs font-medium">Supervisor</span>
            <Award className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-700 dark:text-violet-300">
            {supervisorCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Approval FSTB &amp; TTB
          </span>
        </div>

        {/* Staf Purchasing */}
        <div className="bg-card border border-teal-500/20 bg-teal-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-2">
            <span className="text-xs font-medium">Staf Purchasing</span>
            <ShoppingCart className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-300">
            {stafPurchasingCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Delivered &amp; Verifikasi
          </span>
        </div>

        {/* Staf Dokumen TTB */}
        <div className="bg-card border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
            <span className="text-xs font-medium">Staf TTB</span>
            <UploadCloud className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300">
            {stafTtbCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Upload &amp; arsip TTB
          </span>
        </div>

        {/* Staf Serah Terima Lapangan */}
        <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-medium">Staf Lapangan</span>
            <Truck className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {stafLapanganCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Fisik serah &amp; TM
          </span>
        </div>

        {/* Visitor */}
        <div className="bg-card border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-medium">Visitor</span>
            <Eye className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {visitorCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Mode monitor (Read)
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
            {(['ALL', 'admin', 'manager', 'supervisor', 'staf_purchasing', 'staf_ttb', 'staf_lapangan', 'visitor', 'user'] as const).map((r) => {
              const isActive = roleFilter === r;
              const label =
                r === 'ALL'
                  ? 'Semua Akun'
                  : r === 'admin'
                  ? 'Admin'
                  : r === 'manager'
                  ? 'Manager'
                  : r === 'supervisor'
                  ? 'Supervisor'
                  : r === 'staf_purchasing'
                  ? 'Staf Purchasing'
                  : r === 'staf_ttb'
                  ? 'Staf TTB'
                  : r === 'staf_lapangan'
                  ? 'Staf Lapangan'
                  : r === 'visitor'
                  ? 'Visitor'
                  : 'User (Umum)';

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
                <th className="py-3 px-4">Departemen &amp; Email</th>
                <th className="py-3 px-4">Tanda Tangan (TTD)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Terdaftar</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
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
                                : item.role === 'manager'
                                ? 'bg-linear-to-tr from-indigo-600 to-blue-600'
                                : item.role === 'supervisor'
                                ? 'bg-linear-to-tr from-violet-600 to-purple-600'
                                : item.role === 'staf_purchasing'
                                ? 'bg-linear-to-tr from-teal-600 to-cyan-600'
                                : item.role === 'staf_ttb'
                                ? 'bg-linear-to-tr from-blue-600 to-cyan-600'
                                : item.role === 'staf_lapangan'
                                ? 'bg-linear-to-tr from-amber-600 to-emerald-600'
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
                              {item.nik && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-muted text-foreground/80 border border-border">
                                  {item.nik}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono truncate">
                              <span>@{item.username}</span>
                              {item.jabatan && (
                                <>
                                  <span className="text-muted-foreground/40">&bull;</span>
                                  <span className="text-foreground/80 font-sans text-[10px] truncate" title={item.jabatan}>
                                    {item.jabatan}
                                  </span>
                                </>
                              )}
                            </div>
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
                        ) : item.role === 'manager' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            <Briefcase className="size-3" />
                            <span>Manager Procurement</span>
                          </span>
                        ) : item.role === 'supervisor' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                            <Award className="size-3" />
                            <span>Supervisor Procurement</span>
                          </span>
                        ) : item.role === 'staf_purchasing' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                            <ShoppingCart className="size-3" />
                            <span>Staf Purchasing</span>
                          </span>
                        ) : item.role === 'staf_ttb' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            <UploadCloud className="size-3" />
                            <span>Staf Dokumen TTB</span>
                          </span>
                        ) : item.role === 'staf_lapangan' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <Truck className="size-3" />
                            <span>Staf Serah Terima Lap.</span>
                          </span>
                        ) : item.role === 'visitor' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <Eye className="size-3" />
                            <span>Visitor (Read-Only)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                            <UserCheck className="size-3" />
                            <span>Staff Operasional</span>
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

                      {/* Tanda Tangan (TTD) */}
                      <td className="py-3 px-4">
                        {item.signature?.signatureDataUrl ? (
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSignatureModal(item)}
                              className="group/ttd relative size-10 rounded-lg border border-border bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden p-1 hover:border-purple-500/50 hover:shadow-xs transition cursor-pointer shrink-0"
                              title="Klik untuk melihat detail otentifikasi & spesimen tanda tangan"
                            >
                              <div
                                className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                  backgroundImage: 'radial-gradient(circle, #888888 1px, transparent 1px)',
                                  backgroundSize: '4px 4px',
                                }}
                              />
                              <img
                                src={item.signature.signatureDataUrl}
                                alt={`TTD ${item.name}`}
                                className="w-full h-full object-contain filter group-hover/ttd:scale-105 transition duration-150"
                              />
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap">
                                  <BadgeCheck className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Terverifikasi</span>
                                </span>
                              </div>
                              <span
                                className="text-[9px] text-muted-foreground font-mono truncate block max-w-[110px] mt-0.5"
                                title={`ID Sertifikat: ${item.signature.certificateId}`}
                              >
                                {item.signature.certificateId}
                              </span>
                            </div>
                          </div>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleOpenSignatureModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-dashed border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-300 transition cursor-pointer"
                            title="Upload atau buat tanda tangan digital untuk pengguna ini"
                          >
                            <FileSignature className="size-3" />
                            <span>+ Upload TTD</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic">Belum Ada</span>
                        )}
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
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenSignatureModal(item)}
                              className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:bg-purple-500/10 transition cursor-pointer"
                              title="Kelola Tanda Tangan Digital & Otentifikasi"
                            >
                              <FileSignature className="size-3.5" />
                            </button>
                          )}

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Shield className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Matriks Hak Akses &amp; Perizinan (Role-Based Access Control)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Pemetaan hak akses operasional 17 modul dashboard antara Administrator, Manager Procurement, Supervisor Procurement, Staf Purchasing, Staf Dokumen TTB, Staf Serah Terima Lapangan, dan Tamu Visitor
              </p>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['ALL', 'Dashboards', 'Modul Tambahan', 'Modul Khusus'] as const).map((cat) => {
              const isActive = matrixCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setMatrixCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-foreground text-background font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground text-[11px]">
              <tr>
                <th className="py-2.5 px-3 min-w-[170px]">Modul / Fitur Sistem</th>
                <th className="py-2.5 px-3 min-w-[240px]">Deskripsi Wewenang</th>
                <th className="py-2.5 px-3 text-center w-32">👑 Admin</th>
                <th className="py-2.5 px-3 text-center w-36">👔 Manager</th>
                <th className="py-2.5 px-3 text-center w-36">🎖️ Supervisor</th>
                <th className="py-2.5 px-3 text-center w-36">🛒 Staf Purchasing</th>
                <th className="py-2.5 px-3 text-center w-36">📄 Staf Dokumen TTB</th>
                <th className="py-2.5 px-3 text-center w-40">🚚 Staf Serah Terima Lap.</th>
                <th className="py-2.5 px-3 text-center w-32">👁️ Visitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleCategories.map((category) => {
                const itemsInCategory = MODULE_PERMISSIONS_MATRIX.filter((m) => m.category === category);
                if (itemsInCategory.length === 0) return null;

                return (
                  <React.Fragment key={category}>
                    <tr className="bg-muted/60 border-y border-border">
                      <td colSpan={9} className="py-2 px-3 font-bold text-xs uppercase tracking-wider text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${
                              category === 'Dashboards'
                                ? 'bg-blue-500'
                                : category === 'Modul Tambahan'
                                ? 'bg-emerald-500'
                                : 'bg-purple-500'
                            }`}
                          />
                          <span>{category}</span>
                          <span className="text-[10px] font-normal text-muted-foreground font-mono">
                            ({itemsInCategory.length} Modul)
                          </span>
                        </div>
                      </td>
                    </tr>
                    {itemsInCategory.map((perm) => (
                      <tr key={perm.tabId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground text-xs">{perm.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">ID: {perm.tabId}</div>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                          {perm.description}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.admin)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.manager)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.supervisor)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.staf_purchasing)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.staf_ttb)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.staf_lapangan)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderPermissionBadge(perm.permissions.visitor)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('admin');
                      if (!newDepartment) setNewDepartment('Management Information System');
                    }}
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
                    onClick={() => {
                      setNewRole('manager');
                      if (!newDepartment) setNewDepartment('Purchasing & Procurement');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'manager'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Briefcase className="size-3.5" />
                      <span>Manager</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Otorisasi &amp; TTD
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('supervisor');
                      if (!newDepartment) setNewDepartment('Purchasing & Procurement');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'supervisor'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Award className="size-3.5" />
                      <span>Supervisor</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Approval &amp; TTD
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('staf_purchasing');
                      if (!newDepartment) setNewDepartment('Purchasing & Procurement');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'staf_purchasing'
                        ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ShoppingCart className="size-3.5" />
                      <span>Staf Purchasing</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Delivered &amp; Verif
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('staf_ttb');
                      if (!newDepartment) setNewDepartment('Dokumen & Arsip TTB Logistik');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'staf_ttb'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <UploadCloud className="size-3.5" />
                      <span>Staf TTB</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Dokumen &amp; Upload
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('staf_lapangan');
                      if (!newDepartment) setNewDepartment('Operasional Lapangan & Dermaga');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      newRole === 'staf_lapangan'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Truck className="size-3.5" />
                      <span>Staf Lapangan</span>
                    </div>
                    <span className="text-[9px] mt-1 text-muted-foreground leading-tight">
                      Serah Terima &amp; TM
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
                <div className="mt-2.5 p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground leading-relaxed">
                  {newRole === 'manager' && (
                    <p>
                      <strong className="text-indigo-600 dark:text-indigo-400">Peran Manager Procurement:</strong> Wewenang otorisasi penuh pada modul Procurement &amp; Analytics, validasi dan tanda tangan digital resmi berkas FSTB (area Approved By / PCH Spv) dan berkas TTB (area Lini Purchasing), serta pemantauan menyeluruh seluruh modul logistik maritim.
                    </p>
                  )}
                  {newRole === 'supervisor' && (
                    <p>
                      <strong className="text-violet-600 dark:text-violet-400">Peran Supervisor Procurement:</strong> Wewenang otorisasi persetujuan pengadaan (Approved By / Purchasing Spv) pada berkas FSTB dan TTB Lini Purchasing, verifikasi PO/FPB di Procurement, pemantauan Analisis Risiko &amp; SLA, monitoring sisa layanan armada, dan pelaporan operasional.
                    </p>
                  )}
                  {newRole === 'staf_purchasing' && (
                    <p>
                      <strong className="text-teal-600 dark:text-teal-400">Peran Staf Purchasing:</strong> Wewenang validasi dan penyerahan barang (Delivered By / Purchasing Staff) pada berkas FSTB, validasi TTB Lini Purchasing, Upload FSTB, verifikasi kelengkapan PO &amp; e-FPB, serta pemeriksaan stok Accurate. Modul lapangan dan admin dinonaktifkan.
                    </p>
                  )}
                  {newRole === 'staf_ttb' && (
                    <p>
                      <strong className="text-blue-600 dark:text-blue-400">Peran Staf Dokumen TTB:</strong> Wewenang penuh mengunggah berkas TTB resmi, mengelola Galeri Foto TTB, verifikasi PO/FPB di Procurement, dan validasi fisik stok di Cek Persediaan. Menu operasional lapangan (Serah Terima Lapangan, TimeMark, Layanan Armada, Posisi Kapal) dan Admin Settings dinonaktifkan secara otomatis.
                    </p>
                  )}
                  {newRole === 'staf_lapangan' && (
                    <p>
                      <strong className="text-amber-600 dark:text-amber-400">Peran Staf Serah Terima Lapangan:</strong> Wewenang penuh input bukti serah terima barang atau fisik pekerjaan dermaga, upload bukti foto TimeMark berstempel waktu, input update servis armada, serta update status Posisi Kapal &amp; List WO. Menu Upload FSTB, Upload TTB, dan Admin Settings dinonaktifkan.
                    </p>
                  )}
                  {newRole === 'visitor' && (
                    <p>
                      <strong className="text-emerald-600 dark:text-emerald-400">Peran Visitor (Tamu Peninjau):</strong> Mode monitor baca-saja (Read-Only) pada modul Overview, Galeri Foto TTB, dan Foto TimeMark. Semua modul teknis, input data, dan admin settings disembunyikan.
                    </p>
                  )}
                  {newRole === 'admin' && (
                    <p>
                      <strong className="text-purple-600 dark:text-purple-400">Peran Administrator:</strong> Akses mutlak ke seluruh 15 modul sistem, termasuk Admin Settings untuk manajemen kredensial pengguna, RBAC, dan audit.
                    </p>
                  )}
                  {newRole === 'user' && (
                    <p>
                      <strong className="text-sky-600 dark:text-sky-400">Peran Staff Operasional:</strong> Akses umum operasional pengadaan dan modul pendukung selain Admin Settings.
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

              {/* NIK & Jabatan Resmi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    NIK Karyawan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newNik}
                    onChange={(e) => setNewNik(e.target.value.toUpperCase())}
                    placeholder="misal: MP-DAO-0871"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Jabatan Resmi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    placeholder="misal: Staf Logistik lapangan"
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRole('admin')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'admin'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">👑 Admin</div>
                    <span className="text-[9px] text-muted-foreground">Full Control</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('manager')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'manager'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">👔 Manager</div>
                    <span className="text-[9px] text-muted-foreground">Otorisasi &amp; TTD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('supervisor')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'supervisor'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">🎖️ Supervisor</div>
                    <span className="text-[9px] text-muted-foreground">Approval &amp; TTD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('staf_purchasing')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'staf_purchasing'
                        ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">🛒 Staf Purchasing</div>
                    <span className="text-[9px] text-muted-foreground">Delivered &amp; Verif</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('staf_ttb')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'staf_ttb'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">📄 Staf TTB</div>
                    <span className="text-[9px] text-muted-foreground">Upload Berkas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('staf_lapangan')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'staf_lapangan'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">🚚 Staf Lapangan</div>
                    <span className="text-[9px] text-muted-foreground">Serah Terima &amp; TM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('visitor')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      editRole === 'visitor'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="font-bold text-xs">👁️ Visitor</div>
                    <span className="text-[9px] text-muted-foreground">Read-Only</span>
                  </button>
                </div>

                {/* Role Description Helper */}
                <div className="mt-2.5 p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground leading-relaxed">
                  {editRole === 'manager' && (
                    <p>
                      <strong className="text-indigo-600 dark:text-indigo-400">Manager Procurement:</strong> Akses otorisasi penuh Procurement &amp; Analytics, validasi dan tanda tangan digital resmi berkas FSTB (Approved By) &amp; TTB (Purchasing), serta pemantauan modul logistik.
                    </p>
                  )}
                  {editRole === 'supervisor' && (
                    <p>
                      <strong className="text-violet-600 dark:text-violet-400">Supervisor Procurement:</strong> Wewenang otorisasi persetujuan pengadaan (Approved By / Purchasing Spv) pada berkas FSTB dan TTB Lini Purchasing, verifikasi PO/FPB di Procurement, pemantauan Analisis Risiko &amp; SLA, monitoring sisa layanan armada, dan pelaporan operasional.
                    </p>
                  )}
                  {editRole === 'staf_purchasing' && (
                    <p>
                      <strong className="text-teal-600 dark:text-teal-400">Staf Purchasing:</strong> Wewenang validasi dan penyerahan barang (Delivered By / Purchasing Staff) pada berkas FSTB, validasi TTB Lini Purchasing, Upload FSTB, verifikasi kelengkapan PO &amp; e-FPB, serta pemeriksaan stok Accurate. Modul lapangan dan admin dinonaktifkan.
                    </p>
                  )}
                  {editRole === 'staf_ttb' && (
                    <p>
                      <strong className="text-blue-600 dark:text-blue-400">Staf Dokumen TTB:</strong> Akses Upload FSTB, Upload TTB, Galeri Foto TTB, verifikasi PO/FPB Procurement, dan Cek Persediaan. Modul lapangan &amp; admin disembunyikan.
                    </p>
                  )}
                  {editRole === 'staf_lapangan' && (
                    <p>
                      <strong className="text-amber-600 dark:text-amber-400">Staf Serah Terima Lapangan:</strong> Akses Serah Terima Lapangan, Foto TimeMark, Layanan Armada, Posisi Kapal, &amp; List WO. Upload FSTB, Upload TTB, &amp; admin dinonaktifkan.
                    </p>
                  )}
                  {editRole === 'visitor' && (
                    <p>
                      <strong className="text-emerald-600 dark:text-emerald-400">Visitor (Tamu):</strong> Mode monitor baca-saja pada Overview, Galeri TTB, dan Foto TimeMark.
                    </p>
                  )}
                  {editRole === 'admin' && (
                    <p>
                      <strong className="text-purple-600 dark:text-purple-400">Administrator:</strong> Akses kontrol penuh seluruh modul dan Admin Settings.
                    </p>
                  )}
                  {editRole === 'user' && (
                    <p>
                      <strong className="text-sky-600 dark:text-sky-400">Staff Operasional:</strong> Akses umum operasional pengadaan dan modul pendukung selain Admin Settings.
                    </p>
                  )}
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

              {/* NIK & Jabatan Resmi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    NIK Karyawan
                  </label>
                  <input
                    type="text"
                    value={editNik}
                    onChange={(e) => setEditNik(e.target.value.toUpperCase())}
                    placeholder="misal: MP-DAO-0871"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Jabatan Resmi
                  </label>
                  <input
                    type="text"
                    value={editJabatan}
                    onChange={(e) => setEditJabatan(e.target.value)}
                    placeholder="misal: Staf Logistik lapangan"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
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

      {/* ============================================================== */}
      {/* MODAL: UPLOAD & OTENTIFIKASI TANDA TANGAN DIGITAL (ADMIN ONLY) */}
      {/* ============================================================== */}
      {isSignatureModalOpen && signatureTargetUser && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <FileSignature className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Otentifikasi &amp; Tanda Tangan Digital
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1">
                      <Shield className="size-2.5" />
                      <span>Hanya Admin</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Verifikasi spesimen tanda tangan resmi untuk pengesahan TTB, Serah Terima Lapangan, dan audit dokumen logistik.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSignatureModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 md:p-6 space-y-4 overflow-y-auto">
              {/* User Switcher / Target Information */}
              <div className="bg-muted/30 border border-border rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${
                      signatureTargetUser.role === 'admin'
                        ? 'bg-linear-to-tr from-purple-600 to-indigo-600'
                        : signatureTargetUser.role === 'staf_ttb'
                        ? 'bg-linear-to-tr from-blue-600 to-cyan-600'
                        : signatureTargetUser.role === 'staf_lapangan'
                        ? 'bg-linear-to-tr from-amber-600 to-emerald-600'
                        : signatureTargetUser.role === 'visitor'
                        ? 'bg-linear-to-tr from-emerald-600 to-teal-600'
                        : 'bg-linear-to-tr from-sky-600 to-blue-600'
                    }`}
                  >
                    {signatureTargetUser.avatar || signatureTargetUser.name[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground truncate">
                        {signatureTargetUser.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        @{signatureTargetUser.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {signatureTargetUser.department || 'Operasional Logistik'}
                      </span>
                      <span className="text-muted-foreground/40">&bull;</span>
                      <span className="text-[10px] font-semibold text-primary capitalize">
                        {getRoleDisplayName(signatureTargetUser.role)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                  <label className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                    Pilih Pengguna:
                  </label>
                  <select
                    value={signatureTargetUser.id}
                    onChange={(e) => handleSwitchSignatureUser(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username}) - {u.role.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Alert Banner */}
              {signatureTargetUser.signature ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <BadgeCheck className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        Spesimen Tanda Tangan Terverifikasi &amp; Sah
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-background text-foreground border border-border">
                          {signatureTargetUser.signature.certificateId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCertId(signatureTargetUser.signature!.certificateId)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition cursor-pointer"
                          title="Salin ID Sertifikat"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-1">
                      Diverifikasi oleh <strong>{signatureTargetUser.signature.verifiedByName || signatureTargetUser.signature.verifiedBy}</strong> pada{' '}
                      {new Date(signatureTargetUser.signature.uploadedAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      . Spesimen ini diakui secara sistem untuk verifikasi dokumen TTB dan serah terima.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <Info className="size-4" />
                  </div>
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">Belum Ada Spesimen Tanda Tangan Digital Terverifikasi</p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                      Silakan unggah berkas gambar tanda tangan (format PNG transparan disarankan) atau buat tanda tangan langsung menggunakan kanvas digital di bawah ini.
                    </p>
                  </div>
                </div>
              )}

              {/* Mode Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
                {signatureTargetUser.signature && (
                  <button
                    type="button"
                    onClick={() => setSignatureTab('view')}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      signatureTab === 'view'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BadgeCheck className="size-3.5 text-emerald-600" />
                    <span>Pratinjau &amp; Sertifikat</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSignatureTab('upload')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    signatureTab === 'upload'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="size-3.5" />
                  <span>Upload Berkas (PNG / SVG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureTab('draw')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    signatureTab === 'draw'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PenTool className="size-3.5" />
                  <span>Tulis di Kanvas</span>
                </button>
              </div>

              {/* Tab 1: Pratinjau Spesimen Aktif & Sertifikat */}
              {signatureTab === 'view' && signatureTargetUser.signature && (
                <div className="space-y-4">
                  <div className="border border-border rounded-xl p-4 bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground">
                        Spesimen Tanda Tangan Terdaftar
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Latar belakang transparan
                      </span>
                    </div>
                    {/* Checkerboard preview container */}
                    <div
                      className="h-36 rounded-lg border border-border bg-slate-50 dark:bg-slate-900/60 relative flex items-center justify-center p-3 overflow-hidden shadow-inner"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                        backgroundSize: '8px 8px',
                      }}
                    >
                      <img
                        src={signatureTargetUser.signature.signatureDataUrl}
                        alt="Spesimen TTD"
                        className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Certificate Specs Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card border border-border rounded-xl p-3.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        ID SERTIFIKAT OTENTIFIKASI
                      </span>
                      <span className="font-mono font-bold text-foreground text-xs">
                        {signatureTargetUser.signature.certificateId}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        JABATAN RESMI PENANDATANGAN
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {signatureTargetUser.signature.signeeTitle || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        ADMIN VERIFIKATOR
                      </span>
                      <span className="font-medium text-foreground text-xs">
                        {signatureTargetUser.signature.verifiedByName} (@{signatureTargetUser.signature.verifiedBy})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        WAKTU VERIFIKASI
                      </span>
                      <span className="font-medium text-foreground text-xs">
                        {new Date(signatureTargetUser.signature.uploadedAt).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-border">
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        CATATAN OTENTIFIKASI
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {signatureTargetUser.signature.notes || 'Spesimen tanda tangan sah otentifikasi sistem.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Upload File */}
              {signatureTab === 'upload' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDropSignatureFile}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
                      isDragOver
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/10 hover:border-primary/50 hover:bg-muted/30'
                    }`}
                    onClick={() => {
                      const input = document.getElementById('signature-file-input');
                      if (input) input.click();
                    }}
                  >
                    <input
                      id="signature-file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSignatureFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="size-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
                      <Upload className="size-6" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      Tarik berkas gambar ke sini, atau klik untuk memilih
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Mendukung format PNG transparan, JPG, SVG, atau WebP (maks. 3MB)
                    </p>
                  </div>

                  {uploadedPreviewUrl && (
                    <div className="border border-border rounded-xl p-4 bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground">
                          Pratinjau Berkas Unggahan
                        </span>
                        <button
                          type="button"
                          onClick={() => setUploadedPreviewUrl('')}
                          className="text-xs text-rose-500 hover:text-rose-600 transition cursor-pointer"
                        >
                          Hapus Pilihan
                        </button>
                      </div>
                      <div
                        className="h-32 rounded-lg border border-border bg-slate-50 dark:bg-slate-900/60 relative flex items-center justify-center p-3 overflow-hidden shadow-inner"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                          backgroundSize: '8px 8px',
                        }}
                      >
                        <img
                          src={uploadedPreviewUrl}
                          alt="Preview TTD Unggahan"
                          className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Canvas Digital Drawing Pad */}
              {signatureTab === 'draw' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        Pilihan Warna Tinta:
                      </span>
                      <button
                        type="button"
                        onClick={() => setPenColor('#1e3a8a')}
                        className={`size-6 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                          penColor === '#1e3a8a'
                            ? 'border-primary ring-2 ring-primary/30 scale-110'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: '#1e3a8a' }}
                        title="Biru Resmi CPG (#1e3a8a)"
                      >
                        {penColor === '#1e3a8a' && <Check className="size-3 text-white" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPenColor('#0f172a')}
                        className={`size-6 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                          penColor === '#0f172a'
                            ? 'border-primary ring-2 ring-primary/30 scale-110'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: '#0f172a' }}
                        title="Hitam Dokumen (#0f172a)"
                      >
                        {penColor === '#0f172a' && <Check className="size-3 text-white" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eraser className="size-3.5" />
                      <span>Bersihkan Kanvas</span>
                    </button>
                  </div>

                  {/* Interactive Canvas */}
                  <div className="border border-border rounded-xl p-2 bg-slate-50 dark:bg-slate-900/80 shadow-inner relative overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={180}
                      className="w-full h-44 rounded-lg bg-white dark:bg-slate-950/40 cursor-crosshair touch-none border border-border/40"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />

                    {/* Signature baseline guide */}
                    <div className="absolute left-8 right-8 bottom-10 border-b border-dashed border-slate-300 dark:border-slate-700 pointer-events-none" />
                    <span className="absolute right-9 bottom-11 text-[9px] text-muted-foreground/50 pointer-events-none font-mono">
                      Garis Tanda Tangan
                    </span>

                    {!hasDrawn && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-xs text-muted-foreground/40 font-medium">
                          Goreskan tanda tangan di sini menggunakan mouse, stylus, atau jari
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form Metadata Otentifikasi & Verifikasi */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Data Otentifikasi &amp; Legalitas Dokumen
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Jabatan Resmi Penandatangan
                    </label>
                    <input
                      type="text"
                      value={signeeTitle}
                      onChange={(e) => setSigneeTitle(e.target.value)}
                      placeholder="Contoh: Staf Dokumen TTB Logistik"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Admin Verifikator (Saat Ini)
                    </label>
                    <div className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 text-muted-foreground font-mono flex items-center justify-between">
                      <span>{currentUser?.name || 'Administrator CPG'} (@{currentUser?.username || 'admin'})</span>
                      <ShieldCheck className="size-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Catatan Verifikasi &amp; Otentifikasi
                  </label>
                  <input
                    type="text"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Catatan keabsahan spesimen untuk verifikasi masa depan..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {signatureTargetUser.signature && (
                  <>
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                      title="Cabut dan hapus spesimen tanda tangan ini"
                    >
                      Cabut TTD
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSignature}
                      className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-medium transition cursor-pointer flex items-center gap-1"
                      title="Unduh berkas PNG tanda tangan digital"
                    >
                      <Download className="size-3.5" />
                      <span>Unduh PNG</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <BadgeCheck className="size-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Otentifikasi TTD'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
