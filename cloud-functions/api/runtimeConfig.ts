import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../data/api-config.json');

interface RuntimeConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  useAI: boolean;
  testMode: boolean;
}

// 运行时可变配置（初始从 JSON 文件加载）
let runtime: RuntimeConfig = loadFromFile();

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

/** 读取当前运行时配置 */
export function getRuntimeConfig(): RuntimeConfig {
  return { ...runtime };
}

/** 从文件重新加载运行时配置 */
export function loadRuntimeConfig(): void {
  runtime = loadFromFile();
}

/** 保存（合并）配置 — Cloud Functions 环境仅更新内存，不写文件 */
export async function saveRuntimeConfig(patch: Partial<RuntimeConfig>): Promise<void> {
  const current = loadFromFile();
  const merged = { ...current, ...patch };
  // 更新内存中的运行时配置
  runtime = { ...runtime, ...patch };
  // 尝试写文件（serverless 环境写入为临时性质，重启后丢失）
  try {
    await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    // 静默失败
  }
}

/** 从环境变量重新加载配置（优先于文件配置） */
export function loadRuntimeConfig(): void {
  // 先加载文件配置
  runtime = loadFromFile();
  // 环境变量覆盖（Cloud Functions 平台注入）
  if (process.env.AI_API_KEY) runtime.apiKey = process.env.AI_API_KEY;
  if (process.env.AI_BASE_URL) runtime.baseURL = process.env.AI_BASE_URL;
  if (process.env.AI_MODEL) runtime.model = process.env.AI_MODEL;
  if (process.env.AI_USE_AI !== undefined) runtime.useAI = process.env.AI_USE_AI === 'true';
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
