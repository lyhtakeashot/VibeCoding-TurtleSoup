import { useState } from 'react';
import { api } from '../api';
import type { Difficulty, SubmissionInput } from '../types/game';
import { DIFFICULTY_META } from '../types/game';
import { Button } from './ui/Button';

interface PuzzleDraft {
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  tags: string;
  hints: string[];
  author: string;
  expanded: boolean;
}

function puzzleToDraft(p: SubmissionInput): PuzzleDraft {
  return {
    title: p.title || '',
    surface: p.surface || '',
    solution: p.solution || '',
    difficulty: p.difficulty || 'medium',
    tags: (p.tags || []).join(', '),
    hints: p.hints || [],
    author: p.author || '',
    expanded: false,
  };
}

function draftToInput(d: PuzzleDraft): SubmissionInput {
  return {
    title: d.title.trim(),
    surface: d.surface.trim(),
    solution: d.solution.trim(),
    difficulty: d.difficulty,
    tags: d.tags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean),
    hints: d.hints.map((h) => h.trim()).filter(Boolean),
    author: d.author.trim() || '匿名作者',
  };
}

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-neon-cyan/50';

export function BatchSubmitPanel() {
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [puzzles, setPuzzles] = useState<PuzzleDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResults, setSubmitResults] = useState<{ idx: number; ok: boolean; title: string; error?: string }[]>([]);

  const handleParse = async () => {
    const t = rawText.trim();
    if (!t || parsing) return;
    setParsing(true);
    setSubmitResults([]);
    try {
      const { puzzles: parsed } = await api.batchParse(t);
      if (parsed.length === 0) {
        alert('未解析出任何题目，请检查文本格式后重试。');
        return;
      }
      setPuzzles(parsed.map(puzzleToDraft));
    } catch (e) {
      alert((e as Error).message || 'AI 解析失败，请稍后重试');
    } finally {
      setParsing(false);
    }
  };

  const toggleExpand = (idx: number) => {
    setPuzzles((arr) =>
      arr.map((p, i) => (i === idx ? { ...p, expanded: !p.expanded } : p)),
    );
  };

  const updatePuzzle = (idx: number, patch: Partial<PuzzleDraft>) => {
    setPuzzles((arr) => arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removePuzzle = (idx: number) => {
    setPuzzles((arr) => arr.filter((_, i) => i !== idx));
  };

  // hint helpers for a single puzzle
  const addHint = (pIdx: number, h: string) => {
    if (!h.trim()) return;
    updatePuzzle(pIdx, { hints: [...puzzles[pIdx].hints, h.trim()] });
  };
  const removeHint = (pIdx: number, hIdx: number) =>
    updatePuzzle(pIdx, {
      hints: puzzles[pIdx].hints.filter((_, i) => i !== hIdx),
    });

  const handleSubmitAll = async () => {
    if (submitting) return;
    setSubmitting(true);
    const results: typeof submitResults = [];
    for (let i = 0; i < puzzles.length; i++) {
      const input = draftToInput(puzzles[i]);
      if (!input.surface || !input.solution) {
        results.push({ idx: i, ok: false, title: input.title || `题目${i + 1}`, error: '汤面或汤底为空' });
        continue;
      }
      try {
        await api.submitPuzzle(input);
        results.push({ idx: i, ok: true, title: input.title || `题目${i + 1}` });
      } catch (e) {
        results.push({ idx: i, ok: false, title: input.title || `题目${i + 1}`, error: (e as Error).message });
      }
    }
    setSubmitResults(results);
    setSubmitting(false);
  };

  const [hintInputs, setHintInputs] = useState<Record<number, string>>({});

  const submitCount = submitResults.filter((r) => r.ok).length;
  const allDone = submitResults.length > 0 && submitResults.length === puzzles.length;

  if (allDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-2xl font-display font-bold neon-text mb-2">
          批量提交完成
        </h1>
        <p className="text-white/60 mb-2">
          成功提交 {submitCount}/{puzzles.length} 道题目
        </p>
        {submitResults.some((r) => !r.ok) && (
          <div className="text-left glass p-3 mb-4 max-h-40 overflow-y-auto">
            {submitResults
              .filter((r) => !r.ok)
              .map((r) => (
                <p key={r.idx} className="text-sm text-neon-pink/80">
                  ❌ {r.title}: {r.error || '失败'}
                </p>
              ))}
          </div>
        )}
        <p className="text-white/40 text-sm">
          审核通过后将并选题库
        </p>
      </div>
    );
  }

  const TAG_SUGGESTIONS = ['悬疑', '反转', '温情', '脑洞', '微恐', '推理', '日常', '诡异', '校园', '都市'];

  return (
    <div className="space-y-6">
      {/* 输入区域 */}
      <div className="glass p-5 space-y-4">
        <div>
          <label className="text-sm text-white/60">
            输入多道海龟汤，系统自动编号
          </label>
          <p className="text-xs text-white/30 mb-2">
            每道题以「题目」开头，依次填写汤面、汤底。AI 将补全标题、难度、标签和提示，之后可微调。
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            placeholder={`题目\n汤面：一个男人去超市买了些东西，回家路上被警察拦下，他主动说了几句话就被逮捕了。\n汤底：这个男人说的那几句话原本是银行劫匪的内部暗号，他说出口后被便衣警察认出。\n\n题目\n汤面：一个女人每天路过同一棵树都会笑，为什么？\n汤底：那棵树上挂着邻居的内衣，她觉得这场景很滑稽。`}
            className={`${inputCls} resize-y min-h-[180px]`}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleParse} disabled={!rawText.trim() || parsing}>
            {parsing ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-neon-cyan rounded-full animate-spin" />
                AI 解析中...
              </span>
            ) : (
              '🧠 AI 智能解析'
            )}
          </Button>
          <span className="text-xs text-white/30">
            {puzzles.length > 0 ? `已解析 ${puzzles.length} 道题` : ''}
          </span>
        </div>
      </div>

      {/* 解析结果 */}
      {puzzles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold neon-text">
              解析结果（{puzzles.length} 题）
            </h2>
            <div className="flex gap-2">
              <Button onClick={handleSubmitAll} disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    提交中...
                  </span>
                ) : (
                  '全部提交审核'
                )}
              </Button>
            </div>
          </div>

          {puzzles.map((puzzle, pIdx) => (
            <div key={pIdx} className="glass p-4">
              {/* 卡片头部 - 可点击展开 */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(pIdx)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-neon-cyan text-sm">
                      {puzzle.expanded ? '▼' : '▶'}
                    </span>
                    <span className="font-semibold truncate">
                      {puzzle.title || `题目 ${pIdx + 1}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                      {DIFFICULTY_META[puzzle.difficulty]?.label || puzzle.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-1 truncate ml-6">
                    {puzzle.tags || '无标签'} · 汤面: {puzzle.surface.slice(0, 30)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {submitResults.find((r) => r.idx === pIdx)?.ok && (
                    <span className="text-green-400 text-xs">已提交</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePuzzle(pIdx);
                    }}
                    className="text-neon-pink/60 hover:text-neon-pink text-sm"
                    title="移除此题"
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* 展开编辑区 */}
              {puzzle.expanded && (
                <div className="mt-4 pl-6 space-y-3 border-l-2 border-neon-cyan/20">
                  {/* 标题 */}
                  <div>
                    <label className="text-xs text-white/40">标题</label>
                    <input
                      value={puzzle.title}
                      onChange={(e) => updatePuzzle(pIdx, { title: e.target.value })}
                      placeholder="输入标题（10字以内）"
                      className={`${inputCls} mt-1`}
                    />
                  </div>

                  {/* 汤面 */}
                  <div>
                    <label className="text-xs text-white/40">汤面（谜题描述）*</label>
                    <textarea
                      value={puzzle.surface}
                      onChange={(e) => updatePuzzle(pIdx, { surface: e.target.value })}
                      rows={2}
                      className={`${inputCls} mt-1 resize-none`}
                    />
                  </div>

                  {/* 汤底 */}
                  <div>
                    <label className="text-xs text-white/40">汤底（真相）*</label>
                    <textarea
                      value={puzzle.solution}
                      onChange={(e) => updatePuzzle(pIdx, { solution: e.target.value })}
                      rows={2}
                      className={`${inputCls} mt-1 resize-none`}
                    />
                  </div>

                  {/* 难度 + 作者 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40">难度</label>
                      <select
                        value={puzzle.difficulty}
                        onChange={(e) => updatePuzzle(pIdx, { difficulty: e.target.value as Difficulty })}
                        className={`${inputCls} mt-1`}
                      >
                        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                          <option key={d} value={d}>
                            {DIFFICULTY_META[d].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/40">作者名</label>
                      <input
                        value={puzzle.author}
                        onChange={(e) => updatePuzzle(pIdx, { author: e.target.value })}
                        placeholder="匿名作者"
                        className={`${inputCls} mt-1`}
                      />
                    </div>
                  </div>

                  {/* 标签 */}
                  <div>
                    <label className="text-xs text-white/40">标签</label>
                    <input
                      value={puzzle.tags}
                      onChange={(e) => updatePuzzle(pIdx, { tags: e.target.value })}
                      placeholder="悬疑, 反转, 温情"
                      className={`${inputCls} mt-1`}
                    />
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {TAG_SUGGESTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            const current = puzzle.tags
                              .split(/[,，\s]+/)
                              .map((x) => x.trim())
                              .filter(Boolean);
                            if (current.includes(t)) return;
                            const next = [...current, t].join(', ');
                            updatePuzzle(pIdx, { tags: next });
                          }}
                          className="text-xs px-2 py-0.5 rounded bg-white/5 hover:bg-neon-cyan/10 text-white/50 hover:text-neon-cyan transition-colors"
                        >
                          +{t}
                        </button>
                      ))}
                    </div>
                  </div>


                  {/* 渐进提示 */}
                  <div>
                    <label className="text-xs text-white/40">渐进提示</label>
                    <div className="flex gap-1 mt-1">
                      <input
                        value={hintInputs[pIdx] || ''}
                        onChange={(e) =>
                          setHintInputs((s) => ({ ...s, [pIdx]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (hintInputs[pIdx] || '').trim()) {
                            addHint(pIdx, hintInputs[pIdx] || '');
                            setHintInputs((s) => ({ ...s, [pIdx]: '' }));
                          }
                        }}
                        placeholder="输入提示后回车"
                        className={inputCls}
                      />
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if ((hintInputs[pIdx] || '').trim()) {
                            addHint(pIdx, hintInputs[pIdx] || '');
                            setHintInputs((s) => ({ ...s, [pIdx]: '' }));
                          }
                        }}
                      >
                        加
                      </Button>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {puzzle.hints.map((h, hIdx) => (
                        <li key={hIdx} className="text-xs text-neon-cyan/70 flex justify-between">
                          <span>
                            {hIdx + 1}. {h}
                          </span>
                          <button onClick={() => removeHint(pIdx, hIdx)} className="text-white/30 hover:text-neon-pink">
                            删
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
