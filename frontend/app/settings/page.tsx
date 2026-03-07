'use client';

import { useState } from 'react';
import {
  useSettingsStore,
  SUPPORTED_MODELS,
  PROVIDERS,
  getModelsByProvider,
} from '@/stores/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Bot, ArrowLeft, Check, ChevronDown, Eye, EyeOff, Globe } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const {
    model,
    setModel,
    apiKeys,
    baseUrls,
    setApiKey,
    setBaseUrl,
    selectedProvider,
    setSelectedProvider,
    getEffectiveApiKey,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'models' | 'providers'>('models');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(selectedProvider);

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider);

  const handleModelSelect = (modelId: string) => {
    setModel(modelId);
    const modelConfig = SUPPORTED_MODELS.find((m) => m.id === modelId);
    if (modelConfig) {
      setSelectedProvider(modelConfig.provider);
    }
  };

  const toggleShowKey = (providerId: string) => {
    setShowKey((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col">
        <div className="p-4">
          <Link
            href="/chat"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            返回聊天
          </Link>
        </div>

        <nav className="flex-1 px-2">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer">
            首页
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <h1 className="text-3xl font-semibold mb-8">设置</h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-border">
            <button
              onClick={() => setActiveTab('models')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'models'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              模型选择
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'providers'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              API 配置
            </button>
          </div>

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">选择模型</h2>
                  <p className="text-sm text-muted-foreground">
                    选择适合您需求的 AI 模型
                  </p>
                </div>
              </div>

              {/* Provider filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setSelectedProvider('')}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedProvider === ''
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  全部
                </button>
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedProvider === provider.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {provider.name}
                  </button>
                ))}
              </div>

              {/* Model list */}
              <div className="space-y-3">
                {(selectedProvider
                  ? getModelsByProvider(selectedProvider)
                  : SUPPORTED_MODELS
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                      model === m.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {PROVIDERS.find((p) => p.id === m.provider)?.name}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {m.description}
                        {m.contextWindow && (
                          <span className="ml-2">
                            · {(m.contextWindow / 1000).toFixed(0)}K 上下文
                          </span>
                        )}
                      </div>
                    </div>
                    {model === m.id && (
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">API 配置</h2>
                  <p className="text-sm text-muted-foreground">
                    配置各厂商的 API 密钥（仅存储在本地）
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {PROVIDERS.map((provider) => (
                  <div
                    key={provider.id}
                    className="border border-border rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedProvider(
                          expandedProvider === provider.id ? null : provider.id
                        )
                      }
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{provider.name}</span>
                        {apiKeys[provider.id] && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            已配置
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedProvider === provider.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {expandedProvider === provider.id && (
                      <div className="p-4 border-t border-border space-y-4">
                        {/* API Key */}
                        <div className="space-y-2">
                          <Label htmlFor={`key-${provider.id}`}>
                            {provider.keyName}
                          </Label>
                          <div className="relative">
                            <Input
                              id={`key-${provider.id}`}
                              type={showKey[provider.id] ? 'text' : 'password'}
                              placeholder={`输入 ${provider.keyName}`}
                              value={apiKeys[provider.id] || ''}
                              onChange={(e) =>
                                setApiKey(provider.id, e.target.value)
                              }
                              className="pr-10"
                            />
                            <button
                              onClick={() => toggleShowKey(provider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showKey[provider.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Base URL (optional) */}
                        <div className="space-y-2">
                          <Label htmlFor={`url-${provider.id}`}>
                            Base URL (可选)
                          </Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id={`url-${provider.id}`}
                              placeholder={provider.baseUrlPlaceholder}
                              value={baseUrls[provider.id] || ''}
                              onChange={(e) =>
                                setBaseUrl(provider.id, e.target.value)
                              }
                              className="pl-9"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            仅在使用代理或自定义端点时需要填写
                          </p>
                        </div>

                        {/* Get API Key link */}
                        <div className="pt-2">
                          <a
                            href={getApiKeyUrl(provider.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            获取 {provider.keyName} →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Current Selection */}
              <div className="mt-8 p-4 rounded-xl bg-muted">
                <h3 className="font-medium mb-2">当前配置</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">模型:</span>{' '}
                    {SUPPORTED_MODELS.find((m) => m.id === model)?.name || model}
                  </p>
                  <p>
                    <span className="text-muted-foreground">厂商:</span>{' '}
                    {PROVIDERS.find((p) => p.id === selectedProvider)?.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">API 状态:</span>{' '}
                    {getEffectiveApiKey() ? (
                      <span className="text-emerald-600">已配置</span>
                    ) : (
                      <span className="text-red-500">未配置</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function getApiKeyUrl(providerId: string): string {
  const urls: Record<string, string> = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    google: 'https://aistudio.google.com/app/apikey',
    deepseek: 'https://platform.deepseek.com/api_keys',
    alibaba: 'https://dashscope.console.aliyun.com/apiKey',
    zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
    moonshot: 'https://platform.moonshot.cn/console/api-keys',
    cohere: 'https://dashboard.cohere.com/api-keys',
    mistral: 'https://console.mistral.ai/api-keys/',
  };
  return urls[providerId] || '#';
}
