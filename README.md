# OpenKnowledge

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-14-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License">
</p>

<p align="center">
  <strong>本地优先的智能知识管理与学习助手</strong>
</p>

<p align="center">
  基于 RAG（检索增强生成）技术，帮助你高效地管理、学习和回顾知识
</p>

---

## ✨ 功能特性

- **🤖 智能问答** - 基于文档内容的上下文感知问答，支持多轮对话
- **📚 知识库管理** - 支持多种文档格式（PDF、Word、Excel、图片、视频等）的导入和管理
- **🔍 语义搜索** - 使用向量数据库实现文档内容的语义检索
- **🧠 学习记忆** - 自动记录学习进度，支持间隔重复和遗忘曲线复习
- **🌐 多 LLM 支持** - 兼容 OpenAI、Claude、Qwen、Ollama 等多种大语言模型
- **🔒 本地部署** - 数据完全存储在本地，保护隐私安全

---

## 🖼️ 界面展示

### 首页

![首页](screenshots/homepage.png)

### AI 对话

![AI 对话](screenshots/chat.png)

### 知识库

![知识库](screenshots/knowledge.png)

### 长期记忆

![长期记忆](screenshots/memories.png)

### 设置

![设置](screenshots/settings.png)

---

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| Next.js | 16.x | React 框架 |
| React | 19.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| TailwindCSS | 4.x | CSS 框架 |
| shadcn/ui | - | UI 组件库 |
| Zustand | 5.x | 状态管理 |

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| FastAPI | 0.109+ | Web 框架 |
| Python | 3.13+ | 编程语言 |
| PostgreSQL | 14+ | 数据库 |
| pgvector | - | 向量扩展 |
| LangChain | - | LLM 框架 |
| LiteLLM | - | 多模型支持 |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- Python >= 3.13
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
python main.py
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

---

## 📁 项目结构

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
├── screenshots/           # 项目截图
├── docker-compose.yml      # Docker 配置文件
└── README.md              # 项目文档
```

---

## 🏗️ 核心架构

### 系统架构图

```mermaid
graph TB
    subgraph Frontend["🎨 前端层 (Next.js 16)"]
        UI[用户界面]
        State[Zustand 状态管理]
        API_Client[API 客户端]
    end

    subgraph Backend["⚙️ 后端层 (FastAPI)"]
        Router[API 路由]
        Auth[认证中间件]
        
        subgraph Services["业务服务层"]
            ChatService[对话服务]
            DocService[文档服务]
            RAGService[RAG 检索服务]
            MemoryService[记忆服务]
            LLMGateway[LLM 网关]
        end
    end

    subgraph DataLayer["💾 数据层"]
        PG[(PostgreSQL)]
        VectorDB[(pgvector<br/>向量数据库)]
        FileStore[文件存储]
    end

    subgraph External["🌐 外部服务"]
        OpenAI[OpenAI API]
        Claude[Claude API]
        Ollama[Ollama 本地模型]
        Qwen[通义千问 API]
    end

    UI --> State
    State --> API_Client
    API_Client --> Router
    Router --> Auth
    Auth --> Services
    
    ChatService --> LLMGateway
    RAGService --> VectorDB
    DocService --> FileStore
    MemoryService --> PG
    
    LLMGateway --> OpenAI
    LLMGateway --> Claude
    LLMGateway --> Ollama
    LLMGateway --> Qwen
    
    Services --> PG
```

### RAG 数据流图

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 前端界面
    participant API as FastAPI
    participant RAG as RAG 引擎
    participant Embed as 嵌入模型
    participant Vector as 向量数据库
    participant LLM as LLM 模型

    User->>UI: 输入问题
    UI->>API: POST /api/chat
    API->>RAG: 检索相关知识
    RAG->>Embed: 生成查询向量
    Embed-->>RAG: 向量表示
    RAG->>Vector: 语义相似度搜索
    Vector-->>RAG: 相关文档块
    RAG->>RAG: 上下文组装
    RAG->>LLM: 发送 Prompt + 上下文
    LLM-->>RAG: 生成回答
    RAG-->>API: 返回结果
    API-->>UI: 流式响应
    UI-->>User: 显示答案
```

### 文档处理流程图

