import sys
sys.path.insert(0, r"C:\Users\lyh\.workbuddy\skills\pptx-creator\scripts")
from create_pptx import create_presentation

slides = [
    {
        "layout": "title",
        "title": "海龟汤 · AI 主持",
        "subtitle": "一款 Web 全栈情境推理游戏的介绍",
    },
    {
        "layout": "section",
        "title": "游戏简介",
        "subtitle": "海龟汤 / 情境推理 / Lateral Thinking Puzzle",
    },
    {
        "layout": "content",
        "title": "什么是「海龟汤」",
        "content": [
            "一种情境推理游戏：由「汤面」（离奇谜面）与「汤底」（真相）组成",
            "玩家只向主持人提问，得到的回答只有「是 / 否 / 无关」",
            "源自欧美 Lateral Thinking Puzzle，因经典谜题「海龟汤」得名",
            "考验逻辑推理、联想能力与细节观察，设定越离奇越烧脑",
        ],
        "notes": "用一句话概括：用最少的线索，拼出最不可思议的真相。",
    },
    {
        "layout": "content",
        "title": "核心玩法",
        "content": [
            "选择一道汤面，进入推理",
            "向 AI 主持人提问，获得「是/否/无关」流式回答",
            "卡关时可请求渐进提示（Hint）",
            "达到提问上限后提交你的推理",
            "AI 判定得分并揭晓完整汤底",
        ],
        "notes": "单人模式完整走通「提问—提示—猜谜—揭晓」闭环。",
    },
    {
        "layout": "section",
        "title": "三种游戏模式",
        "subtitle": "单人沉浸 · 多人竞速 · 多人推理共识",
    },
    {
        "layout": "content",
        "title": "🕵️ 单人沉浸推理",
        "content": [
            "向 AI 主持人自由提问，SSE 流式「打字机」式回答",
            "难度分档：简单 / 中等 / 困难 / 无限",
            "规则引擎兜底：直球问题零 token 命中预置答案",
            "模糊问题交由 AI 流式作答，体验更自然",
        ],
        "notes": "单人是核心体验，强调沉浸感与节奏控制。",
    },
    {
        "layout": "content",
        "title": "⚡ 多人竞速 & 💬 推理共识",
        "content": [
            "多人竞速：昵称进房，共享汤面与问答，先猜中汤底者胜",
            "Socket.IO 实时同步，提问与猜测全员可见",
            "推理共识：多人协作模式，≥2 人达成共识即算通过",
            "适合朋友聚会、团建破冰、线上推理派对",
        ],
        "notes": "多人模式强调互动与协作，提升重玩价值。",
    },
    {
        "layout": "section",
        "title": "AI 主持 & 内容生态",
        "subtitle": "规则引擎 + AI 增强 · 玩家共创",
    },
    {
        "layout": "content",
        "title": "🧠 规则引擎 + AI 增强",
        "content": [
            "直球问题命中预置答案，零 token 即可演示",
            "模糊问题交由 AI 流式作答，回答更自然",
            "支持 OpenAI / DeepSeek / Groq / Ollama 等任意 OpenAI 兼容 API",
            "首页可视化切换 AI 配置，一键启用",
        ],
        "notes": "成本与体验兼顾：规则兜底省钱，AI 增强提质。",
    },
    {
        "layout": "content",
        "title": "🧪 测试模式 & 多 AI 提供商",
        "content": [
            "测试模式：启用 CodeBuddy 内置 AI，无需外部 Key 即可体验",
            "自由接入 OpenAI / DeepSeek / Grok / Ollama 等",
            "AI 密钥仅存于服务端，前端永不持有，安全合规",
            "零配置启动：默认纯规则模式，开箱即玩",
        ],
        "notes": "降低体验门槛，让没有 API Key 的用户也能完整体验。",
    },
    {
        "layout": "content",
        "title": "✍️ 玩家投稿 + 审核台",
        "content": [
            "提交自创题目，支持批量文本解析（AI 智能识别汤面/汤底）",
            "管理员口令审核通过后自动并入题库",
            "题库编辑器：增删改题目、难度、标签、提示",
            "玩家共创，让题库持续生长",
        ],
        "notes": "UGC 闭环是内容长期供给的关键。",
    },
    {
        "layout": "content",
        "title": "🎨 AI 生成配图",
        "content": [
            "每道汤面配有暗色悬疑风格封面",
            "强化「烧脑推理」的氛围感",
            "视觉与玩法统一，提升沉浸体验",
        ],
        "notes": "美术风格统一为暗色悬疑，贴合游戏调性。",
    },
    {
        "layout": "section",
        "title": "技术架构 & 部署",
        "subtitle": "全栈 Web · 零数据库依赖 · 一键上线",
    },
    {
        "layout": "content",
        "title": "🛠 技术栈",
        "content": [
            "前端：React 18 · TypeScript · Vite 5 · Tailwind CSS · Zustand",
            "后端：Node.js · Express 4 · Socket.IO · TypeScript",
            "AI：OpenAI 兼容 API + CodeBuddy 内置测试模式",
            "数据：JSON 文件存储，零外部数据库依赖",
            "部署：EdgeOne Pages 云函数 + 静态托管",
        ],
        "notes": "轻量技术栈，便于二次开发与快速部署。",
    },
    {
        "layout": "content",
        "title": "🚀 部署与访问",
        "content": [
            "EdgeOne Pages：前端静态资源 + 云函数 API 一体化",
            "亦支持本地 VPS / Cloud Studio / CloudBase 云托管",
            "AI 密钥仅存在于服务端环境变量",
            "获得公网 URL 即邀请好友一起推理",
        ],
        "notes": "当前线上预览链接受 EdgeOne 认证限制，建议绑定自定义域名。",
    },
    {
        "layout": "end",
        "title": "谢谢观看",
        "subtitle": "海龟汤 · AI 主持 — 一起推理，揭开真相",
    },
]

out = r"D:\Desktop\VibeCoding\海龟汤\海龟汤游戏介绍.pptx"
create_presentation(title="海龟汤 · AI 主持 游戏介绍", slides_data=slides, author="WorkBuddy", output_path=out)
print("DONE:", out)
