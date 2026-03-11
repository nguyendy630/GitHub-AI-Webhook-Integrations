require("dotenv").config();
const express = require("express");
const { Webhooks } = require("@octokit/webhooks");
const logger = require("./utils/logger");
const webhookHandler = require("./webhooks/handler");

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub Webhooks
const webhooks = new Webhooks({
    secret: process.env.GITHUB_WEBHOOK_SECRET,
});

// Middleware to parse JSON
app.use(express.json());

// Health Check Endpoint.
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "Healthy",
        timestamp: new Date().toISOString(),
    });
});

// Github Webhooks Health Check
app.get("/api/webhooks", (req, res) => {
    res.status(200).json({ message: "GitHub Webhooks endpoint is live" });
});

// Stats Endpoint
app.get("/stats", (req, res) => {
    res.json({ message: "Stats Endpoint not implemented yet!" });
});

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

// Required for Vercel Deployment
module.exports = app;
