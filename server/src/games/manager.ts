import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Puzzle, Difficulty, QAItem } from '../types.js';
import { createSession, askInSession, nextHint, recordAnswer, type Session } from './session.js';
import {
  createRoom,
  addPlayer,
  removePlayer,
  askInRoom,
  guessInRoom,
  submitRoom,
  markEnded,
  recomputeConsensus,
  resetGuessed,
  type Room,
  type RoomMode,
  type RoomPlayer,
  type RoomSubmission,
} from './room.js';
import { listSubmissions } from './submissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUZZLES_FILE = path.resolve(__dirname, '../../data/puzzles.json');

const BASE_PUBLISH_DATE = Date.UTC(2025, 8, 1); // 官方题库起始发布日 2025-09-01

function loadBasePuzzles(): Puzzle[] {
  try {
    const raw = JSON.parse(fs.readFileSync(PUZZLES_FILE, 'utf-8')) as Puzzle[];
    // 补齐作者与发布日期：种子题未标注时按索引均匀错开
    return raw.map((p, i) => ({
      ...p,
      author: p.author ?? '官方题库',
      createdAt: p.createdAt ?? BASE_PUBLISH_DATE + i * 30 * 86400000,
    }));
  } catch (e) {
    console.error('[manager] 读取题库失败：', (e as Error).message);
    return [];
  }
}

const MAX_Q_BY_DIFF: Record<Difficulty, number> = { easy: 20, medium: 30, hard: 40, unlimited: 999 };

function submissionToPuzzle(s: {
  id: string;
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  hints: string[];
  tags: string[];
  author: string;
  createdAt: number;
}): Puzzle {
  return {
    id: `sub_${s.id}`,
    title: s.title || s.surface.slice(0, 14) + (s.surface.length > 14 ? '…' : ''),
    surface: s.surface,
    solution: s.solution,
    difficulty: s.difficulty,
    maxQuestions: MAX_Q_BY_DIFF[s.difficulty],
    tags: s.tags,
    hints: s.hints,
    author: s.author,
    createdAt: s.createdAt,
  };
}

export class GameManager {
  private basePuzzles: Puzzle[];
  private approvedCache: Puzzle[] = [];
  private sessions = new Map<string, Session>();
  private rooms = new Map<string, Room>();

  constructor() {
    this.basePuzzles = loadBasePuzzles();
    this.refreshApproved();
  }

  refreshApproved(): void {
    this.approvedCache = listSubmissions('approved').map(submissionToPuzzle);
  }

  getPlayablePuzzles(): Puzzle[] {
    return [...this.basePuzzles, ...this.approvedCache];
  }

  getPuzzleById(id: string): Puzzle | undefined {
    return this.getPlayablePuzzles().find((p) => p.id === id);
  }

  randomPuzzle(difficulty?: Difficulty): Puzzle | undefined {
    const pool = this.getPlayablePuzzles().filter(
      (p) => !difficulty || p.difficulty === difficulty,
    );
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---- 单人会话 ----
  createSession(puzzle: Puzzle): Session {
    const s = createSession(puzzle);
    this.sessions.set(s.id, s);
    return s;
  }
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }
  async askSession(id: string, question: string): Promise<QAItem | null> {
    const s = this.sessions.get(id);
    if (!s) return null;
    return askInSession(s, question);
  }
  recordSessionAnswer(
    id: string,
    question: string,
    reply: import('../host.js').HostReply,
  ): QAItem | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    return recordAnswer(s, question, reply);
  }
  revealHint(id: string): string | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    return nextHint(s);
  }

  // ---- 多人房间 ----
  createRoom(puzzle: Puzzle, mode: RoomMode = 'race'): Room {
    const r = createRoom(puzzle, mode);
    this.rooms.set(r.code, r);
    return r;
  }
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }
  joinRoom(code: string, name: string): RoomPlayer | undefined {
    const r = this.rooms.get(code);
    if (!r) return undefined;
    return addPlayer(r, name);
  }
  leaveRoom(code: string, playerId: string): void {
    const r = this.rooms.get(code);
    if (r) removePlayer(r, playerId);
  }
  async askRoom(code: string, question: string): Promise<QAItem | null> {
    const r = this.rooms.get(code);
    if (!r) return null;
    return askInRoom(r, question);
  }
  guessRoom(code: string, playerId: string, correct: boolean): RoomPlayer | undefined {
    const r = this.rooms.get(code);
    if (!r) return undefined;
    return guessInRoom(r, playerId, correct);
  }

  // ---- 多人推理模式（共识） ----
  markEnded(code: string, playerId: string): boolean {
    const r = this.rooms.get(code);
    if (!r) return false;
    return markEnded(r, playerId);
  }
  recomputeConsensus(code: string): void {
    const r = this.rooms.get(code);
    if (r) recomputeConsensus(r);
  }
  submitRoom(
    code: string,
    playerId: string,
    result: { correct: boolean; feedback: string },
    guess: string,
  ): { player: RoomPlayer | undefined; submission: RoomSubmission | null } {
    const r = this.rooms.get(code);
    if (!r) return { player: undefined, submission: null };
    return submitRoom(r, playerId, result, guess);
  }

  // ---- 房间过期清理 ----
  /** 每隔一段时间扫描并删除空房间（无玩家且存在超过 10 分钟） */
  startRoomCleanup(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
    console.log(`[manager] 房间清理定时器已启动（间隔 ${intervalMs / 1000}s）`);
    return setInterval(() => {
      this.cleanupStaleRooms();
    }, intervalMs);
  }

  cleanupStaleRooms(maxAgeMs: number = 10 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.players.length === 0 && now - room.createdAt > maxAgeMs) {
        this.rooms.delete(code);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[manager] 清理了 ${removed} 个过期空房间`);
    }
    return removed;
  }

  /** 竞速模式：消耗提问次数来重置玩家的猜测状态（二次猜测） */
  resetGuessed(code: string, playerId: string, costQuestions: number = 3): boolean {
    const r = this.rooms.get(code);
    if (!r) return false;
    return resetGuessed(r, playerId, costQuestions);
  }

  /** 获取活跃房间的公开信息列表（不暴露敏感数据） */
  listPublicRooms(): PublicRoomInfo[] {
    const result: PublicRoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.length === 0) continue; // 跳过空房间
      result.push({
        code: room.code,
        mode: room.mode,
        playerCount: room.players.length,
        difficulty: room.puzzle.difficulty,
        title: room.puzzle.title,
        elapsed: Date.now() - room.startedAt,
        finished: room.finished,
      });
    }
    return result;
  }
}

export interface PublicRoomInfo {
  code: string;
  mode: string;
  playerCount: number;
  difficulty: string;
  title: string;
  elapsed: number;
  finished: boolean;
}

export const manager = new GameManager();
