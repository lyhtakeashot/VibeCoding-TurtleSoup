import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomState, QAItem, ChatMessage } from '../types/game';

interface GuessResult {
  playerId: string;
  correct: boolean;
  feedback: string;
  winnerId: string | null;
  solution?: string;
  playerGuess?: string;
}

interface SubmissionResult {
  guess: string;
  byId: string;
  byName: string;
  correct: boolean;
  feedback: string;
  solution?: string;
}

export function useMultiRoom() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [result, setResult] = useState<GuessResult | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const roomCodeRef = useRef<string>('');

  // 建立 SSE 连接
  const connectSSE = useCallback((code: string) => {
    // 先断开旧连接
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    roomCodeRef.current = code;
    const es = new EventSource(`/api/rooms/${code}/stream`);

    es.addEventListener('room:state', (e) => {
      try {
        const state = JSON.parse(e.data) as RoomState;
        setRoom(state);
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('room:qa', (e) => {
      try {
        const qa = JSON.parse(e.data) as QAItem;
        setRoom((r) => (r ? { ...r, history: [...r.history, qa], questionsUsed: r.history.length + 1 } : r));
      } catch { /* ignore */ }
    });

    es.addEventListener('room:result', (e) => {
      try {
        const res = JSON.parse(e.data) as GuessResult;
        setResult(res);
      } catch { /* ignore */ }
    });

    es.addEventListener('room:chat', (e) => {
      try {
        const msg = JSON.parse(e.data) as ChatMessage;
        setChatMessages((prev) => [...prev, msg]);
      } catch { /* ignore */ }
    });

    es.addEventListener('room:retry-allowed', () => {
      // SSE 的 room:state 会带来新状态，这里不需要额外操作
    });

    es.addEventListener('room:submission', (e) => {
      try {
        const sub = JSON.parse(e.data) as SubmissionResult;
        setSubmissionResult(sub);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      // SSE 连接出错时 EventSource 会自动重连
    };

    esRef.current = es;
  }, []);

  // 断开 SSE
  const disconnectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  // 组件卸载时断开
  useEffect(() => {
    return () => {
      disconnectSSE();
    };
  }, [disconnectSSE]);

  // ───── 操作 ─────

  const createRoom = useCallback(
    async (puzzleId: string, name: string, mode: 'race' | 'discuss' = 'race') => {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, name, mode }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlayerId(data.playerId);
      setPlayerName(data.playerName || name);
      connectSSE(data.code);
      return { code: data.code, playerId: data.playerId };
    },
    [connectSSE],
  );

  const joinRoom = useCallback(
    async (code: string, name: string) => {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlayerId(data.playerId);
      setPlayerName(data.playerName || name);
      connectSSE(data.code);
      return { code: data.code, playerId: data.playerId };
    },
    [connectSSE],
  );

  const ask = useCallback(
    async (code: string, question: string) => {
      if (!question.trim() || asking) return;
      setAsking(true);
      try {
        await fetch(`/api/rooms/${code}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, playerName }),
        });
      } catch { /* ignore network errors, SSE will handle updates */ }
      setTimeout(() => setAsking(false), 400);
    },
    [asking, playerName],
  );

  const guess = useCallback(
    async (code: string, guessText: string) => {
      if (!playerId || !guessText.trim()) return;
      try {
        const res = await fetch(`/api/rooms/${code}/guess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, guess: guessText }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        // SSE 也会发送 room:result，但这里也可以直接设置
        if (data.correct !== undefined) {
          setResult(data as GuessResult);
        }
      } catch (e) {
        // SSE 可能已推送，静默处理
      }
    },
    [playerId],
  );

  const leave = useCallback(
    async (code: string) => {
      if (playerId) {
        try {
          await fetch(`/api/rooms/${code}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId }),
          });
        } catch { /* ignore */ }
      }
      disconnectSSE();
      setRoom(null);
      setPlayerId(null);
      setResult(null);
      setSubmissionResult(null);
      setChatMessages([]);
    },
    [playerId, disconnectSSE],
  );

  const sendChat = useCallback(
    async (code: string, message: string) => {
      if (!message.trim() || !playerId) return;
      try {
        await fetch(`/api/rooms/${code}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, playerName, message: message.trim() }),
        });
      } catch { /* ignore */ }
    },
    [playerId, playerName],
  );

  const retryGuess = useCallback(
    async (code: string) => {
      if (!playerId) return;
      try {
        await fetch(`/api/rooms/${code}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
      } catch { /* ignore */ }
    },
    [playerId],
  );

  const endDiscussion = useCallback(
    async (code: string) => {
      if (!playerId) return;
      try {
        await fetch(`/api/rooms/${code}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
      } catch { /* ignore */ }
    },
    [playerId],
  );

  const submitDiscussion = useCallback(
    async (code: string, guessText: string) => {
      if (!playerId || !guessText.trim()) return;
      try {
        const res = await fetch(`/api/rooms/${code}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, guess: guessText }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.correct !== undefined) {
          setSubmissionResult(data as SubmissionResult);
        }
      } catch { /* ignore */ }
    },
    [playerId],
  );

  return {
    room,
    playerId,
    playerName,
    result,
    submissionResult,
    asking,
    chatMessages,
    createRoom,
    joinRoom,
    ask,
    guess,
    leave,
    sendChat,
    retryGuess,
    endDiscussion,
    submitDiscussion,
    clearResult: () => setResult(null),
    clearSubmissionResult: () => setSubmissionResult(null),
  };
}
