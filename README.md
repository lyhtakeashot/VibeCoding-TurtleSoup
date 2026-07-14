# 海龟汤 · AI 主持

一款 Web 全栈情境推理（海龟汤）游戏。AI 担任主持人，规则引擎兜底，支持 **单人沉浸推理、多人竞速、多人推理共识** 三种模式。

## 特性

- 🕵️ **单人推理**：向 AI 主持人提问（是/否），SSE 流式打字机回答，可请求渐进提示，达到上限后提交推理
- ⚡ **多人竞速**：昵称进房，共享汤面与问答，先猜中汤底者胜（Socket.IO 实时同步）
- 💬 **多人推理共识**：多人协作推理模式，≥2 人达成共识即算通过
- 🧠 **规则引擎 + AI 增强**：直球问题零 token 命中预置答案；模糊问题交由 AI 流式作答
- 🔄 **多 AI 提供商**：支持 OpenAI / DeepSeek / Groq / Ollama 等任意 OpenAI 兼容 API，首页可视化切换配置
- 🧪 **测试模式**：启用 CodeBuddy 内置 AI，无需外部 Key 即可体验完整功能
- ✍️ **玩家投稿 + 审核台**：提交自创题目，管理员口令审核通过后并入题库
- 🎨 **AI 生成配图**：每道汤面配有暗色悬疑封面

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 · TypeScript · Vite 5 · Tailwind CSS 3.4 · Zustand 5 · react-router-dom v6 · socket.io-client |
| 后端 | Node.js · Express 4 · Socket.IO · TypeScript · tsx |
| AI | OpenAI 兼容 API（OpenAI / DeepSeek / Groq / Ollama 等）+ CodeBuddy 内置 AI 测试模式 |
| 数据 | JSON 文件存储（`server/data/`），零外部数据库依赖 |

## 目录结构

```
海龟汤/
├── package.json              # monorepo 根脚本（dev/build 同时驱动前后端）
├── .env.example              # 环境变量模板
├── server/
│   ├── src/
│   │   ├── index.ts          # Express 入口：路由 + Socket.IO + 静态托管 + 全局错误处理
│   │   ├── host.ts           # 主持人引擎：规则匹配 → 历史去重 → AI 增强 → 兜底
│   │   ├── judge.ts          # 裁判引擎：猜测结果判定
│   │   ├── config.ts         # 静态配置（端口、CORS、ADMIN_PASS）
│   │   ├── runtimeConfig.ts  # 运行时配置（从 api-config.json 动态加载 AI 配置）
│   │   ├── types.ts          # 共享类型定义
│   │   ├── ai/               # AI 集成（OpenAI 兼容客户端 + 提示词 + CodeBuddy 测试模式 + 题目生成）
│   │   ├── games/            # 游戏逻辑（全局管理器 + 房间 + 单人会话 + 投稿管理）
│   │   ├── routes/           # REST API（题库、投稿、房间、配置、编辑器）
│   │   ├── socket/           # Socket.IO 事件处理（房间 CRUD + 提问 + 猜测 + 共识 + 聊天）
│   │   └── scripts/          # 辅助脚本（题库扩展、CodeBuddy 代理）
│   └── data/
│       ├── puzzles.json      # 题库
│       ├── submissions.json  # 用户投稿
│       └── api-config.json   # 运行时 AI 配置
├── client/
│   ├── src/
│   │   ├── App.tsx           # 路由：/ /solo /multi /discuss /result /submit /admin /editor
│   │   ├── api.ts            # 前端 API 层：REST + SSE 流式
│   │   ├── socket.ts         # Socket.IO 单例
│   │   ├── index.css         # Tailwind + 暗色悬疑主题
│   │   ├── pages/            # 页面组件（9 个）
│   │   ├── components/       # 通用组件（选择器、聊天面板、引导弹窗、错误边界等）
│   │   ├── hooks/            # 游戏 Hook（单人 SSE / 多人 Socket / 推理共识）
│   │   ├── store/            # Zustand 全局状态
│   │   └── types/            # 前端类型定义
│   └── public/images/        # AI 生成的汤面配图
└── .env                      # 本地环境变量（不提交）
```

## 本地运行

> 需要 Node.js 18+

