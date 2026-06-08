require("dotenv").config();
const express = require("express");
const logger = require("../src/utils/logger.js");
const webhookHandler = require("../src/webhooks/handler.js");

const app = express();
app.use(express.json());

app.get("/api/review-jobs", (req, res) => {
	res.status(200).json({ message: "Review Jobs Endpoint is up" });
})

// Review Job Endpoint
app.post("/api/review-jobs", async (req, res) => {
	const secretHeader = req.headers["x-review-job-secret"];
	const expectedSecret = process.env.REVIEW_JOBS_SECRET;
	const event = req.headers["x-github-event"] || "unknown";

	if (expectedSecret) {
		if (!secretHeader || secretHeader !== expectedSecret) {
			logger.warn("Unauthorized review job request", { hasHeader: !!secretHeader });
			return res.status(401).json({ message: "Unauthorized" });
		}
	} else {
		logger.warn("REVIEW_JOBS_SECRET not set — accepting requests (dev)");
	}

	console.log(req.body)

	try {
		const prInfo = await webhookHandler.handleEvent(event, req.body);
		logger.info("Review job completed", { pr: prInfo });
		return res.status(200).json({ message: "Review completed", pr: req.body.pull_request.number });
	} catch (error) {
		logger.error("Error processing review job", { error: error.message });
		return res.status(500).json({ message: "Internal Server Error" });
	}
});

module.exports = app;
