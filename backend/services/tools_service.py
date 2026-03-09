"""
Agent Tool Service - Provides tools for LLM agent to use
Includes: Web search, calculator, datetime, etc.
"""

import json
import re
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime
from urllib.parse import quote_plus
import asyncio


class Tool:
    """Tool definition"""

    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        func: Callable[..., Any]
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func

    def to_dict(self) -> Dict[str, Any]:
        """Convert to OpenAI function calling format"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }


class ToolsService:
    """Service to manage and execute tools"""

    def __init__(self):
        self.tools: Dict[str, Tool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        """Register default tools"""
        self.register_tool(
            name="get_current_datetime",
            description="Get the current date and time",
            parameters={
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "Timezone (e.g., 'UTC', 'Asia/Shanghai'). Defaults to local time."
                    }
                },
                "required": []
            },
            func=self._get_current_datetime
        )

        self.register_tool(
            name="calculator",
            description="Perform mathematical calculations",
            parameters={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression to evaluate (e.g., '2 + 2', 'sin(30)', 'sqrt(16)')"
                    }
                },
                "required": ["expression"]
            },
            func=self._calculator
        )

        self.register_tool(
            name="web_search",
            description="Search the web for information",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (1-10)",
                        "default": 5
                    }
                },
                "required": ["query"]
            },
            func=self._web_search
        )

    def register_tool(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        func: Callable[..., Any]
    ):
        """Register a new tool"""
        self.tools[name] = Tool(name, description, parameters, func)

    def get_tools(self) -> List[Dict[str, Any]]:
        """Get all tools in OpenAI format"""
        return [tool.to_dict() for tool in self.tools.values()]

    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a specific tool"""
        return self.tools.get(name)

    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> str:
        """Execute a tool with given arguments"""
        tool = self.tools.get(name)
        if not tool:
            return f"Error: Tool '{name}' not found"

        try:
            result = await tool.func(**arguments) if asyncio.iscoroutinefunction(tool.func) else tool.func(**arguments)
            return json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else str(result)
        except Exception as e:
            return f"Error executing tool '{name}': {str(e)}"

    # Tool implementations
    def _get_current_datetime(self, timezone: str = None) -> Dict[str, Any]:
        """Get current datetime"""
        now = datetime.now()
        return {
            "datetime": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timezone": timezone or "local"
        }

    def _calculator(self, expression: str) -> Dict[str, Any]:
        """Safe calculator - only allows basic math operations"""
        # Whitelist of allowed characters
        allowed_pattern = r'^[\d\+\-\*\/\(\)\.\s\^sinocstalgrpeq]+$'
        if not re.match(allowed_pattern, expression.lower()):
            return {"error": "Invalid characters in expression"}

        try:
            # Replace ^ with ** for power
            expr = expression.replace('^', '**')

            # Basic math functions
            safe_dict = {
                'sqrt': lambda x: x ** 0.5,
                'sin': lambda x: __import__('math').sin(x),
                'cos': lambda x: __import__('math').cos(x),
                'tan': lambda x: __import__('math').tan(x),
                'log': lambda x: __import__('math').log(x),
                'log10': lambda x: __import__('math').log10(x),
                'exp': lambda x: __import__('math').exp(x),
                'abs': abs,
                'round': round,
                'pi': __import__('math').pi,
                'e': __import__('math').e,
            }

            result = eval(expr, {"__builtins__": {}}, safe_dict)
            return {
                "expression": expression,
                "result": result
            }
        except Exception as e:
            return {"error": f"Calculation error: {str(e)}"}

    async def _web_search(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Web search using DuckDuckGo"""
        try:
            # Use DuckDuckGo HTML search (no API key required)
            import aiohttp

            search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    search_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0"
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        html = await response.text()

                        # Parse results
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(html, 'html.parser')
                        results = []

                        for result in soup.find_all('div', class_='result')[:num_results]:
                            title_elem = result.find('a', class_='result__a')
                            snippet_elem = result.find('a', class_='result__snippet')

                            if title_elem and snippet_elem:
                                results.append({
                                    "title": title_elem.get_text(strip=True),
                                    "url": title_elem.get('href', ''),
                                    "snippet": snippet_elem.get_text(strip=True)
                                })

                        return {
                            "query": query,
                            "results": results
                        }
                    else:
                        return {"error": f"Search failed with status {response.status}"}

        except ImportError:
            return {"error": "Web search requires 'aiohttp' and 'beautifulsoup4' packages"}
        except Exception as e:
            return {"error": f"Search error: {str(e)}"}


# Global instance
tools_service = ToolsService()
