import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Submission, Difficulty } from '../types.js';
import { getStorage } from '../storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../../data/submissions.json');

// ─── 内部：从文件兜底读取（本地开发 & 首次加载） ───
function readFromFileSync(): Submission[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Submission[];
  } catch {
    return [];
  }
}

// ─── 核心：异步读写（优先 storage，回退文件） ───

async function readAll(): Promise<Submission[]> {
  const storage = getStorage();
  const data = await storage.read<Submission[]>('submissions');
  if (data !== null) return data;
  // 回退到本地文件（首次运行时 storage 可能为空）
  return readFromFileSync();
}

async function writeAll(list: Submission[]): Promise<void> {
  const storage = getStorage();
  await storage.write('submissions', list);
}

// ─── 公开 API ───

export interface SubmissionInput {
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  hints: string[];
  tags: string[];
  author: string;
}

/** 列出投稿（可按状态筛选） */
export async function listSubmissions(status?: Submission['status']): Promise<Submission[]> {
  const all = await readAll();
  return status ? all.filter((s) => s.status === status) : all;
}

/** 创建新投稿 */
export async function createSubmission(input: SubmissionInput): Promise<Submission> {
  const all = await readAll();
  const sub: Submission = {
    id: crypto.randomUUID(),
    title: input.title || input.surface.slice(0, 14),
    ...input,
    author: input.author.trim() || '匿名作者',
    status: 'pending',
    createdAt: Date.now(),
  };
  all.push(sub);
  await writeAll(all);
  return sub;
}

/** 修改投稿状态 */
export async function setStatus(
  id: string,
  status: 'approved' | 'rejected',
): Promise<Submission | null> {
  const all = await readAll();
  const sub = all.find((s) => s.id === id);
  if (!sub) return null;
  sub.status = status;
  await writeAll(all);
  return sub;
}

/** 读取全部投稿（供编辑器直接操作） */
export async function readAllSubmissions(): Promise<Submission[]> {
  return readAll();
}

/** 整体替换投稿列表（供编辑器使用） */
export async function writeAllSubmissions(list: Submission[]): Promise<void> {
  await writeAll(list);
}

/** 将审核通过的投稿初始化写入 storage（首次部署时从文件迁移） */
export async function migrateSubmissionsFromFile(): Promise<void> {
  const storage = getStorage();
  const existing = await storage.read<Submission[]>('submissions');
  if (existing !== null) return; // 已有数据，不覆盖

  const fromFile = readFromFileSync();
  if (fromFile.length > 0) {
    await storage.write('submissions', fromFile);
    console.log(`[submissions] 从文件迁移了 ${fromFile.length} 条投稿到 storage`);
  }
}

/** 将基础题库从文件迁移到 storage（首次部署时执行一次） */
export async function migratePuzzlesFromFile(): Promise<void> {
  const storage = getStorage();
  const existing = await storage.read('puzzles');
  if (existing !== null) return; // 已有数据，不覆盖

  const puzzlesFile = path.resolve(__dirname, '../../data/puzzles.json');
  let fromFile: any[] = [];
  try {
    const raw = fs.readFileSync(puzzlesFile, 'utf-8');
    fromFile = JSON.parse(raw);
  } catch {
    // 文件不存在则跳过
  }

  if (fromFile.length > 0) {
    await storage.write('puzzles', fromFile);
    console.log(`[puzzles] 从文件迁移了 ${fromFile.length} 道基础题到 storage`);
  }
}
