---
name: browser_debugging
description: 赋予 AI 在真实的无头浏览器中进行端到端(E2E) UI 测试、操作（点击/输入）并获取截屏反馈的能力。
---

# 🤖 浏览器交互与 UI 调试技能 (Browser Debugging Skill)

本技能通过底层的 Playwright 自动化脚本，让你（AI Agent）拥有“眼睛”（视觉反馈）和“手”（UI 操作）的能力。当你遇到前端渲染问题、需要测试发版或确认报错是否消失时，请使用本技能。

## 🎯 核心原理
你不能自己渲染网页，但你可以使用终端命令调用 Node.js 脚本，操作一个真实的无头浏览器。
执行完动作后，脚本会返回当前 DOM 结构，并生成最新的浏览器截图文件（`.png`），你可以通过多模态能力查看报错情况。

## 🛠️ 环境准备

首次使用本技能前，请先确保依赖已安装。打开终端并执行：

```bash
cd .agents/skills/browser-debugging/scripts
npm install
npx playwright install chromium
```

## 🚀 可执行动作指令 (Actions)

通过执行 `node browser_controller.js <action> <url> [args...]` 命令来进行浏览器操作。
**注意**：每次执行命令后，脚本会自动生成名为 `current_view.png` 的截图文件保存在 `scripts` 目录下供你查看。

### 1. 导航并获取初始状态 (goto)
打开目标网页并等待加载完成。
```bash
node .agents/skills/browser-debugging/scripts/browser_controller.js goto http://localhost:3001/chat
```

### 2. 点击页面元素 (click)
使用 CSS 选择器点击某个按钮或元素。
```bash
node .agents/skills/browser-debugging/scripts/browser_controller.js click http://localhost:3001/chat ".send-btn"
```

### 3. 输入文本 (type)
在指定的输入框中键入文本内容（参数格式为：`"选择器|要输入的文本"`，中间用竖线分隔）。
```bash
node .agents/skills/browser-debugging/scripts/browser_controller.js type http://localhost:3001/chat "textarea[placeholder='输入消息']|你好，这是一条测试消息"
```

### 4. 获取 DOM 结构 (get_dom)
当你不知道该点击哪个选择器时，执行此命令，它会将页面的关键可交互 DOM 结构打印到终端（已过滤冗余标签）。
```bash
node .agents/skills/browser-debugging/scripts/browser_controller.js get_dom http://localhost:3001/chat
```

## 🧠 标准工作流 (Workflow)

当用户说：“帮我测试一下发送消息功能是不是修好了？”时，请严格遵守以下循环：

1. **观察初始状态**：使用 `goto` 命令打开 URL。读取屏幕截图 `current_view.png` 确认页面大致布局。若需精确定位，使用 `get_dom` 获取选择器。
2. **执行交互**：
   - 发现输入框存在，使用 `type` 写入文本。
   - 使用 `click` 命令点击发送按钮。
3. **验证结果**：
   - 查看最新生成的截图 `current_view.png`。
   - 观察 AI 气泡是否出现？或者是否出现了红色的弹窗/横幅报错？
4. **决策反馈**：向用户报告测试结果。如果看到报错信息，请将其提取出来并在代码中进行修正。
