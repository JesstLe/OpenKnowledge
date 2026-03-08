#!/usr/bin/env python3
"""
启动本地 EmbeddingGemma 模型服务
兼容 OpenAI Embedding API 格式
"""
import os
import sys
import asyncio
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from contextlib import asynccontextmanager

# Model path
MODEL_PATH = os.path.expanduser("~/.node-llama-cpp/models/embeddinggemma-300M-Q8_0.gguf")

if not os.path.exists(MODEL_PATH):
    print(f"Error: Model not found at {MODEL_PATH}")
    sys.exit(1)

print(f"Loading model: {MODEL_PATH}")

try:
    from llama_cpp import Llama
    llm = Llama(model_path=MODEL_PATH, embedding=True, verbose=False)
    print("Model loaded successfully!")
except ImportError:
    print("Error: llama-cpp-python not installed")
    print("Run: pip install llama-cpp-python")
    sys.exit(1)

# FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Local embedding service started on http://localhost:8088")
    yield
    print("Shutting down...")

app = FastAPI(title="Local Embedding Service", lifespan=lifespan)

class EmbeddingRequest(BaseModel):
    model: str = "embedding-gemma"
    input: List[str]

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[dict]
    model: str

@app.post("/v1/embeddings")
async def create_embedding(request: EmbeddingRequest):
    """OpenAI-compatible embedding endpoint"""
    embeddings = []

    for i, text in enumerate(request.input):
        # llama-cpp embedding
        embed = llm.embed(text)
        embeddings.append({
            "object": "embedding",
            "embedding": embed,
            "index": i
        })

    return EmbeddingResponse(
        data=embeddings,
        model=request.model
    )

@app.get("/v1/models")
async def list_models():
    """List available models"""
    return {
        "object": "list",
        "data": [
            {
                "id": "embedding-gemma",
                "object": "model",
                "owned_by": "local"
            }
        ]
    }

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("Starting local embedding server on port 8088...")
    uvicorn.run(app, host="0.0.0.0", port=8088)
