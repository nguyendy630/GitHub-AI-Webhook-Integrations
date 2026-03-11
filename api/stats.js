// Stats Endpoint
const express = require("express");

const app = express();
app.use(express.json())

app.get("/stats", (req, res) => {
    res.json({ message: "Stats Endpoint not implemented yet!" });
});

module.export = app;