import type { IStorage } from './interface.js';

/**
 * EdgeOne Pages KV 存储的 namespace 引用。
 * 需要在 EdgeOne 控制台创建 KV 命名空间并绑定到云函数，
 * 绑定后通过 `globalThis.__EOP_KV__` 访问。
 */
function getKVNamespace(): any {
  const g = globalThis as any;
  // 优先查找显式绑定的 KV namespace
  return g.__EOP_KV__ || g.__KV__ || g.kv || null;
}

/**
 * EdgeOne Pages KV 存储实现 — 用于线上生产环境。
 * 
 * 前置要求：
 *   1. 在 EdgeOne Pages 控制台创建 KV 存储命名空间
 *   2. 将 KV 命名空间绑定到云函数项目
 *   3. 在 edgeone.json 或控制台中配置绑定名称
 * 
 * KV API:
 *   - kv.get(key) → string | null
 *   - kv.put(key, value) → void
 */
export class KVStorage implements IStorage {
  private get kv() {
    return getKVNamespace();
  }

  async read<T = any>(key: string): Promise<T | null> {
    if (!this.kv) {
      console.warn('[KVStorage] KV namespace 未绑定，读取回退');
      return null;
    }
    try {
      const raw = await this.kv.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.error('[KVStorage] 读取失败:', key, (e as Error).message);
      return null;
    }
  }

  async write<T = any>(key: string, data: T): Promise<void> {
    if (!this.kv) {
      console.warn('[KVStorage] KV namespace 未绑定，写入回退');
      return;
    }
    try {
      await this.kv.put(key, JSON.stringify(data));
    } catch (e) {
      console.error('[KVStorage] 写入失败:', key, (e as Error).message);
      throw e;
    }
  }
}

/**
 * 检测是否运行在 EdgeOne Pages 环境中。
 * 通过 KV namespace 绑定是否存在来判断。
 */
export function isEdgeOneRuntime(): boolean {
  return getKVNamespace() !== null;
}
