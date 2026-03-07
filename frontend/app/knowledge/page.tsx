"use client";

import { useState, useCallback, useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
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

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { openaiApiKey } = useSettingsStore();

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!openaiApiKey) {
      alert("请在设置中配置 OpenAI API 密钥");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/documents/upload?api_key=${openaiApiKey}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        await fetchDocuments();
      } else {
        const error = await response.text();
        alert(`上传失败: ${error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("上传文档失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此文档吗？")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchDocuments();
      } else {
        alert("删除文档失败");
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4 text-emerald-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-amber-500" />;
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
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label htmlFor="file-upload">
                <Button disabled={isUploading} className="rounded-lg">
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
              </label>
            </div>
          </div>

          {/* Supported Formats */}
          <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
            <span>支持格式:</span>
            {["PDF", "Word", "TXT", "Markdown"].map((format) => (
              <span
                key={format}
                className="px-2 py-1 rounded-md bg-muted text-xs"
              >
                {format}
              </span>
            ))}
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
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {getStatusIcon(doc.status)}
                        <span>{getStatusText(doc.status)}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
