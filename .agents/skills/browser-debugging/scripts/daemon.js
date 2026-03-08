import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_PATH = path.join(__dirname, 'current_view.png');

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let context = null;
let page = null;
let interactableElements = []; // Store the latest Set-of-Mark elements mapping

// 智能等待助手：结合短暂的网络闲置监听与硬等待，避免因为长连接导致 networkidle 永远不触发
async function smartWait(page) {
    try {
        await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => { });
    } catch (e) { }
    await page.waitForTimeout(500); // 给予框架动画 (如 Tailwind transitions) 一定的视觉缓冲时间
}

app.post('/start', async (req, res) => {
    try {
        if (browser) {
            return res.json({ status: "ok", message: "Browser already running" });
        }
        console.log("🚀 Starting Playwright Daemon...");
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/121.0.0.0 Safari/537.36',
            recordVideo: {
                dir: path.join(__dirname, 'videos'),
                size: { width: 1280, height: 800 }
            }
        });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        page = await context.newPage();

        // Expose a function to collect logs if needed
        page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));

        res.json({ status: "ok", message: "Browser started successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/goto', async (req, res) => {
    try {
        const { url } = req.body;
        if (!page) throw new Error("Browser not started. Call /start first.");
        console.log(`🌐 Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        res.json({ status: "ok", message: `Navigated to ${url}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/observe', async (req, res) => {
    try {
        if (!page) throw new Error("Browser not started.");

        console.log(`👁️ Injecting Set-of-Mark (SoM) indicators...`);
        interactableElements = await page.evaluate(() => {
            // Remove old overlays if any
            document.querySelectorAll('.agent-som-overlay').forEach(e => e.remove());

            let idCounter = 1;
            const elements = [];
            const interactiveSelectors = 'a, button, input, textarea, select, details, [role="button"], [role="link"], [role="menuitem"], [onclick]';

            document.querySelectorAll(interactiveSelectors).forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                // Only consider visible elements
                if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0') {
                    const id = idCounter++;
                    elements.push({
                        id,
                        tag: el.tagName.toLowerCase(),
                        text: el.innerText ? el.innerText.trim().slice(0, 40) : (el.placeholder || el.value || ''),
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2
                    });

                    // Draw overlay
                    const overlay = document.createElement('div');
                    overlay.className = 'agent-som-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.top = Math.max(0, rect.top - 10) + 'px';
                    overlay.style.left = Math.max(0, rect.left - 10) + 'px';
                    overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                    overlay.style.color = 'white';
                    overlay.style.fontSize = '12px';
                    overlay.style.fontWeight = 'bold';
                    overlay.style.padding = '2px 4px';
                    overlay.style.borderRadius = '4px';
                    overlay.style.border = '1px solid white';
                    overlay.style.zIndex = '2147483647'; // Max z-index
                    overlay.style.pointerEvents = 'none';
                    overlay.innerText = id;
                    document.body.appendChild(overlay);
                }
            });
            return elements;
        });

        // Take screenshot with markers
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

        // Remove overlays so they don't interfere with actual UI
        await page.evaluate(() => {
            document.querySelectorAll('.agent-som-overlay').forEach(e => e.remove());
        });

        console.log(`📸 Screenshot with ${interactableElements.length} markers saved to ${SCREENSHOT_PATH}`);
        res.json({
            status: "ok",
            elements: interactableElements,
            screenshot_path: SCREENSHOT_PATH,
            message: `Observed ${interactableElements.length} interactive elements.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/click', async (req, res) => {
    try {
        const { id } = req.body;
        if (!page) throw new Error("Browser not started.");

        const target = interactableElements.find(e => e.id === parseInt(id));
        if (!target) throw new Error(`Element with ID ${id} not found in last observation.`);

        console.log(`🖱️ Clicking element ID ${id} at (${target.x}, ${target.y}) [${target.tag}]`);
        // Use coordinates to click, completely bypassing CSS selectors!
        await page.mouse.click(target.x, target.y);
        await smartWait(page); // 智能等待页面响应


        res.json({ status: "ok", message: `Clicked element ${id}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/type', async (req, res) => {
    try {
        const { id, text } = req.body;
        if (!page) throw new Error("Browser not started.");

        const target = interactableElements.find(e => e.id === parseInt(id));
        if (!target) throw new Error(`Element with ID ${id} not found in last observation.`);

        console.log(`⌨️ Typing into element ID ${id} at (${target.x}, ${target.y}): "${text}"`);
        // Click to focus, then use keyboard
        await page.mouse.click(target.x, target.y);
        await page.keyboard.press('Meta+A'); // Select all (Mac)
        await page.keyboard.press('Backspace'); // Delete
        await page.waitForTimeout(100);
        await page.keyboard.type(text);
        await smartWait(page); // 智能等待


        res.json({ status: "ok", message: `Typed text into element ${id}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/hover', async (req, res) => {
    try {
        const { id } = req.body;
        if (!page) throw new Error("Browser not started.");

        const target = interactableElements.find(e => e.id === parseInt(id));
        if (!target) throw new Error(`Element with ID ${id} not found in last observation.`);

        console.log(`✨ Hovering element ID ${id} at (${target.x}, ${target.y})`);
        await page.mouse.move(target.x, target.y);
        await smartWait(page);

        res.json({ status: "ok", message: `Hovered over element ${id}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/scroll', async (req, res) => {
    try {
        const { direction } = req.body; // 'up', 'down', 'top', 'bottom'
        if (!page) throw new Error("Browser not started.");

        console.log(`📜 Scrolling ${direction}...`);
        await page.evaluate((dir) => {
            const h = window.innerHeight;
            if (dir === 'down') window.scrollBy({ top: h * 0.8, left: 0, behavior: 'smooth' });
            else if (dir === 'up') window.scrollBy({ top: -h * 0.8, left: 0, behavior: 'smooth' });
            else if (dir === 'top') window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            else if (dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, left: 0, behavior: 'smooth' });
        }, direction);

        await smartWait(page);
        res.json({ status: "ok", message: `Scrolled ${direction}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/keypress', async (req, res) => {
    try {
        const { key } = req.body;
        if (!page) throw new Error("Browser not started.");

        console.log(`🎯 Pressing key: ${key}`);
        await page.keyboard.press(key);
        await smartWait(page);

        res.json({ status: "ok", message: `Pressed key ${key}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/stop', async (req, res) => {
    try {
        if (!browser) {
            return res.json({ status: "ok", message: "Browser not running" });
        }
        console.log(`🛑 Stopping browser daemon...`);
        const tracePath = path.join(__dirname, `trace_daemon_${Date.now()}.zip`);
        await context.tracing.stop({ path: tracePath });
        await browser.close();

        browser = null;
        context = null;
        page = null;
        interactableElements = [];

        res.json({ status: "ok", message: `Browser stopped. Trace saved to ${tracePath}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3005;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🤖 Browser Agent Daemon running on port ${PORT}`);
    console.log(`   - POST /start`);
    console.log(`   - POST /goto { "url": "..." }`);
    console.log(`   - GET  /observe`);
    console.log(`   - POST /click { "id": 1 }`);
    console.log(`   - POST /hover { "id": 1 }`);
    console.log(`   - POST /type { "id": 1, "text": "..." }`);
    console.log(`   - POST /keypress { "key": "Enter" }`);
    console.log(`   - POST /scroll { "direction": "down|up|top|bottom" }`);
    console.log(`   - POST /stop`);
    console.log(`=========================================`);
});
