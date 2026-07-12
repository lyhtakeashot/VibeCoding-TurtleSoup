# 海龟汤 · 系统架构

## 整体架构

```
浏览器                        Node.js 服务器
┌──────────────┐          ┌─────────────────────────────────┐
│  React SPA   │  HTTP    │  Express 4                      │
│              │◄────────►│  ┌─────────────────────────┐    │
│  - 单人 SSE  │  SSE     │  │ REST API                │    │
│  - 多人 WS   │  Socket  │  │ /api/solo/*  单人模式    │    │
│              │          │  │ /api/puzzles  题库       │    │
│  Zustand     │          │  │ /api/submissions 投稿    │    │
│  全局状态    │          │  │ /api/rooms    房间列表   │    │
│              │          │  │ /api/config   AI 配置    │    │
└──────────────┘          │  │ /api/editor   题库编辑   │    │
                          │  └─────────────────────────┘    │
                          │  ┌─────────────────────────┐    │
                          │  │ Socket.IO               │    │
                          │  │ room:create/join/ask     │    │
                          │  │ room:guess/submit/end    │    │
                          │  │ room:chat                │    │
                          │  └─────────────────────────┘    │
                          │  ┌─────────────────────────┐    │
                          │  │ GameManager (单例)       │    │
                          │  │ - sessions Map           │    │
                          │  │ - rooms Map              │    │
                          │  │ - 题库加载 + 审核缓存     │    │
                          │  │ - 房间过期清理            │    │
                          │  └─────────────────────────┘    │
                          │  ┌─────────────────────────┐    │
                          │  │ AI 层                    │    │
                          │  │ client.ts → OpenAI API   │    │
                          │  │ codebuddyClient.ts       │    │
                          │  │ prompts.ts               │    │
                          │  │ puzzleGenerator.ts       │    │
                          │  └─────────────────────────┘    │
                          └─────────────────────────────────┘
```

**核心原则**：BFF（Backend For Frontend）单体架构，Node.js 后端统一处理 HTTP API、WebSocket 连接、AI 调用代理，生产环境托管前端静态资源，无需额外 Web 服务器。

---

## AI 主持流水线

```
用户提问
    │
    ▼
┌──────────────────┐
│ hostAnswer()     │ ← host.ts（入口）
└──────┬───────────┘
       │
       ▼
  ruleMatch() ──── 命中？ ──→ 返回预置答案（source: rule, 零 token）
       │ 否
       ▼
  metaMatch() ──── 题材问题？ ──→ 返回标签描述（source: rule）
       │ 否
       ▼
  detectDuplicate() ── 重复？ ──→ 返回 irrelevant（Jaccard 相似度 > 0.7）
       │ 否
       ▼
  USE_AI 或 TestMode？
       │ 是
       ▼
  streamAI() ────────────→ OpenAI 兼容 API 流式调用
       │                       │
       │                    失败？
       │                       │
       ▼                       ▼
  fallback ──────────────→ 返回 irrelevant
```

### 三种 AI 运行模式

| 模式 | 触发条件 | 调用路径 |
|------|---------|---------|
| 纯规则 | `USE_AI=false` 且 TestMode 关闭 | 规则引擎 → 命中也返回，不命中走兜底 |
| 外部 AI | `USE_AI=true` + 有效 API Key | 规则引擎未命中 → `streamAI()` → OpenAI 兼容 API |
| 测试模式 | TestMode 开关开启 | 规则引擎未命中 → `streamCodeBuddy()` → IDE 内置 AI |

**runtimeConfig.ts** 统一读取 `server/data/api-config.json`，支持运行时切换 AI 配置（无需重启服务）。

---

## 三种游戏模式

### 1. 单人推理（Solo）

```
前端                          后端
useSoloGame.ts ──POST /api/solo/start──→ manager.createSession()
       │                                        │
       │  ┌─GET /api/solo/ask (SSE)─────→ hostAnswer() 流式回答
       │  │    data: {type:"answer"}     ← 答案类型
       │  │    data: {type:"chunk"}      ← 逐字打字机
       │  │    data: {type:"done"}       ← 完成
       │  └──────────────────────────────
       │
       │  POST /api/solo/hint ──────────→ manager.revealHint()
       │
       └──POST /api/solo/guess ─────────→ judgeGuess() 判定正确性
```

- **会话持久化**：`sessionStorage` 存储 sessionId，刷新不丢失
- **提问上限**：按难度分别为 easy 10 / medium 15 / hard 20 次
- **回答贡献度**：AI 评估每条回答对还原汤底的贡献（0~100），累加至进度条

### 2. 多人竞速（Multi Race）

```
玩家A ──room:create──→ GameManager.createRoom()
玩家B ──room:join───→ GameManager.joinRoom()
      ...                    │
      room:ask ──────────→ hostAnswer() → io.to(room).emit("room:qa")
      room:guess ────────→ judgeGuess() → 判定正确性
                             │ 正确 → winner + finished
                             │ 错误 → retry-guess（消耗 3 次提问）
      room:chat ─────────→ 文字聊天（≤500 字）
```

- 先猜中汤底者直接获胜，房间结束
- 猜错后可通过 `room:retry-guess` 消耗 3 次提问重新猜测
- 共享问答历史，所有人可见

### 3. 多人推理共识（Discuss）

