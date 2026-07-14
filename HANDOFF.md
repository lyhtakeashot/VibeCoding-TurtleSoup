# 海龟汤 — 存储层异步化改造 转交文档

## 1. 背景与目标

**问题**：原 `cloud-functions/api` 代码中，投稿（submissions）、运行时配置（config）等数据通过同步 `fs.readFileSync/writeFileSync` 读写本地 JSON 文件。部署到 EdgeOne Pages 时，每个云函数实例是**无状态**的，文件写入不会跨实例共享，导致：

- 实例 A 审核通过的投稿，实例 B 看不到
- 配置在 API 修改后，其他实例仍用旧配置

**目标**：将存储抽象化，本地开发保持文件读写，EdgeOne 线上自动切换为 **KV 存储**，实现跨实例数据共享。

---

## 2. 改动总览

### 新增 4 个文件 — 存储抽象层

```
cloud-functions/api/storage/
├── interface.ts      ← 存储接口 IStorage (read/write)
├── fileStorage.ts    ← 本地文件实现
├── kvStorage.ts      ← EdgeOne KV 实现
└── index.ts          ← 单例工厂，自动检测环境
```

### 修改 8 个文件

| 文件 | 改动要点 |
|---|---|
| `games/submissions.ts` | `fs.readFileSync/writeFileSync` → `getStorage().read/write`，全部函数变 `async` |
| `games/manager.ts` | `refreshApproved()` 变 `async`，构造器中不再同步调用 |
| `runtimeConfig.ts` | 新增 `initRuntimeConfig()`，`saveRuntimeConfig` 写入 storage |
| `routes/submit.ts` | 4 个路由 handler 改为 `async` + `await` |
| `routes/editor.ts` | 投稿编辑操作改为 `async`，通过 `readAllSubmissions/writeAllSubmissions` 操作 |
| `routes/puzzles.ts` | AI 生成投稿路径 `createSubmission` 加 `await` |
| `routes/config.ts` | 移除冗余 `loadRuntimeConfig()` 调用 |
| `[[default]].ts` | 入口点新增 `ensureInit()` 异步初始化流程 |

---

## 3. 核心架构

### 3.1 存储接口

```typescript
// cloud-functions/api/storage/interface.ts
interface IStorage {
  read<T = any>(key: string): Promise<T | null>;
  write<T = any>(key: string, data: T): Promise<void>;
}

// 预定义 key
const StorageKeys = {
  submissions: 'submissions',
  config: 'config',
  puzzles: 'puzzles',
}
```

### 3.2 双模式自动切换

```typescript
// cloud-functions/api/storage/index.ts
export function getStorage(): IStorage {
  // 检测全局是否有 KV namespace 绑定
  if (isEdgeOneRuntime()) {
    return new KVStorage();   // 线上 → KV
  } else {
    return new FileStorage();  // 本地 → JSON 文件
  }
}
```

- **FileStorage**：读写 `cloud-functions/data/` 下的 JSON 文件（`submissions.json`、`api-config.json`）
- **KVStorage**：通过 `globalThis.__EOP_KV__` 访问 EdgeOne KV（自动回退兼容 `__KV__` / `kv`）

### 3.3 首次部署数据迁移

入口点 `[[default]].ts` 启动时执行三阶段初始化：

```typescript
async function ensureInit(): Promise<void> {
  // 1. 初始化运行时配置（优先 storage，回退文件 + 环境变量）
  await initRuntimeConfig();
  // 2. 从文件迁移投稿数据到 storage（仅首次，已有数据不覆盖）
  await migrateSubmissionsFromFile();
  // 3. 加载审核通过的投稿到内存题库
  await manager.refreshApproved();
}
```

- `migrateSubmissionsFromFile()` 只在 KV 为空时执行，避免覆盖线上数据
- 初始化通过 `void ensureInit()` 立即触发，不阻塞模块导出

### 3.4 投稿读写流程

```
投稿创建/审核
   ↓
submissions.ts: readAll() → storage.read('submissions')
   ↓ 如果 KV 为空
   回退到 readFromFileSync()（本地 JSON 文件）
   ↓ 写入
   storage.write('submissions', list)
   ↓
   所有实例下次读取时共享同一份 KV 数据
```

---

## 4. 关键改动细节

### 4.1 `submissions.ts` — 回退机制

保留 `readFromFileSync()` 作为兜底。`readAll()` 先尝试 storage，若返回 `null` 则回退到文件：

```typescript
async function readAll(): Promise<Submission[]> {
  const data = await storage.read<Submission[]>('submissions');
  if (data !== null) return data;
  return readFromFileSync();  // 首次运行时 storage 为空
}
```

### 4.2 `manager.ts` — 异步初始化

`refreshApproved()` 从同步变异步，构造函数不再调用它，改由入口点显式调用：

```typescript
constructor() {
  this.basePuzzles = loadBasePuzzles();
  // refreshApproved() 改为异步，由入口点显式调用
}
```

### 4.3 `runtimeConfig.ts` — 配置持久化

- 模块加载时先用 `loadFromFile()` 同步初始化（确保同步访问不崩溃）
- `initRuntimeConfig()` 异步加载 storage 配置并覆盖
- `saveRuntimeConfig()` 同时更新内存和 storage
- 环境变量（`AI_API_KEY` 等）优先级最高

