import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuideModal, isGuideSeen } from '../components/GuideModal';
import { api } from '../api';
import type { ApiConfig } from '../api';

// ── API 提供商预设 ──
interface Provider {
  name: string;
  baseURL: string;
  models: string[];
  keyUrl?: string;
  note?: string;
}
const AI_PROVIDERS: Record<string, Provider> = {
  custom: { name: '自定义', baseURL: '', models: [] },
  codebuddy: { name: 'CodeBuddy 内置 (零配置测试)', baseURL: 'http://localhost:11435/v1', models: ['codebuddy-default'], keyUrl: undefined, note: '使用 CodeBuddy AI 积分，启动代理: npx tsx server/src/scripts/codebuddy-proxy.ts' },
  openai: { name: 'OpenAI', baseURL: 'https://api.openai.com/v1', models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o4-mini', 'o3-mini'], keyUrl: 'https://platform.openai.com/api-keys' },
  deepseek: { name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'], keyUrl: 'https://platform.deepseek.com/api_keys' },
  groq: { name: 'Groq', baseURL: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'], keyUrl: 'https://console.groq.com/keys' },
  hunyuan: { name: '腾讯混元 (TokenHub)', baseURL: 'https://api.hunyuan.cloud.tencent.com/v1', models: ['hunyuan-turbos-latest', 'hunyuan-t1-latest', 'hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro'], keyUrl: 'https://cloud.tencent.com/document/product/1729/131925' },
  tencentcloud: { name: '腾讯云 TI 平台', baseURL: 'https://api.lkeap.cloud.tencent.com/v1', models: ['deepseek-v3-0324', 'deepseek-r1-0528', 'hunyuan-turbos-latest'], keyUrl: 'https://console.cloud.tencent.com/lkeap/api' },
  siliconflow: { name: '硅基流动 (SiliconFlow)', baseURL: 'https://api.siliconflow.cn/v1', models: ['Pro/deepseek-ai/DeepSeek-V3', 'Pro/deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Pro/Qwen/Qwen2.5-7B-Instruct', 'Pro/meta-llama/Llama-3.3-70B-Instruct'], keyUrl: 'https://cloud.siliconflow.cn/account/ak' },
  together: { name: 'Together AI', baseURL: 'https://api.together.xyz/v1', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'], keyUrl: 'https://api.together.xyz/settings/api-keys' },
  fireworks: { name: 'Fireworks AI', baseURL: 'https://api.fireworks.ai/inference/v1', models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/deepseek-v3', 'accounts/fireworks/models/qwen2p5-72b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct'], keyUrl: 'https://fireworks.ai/api-keys' },
  mistral: { name: 'Mistral AI', baseURL: 'https://api.mistral.ai/v1', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'pixtral-large-latest', 'codestral-latest', 'ministral-8b-latest'], keyUrl: 'https://console.mistral.ai/api-keys' },
  openrouter: { name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'anthropic/claude-3-opus', 'google/gemini-2.5-pro-exp-03-25', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat', 'deepseek/deepseek-r1'], keyUrl: 'https://openrouter.ai/keys' },
  xai: { name: 'xAI (Grok)', baseURL: 'https://api.x.ai/v1', models: ['grok-2-1212', 'grok-2-vision-1212', 'grok-beta'], keyUrl: 'https://console.x.ai' },
  moonshot: { name: '月之暗面 (Moonshot)', baseURL: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'moonshot-v1-auto'], keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
  zhipu: { name: '智谱 AI (GLM)', baseURL: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus', 'glm-4-long'], keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  qwen: { name: '阿里通义千问 (DashScope)', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-max-longcontext', 'qwen-vl-max', 'qwen-vl-plus', 'deepseek-v3', 'deepseek-r1'], keyUrl: 'https://bailian.console.aliyun.com/' },
  stepfun: { name: '阶跃星辰 (StepFun)', baseURL: 'https://api.stepfun.com/v1', models: ['step-2-16k', 'step-1-8k', 'step-1-flash', 'step-1v-8k', 'step-1.5v-mini'], keyUrl: 'https://platform.stepfun.com' },
  minimax: { name: 'MiniMax', baseURL: 'https://api.minimax.chat/v1', models: ['abab6.5s-chat', 'abab6.5t-chat', 'abab7-chat-preview'], keyUrl: 'https://platform.minimaxi.com/user-center/basic-information' },
  lingyi: { name: '零一万物 (Yi)', baseURL: 'https://api.lingyiwanwu.com/v1', models: ['yi-large', 'yi-medium', 'yi-vision', 'yi-lightning'], keyUrl: 'https://platform.lingyiwanwu.com' },
  deepinfra: { name: 'DeepInfra', baseURL: 'https://api.deepinfra.com/v1/openai', models: ['meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'microsoft/Phi-4', 'microsoft/Phi-4-multimodal-instruct'], keyUrl: 'https://deepinfra.com/dash/api_keys' },
  lambda: { name: 'Lambda Labs', baseURL: 'https://api.lambdalabs.com/v1', models: ['hermes-3-llama-3.1-405b', 'qwen2.5-72b', 'deepseek-r1'], keyUrl: 'https://cloud.lambdalabs.com/api-keys' },
  novita: { name: 'Novita AI', baseURL: 'https://api.novita.ai/v3/openai', models: ['meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-v3', 'deepseek/deepseek-r1', 'qwen/qwen-2.5-72b-instruct'], keyUrl: 'https://novita.ai/dashboard/key' },
  hyperbolic: { name: 'Hyperbolic', baseURL: 'https://api.hyperbolic.xyz/v1', models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct'], keyUrl: 'https://app.hyperbolic.xyz/settings' },
  doubao: { name: '豆包 (火山引擎)', baseURL: 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-pro-32k', 'doubao-lite-32k', 'ep-20250101000000-deepseek-v3', 'ep-20250101000000-deepseek-r1'], keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint' },
  ollama: { name: 'Ollama (本地)', baseURL: 'http://localhost:11434/v1', models: ['qwen2.5', 'llama3.2', 'mistral', 'deepseek-r1:14b', 'gemma2', 'phi4', 'codellama'], keyUrl: undefined },
};

// 提供商分组展示
const PROVIDER_GROUPS: { label: string; keys: string[] }[] = [
  { label: '零配置测试', keys: ['codebuddy'] },
  { label: '国际主流', keys: ['openai', 'groq', 'together', 'mistral', 'openrouter', 'xai', 'deepinfra', 'fireworks', 'lambda', 'novita', 'hyperbolic'] },
  { label: '国内平台', keys: ['deepseek', 'hunyuan', 'tencentcloud', 'siliconflow', 'moonshot', 'zhipu', 'qwen', 'stepfun', 'minimax', 'lingyi', 'doubao'] },
  { label: '本地 / 其他', keys: ['ollama', 'custom'] },
];

export function Home() {
  const navigate = useNavigate();

  const [guideOpen, setGuideOpen] = useState(false);

  // API 配置
  const [configOpen, setConfigOpen] = useState(false);
  const [apiCfg, setApiCfg] = useState<ApiConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [cfgForm, setCfgForm] = useState({
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    useAI: false,
    testMode: false,
  });
  const [provider, setProvider] = useState('custom');

  const fetchConfig = useCallback(async () => {
    setCfgLoading(true);
    try {
      const c = await api.getConfig();
      setApiCfg(c);
      setCfgForm({ apiKey: '', baseURL: c.baseURL, model: c.model, useAI: c.useAI, testMode: c.testMode });
    } catch {
      setApiCfg(null);
    } finally {
      setCfgLoading(false);
    }
  }, []);

  // 快速切换测试模式
  const toggleTestMode = async () => {
    const next = !cfgForm.testMode;
    setCfgForm((f) => ({ ...f, testMode: next }));
    try {
      const input: Record<string, string | boolean> = { testMode: next };
      input.useAI = next ? true : cfgForm.useAI;
      await api.updateConfig(input);
      await fetchConfig();
    } catch (e) {
      setCfgMsg(`切换失败：${(e as Error).message}`);
      setCfgForm((f) => ({ ...f, testMode: !next }));
    }
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    setCfgMsg('');
    try {
      const input: Record<string, string | boolean> = {};
      if (cfgForm.apiKey.trim()) input.apiKey = cfgForm.apiKey.trim();
      if (cfgForm.baseURL) input.baseURL = cfgForm.baseURL;
      if (cfgForm.model) input.model = cfgForm.model;
      input.useAI = cfgForm.useAI;
      await api.updateConfig(input);
      setCfgMsg('配置已保存，即时生效');
      setCfgForm((f) => ({ ...f, apiKey: '' }));
      await fetchConfig();
    } catch (e) {
      setCfgMsg(`保存失败：${(e as Error).message}`);
    } finally {
      setCfgSaving(false);
    }
  };

  const testConnection = async () => {
    if (!cfgForm.apiKey.trim()) {
      setVerifyMsg({ ok: false, text: '请先填写 API Key' });
      return;
    }
    setTesting(true);
    setVerifyMsg(null);
    try {
      const result = await api.verifyConfig({
        apiKey: cfgForm.apiKey.trim(),
        baseURL: cfgForm.baseURL,
        model: cfgForm.model,
      });
      if (result.ok) {
        setVerifyMsg({ ok: true, text: result.message || '连接成功' });
      } else {
        setVerifyMsg({ ok: false, text: result.error || '验证失败' });
      }
    } catch (e) {
      setVerifyMsg({ ok: false, text: `验证失败：${(e as Error).message}` });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (!isGuideSeen()) {
      setGuideOpen(true);
    }
  }, []);

  useEffect(() => {
    if (configOpen) fetchConfig();
  }, [configOpen, fetchConfig]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <section className="text-center py-12">
        <div className="text-xs tracking-[0.3em] text-white/40 mb-4">
          SITUATIONAL PUZZLE · AI-POWERED MYSTERY GAME
        </div>
        <h1 className="text-5xl md:text-6xl font-display font-bold neon-text mb-4">
          海龟汤 · AI 主持
        </h1>
        <p className="text-white/60 max-w-xl mx-auto leading-relaxed">
          向神秘主持人抛出「是 / 否」类问题，在层层线索中推理出隐藏的真相（汤底）。
          {' '}
          支持 OpenAI、DeepSeek、Groq 等任意 OpenAI 兼容模型，规则引擎直答 + AI 增强，零卡顿沉浸推理。
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {/* 模式选择：点击直接进入对应玩法 */}
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => navigate('/solo')}
              className="glass px-6 py-5 w-44 text-left transition-all hover:shadow-glow"
            >
              <div className="text-lg font-semibold mb-1">🕵️ 单人推理</div>
              <div className="text-xs text-white/50">沉浸推理 · 流式问答</div>
            </button>
            <button
              onClick={() => navigate('/multi')}
              className="glass px-6 py-5 w-44 text-left transition-all hover:shadow-glow-purple"
            >
              <div className="text-lg font-semibold mb-1">多人联机</div>
              <div className="text-xs text-white/50">竞速对战 · 推理共议</div>
            </button>
          </div>

          <div className="flex gap-4 mt-4 text-sm">
            <button
              onClick={() => navigate('/submit')}
              className="text-white/60 hover:text-neon-cyan"
            >
              ✍️ 投稿海龟汤
            </button>
            <span className="text-white/20">·</span>
            <button
              onClick={() => navigate('/admin')}
              className="text-white/60 hover:text-neon-purple"
            >
              🛡️ 审核台
            </button>
            <span className="text-white/20">·</span>
            <button
              onClick={() => navigate('/editor')}
              className="text-white/60 hover:text-amber-400/80"
            >
              🔧 编辑题库
            </button>
          </div>

          {/* API 配置 */}
          <div className="mt-6 w-full max-w-md mx-auto">
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 mx-auto"
            >
              <span>{configOpen ? '▾' : '▸'}</span>
              ⚙️ 配置 API{apiCfg ? (apiCfg.hasKey && apiCfg.useAI ? ' · 已启用' : ' · 未启用') : ''}
            </button>

            {configOpen && (
              <div className="glass p-5 mt-3 text-left space-y-4 animate-fade-in">
                {/* 测试模式开关 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/15">
                  <div>
                    <div className="text-sm text-white/80 font-semibold">🧪 测试模式</div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {cfgForm.testMode
                        ? '使用 CodeBuddy 内置 AI 积分，无需外部 API Key'
                        : '开启后零配置试玩，用 CodeBuddy AI 积分驱动'}
                    </div>
                  </div>
                  <button
                    onClick={toggleTestMode}
                    className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                      cfgForm.testMode ? 'bg-green-500/70' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        cfgForm.testMode ? 'left-6' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* 外部 API 配置（测试模式关闭时或高级用户需要） */}
                {!cfgForm.testMode && (
                  <>
                {/* 状态指示 */}
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      apiCfg?.hasKey && apiCfg?.useAI
                        ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                        : 'bg-white/30'
                    }`}
                  />
                  <span className="text-white/70">
                    {cfgLoading
                      ? '加载中…'
                      : apiCfg?.hasKey && apiCfg?.useAI
                      ? 'AI 增强已启用'
                      : 'AI 增强未启用'}
                  </span>
                  {apiCfg?.hasKey && apiCfg?.useAI && (
                    <span className="text-xs text-white/40 ml-auto">
                      模型：{apiCfg.model}
                    </span>
                  )}
                </div>

                {/* API 提供商 */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">API 提供商</label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProvider(v);
                      const p = AI_PROVIDERS[v];
                      if (p && p.baseURL) {
                        setCfgForm((f) => ({
                          ...f,
                          baseURL: p.baseURL,
                          model: p.models[0] || f.model,
                        }));
                      }
                    }}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  >
                    {PROVIDER_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.keys.map((key) => (
                          <option key={key} value={key}>
                            {AI_PROVIDERS[key]?.name || key}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">
                    API Base URL
                    {apiCfg?.baseURL && (
                      <span className="text-white/30"> (当前：{apiCfg.baseURL})</span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    value={cfgForm.baseURL}
                    onChange={(e) => {
                      setCfgForm((f) => ({ ...f, baseURL: e.target.value }));
                      setProvider('custom');
                    }}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">
                    API Key {apiCfg?.apiKey && <span className="text-white/30">(当前：{apiCfg.apiKey})</span>}
                  </label>
                  <input
                    type="password"
                    placeholder={apiCfg?.hasKey ? '留空则保持不变' : '填写 API Key（sk-...）'}
                    value={cfgForm.apiKey}
                    onChange={(e) => setCfgForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                  />
                </div>

                {/* 模型 & AI 开关 */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-white/50 mb-1">模型</label>
                    <input
                      type="text"
                      placeholder="输入模型名，或从下方建议中选择"
                      value={cfgForm.model}
                      onChange={(e) => setCfgForm((f) => ({ ...f, model: e.target.value }))}
                      list={`model-datalist`}
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                    />
                    <datalist id="model-datalist">
                      {(AI_PROVIDERS[provider]?.models || []).map((m) => (
                        <option key={m} value={m} />
                      ))}
                      {(!AI_PROVIDERS[provider] || AI_PROVIDERS[provider].models.length === 0) && (
                        <>
                          <option value="gpt-4o" />
                          <option value="gpt-4o-mini" />
                          <option value="gpt-3.5-turbo" />
                          <option value="deepseek-chat" />
                          <option value="deepseek-reasoner" />
                          <option value="claude-3.5-sonnet" />
                          <option value="gemini-2.0-flash" />
                        </>
                      )}
                    </datalist>
                    {/* 模型列表：可滚动区域，点击选中 */}
                    {(AI_PROVIDERS[provider]?.models || []).length > 0 && (
                      <div className="mt-1.5 border border-white/10 rounded-lg max-h-36 overflow-y-auto divide-y divide-white/5">
                        {(AI_PROVIDERS[provider]?.models || []).map((m) => (
                          <div
                            key={m}
                            onClick={() => setCfgForm((f) => ({ ...f, model: m }))}
                            className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                              cfgForm.model === m
                                ? 'bg-neon-cyan/10 text-neon-cyan'
                                : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                            }`}
                          >
                            {m}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 提供商备注 */}
                    {AI_PROVIDERS[provider]?.note && (
                      <div className="mt-1 text-[11px] text-white/30 leading-tight">
                        {AI_PROVIDERS[provider].note}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <button
                      onClick={() => setCfgForm((f) => ({ ...f, useAI: !f.useAI }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        cfgForm.useAI ? 'bg-neon-cyan/60' : 'bg-white/20'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          cfgForm.useAI ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-white/60">
                      {cfgForm.useAI ? '启用 AI' : '关闭 AI'}
                    </span>
                  </div>
                </div>

                {/* 保存 & 测试连接 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={saveConfig}
                      disabled={cfgSaving || cfgLoading}
                      className={`btn-neon text-sm px-6 py-1.5 ${
                        cfgSaving ? 'opacity-50 cursor-wait' : ''
                      }`}
                    >
                      {cfgSaving ? '保存中…' : '保存配置'}
                    </button>
                    <button
                      onClick={testConnection}
                      disabled={testing || cfgLoading}
                      className={`text-sm px-5 py-1.5 rounded-lg border transition-colors ${
                        testing
                          ? 'opacity-50 cursor-wait border-white/20 text-white/40'
                          : 'border-neon-cyan/40 text-neon-cyan/80 hover:bg-neon-cyan/10'
                      }`}
                    >
                      {testing ? '测试中…' : '测试连接'}
                    </button>
                    {cfgMsg && (
                      <span
                        className={`text-xs ${
                          cfgMsg.startsWith('保存失败') ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        {cfgMsg}
                      </span>
                    )}
                  </div>

                  {/* 验证结果 */}
                  {verifyMsg && (
                    <div
                      className={`text-xs px-3 py-2 rounded-lg ${
                        verifyMsg.ok
                          ? 'bg-green-400/10 border border-green-400/30 text-green-400'
                          : 'bg-red-400/10 border border-red-400/30 text-red-400'
                      }`}
                    >
                      {verifyMsg.ok ? '✓' : '✗'} {verifyMsg.text}
                    </div>
                  )}
                </div>

                <p className="text-xs text-white/30 leading-relaxed">
                  支持任何 OpenAI 兼容 API。密钥将保存至服务端，保存后立即生效。
                  {AI_PROVIDERS[provider]?.keyUrl ? (
                    <>
                      {' '}获取密钥：
                      <a href={AI_PROVIDERS[provider].keyUrl} target="_blank" rel="noopener noreferrer" className="text-neon-cyan/60 hover:text-neon-cyan underline ml-1">
                        {AI_PROVIDERS[provider].name}
                      </a>
                    </>
                  ) : (
                    <>
                      {' '}参考：
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-neon-cyan/60 hover:text-neon-cyan underline ml-1">OpenAI</a>
                      <span className="mx-1">·</span>
                      <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-neon-cyan/60 hover:text-neon-cyan underline">DeepSeek</a>
                    </>
                  )}
                </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="text-center text-white/30 text-xs mt-12 pb-6">
        暗色悬疑推理 · AI 智能主持 · 玩家共创题库
      </footer>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
