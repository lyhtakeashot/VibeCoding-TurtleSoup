import { Router } from 'express';
import { loadRuntimeConfig, saveRuntimeConfig, getRuntimeConfig } from '../runtimeConfig.js';

export const configRouter = Router();

// GET /api/config — 返回当前配置（密钥脱敏）
configRouter.get('/', (_req, res) => {
  const cfg = getRuntimeConfig();
  // 掩码处理：只展示前后几位
  function mask(s: string): string {
    if (!s) return '';
    if (s.length <= 8) return '••••';
    return s.slice(0, 4) + '••••' + s.slice(-4);
  }
  res.json({
    apiKey: mask(cfg.apiKey),
    baseURL: cfg.baseURL,
    model: cfg.model,
    useAI: cfg.useAI,
    hasKey: Boolean(cfg.apiKey),
    testMode: cfg.testMode,
  });
});

// PUT /api/config — 更新配置（运行时写入 api-config.json，动态生效）
configRouter.put('/', async (req, res) => {
  try {
    const b = req.body || {};
    const updated: Record<string, string | boolean> = {};

    if (typeof b.apiKey === 'string' && b.apiKey.trim()) {
      updated.apiKey = b.apiKey.trim();
    }
    if (typeof b.baseURL === 'string' && b.baseURL.trim()) {
      updated.baseURL = b.baseURL.trim();
    }
    if (typeof b.model === 'string' && b.model.trim()) {
      updated.model = b.model.trim();
    }
    if (typeof b.useAI === 'boolean') {
      updated.useAI = b.useAI;
    }
    if (typeof b.testMode === 'boolean') {
      updated.testMode = b.testMode;
    }

    if (Object.keys(updated).length === 0) {
      return res.status(400).json({ error: '没有提供需要更新的配置项' });
    }

    await saveRuntimeConfig(updated);
    // 立即让 config 生效
    loadRuntimeConfig();

    // 重置 AI 客户端（兼容接口调用）
    const { resetAIClient } = await import('../ai/client.js');
    resetAIClient();
    const { resetGeneratorClient } = await import('../ai/puzzleGenerator.js');
    resetGeneratorClient();

    return res.json({ ok: true, updated: Object.keys(updated) });
  } catch (e) {
    console.error('[config] 保存失败:', e);
    return res.status(500).json({ error: '配置保存失败' });
  }
});

// POST /api/config/verify — 验证 API 密钥是否有效
configRouter.post('/verify', async (req, res) => {
  try {
    const { apiKey, baseURL, model } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ ok: false, error: '请提供 API Key' });
    }

    const testBaseURL = (typeof baseURL === 'string' && baseURL.trim())
      ? baseURL.trim().replace(/\/+$/, '')
      : 'https://api.openai.com/v1';
    const testModel = (typeof model === 'string' && model.trim()) || 'gpt-3.5-turbo';

    // 使用原生 fetch 发送 OpenAI 格式测试请求，10 秒超时
    const resp = await fetch(`${testBaseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(apiKey).trim()}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      let errMsg = `HTTP ${resp.status}`;
      try {
        const errJson = JSON.parse(errBody);
        errMsg = errJson?.error?.message || errMsg;
      } catch {}
      return res.json({ ok: false, error: `密钥验证失败：${errMsg}` });
    }

    return res.json({ ok: true, message: `密钥验证通过，${testBaseURL} 连接成功` });
  } catch (e) {
    const errMsg = (e as Error).message || '未知错误';
    console.error('[config] 密钥验证失败:', errMsg);
    return res.json({ ok: false, error: `密钥验证失败：${errMsg}` });
  }
});
