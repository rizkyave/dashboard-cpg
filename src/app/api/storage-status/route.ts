import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  
  // Hitung direktori pasti
  const hbuildsDir = path.resolve(cwd, '../../..'); // .../hbuilds
  const domainDir = path.resolve(cwd, '../../../..'); // /home/u964694521/domains/peachpuff-jackal-720947.hostingersite.com
  const userHome = path.resolve(cwd, '../../../../../..'); // /home/u964694521

  const results: Record<string, any> = {
    cwd,
    hbuildsDir,
    domainDir,
    userHome,
    directories: {},
  };

  const targets = [
    userHome,
    path.join(userHome, 'public_html'),
    path.join(userHome, 'uploads'),
    domainDir,
    path.join(domainDir, 'public_html'),
    path.join(domainDir, 'public_html', 'uploads'),
    path.join(domainDir, 'uploads'),
    path.join(hbuildsDir, 'shared'),
    path.join(hbuildsDir, 'storage'),
  ];

  for (const t of targets) {
    try {
      if (fs.existsSync(t)) {
        const stat = fs.statSync(t);
        if (stat.isDirectory()) {
          const items = fs.readdirSync(t);
          results.directories[t] = { exists: true, count: items.length, sample: items.slice(0, 10) };
        } else {
          results.directories[t] = { exists: true, isFile: true, size: stat.size };
        }
      } else {
        results.directories[t] = { exists: false };
      }
    } catch (e: any) {
      results.directories[t] = { error: e.message };
    }
  }

  return NextResponse.json(results);
}

