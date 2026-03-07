from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest
from services.llm_service import llm_service
import uuid

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat")
async def chat(request: ChatRequest):
    conversation_id = request.conversationId or str(uuid.uuid4())

    async def generate():
        async for chunk in llm_service.stream_chat(
            message=request.message,
            api_key=request.apiKey,
            model=request.model
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")
