from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os
import asyncio
from datetime import datetime, timedelta

from core.database import get_session, async_session_maker
from models.database import Document, DocumentChunk
from models.schemas import DocumentResponse, DocumentListResponse
from services.document_service import document_service
from services.embedding_service import embedding_service
from services.rag_service import rag_service
from services.document_processor import document_processor

router = APIRouter(prefix="/api/documents", tags=["documents"])

PDF_PAGES_PER_REQUEST = 20
PDF_PARSE_TIMEOUT_SECONDS = 20
PROCESSING_TIMEOUT_MINUTES = 30


async def _reconcile_stuck_processing_documents() -> None:
    cutoff = datetime.utcnow() - timedelta(minutes=PROCESSING_TIMEOUT_MINUTES)
    async with async_session_maker() as session:
        result = await session.execute(
            select(Document).where(
                Document.status == "processing", Document.created_at < cutoff
            )
        )
        stale_docs = result.scalars().all()
        if not stale_docs:
            return

        for doc in stale_docs:
            doc.status = "failed"

        await session.commit()


async def _process_document_async(
    document_id,
    file_path: str,
    file_ext: str,
    api_key: str,
    provider: str,
    base_url: str,
    use_local_embedding: bool,
):
    # Create processing job
    job_id = document_processor.create_job(str(document_id))
    document_processor.start_job(job_id)

    async with async_session_maker() as session:
        doc = await session.get(Document, document_id)
        if doc is None:
            document_processor.fail_job(job_id, "Document not found")
            return

        try:
            # For PDFs, get page count for progress tracking
            total_pages = 0
            if file_ext == ".pdf":
                doc_info = await asyncio.to_thread(document_service.get_pdf_info, file_path)
                total_pages = doc_info.get("total_pages", 0)
                document_processor.update_progress(job_id, 0, total_pages, "开始解析 PDF...")

            # Parse document (streaming for large files)
            text = await document_service.parse_document(file_path, file_ext)

            if file_ext == ".pdf" and not text.strip():
                doc.status = "failed"
                await session.commit()
                document_processor.fail_job(job_id, "PDF 未提取到可检索文本，可能是扫描版")
                return

            document_processor.update_progress(job_id, total_pages // 2 if total_pages else 50, total_pages or 100, "正在分块...")

            chunks = document_service.chunk_text(text)

            if chunks:
                document_processor.update_progress(job_id, total_pages * 3 // 4 if total_pages else 75, total_pages or 100, f"正在生成 {len(chunks)} 个向量嵌入...")

                embeddings = await embedding_service.get_embeddings(
                    chunks,
                    api_key,
                    provider,
                    base_url if base_url else None,
                    use_local_embedding,
                )

                if len(embeddings) != len(chunks):
                    raise RuntimeError("Embedding count does not match chunk count")

                for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                    session.add(
                        DocumentChunk(
                            document_id=doc.id,
                            content=chunk_text,
                            chunk_index=i,
                            embedding=embedding,
                        )
                    )

            doc.status = "completed"
            await session.commit()
            document_processor.complete_job(job_id, len(chunks))
        except Exception as e:
            await session.rollback()
            doc = await session.get(Document, document_id)
            if doc is not None:
                doc.status = "failed"
                await session.commit()
            document_processor.fail_job(job_id, str(e))


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    use_local_embedding: bool = False,
    session: AsyncSession = Depends(get_session),
):
    """Upload and process a document"""
    # Validate file type
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_types = [".pdf", ".docx", ".txt", ".md"]

    if file_ext not in allowed_types:
        raise HTTPException(400, f"Unsupported file type. Allowed: {allowed_types}")

    # Only require API key if not using local embedding
    if not use_local_embedding and not api_key:
        raise HTTPException(
            400, f"API key required for {provider} embedding generation"
        )

    try:
        await _reconcile_stuck_processing_documents()

        # Read file content
        content = await file.read()

        # Save document
        file_path, _ = await document_service.save_document(file.filename, content)

        # Create document record
        document = Document(
            title=file.filename,
            file_type=file_ext,
            file_path=file_path,
            status="processing",
        )
        session.add(document)
        await session.commit()

        asyncio.create_task(
            _process_document_async(
                document.id,
                file_path,
                file_ext,
                api_key,
                provider,
                base_url,
                use_local_embedding,
            )
        )

        return {
            "id": str(document.id),
            "title": document.title,
            "status": document.status,
            "chunks_count": 0,
        }
    except Exception as e:
        await session.rollback()
        raise HTTPException(500, f"Error processing document: {str(e)}")


@router.get("/")
async def list_documents(session: AsyncSession = Depends(get_session)) -> List[dict]:
    """List all documents"""
    await _reconcile_stuck_processing_documents()

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
            "created_at": doc.created_at.isoformat(),
        }
        for doc in documents
    ]


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    start_page: int = 0,
    end_page: int = PDF_PAGES_PER_REQUEST,
    session: AsyncSession = Depends(get_session),
):
    """Get document content (parsed text) with pagination support for PDFs"""
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    try:
        doc_info = {}
        if doc.file_type == ".pdf":
            doc_info = await asyncio.to_thread(
                document_service.get_pdf_info, doc.file_path
            )

            total_pages = doc_info["total_pages"]
            start = max(0, start_page)
            requested_end = max(start, end_page)
            safe_end = min(
                total_pages, min(requested_end, start + PDF_PAGES_PER_REQUEST)
            )

            if start >= total_pages:
                return {
                    "id": str(doc.id),
                    "title": doc.title,
                    "file_type": doc.file_type,
                    "content": "",
                    "total_pages": total_pages,
                    "file_size_mb": doc_info["file_size_mb"],
                    "start_page": start,
                    "end_page": start,
                    "loaded_pages": 0,
                    "next_start_page": None,
                }

            try:
                text = await asyncio.wait_for(
                    document_service.parse_document(
                        doc.file_path,
                        doc.file_type,
                        start,
                        safe_end,
                    ),
                    timeout=PDF_PARSE_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                raise HTTPException(504, "PDF 解析超时，请缩小页面范围后重试")

            response = {
                "id": str(doc.id),
                "title": doc.title,
                "file_type": doc.file_type,
                "content": text,
                "total_pages": total_pages,
                "file_size_mb": doc_info["file_size_mb"],
                "start_page": start,
                "end_page": safe_end,
                "loaded_pages": max(0, safe_end - start),
                "next_start_page": safe_end if safe_end < total_pages else None,
            }

            return response

        text = await document_service.parse_document(doc.file_path, doc.file_type)

        response = {
            "id": str(doc.id),
            "title": doc.title,
            "file_type": doc.file_type,
            "content": text,
        }

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error reading document: {str(e)}")


@router.get("/{document_id}/preview-info")
async def get_document_preview_info(
    document_id: str,
    session: AsyncSession = Depends(get_session),
):
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "Document file not found")

    response = {
        "id": str(doc.id),
        "title": doc.title,
        "file_type": doc.file_type,
    }

    if doc.file_type == ".pdf":
        doc_info = await asyncio.to_thread(document_service.get_pdf_info, doc.file_path)
        response["total_pages"] = doc_info["total_pages"]
        response["file_size_mb"] = doc_info["file_size_mb"]

    return response


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    session: AsyncSession = Depends(get_session),
):
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "Document file not found")

    media_type = "application/octet-stream"
    if doc.file_type == ".pdf":
        media_type = "application/pdf"
    elif doc.file_type == ".txt":
        media_type = "text/plain; charset=utf-8"
    elif doc.file_type == ".md":
        media_type = "text/markdown; charset=utf-8"

    return FileResponse(
        path=doc.file_path,
        media_type=media_type,
        filename=doc.title,
    )


@router.get("/{document_id}")
async def get_document(document_id: str, session: AsyncSession = Depends(get_session)):
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
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: str, session: AsyncSession = Depends(get_session)
):
    """Get document processing status with progress"""
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    # Get processing job if exists
    job = document_processor.get_job_by_document(str(doc.id))

    response = {
        "id": str(doc.id),
        "title": doc.title,
        "status": doc.status,
        "file_type": doc.file_type,
    }

    if job:
        response["progress"] = {
            "percent": job.progress,
            "current_page": job.current_page,
            "total_pages": job.total_pages,
            "message": job.message,
        }

    return response


@router.delete("/{document_id}")
async def delete_document(
    document_id: str, session: AsyncSession = Depends(get_session)
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
    provider: str = "openai",
    base_url: str = "",
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
):
    """Search for relevant document chunks"""
    if not api_key:
        raise HTTPException(400, "API key required")

    chunks = await rag_service.search_similar(
        query, api_key, session, limit, provider, base_url if base_url else None
    )

    return [
        {
            "id": str(chunk.id),
            "content": chunk.content,
            "document_id": str(chunk.document_id),
            "chunk_index": chunk.chunk_index,
        }
        for chunk in chunks
    ]
