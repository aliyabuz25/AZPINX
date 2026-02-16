const app = require('./app');
const browserService = require('./services/browser.service');

const PORT = process.env.PORT || 3000;

(async () => {
    // Start listening immediately so the port is bound
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`[SERVER] Interface operational on http://0.0.0.0:${PORT}`);
        console.log(`[SERVER] Initializing background services...`);
    });

    try {
        // Initialize browser service in background
        await browserService.init();
        console.log(`[SERVER] Browser service is ready.`);
    } catch (error) {
        console.error('[ERROR] Initial browser sync failed:', error.message);
        console.log('[SYSTEM] Service will retry connection on first request.');
    }
})();

process.on('SIGTERM', async () => {
    console.log('[SYSTEM] SIGTERM received. Shutting down...');
    if (browserService.browser) {
        await browserService.browser.close();
    }
    process.exit(0);
});
