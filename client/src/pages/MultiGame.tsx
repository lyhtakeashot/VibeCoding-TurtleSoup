import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMultiRoom } from '../hooks/useMultiRoom';
import { useGameStore } from '../store/gameStore';
import { api, type RoomInfo } from '../api';
import { PuzzleCard } from '../components/PuzzleCard';
import { ChatPanel } from '../components/ChatPanel';
import { ChatSidebar } from '../components/ChatSidebar';
import { RoomBar } from '../components/RoomBar';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

export function MultiGame() {
  const navigate = useNavigate();
  const difficulty = useGameStore((s) => s.difficulty);
  const {
    room, playerId, playerName,
    result, submissionResult,
    asking, chatMessages,
    createRoom, joinRoom, ask, guess, leave, sendChat,
    retryGuess, endDiscussion, submitDiscussion,
    clearResult, clearSubmissionResult,
  } = useMultiRoom();

  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const presetPuzzleId = (location.state as { puzzleId?: string } | null)?.puzzleId;
  const [pickedId, setPickedId] = useState<string>(presetPuzzleId ?? '');
  const [mode, setMode] = useState<'race' | 'discuss'>('race');

  const [guessOpen, setGuessOpen] = useState(false);
  const [guessText, setGuessText] = useState('');
  const [roomsList, setRoomsList] = useState<RoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  useEffect(() => {
    if (!room) {
      setRoomsLoading(true);
      api.listRooms().then(setRoomsList).catch(() => {}).finally(() => setRoomsLoading(false));
    }
  }, [room]);

  const doCreate = async () => {
    if (!nickname.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const pid = pickedId || (await api.randomPuzzle(difficulty)).id;
      await createRoom(pid, nickname.trim(), mode);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    if (!nickname.trim() || !joinCode.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await joinRoom(joinCode.trim().toUpperCase(), nickname.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 未加入房间时的 UI
  if (!room) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-display font-bold mb-6 neon-text">多人联机 · 房间</h1>

        <div className="glass p-5 space-y-4">
          <div>
            <label className="text-sm text-white/60">你的昵称</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="输入昵称进入房间"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-neon-cyan/50"
            />
          </div>

          {/* 模式选择 */}
          <div>
            <label className="text-sm text-white/60">游戏模式</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setMode('race')}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  mode === 'race'
                    ? 'bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                竞速模式
              </button>
              <button
                onClick={() => setMode('discuss')}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  mode === 'discuss'
                    ? 'bg-neon-purple/20 border border-neon-purple/50 text-neon-purple'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                推理讨论
              </button>
            </div>
            <p className="text-xs text-white/40 mt-1">
              {mode === 'race' ? '每人独立猜汤底，先猜中者获胜' : '团队讨论后统一提交汤底'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={doCreate} disabled={!nickname.trim() || busy}>
              {busy ? '…' : '创建房间'}
            </Button>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="房间码"
                maxLength={6}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm uppercase outline-none focus:border-neon-purple/50"
              />
              <Button variant="ghost" onClick={doJoin} disabled={!nickname.trim() || !joinCode.trim() || busy}>
                加入
              </Button>
            </div>
          </div>

          {error && <div className="text-neon-pink text-sm">{error}</div>}
        </div>

        {/* 活跃房间列表 */}
        {roomsList.length > 0 && (
          <div className="glass p-5 mt-4">
            <h2 className="text-sm text-white/60 mb-3">浏览活跃房间（点击房间可填入房间码）</h2>
            {roomsLoading ? (
              <div className="text-white/40 text-sm text-center">加载中…</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto">
                {roomsList.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    onClick={() => {
                      if (!nickname.trim()) return setError('请先输入昵称');
                      setJoinCode(r.code);
                    }}
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-neon-cyan">{r.code}</span>
                      <span className="text-white/70">{r.title}</span>
                      <span className={`chip text-xs ${r.difficulty === 'easy' ? '!bg-emerald-500/20 !text-emerald-400' : r.difficulty === 'hard' ? '!bg-red-500/20 !text-red-400' : '!bg-yellow-500/20 !text-yellow-400'}`}>{r.difficulty}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.mode === 'discuss' ? 'bg-neon-purple/20 text-neon-purple' : 'bg-neon-cyan/20 text-neon-cyan'}`}>
                        {r.mode === 'discuss' ? '讨论' : '竞速'}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      {r.playerCount} 人在线 · {Math.floor(r.elapsed / 60000)} 分钟前
                      {r.finished && ' · 已结束'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ───── 在房间中的 UI ─────
  const isRace = room.mode === 'race';
  const isDiscuss = room.mode === 'discuss';
  const currentPlayer = room.players.find((p) => p.id === playerId);
  const hasGuessed = currentPlayer?.guessed;
  const hasEnded = currentPlayer?.ended;

  const doGuess = () => {
    if (!guessText.trim() || hasGuessed) return;
    guess(room.code, guessText);
    setGuessText('');
    setGuessOpen(false);
  };

  const toResult = () => {
    const isCorrect = isRace ? Boolean(result?.correct) : Boolean(submissionResult?.correct);
    const feedback = isRace ? (result?.feedback || '') : (submissionResult?.feedback || '');
    navigate('/result', {
      state: {
        mode: 'multi',
        puzzle: room.puzzle,
        history: room.history,
        correct: isCorrect,
        feedback,
        solution: room.puzzle.solution,
        playerGuess: isRace ? result?.playerGuess : submissionResult?.guess,
        winnerName: room.players.find((p) => p.isWinner)?.name,
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <RoomBar room={room} playerId={playerId} />

      {/* 竞速模式：猜中结果提示 */}
      {result && isRace && (
        <div
          className="glass p-3 flex items-center justify-between"
          style={{ borderColor: result.correct ? '#34d39966' : '#fbbf2466' }}
        >
          <span className="text-sm">
            {result.playerId === playerId ? '你' : '有人'}的推理：
            <span className={result.correct ? 'text-answer-yes' : 'text-answer-irrel'}>
              {result.correct ? ' 猜中！' : ' 未猜中'}
            </span>
            <span className="text-white/60 ml-2">{result.feedback}</span>
          </span>
          <Button variant="ghost" onClick={clearResult}>
            知道了
          </Button>
        </div>
      )}

      {/* 讨论模式：团队提交结果 */}
      {submissionResult && isDiscuss && (
        <div
          className="glass p-3 flex items-center justify-between"
          style={{ borderColor: submissionResult.correct ? '#34d39966' : '#fbbf2466' }}
        >
          <span className="text-sm">
            团队推理结果：
            <span className={submissionResult.correct ? 'text-answer-yes' : 'text-answer-irrel'}>
              {submissionResult.correct ? ' 猜中！' : ' 未猜中'}
            </span>
            <span className="text-white/60 ml-2">{submissionResult.feedback}</span>
          </span>
          <Button variant="ghost" onClick={clearSubmissionResult}>
            知道了
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <PuzzleCard puzzle={room.puzzle} />
          <ChatSidebar
            messages={chatMessages}
            playerId={playerId}
            onSend={(msg) => sendChat(room.code, msg)}
            disabled={room.finished}
          />
        </div>

        <div className="min-h-0 max-h-[calc(100vh-16rem)]">
          <ChatPanel
            history={room.history}
            streaming={null}
            asking={asking}
            questionsUsed={room.questionsUsed}
            maxQuestions={room.maxQuestions}
            onAsk={(q) => ask(room.code, q)}
            onHint={() => {}}
            onReveal={() => setGuessOpen(true)}
            disabled={room.finished}
            revealDisabled={isRace ? hasGuessed : false}
            hideHint
            placeholder="向主持人提问（全房间可见）"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="ghost" onClick={() => leave(room.code)}>
          离开房间
        </Button>

        {isDiscuss && !room.finished && !room.allEnded && (
          <Button
            variant={hasEnded ? 'neon' : 'ghost'}
            onClick={() => endDiscussion(room.code)}
          >
            {hasEnded ? '已准备提交（点击取消）' : '结束讨论准备提交'}
          </Button>
        )}

        {isDiscuss && room.allEnded && !room.submission && (
          <Button variant="neon" onClick={() => setGuessOpen(true)}>
            团队统一提交汤底
          </Button>
        )}

        {room.finished && (
          <Button onClick={toResult}>查看结算 →</Button>
        )}
      </div>

      {/* 竞速模式：猜错后重试 */}
      {isRace && hasGuessed && !room.finished && (
        <div className="text-sm text-white/50 text-center space-y-2">
          <p>你已提交过汤底，等待其他玩家提交或房间揭晓。</p>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => retryGuess(room.code)}
          >
            消耗 3 次提问次数再次猜测
          </Button>
        </div>
      )}

      {/* 讨论模式：共识状态提醒 */}
      {isDiscuss && room.allEnded && !room.submission && !room.finished && (
        <div className="text-sm text-neon-purple text-center">
          全员已达成共识！点击上方「团队统一提交汤底」提交最终答案。
        </div>
      )}

      {isDiscuss && !room.allEnded && !room.finished && (
        <div className="text-sm text-white/40 text-center">
          推理讨论模式：每人提问后，达成共识点击「结束讨论」准备统一提交。
          {room.players.filter((p) => p.ended).length}/{room.players.length} 人已准备
        </div>
      )}

      {/* 提交推理 Modal（竞速模式） / 团队提交 Modal（讨论模式） */}
      <Modal open={guessOpen} onClose={() => setGuessOpen(false)} title={isDiscuss ? '团队统一提交汤底' : '提交推理 / 揭晓'}>
        {isDiscuss && (
          <p className="text-sm text-white/60 mb-3">全员已达成共识，请一人代表团队提交最终推理。</p>
        )}
        <textarea
          value={guessText}
          onChange={(e) => setGuessText(e.target.value)}
          rows={4}
          placeholder="写下你认为的完整真相……"
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-neon-cyan/50 resize-none"
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" onClick={() => setGuessOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (isDiscuss) {
                submitDiscussion(room.code, guessText);
              } else {
                doGuess();
              }
              setGuessText('');
              setGuessOpen(false);
            }}
            disabled={!guessText.trim()}
          >
            提交
          </Button>
        </div>
      </Modal>
    </div>
  );
}
