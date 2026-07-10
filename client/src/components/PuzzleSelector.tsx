import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { DifficultyPicker } from './DifficultyPicker';
import { api } from '../api';
import type { Difficulty, PublicPuzzle } from '../types/game';
import { DIFFICULTY_META } from '../types/game';

function formatDate(ts?: number): string {
  if (!ts) return '未知';
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface PuzzleSelectorProps {
  selectedId: string | null;
  randomChosen: boolean;
  onSelect: (id: string) => void;
  onRandom: () => void;
}

export function PuzzleSelector({ selectedId, randomChosen, onSelect, onRandom }: PuzzleSelectorProps) {
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const [puzzles, setPuzzles] = useState<PublicPuzzle[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // 平滑滚动进行中时忽略新的滚轮事件
      if (scrollingRef.current) return;
      e.preventDefault();

      const items = container.querySelectorAll<HTMLElement>('.snap-item');
      if (items.length === 0) return;

      // 找到当前最近的吸附项
      let currentIndex = 0;
      let minDist = Infinity;
      items.forEach((el, i) => {
        const dist = Math.abs(el.offsetTop - container.scrollTop);
        if (dist < minDist) {
          minDist = dist;
          currentIndex = i;
        }
      });

      const dir = e.deltaY > 0 ? 1 : -1;
      const target = Math.max(0, Math.min(items.length - 1, currentIndex + dir));

      scrollingRef.current = true;
      container.scrollTo({ top: items[target].offsetTop, behavior: 'smooth' });
    };

    const onScrollEnd = () => {
      scrollingRef.current = false;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('scrollend', onScrollEnd);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scrollend', onScrollEnd);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .listPuzzles(difficulty)
      .then(setPuzzles)
      .catch(() => setPuzzles([]))
      .finally(() => setLoading(false));
  }, [difficulty]);

  // 搜索过滤
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return puzzles;
    return puzzles.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (p.author && p.author.toLowerCase().includes(q)),
    );
  }, [puzzles, search]);

  return (
    <div className="w-full">
      {/* 难度筛选 + 搜索框 */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-sm text-white/50">难度筛选</span>
        <DifficultyPicker
          value={difficulty}
          onChange={(d: Difficulty) => setDifficulty(d)}
        />
        <div className="flex-1 min-w-[140px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索汤面…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/25 outline-none focus:border-neon-cyan/50 transition-colors"
          />
        </div>
      </div>

      {/* 已选状态 */}
      <div className="text-left text-sm text-white/50 mb-2">
        选择汤面{selectedId ? `：已选「${puzzles.find((p) => p.id === selectedId)?.title}」` : randomChosen ? '：随机汤面' : ''}
      </div>

      <div className="glass p-3">
        {/* 随机汤面 — 始终可见，固定位置 */}
        <button
          onClick={onRandom}
          className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-all ${
            randomChosen ? 'bg-neon-cyan/15 ring-1 ring-neon-cyan/60' : 'hover:bg-white/5'
          }`}
        >
          <div>
            <div className="font-semibold">🎲 随机汤面</div>
            <div className="text-xs text-white/50">由系统从当前难度随机抽题</div>
          </div>
          {randomChosen && <span className="text-neon-cyan">✓</span>}
        </button>

        {/* 分隔线 */}
        <div className="border-t border-white/10 my-2" />

        {/* 滚动列表：每次显示约 3 个汤面 */}
        <div
          ref={scrollRef}
          className="overflow-y-auto max-h-[210px] space-y-1.5 pr-1 custom-scrollbar"
        >
          {loading && (
            <div className="text-center text-white/40 py-8">加载题库…</div>
          )}
          {!loading && filtered.length === 0 && !search && (
            <div className="text-center text-white/40 py-8">该难度暂无题目</div>
          )}
          {!loading && filtered.length === 0 && search && (
            <div className="text-center text-white/40 py-8">无匹配结果</div>
          )}

          {filtered.map((p) => {
            const active = selectedId === p.id;
            const expanded = expandedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`snap-item rounded-xl px-4 py-3 transition-all cursor-pointer ${
                  active ? 'bg-neon-cyan/10 ring-1 ring-neon-cyan/60' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.title}</div>
                    <div className="text-xs text-white/50 truncate">
                      {p.author ?? '匿名'} · {p.tags.map((t) => `#${t}`).join(' ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="chip font-semibold"
                      style={{
                        color: DIFFICULTY_META[p.difficulty].color,
                        borderColor: DIFFICULTY_META[p.difficulty].color,
                      }}
                    >
                      {DIFFICULTY_META[p.difficulty].label}
                    </span>
                    {active && <span className="text-neon-cyan">✓</span>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expanded ? null : p.id);
                      }}
                      className="text-white/40 hover:text-white/80 px-1"
                      aria-label="展开发布日期"
                    >
                      {expanded ? '▾' : '▸'}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-2 text-xs text-white/40">
                    发布日期：{formatDate(p.createdAt)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
