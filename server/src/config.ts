import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env from root personal_ai or current directory
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = process.env.HOST || '127.0.0.1';

export const SSD_ROOT = process.env.SSD_ROOT || '/Volumes/Akmal SSD/PersonalAI';
export const VAULT_DIR = path.join(SSD_ROOT, 'vault');
export const STAGING_DIR = path.join(SSD_ROOT, 'staging');
export const DATA_ENG_DIR = path.join(SSD_ROOT, 'data_engineering');
export const DATASETS_DIR = path.join(DATA_ENG_DIR, 'datasets');
export const SCRIPTS_DIR = path.join(DATA_ENG_DIR, 'scripts');

export const AGY_BIN = process.env.AGY_BIN || path.join(process.env.HOME || '', '.local/bin/agy');
export const PYTHON_BIN = process.env.PYTHON_BIN || path.join(DATA_ENG_DIR, '.venv/bin/python');

export const DATA_DIR = path.resolve(__dirname, '../data');
export const DB_PATH = path.join(DATA_DIR, 'index.sqlite');
export const VAULT_MIRROR_DIR = path.resolve(DATA_DIR, 'vault_mirror');

export function isSSDMounted(): boolean {
  try {
    return fs.existsSync(SSD_ROOT);
  } catch {
    return false;
  }
}

export function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(VAULT_MIRROR_DIR)) {
    fs.mkdirSync(VAULT_MIRROR_DIR, { recursive: true });
  }
  if (isSSDMounted()) {
    if (!fs.existsSync(STAGING_DIR)) {
      fs.mkdirSync(STAGING_DIR, { recursive: true });
    }
  }
}
