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