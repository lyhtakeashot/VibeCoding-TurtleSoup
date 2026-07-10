import type { Difficulty } from '../types/game';
import { DIFFICULTY_META } from '../types/game';

const ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  return (
    <div className="flex gap-2">
      {ORDER.map((d) => {
        const meta = DIFFICULTY_META[d];
        const active = value === d;
        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`chip transition-all ${
              active ? 'border-transparent text-ink-900 font-semibold' : 'hover:bg-white/10'
            }`}
            style={active ? { background: meta.color } : undefined}
          >
            {meta.label} · {meta.max}问
          </button>
        );
      })}
    </div>
  );
}
