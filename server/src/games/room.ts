import crypto from 'node:crypto';
import type { Puzzle, QAItem, AnswerKind } from '../types.js';
import { hostAnswer } from '../host.js';

export type RoomMode = 'race' | 'discuss';

export interface RoomPlayer {
  id: string;
  name: string;
  solved: boolean;
  isWinner: boolean;
  guessed: boolean;
  /** 多人推理模式：该玩家是否已点击「结束讨论」 */
  ended: boolean;
}

/** 多人推理模式：团队统一提交后的判定结果 */
export interface RoomSubmission {
  guess: string;
  byId: string;
  byName: string;
  correct: boolean;
  feedback: string;
}

export interface Room {
  code: string;
  puzzle: Puzzle;
  players: RoomPlayer[];
  history: QAItem[];
  startedAt: number;
  finished: boolean;
  maxQuestions: number;
  createdAt: number;
  mode: RoomMode;
  /** 多人推理模式：是否全员已点击「结束讨论」 */
  allEnded: boolean;
  /** 多人推理模式：团队统一提交的汤底（仅一次） */
  submission: RoomSubmission | null;
}

function genCode(): string {
  // 6 位大写字母+数字，避免易混字符
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function createRoom(puzzle: Puzzle, mode: RoomMode = 'race'): Room {
  return {
    code: genCode(),
    puzzle,
    players: [],
    history: [],
    startedAt: Date.now(),
    finished: false,
    maxQuestions: puzzle.maxQuestions,
    createdAt: Date.now(),
    mode,
    allEnded: false,
    submission: null,
  };
}

export function addPlayer(room: Room, name: string): RoomPlayer {
  // 同名去重计数
  const base = name.trim() || '匿名玩家';
  const same = room.players.filter((p) => p.name === base).length;
  const player: RoomPlayer = {
    id: crypto.randomUUID(),
    name: same > 0 ? `${base}${same + 1}` : base,
    solved: false,
    isWinner: false,
    guessed: false,
    ended: false,
  };
  room.players.push(player);
  return player;
}

export function removePlayer(room: Room, playerId: string): void {
  room.players = room.players.filter((p) => p.id !== playerId);
  recomputeConsensus(room);
}

/** 重新计算全员共识：需要至少 2 人且全员已结束讨论 */
export function recomputeConsensus(room: Room): void {
  if (room.mode !== 'discuss' || room.submission) return;
  room.allEnded = room.players.length >= 2 && room.players.every((p) => p.ended);
}

/** 切换某玩家「结束讨论」状态，返回是否全员已结束 */
export function markEnded(room: Room, playerId: string): boolean {
  if (room.mode !== 'discuss' || room.submission) return room.allEnded;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return room.allEnded;
  player.ended = !player.ended;
  room.allEnded = room.players.length >= 2 && room.players.every((p) => p.ended);
  return room.allEnded;
}

/** 房间共享提问：主持人作答一次，写入共享历史 */
export async function askInRoom(room: Room, question: string): Promise<QAItem> {
  const reply = await hostAnswer(room.puzzle, question, room.history);
  const item: QAItem = {
    id: crypto.randomUUID(),
    question,
    answer: reply.answer as AnswerKind,
    note: reply.note,
    source: reply.source,
  };
  room.history.push(item);
  if (room.history.length >= room.maxQuestions) room.finished = true;
  return item;
}

export function guessInRoom(
  room: Room,
  playerId: string,
  correct: boolean,
): RoomPlayer | undefined {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return undefined;
  player.guessed = true;
  if (correct) {
    player.solved = true;
    if (!room.players.some((p) => p.isWinner)) {
      player.isWinner = true;
      room.finished = true;
    }
  }
  return player;
}

/**
 * 多人推理模式：全员达成共识后，由其中一人提交团队统一汤底。
 * 仅在 allEnded 为真且尚未提交时生效，判定一次后即结束房间。
 */
export function submitRoom(
  room: Room,
  playerId: string,
  result: { correct: boolean; feedback: string },
  guess: string,
): { player: RoomPlayer | undefined; submission: RoomSubmission | null } {
  if (room.mode !== 'discuss' || !room.allEnded || room.submission) {
    return { player: undefined, submission: room.submission };
  }
  const player = room.players.find((p) => p.id === playerId);
  const submission: RoomSubmission = {
    guess,
    byId: playerId,
    byName: player?.name ?? '匿名',
    correct: result.correct,
    feedback: result.feedback,
  };
  room.submission = submission;
  room.finished = true;
  return { player, submission };
}

/** 竞速模式：消耗指定提问次数重置玩家 guessed 状态，允许再次猜测 */
export function resetGuessed(room: Room, playerId: string, costQuestions: number = 3): boolean {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.guessed || player.solved || room.finished) return false;
  // 剩余提问次数必须足够支付消耗
  const remaining = room.maxQuestions - room.history.length;
  if (remaining < costQuestions) return false;
  // 消耗提问次数（通过向历史中插入虚拟记录来占位）
  for (let i = 0; i < costQuestions; i++) {
    room.history.push({
      id: crypto.randomUUID(),
      question: `[二次猜测消耗]`,
      answer: 'irrelevant' as AnswerKind,
      note: '消耗提问次数以解锁再次猜测',
      source: 'fallback',
    });
  }
  // 重置 guessed 状态但保留 solved 为 false
  player.guessed = false;
  // 检查是否达到提问上限
  if (room.history.length >= room.maxQuestions) room.finished = true;
  return true;
}
