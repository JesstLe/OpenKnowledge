from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ChatRequest(BaseModel):
    message: str
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-3.5-turbo"

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
    use_rag: bool = True
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-3.5-turbo"
