require("dotenv").config();
const express = require("express");
const { Webhooks } = require("@octokit/webhooks");
const logger = require("./utils/logger");
const webhookHandler = require("./webhooks/handler");
const worker = require("./queue/reviewWorker");
const reviewStore = require("./services/reviewStore");

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub Webhooks
const webhooks = new Webhooks({
    secret: process.env.GH_WEBHOOK,
});

// Middleware to parse JSON and capture raw body for signature verification.
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// Health Check Endpoint.
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "Healthy",
        timestamp: new Date().toISOString(),
        message: "GitHub Webhooks endpoint is live"
    });
});

// CORS for the dashboard app only — restrict to the configured origin.
app.use("/api", (req, res, next) => {
    const allowedOrigin = process.env.DASHBOARD_ORIGIN;
    res.setHeader("Vary", "Origin");
    if (allowedOrigin && req.headers.origin === allowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// Dashboard API — aggregate stats, filterable by repo owner.
app.get("/api/stats", async (req, res) => {
    try {
        const stats = await reviewStore.getStats(req.query.owner);
        res.json(stats);
    } catch (error) {
        logger.error("Failed to fetch stats", { error: error.message });
        res.status(500).json({ message: "Failed to fetch stats" });
    }
});

// Dashboard API — reviewed PR list, filterable by repo owner.
app.get("/api/prs", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = parseInt(req.query.offset, 10) || 0;
        const reviews = await reviewStore.listReviews({ owner: req.query.owner, limit, offset });
        res.json(reviews);
    } catch (error) {
        logger.error("Failed to fetch PR reviews", { error: error.message });
        res.status(500).json({ message: "Failed to fetch PR reviews" });
    }
});

// Dashboard API — distinct repo owners, for the owner selector.
app.get("/api/owners", async (req, res) => {
    try {
        const owners = await reviewStore.listOwners();
        res.json(owners);
    } catch (error) {
        logger.error("Failed to fetch repo owners", { error: error.message });
        res.status(500).json({ message: "Failed to fetch repo owners" });
    }
});

// Github Webhook Endpoint.
app.post("/api/webhooks", async (req, res) => {
    try {
        const signature = req.headers["x-hub-signature-256"];
        const event = req.headers["x-github-event"];
        const id = req.headers["x-github-delivery"];

        // Headers verification.
        if (!signature) {
            logger.warn("Missing signature header", { event, id });
            return res.status(400).json({ message: "Missing signature header" });

        } else if (!event) {
            logger.warn("Missing event headeer", { id });
            return res.status(400).json({ message: "Missing event header" });
        }

        // Webhooks verification.
        const isValid = await webhooks.verify(req.rawBody, signature);

        if (!isValid) {
            logger.warn("Invalid webhook signature", { event, id });
            return res.status(401).json({ message: "Invalid signature, not processing" });
        }

        // Respond Immediately to GitHub (to avoid timeouts).
        res.status(200).json({ message: "Webhook received", received: true });
        logger.info("Webhook verified", { event, id });

        // Enqueue review job — worker processes it asynchronously.
        webhookHandler.handleEvent(event, req.body)
            .then(() => logger.info("Webhook event handled", { event, id }))
            .catch((error) => {
                // Response already sent to GitHub above; only log the async failure.
                logger.error("Error processing review job", { event, id, error: error.message });
            });

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

// Graceful shutdown — close the BullMQ worker so in-flight jobs finish.
process.on("SIGINT", async () => {
    logger.info("Shutting down server");
    await worker.close();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    logger.info("Shutting down server (SIGTERM)");
    await worker.close();
    process.exit(0);
});

reviewStore.ensureSchema()
    .then(() => logger.info("Review store schema ready"))
    .catch((error) => logger.error("Failed to initialize review store schema", { error: error.message }))
    .finally(() => {
        app.listen(port, () => { logger.info(`Server is running on port ${port}`) });
    });
