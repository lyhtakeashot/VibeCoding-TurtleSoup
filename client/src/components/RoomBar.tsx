import { useState } from 'react';
import type { RoomState } from '../types/game';

export function RoomBar({
  room,
  playerId,
}: {
  room: RoomState;
  playerId: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：静默失败，用户可手动选中复制
    }
  };

  const pct = Math.min(100, Math.round((room.questionsUsed / room.maxQuestions) * 100));
  return (
    <div className="glass px-4 py-3 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-sm">房间码</span>
        <span className="font-mono text-lg font-bold tracking-widest neon-text">{room.code}</span>
        <button
          onClick={handleCopy}
          className={`text-xs transition-colors ${copied ? 'text-neon-cyan' : 'text-white/50 hover:text-white/80'}`}
          title="复制房间码"
        >
          {copied ? '已复制 ✓' : '复制'}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-[160px]">
        <span className="text-white/50 text-sm">进度</span>
        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-white/50">
          {room.questionsUsed}/{room.maxQuestions}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {room.players.map((p) => (
          <span
            key={p.id}
            className={`chip flex items-center gap-1 ${
              p.id === playerId ? 'border-neon-cyan/60' : ''
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.solved ? '#34d399' : 'rgba(255,255,255,0.4)' }}
            />
            {p.name}
            {p.ended && <span className="text-answer-yes text-xs">✓</span>}
            {p.isWinner && <span className="text-answer-yes text-xs">👑</span>}
          </span>
        ))}
      </div>

      {room.finished && (
        <span className="chip border-neon-pink/60 text-neon-pink">本局已结束</span>
      )}
    </div>
  );
}
