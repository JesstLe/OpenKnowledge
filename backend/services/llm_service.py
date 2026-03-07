from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from typing import AsyncIterable, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from services.rag_service import rag_service
from services.memory_service import memory_service

class LLMService:
    async def stream_chat(
        self,
        message: str,
        api_key: str,
        model: str = "gpt-3.5-turbo",
        use_rag: bool = False,
        use_memory: bool = False,
        session: Optional[AsyncSession] = None
    ) -> AsyncIterable[str]:
        llm = ChatOpenAI(api_key=api_key, model=model, streaming=True)
        
        messages = []
        context_parts = []
        
        # Add memory context if enabled
        if use_memory and session:
            memory_context = await memory_service.get_memory_context(
                message, api_key, session, limit=5
            )
            if memory_context:
                context_parts.append(memory_context)
        
        # Add RAG context if enabled
        if use_rag and session:
            rag_context = await rag_service.get_context_for_query(
                message, api_key, session
            )
            if rag_context:
                context_parts.append("Relevant documents:\n" + rag_context)
        
        # Build system prompt with context
        if context_parts:
            system_content = "You are a helpful assistant.\n\n" + "\n\n".join(context_parts)
            system_content += "\n\nUse the above context to answer the user's question. If the context doesn't contain relevant information, say so."
            messages.append(SystemMessage(content=system_content))
        
        messages.append(HumanMessage(content=message))
        
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content

llm_service = LLMService()
