import { AuthUser, UserAccount, UserRole } from '@/types/auth';
import { DEFAULT_USERS } from '@/data/defaultUsers';

const USERS_STORAGE_KEY = 'CPG_AUTH_USERS_DATA';
const CURRENT_USER_KEY = 'CPG_AUTH_CURRENT_USER';

export function getStoredUsers(): UserAccount[] {
  if (typeof window === 'undefined') {
    return DEFAULT_USERS;
  }

  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Pastikan semua akun default, NIK, jabatan, dan spesimen tanda tangan tersinkronisasi
      let needsSave = false;
      const synced = parsed.map((p: any) => {
        const defaultMatch = DEFAULT_USERS.find(
          (def) => def.username.toLowerCase() === p.username?.toLowerCase()
        );
        if (defaultMatch) {
          const hasPngSignature = p.signature?.signatureDataUrl?.startsWith('data:image/png;base64,');
          if ((!p.signature || !hasPngSignature) && defaultMatch.signature) {
            needsSave = true;
            p = { ...p, signature: defaultMatch.signature };
          }
          if (!p.nik && defaultMatch.nik) {
            needsSave = true;
            p = { ...p, nik: defaultMatch.nik };
          }
          if (!p.jabatan && defaultMatch.jabatan) {
            needsSave = true;
            p = { ...p, jabatan: defaultMatch.jabatan };
          }
          if (!p.password && defaultMatch.password) {
            needsSave = true;
            p = { ...p, password: defaultMatch.password };
          }
          // Pertahankan role yang telah diubah admin; hanya pasang default bila akun belum memiliki role
          if (!p.role && defaultMatch.role) {
            needsSave = true;
            p = { ...p, role: defaultMatch.role };
          }
        }
        return p;
      });

      const missingDefaults = DEFAULT_USERS.filter(
        (def) => !synced.some((p: any) => p.username?.toLowerCase() === def.username.toLowerCase())
      );
      if (missingDefaults.length > 0 || needsSave) {
        const merged = [...synced, ...missingDefaults];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
      return synced;
    }
  } catch (err) {
    console.error('Gagal membaca users dari localStorage:', err);
  }

  return DEFAULT_USERS;
}

export function saveStoredUsers(users: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Gagal menyimpan users ke localStorage:', err);
  }
}

export function getStoredSessionUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredSessionUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (err) {
    console.error('Gagal menyimpan session user:', err);
  }
}

export function resetToDefaultUsers(): UserAccount[] {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  }
  return DEFAULT_USERS;
}

