import { Router } from 'express';
import { config } from '../config.js';
import { manager } from '../games/manager.js';
import { generatePuzzle } from '../ai/puzzleGenerator.js';
import type { Difficulty } from '../types.js';

export const puzzlesRouter = Router();

// 获取题库列表
puzzlesRouter.get('/', (req, res) => {
  const difficulty = req.query.difficulty as Difficulty | undefined;
  let puzzles = manager.getPlayablePuzzles();
  if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
    puzzles = puzzles.filter((p) => p.difficulty === difficulty);
  }
  const publicList = puzzles.map((p) => ({
    id: p.id,
    title: p.title,
    surface: p.surface,
    difficulty: p.difficulty,
    maxQuestions: p.maxQuestions,
    tags: p.tags,
    author: p.author,
    createdAt: p.createdAt,
  }));
  res.json({ puzzles: publicList });
});

// 随机获取一道题目
puzzlesRouter.get('/random', (req, res) => {
  const difficulty = req.query.difficulty as Difficulty | undefined;
  const puzzle = manager.randomPuzzle(difficulty);
  if (!puzzle) return res.status(404).json({ error: '暂无可玩题目' });
  res.json({
    id: puzzle.id,
    title: puzzle.title,
    surface: puzzle.surface,
    difficulty: puzzle.difficulty,
    maxQuestions: puzzle.maxQuestions,
    tags: puzzle.tags,
    author: puzzle.author,
    createdAt: puzzle.createdAt,
  });
});

// 管理员调用 AI 生成新题目
function checkPass(req: any): boolean {
  const pass = req.body?.pass;
  return Boolean(pass) && pass === config.adminPass;
}

puzzlesRouter.post('/generate', async (req, res) => {
  if (!checkPass(req)) return res.status(403).json({ error: '口令错误' });

  if (!config.useAI || (!config.hasAIKey && !config.testMode)) {
    return res.status(503).json({ error: 'AI 未启用，请在配置页面设置 API 密钥并启用 AI' });
  }

  try {
    const puzzle = await generatePuzzle();
    if (!puzzle) {
      return res.status(500).json({ error: 'AI 生成失败，请稍后重试' });
    }
    // 写入投稿系统（pending 状态待审核）
    const { createSubmission } = await import('../games/submissions.js');
    const sub = createSubmission({
      surface: puzzle.surface,
      solution: puzzle.solution,
      difficulty: puzzle.difficulty,
      hints: puzzle.hints,
      tags: puzzle.tags,
      author: 'AI 生成',
    });
    res.json({
      ok: true,
      submission: {
        id: sub.id,
        status: sub.status,
        title: puzzle.title,
      },
      puzzle: {
        title: puzzle.title,
        surface: puzzle.surface,
        solution: puzzle.solution,
        difficulty: puzzle.difficulty,
        tags: puzzle.tags,
      },
    });
  } catch (e) {
    console.error('[puzzles/generate] 错误:', (e as Error).message);
    res.status(500).json({ error: '生成过程出错' });
  }
});
