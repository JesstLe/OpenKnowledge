from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage
from typing import AsyncIterable

class LLMService:
    async def stream_chat(self, message: str, api_key: str, model: str = "gpt-3.5-turbo") -> AsyncIterable[str]:
        llm = ChatOpenAI(api_key=api_key, model=model, streaming=True)
        messages = [HumanMessage(content=message)]
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content

llm_service = LLMService()
