import { create } from 'zustand';
import type { Difficulty, QAItem, PublicPuzzle } from '../types/game';

interface GameState {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;

  // 单人会话
  sessionId: string | null;
  puzzle: PublicPuzzle | null;
  history: QAItem[];
  hints: string[];
  questionsUsed: number;
  maxQuestions: number;
  finished: boolean;
  questionsDepleted: boolean;
  /** 累积故事还原度（AI 评估的贡献度之和） */
  accumulatedProgress: number;
  setSolo: (s: {
    sessionId: string;
    puzzle: PublicPuzzle;
    maxQuestions: number;
  }) => void;
  setHistory: (h: QAItem[]) => void;
  addQA: (q: QAItem) => void;
  addHint: (h: string) => void;
  setProgress: (used: number, finished: boolean, questionsDepleted: boolean, accumulatedProgress: number) => void;
  resetSolo: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  difficulty: 'medium',
  setDifficulty: (d) => set({ difficulty: d }),

  sessionId: null,
  puzzle: null,
  history: [],
  hints: [],
  questionsUsed: 0,
  maxQuestions: 15,
  finished: false,
  questionsDepleted: false,
  accumulatedProgress: 0,

  setSolo: ({ sessionId, puzzle, maxQuestions }) =>
    set({ sessionId, puzzle, maxQuestions, history: [], hints: [], questionsUsed: 0, finished: false, questionsDepleted: false, accumulatedProgress: 0 }),
  setHistory: (history) => set({ history }),
  addQA: (q) => set((s) => ({ history: [...s.history, q] })),
  addHint: (h) => set((s) => ({ hints: [...s.hints, h] })),
  setProgress: (questionsUsed, finished, questionsDepleted, accumulatedProgress) => set({ questionsUsed, finished, questionsDepleted, accumulatedProgress }),
  resetSolo: () =>
    set({ sessionId: null, puzzle: null, history: [], hints: [], questionsUsed: 0, finished: false, questionsDepleted: false, accumulatedProgress: 0 }),
}));
