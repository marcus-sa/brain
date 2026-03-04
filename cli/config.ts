import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BRAIN_DIR = join(homedir(), ".brain");
const CONFIG_PATH = join(BRAIN_DIR, "config.json");
const DIR_CACHE_PATH = join(BRAIN_DIR, "dir-cache.json");

export type BrainConfig = {
  server_url: string;
  workspace: string;
  api_key: string;
};

export type DirCacheEntry = {
  project_id: string;
  project_name: string;
  last_session?: string;
  session_id?: string;
};

function ensureDir(): void {
  if (!existsSync(BRAIN_DIR)) {
    mkdirSync(BRAIN_DIR, { recursive: true });
  }
}

export function loadConfig(): BrainConfig | undefined {
  if (!existsSync(CONFIG_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as BrainConfig;
  } catch {
    return undefined;
  }
}

export function saveConfig(config: BrainConfig): void {
  ensureDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function loadDirCache(): Record<string, DirCacheEntry> {
  if (!existsSync(DIR_CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DIR_CACHE_PATH, "utf-8")) as Record<string, DirCacheEntry>;
  } catch {
    return {};
  }
}

export function saveDirCache(cache: Record<string, DirCacheEntry>): void {
  ensureDir();
  writeFileSync(DIR_CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
}

export function getDirCacheEntry(directory: string): DirCacheEntry | undefined {
  const cache = loadDirCache();
  return cache[directory];
}

export function setDirCacheEntry(directory: string, entry: DirCacheEntry): void {
  const cache = loadDirCache();
  cache[directory] = entry;
  saveDirCache(cache);
}

export function requireConfig(): BrainConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Brain not configured. Run: brain init");
    process.exit(1);
  }
  return config;
}
