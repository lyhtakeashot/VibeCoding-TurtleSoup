import { Router } from 'express';
import { config } from '../config.js';
import {
  listSubmissions,
  createSubmission,
  setStatus,
  type SubmissionInput,
} from '../games/submissions.js';
import { manager } from '../games/manager.js';
import { parseBatchPuzzles } from '../ai/puzzleGenerator.js';
import type { Difficulty } from '../types.js';

export const submitRouter = Router();

function checkPass(req: any): boolean {
  const pass = req.body?.pass;
  return Boolean(pass) && pass === config.adminPass;
}

// 玩家投稿
submitRouter.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.surface || !b.solution) {
    return res.status(400).json({ error: '汤面与汤底为必填' });
  }
  const input: SubmissionInput = {
    title: String(b.title || ''),
    surface: String(b.surface),
    solution: String(b.solution),
    difficulty: (['easy', 'medium', 'hard'].includes(b.difficulty) ? b.difficulty : 'medium') as Difficulty,
    hints: Array.isArray(b.hints) ? b.hints.map(String) : [],
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
    author: String(b.author || '匿名作者'),
  };
  const sub = createSubmission(input);
  res.json({ ok: true, id: sub.id, status: sub.status });
});

// 批量 AI 解析
submitRouter.post('/batch-parse', async (req, res) => {
  const b = req.body || {};
  const rawText = String(b.rawText || '').trim();
  if (!rawText) {
    return res.status(400).json({ error: '请提供文本内容' });
  }
  if (rawText.length > 50000) {
    return res.status(400).json({ error: '文本过长，最多支持 50000 字' });
  }
  try {
    const puzzles = await parseBatchPuzzles(rawText);
    res.json({ puzzles });
  } catch (e) {
    const msg = (e as Error).message || 'AI 解析失败，请稍后重试';
    console.error('[submit] 批量解析失败:', msg);
    res.status(500).json({ error: msg });
  }
});

// 审核列表（需口令，使用 POST 避免口令暴露在 URL 中）
submitRouter.post('/list', (req, res) => {
  if (!checkPass(req)) return res.status(403).json({ error: '口令错误' });
  const status = req.body.status as any;
  res.json({ submissions: listSubmissions(status) });
});

// 通过
submitRouter.post('/:id/approve', (req, res) => {
  if (!checkPass(req)) return res.status(403).json({ error: '口令错误' });
  const sub = setStatus(req.params.id, 'approved');
  if (!sub) return res.status(404).json({ error: '投稿不存在' });
  manager.refreshApproved();
  res.json({ ok: true, submission: sub });
});

// 驳回
submitRouter.post('/:id/reject', (req, res) => {
  if (!checkPass(req)) return res.status(403).json({ error: '口令错误' });
  const sub = setStatus(req.params.id, 'rejected');
  if (!sub) return res.status(404).json({ error: '投稿不存在' });
  res.json({ ok: true, submission: sub });
});
