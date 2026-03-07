from openai import AsyncOpenAI
from typing import List

class EmbeddingService:
    async def get_embeddings(self, texts: List[str], api_key: str) -> List[List[float]]:
        """Get embeddings for a list of texts"""
        client = AsyncOpenAI(api_key=api_key)
        
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=texts
        )
        
        return [item.embedding for item in response.data]
    
    async def get_single_embedding(self, text: str, api_key: str) -> List[float]:
        """Get embedding for a single text"""
        embeddings = await self.get_embeddings([text], api_key)
        return embeddings[0]

embedding_service = EmbeddingService()
