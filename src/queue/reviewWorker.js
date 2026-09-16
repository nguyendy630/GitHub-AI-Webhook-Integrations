const { Worker } = require("bullmq");
const { connection } = require("./redisConnection");
const logger = require("../utils/logger");

const services = require("../services/services");
const diffParser = require("../services/diffParser");
const AIReviewer = require("../services/aiReviewer");

const aiReviewer = new AIReviewer();
const { formatReviewsAsMarkdown } = require("../utils/commentFormatter");
const MAX_COMMENT_LENGTH = 60000;

function validateJobData(data) {
    if (
        !data ||
        typeof data.owner !== "string" || !data.owner.trim() ||
        typeof data.repo !== "string" || !data.repo.trim() ||
        !Number.isInteger(data.prNumber) || data.prNumber < 1
    ) {
        throw new Error("Invalid review job data: owner, repo, and a positive integer prNumber are required.");
    }
}

function limitCommentLength(commentBody) {
    if (commentBody.length <= MAX_COMMENT_LENGTH) {
        return commentBody;
    }

    const notice = "\n\n---\n⚠️ Review truncated because it exceeded the GitHub comment size limit.";
    return commentBody.slice(0, MAX_COMMENT_LENGTH - notice.length) + notice;
}

async function processReview(job) {
    validateJobData(job && job.data);
    const { owner, repo, prNumber } = job.data;

    logger.info("Processing review job", { jobId: job.id, owner, repo, prNumber });

    // Phase 1: Fetch and filter files.
    const files = await services.getPRFiles(owner, repo, prNumber);

    if (!Array.isArray(files)) {
        throw new Error("GitHub returned an invalid PR files response.");
    }

    const validFiles = files.filter(file => (
        file &&
        typeof file.filename === "string" && file.filename.trim() &&
        typeof file.patch === "string" && file.patch.length > 0
    ));
    const filesToReview = validFiles.filter(file => aiReviewer.shouldReviewFile(file));

    logger.info("Files selected for review", {
        jobId: job.id,
        pr: prNumber,
        repo,
        total: files.length,
        toReview: filesToReview.length,
        skippedInvalid: files.length - validFiles.length,
    });

    if (filesToReview.length === 0) {
        logger.info("No files eligible for review", { jobId: job.id, pr: prNumber, repo });
        return;
    }

    // Phase 2: Analyze and review each file in parallel.
    const reviewPromises = filesToReview.map(async (file) => {
        const analysis = diffParser.analyzeDiff(file.patch, file.filename);
        return aiReviewer.reviewCode(file, analysis);
    });

    const results = await Promise.allSettled(reviewPromises);
    const reviews = results
        .filter(result => result.status === "fulfilled" && !result.value.reviewFailed)
        .map(result => result.value);
    const failedCount = results.length - reviews.length;

    logger.info("Reviews completed", {
        jobId: job.id,
        total: filesToReview.length,
        succeeded: reviews.length,
        failed: failedCount,
    });

    // Phase 3: Format and post PR comment if issues found.
    let commentBody = formatReviewsAsMarkdown(reviews);

    if (failedCount > 0) {
        const failureNotice = `⚠️ **${failedCount} file(s) could not be reviewed** due to processing errors.`;
        commentBody = commentBody
            ? `${commentBody}\n\n---\n${failureNotice}`
            : `## 🤖 AI Code Review\n\n${failureNotice}`;
    }

    if (!commentBody) {
        logger.info("No issues found; PR comment not posted", { jobId: job.id, pr: prNumber, repo });
        return;
    }

    await services.postPRComment(owner, repo, prNumber, limitCommentLength(commentBody));
    logger.info("PR comment posted successfully", { jobId: job.id, pr: prNumber, repo });
}

const worker = new Worker("pr-review", processReview, {
    connection,
    concurrency: 2,
    limiter: {
        max: 100,
        duration: 60000,
    },
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
module.exports.processReview = processReview;
