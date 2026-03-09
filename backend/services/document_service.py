import os
import asyncio
import tempfile
from typing import List
from pypdf import PdfReader
from docx import Document as DocxDocument
import uuid

try:
    import fitz
except ImportError:
    fitz = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import pymupdf4llm
except ImportError:
    pymupdf4llm = None

try:
    from ocrmac import ocrmac
except ImportError:
    ocrmac = None

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    RapidOCR = None

MEANINGFUL_TEXT_MIN_CHARS = 60


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

    async def parse_document(
        self,
        file_path: str,
        file_type: str,
        start_page: int = None,
        end_page: int = None,
    ) -> str:
        """Parse document and return text content

        Args:
            file_path: Path to the document
            file_type: File extension (.pdf, .docx, .txt, .md)
            start_page: For PDFs, start from this page (0-indexed, optional)
            end_page: For PDFs, end at this page (exclusive, optional)
        """
        if file_type == ".pdf":
            return await asyncio.to_thread(
                self._parse_pdf,
                file_path,
                start_page or 0,
                end_page,
            )
        elif file_type == ".docx":
            return await asyncio.to_thread(self._parse_docx, file_path)
        elif file_type in [".txt", ".md"]:
            return await asyncio.to_thread(self._parse_text, file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def _parse_pdf(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        extractor_sequence = [
            self._parse_pdf_with_pymupdf4llm,
            self._parse_pdf_with_pypdf,
            self._parse_pdf_with_pymupdf,
            self._parse_pdf_with_pdfplumber,
            self._parse_pdf_with_ocrmac,
            self._parse_pdf_with_rapidocr,
        ]

        first_non_empty_text = ""

        for extractor in extractor_sequence:
            try:
                extracted_text = extractor(file_path, start_page, end_page)
            except Exception:
                continue

            if extracted_text and extracted_text.strip() and not first_non_empty_text:
                first_non_empty_text = extracted_text

            if self.has_meaningful_text(extracted_text):
                return extracted_text

        return first_non_empty_text

    def _parse_pdf_with_pymupdf4llm(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        if pymupdf4llm is None:
            return ""

        doc = fitz.open(file_path) if fitz is not None else None
        total_pages = doc.page_count if doc is not None else 0
        if doc is not None:
            doc.close()

        if total_pages <= 0:
            return ""

        start = max(0, start_page)
        end = min(total_pages, end_page) if end_page is not None else total_pages
        if end <= start:
            return ""

        pages = list(range(start, end))
        markdown_text = pymupdf4llm.to_markdown(file_path, pages=pages)
        return markdown_text if isinstance(markdown_text, str) else ""

    def _parse_pdf_with_pypdf(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        reader = PdfReader(file_path)
        total_pages = len(reader.pages)
        start = max(0, start_page)
        end = min(total_pages, end_page) if end_page is not None else total_pages

        text_parts: list[str] = []
        for i in range(start, end):
            page = reader.pages[i]
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f"\n--- 第 {i + 1} 页 ---\n{page_text}\n")

        return "".join(text_parts)

    def _parse_pdf_with_pymupdf(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        if fitz is None:
            return ""

        doc = fitz.open(file_path)
        try:
            total_pages = doc.page_count
            start = max(0, start_page)
            end = min(total_pages, end_page) if end_page is not None else total_pages

            text_parts: list[str] = []
            for i in range(start, end):
                page = doc.load_page(i)
                page_text = page.get_text("text")
                if page_text:
                    text_parts.append(f"\n--- 第 {i + 1} 页 ---\n{page_text}\n")

            return "".join(text_parts)
        finally:
            doc.close()

    def _parse_pdf_with_pdfplumber(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        if pdfplumber is None:
            return ""

        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            start = max(0, start_page)
            end = min(total_pages, end_page) if end_page is not None else total_pages

            text_parts: list[str] = []
            for i in range(start, end):
                page = pdf.pages[i]
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"\n--- 第 {i + 1} 页 ---\n{page_text}\n")

            return "".join(text_parts)

    def _parse_pdf_with_rapidocr(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        if RapidOCR is None or fitz is None:
            return ""

        ocr_engine = RapidOCR()
        doc = fitz.open(file_path)
        try:
            total_pages = doc.page_count
            start = max(0, start_page)
            end = min(total_pages, end_page) if end_page is not None else total_pages

            text_parts: list[str] = []
            for i in range(start, end):
                page = doc.load_page(i)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)

                temp_path = ""
                try:
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                        temp_path = f.name
                        pix.save(temp_path)

                    ocr_result, _ = ocr_engine(temp_path)
                    if not ocr_result:
                        continue

                    line_texts: list[str] = []
                    for item in ocr_result:
                        if isinstance(item, list) and len(item) >= 2:
                            line = item[1]
                            if isinstance(line, str) and line.strip():
                                line_texts.append(line.strip())

                    if line_texts:
                        text_parts.append(
                            f"\n--- 第 {i + 1} 页 ---\n{'\n'.join(line_texts)}\n"
                        )
                finally:
                    if temp_path and os.path.exists(temp_path):
                        os.remove(temp_path)

            return "".join(text_parts)
        finally:
            doc.close()

    def _parse_pdf_with_ocrmac(
        self, file_path: str, start_page: int = 0, end_page: int = None
    ) -> str:
        if ocrmac is None or fitz is None:
            return ""

        doc = fitz.open(file_path)
        try:
            total_pages = doc.page_count
            start = max(0, start_page)
            end = min(total_pages, end_page) if end_page is not None else total_pages

            text_parts: list[str] = []
            for i in range(start, end):
                page = doc.load_page(i)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)

                temp_path = ""
                try:
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                        temp_path = f.name
                        pix.save(temp_path)

                    ocr = ocrmac.OCR(
                        temp_path,
                        language_preference=["zh-Hans", "en-US"],
                    )
                    annotations = ocr.recognize()
                    if not annotations:
                        continue

                    line_texts = [
                        item[0].strip()
                        for item in annotations
                        if isinstance(item, tuple)
                        and len(item) > 0
                        and isinstance(item[0], str)
                        and item[0].strip()
                    ]

                    if line_texts:
                        text_parts.append(
                            f"\n--- 第 {i + 1} 页 ---\n{'\n'.join(line_texts)}\n"
                        )
                finally:
                    if temp_path and os.path.exists(temp_path):
                        os.remove(temp_path)

            return "".join(text_parts)
        finally:
            doc.close()

    def has_meaningful_text(
        self, text: str, min_chars: int = MEANINGFUL_TEXT_MIN_CHARS
    ) -> bool:
        compact = "".join(text.split())
        valid_chars = sum(1 for ch in compact if ch.isalnum())
        return valid_chars >= min_chars

    def get_pdf_info(self, file_path: str) -> dict:
        """Get PDF metadata (page count, file size)"""
        reader = PdfReader(file_path)
        file_size = os.path.getsize(file_path)
        return {
            "total_pages": len(reader.pages),
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
        }

    def _parse_docx(self, file_path: str) -> str:
        doc = DocxDocument(file_path)
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text

    def _parse_text(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    def chunk_text(
        self, text: str, chunk_size: int = 1000, overlap: int = 200
    ) -> List[str]:
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
