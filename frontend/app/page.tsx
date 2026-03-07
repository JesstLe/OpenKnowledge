"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  BookOpen,
  Brain,
  Settings,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col">
        <div className="p-4">
          <Link
            href="/chat"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors text-sm font-medium"
          >
            <MessageSquare className="h-4 w-4" />
            开始聊天
          </Link>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          <Link
            href="/knowledge"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <BookOpen className="h-4 w-4" />
            知识库
          </Link>
          <Link
            href="/memories"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Brain className="h-4 w-4" />
            记忆
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            设置
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-4xl font-semibold mb-4">Knowledge Assistant</h1>
          <p className="text-lg text-muted-foreground mb-8">
            您的智能知识管理与学习助手
          </p>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <Link href="/chat" className="group">
              <div className="p-6 rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="font-medium mb-1">AI 对话</h3>
                <p className="text-sm text-muted-foreground">
                  智能聊天，支持记忆与知识库
                </p>
              </div>
            </Link>

            <Link href="/knowledge" className="group">
              <div className="p-6 rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="font-medium mb-1">知识库</h3>
                <p className="text-sm text-muted-foreground">
                  上传文档，RAG 智能检索
                </p>
              </div>
            </Link>

            <Link href="/memories" className="group">
              <div className="p-6 rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Brain className="h-5 w-5" />
                </div>
                <h3 className="font-medium mb-1">长期记忆</h3>
                <p className="text-sm text-muted-foreground">
                  自动提取与存储重要信息
                </p>
              </div>
            </Link>
          </div>

          <Link href="/chat">
            <Button size="lg" className="rounded-full px-8">
              开始体验
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
