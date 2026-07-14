/**
 * 统一存储接口 — 抽象本地文件系统与云端 KV 存储的差异。
 * 
 * - 本地开发：FileStorage 读写 server/data/*.json
 * - EdgeOne Pages 线上：KVStorage 操作 EdgeOne KV
 */

export interface IStorage {
  /** 读取指定 key 的数据，不存在时返回 null */
  read<T = any>(key: string): Promise<T | null>;

  /** 写入指定 key 的数据 */
  write<T = any>(key: string, data: T): Promise<void>;
}

/** 预定义的存储 key */
export const StorageKeys = {
  submissions: 'submissions',
  config: 'config',
  puzzles: 'puzzles',
} as const;
