const logger = require("../utils/logger");
const services = require("../services/services");
const diffParser = require("../services/diffParser");
const AIReviewer = require("../services/aiReviewer");
const aiReviewer = new AIReviewer();
const { formatReviewsAsMarkdown } = require("../utils/commentFormatter");

// Monitor event stats.
const eventStats = {
    ping: 0,
    pull_request: 0,
    pull_request_review: 0,
    other: 0,
    pull: 0
}

/**
 * Handles GitHub webhook events.
 * @param {string} eventType - The type of GitHub event.
 * @param {object} payload - The payload of the webhook event.
 *
 */
class WebhookHandler {
    /**
     * Handles the incoming POST receive webhook event.
     * @param {string} eventType
     * @param {object} payload
     */
    async handleEvent(eventType, payload) {
        logger.info("Processing webhook event", {
            eventType,
            action: payload.action,
        });

        // Handle different event types
        switch (eventType) {
            case "pull_request":
                logger.info("Pull request event received")
                await this.handlePullRequest(payload);
                eventStats.pull_request++;
                break;

            case "pull_request_review":
                logger.info("Pull request review event received")
                await this.handlePullRequestReview(payload);
                eventStats.pull_request_review++;
                break;

            case "push":
                // Maybe analyze commits in the future
                logger.info("Push event received (not processing yet)");
                eventStats.push++;
                break;

            case "ping":
                logger.info("Ping event received from GitHub");
                eventStats.ping++;
                break;

            default:
                logger.info("Unhandled event type", { eventType });
                eventStats.other++;
        }
    }

    /**
     * Handles pull request events.
     * @param {object} payload
     * @returns
     */
    async handlePullRequest(payload) {

        logger.info("Handling pull request event", {
            action: payload.action,
            prNumber: payload.pull_request.number,
            repo: payload.repository.full_name,
        });

        const { action, pull_request, repository, sender } = payload;

        // Only process specific actions
        const relevantActions = ["opened", "synchronize", "reopened"];

        if (!relevantActions.includes(action)) {
            logger.info("Ignoring PR action", { action });
            return;
        }

        try {
            logger.info("Fetching PR info from GitHub", {
                prNumber: pull_request.number,
                repo: repository.full_name,
            });

            const prInfo = {
                number: pull_request.number,
                title: pull_request.title,
                body: pull_request.body,
                repoName: repository.name,
                repoOwner: sender.login
            }

            console.log(prInfo)

            try {
                await this.queueReview(prInfo);

            } catch (error) {
                logger.error("Error queueing PR for review", {
                    pr: pull_request.number,
                    repo: prInfo.repoName,
                    error: error.message,
                });
            }

        } catch (error) {
            logger.error("Error occurred while fetching PR info", { error: error.message });
        }

        // TODO Phase 2: Fetch and analyze code
        // TODO Phase 3: Generate AI review
        // TODO: Post review comment back to GitHub
    }

    /**
     * Handles pull request review events.
     * @param {object} payload
     */
    async handlePullRequestReview(payload) {
        // This fires when someone submits a review on a PR
        // Useful for learning what good reviews look like
        const { action, review, pull_request } = payload;

        logger.info("Review submitted", {
            prNumber: pull_request.number,
            reviewer: review.user.login,
            state: review.state, // approved, changes_requested, commented
        });

        // TODO: Store this for training data collection
    }

    /**
     * Queues the PR for review processing.
     * @param {object} prInfo
     */
    async queueReview(prInfo) {
        // For now, just simulate processing
        logger.info("Queueing PR for review...", {
            number: prInfo.number,
            repo: prInfo.repoName,
            owner: prInfo.repoOwner,
        });

        // Collecting Files from PR Diff
        const files = await services.getPRFiles(prInfo.repoOwner, prInfo.repoName, prInfo.number);
        const filesToReview = files.filter(file => aiReviewer.shouldReviewFile(file));

        console.log(`Total files: ${files.length}, Files to review: ${filesToReview.length}`);

        logger.info("AI is reviewing files", {
            pr: prInfo.number,
            repo: prInfo.repoName,
            filesToReview: filesToReview.length,
        })
        
        // // Parallel Loop - Each file goes through two steps (analysis and review).
        const reviewPromises = filesToReview.map(async (file) => {
            const analysis = diffParser.analyzeDiff(file.patch);
            return await aiReviewer.reviewCode(file, analysis)
        })

        const results = await Promise.allSettled(reviewPromises);

        // Filter out the sucessful reviews and log stats.
        const reviews = results.filter(result => result.status === "fulfilled").map(result => result.value);

        logger.info("Reviews completed", {
            total: filesToReview.length,
            succeeded: reviews.length,
            failed: filesToReview.length - reviews.length
        });

        // // Phase 3: Format and post PR comment if issues found
        const commentBody = formatReviewsAsMarkdown(reviews);
        if (commentBody) {
            try {
                await services.postPRComment(
                    prInfo.repoOwner,
                    prInfo.repoName,
                    prInfo.number,
                    commentBody
                );
                logger.info("PR comment posted successfully", {
                    pr: prInfo.number,
                    repo: prInfo.repo,
                });
            } catch (error) {
                logger.error("Failed to post PR comment", {
                    error: error.message,
                    pr: prInfo.number,
                    repo: prInfo.repo,
                });
                // Do not rethrow—webhook continues (resilient error handling)
            }
        } else {
            logger.info("No issues found; PR comment not posted", {
                pr: prInfo.number,
                repo: prInfo.repo,
            });
        }
    }
}

module.exports = new WebhookHandler();
