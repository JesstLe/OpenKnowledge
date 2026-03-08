from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import DocumentChunk
from services.embedding_service import embedding_service

class RAGService:
    async def search_similar(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None
    ) -> List[DocumentChunk]:
        """Search for similar chunks using vector similarity"""
        # Get query embedding
        query_embedding = await embedding_service.get_single_embedding(
            query, api_key, provider, base_url
        )

        # Search using cosine similarity
        result = await session.execute(
            select(DocumentChunk)
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )

        return result.scalars().all()

    async def get_context_for_query(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None
    ) -> str:
        """Get relevant context for a query"""
        chunks = await self.search_similar(query, api_key, session, limit, provider, base_url)

        if not chunks:
            return ""

        context = "\n\n".join([chunk.content for chunk in chunks])
        return context

rag_service = RAGService()
