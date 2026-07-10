import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMultiGame } from '../hooks/useMultiGame';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../socket';
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
  const { room, playerId, result, ask, guess, createRoom, joinRoom, leave, clearResult, chatMessages, sendChat } =
    useMultiGame();

  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const presetPuzzleId = (location.state as { puzzleId?: string } | null)?.puzzleId;
  const [pickedId, setPickedId] = useState<string>(presetPuzzleId ?? '');

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
      await createRoom(pid, nickname.trim());
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

  if (!room) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-display font-bold mb-6 neon-text">多人竞速 · 房间</h1>

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
        {!room && roomsList.length > 0 && (
          <div className="glass p-5 mt-4">
            <h2 className="text-sm text-white/60 mb-3">浏览活跃房间（点击房间直接加入）</h2>
            {roomsLoading ? (
              <div className="text-white/40 text-sm text-center">加载中…</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto">
                {roomsList.filter(r => r.mode === 'race').map((r) => (
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

  const hasGuessed = room.players.find((p) => p.id === playerId)?.guessed;

  const doGuess = () => {
    if (!guessText.trim() || hasGuessed) return;
    guess(room.code, guessText);
    setGuessText('');
    setGuessOpen(false);
  };

  const toResult = () => {
    navigate('/result', {
      state: {
        mode: 'multi',
        puzzle: room.puzzle,
        history: room.history,
        correct: Boolean(result?.correct),
        feedback: result?.feedback || '',
        solution: room.puzzle.solution,
        playerGuess: result?.playerGuess,
        winnerName: room.players.find((p) => p.isWinner)?.name,
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <RoomBar room={room} playerId={playerId} />

      {result && (
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
          asking={false}
          questionsUsed={room.questionsUsed}
          maxQuestions={room.maxQuestions}
          onAsk={(q) => ask(room.code, q)}
          onHint={() => {}}
          onReveal={() => setGuessOpen(true)}
          disabled={room.finished}
          revealDisabled={hasGuessed}
          hideHint
          placeholder="向主持人提问（全房间可见）"
        />
      </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => leave(room.code)}>
          离开房间
        </Button>
        {room.finished && (
          <Button onClick={toResult}>查看结算 →</Button>
        )}
      </div>

      {hasGuessed && !room.finished && (
        <div className="text-sm text-white/50 text-center space-y-2">
          <p>你已提交过汤底，等待其他玩家提交或房间揭晓。</p>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => {
              getSocket().emit('room:retry-guess', { code: room.code, playerId });
            }}
          >
            消耗 3 次提问次数再次猜测
          </Button>
        </div>
      )}

      <Modal open={guessOpen} onClose={() => setGuessOpen(false)} title="提交推理 / 揭晓">
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
          <Button onClick={doGuess} disabled={!guessText.trim()}>
            提交
          </Button>
        </div>
      </Modal>
    </div>
  );
}
