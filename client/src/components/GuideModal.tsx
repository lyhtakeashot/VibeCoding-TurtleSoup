import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const GUIDE_SEEN_KEY = 'hgt_guide_seen';

export function isGuideSeen(): boolean {
  return localStorage.getItem(GUIDE_SEEN_KEY) === '1';
}

export function markGuideSeen(): void {
  localStorage.setItem(GUIDE_SEEN_KEY, '1');
}

type Tab = 'what' | 'how' | 'modes';

const tabs: { key: Tab; label: string }[] = [
  { key: 'what', label: '什么是海龟汤' },
  { key: 'how', label: '如何提问' },
  { key: 'modes', label: '三种模式' },
];

export function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('what');
  const [dontShow, setDontShow] = useState(false);

  const handleClose = () => {
    if (dontShow) markGuideSeen();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="新手指南">
      <div className="space-y-4">
        {/* Tab 切换 */}
        <div className="flex gap-1 border-b border-white/10 pb-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="text-sm text-white/80 leading-relaxed space-y-3 min-h-[200px]">
          {tab === 'what' && (
            <>
              <p>
                海龟汤（又称"情境推理"）是一种多人推理游戏：主持人给出一个悬疑场景（<strong className="text-neon-cyan">汤面</strong>），
                玩家通过不断提问「是 / 否」类问题，逐步还原隐藏的真相（<strong className="text-neon-purple">汤底</strong>）。
              </p>
              <p>
                例如汤面："一个人走进餐厅，点了一碗海龟汤，喝了一口后就自杀了。为什么？"
                玩家需要提问：他是否认识做汤的人？汤里是否有毒？…… 直到推理出完整真相。
              </p>
              <p className="text-white/50 italic">
                主持人只会回答「是」「否」「无关」「部分是」四种答案，不会直接告诉你真相。
              </p>
            </>
          )}

          {tab === 'how' && (
            <>
              <p>向 AI 主持人提问有一些小技巧：</p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li>
                  <strong className="text-white/90">用"是不是…"句式</strong>：例如「凶手是张三吗」「死者是自杀吗」
                </li>
                <li>
                  <strong className="text-white/90">从细节入手</strong>：注意汤面中的每一个细节——时间、地点、人物关系、物品
                </li>
                <li>
                  <strong className="text-white/90">建立假设再验证</strong>：先有一个大致猜测，再通过提问逐个验证
                </li>
                <li>
                  <strong className="text-white/90">善用提示</strong>：单人模式下可点击「要提示」获取渐进式线索
                </li>
                <li>
                  <strong className="text-white/90">注意提问次数</strong>：每种难度有提问上限，合理分配！
                </li>
              </ul>
            </>
          )}

          {tab === 'modes' && (
            <>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-neon-cyan">🕵️ 单人推理</h3>
                  <p className="text-white/60">独自面对 AI 主持人，在提问次数内推理出真相。支持流式打字机回答，沉浸感拉满。</p>
                </div>
                <div>
                  <h3 className="font-semibold text-neon-purple">⚡ 多人竞速</h3>
                  <p className="text-white/60">创建房间邀请好友，所有人同看一个汤面。谁先猜中真相谁就获胜！猜错可消耗提问次数重新猜。</p>
                </div>
                <div>
                  <h3 className="font-semibold text-neon-cyan">👥 多人推理</h3>
                  <p className="text-white/60">团队讨论模式：大家一起提问分析，达成共识后由一人代表提交团队汤底。适合朋友聚会。</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 不再显示 */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="accent-neon-cyan"
            />
            下次不再显示
          </label>
          <Button onClick={handleClose} className="text-sm">
            开始游玩 →
          </Button>
        </div>
      </div>
    </Modal>
  );
}
