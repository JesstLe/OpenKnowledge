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
    conversation_id = request.conversationId or str(uuid.uuid4())

    async def generate():
        async for chunk in llm_service.stream_chat(
            message=request.message,
            api_key=request.apiKey,
            model=request.model,
            use_rag=False,
            session=session
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/chat/rag")
async def chat_with_rag(
    request: RAGChatRequest,
    session: AsyncSession = Depends(get_session)
):
    """Chat with RAG context from uploaded documents"""
    conversation_id = request.conversationId or str(uuid.uuid4())

    async def generate():
        async for chunk in llm_service.stream_chat(
            message=request.message,
            api_key=request.apiKey,
            model=request.model,
            use_rag=request.use_rag,
            session=session
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")
