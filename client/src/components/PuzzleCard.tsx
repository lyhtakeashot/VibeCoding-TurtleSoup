import { useState } from 'react';
import type { PublicPuzzle } from '../types/game';
import { DIFFICULTY_META } from '../types/game';

export function puzzleImage(id: string): string {
  return `/images/${id}.png`;
}

export function PuzzleCard({ puzzle }: { puzzle: PublicPuzzle }) {
  const [imgOk, setImgOk] = useState(true);
  const meta = DIFFICULTY_META[puzzle.difficulty];
  const isSubmission = puzzle.id.startsWith('sub_');
  return (
    <div className="glass relative overflow-hidden p-5">
      {imgOk && !isSubmission && (
        <img
          src={puzzleImage(puzzle.id)}
          alt=""
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-[2px] pointer-events-none"
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="chip font-semibold"
            style={{ color: meta.color, borderColor: meta.color }}
          >
            {meta.label}
          </span>
          {puzzle.tags.map((t) => (
            <span key={t} className="chip opacity-70">
              #{t}
            </span>
          ))}
        </div>
        <h2 className="text-xl font-display font-bold mb-3">{puzzle.title}</h2>
        <p className="text-white/80 leading-relaxed">{puzzle.surface}</p>
      </div>
    </div>
  );
}
