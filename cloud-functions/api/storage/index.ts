import { FileStorage } from './fileStorage.js';
import { KVStorage, isEdgeOneRuntime } from './kvStorage.js';
import type { IStorage } from './interface.js';

export type { IStorage } from './interface.js';
export { StorageKeys } from './interface.js';

let _storage: IStorage | null = null;

/**
 * 获取当前环境的存储实例。
 * - EdgeOne Pages 环境 → KVStorage（跨实例共享）
 * - 本地开发环境 → FileStorage（读写本地 JSON 文件）
 * 
 * 单例模式，首次调用时自动检测并实例化。
 */
export function getStorage(): IStorage {
  if (!_storage) {
    if (isEdgeOneRuntime()) {
      _storage = new KVStorage();
      console.log('[storage] ✅ 使用 KVStorage（EdgeOne Pages 线上环境）');
    } else {
      _storage = new FileStorage();
      console.log('[storage] 📁 使用 FileStorage（本地开发环境）');
    }
  }
  return _storage;
}

/**
 * 重置存储实例（主要用于测试）
 */
export function resetStorage(): void {
  _storage = null;
}
