# 海龟汤 AI · 项目交接文档

> 给下一段 AI 会话的快速上手文档。阅读时间 2 分钟。

---

## 1. 一句话定位

**Web 全栈海龟汤（情境推理）游戏** — AI 主持、规则引擎兜底、单人/多人/竞速三种模式。

---

## 2. 启动命令

```bash
cd d:/Desktop/VibeCoding/海龟汤

# 安装依赖（首次）
npm run install:all

# 开发模式（concurrently 启动前后端）
npm run dev
# → Vite 前端 :5173 , Express 后端 :3001
# → Vite 代理 /api 和 /socket.io 到 :3001

# 访问
http://localhost:5173/
```

服务端用 `tsx` 热重载，改代码即生效。前端 Vite HMR。

---

## 3. 技术栈速查

| 层 | 技术 |
|---|---|
| 前端 | React 18 · TypeScript · Vite 5 · Tailwind CSS 3.4 · Zustand 5 · react-router-dom v6 · socket.io-client |
| 后端 | Express 4 · Socket.IO · TypeScript · tsx |
| AI | 纯 fetch() 调用 OpenAI 兼容 API，20+ 提供商预设 |
| 数据 | JSON 文件（`server/data/`），零外部数据库 |

---

## 4. 项目结构（只列关键文件）

```
海龟汤/
├── HANDOFF.md              ← 本文件
├── package.json            # monorepo，npm scripts 驱动前后端
├── .env                    # USE_AI=false, PORT=3001, ADMIN_PASS=turtle-admin-2026
│
├── client/src/
│   ├── App.tsx             # 路由：/ /solo /multi /discuss /result /submit /admin /editor
│   ├── api.ts              # 前端 API 层：REST + SSE 流式
│   ├── socket.ts           # Socket.IO 单例 getSocket()
│   ├── store/gameStore.ts  # Zustand 全局状态
│   ├── index.css           # Tailwind + 暗色主题（ink/neon 色系）+ 响应式断点
│   ├── hooks/
│   │   ├── useSoloGame.ts    # 单人模式 Hook（SSE 流式 + sessionStorage 持久化）
│   │   ├── useMultiGame.ts   # 多人竞速 Hook（Socket.IO）
│   │   └── useDiscussGame.ts # 多人推理共识 Hook（Socket.IO）
│   └── components/
│       ├── PuzzleSelector.tsx  # 汤面选择器（最近加了 Scroll Snap 滚动吸附）
│       ├── ChatPanel.tsx       # 问答面板（hideHint prop 控制多人模式隐藏提示）
│       ├── GuideModal.tsx      # 新手指南弹窗（localStorage 记忆）
│       ├── ErrorBoundary.tsx   # React 错误边界
│       └── ...
│
├── server/src/
│   ├── index.ts               # Express 入口：路由挂载 + Socket.IO + 静态托管 + 输入校验 + 全局错误处理
│   ├── host.ts                # 主持人引擎：规则匹配 → 历史去重 → AI 增强 → 兜底
│   ├── judge.ts               # 裁判引擎：判断猜测是否正确
│   ├── config.ts              # 静态配置（端口、CORS、ADMIN_PASS）
│   ├── runtimeConfig.ts       # 运行时配置（从 api-config.json 动态加载 AI 配置）
│   ├── ai/                    # AI 集成（OpenAI 兼容客户端 + 提示词 + 题目生成 + CodeBuddy 测试模式）
│   ├── games/                 # 游戏逻辑
│   │   ├── manager.ts         # 全局管理器：题库加载 + 会话/房间管理 + 定时清理空房间
│   │   ├── room.ts            # 房间逻辑：竞速/推理两种模式 + 共识机制（≥2 人）
│   │   └── session.ts         # 单人会话管理
│   ├── routes/                # REST API
│   │   ├── puzzles.ts         # 题库（列表/随机/生成）
│   │   ├── submit.ts          # 投稿（POST body 传口令）
│   │   ├── rooms.ts           # 活跃房间列表
│   │   ├── config.ts          # API 配置管理
│   │   └── editor.ts          # 题库编辑器
│   └── socket/handlers.ts     # Socket.IO 事件：房间 CRUD + 提问 + 猜测 + 共识 + 聊天 + 重猜
│
└── server/data/
    ├── puzzles.json           # 题库（9 道种子题）
    ├── submissions.json       # 用户投稿
    └── api-config.json        # 运行时 AI 配置
```

