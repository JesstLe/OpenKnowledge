from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import traceback

from models.schemas import ChatRequest, RAGChatRequest
from services.llm_service import llm_service
from services.conversation_service import conversation_service
from services.memory_service import memory_service
from services.tools_service import tools_service
from core.database import get_session, async_session_maker
import uuid
import asyncio

router = APIRouter(prefix="/api", tags=["chat"])


async def _extract_memories_background(
    conversation_id: str,
    api_key: str,
    provider: str = "openai",
    base_url: str = None
):
    """Background task to extract memories from conversation"""
    try:
        async with async_session_maker() as session:
            # Get recent conversation messages
            messages = await conversation_service.get_recent_messages(
                session=session,
                conversation_id=conversation_id,
                limit=10  # Last 10 messages
            )

            if len(messages) < 2:  # Need at least user + assistant
                return

            # Format conversation text
            conversation_text = "\n".join([
                f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}"
                for m in messages
            ])

            # Extract memories
            extracted = await memory_service.extract_memories_from_conversation(
                conversation_text=conversation_text,
                api_key=api_key,
                session=session,
                provider=provider,
                base_url=base_url
            )

            if extracted:
                print(f"[Auto Memory] Extracted {len(extracted)} memories from conversation {conversation_id}")

    except Exception as e:
        print(f"[Auto Memory Error] {type(e).__name__}: {e}")


@router.post("/chat")
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session)
):
    """Basic chat with conversation persistence"""
    # 如果指定了 conversation_id，使用持久化对话的上下文
    optimized_context = []
    if request.conversationId:
        optimized_context = await conversation_service.get_optimized_context(
            session=session,
            conversation_id=request.conversationId,
            current_model=request.model
        )
        # 保存用户消息
        await conversation_service.add_message(
            session=session,
            conversation_id=request.conversationId,
            role="user",
            content=request.message,
            model=request.model
        )

    async def generate():
        assistant_content = ""
        try:
            # 使用优化的上下文（包含摘要+最近消息）
            async for chunk in llm_service.stream_chat(
                message=request.message,
                api_key=request.apiKey,
                model=request.model,
                use_rag=False,
                use_memory=False,
                base_url=request.baseUrl,
                session=session,
                history=optimized_context
            ):
                assistant_content += chunk
                yield chunk

            # 保存助手回复
            if request.conversationId:
                await conversation_service.add_message(
                    session=session,
                    conversation_id=request.conversationId,
                    role="assistant",
                    content=assistant_content,
                    model=request.model
                )

                # 检查是否需要生成摘要
                should_summary = await conversation_service.should_generate_summary(
                    session=session,
                    conversation_id=request.conversationId
                )
                if should_summary:
                    # 异步生成摘要（不阻塞响应）
                    import asyncio
                    asyncio.create_task(
                        conversation_service.generate_summary(
                            session=session,
                            conversation_id=request.conversationId,
                            api_key=request.apiKey
                        )
                    )

        except Exception as e:
            print(f"[Chat Error] {type(e).__name__}: {e}")
            traceback.print_exc()
            yield f"[ERROR]{str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/chat/rag")
async def chat_with_rag(
    request: RAGChatRequest,
    session: AsyncSession = Depends(get_session)
):
    """Chat with RAG, memory and conversation persistence"""
    # 获取优化的上下文
    optimized_context = []
    if request.conversationId:
        optimized_context = await conversation_service.get_optimized_context(
            session=session,
            conversation_id=request.conversationId,
            current_model=request.model
        )
        # 保存用户消息
        await conversation_service.add_message(
            session=session,
            conversation_id=request.conversationId,
            role="user",
            content=request.message,
            model=request.model
        )

    async def generate():
        assistant_content = ""
        try:
            async for chunk in llm_service.stream_chat(
                message=request.message,
                api_key=request.apiKey,
                model=request.model,
                use_rag=request.use_rag,
                use_memory=request.use_memory,
                use_tools=request.use_tools,
                base_url=request.baseUrl,
                session=session,
                history=optimized_context
            ):
                assistant_content += chunk
                yield chunk

            # 保存助手回复
            if request.conversationId:
                await conversation_service.add_message(
                    session=session,
                    conversation_id=request.conversationId,
                    role="assistant",
                    content=assistant_content,
                    model=request.model
                )

                # 检查是否需要生成摘要
                should_summary = await conversation_service.should_generate_summary(
                    session=session,
                    conversation_id=request.conversationId
                )
                if should_summary:
                    asyncio.create_task(
                        conversation_service.generate_summary(
                            session=session,
                            conversation_id=request.conversationId,
                            api_key=request.apiKey
                        )
                    )

                # 自动提取记忆（当开启记忆功能时）
                if request.use_memory:
                    asyncio.create_task(
                        _extract_memories_background(
                            conversation_id=request.conversationId,
                            api_key=request.apiKey,
                            provider=request.model.split("-")[0] if "-" in request.model else "openai",
                            base_url=request.baseUrl
                        )
                    )

        except Exception as e:
            print(f"[RAG Chat Error] {type(e).__name__}: {e}")
            traceback.print_exc()
            yield f"[ERROR]{str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/tools")
async def list_tools():
    """List available tools for agent"""
    return {
        "tools": [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters
            }
            for tool in tools_service.tools.values()
        ]
    }
