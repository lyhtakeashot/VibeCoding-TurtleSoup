import express from 'express';
import cors from 'cors';

import { config } from './config.js';
import { getRuntimeConfig, isAIEnabled, initRuntimeConfig } from './runtimeConfig.js';
import { manager } from './games/manager.js';
import { hostAnswer } from './host.js';
import { judgeGuess } from './judge.js';
import { puzzlesRouter } from './routes/puzzles.js';
import { submitRouter } from './routes/submit.js';
import { roomsRouter } from './routes/rooms.js';
import { configRouter } from './routes/config.js';
import { editorRouter } from './routes/editor.js';
import { migrateSubmissionsFromFile, migratePuzzlesFromFile } from './games/submissions.js';
import type { Puzzle } from './types.js';

const app = express();
// Cloud Functions 环境接受所有来源
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ---------- 输入长度校验中间件 ----------
const INPUT_LIMITS = {
  question: 200,
  nickname: 20,
  surface: 5000,
  solution: 5000,
  guess: 5000,
} as const;

app.use('/api/solo', (req, _res, next) => {
  const b = req.body || {};
  const q = req.query || {};
  if (typeof b.guess === 'string' && b.guess.length > INPUT_LIMITS.guess) {
    return _res.status(400).json({ error: `推理内容不能超过 ${INPUT_LIMITS.guess} 字` });
  }
  if (typeof q.question === 'string' && (q.question as string).length > INPUT_LIMITS.question) {
    return _res.status(400).json({ error: `问题不能超过 ${INPUT_LIMITS.question} 字` });
  }
  next();
});

app.use('/api/submissions', (req, _res, next) => {
  const b = req.body || {};
  if (typeof b.surface === 'string' && b.surface.length > INPUT_LIMITS.surface) {
    return _res.status(400).json({ error: `汤面不能超过 ${INPUT_LIMITS.surface} 字` });
  }
  if (typeof b.solution === 'string' && b.solution.length > INPUT_LIMITS.solution) {
    return _res.status(400).json({ error: `汤底不能超过 ${INPUT_LIMITS.solution} 字` });
  }
  next();
});

function publicPuzzle(p: Puzzle) {
  return {
    id: p.id,
    title: p.title,
    surface: p.surface,
    difficulty: p.difficulty,
    maxQuestions: p.maxQuestions,
    tags: p.tags,
    author: p.author,
    createdAt: p.createdAt,
  };
}

// ---------- 单人：REST ----------
const soloRouter = express.Router();

soloRouter.post('/start', (req, res) => {
  const { puzzleId, difficulty } = req.body || {};
  let puzzle = puzzleId ? manager.getPuzzleById(puzzleId) : undefined;
  if (!puzzle) puzzle = manager.randomPuzzle(difficulty);
  if (!puzzle) return res.status(404).json({ error: '暂无可玩题目' });
  const session = manager.createSession(puzzle);
  res.json({
    sessionId: session.id,
    puzzle: publicPuzzle(puzzle),
    maxQuestions: puzzle.maxQuestions,
    questionsUsed: 0,
    accumulatedProgress: 0,
    finished: false,
    questionsDepleted: false,
  });
});

soloRouter.post('/hint', (req, res) => {
  const { sessionId } = req.body || {};
  const hint = manager.revealHint(sessionId);
  if (hint === null) return res.json({ hint: null, done: true });
  res.json({ hint, done: false });
});

