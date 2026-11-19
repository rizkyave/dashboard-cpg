import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface BuildInfo {
  version: string;
  gitCommit: string;
  gitDate: string;
  gitMessage: string;
  buildTime: string;
  buildId: string;
  environment: string;
}

function getStoredBuildInfo(): Partial<BuildInfo> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'build-info.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

function getLiveGitInfo(): { commit?: string; date?: string; message?: string } {
  try {
    const commit = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    }).trim();

    let date: string | undefined;
    let message: string | undefined;

    try {
      const log = execSync('git log -1 --format="%cd|%s" --date=iso', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500,
      }).trim();
      const parts = log.split('|');
      if (parts[0]) date = parts[0].trim();
      if (parts[1]) message = parts[1].trim();
    } catch {}

    return { commit, date, message };
  } catch {
    return {};
  }
}

export async function GET() {
  const stored = getStoredBuildInfo();
  const liveGit = getLiveGitInfo();

  const commit = liveGit.commit || stored.gitCommit || process.env.GIT_COMMIT || 'latest';
  const date = liveGit.date || stored.gitDate || new Date().toISOString();
  const message = liveGit.message || stored.gitMessage || '';
  const version = stored.version || 'v2.6.0';
  const buildId = stored.buildId || `CPG-${commit}`;
  const buildTime = stored.buildTime || new Date().toISOString();
  const environment = process.env.NODE_ENV || 'production';

  const responsePayload: BuildInfo = {
    version,
    gitCommit: commit,
    gitDate: date,
    gitMessage: message,
    buildTime,
    buildId,
    environment,
  };

  return NextResponse.json(responsePayload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    },
  });
}
