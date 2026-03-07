import os
from typing import List
from pypdf import PdfReader
from docx import Document as DocxDocument
import uuid

class DocumentService:
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    async def save_document(self, file_name: str, content: bytes) -> str:
        """Save uploaded document and return file path"""
        file_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file_name)[1].lower()
        file_path = os.path.join(self.upload_dir, f"{file_id}{file_ext}")
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        return file_path, file_ext
    
    async def parse_document(self, file_path: str, file_type: str) -> str:
        """Parse document and return text content"""
        if file_type == ".pdf":
            return self._parse_pdf(file_path)
        elif file_type == ".docx":
            return self._parse_docx(file_path)
        elif file_type in [".txt", ".md"]:
            return self._parse_text(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    
    def _parse_pdf(self, file_path: str) -> str:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    
    def _parse_docx(self, file_path: str) -> str:
        doc = DocxDocument(file_path)
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    
    def _parse_text(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    
    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into chunks with overlap"""
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk = text[start:end]
            chunks.append(chunk)
            start += chunk_size - overlap
        
        return chunks

document_service = DocumentService()
