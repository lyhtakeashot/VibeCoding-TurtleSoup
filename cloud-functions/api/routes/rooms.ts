import crypto from 'node:crypto';
import { Router } from 'express';
import { manager } from '../games/manager.js';
import { judgeGuess } from '../judge.js';
import type { Room } from '../games/room.js';
import type { Puzzle } from '../types.js';

export const roomsRouter = Router();

// ───── 常量 ─────
const INPUT_LIMITS = {
  question: 200,
  nickname: 20,
  guess: 5000,
  chat: 500,
} as const;

// ───── 工具 ─────
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

function roomState(room: Room) {
  const p = publicPuzzle(room.puzzle);
  return {
    code: room.code,
    puzzle: room.finished ? { ...p, solution: room.puzzle.solution } : p,
    players: room.players,
    history: room.history,
    startedAt: room.startedAt,
    finished: room.finished,
    maxQuestions: room.maxQuestions,
    questionsUsed: room.history.length,
    mode: room.mode,
    allEnded: room.allEnded,
    submission: room.submission,
  };
}

// ───── SSE 连接管理 ─────
const sseConnections = new Map<string, Set<import('express').Response>>();

function addSSEConnection(code: string, res: import('express').Response) {
  if (!sseConnections.has(code)) {
    sseConnections.set(code, new Set());
  }
  sseConnections.get(code)!.add(res);
  res.on('close', () => {
    const conns = sseConnections.get(code);
    if (conns) {
      conns.delete(res);
      if (conns.size === 0) sseConnections.delete(code);
    }
  });
}

/** 向房间内所有 SSE 连接广播一个命名事件 */
function broadcastSSE(code: string, event: string, data: unknown) {
  const conns = sseConnections.get(code);
  if (!conns || conns.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of conns) {
    try {
      res.write(payload);
    } catch {
      conns.delete(res);
    }
  }
}

/** 广播房间状态 + 额外事件 */
function broadcastRoomState(code: string, extra?: { event: string; data: unknown }) {
  const room = manager.getRoom(code);
  if (!room) return;
  if (extra) {
    broadcastSSE(code, extra.event, extra.data);
  }
  broadcastSSE(code, 'room:state', roomState(room));
}

// ───── 获取活跃房间列表 ─────
roomsRouter.get('/', (_req, res) => {
  const rooms = manager.listPublicRooms();
  res.json({ rooms });
});

// ───── GET /:code/stream — SSE 状态流 ─────
roomsRouter.get('/:code/stream', (req, res) => {
  const room = manager.getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '房间不存在' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 先发送初始状态
  const initPayload = `event: room:state\ndata: ${JSON.stringify(roomState(room))}\n\n`;
  res.write(initPayload);

  addSSEConnection(req.params.code, res);

  // 保持连接存活的心跳
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// ───── POST /create — 创建房间 ─────
roomsRouter.post('/create', (req, res) => {
  const { puzzleId, name, mode } = req.body || {};
  const playerName = String(name || '').trim();

  if (playerName.length > INPUT_LIMITS.nickname) {
    return res.status(400).json({ error: `昵称不能超过 ${INPUT_LIMITS.nickname} 字` });
  }

  const puzzle = manager.getPuzzleById(puzzleId);
  if (!puzzle) return res.status(404).json({ error: '题目不存在' });

  const roomMode = mode === 'discuss' ? 'discuss' : 'race';
  const room = manager.createRoom(puzzle, roomMode);
  const player = manager.joinRoom(room.code, playerName || '匿名玩家');
  if (!player) return res.status(500).json({ error: '创建房间失败' });

  res.json({ ok: true, code: room.code, playerId: player.id, playerName: player.name });
  broadcastSSE(room.code, 'room:state', roomState(room));
});

// ───── POST /join — 加入房间 ─────
roomsRouter.post('/join', (req, res) => {
  const { code, name } = req.body || {};
  const playerName = String(name || '').trim();

  if (playerName.length > INPUT_LIMITS.nickname) {
    return res.status(400).json({ error: `昵称不能超过 ${INPUT_LIMITS.nickname} 字` });
  }

  const room = manager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });

  const player = manager.joinRoom(code, playerName || '匿名玩家');
  if (!player) return res.status(500).json({ error: '加入失败' });

  res.json({ ok: true, code, playerId: player.id, playerName: player.name });
  broadcastSSE(code, 'room:state', roomState(room));
});

