import crypto from 'node:crypto';
import type { Puzzle, QAItem } from '../types.js';
import { hostAnswer, type HostReply } from '../host.js';

export interface Session {
  id: string;
  puzzle: Puzzle;
  history: QAItem[];
  hintsRevealed: number;
  finished: boolean;
  questionsDepleted: boolean;
  createdAt: number;
  /** 累积故事还原度（AI 评估的贡献度之和，0~100 百分比制，上限 100） */
  accumulatedProgress: number;
}

export function createSession(puzzle: Puzzle): Session {
  return {
    id: crypto.randomUUID(),
    puzzle,
    history: [],
    hintsRevealed: 0,
    finished: false,
    questionsDepleted: false,
    createdAt: Date.now(),
    accumulatedProgress: 0,
  };
}

export async function askInSession(
  session: Session,
  question: string,
): Promise<QAItem> {
  const reply = await hostAnswer(session.puzzle, question, session.history);
  const item: QAItem = {
    id: crypto.randomUUID(),
    question,
    answer: reply.answer,
    note: reply.note,
    source: reply.source,
    progressGain: reply.progressGain,
  };
  session.history.push(item);
  session.accumulatedProgress = Math.min(100, session.accumulatedProgress + reply.progressGain);
  session.questionsDepleted = session.history.length >= session.puzzle.maxQuestions;
  return item;
}

export function nextHint(session: Session): string | null {
  const hints = session.puzzle.hints;
  if (session.hintsRevealed >= hints.length) return null;
  const hint = hints[session.hintsRevealed];
  session.hintsRevealed += 1;
  return hint;
}

/** 记录一条已由主持人计算好的回答（用于 SSE 流式推送后落库） */
export function recordAnswer(
  session: Session,
  question: string,
  reply: HostReply,
): QAItem {
  const item: QAItem = {
    id: crypto.randomUUID(),
    question,
    answer: reply.answer,
    note: reply.note,
    source: reply.source,
    progressGain: reply.progressGain,
  };
  session.history.push(item);
  session.accumulatedProgress = Math.min(100, session.accumulatedProgress + reply.progressGain);
  session.questionsDepleted = session.history.length >= session.puzzle.maxQuestions;
  return item;
}
