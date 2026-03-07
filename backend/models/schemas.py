from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-3.5-turbo"
