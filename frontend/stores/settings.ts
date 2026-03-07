import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextWindow?: number;
}

export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    description: "OpenAI 最新旗舰模型，通用复杂任务首选",
    contextWindow: 1000000,
  },
  {
    id: "gpt-5.4-pro",
    name: "GPT-5.4 Pro",
    provider: "openai",
    description: "更高精度版本，适合高难度推理与代码",
    contextWindow: 272000,
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "高性价比默认选择，速度与质量平衡",
    contextWindow: 400000,
  },
  {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "低延迟低成本，适合高吞吐轻任务",
    contextWindow: 400000,
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "成熟稳定的高质量非推理模型",
    contextWindow: 128000,
  },

  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Anthropic 最强模型，复杂任务与编码首选",
    contextWindow: 200000,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "速度与智能均衡，通用生产默认",
    contextWindow: 200000,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "低成本快速响应，适合实时场景",
    contextWindow: 200000,
  },

  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
    description: "Gemini 最新高阶推理与代理编程模型",
    contextWindow: 1000000,
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    description: "Gemini 3 系列高性价比快速模型",
    contextWindow: 1000000,
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash-Lite",
    provider: "google",
    description: "高并发低成本场景的轻量模型",
    contextWindow: 1000000,
  },

  // DeepSeek
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    description: "DeepSeek-V3.2 非思考模式",
    contextWindow: 128000,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "deepseek",
    description: "DeepSeek-V3.2 思考模式",
    contextWindow: 128000,
  },

  // 阿里云 - Qwen
  {
    id: "qwen3-max",
    name: "Qwen3-Max",
    provider: "alibaba",
    description: "阿里云最新旗舰模型",
    contextWindow: 262144,
  },
  {
    id: "qwen3.5-plus",
    name: "Qwen3.5-Plus",
    provider: "alibaba",
    description: "高性能通用模型，支持超长上下文",
    contextWindow: 1000000,
  },
  {
    id: "qwen-plus-latest",
    name: "Qwen-Plus-Latest",
    provider: "alibaba",
    description: "Qwen-Plus 最新稳定别名",
    contextWindow: 1000000,
  },
  {
    id: "qwen-flash",
    name: "Qwen-Flash",
    provider: "alibaba",
    description: "低延迟高并发模型",
    contextWindow: 1000000,
  },
  {
    id: "qwen3-coder-plus",
    name: "Qwen3-Coder-Plus",
    provider: "alibaba",
    description: "阿里云新一代代码模型",
    contextWindow: 1000000,
  },

  // 智谱 - GLM
  {
    id: "glm-5",
    name: "GLM-5",
    provider: "zhipu",
    description: "智谱最新旗舰模型",
    contextWindow: 128000,
  },
  {
    id: "glm-4.7",
    name: "GLM-4.7",
    provider: "zhipu",
    description: "强化代码与Agent能力的生产模型",
    contextWindow: 200000,
  },
  {
    id: "glm-4.7-flash",
    name: "GLM-4.7-Flash",
    provider: "zhipu",
    description: "高速低成本模型",
    contextWindow: 200000,
  },

  // Moonshot
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshot",
    description: "Kimi 最新多模态主力模型",
    contextWindow: 256000,
  },
  {
    id: "kimi-k2-turbo-preview",
    name: "Kimi K2 Turbo Preview",
    provider: "moonshot",
    description: "Kimi 高速预览模型",
    contextWindow: 256000,
  },
  {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "moonshot",
    description: "Kimi 深度推理模型",
    contextWindow: 256000,
  },
  {
    id: "kimi-latest",
    name: "Kimi Latest",
    provider: "moonshot",
    description: "Kimi 产品同款最新别名",
    contextWindow: 128000,
  },
  {
    id: "moonshot-v1-128k",
    name: "Moonshot V1 128K (Legacy)",
    provider: "moonshot",
    description: "兼容旧版接口的稳定模型",
    contextWindow: 128000,
  },

  // Cohere
  {
    id: "command-r",
    name: "Command R",
    provider: "cohere",
    description: "长上下文",
    contextWindow: 128000,
  },
  {
    id: "command-r-plus",
    name: "Command R+",
    provider: "cohere",
    description: "最强性能",
    contextWindow: 128000,
  },

  // Mistral
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    description: "旗舰模型",
    contextWindow: 32000,
  },
  {
    id: "mistral-medium",
    name: "Mistral Medium",
    provider: "mistral",
    description: "平衡性能",
    contextWindow: 32000,
  },
  {
    id: "mistral-small",
    name: "Mistral Small",
    provider: "mistral",
    description: "快速经济",
    contextWindow: 32000,
  },
];

export const getModelsByProvider = (provider: string) =>
  SUPPORTED_MODELS.filter((m) => m.provider === provider);

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    keyName: "OPENAI_API_KEY",
    baseUrlPlaceholder: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyName: "ANTHROPIC_API_KEY",
    baseUrlPlaceholder: "https://api.anthropic.com",
  },
  {
    id: "google",
    name: "Google AI",
    keyName: "GOOGLE_API_KEY",
    baseUrlPlaceholder: "https://generativelanguage.googleapis.com",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    keyName: "DEEPSEEK_API_KEY",
    baseUrlPlaceholder: "https://api.deepseek.com/v1",
  },
  {
    id: "alibaba",
    name: "阿里云",
    keyName: "DASHSCOPE_API_KEY",
    baseUrlPlaceholder: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    keyName: "ZHIPU_API_KEY",
    baseUrlPlaceholder: "https://open.bigmodel.cn/api/paas/v4",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    keyName: "MOONSHOT_API_KEY",
    baseUrlPlaceholder: "https://api.moonshot.cn/v1",
  },
  {
    id: "cohere",
    name: "Cohere",
    keyName: "COHERE_API_KEY",
    baseUrlPlaceholder: "https://api.cohere.ai",
  },
  {
    id: "mistral",
    name: "Mistral",
    keyName: "MISTRAL_API_KEY",
    baseUrlPlaceholder: "https://api.mistral.ai",
  },
];

interface ApiKeys {
  [provider: string]: string;
}

interface SettingsStore {
  // Legacy single key (for backward compat)
  openaiApiKey: string;
  model: string;

  // New multi-provider keys
  apiKeys: ApiKeys;
  baseUrls: { [provider: string]: string };
  selectedProvider: string;

  // Actions
  setOpenaiApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setApiKey: (provider: string, key: string) => void;
  setBaseUrl: (provider: string, url: string) => void;
  setSelectedProvider: (provider: string) => void;
  getEffectiveApiKey: () => string;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Legacy
      openaiApiKey: "",
      model: "gpt-5-mini",

      // New
      apiKeys: {},
      baseUrls: {},
      selectedProvider: "openai",

      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      setModel: (model) => set({ model }),
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
      setBaseUrl: (provider, url) =>
        set((state) => ({
          baseUrls: { ...state.baseUrls, [provider]: url },
        })),
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      getEffectiveApiKey: () => {
        const state = get();
        const provider = state.selectedProvider;
        const model = SUPPORTED_MODELS.find((m) => m.id === state.model);
        const modelProvider = model?.provider || provider;

        // Try to get key for the model's provider
        return (
          state.apiKeys[modelProvider] ||
          (modelProvider === "openai" ? state.openaiApiKey : "")
        );
      },
    }),
    {
      name: "settings-storage",
    },
  ),
);
