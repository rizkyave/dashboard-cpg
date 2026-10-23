import { promises as fs } from 'fs';
import path from 'path';
import { WaGatewayConfig } from '@/types/notification';
import { isR2Configured, getObjectFromR2, uploadToR2 } from './r2Client';

const WA_CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'wa-gateway-config.json');
const R2_WA_CONFIG_KEY = 'notifications-metadata/wa-config.json';

// Baca konfigurasi WA Gateway
export async function getWaConfig(): Promise<WaGatewayConfig> {
  const defaultConfig: WaGatewayConfig = {
    provider: 'none',
    apiKey: '',
    targetPhoneNumbers: '',
    enabled: false,
  };

  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_WA_CONFIG_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        return { ...defaultConfig, ...JSON.parse(text) };
      }
    } catch {}
  }

  try {
    const raw = await fs.readFile(WA_CONFIG_FILE_PATH, 'utf8');
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return defaultConfig;
  }
}

// Simpan konfigurasi WA Gateway
export async function saveWaConfig(cfg: WaGatewayConfig) {
  const jsonStr = JSON.stringify(cfg, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_WA_CONFIG_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }

  try {
    await fs.mkdir(path.dirname(WA_CONFIG_FILE_PATH), { recursive: true });
    await fs.writeFile(WA_CONFIG_FILE_PATH, jsonStr, 'utf8');
  } catch {}
}

