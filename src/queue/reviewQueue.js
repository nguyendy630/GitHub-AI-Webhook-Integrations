const { Queue } = require("bullmq");
const connection = require("./redisConnection");
const logger = require("../utils/logger");

try {
    const reviewQueue = new Queue("pr-review", {
        connection,
        defaultJobOptions: {
            removeOnComplete: 1000,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
        },
        timeout: 30000, // 30 seconds before timing out.

        // Rate limiting to prevent influx of jobs.
        limiter: {
            max: 100,
            duration: 60000, // 1 minute
        },

        concurrency: 5 // 5 jobs can be processed concurrently.
    });

    module.exports = reviewQueue;

} catch (error) {
    logger.error("Failed to initialize the review queue: " + error.message);
    throw error;
}