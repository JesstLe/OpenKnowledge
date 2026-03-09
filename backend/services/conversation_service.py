"""
对话服务 - 实现无限轮对话的高级方案
包含：持久化存储、智能摘要、动态 Token 裁剪
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime
import uuid
import tiktoken

from models.database import Conversation, Message
from services.llm_service import llm_service

# Token 限制配置
MAX_CONTEXT_TOKENS = 120000  # 留给上下文的最大 token 数（预留空间给响应）
MAX_MESSAGES_BEFORE_SUMMARY = 20  # 超过此消息数开始摘要
SUMMARY_TRIGGER_THRESHOLD = 100000  # 触发摘要的 token 阈值


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """计算文本的 token 数量"""
    try:
        # 使用 tiktoken 计算 token
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except:
        # 回退：粗略估算 (1 token ≈ 4 字符)
        return len(text) // 4


def count_messages_tokens(messages: List[Dict[str, str]], model: str = "gpt-4o-mini") -> int:
    """计算消息列表的总 token 数"""
    total = 0
    for msg in messages:
        total += count_tokens(msg.get("content", ""), model)
        # 每条消息的额外开销
        total += 4
    return total


class ConversationService:
    """对话服务类"""

    async def create_conversation(
        self,
        session: AsyncSession,
        title: Optional[str] = None,
        model: str = "gpt-4o-mini"
    ) -> Conversation:
        """创建新对话"""
        conversation = Conversation(
            id=uuid.uuid4(),
            title=title or "新对话",
            model=model,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            message_count=0,
            total_tokens=0,
            is_active=1
        )
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
        return conversation

    async def get_conversation(
        self,
        session: AsyncSession,
        conversation_id: str
    ) -> Optional[Conversation]:
        """获取对话"""
        result = await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.is_active == 1
            )
        )
        return result.scalar_one_or_none()

    async def get_conversation_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        limit: int = 1000
    ) -> List[Message]:
        """获取对话的消息列表"""
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_recent_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        limit: int = 10
    ) -> List[Message]:
        """获取最近的消息（用于记忆提取）"""
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        # 返回正序排列的消息
        messages = result.scalars().all()
        return list(reversed(messages))

    async def add_message(
        self,
        session: AsyncSession,
        conversation_id: str,
        role: str,
        content: str,
        model: str = "gpt-4o-mini"
    ) -> Message:
        """添加消息到对话"""
        # 计算 token
        tokens = count_tokens(content, model)

        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.UUID(conversation_id) if isinstance(conversation_id, str) else conversation_id,
            role=role,
            content=content,
            tokens=tokens,
            is_summarized=0,
            created_at=datetime.utcnow()
        )
        session.add(message)

        # 更新对话统计
        conversation = await self.get_conversation(session, str(conversation_id))
        if conversation:
            conversation.message_count += 1
            conversation.total_tokens += tokens
            conversation.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(message)
        return message

    async def generate_summary(
        self,
        session: AsyncSession,
        conversation_id: str,
        api_key: str
    ) -> str:
        """
        生成对话摘要 - 将早期对话压缩为摘要
        """
        # 获取早期的消息（前50%）
        messages = await self.get_conversation_messages(session, conversation_id)
        if len(messages) < 10:
            return ""  # 消息太少不需要摘要

        # 取前半部分进行摘要
        messages_to_summarize = messages[:len(messages)//2]

        # 构建摘要提示
        conversation_text = "\n".join([
            f"{msg.role}: {msg.content[:500]}"  # 限制每条消息长度
            for msg in messages_to_summarize
        ])

        summary_prompt = f"""请对以下对话进行摘要，保留关键信息和上下文：

{conversation_text}

请用简洁的语言总结上述对话的核心内容，包括：
1. 讨论的主要话题
2. 已达成的共识或结论
3. 待解决的问题

摘要："""

        # 调用 LLM 生成摘要
        summary_chunks = []
        async for chunk in llm_service.stream_chat(
            message=summary_prompt,
            api_key=api_key,
            model="gpt-4o-mini",  # 使用轻量模型生成摘要
            use_rag=False,
            use_memory=False
        ):
            summary_chunks.append(chunk)

        summary = "".join(summary_chunks)

        # 更新对话摘要
        conversation = await self.get_conversation(session, conversation_id)
        if conversation:
            conversation.summary = summary
            conversation.summary_tokens = count_tokens(summary)

            # 标记已摘要的消息
            for msg in messages_to_summarize:
                msg.is_summarized = 1

            await session.commit()

        return summary

    async def get_optimized_context(
        self,
        session: AsyncSession,
        conversation_id: str,
        current_model: str = "gpt-4o-mini",
        max_tokens: int = MAX_CONTEXT_TOKENS
    ) -> List[Dict[str, str]]:
        """
        获取优化的上下文 - 智能选择消息和摘要
        策略：
        1. 优先保留最近的消息
        2. 早期消息用摘要替代
        3. 如果仍超限制，裁剪中间部分
        """
        conversation = await self.get_conversation(session, conversation_id)
        if not conversation:
            return []

        messages = await self.get_conversation_messages(session, conversation_id)
        if not messages:
            return []

        result = []
        total_tokens = 0

        # 策略1：如果有摘要，先添加为系统消息
        if conversation.summary:
            summary_msg = {
                "role": "system",
                "content": f"[对话历史摘要] {conversation.summary}"
            }
            summary_tokens = count_tokens(summary_msg["content"], current_model)
            if total_tokens + summary_tokens < max_tokens:
                result.append(summary_msg)
                total_tokens += summary_tokens

        # 策略2：添加最近的消息（倒序添加，直到 token 限制）
        recent_messages = []
        for msg in reversed(messages):
            if msg.is_summarized:
                continue  # 跳过已摘要的消息

            msg_dict = {"role": msg.role, "content": msg.content}
            msg_tokens = count_tokens(msg.content, current_model) + 4

            if total_tokens + msg_tokens > max_tokens:
                break  # 超出限制，停止添加

            recent_messages.insert(0, msg_dict)  # 插入到开头保持顺序
            total_tokens += msg_tokens

        result.extend(recent_messages)

        return result

    async def should_generate_summary(
        self,
        session: AsyncSession,
        conversation_id: str
    ) -> bool:
        """判断是否需要生成摘要"""
        conversation = await self.get_conversation(session, conversation_id)
        if not conversation:
            return False

        # 条件1：消息数超过阈值
        if conversation.message_count >= MAX_MESSAGES_BEFORE_SUMMARY:
            # 检查是否已有摘要，或距离上次摘要已有一段时间
            if not conversation.summary:
                return True

        # 条件2：token 数超过阈值
        if conversation.total_tokens >= SUMMARY_TRIGGER_THRESHOLD:
            return True

        return False

    async def list_conversations(
        self,
        session: AsyncSession,
        limit: int = 20,
        offset: int = 0
    ) -> List[Conversation]:
        """列出用户的对话历史"""
        result = await session.execute(
            select(Conversation)
            .where(Conversation.is_active == 1)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def delete_conversation(
        self,
        session: AsyncSession,
        conversation_id: str
    ) -> bool:
        """软删除对话"""
        conversation = await self.get_conversation(session, conversation_id)
        if conversation:
            conversation.is_active = 0
            await session.commit()
            return True
        return False

    async def update_conversation_title(
        self,
        session: AsyncSession,
        conversation_id: str,
        title: str
    ) -> bool:
        """更新对话标题"""
        conversation = await self.get_conversation(session, conversation_id)
        if conversation:
            conversation.title = title
            await session.commit()
            return True
        return False


# 全局服务实例
conversation_service = ConversationService()
