"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSettingsStore, SUPPORTED_MODELS } from "@/stores/settings";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  ArrowLeft,
  Check,
  Clock,
  X,
  AlertCircle,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";

interface Document {
  id: string;
  title: string;
  file_type: string;
  status: string;
  created_at: string;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

// Providers that support embeddings
const EMBEDDING_PROVIDERS = ["openai", "alibaba", "zhipu", "moonshot"];

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [useLocalEmbedding, setUseLocalEmbedding] = useState<boolean>(false);
  const [localOllamaStatus, setLocalOllamaStatus] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { apiKeys, openaiApiKey, model, baseUrls } = useSettingsStore();

  // Get current model's provider and API key
  const currentModel = SUPPORTED_MODELS.find((m) => m.id === model);
  const provider = currentModel?.provider || "openai";
  const apiKey =
    apiKeys[provider] || (provider === "openai" ? openaiApiKey : "") || "";
  const baseUrl = baseUrls[provider] || "";

  // Toast helper
  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      showToast("error", "获取文档列表失败");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Check local Ollama status
  useEffect(() => {
    const checkOllama = async () => {
      try {
        const response = await fetch("http://localhost:11434/api/tags", {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          const hasEmbeddingModel = data.models?.some((m: { name: string }) =>
            m.name.includes("nomic-embed-text"),
          );
          setLocalOllamaStatus(hasEmbeddingModel);
        } else {
          setLocalOllamaStatus(false);
        }
      } catch {
        setLocalOllamaStatus(false);
      }
    };
    checkOllama();
    // Check every 10 seconds
    const interval = setInterval(checkOllama, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll for processing status
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const processFile = async (file: File) => {
    // If using local embedding, don't need cloud API key
    if (!useLocalEmbedding && !apiKey) {
      showToast(
        "error",
        `请在设置中配置 ${currentModel?.provider || "当前模型"} 的 API 密钥`,
      );
      return;
    }

    // Check if provider supports embeddings (only if not using local)
    if (!useLocalEmbedding && !EMBEDDING_PROVIDERS.includes(provider)) {
      showToast(
        "error",
        `当前模型 ${currentModel?.name} 不支持文档嵌入，请切换到 OpenAI、阿里云、智谱或 Moonshot 模型`,
      );
      return;
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const allowedTypes = ["pdf", "docx", "txt", "md"];
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      showToast(
        "error",
        `不支持的文件格式。仅支持: ${allowedTypes.join(", ")}`,
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress("正在上传...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadProgress("正在处理文档...");
      const params = new URLSearchParams();
      // Only pass API key if not using local embedding
      if (!useLocalEmbedding) {
        params.append("api_key", apiKey);
        params.append("provider", provider);
        if (baseUrl) params.append("base_url", baseUrl);
      }
      params.append("use_local_embedding", useLocalEmbedding.toString());

      const response = await fetch(
        `${API_BASE_URL}/api/documents/upload?${params.toString()}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        showToast("success", `文档 "${file.name}" 上传成功`);
        await fetchDocuments();
      } else {
        let errorMsg = "上传失败";
        try {
          const errorData = await response.json();
          errorMsg =
            errorData.detail || errorData.message || JSON.stringify(errorData);
        } catch {
          errorMsg = await response.text();
        }
        showToast("error", `上传失败: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToast("error", "上传文档失败，请检查网络连接");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此文档吗？")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "文档已删除");
        await fetchDocuments();
      } else {
        showToast("error", "删除文档失败");
      }
    } catch (error) {
      console.error("Delete error:", error);
      showToast("error", "删除文档失败");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4 text-emerald-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      case "failed":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "已就绪";
      case "processing":
        return "处理中";
      case "failed":
        return "失败";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right fade-in duration-200 ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : toast.type === "error"
                  ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                  : "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
            }`}
          >
            {toast.type === "success" && <Check className="h-4 w-4" />}
            {toast.type === "error" && <AlertCircle className="h-4 w-4" />}
            {toast.type === "info" && <Clock className="h-4 w-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

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
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            首页
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            设置
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold mb-2">知识库</h1>
              <p className="text-muted-foreground">
                上传文档以启用 RAG 智能检索功能
              </p>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    上传文档
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Local Embedding Toggle */}
          <div className="flex items-center justify-between p-4 mb-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${localOllamaStatus ? "bg-emerald-500" : "bg-gray-400"}`}
              />
              <div>
                <p className="text-sm font-medium">使用本地 Ollama Embedding</p>
                <p className="text-xs text-gray-500">
                  {localOllamaStatus
                    ? "已检测到 nomic-embed-text 模型"
                    : "未检测到本地 Ollama (nomic-embed-text)"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setUseLocalEmbedding(!useLocalEmbedding)}
              disabled={!localOllamaStatus}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useLocalEmbedding && localOllamaStatus
                  ? "bg-emerald-500"
                  : "bg-gray-200 dark:bg-gray-700"
              } ${!localOllamaStatus ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useLocalEmbedding ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
              {isUploading ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            {isUploading ? (
              <>
                <p className="font-medium text-foreground">{uploadProgress}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  请勿关闭页面
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  拖拽文件到此处，或点击上传
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  支持 PDF、Word、TXT、Markdown 格式
                </p>
              </>
            )}
          </div>

          {/* Documents List */}
          <div className="border border-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">加载中...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">暂无文档</h3>
                <p className="text-sm text-muted-foreground">
                  上传 PDF、Word、TXT 或 Markdown 文件以启用语义搜索
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(doc.status)}
                            {getStatusText(doc.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
