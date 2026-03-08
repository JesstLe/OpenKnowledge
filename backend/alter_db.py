import asyncio
from sqlalchemy import text
import sys
import os

# Ensure we can import from core
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from core.database import engine

async def alter_schema():
    async with engine.begin() as conn:
        print("Altering document_chunks...")
        await conn.execute(text("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector"))
        print("Altering memories...")
        try:
            await conn.execute(text("ALTER TABLE memories ALTER COLUMN embedding TYPE vector"))
        except Exception as e:
            print("Memories table might not exist yet:", e)
        print("Done!")

if __name__ == "__main__":
    asyncio.run(alter_schema())
