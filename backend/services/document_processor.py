"""
Background document processor with progress tracking
"""
import asyncio
import threading
from typing import Dict, Callable, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid


@dataclass
class ProcessingJob:
    id: str
    document_id: str
    status: str = "pending"  # pending, processing, completed, failed
    progress: int = 0  # 0-100
    current_page: int = 0
    total_pages: int = 0
    message: str = ""
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


class DocumentProcessor:
    """Background document processor with progress tracking"""

    def __init__(self):
        self.jobs: Dict[str, ProcessingJob] = {}
        self._lock = threading.Lock()
        self._callbacks: Dict[str, list] = {}

    def create_job(self, document_id: str) -> str:
        """Create a new processing job"""
        job_id = str(uuid.uuid4())
        job = ProcessingJob(
            id=job_id,
            document_id=document_id,
            status="pending",
            message="等待处理..."
        )
        with self._lock:
            self.jobs[job_id] = job
            self._callbacks[job_id] = []
        return job_id

    def get_job(self, job_id: str) -> Optional[ProcessingJob]:
        """Get job by ID"""
        return self.jobs.get(job_id)

    def get_job_by_document(self, document_id: str) -> Optional[ProcessingJob]:
        """Get latest job for a document"""
        for job in reversed(list(self.jobs.values())):
            if job.document_id == document_id:
                return job
        return None

    def update_progress(self, job_id: str, current: int, total: int, message: str = ""):
        """Update job progress"""
        if job_id not in self.jobs:
            return

        job = self.jobs[job_id]
        job.current_page = current
        job.total_pages = total
        job.progress = min(100, int((current / total) * 100)) if total > 0 else 0
        job.message = message or f"已处理 {current}/{total} 页"
        job.updated_at = datetime.utcnow()

        # Trigger callbacks
        self._trigger_callbacks(job_id, job)

    def complete_job(self, job_id: str, chunks_count: int = 0):
        """Mark job as completed"""
        if job_id not in self.jobs:
            return

        job = self.jobs[job_id]
        job.status = "completed"
        job.progress = 100
        job.message = f"处理完成，生成 {chunks_count} 个文本块"
        job.updated_at = datetime.utcnow()
        self._trigger_callbacks(job_id, job)

    def fail_job(self, job_id: str, error: str):
        """Mark job as failed"""
        if job_id not in self.jobs:
            return

        job = self.jobs[job_id]
        job.status = "failed"
        job.error = error
        job.message = f"处理失败: {error}"
        job.updated_at = datetime.utcnow()
        self._trigger_callbacks(job_id, job)

    def start_job(self, job_id: str):
        """Mark job as started"""
        if job_id not in self.jobs:
            return

        job = self.jobs[job_id]
        job.status = "processing"
        job.message = "开始处理..."
        job.updated_at = datetime.utcnow()
        self._trigger_callbacks(job_id, job)

    def on_progress(self, job_id: str, callback: Callable):
        """Register progress callback"""
        with self._lock:
            if job_id in self._callbacks:
                self._callbacks[job_id].append(callback)

    def _trigger_callbacks(self, job_id: str, job: ProcessingJob):
        """Trigger all callbacks for a job"""
        callbacks = self._callbacks.get(job_id, [])
        for callback in callbacks:
            try:
                callback(job)
            except Exception:
                pass

    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove old completed/failed jobs"""
        cutoff = datetime.utcnow() - __import__('datetime').timedelta(hours=max_age_hours)
        with self._lock:
            to_remove = [
                job_id for job_id, job in self.jobs.items()
                if job.status in ("completed", "failed") and job.updated_at < cutoff
            ]
            for job_id in to_remove:
                del self.jobs[job_id]
                del self._callbacks[job_id]


# Global processor instance
document_processor = DocumentProcessor()
