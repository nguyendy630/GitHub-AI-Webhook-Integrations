const { Queue } = require("bullmq");
const connection = require("./redisConnection");

const reviewQueue = new Queue("pr-review", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
    },
});

module.exports = reviewQueue;
