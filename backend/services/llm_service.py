from importlib import import_module
from typing import AsyncIterable, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import SecretStr

from services.rag_service import rag_service
from services.memory_service import memory_service

litellm = import_module("litellm")
acompletion = getattr(litellm, "acompletion")


def _to_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
                continue
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


# LiteLLM model mapping for different providers
MODEL_MAPPINGS = {
    "gpt-5.4": "gpt-5.4",
    "gpt-5.4-pro": "gpt-5.4-pro",
    "gpt-5-mini": "gpt-5-mini",
    "gpt-5-nano": "gpt-5-nano",
    "gpt-4.1": "gpt-4.1",
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4-turbo",
    "gpt-3.5-turbo": "gpt-3.5-turbo",
    "o1": "o1",
    "o1-mini": "o1-mini",
    "o3-mini": "o3-mini",
    "claude-opus-4-6": "anthropic/claude-opus-4-6",
    "claude-sonnet-4-6": "anthropic/claude-sonnet-4-6",
    "claude-haiku-4-5": "anthropic/claude-haiku-4-5",
    "claude-3-5-sonnet-20241022": "anthropic/claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229": "anthropic/claude-3-opus-20240229",
    "claude-3-haiku-20240307": "anthropic/claude-3-haiku-20240307",
    "gemini-3.1-pro-preview": "gemini/gemini-3.1-pro-preview",
    "gemini-3-flash-preview": "gemini/gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview": "gemini/gemini-3.1-flash-lite-preview",
    "gemini-2.0-flash-exp": "gemini/gemini-2.0-flash-exp",
    "gemini-1.5-pro": "gemini/gemini-1.5-pro",
    "gemini-1.5-flash": "gemini/gemini-1.5-flash",
    # DeepSeek
    "deepseek-chat": "deepseek/deepseek-chat",
    "deepseek-reasoner": "deepseek/deepseek-reasoner",
    # Alibaba
    "qwen3-max": "openai/qwen3-max",
    "qwen3.5-plus": "openai/qwen3.5-plus",
    "qwen-plus-latest": "openai/qwen-plus-latest",
    "qwen-max": "openai/qwen-max",
    "qwen-plus": "openai/qwen-plus",
    "qwen-flash": "openai/qwen-flash",
    "qwen-turbo": "openai/qwen-turbo",
    "qwen-coder-plus": "openai/qwen-coder-plus",
    "qwen3-coder-plus": "openai/qwen3-coder-plus",
    # Zhipu
    "glm-5": "openai/glm-5",
    "glm-4.7": "openai/glm-4.7",
    "glm-4.7-flash": "openai/glm-4.7-flash",
    # Moonshot
    "kimi-k2.5": "openai/kimi-k2.5",
    "kimi-k2-turbo-preview": "openai/kimi-k2-turbo-preview",
    "kimi-k2-thinking": "openai/kimi-k2-thinking",
    "kimi-latest": "openai/kimi-latest",
    "moonshot-v1-8k": "openai/moonshot-v1-8k",
    "moonshot-v1-32k": "openai/moonshot-v1-32k",
    "moonshot-v1-128k": "openai/moonshot-v1-128k",
    # Cohere
    "command-r": "cohere/command-r",
    "command-r-plus": "cohere/command-r-plus",
    # Mistral
    "mistral-large-latest": "mistral/mistral-large-latest",
    "mistral-medium": "mistral/mistral-medium",
    "mistral-small": "mistral/mistral-small",
}

# Provider base URLs (for OpenAI compatible APIs)
PROVIDER_BASE_URLS = {
    "alibaba": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "moonshot": "https://api.moonshot.cn/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
}


