import { useCallback, useState } from 'react';
import { api, type SoloStreamEvent } from '../api';
import { useGameStore } from '../store/gameStore';
import type { AnswerKind, Difficulty, QAItem, PublicPuzzle, SoloSessionState } from '../types/game';

const SESSION_STORAGE_KEY = 'hgt_sessionId';

export interface StreamingState {
  answer: AnswerKind;
  note: string;
  source?: 'ai' | 'fallback';
}

export function useSoloGame() {
  const {
    sessionId,
    puzzle,
    history,
    hints,
    questionsUsed,
    maxQuestions,
    finished,
    questionsDepleted,
    accumulatedProgress,
    setSolo,
    setHistory,
    addQA,
    addHint,
    setProgress,
  } = useGameStore();

  const [asking, setAsking] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);

  const start = useCallback(
    async (puzzleId?: string, difficulty?: Difficulty) => {
      const data = await api.startSolo(puzzleId, difficulty);
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
      setSolo({
        sessionId: data.sessionId,
        puzzle: data.puzzle,
        maxQuestions: data.maxQuestions,
      });
      return data;
    },
    [setSolo],
  );

  /** 尝试从 sessionStorage 恢复会话状态 */
  const tryRestore = useCallback(async (): Promise<boolean> => {
    const savedId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedId) return false;
    try {
      const state: SoloSessionState = await api.getSoloState(savedId);
      if (!state || !state.puzzle) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return false;
      }
      setSolo({
        sessionId: state.sessionId,
        puzzle: state.puzzle,
        maxQuestions: state.maxQuestions,
      });
      setHistory(state.history);
      state.hints.forEach((h) => addHint(h));
      setProgress(state.questionsUsed, state.finished, state.questionsDepleted, state.accumulatedProgress ?? 0);
      return true;
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }
  }, [setSolo, setHistory, addHint, setProgress]);

  const ask = useCallback(
    (question: string) => {
      if (!sessionId || questionsDepleted || asking) return;
      setAsking(true);
      setStreaming(null);
      let acc = '';
      api.askSoloStream(
        sessionId,
        question,
        (e: SoloStreamEvent) => {
          if (e.type === 'answer') {
            setStreaming({ answer: e.answer!, note: '', source: e.source });
          } else if (e.type === 'chunk') {
            acc += e.text || '';
            setStreaming((s) => (s ? { ...s, note: acc } : s));
          } else if (e.type === 'done') {
            if (e.item) addQA(e.item);
            if (typeof e.questionsUsed === 'number' || typeof e.accumulatedProgress === 'number') {
              setProgress(
                e.questionsUsed ?? questionsUsed,
                Boolean(e.finished),
                Boolean(e.questionsDepleted),
                e.accumulatedProgress ?? accumulatedProgress,
              );
            }
            setStreaming(null);
            setAsking(false);
          } else if (e.type === 'error') {
            setStreaming(null);
            setAsking(false);
            console.error('[solo]', e.message);
          }
        },
      );
    },
    [sessionId, questionsDepleted, asking, addQA, setProgress],
  );

  const revealHint = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await api.revealHint(sessionId);
      if (r.hint) addHint(r.hint);
      if (r.done) {
        console.log('[hint] 所有提示已用完');
      }
    } catch (e) {
      console.error('[hint] 获取提示失败:', (e as Error).message);
    }
  }, [sessionId, addHint]);

  const guess = useCallback(
    async (guessText: string) => {
      if (!sessionId) throw new Error('会话不存在');
      return api.guessSolo(sessionId, guessText);
    },
    [sessionId],
  );

  return {
    sessionId,
    puzzle,
    history,
    hints,
    questionsUsed,
    maxQuestions,
    finished,
    questionsDepleted,
    accumulatedProgress,
    asking,
    streaming,
    start,
    tryRestore,
    ask,
    revealHint,
    guess,
  };
}