```mermaid
flowchart LR
    A[用户上传文档] --> B{文件类型}
    
    B -->|PDF| C[PyPDF 提取文本]
    B -->|Word| D[python-docx 解析]
    B -->|Excel| E[pandas 读取]
    B -->|图片| F[OCR 文字识别]
    B -->|视频| G[语音识别]
    
    C --> H[文本分块]
    D --> H
    E --> H
    F --> H
    G --> H
    
    H --> I[生成嵌入向量]
    I --> J[存储到 pgvector]
    J --> K[建立语义索引]
    
    style A fill:#e1f5fe
    style K fill:#c8e6c9
```

### 数据库 E-R 图

```mermaid
erDiagram
    USER ||--o{ CONVERSATION : creates
    USER ||--o{ DOCUMENT : uploads
    USER ||--o{ MEMORY : owns
    
    CONVERSATION ||--o{ MESSAGE : contains
    
    DOCUMENT ||--o{ CHUNK : split_into
    CHUNK }|--|| VECTOR : embedding
    
    MESSAGE ||--o{ CITATION : references
    CHUNK ||--o{ CITATION : cited_by
    
    USER {
        uuid id PK
        string email
        datetime created_at
    }
    
    CONVERSATION {
        uuid id PK
        uuid user_id FK
        string title
        datetime created_at
        datetime updated_at
    }
    
    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        string role
        text content
        json metadata
        datetime created_at
    }
    
    DOCUMENT {
        uuid id PK
        uuid user_id FK
        string filename
        string file_type
        int file_size
        string status
        datetime uploaded_at
    }
    
    CHUNK {
        uuid id PK
        uuid document_id FK
        text content
        int chunk_index
        int token_count
    }
    
    VECTOR {
        uuid chunk_id PK,FK
        vector embedding
    }
    
    MEMORY {
        uuid id PK
        uuid user_id FK
        text content
        string category
        float importance
        datetime created_at
    }
```

### 部署架构图

```mermaid
graph TB
    subgraph Client["客户端"]
        Browser[浏览器]
    end

    subgraph DockerHost["Docker 主机"]
        subgraph AppNetwork["应用网络"]
            Frontend[前端容器<br/>Next.js :3000]
            Backend[后端容器<br/>FastAPI :8000]
            
            subgraph DataStack["数据服务"]
                Postgres[PostgreSQL<br/>:5432]
                PGVector[pgvector 扩展]
            end
        end
    end

    subgraph ExternalAPIs["外部 API"]
        OAI[OpenAI]
        Anthropic[Claude]
        LocalLLM[Ollama<br/>本地模型]
    end

    Browser -->|HTTP| Frontend
    Frontend -->|API 请求| Backend
    Backend -->|SQL| Postgres
    Postgres -->|向量检索| PGVector
    Backend -->|LLM 调用| OAI
    Backend -->|LLM 调用| Anthropic
    Backend -->|本地模型| LocalLLM

    style Client fill:#e3f2fd
    style DockerHost fill:#f3e5f5
    style ExternalAPIs fill:#fff3e0
```

### API 调用时序图

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant F as Frontend
    participant A as Auth
    participant R as Router
    participant S as Service
    participant DB as Database
    participant LLM as LLM Provider

    C->>F: 1. 发起请求
    F->>A: 2. 携带 Token
    
    alt Token 无效
        A-->>F: 401 Unauthorized
        F-->>C: 登录过期提示
    else Token 有效
        A->>R: 3. 通过认证
        R->>S: 4. 调用服务
        
        alt 需要数据库
            S->>DB: 5a. 查询/写入数据
            DB-->>S: 数据结果
        end
        
        alt 需要 LLM
            S->>LLM: 5b. 调用 AI 接口
            LLM-->>S: AI 响应
        end
        
        S-->>R: 6. 业务结果
        R-->>F: 7. HTTP Response
        F-->>C: 8. 渲染界面
    end
```

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

---

## 🔧 开发指南

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
source venv/bin/activate
python main.py       # 开发服务器
```

---

## ⚙️ 环境变量

创建 `.env` 文件配置以下变量：

```env
# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_assistant

# LLM API Keys (可选)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# 其他配置
APP_SECRET=your_secret_key
```

---

## 🗺️ 路线图

- [x] 基础文档管理
- [x] RAG 问答系统
- [x] 多 LLM 支持
- [x] 长期记忆系统
- [ ] 移动端适配
- [ ] 协作功能
- [ ] 插件系统
- [ ] 导出功能

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

---

## 📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/JesstLe">JesstLe</a>
</p>

<p align="center">
  <strong>OpenKnowledge</strong> - 你的本地智能知识助手
</p>
