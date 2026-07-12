import { useEffect, useRef, useState } from 'react';
import type { QAItem } from '../types/game';
import { ANSWER_META } from '../types/game';
import type { StreamingState } from '../hooks/useSoloGame';
import { Button } from './ui/Button';

function AnswerTag({ answer }: { answer: QAItem['answer'] }) {
  const m = ANSWER_META[answer];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-md"
      style={{ color: m.color, background: `${m.color}22`, border: `1px solid ${m.color}55` }}
    >
      {m.label}
    </span>
  );
}

function SourceBadge({ source }: { source?: QAItem['source'] }) {
  if (!source) return null;
  const config: Record<string, { label: string; color: string }> = {
    rule: { label: '规则', color: '#a487ff' },
    ai: { label: 'AI', color: '#34d399' },
    fallback: { label: '兜底', color: '#fbbf24' },
  };
  const c = config[source];
  if (!c) return null;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-px rounded ml-1"
      style={{ color: c.color, background: `${c.color}18`, border: `1px solid ${c.color}40` }}
    >
      {c.label}
    </span>
  );
}

interface Props {
  history: QAItem[];
  streaming: StreamingState | null;
  asking: boolean;
  questionsUsed: number;
  maxQuestions: number;
  onAsk: (q: string) => void;
  onHint: () => void;
  onReveal: () => void;
  disabled?: boolean;
  revealDisabled?: boolean;
  placeholder?: string;
  /** 多人模式下隐藏「要提示」按钮 */
  hideHint?: boolean;
}

export function ChatPanel({
  history,
  streaming,
  asking,
  questionsUsed,
  maxQuestions,
  onAsk,
  onHint,
  onReveal,
  disabled,
  revealDisabled = false,
  placeholder = '问一个「是/否」类问题，例如：凶手是张三吗？',
  hideHint = false,
}: Props) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const submit = () => {
    const q = text.trim();
    if (!q || asking || disabled) return;
    onAsk(q);
    setText('');
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [history, streaming]);

  const pct = Math.min(100, Math.round((questionsUsed / maxQuestions) * 100));
  const reached = questionsUsed >= maxQuestions;

  return (
    <div className="glass flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-sm text-white/70">推理对话</span>
        <span className="text-xs text-white/50">
          提问 {questionsUsed}/{maxQuestions}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 chat-scrollbar">
        {history.length === 0 && !streaming && (
          <div className="text-center text-white/40 text-sm mt-8">
            还没有提问，向主持人抛出你的第一个「是/否」问题吧。
          </div>
        )}

        {history.map((qa) => (
          <div key={qa.id} className="animate-floatIn">
            <div className="text-right">
              <span className="inline-block bg-white/10 rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
                {qa.playerName && (
                  <span className="text-xs text-neon-purple/70 block">{qa.playerName}</span>
                )}
                {qa.question}
              </span>
            </div>
            <div className="flex items-start gap-2 mt-1">
              <AnswerTag answer={qa.answer} />
              <SourceBadge source={qa.source} />
              <span className="text-sm text-white/85 leading-relaxed">{qa.note}</span>
            </div>
          </div>
        ))}

        {streaming && (
          <div className="animate-floatIn">
            <div className="text-right">
              <span className="inline-block opacity-0">.</span>
            </div>
            <div className="flex items-start gap-2 mt-1">
              <AnswerTag answer={streaming.answer} />
              <span className="text-sm text-white/85 leading-relaxed">
                {streaming.note}
                <span className="inline-block w-1.5 h-4 bg-neon-cyan ml-0.5 animate-pulse" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="p-3 border-t border-white/10 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={disabled || asking}
          placeholder={placeholder}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-neon-cyan/50 disabled:opacity-50"
        />
        <Button onClick={submit} disabled={disabled || asking || !text.trim()}>
          {asking ? '…' : '提问'}
        </Button>
      </div>

      <div className="px-3 pb-3 flex gap-2">
        {!hideHint && (
          <Button variant="ghost" onClick={onHint} disabled={disabled || asking} className="text-sm">
            要提示
          </Button>
        )}
        <Button
          variant={reached ? 'neon' : 'ghost'}
          onClick={onReveal}
          disabled={revealDisabled}
          className="text-sm flex-1"
        >
          {reached ? '已达上限 · 提交推理 / 揭晓' : '提交推理 / 揭晓'}
        </Button>
      </div>
    </div>
  );
}
