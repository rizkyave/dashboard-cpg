import { NextResponse } from 'next/server';
import { DEFAULT_USERS } from '@/data/defaultUsers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory list untuk server runtime
let inMemoryUsers = [...DEFAULT_USERS];

export async function GET() {
  try {
    const safeUsers = inMemoryUsers.map(({ password, ...u }) => u);
    return NextResponse.json({
      success: true,
      users: safeUsers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memuat pengguna' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, name, password, role, department, email } = body;

    if (!username || !name || !role) {
      return NextResponse.json(
        { success: false, message: 'Username, Nama, dan Role wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const exists = inMemoryUsers.some((u) => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      return NextResponse.json(
        { success: false, message: `Username "${username}" sudah digunakan.` },
        { status: 400 }
      );
    }

    const newUser = {
      id: `usr-${role}-${Date.now().toString(36)}`,
      username: cleanUsername,
      name: name.trim(),
      password: password || `${cleanUsername}123`,
      role,
      department: department?.trim() || (role === 'visitor' ? 'Tamu / Visitor' : 'Staf Operasional'),
      email: email?.trim() || `${cleanUsername}@cindaragroup.com`,
      avatar: (name.trim()[0] || cleanUsername[0] || 'U').toUpperCase(),
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    inMemoryUsers = [newUser, ...inMemoryUsers];

    const { password: _, ...safeUser } = newUser;
    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan ${role === 'visitor' ? 'Visitor' : 'User'} baru.`,
      user: safeUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menambahkan pengguna' },
      { status: 500 }
    );
  }
}
