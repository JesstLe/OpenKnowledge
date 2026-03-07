from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from typing import AsyncIterable, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from services.rag_service import rag_service

class LLMService:
    async def stream_chat(
        self,
        message: str,
        api_key: str,
        model: str = "gpt-3.5-turbo",
        use_rag: bool = False,
        session: Optional[AsyncSession] = None
    ) -> AsyncIterable[str]:
        llm = ChatOpenAI(api_key=api_key, model=model, streaming=True)
        
        messages = []
        
        # Add RAG context if enabled
        if use_rag and session:
            context = await rag_service.get_context_for_query(message, api_key, session)
            if context:
                system_prompt = f"""You are a helpful assistant. Use the following context to answer the user's question. If the context doesn't contain relevant information, say so.

Context:
{context}

Answer the user's question based on the context above."""
                messages.append(SystemMessage(content=system_prompt))
        
        messages.append(HumanMessage(content=message))
        
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content

llm_service = LLMService()
