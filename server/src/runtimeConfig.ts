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

/** 保存（合并）配置到文件 */
export async function saveRuntimeConfig(patch: Partial<RuntimeConfig>): Promise<void> {
  const current = loadFromFile();
  const merged = { ...current, ...patch };
  await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
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
