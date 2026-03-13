# OpenKnowledge

一个本地优先的智能知识管理和学习助手应用，基于 RAG（检索增强生成）技术，帮助你高效地管理、学习和回顾知识。

## 功能特性

- **知识库管理** - 支持多种文档格式（PDF、Word、Excel、图片、视频等）的导入和管理
- **智能问答** - 基于文档内容的上下文感知问答，支持多轮对话
- **语义搜索** - 使用向量数据库实现文档内容的语义检索
- **学习记忆** - 自动记录学习进度，支持间隔重复和遗忘曲线复习
- **多 LLM 支持** - 兼容 OpenAI、Claude、Qwen、Ollama 等多种大语言模型
- **本地部署** - 数据完全存储在本地，保护隐私安全

## 技术栈

### 前端
| 技术 | 版本 |
|------|------|
| Next.js | 16.x |
| React | 19.x |
| TypeScript | 5.x |
| TailwindCSS | 4.x |
| shadcn/ui | - |
| Zustand | 5.x |

### 后端
| 技术 | 版本 |
|------|------|
| FastAPI | - |
| Python | 3.9+ |
| PostgreSQL | 14+ |
| pgvector | - |
| LangChain | - |
| LiteLLM | - |

## 快速开始

### 环境要求

- Node.js >= 20
- Python >= 3.9
- PostgreSQL >= 14 (需启用 pgvector 扩展)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/JesstLe/OpenKnowledge.git
cd OpenKnowledge
```

2. **启动数据库**
```bash
docker-compose up -d
```

3. **安装并启动后端**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

4. **安装并启动前端**
```bash
cd frontend
npm install
npm run dev
```

5. **访问应用**
   - 前端：http://localhost:3000
   - 后端 API：http://localhost:8000

## 项目结构

```
OpenKnowledge/
├── frontend/               # Next.js 前端
│   ├── app/               # App Router 页面
│   ├── components/        # React 组件
│   ├── lib/               # 工具函数
│   ├── hooks/             # 自定义 Hooks
│   └── stores/            # Zustand 状态管理
├── backend/                # FastAPI 后端
│   ├── api/               # API 路由
│   ├── services/          # 业务逻辑
│   ├── models/            # 数据模型
│   └── core/              # 配置和数据库连接
├── docker-compose.yml      # Docker 配置文件
└── docs/                   # 项目文档
```

## 核心架构

### 1. LLM Gateway
统一的 LLM API 封装层，支持多提供商切换（OpenAI/Claude/Qwen/Ollama）。

### 2. RAG Engine
- 文档分块处理
- 向量嵌入生成
- 语义相似度搜索

### 3. Document Processor
支持多种格式的文档解析：
- 文本：PDF、Word、TXT、Markdown
- 表格：Excel、CSV
- 图像：OCR 文字提取
- 音视频：语音转文字

### 4. Memory System
- 长期记忆存储
- 学习计划管理
- 间隔重复算法

## 数据流

```
用户查询 → LLM Gateway → 记忆检索 → RAG 搜索 → 上下文组装 → LLM 响应
```

## 开发指南

### 前端开发
```bash
cd frontend
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run lint         # ESLint 检查
```

### 后端开发
```bash
cd backend
uvicorn main:app --reload    # 开发服务器
pytest                       # 运行测试
```

## 环境变量

创建 `.env` 文件配置以下变量：

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/openknowledge

# LLM API Keys
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# 其他配置
APP_SECRET=your_secret_key
```

## 路线图

- [x] 基础文档管理
- [x] RAG 问答系统
- [x] 多 LLM 支持
- [ ] 移动端适配
- [ ] 协作功能
- [ ] 插件系统

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

---

*OpenKnowledge - 你的本地智能知识助手*
