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

// Github Webhook Endpoint.
app.post("/api/webhooks", async (req, res) => {
    try {
        // Get the signature from headers.
        const signature = req.headers["x-hub-signature-256"];
        const event = req.headers["x-github-event"];
        const id = req.headers["x-github-delivery"];

        /* DEBUG */
        // console.log('Event:', event);
        // console.log('Delivery ID:', id);
        // console.log('Signature header:', signature ? 'present' : 'MISSING');
        // console.log('Body:', req.body ? 'present' : 'MISSING');

        // Verify the webhook siganture.
        const isValid = await webhooks.verify(
            JSON.stringify(req.body),
            signature,
        );

        if (!isValid) {
            logger.warn("Invalid webhook signature", { event, id });
            return res.status(401).json({ message: "Invalid signature" });
        }

        // Respond Immediately to GitHub (to avoid timeouts).
        res.status(200).json({ message: "Webhook received", received: true });

        // Process the webhook asynchronously.
        setImmediate(async () => {
            try {
                await webhookHandler.handleEvent(event, req.body)
            } catch (error) {
                logger.error("Error processing webhook", {
                    event,
                    id,
                    error: error.message,
                });
                throw error;
            }
        });
    } catch (error) {
        logger.error("Error handling webhook", { error: error.message });
        res.status(500).json({ message: "Internal Server Error" });
    }
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

// Start the server.
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    logger.info(
        "Webhook endpint running!",
    );
});

// Graceful shutdown.
process.on("SIGINT", () => {
    logger.info("Shutting down server");
    process.exit();
});
