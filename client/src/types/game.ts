// 从后端唯一类型源导入共享类型，消除双写
import type { Difficulty, AnswerKind, QAItem } from '@server/types';
export type { Difficulty, AnswerKind, QAItem };

export interface PublicPuzzle {
  id: string;
  title: string;
  surface: string;
  difficulty: Difficulty;
  maxQuestions: number;
  tags: string[];
  solution?: string;
  author?: string;
  createdAt?: number;
}

export type RoomMode = 'race' | 'discuss';

export interface RoomPlayer {
  id: string;
  name: string;
  solved: boolean;
  isWinner: boolean;
  guessed?: boolean;
  /** 多人推理：该玩家是否已点击「结束讨论」 */
  ended?: boolean;
}

/** 多人推理：团队统一提交的汤底判定结果 */
export interface RoomSubmission {
  guess: string;
  byId: string;
  byName: string;
  correct: boolean;
  feedback: string;
}

export interface RoomState {
  code: string;
  puzzle: PublicPuzzle;
  players: RoomPlayer[];
  history: QAItem[];
  startedAt: number;
  finished: boolean;
  maxQuestions: number;
  questionsUsed: number;
  mode: RoomMode;
  /** 多人推理：是否全员已达成共识 */
  allEnded: boolean;
  submission: RoomSubmission | null;
}

/** 玩家间文字聊天消息 */
export interface ChatMessage {
  id: string;
  from: string;
  fromId: string;
  message: string;
  timestamp: number;
}

export interface SubmissionInput {
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  hints: string[];
  tags: string[];
  author: string;
}

/** 服务端返回的会话状态（单人模式恢复用） */
export interface SoloSessionState {
  sessionId: string;
  puzzle: PublicPuzzle;
  history: QAItem[];
  hints: string[];
  questionsUsed: number;
  accumulatedProgress: number;
  maxQuestions: number;
  finished: boolean;
  questionsDepleted: boolean;
}

/** 审核台投稿列表项 */
export interface SubmissionItem {
  id: string;
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  hints: string[];
  tags: string[];
  author: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; max: number; color: string }> = {
  easy: { label: '简单', max: 20, color: '#34d399' },
  medium: { label: '中等', max: 30, color: '#fbbf24' },
  hard: { label: '困难', max: 40, color: '#f87171' },
  unlimited: { label: '∞', max: 999, color: '#60a5fa' },
};

export const ANSWER_META: Record<AnswerKind, { label: string; color: string }> = {
  yes: { label: '是', color: '#34d399' },
  no: { label: '不是', color: '#f87171' },
  irrelevant: { label: '无关', color: '#fbbf24' },
  partial: { label: '是也不是', color: '#60a5fa' },
};