export function authenticate(usernameInput: string, passwordInput: string): { success: boolean; user?: AuthUser; message?: string } {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  const users = getStoredUsers();
  const found = users.find((u) => {
    const un = u.username.toLowerCase();
    const em = u.email ? u.email.toLowerCase() : '';
    const nk = u.nik ? u.nik.toLowerCase() : '';
    const nkDigits = u.nik ? u.nik.replace(/\D/g, '') : '';
    const nkTrimmed = nkDigits.replace(/^0+/, '');

    return (
      un === cleanUsername ||
      em === cleanUsername ||
      nk === cleanUsername ||
      (nkDigits && nkDigits === cleanUsername) ||
      (nkTrimmed && nkTrimmed === cleanUsername)
    );
  });

  if (!found) {
    return { success: false, message: 'Username, NIK, atau email tidak terdaftar dalam sistem.' };
  }

  if (found.status === 'inactive') {
    return { success: false, message: 'Akun ini dinonaktifkan oleh Administrator. Hubungi Tim MIS / Admin untuk verifikasi.' };
  }

  const uName = found.username.toLowerCase();
  const role = found.role;
  const nikDigits = found.nik ? found.nik.replace(/\D/g, '') : '';
  const nikTrimmed = nikDigits.replace(/^0+/, '');

  const isMatch = (() => {
    // 1. Password exact match dari database / localStorage
    if (found.password && found.password === cleanPassword) return true;

    // 2. Master company password yang berlaku untuk SEMUA akun di sistem CPG
    if (
      cleanPassword === 'cpg123' ||
      cleanPassword === 'cpg' ||
      cleanPassword === '123' ||
      cleanPassword === 'admin' ||
      cleanPassword === 'admin123'
    ) {
      return true;
    }

    // 3. Password berbasis Username (misal: "zulfiansyah" atau "zulfiansyah123")
    if (cleanPassword === uName || cleanPassword === `${uName}123`) {
      return true;
    }

    // 4. Password berbasis NIK (misal: "0367", "367", atau NIK lengkap "MP-DAO-0367")
    if (
      (found.nik && cleanPassword.toLowerCase() === found.nik.toLowerCase()) ||
      (nikDigits && cleanPassword === nikDigits) ||
      (nikTrimmed && cleanPassword === nikTrimmed)
    ) {
      return true;
    }

    // 5. Password alias khusus Tim Serah Terima Lapangan
    if (role === 'staf_lapangan') {
      if (
        cleanPassword === 'lapangan' ||
        cleanPassword === 'lapangan123' ||
        cleanPassword === 'staff123' ||
        cleanPassword === 'user123' ||
        cleanPassword === 'lap'
      ) {
        return true;
      }
    }

        // Password alias khusus End User / Penerima Barang
    if (role === 'end_user') {
      if (
        cleanPassword === 'enduser' ||
        cleanPassword === 'enduser123' ||
        cleanPassword === 'penerima' ||
        cleanPassword === 'penerima123' ||
        cleanPassword === 'kapal' ||
        cleanPassword === 'kapal123' ||
        cleanPassword === 'user123' ||
        cleanPassword === 'staff123'
      ) {
        return true;
      }
    }

// 6. Password alias khusus Tim TTB Logistik
    if (role === 'staf_ttb') {
      if (
        cleanPassword === 'ttb' ||
        cleanPassword === 'ttb123' ||
        cleanPassword === 'staff123' ||
        cleanPassword === 'user123' ||
        cleanPassword === 'logistik' ||
        cleanPassword === 'logistik123'
      ) {
        return true;
      }
    }

    // 7. Password alias Manajemen & Pengadaan
    if (role === 'staf_purchasing' || role === 'supervisor' || role === 'manager' || role === 'admin') {
      if (
        cleanPassword === 'purchasing' ||
        cleanPassword === 'purchasing123' ||
        cleanPassword === 'manager' ||
        cleanPassword === 'manager123' ||
        cleanPassword === 'supervisor' ||
        cleanPassword === 'spv123'
      ) {
        return true;
      }
    }

    // 8. Password alias Staff Operasional
    if (role === 'user') {
      if (
        cleanPassword === 'staff' ||
        cleanPassword === 'staff123' ||
        cleanPassword === 'user123' ||
        cleanPassword === 'gudang123'
      ) {
        return true;
      }
    }

    // 9. Password alias Tamu / Auditor
    if (role === 'visitor') {
      if (
        cleanPassword === 'visitor' ||
        cleanPassword === 'visitor123' ||
        cleanPassword === 'guest' ||
        cleanPassword === 'guest123' ||
        cleanPassword === '0123'
      ) {
        return true;
      }
    }

    return false;
  })();

  if (!isMatch) {
    const hint =
      role === 'staf_lapangan'
        ? 'Petunjuk: Password default Staf Lapangan adalah "cpg123", "123", "cpg", atau "lapangan123".'
        : role === 'staf_ttb'
        ? 'Petunjuk: Password default Staf TTB adalah "cpg123", "123", atau "ttb123".'
        : role === 'end_user'
        ? 'Petunjuk: Password default End User adalah "cpg123", "123", atau "enduser123".'
        : role === 'admin' || role === 'manager' || role === 'supervisor' || role === 'staf_purchasing'
        ? 'Petunjuk: Password default adalah "admin" atau "cpg123".'
        : 'Petunjuk: Password default adalah "cpg123" atau "123".';

    return {
      success: false,
      message: `Password salah. ${hint}`,
    };
  }

  const now = new Date().toISOString();
  // Jika cocok dengan password alias, selaraskan password ke yang dimasukkan user
  const updatedUsers = users.map((u) =>
    u.id === found.id ? { ...u, password: cleanPassword, lastLogin: now } : u
  );
  saveStoredUsers(updatedUsers);

  const { password, ...authUser } = { ...found, password: cleanPassword, lastLogin: now };
  setStoredSessionUser(authUser);

  return { success: true, user: authUser };
}

