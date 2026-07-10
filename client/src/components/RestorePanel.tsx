interface Props {
  hints: string[];
  questionsUsed: number;
  maxQuestions: number;
  accumulatedProgress: number;
}

export function RestorePanel({ hints, questionsUsed, maxQuestions, accumulatedProgress }: Props) {
  const remaining = maxQuestions - questionsUsed;
  const ratio = Math.min(100, Math.round(accumulatedProgress));
  const visible = true;

  return (
    <div className="glass p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/70">故事还原度</span>
        <span className="text-xs text-neon-cyan font-semibold">
          剩余 {Math.max(0, remaining)} 次提问
        </span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-3xl font-bold text-white">{ratio}%</span>
        <span className="text-xs text-white/40 mb-1">还原度</span>
      </div>

      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>

      {hints.length > 0 && (
        <>
          <div className="text-xs text-white/50 mb-1.5">
            已揭示提示（{hints.length}）
          </div>
          <ul className="space-y-1.5 overflow-auto pr-1 flex-1">
            {hints.map((s, i) => (
              <li key={i} className="text-sm text-neon-cyan/90 flex gap-2">
                <span className="text-white/30">✦</span>
                {s}
              </li>
            ))}
          </ul>
        </>
      )}

      {hints.length === 0 && (
        <p className="text-xs text-white/40">
          遇到困难可以点击「提示」按钮，主持人会给你一些线索。
        </p>
      )}
    </div>
  );
}
