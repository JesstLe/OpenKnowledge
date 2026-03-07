from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from models.schemas import ChatRequest, RAGChatRequest
from services.llm_service import llm_service
from core.database import get_session
import uuid

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat")
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session)
):
    """Basic chat without RAG or memory"""
    async def generate():
        async for chunk in llm_service.stream_chat(
            message=request.message,
            api_key=request.apiKey,
            model=request.model,
            use_rag=False,
            use_memory=False,
            session=session
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/chat/rag")
async def chat_with_rag(
    request: RAGChatRequest,
    session: AsyncSession = Depends(get_session)
):
    """Chat with RAG and/or memory context"""
    async def generate():
        async for chunk in llm_service.stream_chat(
            message=request.message,
            api_key=request.apiKey,
            model=request.model,
            use_rag=request.use_rag,
            use_memory=request.use_memory,
            session=session
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")
