import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import type { QAItem, PublicPuzzle } from '../types/game';
import { ANSWER_META } from '../types/game';
import { Button } from '../components/ui/Button';

interface ResultState {
  mode: 'solo' | 'multi' | 'discuss';
  puzzle?: PublicPuzzle;
  history: QAItem[];
  correct: boolean;
  feedback: string;
  solution?: string;
  playerGuess?: string;
  winnerName?: string;
  submitterName?: string;
}

export function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const data = state as ResultState | null;

  if (!data) return <Navigate to="/" replace />;

  const again = () => {
    if (data.mode === 'multi') navigate('/multi');
    else if (data.mode === 'discuss') navigate('/discuss');
    else navigate('/solo');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 animate-floatIn">
      <div className="text-center mb-6">
        <div className="text-xs tracking-[0.3em] text-white/40 mb-2">
          {data.mode === 'discuss'
            ? '多人推理 · 结算'
            : data.mode === 'multi'
              ? '多人竞速 · 结算'
              : '单人推理 · 结算'}
        </div>
        <h1
          className="text-2xl md:text-4xl font-display font-bold result-title"
          style={{ color: data.correct ? '#34d399' : '#fbbf24' }}
        >
          {data.correct
            ? '🎉 推理成功'
            : data.winnerName
              ? `${data.winnerName} 抢先猜中`
              : '真相揭晓'}
        </h1>
      </div>

      {data.puzzle && (
        <div className="glass p-4 md:p-5 mb-4 result-card">
          <h2 className="font-display font-semibold mb-2 text-sm md:text-base">{data.puzzle.title}</h2>
          <p className="text-white/70 text-sm mb-3">{data.puzzle.surface}</p>
        </div>
      )}

      {data.playerGuess && (
        <div className="glass p-4 md:p-5 mb-4 result-card" style={{ borderColor: '#a855f733' }}>
          <div className="text-sm text-white/50 mb-2">
            {data.mode === 'discuss'
              ? `团队提交的汤底（由 ${data.submitterName ?? '一人'} 代表提交）`
              : data.mode === 'multi'
                ? '玩家提交的汤底'
                : '你提交的汤底'}
          </div>
          <p className="text-base md:text-lg leading-relaxed text-neon-purple/90">{data.playerGuess}</p>
        </div>
      )}

      <div className="glass p-4 md:p-5 mb-4 result-card">
        <div className="text-sm text-white/50 mb-2">汤底（正确答案）</div>
        <p className="text-base md:text-lg leading-relaxed text-neon-cyan/90">{data.solution}</p>
      </div>

      {data.feedback && (
        <div className="glass p-4 mb-4 text-sm text-white/70 result-card">{data.feedback}</div>
      )}

      <div className="glass p-4 md:p-5 mb-6 result-card">
        <div className="text-sm text-white/50 mb-3">线索回放（{data.history.length} 条）</div>
        <div className="space-y-2">
          {data.history.map((qa, i) => {
            const m = ANSWER_META[qa.answer];
            return (
              <div key={qa.id} className="flex items-start gap-2 text-sm">
                <span className="text-white/30 w-6 text-right shrink-0">{i + 1}</span>
                <span
                  className="text-[10px] font-semibold px-1.5 rounded shrink-0 mt-0.5"
                  style={{ color: m.color, background: `${m.color}22` }}
                >
                  {m.label}
                </span>
                <span className="text-white/80 break-all">
                  {qa.question}
                  <span className="text-white/50"> — {qa.note}</span>
                </span>
              </div>
            );
          })}
          {data.history.length === 0 && (
            <div className="text-white/40 text-sm">本局没有提问记录。</div>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={again}>再来一局</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    </div>
  );
}
