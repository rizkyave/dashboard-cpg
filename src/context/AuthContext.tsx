'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, UserAccount, UserRole } from '@/types/auth';
import {
  getStoredUsers,
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
  isUser: boolean;
  isVisitor: boolean;
  canEdit: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; user?: AuthUser }>;
  logout: () => void;
  refreshUsers: () => void;
  createUser: (data: {
    username: string;
    name: string;
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

  useEffect(() => {
    const session = getStoredSessionUser();
    if (session) {
      setUser(session);
    }
    loadUsersFromStorage();
    setIsLoading(false);
  }, [loadUsersFromStorage]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
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
    password?: string;
    role: UserRole;
    department?: string;
    email?: string;
    status?: 'active' | 'inactive';
  }) => {
    const res = createUserAccount(data);
    if (res.success) {
      loadUsersFromStorage();
    }
    return res;
  };

  const updateUser = async (
    id: string,
    updates: Partial<Omit<UserAccount, 'id'>>
  ) => {
    const res = updateUserAccount(id, updates);
    if (res.success) {
      loadUsersFromStorage();
      if (user && user.id === id) {
        const refreshedSession = getStoredSessionUser();
        if (refreshedSession) setUser(refreshedSession);
      }
    }
    return res;
  };

  const deleteUser = async (id: string) => {
    const res = deleteUserAccount(id, user?.id);
    if (res.success) {
      loadUsersFromStorage();
    }
    return res;
  };

  const handleResetDefaults = () => {
    resetToDefaultUsers();
    loadUsersFromStorage();
  };

  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';
  const isVisitor = user?.role === 'visitor';
  const canEdit = isAdmin || isUser;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        users: usersList,
        isAdmin,
        isUser,
        isVisitor,
        canEdit,
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
