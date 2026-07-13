import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { listSubmissions } from '../games/submissions.js';
import { manager } from '../games/manager.js';
import type { Puzzle, Difficulty } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUZZLES_FILE = path.resolve(__dirname, '../../data/puzzles.json');
const SUBMISSIONS_FILE = path.resolve(__dirname, '../../data/submissions.json');

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
editorRouter.put('/puzzles/:id', (req, res) => {
  const id = req.params.id;
  const b = req.body || {};

  // 区分 base puzzle 和 approved submission
  if (id.startsWith('sub_')) {
    // 编辑已审核通过的投稿
    const submissionId = id.slice(4);
    const subs = readSubmissions();
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

    writeSubmissions(subs);
    manager.refreshApproved();
    return res.json({ ok: true, id });
  }

  // 编辑本地题库题目
  const puzzles = readPuzzles();
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

  writePuzzles(puzzles);
  // 需要重启服务才能重新加载 base puzzles，但已审核投稿会立即刷新
  res.json({ ok: true, id, note: 'base puzzle 修改将在服务重启后生效（已审核投稿已即时刷新）' });
});

// DELETE /api/editor/puzzles/:id — 删除一道题目
editorRouter.delete('/puzzles/:id', (req, res) => {
  const id = req.params.id;

  if (id.startsWith('sub_')) {
    const submissionId = id.slice(4);
    const subs = readSubmissions();
    const filtered = subs.filter((s: any) => s.id !== submissionId);
    if (filtered.length === subs.length) return res.status(404).json({ error: '投稿不存在' });
    writeSubmissions(filtered);
    manager.refreshApproved();
    return res.json({ ok: true });
  }

  const puzzles = readPuzzles();
  const filtered = puzzles.filter((p: any) => p.id !== id);
  if (filtered.length === puzzles.length) return res.status(404).json({ error: '题目不存在' });
  writePuzzles(filtered);
  return res.json({ ok: true, note: '删除将在服务重启后生效' });
});

// ─── 投稿操作 ───

// GET /api/editor/submissions — 列出所有投稿（用于编辑审核中的投稿）
editorRouter.get('/submissions', (req, res) => {
  const status = req.query.status as string | undefined;
  res.json({ submissions: listSubmissions(status as any) });
});

// PUT /api/editor/submissions/:id — 编辑投稿
editorRouter.put('/submissions/:id', (req, res) => {
  const id = req.params.id;
  const b = req.body || {};

  const subs = readSubmissions();
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

  writeSubmissions(subs);
  if (sub.status === 'approved') manager.refreshApproved();
  res.json({ ok: true, submission: sub });
});

// ─── helpers ───

function readPuzzles(): any[] {
  try {
    return JSON.parse(fs.readFileSync(PUZZLES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writePuzzles(list: any[]): void {
  fs.writeFileSync(PUZZLES_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function readSubmissions(): any[] {
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeSubmissions(list: any[]): void {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
}
