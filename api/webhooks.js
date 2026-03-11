// Ocotokit Object.
require("dotenv").config();
const express = require("express");
const logger = require("../src/utils/logger.js");
const webhookHandler = require("../src/webhooks/handler");

const app = express();
app.use(express.json())

// Change to lazy initialization:
async function getWebhooks() {
    if (!getWebhooks.instance) {
        const { Webhooks } = await import("@octokit/webhooks");
        getWebhooks.instance = new Webhooks({
            secret: process.env.GITHUB_WEBHOOK_SECRET,
        });
    }
    return getWebhooks.instance;
}

// Github Webhook Endpoint.
app.post("/api/webhooks", async (req, res) => {
    const webhooks = await getWebhooks();

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
        )

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
            }
        });

    } catch (error) {
        logger.error("Error handling webhook", { error: error.message });
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Required for Vercel Deployment.
module.exports = app;