const helmet = require('helmet');
const cors = require('cors');
const express = require('express');

const authenticate = (req, res, next) => {
    next();
};

const setupMiddleware = (app) => {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'"],
                "upgrade-insecure-requests": null, // STOP forcing HTTP to HTTPS
            },
        },
        crossOriginOpenerPolicy: false,
        strictTransportSecurity: false, // DISABLE HSTS (Strict-Transport-Security)
    }));
    app.use(cors());
    app.use(express.json());
};

module.exports = { authenticate, setupMiddleware };
