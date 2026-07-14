import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IStorage } from './interface.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

/** key → 文件名映射 */
const KEY_TO_FILE: Record<string, string> = {
  submissions: 'submissions.json',
  config: 'api-config.json',
  puzzles: 'puzzles.json',
};

/**
 * 文件存储实现 — 用于本地开发环境。
 * 读写 server/data/ 目录下的 JSON 文件。
 */
export class FileStorage implements IStorage {
  private resolvePath(key: string): string {
    const filename = KEY_TO_FILE[key] || `${key}.json`;
    return path.join(DATA_DIR, filename);
  }

  async read<T = any>(key: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.resolvePath(key), 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async write<T = any>(key: string, data: T): Promise<void> {
    const dir = path.dirname(this.resolvePath(key));
    // 确保目录存在
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // 目录已存在则忽略
    }
    await fs.writeFile(this.resolvePath(key), JSON.stringify(data, null, 2), 'utf-8');
  }
}
