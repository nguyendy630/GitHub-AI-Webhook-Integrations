const { Queue } = require("bullmq");
const { connection } = require("./redisConnection");
const logger = require("../utils/logger");

try {
    if (!connection || typeof connection.host !== "string" || !Number.isInteger(connection.port)) {
        throw new Error("Redis connection must include a valid host and port.");
    }

    const reviewQueue = new Queue("pr-review", {
        connection,
        defaultJobOptions: {
            removeOnComplete: 1000,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
        },
    });

    module.exports = reviewQueue;

} catch (error) {
    logger.error("Failed to initialize the review queue", { error });
    throw error;
}
