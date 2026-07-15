import { Router } from 'express';
import { config } from '../config.js';
import { listSubmissions, readAllSubmissions, writeAllSubmissions } from '../games/submissions.js';
import { manager } from '../games/manager.js';
import { getStorage } from '../storage/index.js';
import type { Puzzle, Difficulty } from '../types.js';

export const editorRouter = Router();

// 所有编辑器接口都需要口令（GET 请求用 query，其他用 body）
editorRouter.use((req, res, next) => {
  const pass = req.method === 'GET' ? (req.query.pass as string) : req.body?.pass;
  if (!pass || pass !== config.adminPass) return res.status(403).json({ error: '口令错误' });
  next();
});

// ─── 题库操作 ───

// GET /api/editor/puzzles — 列出所有题目（含完整信息，共编辑用）
editorRouter.get('/puzzles', (_req, res) => {
  const puzzles = manager.getPlayablePuzzles();
  res.json({ puzzles });
});

// PUT /api/editor/puzzles/:id — 编辑一道题目
editorRouter.put('/puzzles/:id', async (req, res) => {
  const id = req.params.id;
  const b = req.body || {};

  // 区分 base puzzle 和 approved submission
  if (id.startsWith('sub_')) {
    // 编辑已审核通过的投稿
    const submissionId = id.slice(4);
    const subs = await readAllSubmissions();
    const idx = subs.findIndex((s: any) => s.id === submissionId);
    if (idx === -1) return res.status(404).json({ error: '投稿不存在' });

    const sub = subs[idx];
    if (b.title !== undefined) sub.title = String(b.title);
    if (b.surface !== undefined) sub.surface = String(b.surface);
    if (b.solution !== undefined) sub.solution = String(b.solution);
    if (b.difficulty !== undefined && ['easy', 'medium', 'hard', 'unlimited'].includes(b.difficulty))
      sub.difficulty = b.difficulty;
    if (Array.isArray(b.tags)) sub.tags = b.tags.map(String);
    if (Array.isArray(b.hints)) sub.hints = b.hints.map(String);
    if (b.author !== undefined) sub.author = String(b.author);

    await writeAllSubmissions(subs);
    await manager.refreshApproved();
    return res.json({ ok: true, id });
  }

  // 编辑基础题库题目（走 storage，即时生效）
  const puzzles = await readPuzzles();
  const idx = puzzles.findIndex((p: any) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: '题目不存在' });

  const p = puzzles[idx];
  if (b.title !== undefined) p.title = String(b.title);
  if (b.surface !== undefined) p.surface = String(b.surface);
  if (b.solution !== undefined) p.solution = String(b.solution);
  if (b.difficulty !== undefined && ['easy', 'medium', 'hard', 'unlimited'].includes(b.difficulty))
    p.difficulty = b.difficulty;
  if (Array.isArray(b.tags)) p.tags = b.tags.map(String);
  if (Array.isArray(b.hints)) p.hints = b.hints.map(String);
  if (b.author !== undefined) p.author = String(b.author);

  await writePuzzles(puzzles);
  return res.json({ ok: true, id });
});

// DELETE /api/editor/puzzles/:id — 删除一道题目
editorRouter.delete('/puzzles/:id', async (req, res) => {
  const id = req.params.id;

  if (id.startsWith('sub_')) {
    const submissionId = id.slice(4);
    const subs = await readAllSubmissions();
    const filtered = subs.filter((s: any) => s.id !== submissionId);
    if (filtered.length === subs.length) return res.status(404).json({ error: '投稿不存在' });
    await writeAllSubmissions(filtered);
    await manager.refreshApproved();
    return res.json({ ok: true });
  }

  const puzzles = await readPuzzles();
  const filtered = puzzles.filter((p: any) => p.id !== id);
  if (filtered.length === puzzles.length) return res.status(404).json({ error: '题目不存在' });
  await writePuzzles(filtered);
  return res.json({ ok: true });
});

// ─── 投稿操作 ───

// GET /api/editor/submissions — 列出所有投稿（用于编辑审核中的投稿）
editorRouter.get('/submissions', async (req, res) => {
  const status = req.query.status as string | undefined;
  res.json({ submissions: await listSubmissions(status as any) });
});

// PUT /api/editor/submissions/:id — 编辑投稿
editorRouter.put('/submissions/:id', async (req, res) => {
  const id = req.params.id;
  const b = req.body || {};

  const subs = await readAllSubmissions();
  const idx = subs.findIndex((s: any) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: '投稿不存在' });

  const sub = subs[idx];
  if (b.title !== undefined) sub.title = String(b.title);
  if (b.surface !== undefined) sub.surface = String(b.surface);
  if (b.solution !== undefined) sub.solution = String(b.solution);
  if (b.difficulty !== undefined && ['easy', 'medium', 'hard', 'unlimited'].includes(b.difficulty))
    sub.difficulty = b.difficulty;
  if (Array.isArray(b.tags)) sub.tags = b.tags.map(String);
  if (Array.isArray(b.hints)) sub.hints = b.hints.map(String);
  if (b.author !== undefined) sub.author = String(b.author);
  if (b.status !== undefined && ['pending', 'approved', 'rejected'].includes(b.status))
    sub.status = b.status;

  await writeAllSubmissions(subs);
  if (sub.status === 'approved') await manager.refreshApproved();
  res.json({ ok: true, submission: sub });
});

// ─── helpers ───

async function readPuzzles(): Promise<Puzzle[]> {
  const storage = getStorage();
  const data = await storage.read<Puzzle[]>('puzzles');
  return data || [];
}

async function writePuzzles(list: Puzzle[]): Promise<void> {
  const storage = getStorage();
  await storage.write('puzzles', list);
  // 立即更新内存中的基础题库，无需重启
  await manager.initBasePuzzles();
  console.log(`[editor] 基础题库已更新并重新加载（共 ${list.length} 道题）`);
}
