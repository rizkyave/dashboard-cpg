import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DEFAULT_USERS } from '@/data/defaultUsers';
import { UserAccount, AuthUser } from '@/types/auth';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_USERS_METADATA_KEY = 'users-metadata/users.json';
const LOCAL_USERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'users-data.json');

/**
 * Pastikan akun-akun bawaan sistem (Admin, Lead Procurement, Manager, SPV, dll)
 * selalu ada dan terhubung dengan tanda tangan & NIK resmi jika belum diubah
 */
function syncWithDefaults(existing: UserAccount[]): { users: UserAccount[]; hasChanges: boolean } {
  let hasChanges = false;
  const existingMap = new Map<string, UserAccount>();

  // Indeks berdasarkan ID dan username
  existing.forEach((u) => {
    existingMap.set(u.id, u);
    existingMap.set(u.username.toLowerCase(), u);
  });

  const merged = existing.map((p) => {
    const defaultMatch = DEFAULT_USERS.find(
      (def) => def.username.toLowerCase() === p.username?.toLowerCase()
    );
    if (defaultMatch) {
      let updated = { ...p };
      if (!p.signature && defaultMatch.signature) {
        updated.signature = defaultMatch.signature;
        hasChanges = true;
      }
      if (!p.nik && defaultMatch.nik) {
        updated.nik = defaultMatch.nik;
        hasChanges = true;
      }
      if (!p.jabatan && defaultMatch.jabatan) {
        updated.jabatan = defaultMatch.jabatan;
        hasChanges = true;
      }
      if (!p.password && defaultMatch.password) {
        updated.password = defaultMatch.password;
        hasChanges = true;
      }
      // Pertahankan role yang sudah diubah admin; pasang default hanya bila belum ada role
      if (!p.role && defaultMatch.role) {
        updated.role = defaultMatch.role;
        hasChanges = true;
      }
      return updated;
    }
    return p;
  });

  // Tambahkan user bawaan yang belum ada sama sekali
  for (const def of DEFAULT_USERS) {
    if (!existingMap.has(def.username.toLowerCase()) && !existingMap.has(def.id)) {
      merged.push({ ...def });
      hasChanges = true;
    }
  }

  return { users: merged, hasChanges };
}

/**
 * Baca seluruh akun pengguna dari Cloudflare R2 dengan fallback ke disk lokal & DEFAULT_USERS
 */
async function getStoredUsersFromCloud(): Promise<UserAccount[]> {
  // 1. Coba baca dari Cloudflare R2
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_USERS_METADATA_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { users, hasChanges } = syncWithDefaults(parsed);
          if (hasChanges) {
            await saveStoredUsersToCloud(users);
          }
          return users;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca users dari Cloudflare R2:', err);
    }
  }

  // 2. Coba baca dari disk lokal
  try {
    const raw = await fs.readFile(LOCAL_USERS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const { users, hasChanges } = syncWithDefaults(parsed);
      if (hasChanges) {
        await saveStoredUsersToCloud(users);
      }
      return users;
    }
  } catch {
    // Non-fatal
  }

  // 3. Fallback ke DEFAULT_USERS bawaan
  const initial = [...DEFAULT_USERS];
  await saveStoredUsersToCloud(initial);
  return initial;
}

/**
 * Simpan seluruh akun pengguna ke Cloudflare R2 dan disk lokal
 */
async function saveStoredUsersToCloud(users: UserAccount[]): Promise<void> {
  const jsonStr = JSON.stringify(users, null, 2);

  // 1. Simpan ke Cloudflare R2
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_USERS_METADATA_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      });
    } catch (err) {
      console.warn('Gagal menyimpan users ke Cloudflare R2:', err);
    }
  }

  // 2. Simpan ke disk lokal
  try {
    await fs.mkdir(path.dirname(LOCAL_USERS_FILE_PATH), { recursive: true });
    await fs.writeFile(LOCAL_USERS_FILE_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal
  }
}

