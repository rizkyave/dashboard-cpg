import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  
  const testPaths = [
    path.join(cwd, 'public', 'uploads'),
    path.join(cwd, 'public'),
    path.join(cwd, 'public', 'fstb-documents'),
    path.join(cwd, 'public', 'uploads', 'fstb-documents'),
    path.resolve(cwd, '..'),
    path.resolve(cwd, '../..'),
    path.resolve(cwd, '../../../public_html'),
  ];

  const results: Record<string, any> = {
    cwd,
    checks: {},
  };

  for (const p of testPaths) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(p).slice(0, 10);
          results.checks[p] = { exists: true, isDirectory: true, sampleFiles: files };
        } else {
          results.checks[p] = { exists: true, isDirectory: false, size: stat.size };
        }
      } else {
        results.checks[p] = { exists: false };
      }
    } catch (e: any) {
      results.checks[p] = { error: e.message };
    }
  }

  return NextResponse.json(results);
}
