const logger = require("../utils/logger");
const reviewQueue = require("../queue/reviewQueue");

// Monitor event stats.
const eventStats = {
    ping: 0,
    pull_request: 0,
    pull_request_review: 0,
    other: 0,
    push: 0
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
     */
    async handlePullRequest(payload) {
        const { action, pull_request, repository } = payload;

        logger.info("Handling pull request event", {
            action,
            prNumber: pull_request.number,
            repo: repository.full_name,
        });

        const relevantActions = ["opened", "synchronize", "reopened"];
        if (!relevantActions.includes(action)) {
            logger.info("Ignoring PR action", { action });
            return;
        }

        const prInfo = {
            number: pull_request.number,
            title: pull_request.title,
            body: pull_request.body,
            repoName: repository.name,
            repoOwner: repository.owner.login,
        };

        try {
            await this.queueReview(prInfo);
        } catch (error) {
            logger.error("Error queueing PR for review", {
                pr: pull_request.number,
                repo: prInfo.repoName,
                error: error.message,
            });
        }
    }

    /**
     * Handles pull request review events.
     * @param {object} payload
     */
    async handlePullRequestReview(payload) {
        const { action, review, pull_request } = payload;

        logger.info("Review submitted", {
            prNumber: pull_request.number,
            reviewer: review.user.login,
            state: review.state,
        });

        // TODO: Store this for training data collection
    }

    /**
     * Enqueues a PR review job.
     * @param {object} prInfo
     */
    async queueReview(prInfo) {
        logger.info("Queueing PR for review", {
            number: prInfo.number,
            repo: prInfo.repoName,
            owner: prInfo.repoOwner,
        });

        await reviewQueue.add("review", {
            owner: prInfo.repoOwner,
            repo: prInfo.repoName,
            prNumber: prInfo.number,
        });

        logger.info("PR review job enqueued", {
            pr: prInfo.number,
            repo: prInfo.repoName,
        });
    }
}

module.exports = new WebhookHandler();
