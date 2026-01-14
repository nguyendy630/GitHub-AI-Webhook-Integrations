const logger = require('../utils/logger');
const services = require('../services/services');
const diffParser = require('../services/diffParser');

/**
 * Handles GitHub webhook events.
 * @param {string} eventType - The type of GitHub event.
 * @param {object} payload - The payload of the webhook event.
 * 
 */
const eventStats = {
    ping: 0,
    pull_request: 0,
    pull_request_review: 0,
    other: 0,
    push: 0
}

class WebhookHandler {
    /**
     *  Handles the incoming POST webhook event. 
     * @param {*} eventType 
     * @param {*} payload 
     */
    async handleEvent(eventType, payload) {
        logger.info('Processing webhook event', {
            eventType,
            action: payload.action
        });

        // Handle different event types
        switch (eventType) {
            case 'pull_request':
                logger.info('Received pull_request');
                await this.handlePullRequest(payload);
                eventStats.pull_request++;
                break;

            case 'pull_request_review':
                logger.info('Received pull_request_review');
                await this.handlePullRequestReview(payload);
                eventStats.pull_request_review++;
                break;

            case 'push':
                // Maybe analyze commits in the future
                logger.info('Push event received (not processing yet)');
                eventStats.push++;
                break;

            case 'ping':
                logger.info('Ping event received from GitHub');
                eventStats.ping++;
                break;

            default:
                logger.info('Unhandled event type', { eventType });
                eventStats.other++;
        }
    }

    /**
     * Handles pull request events. 
     * @param {*} payload 
     * @returns 
     */
    async handlePullRequest(payload) {
        const { action, pull_request, repository } = payload;

        // Only process specific actions
        const relevantActions = ['opened', 'synchronize', 'reopened'];

        if (!relevantActions.includes(action)) {
            logger.info('Ignoring PR action', { action });
            return;
        }

        const prInfo = {
            number: pull_request.number,
            title: pull_request.title,
            author: pull_request.user.login,
            repo: repository.full_name,
            baseBranch: pull_request.base.ref,
            headBranch: pull_request.head.ref,
            additions: pull_request.additions,
            deletions: pull_request.deletions,
            changedFiles: pull_request.changed_files,
            url: pull_request.html_url
        };

        logger.info('Pull request to review', prInfo);

        // TODO Phase 2: Fetch and analyze code
        // TODO Phase 3: Generate AI review
        // TODO: Post review comment back to GitHub

        // For now, just log it
        await this.queueReview(prInfo);
    }

    /**
     * Handles pull request review events. 
     * @param {*} payload 
     */
    async handlePullRequestReview(payload) {
        // This fires when someone submits a review on a PR
        // Useful for learning what good reviews look like
        const { action, review, pull_request } = payload;

        logger.info('Review submitted', {
            prNumber: pull_request.number,
            reviewer: review.user.login,
            state: review.state // approved, changes_requested, commented
        });

        // TODO: Store this for training data collection
    }

    /**
     * Queues the PR for review processing. 
     * @param {*} prInfo 
     */
    async queueReview(prInfo) {
        // For now, just simulate processing
        logger.info('Queueing PR for review...', {
            pr: prInfo.number,
            repo: prInfo.repo
        });

        console.log();

        // In Phase 2+, we'll:
        // 1. Add to a job queue (Bull, BullMQ, or Redis)
        // 2. Worker processes pick up jobs
        // 3. Fetch PR diff and analyze
        const diff = await services.getPRDiff(prInfo.repo.split('/')[0], prInfo.repo.split('/')[1], prInfo.number);
        const parsedResults = diffParser.analyzeChange(diff);

        console.log(parsedResults);
        // 4. Generate AI suggestions

        // 5. Post back to GitHub

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 1000));

        logger.info('Review queued successfully', { pr: prInfo.number });
    }
}

module.exports = new WebhookHandler();