```
所有玩家提问（room:ask）→ 共享历史
       │
       ▼
每位玩家点「结束讨论」→ room:end → recomputeConsensus()
       │
       ▼
全员 ≥2 人且均已结束 → room.allEnded = true
       │
       ▼
一人提交团队汤底 → room:submit → judgeGuess() → 最终判罚
```

- 协作推理，共享问答
- 需要 **≥2 人且全员点击「结束讨论」** 才算达成共识
- 共识后由一人代表团队提交，仅提交一次
- 所有人看到相同的结果

---

## Socket.IO 事件表

| 事件名 | 方向 | 载荷 |
|--------|------|------|
| `room:create` | C→S | `{puzzleId, name, mode}` |
| `room:join` | C→S | `{code, name}` |
| `room:ask` | C→S | `{code, question}` |
| `room:guess` | C→S | `{code, playerId, guess}` |
| `room:retry-guess` | C→S | `{code, playerId}` |
| `room:end` | C→S | `{code, playerId}` |
| `room:submit` | C→S | `{code, playerId, guess}` |
| `room:chat` | C→S | `{code, message}` |
| `room:leave` | C→S | `{code, playerId}` |
| `room:state` | S→C | Room 全量状态（通用广播） |
| `room:qa` | S→C | 新的 Q&A 记录 |
| `room:result` | S→C | 猜测判定结果 |
| `room:retry-allowed` | S→C | 允许玩家重试猜测 |
| `room:submission` | S→C | 团队统一提交结果 |
| `room:chat` | S→C | 聊天消息广播 |

---

## 前端架构

```
App.tsx (路由 + 导航)
 ├── Home.tsx          首页：模式选择、AI 配置、测试模式开关
 ├── SoloGame.tsx      单人：useSoloGame Hook → SSE 流式
 ├── MultiGame.tsx     竞速：useMultiGame Hook → Socket.IO
 ├── DiscussGame.tsx   推理：useDiscussGame Hook → Socket.IO
 ├── Result.tsx        结果展示
 ├── Submit.tsx        投稿
 ├── Admin.tsx         审核台
 ├── Editor.tsx        题库编辑
 └── NotFound.tsx      404

共享组件：
 ├── PuzzleSelector.tsx   汤面选择器（Scroll Snap 吸附）
 ├── ChatPanel.tsx        问答面板
 ├── ChatSidebar.tsx      聊天侧栏（多人模式）
 ├── PuzzleCard.tsx       汤面卡片
 ├── GuideModal.tsx       新手指南（localStorage 记忆）
 ├── RestorePanel.tsx     会话恢复提示
 ├── RoomBar.tsx          房间信息栏
 ├── DifficultyPicker.tsx 难度选择
 ├── ErrorBoundary.tsx    React 错误边界
 ├── BatchSubmitPanel.tsx 批量操作面板
 └── ui/                  基础 UI（Button, Modal）

状态管理：
 └── store/gameStore.ts   Zustand 全局状态
```

### 关键设计点

- **Socket 单例**：`client/src/socket.ts` 提供 `getSocket()`，所有 Hook 共享同一连接
- **SSE 流式**：`api.ts` 中 `askSoloStream()` 走 `fetch + ReadableStream`，支持 `AbortController` 取消
- **会话持久化**：单人模式 sessionId 存入 `sessionStorage`，刷新恢复
- **移动端适配**：Tailwind 响应式断点 + Scroll Snap 触摸滚动

---

## 数据存储

| 文件 | 结构 | 说明 |
|------|------|------|
| `server/data/puzzles.json` | `Puzzle[]` | 种子题库（含汤面、汤底、提示、预置答案） |
| `server/data/submissions.json` | `Submission[]` | 用户投稿（pending/approved/rejected） |
| `server/data/api-config.json` | 运行时配置 | AI 提供商、模型、开关状态 |

- 不依赖外部数据库，JSON 文件即可运行
- 多人房间为内存态，服务重启即释放
- 房间过期清理：每 5 分钟扫描，空房间（无玩家）10 分钟后自动删除

---

## 安全措施

| 层级 | 措施 |
|------|------|
| 输入校验 | Express 中间件限制各字段最大长度（question: 200, nickname: 20, guess: 5000 等） |
| 口令保护 | 审核台口令通过 POST body 传输（Admin.tsx 页面上传） |
| AI 密钥 | 仅存于服务端 `.env`，前端通过 Vite 代理 `/api` 调用，永不暴露 |
| 进程保护 | `uncaughtException` + `unhandledRejection` 兜底，防止单次错误崩溃 |
| CORS | 仅允许 `CLIENT_ORIGIN` 跨域（默认 `http://localhost:5173`） |

---

## 关键技术决策

1. **BFF 单体架构**：前后端同一仓库，避免跨域和部署复杂性
2. **规则引擎优先**：直球问题零 token 命中，降低 AI 调用成本
3. **OpenAI 兼容 API**：不绑定单一提供商，支持切换和本地 Ollama
4. **TestMode 零配置**：通过 CodeBuddy 内置 AI 实现无 Key 体验
5. **JSON 文件存储**：无数据库依赖，部署即用，适合小规模使用
6. **SSE + Socket.IO 双通道**：SSE 用于单人流式回答（简化），Socket.IO 用于多人实时同步
