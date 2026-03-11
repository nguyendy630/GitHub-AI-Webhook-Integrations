// Health Check Endpoint.
const express = require("express");

const app = express();
app.use(express.json())

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "Healthy",
        timestamp: new Date().toISOString(),
        message: "GitHub Webhooks endpoint is live"
    });
});

module.exports = app;