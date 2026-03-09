"use client";

import { useState, useRef, useEffect } from "react";
import {
  useSettingsStore,
  SUPPORTED_MODELS,
  PROVIDERS,
} from "@/stores/settings";
import { Message } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Search,
  Image,
  Grid3X3,
  BookOpen,
  Brain,
  Settings,
  Menu,
  X,
  Paperclip,
  Mic,
  ArrowUp,
  MessageSquare,
  ChevronDown,
  Check,
  Copy,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";

interface ChatSession {
  id: string;
  title: string;
  date: string;
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  updated_at: string;
  message_count: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<
    Conversation[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    model,
    setModel,
    setSelectedProvider,
    getEffectiveApiKey,
    baseUrls,
    useRAG,
    useMemory,
    setUseRAG,
    setUseMemory,
  } = useSettingsStore();
  const apiKey = getEffectiveApiKey();
  const currentModel = SUPPORTED_MODELS.find((m) => m.id === model);
  const currentProvider = PROVIDERS.find(
    (p) => p.id === currentModel?.provider,
  );

  // 加载对话列表
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        setFilteredConversations(data);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  };

  // Search conversations
  const handleSearchConversations = async () => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.append("q", searchQuery);
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/search?${params.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        setFilteredConversations(data);
      }
    } catch (error) {
      console.error("Failed to search conversations:", error);
      // Fallback to client-side filtering
      const filtered = conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredConversations(filtered);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setFilteredConversations(conversations);
  };

  const createNewConversation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话", model }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(data.id);
        setMessages([]);
        fetchConversations();
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${conversationId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(data.id);
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
          })),
        );
        // 设置当前模型
        const convModel = SUPPORTED_MODELS.find((m) => m.id === data.model);
        if (convModel) {
          setModel(data.model);
          setSelectedProvider(convModel.provider);
        }
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200,
      )}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    setErrorMessage(null);
    if (!apiKey) {
      setErrorMessage(
        `请在设置中配置 ${currentProvider?.name || "当前模型"} 的 API 密钥`,
      );
      return;
    }

    // 如果没有当前对话，自动创建
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: input.slice(0, 20) + "...", model }),
        });
        if (response.ok) {
          const data = await response.json();
          conversationId = data.id;
          setCurrentConversationId(data.id);
          // 刷新对话列表
          fetchConversations();
        }
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const endpoint = useRAG ? "/api/chat/rag" : "/api/chat";
      // 构建历史消息（排除当前消息，最多50轮/100条）
      const MAX_HISTORY_MESSAGES = 100;
      const historyMessages = messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const requestBody = {
        message: userMessage.content,
        history: historyMessages,
        conversationId,
        apiKey,
        model,
        baseUrl: currentModel?.provider
          ? baseUrls[currentModel.provider]
          : undefined,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useRAG
            ? {
                ...requestBody,
                use_rag: useRAG,
                use_memory: useMemory,
              }
            : requestBody,
        ),
      });

      // 检查 HTTP 响应状态码，处理后端返回的错误
      if (!response.ok) {
        let errMsg = `请求失败 (${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch {
          // 无法解析 JSON，使用默认错误信息
        }
        throw new Error(errMsg);
      }

      if (!response.body) throw new Error("No response body");

      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);

        // 检测后端流式传递的错误信息
        if (
          chunk.startsWith("[ERROR]") ||
          (assistantMessage.content === "" && chunk.includes("[ERROR]"))
        ) {
          const errText = (assistantMessage.content + chunk)
            .replace("[ERROR]", "")
            .trim();
          // 移除空的 assistant 消息
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessage.id),
          );
          throw new Error(errText || "LLM 调用失败");
        }

        assistantMessage.content += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: assistantMessage.content }
              : msg,
          ),
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      const msg = error instanceof Error ? error.message : "发送消息失败";
      setErrorMessage(`${msg}，请检查 API 密钥设置`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setInput("");
    setCurrentConversationId(null);
  };

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleRegenerate = async () => {
    // Find last user message
    const lastUserIndex = [...messages]
      .reverse()
      .findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;

    const lastUserMsg = messages[messages.length - 1 - lastUserIndex];

    // Remove the last assistant message if exists
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant") {
      setMessages((prev) => prev.slice(0, -1));
    }

    // Trigger a new send with the last user message
    setInput(lastUserMsg.content);
    // Use setTimeout to ensure the input state is updated before sending
    setTimeout(() => {
      const sendButton = document.querySelector(
        '[data-send-button="true"]',
      ) as HTMLButtonElement;
      sendButton?.click();
    }, 0);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } bg-[#f9f9f9] dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={createNewConversation}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            <Plus className="h-4 w-4 text-gray-500" />
            新建聊天
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3">
          {/* Search */}
          <div className="px-1 py-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索对话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchConversations();
                  }
                }}
                className="w-full pl-9 pr-8 py-2 rounded-lg text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 dark:focus:border-gray-700"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
            {isSearching && (
              <p className="text-xs text-gray-400 mt-1 px-3">搜索中...</p>
            )}
          </div>

          {/* Features */}
          <div className="mt-1 space-y-0.5">
            <Link
              href="/knowledge"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
            >
              <BookOpen className="h-4 w-4" />
              知识库
            </Link>
            <Link
              href="/memories"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
            >
              <Brain className="h-4 w-4" />
              记忆
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
            >
              <Grid3X3 className="h-4 w-4" />
              首页
            </Link>
          </div>

          {/* Toggle Features */}
          <div className="mt-6 px-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-3">
              功能开关
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => setUseRAG(!useRAG)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer w-full ${
                  useRAG
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span className="flex-1 text-left">知识库 RAG</span>
                {useRAG && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
              <button
                onClick={() => setUseMemory(!useMemory)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer w-full ${
                  useMemory
                    ? "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Brain className="h-4 w-4" />
                <span className="flex-1 text-left">长期记忆</span>
                {useMemory && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                )}
              </button>
            </div>
          </div>

          {/* Recent Chats */}
          <div className="mt-6 px-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-3">
              {searchQuery
                ? `搜索结果 (${filteredConversations.length})`
                : `最近对话 (${conversations.length})`}
            </p>
            <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
              {filteredConversations.length === 0 && searchQuery ? (
                <p className="text-sm text-gray-400 px-3 py-2">
                  未找到匹配对话
                </p>
              ) : (
                filteredConversations.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => loadConversation(chat.id)}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer w-full text-left group ${
                      currentConversationId === chat.id
                        ? "bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block font-medium">
                        {chat.title}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(chat.updated_at)} · {chat.message_count}{" "}
                        条消息
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>

        {/* User/Settings */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            设置
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0d0d0d]">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              Knowledge Assistant
            </span>
          </div>
          {/* Model Switcher */}
          <Select
            value={model}
            onValueChange={(value) => {
              const m = SUPPORTED_MODELS.find((mod) => mod.id === value);
              if (m) {
                setModel(m.id);
                setSelectedProvider(m.provider);
              }
            }}
          >
            <SelectTrigger className="w-[280px] text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <SelectValue placeholder="选择模型">
                {currentModel && (
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {currentModel.name}
                    </span>
                    <span className="text-gray-500 text-xs truncate">
                      {
                        PROVIDERS.find((p) => p.id === currentModel.provider)
                          ?.name
                      }
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[500px] w-[360px]">
              {SUPPORTED_MODELS.map((m) => (
                <SelectItem
                  key={m.id}
                  value={m.id}
                  className="py-3 h-auto whitespace-normal"
                >
                  <div className="flex flex-col items-start gap-1 w-full max-w-[360px]">
                    <span className="font-medium text-sm truncate w-full">
                      {m.name}
                    </span>
                    <span className="text-xs text-gray-500 leading-relaxed break-words w-full">
                      {PROVIDERS.find((p) => p.id === m.provider)?.name} ·{" "}
                      {m.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            // Welcome Screen
            <div className="flex flex-col items-center justify-center h-full px-4">
              <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-10 tracking-tight">
                有什么可以帮忙的？
              </h1>

              {/* Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full mb-8">
                {[
                  "帮我写一份周报",
                  "解释什么是RAG",
                  "Python 数据分析入门",
                  "如何学习机器学习",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all text-left text-sm text-gray-700 dark:text-gray-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Messages
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 group ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      message.role === "user"
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {message.role === "user" ? "U" : "AI"}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex-1 ${
                      message.role === "user" ? "text-right" : ""
                    }`}
                  >
                    <div
                      className={`inline-block text-left max-w-[85%] px-4 py-3 rounded-2xl ${
                        message.role === "user"
                          ? "bg-gray-900 dark:bg-blue-600 text-white rounded-br-md"
                          : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-md shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>

                    {/* Message Actions - Only for assistant messages */}
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            handleCopyMessage(message.content, message.id)
                          }
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                          title="复制内容"
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {messages[messages.length - 1].id === message.id &&
                          !isLoading && (
                            <button
                              onClick={handleRegenerate}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                              title="重新生成"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs font-medium">
                    AI
                  </div>
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-md shadow-sm">
                      <div className="flex gap-1">
                        <span
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 错误提示横幅 */}
        {errorMessage && (
          <div className="px-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm shadow-sm">
                <span className="font-medium">{errorMessage}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/settings"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                  >
                    前往设置
                  </Link>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 pb-6 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-lg hover:shadow-xl transition-shadow">
              {/* Input Actions - Top Row */}
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500">
                  <Paperclip className="h-5 w-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500">
                  <Mic className="h-5 w-5" />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="给 Assistant 发送消息..."
                className="w-full min-h-[40px] max-h-[200px] bg-transparent resize-none px-4 pb-3 pt-1 text-base focus:outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                rows={1}
              />

              {/* Send Button */}
              <div className="flex justify-end px-3 pb-3">
                <button
                  data-send-button="true"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`p-2.5 rounded-xl transition-all ${
                    input.trim() && !isLoading
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }`}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Features indicator */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {useRAG && (
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-full font-medium">
                  <BookOpen className="h-3 w-3" />
                  知识库已启用
                </span>
              )}
              {useMemory && (
                <span className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-full font-medium">
                  <Brain className="h-3 w-3" />
                  记忆已启用
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              AI 生成内容仅供参考
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