---

## 5. 核心架构：规则 + AI 双主持人

```
用户提问 → ruleMatch 直球命中? → 返回预置答案（source: rule）
            ↓ 否
          metaMatch 题材问题? → 返回 tags 答案
            ↓ 否
          detectDuplicate 重复? → 返回 irrelevant
            ↓ 否
          USE_AI=true? → AI 流式回答
            ↓ 否
          fallback → 返回 irrelevant
```

- **默认 `USE_AI=false`**：纯规则引擎，零 token 消耗
- **开启 AI**：自动流式调用 OpenAI 兼容 API，失败自动降级兜底
- **TestMode**：首页可开启，使用 CodeBuddy 内置 AI 零配置试玩

---

## 6. 三种游戏模式

| 模式 | 路由 | 通信方式 | 核心 Hook |
|------|------|----------|-----------|
| 单人推理 | `/solo` | SSE 流式 | `useSoloGame.ts` |
| 多人竞速 | `/multi` | Socket.IO | `useMultiGame.ts` |
| 多人推理共识 | `/discuss` | Socket.IO | `useDiscussGame.ts` |

---

## 7. 最近改动 / 注意事项

### 已完成的重大改动
- ✅ 所有安全加固（进程错误处理、输入校验、口令 POST 传输、房间过期清理）
- ✅ 用户体验修复（共识门槛、竞速二次猜测、会话持久化、新手指南、房间列表）
- ✅ 架构优化（Socket 单例、AI 目录迁移、题库扩展脚本）
- ✅ 移动端响应式适配
- ✅ 推理图谱已删除（ReasoningGraph.tsx — 有运行时错误，用户明确要求移除）
- ✅ 滚动吸附（PuzzleSelector.tsx — CSS Scroll Snap + 非 passive wheel 事件）

### 编码陷阱记住
1. **滚动事件的 passive 问题**：`onWheel` 不能 `preventDefault()`，必须用 `useEffect` + `addEventListener('wheel', fn, { passive: false })`
2. **Socket 单例**：用 `client/src/socket.ts` 的 `getSocket()`，不要在 Hook 里各自创建
3. **SSE 流式**：`api.askSoloStream()` 走 `fetch + ReadableStream`，注意处理 `AbortController`
4. **Types 同步**：`server/src/types.ts` 和 `client/src/types/game.ts` 的 QAItem 两处都要改

---

## 8. 常见任务定位

| 要做什么 | 去哪里改 |
|----------|----------|
| 改 UI 样式 | `client/src/index.css`（主题色/响应式）+ 组件内 Tailwind class |
| 改单人游戏逻辑 | `client/src/hooks/useSoloGame.ts` + `server/src/host.ts` |
| 改多人游戏逻辑 | `client/src/hooks/useMultiGame.ts` / `useDiscussGame.ts` + `server/src/games/room.ts` + `server/src/socket/handlers.ts` |
| 加 API 接口 | `server/src/routes/*.ts` → `server/src/index.ts` 挂载 → `client/src/api.ts` 封装 |
| 加题库 | 编辑 `server/data/puzzles.json` 或用 `npm run expand-puzzles` AI 生成 |
| 加页面 | `client/src/pages/` 新建 → `App.tsx` 注册路由 |
| 改 AI 行为 | `server/src/ai/prompts.ts`（系统提示词）+ `server/src/ai/client.ts`（调用方式） |
| 加 AI 提供商 | `client/src/pages/Home.tsx` 的 `PRESET_PROVIDERS` 数组 |

---

## 9. 环境变量速查

```env
USE_AI=false              # 是否启用 AI 增强（默认纯规则）
AI_API_KEY=               # OpenAI 兼容 API Key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
ADMIN_PASS=turtle-admin-2026
MAX_CONTEXT_ROUNDS=12     # AI 上下文最大轮次
```
