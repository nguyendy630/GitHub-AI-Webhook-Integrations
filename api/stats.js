// Stats Endpoint
const express = require("express");
const logger = require("./utils/logger");

app.get("/stats", (req, res) => {
    res.json({ message: "Stats Endpoint not implemented yet!" });
});

module.export = app;