### 4.4 `editor.ts` — 本地题库文件读写保留

`readPuzzles()` 和 `writePuzzles()` 仍然使用同步 `fs` 操作 `puzzles.json`，因为这是静态题库，不涉及跨实例共享。

---

## 5. 部署前需要做的

### 在 EdgeOne Pages 控制台

1. **创建 KV 存储命名空间**（如命名为 `turtle-soup-kv`）
2. **绑定 KV 到云函数项目**，确保运行时能通过以下任一方式访问：
   - `globalThis.__EOP_KV__`
   - `globalThis.__KV__`
   - `globalThis.kv`
3. **配置环境变量**：
   - `ADMIN_PASS` — 管理员审核口令（默认 `turtle-admin-2026`）
   - `AI_API_KEY`（可选）— 外部 AI Key
   - `AI_BASE_URL`（可选）— AI API 地址
   - `AI_MODEL`（可选）— AI 模型名

### 本地测试

```bash
# 启动后端（使用 FileStorage）
npm run dev:server

# 启动前端
npm run dev:client
```

本地环境中 `isEdgeOneRuntime()` 返回 `false`，自动使用 `FileStorage`，行为与改造前一致。

---

## 6. 注意事项 & 潜在问题

### 6.1 KV 绑定名称

当前 `kvStorage.ts` 尝试了 3 种全局变量名：

```typescript
g.__EOP_KV__ || g.__KV__ || g.kv
```

如果 EdgeOne 实际绑定的名称不同，需要在 `kvStorage.ts:getKVNamespace()` 中增加对应的检查。

### 6.2 KV 写入限制

EdgeOne KV 的 value 可能有大小限制。如果投稿数据量非常大（数千条），单个 key 可能超出限制。当前设计是**全量读写**（整个 `submissions` 数组作为一个 value），如果数据量增长需要考虑分页存储。

### 6.3 并发安全

当前读写模式是 "读 → 修改 → 写"，没有用锁。在高并发场景（如多个管理员同时审核）可能存在竞态条件。对于轻量级使用通常没问题，但如果需要可以后续加乐观锁（版本号）。

### 6.4 编辑器 — base puzzle 修改

编辑本地题库（非 `sub_` 前缀的题目）仍然直接写 `puzzles.json`，并返回提示 "将在服务重启后生效"。这是因为 `manager` 构造器只在启动时调用 `loadBasePuzzles()`。

### 6.5 Server 端未改动

`server/` 目录下的代码完全未动。这个改造仅针对 `cloud-functions/api/` 下的 EdgeOne Pages 云函数代码。两套代码目前独立维护。

### 6.6 TypeScript 编译

`cloud-functions/package.json` 中的构建配置需要在部署前确认，确保 `storage/` 目录下的新文件会被包含在编译输出中。

---

## 7. 文件清单

| 状态 | 文件路径 | 说明 |
|---|---|---|
| ✨ 新增 | `cloud-functions/api/storage/interface.ts` | 存储接口和 Key 常量 |
| ✨ 新增 | `cloud-functions/api/storage/fileStorage.ts` | 文件存储实现 |
| ✨ 新增 | `cloud-functions/api/storage/kvStorage.ts` | KV 存储实现 + 环境检测 |
| ✨ 新增 | `cloud-functions/api/storage/index.ts` | 工厂函数 |
| 🔧 修改 | `cloud-functions/api/games/submissions.ts` | 异步存储改造 + 回退机制 |
| 🔧 修改 | `cloud-functions/api/games/manager.ts` | refreshApproved 异步化 |
| 🔧 修改 | `cloud-functions/api/runtimeConfig.ts` | 配置持久化到 storage |
| 🔧 修改 | `cloud-functions/api/routes/submit.ts` | 路由 handler 加 async/await |
| 🔧 修改 | `cloud-functions/api/routes/editor.ts` | 投稿编辑异步化 |
| 🔧 修改 | `cloud-functions/api/routes/puzzles.ts` | AI 生成路径 await |
| 🔧 修改 | `cloud-functions/api/routes/config.ts` | 移除冗余 reload |
| 🔧 修改 | `cloud-functions/api/[[default]].ts` | 启动异步初始化 |
| — 未改 | `cloud-functions/api/config.ts` | 无变化（getter 代理） |
| — 未改 | `cloud-functions/api/types.ts` | 无变化 |
| — 未改 | `server/` 所有文件 | 不涉及 |

---

## 8. 后续改进建议

1. **添加 KV 写入版本号**：防止并发覆盖（如上文 6.3 所述）
2. **投稿分页存储**：当数据量大时，拆分为 `submissions_page_0`、`submissions_page_1` 等
3. **增加存储健康检查端点**：`GET /api/health/storage` 返回当前使用的存储类型和连接状态
4. **统一 cloud-functions 和 server**：长期来看两套代码可以共用同一套存储抽象

---

## 快速导航

如果新接手的同事需要了解项目，建议按以下顺序阅读代码：

1. `cloud-functions/api/storage/interface.ts` — 理解存储设计意图
2. `cloud-functions/api/[[default]].ts` — 理解初始化流程
3. `cloud-functions/api/storage/index.ts` — 双模式切换逻辑
4. `cloud-functions/api/games/submissions.ts` — 投稿读写完整链路
