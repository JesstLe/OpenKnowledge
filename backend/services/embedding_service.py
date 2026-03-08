import litellm
from typing import List, Optional

class EmbeddingService:
    # Provider base URLs for generic OpenAI clients
    PROVIDER_BASE_URLS = {
        "openai": "https://api.openai.com/v1",
        "alibaba": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "zhipu": "https://open.bigmodel.cn/api/paas/v4",
        "moonshot": "https://api.moonshot.cn/v1",
    }

    # Provider mapping to original model names
    PROVIDER_MODELS = {
        "openai": "text-embedding-3-small",
        "alibaba": "text-embedding-v3",
        "zhipu": "embedding-3",
        "moonshot": "moonshot-embedding",
    }

    # Local Ollama settings
    OLLAMA_BASE_URL = "http://localhost:11434"
    OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"

    async def get_embeddings(
        self,
        texts: List[str],
        api_key: str,
        provider: str = "openai",
        base_url: Optional[str] = None,
        use_local: bool = False
    ) -> List[List[float]]:
        """Get embeddings for a list of texts using direct clients (bypassing litellm)"""

        # Use local Ollama if requested
        if use_local:
            return await self._get_ollama_embeddings(
                texts, self.OLLAMA_BASE_URL, self.OLLAMA_EMBEDDING_MODEL
            )

        url = base_url if base_url else self.PROVIDER_BASE_URLS.get(provider)
        model = self.PROVIDER_MODELS.get(provider, "text-embedding-3-small")

        if provider == "zhipu":
            # Zhipu requires its native SDK due to JWT auth
            import asyncio
            from zhipuai import ZhipuAI
            
            # Explicitly strip and cast api_key just in case it retains headers or proxy prefixes
            clean_api_key = str(api_key).strip()
            # If the user put 'Bearer ' via some proxy logic, strip it
            if clean_api_key.lower().startswith("bearer "):
                clean_api_key = clean_api_key[7:].strip()
                
            if not base_url or "bigmodel.cn" in base_url:
                # Real Zhipu API
                client = ZhipuAI(api_key=clean_api_key)
                resp = await asyncio.to_thread(
                    client.embeddings.create,
                    model="embedding-3", # hardcoded fallback explicitly
                    input=texts
                )
                return [item.embedding for item in resp.data]
            else:
                # Local Proxy (e.g. OneAPI / OpenCode which handles the dummy key)
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=api_key, base_url=base_url)
                resp = await client.embeddings.create(model="embedding-3", input=texts)
                return [item.embedding for item in resp.data]
        else:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key, base_url=url)
            resp = await client.embeddings.create(model=model, input=texts)
            return [item.embedding for item in resp.data]

    async def get_single_embedding(
        self,
        text: str,
        api_key: str,
        provider: str = "openai",
        base_url: Optional[str] = None
    ) -> List[float]:
        """Get embedding for a single text"""
        embeddings = await self.get_embeddings([text], api_key, provider, base_url)
        return embeddings[0]

    async def _get_ollama_embeddings(
        self,
        texts: List[str],
        base_url: str,
        model: str = "nomic-embed-text"
    ) -> List[List[float]]:
        """Get embeddings from Ollama API"""
        import aiohttp

        # Normalize base URL
        if base_url.endswith('/v1'):
            api_url = base_url.replace('/v1', '/api/embeddings')
        else:
            api_url = f"{base_url.rstrip('/')}/api/embeddings"

        embeddings = []
        async with aiohttp.ClientSession() as session:
            for text in texts:
                async with session.post(
                    api_url,
                    json={"model": model, "prompt": text}
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        embeddings.append(data['embedding'])
                    else:
                        error_text = await resp.text()
                        raise Exception(f"Ollama embedding error: {error_text}")

        return embeddings

embedding_service = EmbeddingService()
