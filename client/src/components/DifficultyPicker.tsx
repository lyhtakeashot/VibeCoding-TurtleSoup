import type { Difficulty } from '../types/game';
import { DIFFICULTY_META } from '../types/game';

const ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'unlimited'];

export type FilterMode = 'all' | Difficulty;

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: FilterMode;
  onChange: (d: FilterMode) => void;
}) {
  return (
    <div className="flex gap-2">
      {/* 全选 */}
      <button
        onClick={() => onChange('all')}
        className={`chip transition-all ${
          value === 'all' ? 'border-transparent text-ink-900 font-semibold' : 'hover:bg-white/10'
        }`}
        style={value === 'all' ? { background: '#a78bfa' } : undefined}
      >
        全选
      </button>

      {ORDER.map((d) => {
        const meta = DIFFICULTY_META[d];
        const active = value === d;
        const isUnlimited = d === 'unlimited';

        // 不限问：深渊压迫特殊样式（仅在选中后触发）
        if (isUnlimited) {
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={`unlimited-chip chip inline-flex items-center gap-1 transition-all ${
                active
                  ? 'active scale-105 font-bold text-red-300'
                  : 'hover:bg-white/10'
              }`}
              style={active ? {
                background: 'linear-gradient(180deg, #1a0505 0%, #0f0101 100%)',
                border: '1.5px solid rgba(220, 38, 38, 0.45)',
                paddingLeft: '0.875rem',
                paddingRight: '0.875rem',
                paddingTop: '0.375rem',
                paddingBottom: '0.375rem',
              } : undefined}
            >
              <span className={active ? 'relative z-10 text-lg leading-none' : ''}>
                {meta.label}
              </span>
              <span className={
                active
                  ? 'relative z-10 text-[10px] text-red-400/70 tracking-wider'
                  : 'text-[10px] text-white/40'
              }>
                不限问
              </span>
            </button>
          );
        }

        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`chip transition-all ${
              active ? 'border-transparent text-ink-900 font-semibold' : 'hover:bg-white/10'
            }`}
            style={active ? { background: meta.color } : undefined}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
