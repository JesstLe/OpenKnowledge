"use client";

import { useState, useCallback, useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, Plus, Trash2, Search, Loader2, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";

interface Memory {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  created_at: string;
  access_count: number;
}

const categories = [
  { value: "fact", label: "事实", color: "bg-blue-500/10 text-blue-600" },
  {
    value: "preference",
    label: "偏好",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  { value: "goal", label: "目标", color: "bg-violet-500/10 text-violet-600" },
  {
    value: "important",
    label: "重要",
    color: "bg-amber-500/10 text-amber-600",
  },
];

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMemory, setNewMemory] = useState({
    content: "",
    category: "fact",
    importance: 5,
  });
  const { openaiApiKey } = useSettingsStore();

  const fetchMemories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/`);
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error("Failed to fetch memories:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleAddMemory = async () => {
    if (!newMemory.content.trim() || !openaiApiKey) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/memories/?api_key=${openaiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMemory),
        },
      );

      if (response.ok) {
        await fetchMemories();
        setNewMemory({ content: "", category: "fact", importance: 5 });
        setShowAddForm(false);
      } else {
        alert("添加记忆失败");
      }
    } catch (error) {
      console.error("Add memory error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条记忆吗？")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchMemories();
      } else {
        alert("删除记忆失败");
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !openaiApiKey) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/memories/search?query=${encodeURIComponent(searchQuery)}&api_key=${openaiApiKey}`,
      );
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = categories.find((c) => c.value === category);
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cat?.color || "bg-muted text-muted-foreground"}`}
      >
        {cat?.label || category}
      </span>
    );
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
              <h1 className="text-3xl font-semibold mb-2">记忆</h1>
              <p className="text-muted-foreground">
                长期记忆存储，自动从对话中提取
              </p>
            </div>

            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="mr-2 h-4 w-4" />
              添加记忆
            </Button>
          </div>

          {/* Search */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索记忆..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>
              搜索
            </Button>
          </div>

          {/* Add Memory Form */}
          {showAddForm && (
            <div className="border border-border rounded-xl p-6 mb-6">
              <h3 className="font-medium mb-4">添加新记忆</h3>
              <div className="space-y-4">
                <Textarea
                  placeholder="需要记住什么？"
                  value={newMemory.content}
                  onChange={(e) =>
                    setNewMemory({ ...newMemory, content: e.target.value })
                  }
                  className="min-h-[100px]"
                />
                <div className="flex gap-3">
                  <Select
                    value={newMemory.category}
                    onValueChange={(value) =>
                      setNewMemory({ ...newMemory, category: value })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="类别" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={newMemory.importance}
                    onChange={(e) =>
                      setNewMemory({
                        ...newMemory,
                        importance: parseInt(e.target.value),
                      })
                    }
                    className="w-[100px]"
                    placeholder="重要性"
                  />
                  <div className="flex-1"></div>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleAddMemory}>添加</Button>
                </div>
              </div>
            </div>
          )}

          {/* Memories List */}
          <div className="border border-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">加载中...</p>
              </div>
            ) : memories.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">暂无记忆</h3>
                <p className="text-sm text-muted-foreground">
                  手动添加记忆，或让 AI 自动从对话中提取
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium mb-2">{memory.content}</p>
                        <div className="flex items-center gap-3">
                          {getCategoryBadge(memory.category)}
                          <span className="text-xs text-muted-foreground">
                            重要性: {memory.importance}/10
                          </span>
                          {memory.access_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              已访问 {memory.access_count} 次
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(memory.id)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors shrink-0"
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
