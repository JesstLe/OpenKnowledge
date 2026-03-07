from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os

from core.database import get_session
from models.database import Document, DocumentChunk
from models.schemas import DocumentResponse, DocumentListResponse
from services.document_service import document_service
from services.embedding_service import embedding_service
from services.rag_service import rag_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    api_key: str = "",  # Pass API key in header in production
    session: AsyncSession = Depends(get_session)
):
    """Upload and process a document"""
    # Validate file type
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_types = [".pdf", ".docx", ".txt", ".md"]
    
    if file_ext not in allowed_types:
        raise HTTPException(400, f"Unsupported file type. Allowed: {allowed_types}")
    
    if not api_key:
        raise HTTPException(400, "OpenAI API key required for embedding generation")
    
    try:
        # Read file content
        content = await file.read()
        
        # Save document
        file_path, _ = await document_service.save_document(file.filename, content)
        
        # Create document record
        document = Document(
            title=file.filename,
            file_type=file_ext,
            file_path=file_path,
            status="processing"
        )
        session.add(document)
        await session.flush()
        
        # Parse document
        text = await document_service.parse_document(file_path, file_ext)
        
        # Chunk text
        chunks = document_service.chunk_text(text)
        
        # Generate embeddings and save chunks
        if chunks:
            embeddings = await embedding_service.get_embeddings(chunks, api_key)
            
            for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                chunk = DocumentChunk(
                    document_id=document.id,
                    content=chunk_text,
                    chunk_index=i,
                    embedding=embedding
                )
                session.add(chunk)
        
        # Update document status
        document.status = "completed"
        await session.commit()
        
        return {
            "id": str(document.id),
            "title": document.title,
            "status": document.status,
            "chunks_count": len(chunks)
        }
        
    except Exception as e:
        await session.rollback()
        raise HTTPException(500, f"Error processing document: {str(e)}")

@router.get("/")
async def list_documents(
    session: AsyncSession = Depends(get_session)
) -> List[dict]:
    """List all documents"""
    result = await session.execute(
        select(Document).order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()
    
    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "file_type": doc.file_type,
            "status": doc.status,
            "created_at": doc.created_at.isoformat()
        }
        for doc in documents
    ]

@router.get("/{document_id}")
async def get_document(
    document_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Get document details"""
    from uuid import UUID
    
    result = await session.execute(
        select(Document).where(Document.id == UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(404, "Document not found")
    
    return {
        "id": str(doc.id),
        "title": doc.title,
        "file_type": doc.file_type,
        "status": doc.status,
        "created_at": doc.created_at.isoformat()
    }

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Delete a document"""
    from uuid import UUID
    
    result = await session.execute(
        select(Document).where(Document.id == UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Delete file
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    
    await session.delete(doc)
    await session.commit()
    
    return {"message": "Document deleted"}

@router.post("/search")
async def search_documents(
    query: str,
    api_key: str = "",
    limit: int = 5,
    session: AsyncSession = Depends(get_session)
):
    """Search for relevant document chunks"""
    if not api_key:
        raise HTTPException(400, "API key required")
    
    chunks = await rag_service.search_similar(query, api_key, session, limit)
    
    return [
        {
            "id": str(chunk.id),
            "content": chunk.content,
            "document_id": str(chunk.document_id),
            "chunk_index": chunk.chunk_index
        }
        for chunk in chunks
    ]
