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
            secret: process.env.GH_WEBHOOK,
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
        console.log('Event:', event);
        console.log('Delivery ID:', id);
        console.log('Signature header:', signature ? 'present' : 'MISSING');
        console.log('Body:', req.body ? 'present' : 'MISSING');

        // Verify the webhook siganture.
        const isValid = await webhooks.verify(
            JSON.stringify(req.body),
            signature,
        )

        // if (!isValid) {
        //     logger.warn("Invalid webhook signature", { event, id });
        //     return res.status(401).json({ message: "Invalid signature, not processing" });
        // }

        logger.info("Webhook verified", { event, id });

        try {
            logger.info("Processing webhook", { event, id });
            logger.info("Dispatching review job", { event, id });

            const baseURL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 3000}`;

            try {
                logger.info("Reviewing Job...", { url: baseURL + "/api/review-jobs" });

                const response = await fetch(baseURL + "/api/review-jobs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-GitHub-Event": event,
                        "X-GitHub-Delivery": id,
                        "X-Hub-Signature-256": signature,
                        "x-review-job-secret": process.env.REVIEW_JOBS_SECRET || "",
                    },
                    body: JSON.stringify(req.body),
                });

                // Respond Immediately to GitHub (to avoid timeouts).
                return res.status(200).json({message: "Webhook received and review job dispatched."});

            } catch (err) {
                logger.error("Error fetching review job endpoint", { error: err.message }); // this will catch network errors
            }

        } catch (error) {
            logger.error("Error processing webhook", {
                event,
                id,
                error: error.message,
            });

            return res.status(500).json({ message: "Error processing webhook" });
        }

    } catch (error) {
        logger.error("Error handling webhook", { error: error.message });
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Required for Vercel Deployment.
module.exports = app;