// ───── POST /:code/ask — 共享提问 ─────
roomsRouter.post('/:code/ask', async (req, res) => {
  const { playerName, question } = req.body || {};
  const q = String(question || '').trim();
  if (!q) return res.status(400).json({ error: '问题为空' });
  if (q.length > INPUT_LIMITS.question) {
    return res.status(400).json({ error: `问题不能超过 ${INPUT_LIMITS.question} 字` });
  }

  const code = req.params.code;
  const room = manager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  if (room.finished) return res.status(409).json({ error: '游戏已结束' });

  try {
    const qa = await manager.askRoom(code, q);
    if (!qa) return res.status(500).json({ error: 'AI 回答失败' });

    (qa as any).playerName = playerName || '匿名玩家';

    res.json({ ok: true, qa });
    broadcastRoomState(code, { event: 'room:qa', data: qa });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ───── POST /:code/guess — 竞速模式猜汤底 ─────
roomsRouter.post('/:code/guess', async (req, res) => {
  const { playerId, guess } = req.body || {};
  const g = String(guess || '').trim();

  if (!g || g.length > INPUT_LIMITS.guess) {
    return res.status(400).json({ error: `推理内容过长` });
  }

  const code = req.params.code;
  const room = manager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  if (room.finished) return res.status(409).json({ error: '游戏已结束' });
  if (room.mode === 'discuss') return res.status(400).json({ error: '推理模式请使用团队提交' });

  const existing = room.players.find((p) => p.id === playerId);
  if (existing?.guessed) return res.status(409).json({ error: '你已提交过汤底' });

  try {
    const result = await judgeGuess(room.puzzle, g);
    const player = manager.guessRoom(code, playerId, result.correct);

    const eventData = {
      playerId,
      correct: result.correct,
      feedback: result.feedback,
      winnerId: player?.isWinner ? player.id : null,
      solution: room.puzzle.solution,
      playerGuess: g,
    };

    res.json({ ok: true, ...eventData });
    broadcastRoomState(code, { event: 'room:result', data: eventData });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ───── POST /:code/chat — 文字聊天 ─────
roomsRouter.post('/:code/chat', (req, res) => {
  const { playerId, playerName, message } = req.body || {};
  const msg = String(message || '').trim();
  if (!msg || msg.length > INPUT_LIMITS.chat) {
    return res.status(400).json({ error: '消息无效或过长' });
  }

  const code = req.params.code;
  const room = manager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });

  const chatMsg = {
    id: crypto.randomUUID(),
    from: playerName || '匿名',
    fromId: playerId || '',
    message: msg,
    timestamp: Date.now(),
  };

  res.json({ ok: true, chat: chatMsg });
  broadcastSSE(code, 'room:chat', chatMsg);
});

// ───── POST /:code/leave — 离开房间 ─────
roomsRouter.post('/:code/leave', (req, res) => {
  const { playerId } = req.body || {};
  const code = req.params.code;

  if (playerId) {
    manager.leaveRoom(code, playerId);
    manager.recomputeConsensus(code);
  }

  res.json({ ok: true });
  const room = manager.getRoom(code);
  if (room) broadcastSSE(code, 'room:state', roomState(room));
});

// ───── POST /:code/retry — 竞速模式：消耗提问次数重试 ─────
roomsRouter.post('/:code/retry', (req, res) => {
  const { playerId } = req.body || {};
  const code = req.params.code;

  const room = manager.getRoom(code);
  if (!room || room.finished || room.mode === 'discuss') {
    return res.status(400).json({ error: '操作无效' });
  }

  const ok = manager.resetGuessed(code, playerId, 3);
  if (!ok) return res.status(400).json({ error: '无法重试（可能次数不足或已猜中）' });

  res.json({ ok: true });
  broadcastRoomState(code, { event: 'room:retry-allowed', data: { playerId } });
});

// ───── POST /:code/end — 推理模式：切换「结束讨论」 ─────
roomsRouter.post('/:code/end', (req, res) => {
  const { playerId } = req.body || {};
  const code = req.params.code;

  const room = manager.getRoom(code);
  if (!room || room.finished || room.mode !== 'discuss') {
    return res.status(400).json({ error: '操作无效' });
  }

  manager.markEnded(code, playerId);
  res.json({ ok: true });
  broadcastSSE(code, 'room:state', roomState(room));
});

// ───── POST /:code/submit — 推理模式：团队统一提交 ─────
roomsRouter.post('/:code/submit', async (req, res) => {
  const { playerId, guess } = req.body || {};
  const g = String(guess || '').trim();

  if (!g || g.length > INPUT_LIMITS.guess) {
    return res.status(400).json({ error: '推理内容无效' });
  }

  const code = req.params.code;
  const room = manager.getRoom(code);
  if (!room || room.finished || room.mode !== 'discuss') {
    return res.status(400).json({ error: '操作无效' });
  }
  if (!room.allEnded) return res.status(400).json({ error: '需全员达成共识后才能提交' });
  if (room.submission) return res.status(409).json({ error: '团队已提交过汤底' });

  try {
    const result = await judgeGuess(room.puzzle, g);
    const out = manager.submitRoom(code, playerId, { correct: result.correct, feedback: result.feedback }, g);
    if (!out.submission) return res.status(400).json({ error: '提交失败' });

    const eventData = {
      ...out.submission,
      solution: room.puzzle.solution,
    };

    res.json({ ok: true, ...eventData });
    broadcastRoomState(code, { event: 'room:submission', data: eventData });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ───── GET /:code/state — 获取房间当前状态（非 SSE） ─────
roomsRouter.get('/:code/state', (req, res) => {
  const room = manager.getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  res.json(roomState(room));
});
