require("dotenv").config();
const express = require("express");
const { Webhooks } = require("@octokit/webhooks");
const logger = require("./utils/logger");
const webhookHandler = require("./webhooks/handler");

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub Webhooks
const webhooks = new Webhooks({
    secret: process.env.GH_WEBHOOK,
});

// Middleware to parse JSON
app.use(express.json());

// Health Check Endpoint.
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "Healthy",
        timestamp: new Date().toISOString(),
        message: "GitHub Webhooks endpoint is live"
    });
});

// Stats Endpoint
app.get("/stats", (req, res) => {
    res.json({ message: "Stats Endpoint not implemented yet!" });
});

// Github Webhook Endpoint.
app.post("/api/webhooks", async (req, res) => {
    try {
        const signature = req.headers["x-hub-signature-256"];
        const event = req.headers["x-github-event"];
        const id = req.headers["x-github-delivery"];

        // Verify the webhook signature.
        const isValid = await webhooks.verify(
            JSON.stringify(req.body),
            signature,
        );

        if (!isValid) {
            logger.warn("Invalid webhook signature", { event, id });
            return res.status(401).json({ message: "Invalid signature, not processing" });
        }

        logger.info("Webhook verified", { event, id });

        // Respond Immediately to GitHub (to avoid timeouts).
        res.status(200).json({ message: "Webhook received", received: true });

        // Process review asynchronously after responding.
        try {
            const prInfo = await webhookHandler.handleEvent(event, req.body);
            logger.info("Review job completed", { event, id, pr: prInfo });
        } catch (error) {
            logger.error("Error processing review job", { event, id, error: error.message });
        }

    } catch (error) {
        logger.error("Error handling webhook", { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
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

app.listen(port, () => logger.info(`Running on port ${port}`));

module.exports = app;
