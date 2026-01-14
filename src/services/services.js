const { Octokit } = require("@octokit/rest");
const logger = require("../utils/logger");

class GithubService {
    // Initilaze Octokit with auth token.
    constructor() {
        if (!process.env.GITHUB_TOKEN) {
            throw new Error("Github Token is required.");
        }

        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        logger.info("Github Service initialized.");
    }

    /**
     *  Fetches detailed pull request information from GitHub.
     * @param {*} owner
     * @param {*} repo
     * @param {*} prNumber
     * @returns
     */
    async getPullRequest(owner, repo, prNumber) {
        try {
            logger.info("Fetching PR details", { owner, repo, prNumber });

            const { data } = await this.octokit.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
            });

            console.log(data);

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
     */
    async getPRFiles(owner, repo, prNumber) {
        try {
            logger.info("Fetching PR files", { owner, repo, prNumber });

            const { data } = await this.octokit.pulls.listFiles({
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

    /**
     * Gets the contents of the file at given path in the repository.
     * @param {*} owner
     * @param {*} repo
     * @param {*} filePath
     * @param {*} ref
     */
    async getFileContent(owner, repo, filePath, ref) {
        try {
            logger.info("Fetching file content", {
                owner,
                repo,
                filePath,
                ref,
            });

            const { data } = await this.octokit.repos.getContent({
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

    async getPRDiff(owner, repo, prNumber) {
        try {
            logger.info("Fetching PR Diff", { owner, repo, prNumber });

            const { data } = await this.octokit.pulls.get({
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

    // Phase 3.
    /**
     * Posts a review comment on the given pull request.
     * @param {*} owner
     * @param {*} repo
     * @param {*} prNumber
     * @param {*} commentBody
     * @param {*} path 'src/index.ts'
     */
    async createReviewComment(owner, repo, prNumber, commentBody, path) {
        try {
            const { data } = await this.octokit.pulls.createReviewComment({
                owner,
                repo,
                pull_number: prNumber,
                body: commentBody,
                path,
            });
            return data;
        } catch (error) {
            logger.error("Error creating review comment", {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Post inline comment on specific pull request.
     * @param {*} owner
     * @param {*} repo
     * @param {*} prNumber
     * @param {*} comment
     */
    async postInLineComment(owner, repo, prNumber, comment) {
        try {
        } catch (error) {}
    }
}

module.exports = new GithubService();
