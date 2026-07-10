import { useState } from 'react';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import type { SubmissionItem } from '../types/game';

export function Admin() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [list, setList] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enter = async () => {
    if (!pass.trim()) return;
    setLoading(true);
    setError('');
    try {
      const d = await api.listSubmissions(pass, 'pending');
      setList(d.submissions);
      setAuthed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const moderate = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.moderate(id, action, pass);
      setList((l) => l.filter((s) => s.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <h1 className="text-2xl font-display font-bold neon-text mb-1">审核台</h1>
        <p className="text-white/50 text-sm mb-6">输入管理口令进入（默认见 .env 的 ADMIN_PASS）。</p>
        <div className="glass p-5 space-y-3">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
            placeholder="管理口令"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-neon-purple/50"
          />
          {error && <div className="text-neon-pink text-sm">{error}</div>}
          <Button onClick={enter} disabled={!pass.trim() || loading} className="w-full">
            {loading ? '验证中…' : '进入'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-display font-bold neon-text mb-1">审核台 · 待审投稿</h1>
      <p className="text-white/50 text-sm mb-6">通过后会并入题库，玩家即可游玩。</p>

      {list.length === 0 ? (
        <div className="glass p-8 text-center text-white/40">暂无待审投稿 🎉</div>
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} className="glass p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{s.author || '匿名作者'}</span>
                <span className="chip">{s.difficulty}</span>
              </div>
              <p className="text-sm text-white/70 mb-1">
                <span className="text-white/40">汤面：</span>
                {s.surface}
              </p>
              <p className="text-sm text-white/70 mb-3">
                <span className="text-white/40">汤底：</span>
                {s.solution}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => moderate(s.id, 'approve')} className="text-sm">
                  通过
                </Button>
                <Button variant="danger" onClick={() => moderate(s.id, 'reject')} className="text-sm">
                  驳回
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
