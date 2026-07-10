import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { manager } from '../games/manager.js';
import { judgeGuess } from '../judge.js';
import type { Puzzle } from '../types.js';
import type { Room } from '../games/room.js';

const INPUT_LIMITS = {
  question: 200,
  nickname: 20,
  guess: 5000,
} as const;

function publicPuzzle(p: Puzzle) {
  return {
    id: p.id,
    title: p.title,
    surface: p.surface,
    difficulty: p.difficulty,
    maxQuestions: p.maxQuestions,
    tags: p.tags,
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

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    // 创建房间
    socket.on('room:create', ({ puzzleId, name, mode }: any, cb?: (r: any) => void) => {
      const playerName = String(name || '').trim();
      if (playerName.length > INPUT_LIMITS.nickname) {
        return cb?.({ error: `昵称不能超过 ${INPUT_LIMITS.nickname} 字` });
      }
      const puzzle = manager.getPuzzleById(puzzleId);
      if (!puzzle) return cb?.({ error: '题目不存在' });
      const room = manager.createRoom(puzzle, mode === 'discuss' ? 'discuss' : 'race');
      const player = manager.joinRoom(room.code, playerName || '匿名玩家') as any;
      if (!player) return cb?.({ error: '创建房间失败' });
      socket.join(room.code);
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      socket.data.playerName = player.name;
      cb?.({ ok: true, code: room.code, playerId: player.id });
      io.to(room.code).emit('room:state', roomState(room));
    });

    // 加入房间
    socket.on('room:join', ({ code, name }: any, cb?: (r: any) => void) => {
      const playerName = String(name || '').trim();
      if (playerName.length > INPUT_LIMITS.nickname) {
        return cb?.({ error: `昵称不能超过 ${INPUT_LIMITS.nickname} 字` });
      }
      const room = manager.getRoom(code);
      if (!room) return cb?.({ error: '房间不存在' });
      const player = manager.joinRoom(code, playerName || '匿名玩家');
      if (!player) return cb?.({ error: '加入失败' });
      socket.join(code);
      socket.data.code = code;
      socket.data.playerId = player.id;
      socket.data.playerName = player.name;
      cb?.({ ok: true, code, playerId: player.id });
      io.to(code).emit('room:state', roomState(room));
    });

    // 共享提问
    socket.on('room:ask', async ({ code, question }: any) => {
      const q = String(question || '').trim();
      if (!q) return;
      if (q.length > INPUT_LIMITS.question) return;
      const room = manager.getRoom(code);
      if (!room || room.finished) return;
      const qa = await manager.askRoom(code, q);
      if (!qa) return;
      // 附加提问者昵称
      const playerName = socket.data.playerName || '匿名玩家';
      (qa as any).playerName = playerName;
      io.to(code).emit('room:qa', qa);
      io.to(code).emit('room:state', roomState(room));
    });

    // 揭晓/猜中判定（仅竞速模式）
    socket.on('room:guess', async ({ code, playerId, guess }: any) => {
      const room = manager.getRoom(code);
      if (!room || room.finished) return;
      if (room.mode === 'discuss') return; // 多人推理模式禁用单点猜中
      const g = String(guess || '').trim();
      if (!g || g.length > INPUT_LIMITS.guess) return;
      const existing = room.players.find((p) => p.id === playerId);
      if (existing?.guessed) return; // 每位玩家只能提交一次汤底
      const result = await judgeGuess(room.puzzle, g);
      const player = manager.guessRoom(code, playerId, result.correct);
      io.to(code).emit('room:result', {
        playerId,
        correct: result.correct,
        feedback: result.feedback,
        winnerId: player?.isWinner ? player.id : null,
        solution: room.puzzle.solution,
        playerGuess: g,
      });
      io.to(code).emit('room:state', roomState(room));
    });

    // 竞速模式：猜错后消耗提问次数重试猜测
    socket.on('room:retry-guess', ({ code, playerId }: any) => {
      const room = manager.getRoom(code);
      if (!room || room.finished || room.mode === 'discuss') return;
      const ok = manager.resetGuessed(code, playerId, 3);
      if (ok) {
        io.to(code).emit('room:retry-allowed', { playerId });
        io.to(code).emit('room:state', roomState(room));
      }
    });

    // 多人推理：切换「结束讨论」状态（达成全员共识）
    socket.on('room:end', ({ code, playerId }: any) => {
      const room = manager.getRoom(code);
      if (!room || room.finished || room.mode !== 'discuss') return;
      manager.markEnded(code, playerId);
      io.to(code).emit('room:state', roomState(room));
    });

    // 多人推理：团队统一提交汤底（仅全员共识后由一人提交一次）
    socket.on('room:submit', async ({ code, playerId, guess }: any) => {
      const room = manager.getRoom(code);
      if (!room || room.finished || room.mode !== 'discuss') return;
      if (!room.allEnded) return; // 必须全员达成共识
      const g = String(guess || '').trim();
      if (!g || g.length > INPUT_LIMITS.guess || room.submission) return;
      const result = await judgeGuess(room.puzzle, g);
      const out = manager.submitRoom(code, playerId, {
        correct: result.correct,
        feedback: result.feedback,
      }, g);
      if (!out.submission) return;
      io.to(code).emit('room:submission', {
        ...out.submission,
        solution: room.puzzle.solution,
      });
      io.to(code).emit('room:state', roomState(room));
    });

    // 玩家间文字聊天
    socket.on('room:chat', ({ code, message }: any) => {
      const msg = String(message || '').trim();
      if (!msg || msg.length > 500) return;
      const room = manager.getRoom(code);
      if (!room) return;
      const chatMsg = {
        id: crypto.randomUUID(),
        from: socket.data.playerName || '匿名',
        fromId: socket.data.playerId,
        message: msg,
        timestamp: Date.now(),
      };
      io.to(code).emit('room:chat', chatMsg);
    });

    // 离开
    socket.on('room:leave', ({ code, playerId }: any) => {
      if (code) {
        manager.leaveRoom(code, playerId);
        manager.recomputeConsensus(code);
        socket.leave(code);
        const room = manager.getRoom(code);
        if (room) io.to(code).emit('room:state', roomState(room));
      }
    });

    socket.on('disconnect', () => {
      const code = socket.data.code;
      const playerId = socket.data.playerId;
      if (code && playerId) {
        manager.leaveRoom(code, playerId);
        manager.recomputeConsensus(code);
        const room = manager.getRoom(code);
        if (room) io.to(code).emit('room:state', roomState(room));
      }
    });
  });
}
