import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import type { PublicPuzzle, Difficulty } from '../types/game';
import { DIFFICULTY_META } from '../types/game';

interface EditablePuzzle extends PublicPuzzle {
  solution?: string;
  hints?: string[];
}

export function Editor() {
  const navigate = useNavigate();
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [puzzles, setPuzzles] = useState<EditablePuzzle[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditablePuzzle | null>(null);
  const [saving, setSaving] = useState(false);

  const inputCls =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50';

  const login = async () => {
    if (!pass.trim()) return;
    setLoading(true);
    try {
      // 用 list submissions 验证口令
      await api.listSubmissions(pass.trim());
      setAuthed(true);
      setMsg('');
    } catch {
      setMsg('口令错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchPuzzles = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/editor/puzzles?pass=${encodeURIComponent(pass)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPuzzles(data.puzzles || []);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) fetchPuzzles();
  }, [authed]);

  const startEdit = (p: EditablePuzzle) => {
    setEditingId(p.id);
    setEditForm({
      ...p,
      tags: [...(p.tags || [])],
      hints: [...(p.hints || [])],
    });
  };

  const saveEdit = async () => {
    if (!editForm || !editingId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/editor/puzzles/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, pass }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMsg(data.note || '保存成功');
      setEditingId(null);
      setEditForm(null);
      fetchPuzzles();
    } catch (e) {
      setMsg(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const deletePuzzle = async (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？此操作不可恢复。`)) return;
    try {
      const r = await fetch(`/api/editor/puzzles/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMsg(data.note || '已删除');
      fetchPuzzles();
    } catch (e) {
      setMsg(`删除失败：${(e as Error).message}`);
    }
  };

  const updateEditForm = (field: string, value: any) => {
    setEditForm((f) => (f ? { ...f, [field]: value } : null));
  };

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-display font-bold neon-text mb-6">🔧 编辑题库</h1>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
          placeholder="管理员口令"
          className={`${inputCls} text-center mb-3`}
        />
        <Button onClick={login} disabled={!pass.trim() || loading}>
          {loading ? '验证中…' : '进入编辑器'}
        </Button>
        {msg && <div className="text-neon-pink text-sm mt-3">{msg}</div>}
        <div className="mt-4">
          <button onClick={() => navigate('/')} className="text-white/40 hover:text-white/70 text-sm">
            ← 返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold neon-text">🔧 编辑题库</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={fetchPuzzles} disabled={loading}>
            {loading ? '加载中…' : '刷新'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            ← 返回
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`text-sm mb-3 px-3 py-2 rounded-lg ${msg.includes('失败') ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>
          {msg}
        </div>
      )}

      {/* 题目列表 */}
      <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto">
        {puzzles.map((p) => (
          <div key={p.id} className="glass p-3">
            {editingId === p.id && editForm ? (
              // ─── 编辑模式 ───
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">标题</label>
                  <input
                    value={editForm.title}
                    onChange={(e) => updateEditForm('title', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1 block">汤面</label>
                  <textarea
                    value={editForm.surface}
                    onChange={(e) => updateEditForm('surface', e.target.value)}
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1 block">汤底（真相）</label>
                  <textarea
                    value={editForm.solution || ''}
                    onChange={(e) => updateEditForm('solution', e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">难度</label>
                    <select
                      value={editForm.difficulty}
                      onChange={(e) => updateEditForm('difficulty', e.target.value)}
                      className={`${inputCls} w-24`}
                    >
                      {(['easy', 'medium', 'hard', 'unlimited'] as Difficulty[]).map((d) => (
                        <option key={d} value={d}>{DIFFICULTY_META[d].label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-white/50 mb-1 block">标签</label>
                    <input
                      value={(editForm.tags || []).join(', ')}
                      onChange={(e) => updateEditForm('tags', e.target.value.split(/[,，\s]+/).filter(Boolean))}
                      placeholder="逗号分隔"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">作者</label>
                    <input
                      value={editForm.author || ''}
                      onChange={(e) => updateEditForm('author', e.target.value)}
                      className={`${inputCls} w-28`}
                    />
                  </div>
                </div>

                {/* 提示 */}
                <div>
                  <div className="text-xs text-white/50 mb-2">渐进提示</div>
                  {(editForm.hints || []).map((h, i) => (
                    <div key={i} className="flex gap-2 mb-1 items-center">
                      <span className="text-xs text-white/30 w-5 shrink-0">{i + 1}.</span>
                      <input
                        value={h}
                        onChange={(e) => {
                          const hints = [...(editForm.hints || [])];
                          hints[i] = e.target.value;
                          updateEditForm('hints', hints);
                        }}
                        className={`${inputCls} text-xs`}
                      />
                      <button onClick={() => {
                        const hints = [...(editForm.hints || [])];
                        hints.splice(i, 1);
                        updateEditForm('hints', hints);
                      }} className="text-neon-pink text-xs shrink-0">删</button>
                    </div>
                  ))}
                  <button onClick={() => updateEditForm('hints', [...(editForm.hints || []), '']) }
                    className="text-xs text-neon-cyan/60 hover:text-neon-cyan mt-1">+ 添加提示</button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
                  <Button variant="ghost" onClick={() => { setEditingId(null); setEditForm(null); }}>取消</Button>
                </div>
              </div>
            ) : (
              // ─── 查看模式 ───
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.title}</div>
                    <div className="text-xs text-white/50 mt-0.5 line-clamp-2">{p.surface}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="chip" style={{ color: DIFFICULTY_META[p.difficulty].color, borderColor: DIFFICULTY_META[p.difficulty].color }}>
                        {DIFFICULTY_META[p.difficulty].label}
                      </span>
                      {(p.tags || []).map((t: string) => (
                        <span key={t} className="text-xs text-white/40">#{t}</span>
                      ))}
                      <span className="text-xs text-white/30 ml-auto">{p.author}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" onClick={() => startEdit(p)} className="text-xs px-2 py-1">编辑</Button>
                    <Button variant="ghost" onClick={() => deletePuzzle(p.id, p.title)}
                      className="text-xs px-2 py-1 text-neon-pink/60 hover:text-neon-pink">删除</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
