import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStorage } from './storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../data/api-config.json');

interface RuntimeConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  useAI: boolean;
  testMode: boolean;
}

// 运行时可变配置
let runtime: RuntimeConfig;

// 从本地文件加载（兜底方案）
function loadFromFile(): RuntimeConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed.apiKey ?? parsed.secretId ?? ''),
      baseURL: String(parsed.baseURL ?? 'https://api.openai.com/v1'),
      model: String(parsed.model ?? 'gpt-3.5-turbo'),
      useAI: Boolean(parsed.useAI),
      testMode: Boolean(parsed.testMode ?? false),
    };
  } catch {
    return { apiKey: '', baseURL: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', useAI: false, testMode: false };
  }
}

// 默认配置
function defaultConfig(): RuntimeConfig {
  return { apiKey: '', baseURL: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', useAI: false, testMode: false };
}

// 模块加载时先用文件初始化（确保同步访问不会崩溃）
runtime = loadFromFile();

// ─── 初始化：优先从 storage 加载配置 ───

let _initialized = false;

/**
 * 异步初始化运行时配置。
 * 优先从 storage（本地文件 | EdgeOne KV）加载，
 * 再叠加环境变量覆盖。
 */
export async function initRuntimeConfig(): Promise<void> {
  const storage = getStorage();
  const stored = await storage.read<RuntimeConfig>('config');

  if (stored) {
    runtime = { ...defaultConfig(), ...stored };
    console.log('[runtimeConfig] 从 storage 加载配置');
  } else {
    // 首次部署：从文件读取并写入 storage
    const fromFile = loadFromFile();
    runtime = { ...defaultConfig(), ...fromFile };
    await storage.write('config', runtime).catch(() => {});
    console.log('[runtimeConfig] 从文件初始化并迁移到 storage');
  }

  // 环境变量覆盖（Cloud Functions 平台注入，优先级最高）
  if (process.env.AI_API_KEY) runtime.apiKey = process.env.AI_API_KEY;
  if (process.env.AI_BASE_URL) runtime.baseURL = process.env.AI_BASE_URL;
  if (process.env.AI_MODEL) runtime.model = process.env.AI_MODEL;
  if (process.env.AI_USE_AI !== undefined) runtime.useAI = process.env.AI_USE_AI === 'true';

  _initialized = true;
}

/** 确保已初始化（幂等），在需要读取配置前调用 */
export async function ensureInit(): Promise<void> {
  if (!_initialized) {
    await initRuntimeConfig();
  }
}

/** 读取当前运行时配置 */
export function getRuntimeConfig(): RuntimeConfig {
  return { ...runtime };
}

/** 从文件重新加载（忽略 storage，降级用） */
export function loadRuntimeConfig(): void {
  runtime = loadFromFile();
  // 环境变量覆盖
  if (process.env.AI_API_KEY) runtime.apiKey = process.env.AI_API_KEY;
  if (process.env.AI_BASE_URL) runtime.baseURL = process.env.AI_BASE_URL;
  if (process.env.AI_MODEL) runtime.model = process.env.AI_MODEL;
  if (process.env.AI_USE_AI !== undefined) runtime.useAI = process.env.AI_USE_AI === 'true';
}

/** 保存（合并）配置到 storage */
export async function saveRuntimeConfig(patch: Partial<RuntimeConfig>): Promise<void> {
  const current = getRuntimeConfig();
  const merged = { ...current, ...patch };
  // 更新内存中的运行时配置
  runtime = { ...runtime, ...patch };
  // 写入 storage
  const storage = getStorage();
  await storage.write('config', merged);
}

/** 判断 API Key 是否已配置 */
export function hasAIKey(): boolean {
  return Boolean(runtime.apiKey);
}

/** 是否启用了测试模式 */
export function isTestMode(): boolean {
  return runtime.testMode;
}

/** 是否启用 AI（外部 Key 或测试模式均可） */
export function isAIEnabled(): boolean {
  return runtime.useAI && (hasAIKey() || isTestMode());
}
