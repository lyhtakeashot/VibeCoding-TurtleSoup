import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types/game';

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** 给不同玩家分配稳定的颜色 */
function playerColor(name: string) {
  const colors = [
    '#34d399', '#60a5fa', '#fbbf24', '#f87171',
    '#a78bfa', '#fb923c', '#22d3ee', '#e879f9',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

interface Props {
  messages: ChatMessage[];
  playerId: string | null;
  onSend: (msg: string) => void;
  disabled?: boolean;
}

export function ChatSidebar({ messages, playerId, onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="glass flex flex-col h-[320px] min-h-0">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-sm text-white/70">队友讨论</span>
        <span className="text-xs text-white/40">{messages.length} 条消息</span>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-white/40 text-sm mt-8">
            暂无消息，快和队友打个招呼吧 👋
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.fromId === playerId;
          return (
            <div key={msg.id} className={`animate-floatIn ${isMe ? 'flex flex-col items-end' : ''}`}>
              {/* 发送者名称 */}
              <span
                className="text-[11px] font-medium mb-0.5 block"
                style={{ color: isMe ? '#34d399' : playerColor(msg.from) }}
              >
                {isMe ? '我' : msg.from}
              </span>

              {/* 气泡 */}
              <div className="flex items-end gap-1.5">
                {!isMe && (
                  <span className="text-[10px] text-white/30 opacity-0 group-hover:opacity-100">
                    {formatTime(msg.timestamp)}
                  </span>
                )}
                <span
                  className={`inline-block rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                    isMe
                      ? 'bg-neon-cyan/20 rounded-tr-sm text-white/90'
                      : 'bg-white/10 rounded-tl-sm text-white/80'
                  }`}
                >
                  {msg.message}
                </span>
                {isMe && (
                  <span className="text-[10px] text-white/30">{formatTime(msg.timestamp)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 输入区域 */}
      <div className="p-3 border-t border-white/10 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={disabled}
          placeholder="和队友讨论推理思路..."
          maxLength={500}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-neon-purple/50 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-neon-purple/30 hover:bg-neon-purple/50 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </div>
  );
}