export function createUserAccount(input: {
  username: string;
  name: string;
  nik?: string;
  jabatan?: string;
  password?: string;
  role: UserRole;
  department?: string;
  email?: string;
  status?: 'active' | 'inactive';
}): { success: boolean; user?: AuthUser; message?: string } {
  const users = getStoredUsers();
  const cleanUsername = input.username.trim().toLowerCase();

  if (!cleanUsername) {
    return { success: false, message: 'Username tidak boleh kosong.' };
  }

  if (!input.name.trim()) {
    return { success: false, message: 'Nama lengkap tidak boleh kosong.' };
  }

  const existing = users.find(
    (u) =>
      u.username.toLowerCase() === cleanUsername ||
      (input.email && u.email?.toLowerCase() === input.email.trim().toLowerCase()) ||
      (input.nik && u.nik?.toLowerCase() === input.nik.trim().toLowerCase())
  );
  if (existing) {
    return { success: false, message: 'Username atau NIK sudah digunakan.' };
  }

  const id = 'usr-' + input.role + '-' + Date.now().toString(36);
  const avatarLetter = (input.name.trim()[0] || input.username[0] || 'U').toUpperCase();

  const newAccount: UserAccount = {
    id,
    username: cleanUsername,
    name: input.name.trim(),
    nik: input.nik?.trim() || undefined,
    jabatan: input.jabatan?.trim() || undefined,
    password: input.password || (cleanUsername + '123'),
    role: input.role,
    department: input.department?.trim() || (input.role === 'visitor' ? 'Visitor / Tamu' : input.role === 'end_user' ? 'Operasional Armada & Penerima' : 'Staf Operasional'),
    email: input.email?.trim() || (cleanUsername + '@cindaragroup.com'),
    avatar: avatarLetter,
    status: input.status || 'active',
    createdAt: new Date().toISOString(),
  };

  const updated = [newAccount, ...users];
  saveStoredUsers(updated);

  const { password, ...createdAuthUser } = newAccount;
  return { success: true, user: createdAuthUser };
}

export function updateUserAccount(
  id: string,
  updates: Partial<Omit<UserAccount, 'id'>>
): { success: boolean; message?: string } {
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  }

  const existing = users[index];

  if (updates.username && updates.username.toLowerCase() !== existing.username.toLowerCase()) {
    const targetUsername = updates.username.toLowerCase();
    const isDuplicate = users.some(
      (u) => u.id !== id && u.username.toLowerCase() === targetUsername
    );
    if (isDuplicate) {
      return { success: false, message: 'Username sudah dipakai pengguna lain.' };
    }
  }

  const updatedUser: UserAccount = {
    ...existing,
    ...updates,
    avatar: updates.name ? updates.name.trim()[0].toUpperCase() : existing.avatar,
  };

  const updatedList = [...users];
  updatedList[index] = updatedUser;
  saveStoredUsers(updatedList);

  const currentSession = getStoredSessionUser();
  if (currentSession && currentSession.id === id) {
    const { password, ...newAuthUser } = updatedUser;
    setStoredSessionUser(newAuthUser);
  }

  return { success: true };
}

export function deleteUserAccount(id: string, currentUserId?: string): { success: boolean; message?: string } {
  if (id === currentUserId) {
    return { success: false, message: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.' };
  }

  const users = getStoredUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  }

  if (target.username === 'admin' || target.username === 'hermansyah') {
    return { success: false, message: 'Akun Super Admin bawaan sistem tidak boleh dihapus demi keamanan sistem.' };
  }

  const filtered = users.filter((u) => u.id !== id);
  saveStoredUsers(filtered);

  return { success: true };
}
