const logger = require("../utils/logger");

/**
 * GithubService class provides methods to interact with GitHub API.
 */
class GithubService {
    // Initilaze Octokit with auth token.
    constructor() {
        if (!process.env.GH_TOKEN) {
            throw new Error("Github Token is required.");
        }

        logger.info("GitHub Service Initialized");
    }

    // Initialize the Octokit lazily
    async getOctoKit() {
        if (!this.octokit) {
            const { Octokit } = await import("@octokit/rest");
            this.octokit = new Octokit({
                auth: process.env.GITHUB_TOKEN,
            });
        }
        return this.octokit;
    }


    /**
     *  Fetches detailed pull request information from GitHub.
     * @param {string} owner
     * @param {string} repo
     * @param {number} prNumber
     *
     * @returns {object}
     */
    async getPullRequest(owner, repo, prNumber) {
        const octokit = await this.getOctoKit();
        try {
            logger.info("Fetching PR details", { owner, repo, prNumber });

            const { data } = await octokit.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
            });

            return {
                number: data.number,
                title: data.title,
                body: data.body,
                state: data.state,
                author: data.user.login,
                baseBranch: data.base.ref,
                headBranch: data.head.ref,
                baseSha: data.base.sha,
                headSha: data.head.sha,
                additions: data.additions,
                deletions: data.deletions,
                changedFiles: data.changed_files,
                mergeable: data.mergeable,
                url: data.html_url,
            };
        } catch (error) {
            logger.error("Error fetching PR details", { error: error.message });
            throw error;
        }
    }

    /**
     * Gets file changes for given pull request.
     * @param {String} owner
     * @param {String} repo
     * @param {number} prNumber
     *
     * @returns {Array{object}}
     */
    async getPRFiles(owner, repo, prNumber) {
        const octokit = await this.getOctoKit();
        try {
            logger.info("Fetching PR files", { owner, repo, prNumber });

            const { data } = await octokit.pulls.listFiles({
                owner,
                repo,
                pull_number: prNumber,
                per_page: 100, // Max Per Page.
            });

            // Maps over data from Github API to get file info.
            return data.map((file) => ({
                filename: file.filename,
                status: file.status, // 'added', 'removed', 'modified', 'renamed'
                additions: file.additions,
                deletions: file.deletions,
                changes: file.changes,
                patch: file.patch, // The actual diff
                blobUrl: file.blob_url,
                rawUrl: file.raw_url,
                previousFilename: file.previous_filename, // if renamed
            }));
        } catch (error) {
            logger.error("Error fetching PR files", { error: error.message });
            throw error;
        }
    }

    // REQUIRES TESTING
    /**
     * Gets the contents of the file at given path in the repository.
     * @param {string} owner
     * @param {string} repo
     * @param {string} filePath
     * @param {string} ref
     *
     * @returns {Array{object}}
     */
    async getFileContent(owner, repo, filePath, ref) {
        const octokit = await this.getOctoKit();
        try {
            logger.info("Fetching file content", {
                owner,
                repo,
                filePath,
                ref,
            });

            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path,
                ref, // Branch or commit SHA
            });

            // Extract the base64 content and decode it to utf-8.
            const content = Buffer.from(data.content, "base64").toString(
                "utf-8",
            );

            return {
                content,
                size: data.size,
                sha: data.sha,
                path: data.path,
            };
        } catch (error) {
            if (error.status === 404) {
                logger.warn("File not found in repository", {
                    owner,
                    repo,
                    filePath,
                    ref,
                });
                return null;
            }

            logger.error("Error fetching file content", {
                erorr: error.message,
            });
        }
    }

    /**
     * Fetches detailed pull request information from GitHub.
     * @param {string} owner
     * @param {string} repo
     * @param {number} prNumber
     * @returns Array{object}
     */
    async getPRDiff(owner, repo, prNumber) {
        const octokit = await this.getOctoKit();
        try {
            logger.info("Fetching PR Diff", { owner, repo, prNumber });

            const { data } = await octokit.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
                mediaType: {
                    format: "diff", // Unified Diff Format.
                },
            });

            return data;
        } catch (error) {
            logger.error("Error fetching PR Diff", { error: error.message });
            throw error;
        }
    }

    // REQUIRES TESTING
    /**
     * Posts a review comment on the given pull request.
     * @param {string} owner
     * @param {string} repo
     * @param {number} prNumber
     * @param {string} commentBody
     * @param {string} path 'src/index.ts'
     */
    async createReviewComment(owner, repo, prNumber, commentBody, path) {
        const octokit = await this.getOctoKit();
        try {
            const { data } = await octokit.pulls.createReviewComment({
                owner,
                repo,
                pull_number: prNumber,
                body: commentBody,
                path: filePath,
            });
            return data;
        } catch (error) {
            logger.error("Error creating review comment", {
                error: error.message,
            });
            throw error;
        }
    }

    // @TODO
    /**
     * Post inline comment on specific pull request.
     * @param {String} owner
     * @param {String} repo
     * @param {number} prNumber
     * @param {String} comment
     */
    async postInLineComment(owner, repo, prNumber, comment) {
        try {
        } catch (error) {
            logger.info("Error posting inline comment", {
                error: error.message,
            });
        }
    }
}

module.exports = new GithubService();