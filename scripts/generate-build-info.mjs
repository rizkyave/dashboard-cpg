import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const cwd = process.cwd();
const packageJsonPath = path.join(cwd, 'package.json');
const outputPath = path.join(cwd, 'src', 'data', 'build-info.json');

let version = '2.6.0';
try {
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (pkg.version) version = pkg.version;
  }
} catch (e) {
  console.warn('Gagal membaca package.json:', e.message);
}

let gitCommit = 'local';
let gitDate = new Date().toISOString();
let gitMessage = '';

try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {}

try {
  const log = execSync('git log -1 --format="%cd|%s" --date=iso', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const parts = log.split('|');
  if (parts[0]) gitDate = parts[0].trim();
  if (parts[1]) gitMessage = parts[1].trim();
} catch {}

const now = new Date();
const buildId = `CPG-${gitCommit}-${now.getTime()}`;

const buildInfo = {
  version: version.startsWith('v') ? version : `v${version}`,
  gitCommit,
  gitDate,
  gitMessage,
  buildTime: now.toISOString(),
  buildId,
  environment: process.env.NODE_ENV || 'production',
};

try {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2), 'utf8');
  console.log(`[BUILD-INFO] Berhasil digenerate: ${buildInfo.version} (${buildInfo.gitCommit}) - ${buildInfo.buildId}`);
} catch (err) {
  console.error('[BUILD-INFO] Gagal menulis build-info.json:', err.message);
}
