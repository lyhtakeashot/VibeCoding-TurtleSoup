import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../socket';
import type { RoomState, QAItem, RoomSubmission, ChatMessage } from '../types/game';

export function useDiscussGame() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<RoomSubmission | null>(null);
  const [asking, setAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onState = (s: RoomState) => setRoom(s);
    const onQA = (qa: QAItem) =>
      setRoom((r) => (r ? { ...r, history: [...r.history, qa], questionsUsed: r.history.length + 1 } : r));
    const onSubmission = (sub: RoomSubmission) => setSubmission(sub);
    const onChat = (msg: ChatMessage) => setChatMessages((prev) => [...prev, msg]);

    socket.on('room:state', onState);
    socket.on('room:qa', onQA);
    socket.on('room:submission', onSubmission);
    socket.on('room:chat', onChat);

    return () => {
      socket.off('room:state', onState);
      socket.off('room:qa', onQA);
      socket.off('room:submission', onSubmission);
      socket.off('room:chat', onChat);
    };
  }, []);

  const createRoom = useCallback(
    (puzzleId: string, name: string) =>
      new Promise<{ code: string; playerId: string }>((resolve, reject) => {
        const socket = getSocket();
        socket.emit('room:create', { puzzleId, name, mode: 'discuss' }, (r: any) => {
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

  /** 切换「结束讨论」状态 */
  const end = useCallback((code: string) => {
    if (!playerId) return;
    getSocket().emit('room:end', { code, playerId });
  }, [playerId]);

  /** 团队统一提交汤底（仅共识后由一人提交一次） */
  const submit = useCallback((code: string, guessText: string) => {
    if (!playerId || !guessText.trim()) return;
    getSocket().emit('room:submit', { code, playerId, guess: guessText });
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
    submission,
    asking,
    chatMessages,
    createRoom,
    joinRoom,
    ask,
    end,
    submit,
    leave,
    sendChat,
    clearSubmission: () => setSubmission(null),
  };
}
