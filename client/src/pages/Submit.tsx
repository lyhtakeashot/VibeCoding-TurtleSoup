import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Difficulty } from '../types/game';
import { DIFFICULTY_META } from '../types/game';
import { Button } from '../components/ui/Button';
import { BatchSubmitPanel } from '../components/BatchSubmitPanel';

export function Submit() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [title, setTitle] = useState('');
  const [surface, setSurface] = useState('');
  const [solution, setSolution] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [hintInput, setHintInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!surface.trim() || !solution.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.submitPuzzle({
        title: title.trim(),
        surface: surface.trim(),
        solution: solution.trim(),
        difficulty,
        author: author.trim(),
        tags: tags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean),
        hints: hints.map((h) => h.trim()).filter(Boolean),
      });
      setDone(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 批量模式
  if (mode === 'batch') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-display font-bold neon-text">投稿海龟汤</h1>
          <div className="glass p-0.5 flex rounded-lg text-sm">
            <button
              onClick={() => setMode('single')}
              className="px-3 py-1 rounded-md text-white/50 hover:text-white transition-colors"
            >
              单题投稿
            </button>
            <button
              className="px-3 py-1 rounded-md bg-neon-cyan/20 text-neon-cyan"
            >
              批量投稿
            </button>
          </div>
        </div>
        <BatchSubmitPanel />
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={() => navigate('/')}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-2xl font-display font-bold neon-text mb-2">已进入审核</h1>
        <p className="text-white/60 mb-6">
          感谢投稿！管理员审核通过后，你的海龟汤会出现在题库里，所有人都能玩到。
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/')}>返回首页</Button>
          <Button variant="ghost" onClick={() => { setDone(false); setSurface(''); setSolution(''); setHints([]); }}>
            再投一个
          </Button>
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-neon-cyan/50';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-1">
        <h1 className="text-3xl font-display font-bold neon-text">投稿海龟汤</h1>
        <div className="glass p-0.5 flex rounded-lg text-sm">
          <button
            className="px-3 py-1 rounded-md bg-neon-cyan/20 text-neon-cyan"
          >
            单题投稿
          </button>
          <button
            onClick={() => setMode('batch')}
            className="px-3 py-1 rounded-md text-white/50 hover:text-white transition-colors"
          >
            批量投稿
          </button>
        </div>
      </div>
      <p className="text-white/50 text-sm mb-6">分享你的情境推理题目，审核通过即并入题库。</p>

      <div className="glass p-5 space-y-4">
        <div>
          <label className="text-sm text-white/60">标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="简短标题，如：餐厅谜案（留空则取汤面前14字）"
            className={`${inputCls} mt-1`}
          />
        </div>

        <div>
          <label className="text-sm text-white/60">汤面（谜题描述）*</label>
          <textarea
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            rows={3}
            placeholder="描述一个悬念场景，例如：一个人走进餐厅，却……"
            className={`${inputCls} mt-1 resize-none`}
          />
        </div>

        <div>
          <label className="text-sm text-white/60">汤底（真相）*</label>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            rows={3}
            placeholder="解释背后发生的真实故事"
            className={`${inputCls} mt-1 resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-white/60">难度</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className={`${inputCls} mt-1`}
            >
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_META[d].label}（{DIFFICULTY_META[d].max}问）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/60">作者名</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="匿名作者"
              className={`${inputCls} mt-1`}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">标签（逗号分隔）</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="悬疑, 反转, 温情"
            className={`${inputCls} mt-1`}
          />
        </div>

        <div>
          <label className="text-sm text-white/60">渐进提示（可选）</label>
          <div className="flex gap-2 mt-1">
            <input
              value={hintInput}
              onChange={(e) => setHintInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hintInput.trim()) {
                  setHints((h) => [...h, hintInput.trim()]);
                  setHintInput('');
                }
              }}
              placeholder="输入一条提示后回车"
              className={inputCls}
            />
            <Button
              variant="ghost"
              onClick={() => {
                if (hintInput.trim()) {
                  setHints((h) => [...h, hintInput.trim()]);
                  setHintInput('');
                }
              }}
            >
              加
            </Button>
          </div>
          <ul className="mt-2 space-y-1">
            {hints.map((h, i) => (
              <li key={i} className="text-sm text-neon-cyan/80 flex justify-between">
                <span>
                  {i + 1}. {h}
                </span>
                <button
                  onClick={() => setHints((arr) => arr.filter((_, idx) => idx !== i))}
                  className="text-white/40 hover:text-neon-pink"
                >
                  删
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => navigate('/')}>
            取消
          </Button>
          <Button onClick={submit} disabled={!surface.trim() || !solution.trim() || submitting}>
            {submitting ? '提交中…' : '提交审核'}
          </Button>
        </div>
      </div>
    </div>
  );
}
