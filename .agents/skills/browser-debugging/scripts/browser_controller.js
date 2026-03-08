import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 截屏保存路径
const SCREENSHOT_PATH = path.join(__dirname, 'current_view.png');

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("用法: node browser_controller.js <action> <url> [args...]");
        console.error("支持的 action: goto, click, type, get_dom");
        process.exit(1);
    }

    const action = args[0];
    const targetUrl = args[1];
    const payload = args[2] || '';

    // 启动浏览器
    console.log(`🚀 启动 Chromium 浏览器...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/121.0.0.0 Safari/537.36',
        recordVideo: {
            dir: path.join(__dirname, 'videos'),
            size: { width: 1280, height: 800 }
        }
    });

    // 开启详细动作追踪
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();

    try {
        console.log(`🌐 正在访问 ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 10000 }).catch(e => console.log(`网页加载超时或遇到错误: ${e.message}`));

        // 如果执行的是除 goto 外的交互动作，可能需要等待元素
        if (action === 'click') {
            console.log(`🖱️ 尝试点击: ${payload}`);
            const selector = payload;
            await page.waitForSelector(selector, { timeout: 5000 });
            await page.click(selector);
            // 等待后续可能的网络请求完成
            await page.waitForTimeout(2000);
        } else if (action === 'type') {
            // payload format: "selector|text"
            const parts = payload.split('|');
            if (parts.length < 2) throw new Error("输入格式错误，应为: '选择器|要输入的文本'");
            const selector = parts[0];
            const textToType = parts.slice(1).join('|');
            console.log(`⌨️ 尝试在 [${selector}] 中输入: ${textToType}`);
            await page.waitForSelector(selector, { timeout: 5000 });
            await page.fill(selector, textToType);
            await page.waitForTimeout(1000);
        } else if (action === 'get_dom') {
            console.log(`📄 提取交互式 DOM 树...`);
            // 在页面内执行 JS，提取简化的交互 DOM
            const simplifiedDom = await page.evaluate(() => {
                function getCleanDom(el) {
                    if (el.nodeType === Node.TEXT_NODE) {
                        return el.textContent.trim() ? el.textContent.trim() : null;
                    }
                    if (el.nodeType !== Node.ELEMENT_NODE) return null;

                    const tag = el.tagName.toLowerCase();
                    // 仅关注有语义的标签或带有特定类的元素
                    if (['script', 'style', 'svg', 'path', 'Meta', 'head', 'link', 'noscript'].includes(tag)) return null;

                    const obj = { tag };
                    if (el.id) obj.id = el.id;
                    if (el.className && typeof el.className === 'string') obj.class = el.className;
                    if (el.placeholder) obj.placeholder = el.placeholder;
                    if (el.href) obj.href = el.href;

                    const children = Array.from(el.childNodes)
                        .map(getCleanDom)
                        .filter(c => c !== null);

                    if (children.length > 0) obj.children = children;

                    return obj;
                }
                return JSON.stringify(getCleanDom(document.body), null, 2);
            });
            console.log("【简化的 DOM 结构】:");
            console.log(simplifiedDom);
            // 提早退出，get_dom 本身不需要截图
            await browser.close();
            return;
        }

        // 操作完成后统一截图
        console.log(`📸 保存截图至: ${SCREENSHOT_PATH}`);
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
        console.log(`✅ ${action.toUpperCase()} 操作执行成功！请多模态模型查看 scripts/current_view.png`);

    } catch (error) {
        console.error(`❌ 操作失败: ${error.message}`);
    } finally {
        if (browser.isConnected()) {
            // 保存高级调试 Trace
            const tracePath = path.join(__dirname, `trace_${action}_${Date.now()}.zip`);
            console.log(`📦 保存交互流迹文件 (Trace) 至: ${tracePath}`);
            await context.tracing.stop({ path: tracePath });
            await browser.close();
        }
    }
}

main().catch(console.error);
