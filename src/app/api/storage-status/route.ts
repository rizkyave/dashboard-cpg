import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  
  // Cari di semua lokasi potensial
  const domainRoot = path.resolve(cwd, '../../..');
  const userHome = path.resolve(cwd, '../../../../..');
  const versionsDir = path.resolve(cwd, '../..');
  
  const results: Record<string, any> = {
    cwd,
    domainRoot,
    userHome,
    locations: {},
  };

  const toCheck = [
    domainRoot,
    path.join(domainRoot, 'public_html'),
    path.join(domainRoot, 'public_html', 'uploads'),
    path.join(domainRoot, 'public_html', 'ttb-documents'),
    path.join(domainRoot, 'public_html', 'fstb-documents'),
    path.join(userHome, 'public_html'),
    path.join(userHome, 'public_html', 'uploads'),
    path.join(userHome, 'uploads'),
    versionsDir,
  ];

  // Cek setiap versi di versionsDir
  try {
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir);
      for (const v of versions) {
        const vPublic = path.join(versionsDir, v, 'nodejs', 'public');
        toCheck.push(vPublic);
        toCheck.push(path.join(vPublic, 'uploads'));
        toCheck.push(path.join(vPublic, 'ttb-documents'));
        toCheck.push(path.join(vPublic, 'fstb-documents'));
      }
    }
  } catch (e: any) {
    results.versionsError = e.message;
  }

  for (const p of toCheck) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(p);
          results.locations[p] = { exists: true, count: files.length, sample: files.slice(0, 5) };
        } else {
          results.locations[p] = { exists: true, isFile: true, size: stat.size };
        }
      } else {
        results.locations[p] = { exists: false };
      }
    } catch (e: any) {
      results.locations[p] = { error: e.message };
    }
  }

  return NextResponse.json(results);
}

