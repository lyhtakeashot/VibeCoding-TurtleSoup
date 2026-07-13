// EdgeOne Pages Cloud Functions: 环境变量由平台注入，无需 dotenv
import { getRuntimeConfig, isAIEnabled, hasAIKey, isTestMode } from './runtimeConfig.js';

export const config = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  adminPass: process.env.ADMIN_PASS || 'turtle-admin-2026',
  maxContextRounds: Number(process.env.MAX_CONTEXT_ROUNDS || 12),

  /** 是否启用 AI 增强 */
  get useAI(): boolean {
    return isAIEnabled();
  },

  /** AI 配置 */
  get ai() {
    const rt = getRuntimeConfig();
    return {
      apiKey: rt.apiKey || process.env.AI_API_KEY || '',
      baseURL: rt.baseURL || process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      model: rt.model || process.env.AI_MODEL || 'gpt-3.5-turbo',
    };
  },

  /** 是否具备可用的 AI Key */
  get hasAIKey(): boolean {
    return hasAIKey();
  },

  /** 测试模式：开启后无需外部 Key，使用 CodeBuddy 内置 AI */
  get testMode(): boolean {
    return isTestMode();
  },
};

export type AppConfig = typeof config;
