const { Worker } = require("bullmq");
const connection = require("./redisConnection");
const logger = require("../utils/logger");
const services = require("../services/services");
const diffParser = require("../services/diffParser");
const AIReviewer = require("../services/aiReviewer");
const aiReviewer = new AIReviewer();
const { formatReviewsAsMarkdown } = require("../utils/commentFormatter");

async function processReview(job) {
    const { owner, repo, prNumber } = job.data;

    logger.info("Processing review job", { jobId: job.id, owner, repo, prNumber });

    // Phase 1: Fetch and filter files.
    const files = await services.getPRFiles(owner, repo, prNumber);
    const filesToReview = files.filter(file => aiReviewer.shouldReviewFile(file));

    logger.info("Files selected for review", {
        jobId: job.id,
        pr: prNumber,
        repo,
        total: files.length,
        toReview: filesToReview.length,
    });

    // Phase 2: Analyze and review each file in parallel.
    const reviewPromises = filesToReview.map(async (file) => {
        const analysis = diffParser.analyzeDiff(file.patch, file.filename);
        return aiReviewer.reviewCode(file, analysis);
    });

    const results = await Promise.allSettled(reviewPromises);
    const reviews = results
        .filter(result => result.status === "fulfilled")
        .map(result => result.value);

    logger.info("Reviews completed", {
        jobId: job.id,
        total: filesToReview.length,
        succeeded: reviews.length,
        failed: filesToReview.length - reviews.length,
    });

    // Phase 3: Format and post PR comment if issues found.
    const commentBody = formatReviewsAsMarkdown(reviews);

    if (!commentBody) {
        logger.info("No issues found; PR comment not posted", { jobId: job.id, pr: prNumber, repo });
        return;
    }

    await services.postPRComment(owner, repo, prNumber, commentBody);
    logger.info("PR comment posted successfully", { jobId: job.id, pr: prNumber, repo });
}

const worker = new Worker("pr-review", processReview, {
    connection,
    concurrency: 2,
});

worker.on("completed", (job) => {
    logger.info("Review job completed", { jobId: job.id, pr: job.data.prNumber });
});

worker.on("failed", (job, error) => {
    logger.error("Review job failed", {
        jobId: job.id,
        pr: job.data.prNumber,
        attempt: job.attemptsMade,
        error: error.message,
    });
});

module.exports = worker;