/**
 * GET: Ambil daftar seluruh pengguna dari cloud
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAuth = searchParams.get('includeAuth') === 'true';

    const users = await getStoredUsersFromCloud();

    const responseUsers = includeAuth
      ? users
      : users.map(({ password: _, ...u }) => u);

    return NextResponse.json({
      success: true,
      users: responseUsers,
      storage: isR2Configured() ? 'CLOUDFLARE_R2' : 'LOCAL',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal memuat pengguna';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

/**
 * POST: Tambah pengguna baru atau aksi sistem (reset, bulk update)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Aksi Reset ke Akun Bawaan Sistem
    if (action === 'reset') {
      const resetList = [...DEFAULT_USERS];
      await saveStoredUsersToCloud(resetList);
      const safe = resetList.map(({ password: _, ...u }) => u);
      return NextResponse.json({
        success: true,
        message: 'Daftar pengguna dan role berhasil di-reset ke bawaan sistem.',
        users: safe,
      });
    }

    // Aksi Bulk Update (Sinkronisasi dari master)
    if (action === 'bulk' && Array.isArray(body.users)) {
      const usersToSave = body.users as UserAccount[];
      await saveStoredUsersToCloud(usersToSave);
      const safe = usersToSave.map(({ password: _, ...u }) => u);
      return NextResponse.json({
        success: true,
        message: 'Daftar pengguna berhasil diperbarui secara massal.',
        users: safe,
      });
    }

    // Tambah Pengguna Baru
    const { username, name, password, role, department, email, nik, jabatan, status, signature } = body;

    if (!username || !name || !role) {
      return NextResponse.json(
        { success: false, message: 'Username, Nama Lengkap, dan Role wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email ? email.trim().toLowerCase() : `${cleanUsername}@cindaragroup.com`;
    const cleanNik = nik ? nik.trim() : undefined;

    const currentUsers = await getStoredUsersFromCloud();

    const exists = currentUsers.some(
      (u) =>
        u.username.toLowerCase() === cleanUsername ||
        (cleanNik && u.nik?.toLowerCase() === cleanNik.toLowerCase()) ||
        (cleanEmail && u.email?.toLowerCase() === cleanEmail)
    );

    if (exists) {
      return NextResponse.json(
        { success: false, message: `Username "${username}" atau NIK sudah digunakan oleh pengguna lain.` },
        { status: 400 }
      );
    }

    const avatarLetter = (name.trim()[0] || cleanUsername[0] || 'U').toUpperCase();
    const newUser: UserAccount = {
      id: `usr-${role}-${Date.now().toString(36)}`,
      username: cleanUsername,
      name: name.trim(),
      nik: cleanNik,
      jabatan: jabatan?.trim() || undefined,
      password: password || `${cleanUsername}123`,
      role,
      department: department?.trim() || (role === 'visitor' ? 'Tamu / Visitor' : 'Staf Operasional'),
      email: cleanEmail,
      avatar: avatarLetter,
      status: status || 'active',
      createdAt: new Date().toISOString(),
      signature: signature || undefined,
    };

    const updatedUsers = [newUser, ...currentUsers];
    await saveStoredUsersToCloud(updatedUsers);

    const safeUsers = updatedUsers.map(({ password: _, ...u }) => u);
    const { password: __, ...safeCreated } = newUser;

    return NextResponse.json({
      success: true,
      message: `Pengguna "${name}" (${role}) berhasil ditambahkan dan disimpan di cloud.`,
      user: safeCreated,
      users: safeUsers,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal menambahkan pengguna';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

/**
 * PUT: Perbarui data pengguna (Role, Status, Jabatan, NIK, Password, TTD)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id || !updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, message: 'ID pengguna dan data pembaruan wajib disertakan.' },
        { status: 400 }
      );
    }

    const currentUsers = await getStoredUsersFromCloud();
    const index = currentUsers.findIndex((u) => u.id === id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, message: 'Pengguna tidak ditemukan dalam sistem cloud.' },
        { status: 404 }
      );
    }

    const existing = currentUsers[index];

    // Cek duplikasi jika username diubah
    if (updates.username && updates.username.toLowerCase() !== existing.username.toLowerCase()) {
      const targetUsername = updates.username.toLowerCase().trim();
      const isDuplicate = currentUsers.some(
        (u) => u.id !== id && u.username.toLowerCase() === targetUsername
      );
      if (isDuplicate) {
        return NextResponse.json(
          { success: false, message: `Username "${updates.username}" sudah dipakai pengguna lain.` },
          { status: 400 }
        );
      }
    }

    const updatedUser: UserAccount = {
      ...existing,
      ...updates,
      avatar: updates.name ? updates.name.trim()[0].toUpperCase() : existing.avatar,
    };

    const updatedUsers = [...currentUsers];
    updatedUsers[index] = updatedUser;

    await saveStoredUsersToCloud(updatedUsers);

    const safeUsers = updatedUsers.map(({ password: _, ...u }) => u);
    const { password: __, ...safeUpdated } = updatedUser;

    return NextResponse.json({
      success: true,
      message: `Data dan role pengguna "${updatedUser.name}" berhasil diperbarui di cloud.`,
      user: safeUpdated,
      users: safeUsers,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal memperbarui pengguna';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Hapus pengguna dari cloud
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id');

    if (!targetId) {
      return NextResponse.json(
        { success: false, message: 'ID pengguna wajib disertakan.' },
        { status: 400 }
      );
    }

    const currentUsers = await getStoredUsersFromCloud();
    const target = currentUsers.find((u) => u.id === targetId);

    if (!target) {
      return NextResponse.json(
        { success: false, message: 'Pengguna tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Lindungi akun Super Admin bawaan
    if (target.username === 'admin' || target.username === 'hermansyah') {
      return NextResponse.json(
        { success: false, message: 'Akun Administrator utama sistem dilindungi dan tidak boleh dihapus.' },
        { status: 403 }
      );
    }

    const filtered = currentUsers.filter((u) => u.id !== targetId);
    await saveStoredUsersToCloud(filtered);

    const safeUsers = filtered.map(({ password: _, ...u }) => u);

    return NextResponse.json({
      success: true,
      message: `Pengguna "${target.name}" berhasil dihapus dari cloud.`,
      users: safeUsers,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal menghapus pengguna';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