soloRouter.post('/guess', async (req, res) => {
  const { sessionId, guess } = req.body || {};
  const session = manager.getSession(sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  const g = String(guess || '').trim();
  if (!g) return res.status(400).json({ error: '请先输入你的推理' });
  const result = await judgeGuess(session.puzzle, g);
  res.json({
    correct: result.correct,
    feedback: result.feedback,
    solution: session.puzzle.solution,
    playerGuess: g,
  });
});

// 会话状态恢复接口
soloRouter.get('/:sessionId/state', (req, res) => {
  const session = manager.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在或已过期' });
  const shownHints = session.puzzle.hints.slice(0, session.hintsRevealed);
  res.json({
    sessionId: session.id,
    puzzle: publicPuzzle(session.puzzle),
    history: session.history,
    hints: shownHints,
    questionsUsed: session.history.length,
    accumulatedProgress: session.accumulatedProgress,
    maxQuestions: session.puzzle.maxQuestions,
    finished: session.finished,
    questionsDepleted: session.questionsDepleted,
  });
});

// SSE 流式提问
soloRouter.get('/ask', async (req, res) => {
  const sessionId = String(req.query.sessionId || '');
  const question = String(req.query.question || '').trim();
  const session = manager.getSession(sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  if (!question) return res.status(400).json({ error: '问题为空' });
  if (session.questionsDepleted) return res.status(409).json({ error: '已达提问上限，请揭晓或提交推理' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let closed = false;
  req.on('close', () => (closed = true));
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  (async () => {
    try {
      const reply = await hostAnswer(session.puzzle, question, session.history);
      send({ type: 'answer', answer: reply.answer, source: reply.source });
      const note = reply.note || '';
      const item = manager.recordSessionAnswer(session.id, question, reply);
      // 逐字打字机效果
      const size = 4;
      for (let i = 0; i < note.length; i += size) {
        if (closed) break;
        send({ type: 'chunk', text: note.slice(i, i + size) });
        await delay(28);
      }
      send({
        type: 'done',
        item,
        questionsUsed: session.history.length,
        accumulatedProgress: session.accumulatedProgress,
        finished: session.finished,
        questionsDepleted: session.questionsDepleted,
      });
    } catch (e) {
      send({ type: 'error', message: (e as Error).message });
    } finally {
      if (!closed) res.end();
    }
  })();
});

app.use('/api/puzzles', puzzlesRouter);
app.use('/api/submissions', submitRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/solo', soloRouter);
app.use('/api/config', configRouter);
app.use('/api/editor', editorRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, useAI: config.useAI, hasKey: config.hasAIKey });
});

// ───── 隐藏测试端点 ─────
const testRouter = express.Router();

testRouter.get('/', (_req, res) => {
  res.json({
    message: '海龟汤 AI 测试端点 (EdgeOne Pages)',
    endpoints: {
      'GET /api/__test__/': '本页面 - 测试端点总览',
      'GET /api/__test__/config': '查看当前完整配置（部分脱敏）',
      'POST /api/__test__/chat': '测试 AI 对话',
      'POST /api/__test__/judge': '测试 AI 裁判',
      'POST /api/__test__/generate': '测试题目生成',
    },
  });
});

testRouter.get('/config', (_req, res) => {
  const rt = getRuntimeConfig();
  res.json({
    apiKey: rt.apiKey ? `${rt.apiKey.slice(0, 6)}...${rt.apiKey.slice(-4)}` : '(未设置)',
    baseURL: rt.baseURL,
    model: rt.model,
    useAI: rt.useAI,
    hasKey: Boolean(rt.apiKey),
    aiEnabled: config.useAI,
  });
});

testRouter.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '请提供 message 参数' });
  }
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'AI 未启用，请先在配置页面开启 AI。' });
  }
  try {
    const { answerWithAI } = await import('./ai/client.js');
    const testPuzzle = {
      id: '__test__',
      title: '测试用',
      surface: '测试汤面',
      solution: '测试汤底',
      difficulty: 'easy' as const,
      maxQuestions: 5,
      tags: ['测试'],
      hints: ['测试提示'],
      author: 'system',
      createdAt: Date.now(),
    };
    const result = await answerWithAI(testPuzzle, message, []);
    res.json({ ok: true, answer: result.answer, note: result.note });
  } catch (e) {
    res.status(500).json({ error: `AI 调用失败: ${(e as Error).message}` });
  }
});

testRouter.post('/judge', async (req, res) => {
  const { guess, solution, surface } = req.body || {};
  if (!guess || typeof guess !== 'string') {
    return res.status(400).json({ error: '请提供 guess 参数' });
  }
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'AI 未启用，请先在配置页面开启 AI。' });
  }
  try {
    const { judgeWithAI } = await import('./ai/client.js');
    const testPuzzle = {
      id: '__test__',
      title: '测试用',
      surface: surface || '测试汤面',
      solution: solution || '测试汤底',
      difficulty: 'easy' as const,
      maxQuestions: 5,
      tags: ['测试'],
      hints: [],
      author: 'system',
      createdAt: Date.now(),
    };
    const result = await judgeWithAI(testPuzzle, guess);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: `裁判调用失败: ${(e as Error).message}` });
  }
});

testRouter.post('/generate', async (_req, res) => {
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'AI 未启用，请先在配置页面开启 AI。' });
  }
  try {
    const { generatePuzzle } = await import('./ai/puzzleGenerator.js');
    const puzzle = await generatePuzzle();
    res.json({ ok: true, puzzle });
  } catch (e) {
    res.status(500).json({ error: `生成失败: ${(e as Error).message}` });
  }
});

app.use('/api/__test__', testRouter);

// ───── 异步初始化 ─────
// 模块加载时执行：从 storage 加载配置、审核通过的投稿，并迁移文件数据

let _initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      // 1. 初始化运行时配置（storage + 环境变量）
      await initRuntimeConfig();
      // 2. 从文件迁移基础题库到 storage（首次部署）
      await migratePuzzlesFromFile();
      // 3. 从 storage 加载基础题库到内存
      await manager.initBasePuzzles();
      // 4. 从文件迁移投稿数据到 storage（首次部署）
      await migrateSubmissionsFromFile();
      // 5. 加载已审核通过的投稿到内存题库
      await manager.refreshApproved();
      console.log('[init] ✅ 云函数初始化完成');
    } catch (e) {
      console.error('[init] 初始化失败:', (e as Error).message);
    }
  })();
  return _initPromise;
}

// 立即触发初始化（在支持 top-level await 的环境中会等待完成）
void ensureInit();

// Cloud Functions: 导出 app，不调用 listen()
export default app;
