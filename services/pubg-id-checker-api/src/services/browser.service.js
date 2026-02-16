const puppeteer = require('puppeteer');
const { _0x4d2e } = require('../utils/obfuscator');

class BrowserService {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        if (this.browser) return;

        console.log('[SYSTEM] Initializing core engine (Extreme Performance Mode)...');
        this.browser = await puppeteer.launch({
            headless: true, // Use standard headless mode for better compatibility
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process', // Important for memory-constrained VPS
                '--hide-scrollbars',
                '--mute-audio'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 720 });

        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url().toLowerCase();

            if (['image', 'font', 'media', 'manifest', 'other'].includes(resourceType)) {
                return req.abort();
            }

            if (
                url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('facebook') ||
                url.includes('hotjar') ||
                url.includes('clarity') ||
                url.includes('cloudflareinsights') ||
                url.includes('doubleclick')
            ) {
                return req.abort();
            }

            if (resourceType === 'stylesheet') {
                return req.abort();
            }

            req.continue();
        });

        await this.login();
    }

    async login() {
        try {
            const _l = 'Ql5eWlkQBQVeS0JDWFlCRVoES1AFTUNYQ1k=';
            const _u = 'S0ZDU0tIX1AZGmpNR0tDRgRJRUc=';
            const _p = 'a0ZDU0tIX1AYGhob';

            const endpoint = process.env.LOGIN_URL || _0x4d2e(_l);
            const user = process.env.AUTH_EMAIL || _0x4d2e(_u);
            const pass = process.env.AUTH_PASS || _0x4d2e(_p);

            if (!endpoint || !user || !pass) {
                throw new Error('Critical service configuration missing.');
            }

            console.log(`[CORE] Establishing secure tunnel to auth layer...`);
            await this.page.goto(endpoint, { waitUntil: 'networkidle2' });

            await this.page.waitForSelector('#email');
            await this.page.type('#email', user);
            await this.page.type('#password', pass);

            await Promise.all([
                this.page.click('.btn-submit'),
                this.page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);

            console.log('[CORE] Authentication handshake verified.');
        } catch (err) {
            console.error('[CORE] Failed to initialize secure layer:', err.message);
            throw err;
        }
    }

    async fetchPlayerData(playerId) {
        if (!this.browser || !this.page) {
            console.log('[SYSTEM] Browser not initialized, attempting recovery...');
            await this.init();
        }

        try {
            const _t = 'Ql5eWlkQBQVeS0JDWFlCRVoES1AFWl9ITQdHRUhDRk8FQ04HQ0YHU19BRkc=';
            const target = process.env.TARGET_URL || _0x4d2e(_t);

            console.log(`[API] Processing query for resource ID: ${playerId}`);
            await this.page.goto(target, { waitUntil: 'networkidle2', timeout: 30000 });

            const btn = 'button.js-buy-now[data-product-id="409"]';
            await this.page.waitForSelector(btn);

            await this.page.evaluate((s) => {
                const b = document.querySelector(s);
                if (b) {
                    b.scrollIntoView({ block: 'center' });
                    b.click();
                }
            }, btn);

            const inp = '#qbNote1';
            await this.page.waitForSelector(inp, { visible: true });

            await this.page.click(inp, { clickCount: 3 });
            await this.page.keyboard.press('Backspace');
            await this.page.type(inp, playerId);
            await this.page.keyboard.press('Enter');

            const resSelector = '.ff-name';
            await this.page.waitForSelector(resSelector, { timeout: 15000 });

            const name = await this.page.waitForFunction(
                (s) => {
                    const e = document.querySelector(s);
                    return e && e.textContent.trim().length > 0 ? e.textContent.trim() : null;
                },
                { timeout: 10000 },
                resSelector
            );

            const result = await name.jsonValue();
            console.log(`[API] Data successfully retrieved for ID: ${playerId}. Result context: Validated.`);
            return result;
        } catch (error) {
            console.error('[API] Processing error:', error.message);
            if (error.message.includes('Session closed') || error.message.includes('Target closed')) {
                this.browser = null;
                await this.init();
            }
            throw error;
        }
    }
}

module.exports = new BrowserService();
