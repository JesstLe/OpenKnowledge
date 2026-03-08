from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime

from core.database import get_session
from models.database import Memory
from models.schemas import MemoryCreate, MemoryUpdate, MemoryResponse
from services.memory_service import memory_service
from services.embedding_service import embedding_service

router = APIRouter(prefix="/api/memories", tags=["memories"])

@router.post("/")
async def create_memory(
    data: MemoryCreate,
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    session: AsyncSession = Depends(get_session)
):
    """Create a new memory manually"""
    if not api_key:
        raise HTTPException(400, "API key required for embedding generation")

    memory = await memory_service.create_memory(
        content=data.content,
        api_key=api_key,
        session=session,
        category=data.category,
        importance=data.importance,
        source="manual",
        provider=provider,
        base_url=base_url if base_url else None
    )
    
    return {
        "id": str(memory.id),
        "content": memory.content,
        "category": memory.category,
        "importance": memory.importance,
        "created_at": memory.created_at.isoformat()
    }

@router.get("/")
async def list_memories(
    category: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """List all memories"""
    memories = await memory_service.list_memories(session, category)
    
    return [
        {
            "id": str(m.id),
            "content": m.content,
            "category": m.category,
            "importance": m.importance,
            "source": m.source,
            "created_at": m.created_at.isoformat(),
            "access_count": m.access_count
        }
        for m in memories
    ]

@router.get("/search")
async def search_memories(
    query: str,
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    limit: int = 5,
    session: AsyncSession = Depends(get_session)
):
    """Search memories by semantic similarity"""
    if not api_key:
        raise HTTPException(400, "API key required")

    memories = await memory_service.search_relevant_memories(
        query, api_key, session, limit, provider, base_url if base_url else None
    )

    return [
        {
            "id": str(m.id),
            "content": m.content,
            "category": m.category,
            "importance": m.importance
        }
        for m in memories
    ]

@router.put("/{memory_id}")
async def update_memory(
    memory_id: str,
    data: MemoryUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a memory"""
    memory = await memory_service.update_memory(
        memory_id, session, content=data.content, importance=data.importance
    )
    
    if not memory:
        raise HTTPException(404, "Memory not found")
    
    return {
        "id": str(memory.id),
        "content": memory.content,
        "category": memory.category,
        "importance": memory.importance
    }

@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Delete a memory"""
    success = await memory_service.delete_memory(memory_id, session)
    
    if not success:
        raise HTTPException(404, "Memory not found")
    
    return {"message": "Memory deleted"}

@router.post("/extract")
async def extract_memories(
    conversation_text: str,
    api_key: str = "",
    session: AsyncSession = Depends(get_session)
):
    """Extract memories from conversation text"""
    if not api_key:
        raise HTTPException(400, "API key required")
    
    memories = await memory_service.extract_memories_from_conversation(
        conversation_text, api_key, session
    )
    
    return [
        {
            "id": str(m.id),
            "content": m.content,
            "category": m.category,
            "importance": m.importance
        }
        for m in memories
    ]
