# 海龟汤 · AI 主持

腾讯云黑客松 **AI 创作大赛** 参赛作品：一款 Web H5 情境推理（海龟汤）游戏。
由 **腾讯混元 Hunyuan** 担任主持人，规则引擎直答 + AI 增强，暗色悬疑推理风，
支持单人沉浸推理、多人实时竞速、玩家投稿审核与推理进度图谱可视化。

## 特性

- 🕵️ **单人推理**：向主持人提「是/否」类问题，流式打字机回答，可请求渐进提示，达上限后提交推理/揭晓。
- ⚡ **多人竞速**：昵称进房，共享同一汤面与问答，先猜中汤底者胜（Socket.IO 实时同步）。
- 🧠 **规则引擎 + 混元增强**：直球问题零 token 命中预置答案；模糊问题在开启混元时交由模型作答。
- 🕸️ **推理进度图谱**：每条 Q/A 以时间线节点呈现，按「是/否/无关」着色，点击查看详情。
- ✍️ **玩家投稿 + 审核台**：提交自创题目，管理员口令审核通过后并入题库。
- 🎨 **AI 生成配图**：每道汤面配暗色悬疑封面（已生成于 `client/public/images`）。

## 默认运行模式（纯规则，零 token）

当前 `USE_AI=false` 且未配置密钥，系统走**纯规则主持人**：直球问题查预置答案表，
模糊问题走通用兜底，演示完全可跑、不消耗 token。混元接口已保留，拿到密钥后
在 `.env` 设 `USE_AI=true` 即一键升级为 AI 增强，无需改代码。

## 技术栈

- 前端：React 18 + Vite + TypeScript + Tailwind CSS + zustand + @xyflow/react
- 后端：Node.js + Express + Socket.IO + TypeScript（BFF 单体，托管前端静态资源 + 混元代理）
- AI：腾讯云混元 `hunyuan-lite`（通过后端代理保护密钥）

## 目录结构

```
海龟汤/
├── package.json          # 根 monorepo 脚本（dev/build 同时驱动前后端）
├── .env.example          # 环境变量模板
├── server/               # 后端（Express + Socket.IO + 混元代理 + 规则引擎）
│   └── src/  config / host / judge / hunyuan / games / routes / socket
│   └── data/ puzzles.json（题库）, submissions.json（投稿）
├── client/               # 前端（页面 + 组件 + hooks + store）
│   └── public/images/    # AI 生成的汤面配图 p1~p9
└── README.md
```

## 本地运行

> 需要 Node.js 18+。下列命令以 `npm.cmd` 为例（PowerShell 环境请使用 `npm.cmd`）。

1. 安装依赖（根 / server / client 三处）：

   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

2. 配置环境变量（可选，已有 `.env` 默认纯规则模式）：

   ```bash
   cp .env.example .env
   # 编辑 .env：填入 TENCENT_SECRET_ID/KEY 并将 USE_AI 改为 true 以启用混元
   ```

3. 开发模式（前后端同时启动，前端热更新）：

   ```bash
   npm run dev
   ```

   - 前端：http://localhost:5173
   - 后端：http://localhost:3001 （Vite 已代理 `/api` 与 `/socket.io`）

4. 仅启动后端（用 tsx 热重载）：

   ```bash
   npm run dev:server
   ```

## 生产构建

```bash
npm run build          # 编译 server + 构建 client 到 client/dist
npm start              # 后端在 3001 端口托管前端静态资源，单域名访问
```

之后访问 http://localhost:3001 即可。

## 关键接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/solo/start` | 创建单人会话，返回 sessionId 与题目 |
| GET  | `/api/solo/ask` | SSE 流式提问（逐字推送主持人回答） |
| POST | `/api/solo/hint` | 揭示下一条渐进提示 |
| POST | `/api/solo/guess` | 提交推理，判定是否猜中 |
| GET  | `/api/puzzles` | 题库列表（可按 `?difficulty=` 过滤） |
| POST | `/api/submissions` | 玩家投稿 |
| GET/POST | `/api/submissions/:id/approve\|reject` | 审核（需 `?pass=` 或 body `pass`） |
| WS  | `room:create / room:join / room:ask / room:guess` | 多人房间事件 |

## 部署到腾讯云（演示收尾阶段）

后端编译后托管前端静态资源，单进程即可运行，可直接部署到：

- **腾讯云轻量应用服务器**：上传代码，`npm install`（三处）、`npm run build`、`npm start`，
  用 Nginx/Caddy 反代 3001 或直接以 `PORT=80` 运行。
- **CloudBase 云托管**：以 `npm run build && npm start` 为构建/启动命令，监听 `PORT`。

密钥仅存在于服务端 `.env`，前端永不持有。

## 说明

- 不做玩家账号/登录认证：多人昵称进房、投稿填作者名、审核台单一口令。
- 多人房间为内存态，重启可重建（黑客松演示足够）。