```bash
# 1. 安装依赖（根 / server / client 三处）
npm run install:all

# 2. 配置环境变量（可选，默认纯规则模式）
cp .env.example .env
# 编辑 .env：填入 AI_API_KEY 并将 USE_AI 改为 true 以启用 AI 增强

# 3. 开发模式（前后端同时启动，热更新）
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001（Vite 已代理 `/api` 与 `/socket.io`）

### 零配置体验

即使不配置任何 AI Key，也可以：

1. 启动项目后，在首页打开 **测试模式（Test Mode）** 开关
2. 使用 CodeBuddy 内置 AI，零配置体验完整功能

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 选择模式、配置 AI、切换测试模式 |
| `/solo` | 单人推理 | 选择汤面 → 提问 → 猜谜 |
| `/multi` | 多人竞速 | 创建/加入房间，抢先猜中者胜 |
| `/discuss` | 多人推理共识 | 协作推理，≥2 人通过即成功 |
| `/result` | 推理结果 | 结果展示 |
| `/submit` | 投稿 | 提交自创题目 |
| `/admin` | 审核台 | 管理员审核投稿 |
| `/editor` | 题库编辑器 | 管理题库 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/solo/start` | 创建单人会话 |
| GET | `/api/solo/ask` | SSE 流式提问 |
| POST | `/api/solo/hint` | 获取渐进提示 |
| POST | `/api/solo/guess` | 提交推理 |
| GET | `/api/puzzles` | 题库列表（可按 `?difficulty=` 过滤） |
| POST | `/api/puzzles/generate` | AI 生成新题目 |
| POST | `/api/submissions` | 玩家投稿 |
| POST | `/api/submissions/:id/approve` | 审核通过（需口令） |
| POST | `/api/submissions/:id/reject` | 审核拒绝 |
| GET | `/api/rooms` | 活跃房间列表 |
| GET/POST | `/api/config` | 获取/更新运行时 AI 配置 |
| WS | `room:create / join / ask / guess` | 多人房间 Socket 事件 |

## 环境变量

```env
# AI 配置
AI_API_KEY=                  # OpenAI 兼容 API Key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo
USE_AI=false                 # 是否启用 AI（false=纯规则零 token）

# 服务配置
PORT=3001
CLIENT_ORIGIN=*

# 管理口令
ADMIN_PASS=turtle-admin-2026

# AI 上下文轮次上限
MAX_CONTEXT_ROUNDS=12
```

## 生产构建

```bash
npm run build:client   # 构建前端静态资源
npm start              # 后端在 3001 端口托管前端，单域名访问
```

访问 http://localhost:3001 即可。

## 部署

后端编译后托管前端静态资源，单进程即可运行：

- **任意 VPS**：上传代码 → `npm run install:all` → `npm run build:client` → `npm start`，用 Nginx/Caddy 反代 3001
- **Cloud Studio**：导入 Git 仓库 → 配置环境变量 → 启动命令 `npm run start:prod` → 自动获得公网 URL（详见下方）
- **CloudBase 云托管**：构建命令 `npm run build:client`，启动命令 `npm start`，监听 `PORT` 环境变量
- AI 密钥仅存在于服务端环境变量，前端永不持有

### Cloud Studio 部署步骤

1. 将项目推送到 GitHub / CNB 仓库
2. 在 [cloudstudio.net](https://cloudstudio.net) 创建应用 → 从 Git 导入
3. 配置环境变量（见下方清单）
4. 启动命令设为 `npm run start:prod`，主端口 `3001`
5. 应用启动后自动获得公网 URL，任何人可访问

**环境变量清单（Cloud Studio）**：

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `AI_API_KEY` | 是 | - | AI 提供商 API Key |
| `AI_BASE_URL` | 否 | `https://api.openai.com/v1` | API 地址 |
| `AI_MODEL` | 否 | `gpt-3.5-turbo` | 模型名称 |
| `USE_AI` | 否 | `false` | 设为 `true` 启用 AI |
| `ADMIN_PASS` | 否 | `turtle-admin-2026` | 审核口令 |
| `PORT` | 否 | `3001` | 服务端口 |
| `CLIENT_ORIGIN` | 否 | `*` | CORS 来源（线上使用通配符） |

项目根目录的 `.vscode/preview.yml` 已配置自动预览，Cloud Studio 会自动识别。

## 设计说明

- 不做玩家账号/登录认证：多人昵称进房、投稿填作者名、审核台单一口令
- 多人房间为内存态，重启即释放（演示/小规模使用足够）
- 默认 `USE_AI=false` 走纯规则引擎，零 token 即可演示；开启 AI 一键升级无需改代码
