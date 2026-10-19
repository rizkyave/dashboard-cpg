'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, UserAccount, UserRole, canAccessTab } from '@/types/auth';
import { TabType } from '@/types/procurement';
import {
  getStoredUsers,
  saveStoredUsers,
  getStoredSessionUser,
  setStoredSessionUser,
  authenticate,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  resetToDefaultUsers,
} from '@/utils/userStorage';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  users: AuthUser[];
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isStafPurchasing: boolean;
  isUser: boolean;
  isVisitor: boolean;
  isStafTtb: boolean;
  isStafLapangan: boolean;
  canEdit: boolean;
  canAccess: (tab: TabType) => boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; user?: AuthUser }>;
  logout: () => void;
  refreshUsers: () => void;
  createUser: (data: {
    username: string;
    name: string;
    nik?: string;
    jabatan?: string;
    password?: string;
    role: UserRole;
    department?: string;
    email?: string;
    status?: 'active' | 'inactive';
  }) => Promise<{ success: boolean; message?: string }>;
  updateUser: (
    id: string,
    updates: Partial<Omit<UserAccount, 'id'>>
  ) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; message?: string }>;
  resetDefaults: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [usersList, setUsersList] = useState<AuthUser[]>([]);

  const loadUsersFromStorage = useCallback(() => {
    const rawList = getStoredUsers();
    const safeList: AuthUser[] = rawList.map(({ password, ...u }) => u);
    setUsersList(safeList);
  }, []);

  // Sinkronisasi data pengguna & role dari Cloudflare R2 ke state dan localStorage
  const syncUsersWithCloud = useCallback(async () => {
    try {
      const res = await fetch('/api/users?includeAuth=true');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.users)) {
          // 1. Simpan data lengkap ke local storage cache
          saveStoredUsers(json.users);
          // 2. Pasang ke usersList (safe tanpa password)
          const safeList: AuthUser[] = json.users.map(({ password: _, ...u }: any) => u);
          setUsersList(safeList);

          // 3. Jika user yang sedang aktif mengalami perubahan role / status / nama di cloud, update sesi!
          const currentSession = getStoredSessionUser();
          if (currentSession) {
            const fresh = json.users.find(
              (u: any) =>
                u.id === currentSession.id ||
                u.username.toLowerCase() === currentSession.username.toLowerCase()
            );
            if (fresh) {
              const { password: _, ...freshAuth } = fresh;
              if (
                freshAuth.role !== currentSession.role ||
                freshAuth.status !== currentSession.status ||
                freshAuth.name !== currentSession.name ||
                freshAuth.jabatan !== currentSession.jabatan ||
                freshAuth.department !== currentSession.department
              ) {
                setStoredSessionUser(freshAuth);
                setUser(freshAuth);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi data user dari Cloudflare R2:', err);
    }
  }, []);

  useEffect(() => {
    const session = getStoredSessionUser();
    if (session) {
      setUser(session);
    }
    loadUsersFromStorage();
    setIsLoading(false);
    // Sinkronkan akun & role terbaru dari Cloudflare R2 di background
    syncUsersWithCloud();
  }, [loadUsersFromStorage, syncUsersWithCloud]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      // Ambil data terbaru dari cloud sebelum verifikasi jika online
      try {
        const fetchRes = await fetch('/api/users?includeAuth=true');
        if (fetchRes.ok) {
          const json = await fetchRes.json();
          if (json.success && Array.isArray(json.users)) {
            saveStoredUsers(json.users);
          }
        }
      } catch {
        // Fallback ke cache offline
      }

      const res = authenticate(username, password);
      if (res.success && res.user) {
        setUser(res.user);
        loadUsersFromStorage();
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message || 'Login gagal.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setStoredSessionUser(null);
    setUser(null);
  };

  const createUser = async (data: {
    username: string;
    name: string;
    nik?: string;
    jabatan?: string;
    password?: string;
    role: UserRole;
    department?: string;
    email?: string;
    status?: 'active' | 'inactive';
  }) => {
    // 1. Simpan lokal cepat
    const localRes = createUserAccount(data);
    if (localRes.success) {
      loadUsersFromStorage();
    }

    // 2. Simpan permanen ke Cloudflare R2
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.users)) {
        await syncUsersWithCloud();
        return { success: true, message: json.message || 'Pengguna berhasil disimpan di cloud.' };
      } else if (!json.success && !localRes.success) {
        return { success: false, message: json.message || 'Gagal menyimpan ke cloud.' };
      }
    } catch (err) {
      console.warn('Gagal menghubungi server cloud untuk tambah user:', err);
    }

    return localRes;
  };

  const updateUser = async (
    id: string,
    updates: Partial<Omit<UserAccount, 'id'>>
  ) => {
    // 1. Update lokal cepat
    const localRes = updateUserAccount(id, updates);
    if (localRes.success) {
      loadUsersFromStorage();
      if (user && user.id === id) {
        const refreshedSession = getStoredSessionUser();
        if (refreshedSession) setUser(refreshedSession);
      }
    }

    // 2. Simpan permanen ke Cloudflare R2
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.users)) {
        await syncUsersWithCloud();
        return { success: true, message: json.message || 'Role dan data pengguna berhasil disimpan di cloud.' };
      } else if (!json.success && !localRes.success) {
        return { success: false, message: json.message || 'Gagal memperbarui di cloud.' };
      }
    } catch (err) {
      console.warn('Gagal menghubungi server cloud untuk update user:', err);
    }

    return localRes;
  };

  const deleteUser = async (id: string) => {
    // 1. Hapus lokal
    const localRes = deleteUserAccount(id, user?.id);
    if (localRes.success) {
      loadUsersFromStorage();
    }

    // 2. Hapus permanen di Cloudflare R2
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.users)) {
        await syncUsersWithCloud();
        return { success: true, message: json.message || 'Pengguna berhasil dihapus dari cloud.' };
      } else if (!json.success && !localRes.success) {
        return { success: false, message: json.message || 'Gagal menghapus dari cloud.' };
      }
    } catch (err) {
      console.warn('Gagal menghubungi server cloud untuk delete user:', err);
    }

    return localRes;
  };

  const handleResetDefaults = async () => {
    resetToDefaultUsers();
    loadUsersFromStorage();

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await syncUsersWithCloud();
    } catch (err) {
      console.warn('Gagal reset user di cloud:', err);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isStafPurchasing = user?.role === 'staf_purchasing';
  const isStafTtb = user?.role === 'staf_ttb';
  const isStafLapangan = user?.role === 'staf_lapangan';
  const isUser = user?.role === 'user';
  const isVisitor = user?.role === 'visitor';
  const canEdit =
    isAdmin ||
    isManager ||
    isSupervisor ||
    isStafPurchasing ||
    isStafTtb ||
    isStafLapangan ||
    isUser;
  const canAccess = useCallback((tab: TabType) => canAccessTab(user?.role, tab), [user?.role]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        users: usersList,
        isAdmin,
        isManager,
        isSupervisor,
        isStafPurchasing,
        isUser,
        isVisitor,
        isStafTtb,
        isStafLapangan,
        canEdit,
        canAccess,
        login,
        logout,
        refreshUsers: loadUsersFromStorage,
        createUser,
        updateUser,
        deleteUser,
        resetDefaults: handleResetDefaults,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
