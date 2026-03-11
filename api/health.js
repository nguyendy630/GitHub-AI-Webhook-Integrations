// Health Check Endpoint.
const express = require("express");
const logger = require("./utils/logger");

const app = express();
const port = process.env.PORT || 3000;

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "Healthy",
        timestamp: new Date().toISOString(),
        message: "GitHub Webhooks endpoint is live"
    });
});

module.exports = app;