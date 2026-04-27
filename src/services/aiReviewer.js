const logger = require("../utils/logger");
const { OpenAI } = require("openai");

class AIReviewer {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is required.");
        }
        this.ai = new OpenAI();
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = 'gpt-5.4-nano';
        logger.info("AIReviewer initialized.");
    }

    /**
     * Builds a prompt for the AI Reviewer based on the file and its diff analysis.
     * @param {object} file
     * @param {object} analysis
     * @returns {string} prompt
     */
    buildReviewPrompt(file, analysis) {
        const prompt = `
            You are an expert code reviewer analyzing a GitHub pull request.

            ## Instructions:
            - Review for security vulnerabilities, performance issues, and readability
            - If isTestFile is true, do not review — set approved to true and note it in the summary
            - Pay close attention to any new functions detected
            - Flag any suspicious code patterns or potential security risks
            - Match feedback to the conventions of the language

            ## File:
            ${JSON.stringify(file, null, 2)}

            ## Diff Analysis:
            ${JSON.stringify(analysis, null, 2)}

            ## Output Format (IMPORTANT):
            Respond ONLY with valid JSON. No markdown, no explanation, no backticks.
            Use exactly this structure:
            {
                "severity": "low" | "medium" | "high" | "none",
                "summary": "one sentence overview",
                "suggestions": ["...", "..."],
                "securityFlags": ["...", "..."],
                "approved": true | false
            }
        `
        return prompt;
    }

    /**
     * Reviews a file using OpenAI.
     * @param {object} file
     * @param {object} analysis
     * @returns {object} structured review
     */
    async reviewCode(file, analysis) {
        try {
            const prompt = this.buildReviewPrompt(file, analysis);

            const response = await this.ai.responses.create({
                model: this.model,
                input: prompt,
            })

            if (!response.output_text || !response.output_text) {
                logger.warn("Empty response from OpenAI", { filename: file.filename });
                return this._fallbackReview(file.filename);
            }

            return this.parseReview(response.output_text, file.filename);

        } catch (error) {
            logger.error("Error during AI review", { error: error });
            return this._fallbackReview(file.filename);
        }
    }

    /**
     * Safe fallback review object when Gemini fails or returns empty.
     * @param {string} filename
     * @returns {object}
     */
    _fallbackReview(filename) {
        return {
            filename,
            severity: "none",
            summary: "Review could not be generated for this file.",
            suggestions: [],
            securityFlags: [],
            approved: true
        }
    }

    /**
     * Parses the AI review response into a structured format.
     * @param {string} reviewText
     * @param {string} filename
     * @returns {object}
     */
    parseReview(reviewText, filename) {
        try {
            // Removing markdown fencing if it is present.
            let review = reviewText.replace(/```json|```/g, '').replace(/```/g, "").trim();
            review = JSON.parse(review);


            // Basic validation of the reviewText structure (Severity and Summary are required)
            if (!review || typeof review !== "object" || !review.severity || !review.summary) {
                logger.warn("Invalid reviewText format from OpenAI", { filename, reviewText });
                return this._fallbackReview(filename);
            }

            return {
                filename,
                severity: review.severity,
                summary: review.summary,
                suggestions: review.suggestions || [],
                securityFlags: review.securityFlags || [],
                approved: review.approved ?? true
            }

        } catch (error) {
            logger.error("Failed to parse AI reviewText response", { error: error.message, filename });
            return this._fallbackReview(filename);
        }
    }

    /**
     * Decides which files from getPRFiles() should be reviewed by the AI.
     * @param {*} file from getPRFiles() method.
     * @returns {boolean}
     */
    shouldReviewFile(file) {
        // Files to skip.
        const skipFiles = ["package-lock.json", "yarn.lock"];
        const skipExtensions = [".min.js", ".map", ".lock"];

        // Return false if the file is undefined or null.
        if (!file.patch) { return false; }

        // Checking for zero additions an deletions
        if (file.additions === 0) { return false; }

        // Files to skip
        if (skipFiles.includes(file.filename) || skipExtensions.some(ext => file.filename.endsWith(ext))) { return false; }

        return true;
    }
}

module.exports = AIReviewer;