const express = require('express');
const morgan = require('morgan');
const { setupMiddleware } = require('./middleware');
const browserService = require('./services/browser.service');

const app = express();

const path = require('path');

setupMiddleware(app);
app.use(morgan('combined'));

// Serve UI
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/v1/internal/query', async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameter: id'
        });
    }

    try {
        const result = await browserService.fetchPlayerData(id);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                player_id: id,
                display_name: result
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal service failure',
            reference: Date.now().toString(36)
        });
    }
});

app.get('/check-player', async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameter: id'
        });
    }

    try {
        const result = await browserService.fetchPlayerData(id);
        res.json({
            success: true,
            player_name: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Detection failed'
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'up', uptime: process.uptime() });
});

module.exports = app;