def get_provider_from_model(model: str) -> str:
    """Determine provider from model ID."""
    # Must match provider-specific OpenAI-compatible prefixes first; otherwise
    # generic `openai/` detection would route Kimi/Qwen to the wrong endpoint.
    if (
        model.startswith("openai/kimi")
        or model.startswith("moonshot-")
        or model.startswith("kimi-")
    ):
        return "moonshot"
    elif model.startswith("openai/qwen") or model.startswith("qwen"):
        return "alibaba"
    elif model.startswith("openai/"):
        return "openai"
    elif model.startswith("gpt-") or model.startswith("o1") or model.startswith("o3-"):
        return "openai"
    elif model.startswith("claude-") or model.startswith("anthropic/"):
        return "anthropic"
    elif model.startswith("gemini-") or model.startswith("gemini/"):
        return "google"
    elif model.startswith("deepseek-") or model.startswith("deepseek/"):
        return "deepseek"
    elif model.startswith("glm-") or model.startswith("zhipu/"):
        return "zhipu"
    elif model.startswith("command-") or model.startswith("cohere/"):
        return "cohere"
    elif model.startswith("mistral-") or model.startswith("mistral/"):
        return "mistral"
    return "openai"


class LLMService:
    async def stream_chat(
        self,
        message: str,
        api_key: str,
        model: str = "gpt-5-mini",
        use_rag: bool = False,
        use_memory: bool = False,
        base_url: Optional[str] = None,
        session: Optional[AsyncSession] = None,
        history: Optional[List[dict]] = None,
    ) -> AsyncIterable[str]:
        # Get the mapped model name for LiteLLM
        litellm_model = MODEL_MAPPINGS.get(model, model)

        # Determine provider and set up configuration
        provider = get_provider_from_model(model)

        # Build messages
        messages = []
        context_parts = []

        # Add memory context if enabled
        if use_memory and session:
            memory_context = await memory_service.get_memory_context(
                message, api_key, session, limit=5
            )
            if memory_context:
                context_parts.append(memory_context)

        # Add RAG context if enabled
        if use_rag and session:
            rag_context = await rag_service.get_context_for_query(
                message, api_key, session
            )
            if rag_context:
                context_parts.append("Relevant documents:\n" + rag_context)

        # Build system prompt with context
        if context_parts:
            system_content = "You are a helpful assistant.\n\n" + "\n\n".join(
                context_parts
            )
            system_content += "\n\nUse the above context to answer the user's question. If the context doesn't contain relevant information, say so."
            messages.append({"role": "system", "content": system_content})
        else:
            messages.append(
                {"role": "system", "content": "You are a helpful assistant."}
            )

        # Add conversation history if provided
        if history and len(history) > 0:
            for msg in history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

        messages.append({"role": "user", "content": message})

        setattr(litellm, "drop_params", True)
        setattr(litellm, "set_verbose", False)

        # Prepare API call kwargs
        kwargs: Dict[str, Any] = {
            "model": litellm_model,
            "messages": messages,
            "api_key": api_key,
            "stream": True,
            "temperature": 0.7,
        }

        # Add base_url for OpenAI compatible APIs
        if base_url:
            kwargs["api_base"] = base_url
        elif provider in PROVIDER_BASE_URLS:
            kwargs["api_base"] = PROVIDER_BASE_URLS[provider]



        try:
            response = await acompletion(**kwargs)

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta:
                    content = _to_text(chunk.choices[0].delta.content)
                    if content:
                        yield content
        except Exception as e:
            # Fallback to direct OpenAI for OpenAI models
            if provider == "openai":
                from langchain_openai import ChatOpenAI
                from langchain_core.messages import HumanMessage, SystemMessage

                llm = ChatOpenAI(
                    api_key=SecretStr(api_key),
                    model=model,
                    streaming=True,
                )

                lc_messages = []
                if context_parts:
                    system_content = "You are a helpful assistant.\n\n" + "\n\n".join(
                        context_parts
                    )
                    lc_messages.append(SystemMessage(content=system_content))
                lc_messages.append(HumanMessage(content=message))

                async for chunk in llm.astream(lc_messages):
                    content = _to_text(chunk.content)
                    if content:
                        yield content
            else:
                raise e


llm_service = LLMService()
