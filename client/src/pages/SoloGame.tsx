import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSoloGame } from '../hooks/useSoloGame';
import { useGameStore } from '../store/gameStore';
import { PuzzleCard } from '../components/PuzzleCard';
import { ChatPanel } from '../components/ChatPanel';
import { RestorePanel } from '../components/RestorePanel';
import { PuzzleSelector } from '../components/PuzzleSelector';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

export function SoloGame() {
  const navigate = useNavigate();
  const difficulty = useGameStore((s) => s.difficulty);
  const {
    start,
    ask,
    revealHint,
    guess,
    puzzle,
    history,
    hints,
    questionsUsed,
    maxQuestions,
    questionsDepleted,
    accumulatedProgress,
    asking,
    streaming,
    sessionId,
  } = useSoloGame();

  const [step, setStep] = useState<'setup' | 'playing'>('setup');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [randomChosen, setRandomChosen] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  const [guessOpen, setGuessOpen] = useState(false);
  const [guessText, setGuessText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guessed, setGuessed] = useState(false);

  const handleStart = async () => {
    if ((!selectedId && !randomChosen) || startLoading) return;
    setStartLoading(true);
    try {
      await start(selectedId ?? undefined, difficulty);
      setStep('playing');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setStartLoading(false);
    }
  };

  const doGuess = async () => {
    if (!guessText.trim() || submitting || guessed) return;
    setSubmitting(true);
    try {
      const r = await guess(guessText);
      setGuessed(true);
      sessionStorage.removeItem('hgt_sessionId');
      navigate('/result', {
        state: {
          mode: 'solo',
          puzzle,
          history,
          correct: r.correct,
          feedback: r.feedback,
          solution: r.solution,
          playerGuess: guessText,
        },
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
      setGuessOpen(false);
    }
  };

  // ── setup 阶段：选题 ──
  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-display font-bold mb-2 neon-text">🕵️ 单人推理</h1>
        <p className="text-sm text-white/50 mb-6">
          选择一个汤面开始你的推理之旅。向 AI 主持人提出「是 / 否」类问题，在层层线索中推理出隐藏的真相。
        </p>


        <PuzzleSelector
          selectedId={selectedId}
          randomChosen={randomChosen}
          onSelect={(id) => {
            setSelectedId(id);
            setRandomChosen(false);
          }}
          onRandom={() => {
            setRandomChosen(true);
            setSelectedId(null);
          }}
        />

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            ← 返回首页
          </button>
          <button
            onClick={handleStart}
            disabled={(!selectedId && !randomChosen) || startLoading}
            className={`btn-neon text-base ${(!selectedId && !randomChosen) || startLoading ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {startLoading ? '加载中…' : '开始推理 →'}
          </button>
        </div>
      </div>
    );
  }

  // ── playing 阶段：游戏主界面 ──
  if (!puzzle) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center text-white/50">
        正在唤醒主持人…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 h-[calc(100vh-4.5rem)] flex flex-col">
      {/* 桌面端：双栏布局 / 移动端：单列 */}
      <div className="hidden md:grid lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="flex flex-col min-h-0 overflow-y-auto pr-1 space-y-4 game-left">
          <PuzzleCard puzzle={puzzle} />
          {hints.length > 0 && (
            <div className="glass p-3">
              <div className="text-xs text-white/50 mb-2">已揭示的提示</div>
              <ul className="space-y-1.5">
                {hints.map((h, i) => (
                  <li key={i} className="text-sm text-neon-cyan/90 flex gap-2">
                    <span className="text-white/40">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="min-h-[200px] flex-1">
            <RestorePanel
              hints={hints}
              questionsUsed={questionsUsed}
              maxQuestions={maxQuestions}
              accumulatedProgress={accumulatedProgress}
            />
          </div>
        </div>

        <div className="game-right min-h-0">
          <ChatPanel
            history={history}
            streaming={streaming}
            asking={asking}
            questionsUsed={questionsUsed}
            maxQuestions={maxQuestions}
            onAsk={ask}
            onHint={revealHint}
            onReveal={() => setGuessOpen(true)}
            disabled={questionsDepleted}
            revealDisabled={guessed}
          />
        </div>
      </div>

      {/* 移动端：单列布局，ChatPanel 在底部 */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 game-grid">
        <div className="game-right flex-none" style={{ maxHeight: '50vh' }}>
          <ChatPanel
            history={history}
            streaming={streaming}
            asking={asking}
            questionsUsed={questionsUsed}
            maxQuestions={maxQuestions}
            onAsk={ask}
            onHint={revealHint}
            onReveal={() => setGuessOpen(true)}
            disabled={questionsDepleted}
            revealDisabled={guessed}
          />
        </div>
        <div className="game-left flex-1 overflow-y-auto space-y-3 mt-3">
          <PuzzleCard puzzle={puzzle} />
          {hints.length > 0 && (
            <div className="glass p-3">
              <div className="text-xs text-white/50 mb-2">已揭示的提示</div>
              <ul className="space-y-1.5">
                {hints.map((h, i) => (
                  <li key={i} className="text-sm text-neon-cyan/90 flex gap-2">
                    <span className="text-white/40">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <RestorePanel
            hints={hints}
            questionsUsed={questionsUsed}
            maxQuestions={maxQuestions}
            accumulatedProgress={accumulatedProgress}
          />
        </div>
      </div>

      <Modal open={guessOpen} onClose={() => setGuessOpen(false)} title="提交你的推理 / 揭晓汤底">
        <p className="text-sm text-white/60 mb-3">
          写下你认为的完整真相。主持人会判定你是否猜中；猜中即揭晓，未中也会给反馈。
        </p>
        <textarea
          value={guessText}
          onChange={(e) => setGuessText(e.target.value)}
          rows={4}
          placeholder="例如：这个男人是绝症晚期，主动走进海里结束生命……"
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-neon-cyan/50 resize-none"
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" onClick={() => setGuessOpen(false)}>
            取消
          </Button>
          <Button onClick={doGuess} disabled={!guessText.trim() || submitting}>
            {submitting ? '判定中…' : '提交'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
