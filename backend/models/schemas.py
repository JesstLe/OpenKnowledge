from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-5-mini"
    baseUrl: Optional[str] = None


class DocumentResponse(BaseModel):
    id: str
    title: str
    file_type: str
    status: str
    created_at: datetime
    chunks_count: Optional[int] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]


class SearchResult(BaseModel):
    id: str
    content: str
    document_id: str
    chunk_index: int


class RAGChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    use_rag: bool = True
    use_memory: bool = True
    use_tools: bool = False
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-5-mini"
    baseUrl: Optional[str] = None


# Memory schemas
class MemoryCreate(BaseModel):
    content: str
    category: str = "fact"  # preference, fact, goal, important
    importance: int = 5  # 1-10


class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    importance: Optional[int] = None


class MemoryResponse(BaseModel):
    id: str
    content: str
    category: str
    importance: int
    source: str
    created_at: datetime
    access_count: int
