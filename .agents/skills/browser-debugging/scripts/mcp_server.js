import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------------------------------------------
// 1. Playwright 浏览器状态管理器
// -----------------------------------------------------------------
let browser = null;
let context = null;
let page = null;
let interactableElements = []; // { id, tag, text, x, y }

async function ensureBrowser() {
    if (!browser) {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/121.0.0.0",
            recordVideo: {
                dir: path.join(__dirname, "videos"),
                size: { width: 1280, height: 800 },
            },
        });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        page = await context.newPage();
    }
}

async function smartWait(page) {
    try {
        await page.waitForLoadState("networkidle", { timeout: 1500 }).catch(() => { });
    } catch (e) { }
    await page.waitForTimeout(500);
}

// -----------------------------------------------------------------
// 2. 初始化 MCP Server
// -----------------------------------------------------------------
const server = new Server(
    {
        name: "browser-automation-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// -----------------------------------------------------------------
// 3. 注册可用的 Tools (原生函数调用)
// -----------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "browser_goto",
                description: "Navigate the persistent browser to a specified URL.",
                inputSchema: {
                    type: "object",
                    properties: { url: { type: "string", description: "The full URL to navigate to" } },
                    required: ["url"],
                },
            },
            {
                name: "browser_observe",
                description: "Analyze the current page, inject Set-of-Mark visual indicators, take a screenshot, and return the interactive elements coordinate mapping. ALWAYS call this before clicking or typing to get the element IDs.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "browser_click",
                description: "Click an element on the page based on the ID returned by `browser_observe`.",
                inputSchema: {
                    type: "object",
                    properties: { id: { type: "number", description: "The ID of the Set-of-Mark element" } },
                    required: ["id"],
                },
            },
            {
                name: "browser_type",
                description: "Type text into an input element based on the ID returned by `browser_observe`.",
                inputSchema: {
                    type: "object",
                    properties: {
                        id: { type: "number", description: "The ID of the Input element" },
                        text: { type: "string", description: "The text to type" },
                    },
                    required: ["id", "text"],
                },
            },
            {
                name: "browser_scroll",
                description: "Scroll the page.",
                inputSchema: {
                    type: "object",
                    properties: { direction: { type: "string", enum: ["down", "up", "top", "bottom"] } },
                    required: ["direction"],
                },
            },
            {
                name: "browser_stop",
                description: "Stop the browser and save the debug trace recording (.zip). Use this when the testing task is complete.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

// -----------------------------------------------------------------
// 4. 处理客户端的 Tools 调用
// -----------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (request.params.name !== "browser_stop") {
            await ensureBrowser();
        }

        switch (request.params.name) {
            case "browser_goto": {
                const url = request.params.arguments.url;
                await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
                return { content: [{ type: "text", text: `Successfully navigated to ${url}` }] };
            }

            case "browser_observe": {
                interactableElements = await page.evaluate(() => {
                    document.querySelectorAll('.agent-som-overlay').forEach(e => e.remove());
                    let idCounter = 1;
                    const elements = [];
                    const interactiveSelectors = 'a, button, input, textarea, select, details, [role="button"], [role="link"], [role="menuitem"], [onclick]';

                    document.querySelectorAll(interactiveSelectors).forEach(el => {
                        const rect = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0') {
                            const id = idCounter++;
                            elements.push({
                                id, tag: el.tagName.toLowerCase(), text: el.innerText ? el.innerText.trim().slice(0, 40) : (el.placeholder || el.value || ''),
                                x: rect.x + rect.width / 2, y: rect.y + rect.height / 2
                            });
                            const overlay = document.createElement('div');
                            overlay.className = 'agent-som-overlay';
                            overlay.style = `position:fixed; top:${Math.max(0, rect.top - 10)}px; left:${Math.max(0, rect.left - 10)}px; background:rgba(255,0,0,0.8); color:white; font-size:12px; font-weight:bold; padding:2px 4px; border-radius:4px; border:1px solid white; z-index:2147483647; pointer-events:none;`;
                            overlay.innerText = id;
                            document.body.appendChild(overlay);
                        }
                    });
                    return elements;
                });

                const screenshotPath = path.join(__dirname, 'current_view.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });

                await page.evaluate(() => document.querySelectorAll('.agent-som-overlay').forEach(e => e.remove()));

                return {
                    content: [
                        { type: "text", text: `Observation complete. Check ${screenshotPath} for reference.` },
                        { type: "text", text: JSON.stringify(interactableElements, null, 2) }
                    ]
                };
            }

            case "browser_click": {
                const id = request.params.arguments.id;
                const target = interactableElements.find(e => e.id === id);
                if (!target) throw new Error(`Element ${id} not found in last observation.`);
                await page.mouse.click(target.x, target.y);
                await smartWait(page);
                return { content: [{ type: "text", text: `Successfully clicked element ${id} [${target.tag}]` }] };
            }

            case "browser_type": {
                const { id, text } = request.params.arguments;
                const target = interactableElements.find(e => e.id === id);
                if (!target) throw new Error(`Element ${id} not found.`);
                await page.mouse.click(target.x, target.y);
                await page.keyboard.press("Meta+A");
                await page.keyboard.press("Backspace");
                await page.keyboard.type(text);
                await smartWait(page);
                return { content: [{ type: "text", text: `Successfully typed "${text}" into element ${id}` }] };
            }

            case "browser_scroll": {
                const dir = request.params.arguments.direction;
                await page.evaluate((d) => {
                    const h = window.innerHeight;
                    if (d === 'down') window.scrollBy({ top: h * 0.8, behavior: 'smooth' });
                    else if (d === 'up') window.scrollBy({ top: -h * 0.8, behavior: 'smooth' });
                    else if (d === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
                    else if (d === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }, dir);
                await smartWait(page);
                return { content: [{ type: "text", text: `Scrolled ${dir}` }] };
            }

            case "browser_stop": {
                if (!browser) return { content: [{ type: "text", text: "Browser already stopped." }] };
                const tracePath = path.join(__dirname, `trace_mcp_${Date.now()}.zip`);
                await context.tracing.stop({ path: tracePath });
                await browser.close();
                browser = null; context = null; page = null; interactableElements = [];
                return { content: [{ type: "text", text: `Browser stopped. Trace recording saved to ${tracePath}` }] };
            }

            default:
                throw new Error(`Unknown tool: ${request.params.name}`);
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

// -----------------------------------------------------------------
// 5. 启动 MCP Server 管道
// -----------------------------------------------------------------
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Browser Automation MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
