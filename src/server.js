require("dotenv").config();
const express = require("express");
const { Webhooks } = require("@octokit/webhooks");
const logger = require("src/utils/logger.js");

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub Webhooks
const webhooks = new Webhooks({
    secret: process.env.GH_WEBHOOK,
});

// Middleware to parse JSON
app.use(express.json());

// Error Handling middleware.
app.use((err, req, res, next) => {
    logger.error("Unhandled error", { error: err.message });
    res.status(500).json({ message: "Someting Went Wrong!" });
});

// Graceful shutdown.
process.on("SIGINT", () => {
    logger.info("Shutting down server");
    process.exit();
});

/**
 * LOCAL DEVELOPMENT ONLY.
 */
if (process.env.NODE_ENV !== "production") {
    const port = process.env.PORT || 3000;
    app.listen(port, () => logger.info(`Running on port ${port}`));
}

const cookieParser = require('cookie-parser');
 
// Auth routes
const authGithub   = require('./api/auth/github');
const authCallback = require('./api/auth/callback');
const authLogout   = require('./api/auth/logout');
const me           = require('./api/me');
 
// ─────────────────────────────────────────
// Wire up middleware (add after express init)
 
app.use(cookieParser(process.env.SESSION_SECRET)); // signed cookie support
 
// ─────────────────────────────────────────
// Wire up routes (add with your other routes)
 
app.get('/api/auth/github',   authGithub);
app.get('/api/auth/callback', authCallback);
app.get('/api/auth/logout',   authLogout);
app.get('/api/me',            me);

// Required for Vercel Deployment
module.exports = app;
