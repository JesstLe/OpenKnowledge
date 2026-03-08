---
name: browser_debugging_daemon
description: 赋予 AI 在真实的无头浏览器中进行超强常驻端到端(E2E)测试的能力。支持保持长连接会话，以及基于视觉坐标(Set-of-Mark)的精确点击。
---

# 🤖 高级沉浸式浏览器能力 (Browser Debugging Daemon)

此高级技能允许你启动一个**在后台常驻的浏览器进程的守护服务 (Daemon)**。
相比于每次发指令启动关闭一次浏览器的旧方案，Daemon 模式支持**长连接上下文**（登录状态可保留），并且内建了强悍的 **Set-of-Mark (视觉元素打标)** 机制，让你完全**摆脱对 CSS 选择器的依赖**（即你可以直接点击图片上的 "编号 12"，而不需要去找混乱的 CSS Class 类名）。

## 🛠️ 环境准备

```bash
cd ~/.agents/skills/browser-debugging/scripts
npm install
npx playwright install chromium
```

## 🚀 终极进化：作为 MCP Server (Cursor / Cline / Claude Desktop 原生集成)

这是目前最强大、最高效的使用方式。你不必再自己手敲 `curl` 脚本，而是可以通过配置 **Model Context Protocol (MCP)** ，让 AI 编辑器原生获得这套自动化工具集。

### 配置指南

#### 1. 在 Cursor 中使用
打开 Cursor 设置 -> Features -> MCP -> "+ Add New MCP Server"
* **Name**: Browser Automation
* **Type**: `command`
* **Command**: `node /Users/lv/Workspace/knowledgeAssistant/.agents/skills/browser-debugging/scripts/mcp_server.js`

#### 2. 在 Claude Desktop 中使用
编辑你的 `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "node",
      "args": [
        "/Users/lv/Workspace/knowledgeAssistant/.agents/skills/browser-debugging/scripts/mcp_server.js"
      ]
    }
  }
}
```

### 提供的内置工具 (Native Tools)
配置完成后，AI (比如你) 会自动学会识别并调用以下这些原生的 Function Calls，直接把浏览器当成你的内置插件：

1. **`browser_goto(url)`**: 导航到目标网页。
2. **`browser_observe()`**: 分析页面布局，注入红色的 Set-of-Mark 标号，截图，并返回所有可交换元素的字典映射。
3. **`browser_click(id)`**: 点击指定编号的元素（无需再懂那噩梦般的 CSS 选择器）。
4. **`browser_type(id, text)`**: 在输入框中输入文字。
5. **`browser_scroll(direction)`**: 翻页。
6. **`browser_stop()`**: 测试结束后，自动保存并吐出可以被时光机回放排查的 `trace_mcp_XXX.zip`。

### 第二步：指令通讯 (通过 API)
通过在终端发送 curl 请求与浏览器沟通：

1. **启动/打开浏览器窗体**:
   ```bash
   curl -X POST http://localhost:3005/start
   ```
2. **导航页面**:
   ```bash
   curl -X POST http://localhost:3005/goto -H "Content-Type: application/json" -d '{"url":"http://localhost:3001/chat"}'
   ```
3. **👀 观察 (核心 API)**:
   ```bash
   curl http://localhost:3005/observe
   ```
   **必读说明**：这个 API 会在当前页面的所有可交互元素（按钮/输入框）上画上一个红色的正方形带有**唯一数字标号 (ID)**，然后拍照给你，并且把红色方块的映射关系发在 JSON 格式中。
   收到 JSON 后，你需要**查看最新的截图 `current_view.png`** 去确认你到底想点哪个标号。

4. **🖱️ 点击 (基于视觉标号)**:
   无需 CSS 选择器，直接指出上一次 observe 时你看到的屏幕上数字红框的编号：
   ```bash
   curl -X POST http://localhost:3005/click -H "Content-Type: application/json" -d '{"id": 12}'
   ```
5. **⌨️ 输入 (基于视觉标号)**:
   ```bash
   curl -X POST http://localhost:3005/type -H "Content-Type: application/json" -d '{"id": 14, "text": "你好"}'
   ```
6. **✨ 悬停 (Hover)**:
   对于一些需要鼠标放上去才展开的菜单：
   ```bash
   curl -X POST http://localhost:3005/hover -H "Content-Type: application/json" -d '{"id": 5}'
   ```
7. **📜 滚动屏幕 (Scroll)**:
   支持向下、向上、回顶部、到底部：
   ```bash
   curl -X POST http://localhost:3005/scroll -H "Content-Type: application/json" -d '{"direction": "down"}' # 可选: down, up, top, bottom
   ```
8. **🎯 键盘按键 (KeyPress)**:
   用于敲击回车发送、Esc 关闭弹窗等操作：
   ```bash
   curl -X POST http://localhost:3005/keypress -H "Content-Type: application/json" -d '{"key": "Enter"}' # 可选: Enter, Escape, ArrowDown 等
   ```

### 第三步：结束测试保存结果
```bash
curl -X POST http://localhost:3005/stop
```
调用后会关闭并保存录像视频至 `scripts/videos` 以及包含完整时序重播的跟踪文件 `trace_daemon_xxx.zip`。

## 🧠 实战应用场景

当你想在编辑器里要求 AI "排查一下我刚刚写的聊天组件 Bug" 时。
集成 MCP 后，AI 会这么做：
1. 自动调用 `browser_goto({ url: 'http://localhost:3001/chat' })`
2. 自动调用 `browser_observe()`，拿到截图和元素标记字典。
3. 它在后台读图找到聊天输入框（比如编号是 8），自动调用 `browser_type({ id: 8, text: "测试消息" })`。
4. 找到发送按钮编号（比如 9），调用 `browser_click({ id: 9 })`。
5. 测试结束后，AI 调用 `browser_stop()`，然后在项目中给你留下一份包含全程录像 `.webm` 的排查报告。
