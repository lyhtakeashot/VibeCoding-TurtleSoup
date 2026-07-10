import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../socket';
import type { RoomState, QAItem, ChatMessage } from '../types/game';

export function useMultiGame() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    playerId: string;
    correct: boolean;
    feedback: string;
    winnerId: string | null;
    solution?: string;
    playerGuess?: string;
  } | null>(null);
  const [asking, setAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onState = (s: RoomState) => setRoom(s);
    const onQA = (qa: QAItem) =>
      setRoom((r) => (r ? { ...r, history: [...r.history, qa], questionsUsed: r.history.length + 1 } : r));
    const onResult = (res: any) => setResult(res);
    const onChat = (msg: ChatMessage) => setChatMessages((prev) => [...prev, msg]);

    socket.on('room:state', onState);
    socket.on('room:qa', onQA);
    socket.on('room:result', onResult);
    socket.on('room:chat', onChat);

    return () => {
      socket.off('room:state', onState);
      socket.off('room:qa', onQA);
      socket.off('room:result', onResult);
      socket.off('room:chat', onChat);
    };
  }, []);

  const createRoom = useCallback(
    (puzzleId: string, name: string) =>
      new Promise<{ code: string; playerId: string }>((resolve, reject) => {
        const socket = getSocket();
        socket.emit('room:create', { puzzleId, name }, (r: any) => {
          if (r?.error) return reject(new Error(r.error));
          setPlayerId(r.playerId);
          resolve({ code: r.code, playerId: r.playerId });
        });
      }),
    [],
  );

  const joinRoom = useCallback(
    (code: string, name: string) =>
      new Promise<{ code: string; playerId: string }>((resolve, reject) => {
        const socket = getSocket();
        socket.emit('room:join', { code, name }, (r: any) => {
          if (r?.error) return reject(new Error(r.error));
          setPlayerId(r.playerId);
          resolve({ code: r.code, playerId: r.playerId });
        });
      }),
    [],
  );

  const ask = useCallback((code: string, question: string) => {
    if (!question.trim() || asking) return;
    setAsking(true);
    getSocket().emit('room:ask', { code, question });
    setTimeout(() => setAsking(false), 400);
  }, [asking]);

  const guess = useCallback((code: string, guessText: string) => {
    if (!playerId || !guessText.trim()) return;
    getSocket().emit('room:guess', { code, playerId, guess: guessText });
  }, [playerId]);

  const leave = useCallback((code: string) => {
    if (playerId) getSocket().emit('room:leave', { code, playerId });
  }, [playerId]);

  const sendChat = useCallback((code: string, message: string) => {
    if (!message.trim()) return;
    getSocket().emit('room:chat', { code, message: message.trim() });
  }, []);

  return {
    room,
    playerId,
    result,
    asking,
    chatMessages,
    createRoom,
    joinRoom,
    ask,
    guess,
    leave,
    sendChat,
    clearResult: () => setResult(null),
  };
}
