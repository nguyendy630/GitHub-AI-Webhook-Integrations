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
            You are a senior software engineer performing a code review. You will be provided with a CL for the files. Your task is to review the given pull request abided by the following criteria:

            ## Criteria:
            Design: Is the code well-designed and appropriate for your system?
            Functionality: Does the code behave as the author likely intended? Is the way the code behaves good for its users?
            Complexity: Could the code be made simpler? Would another developer be able to easily understand and use this code when they come across it in the future?
            Tests: Does the code have correct and well-designed automated tests?
            Naming: Did the developer choose clear names for variables, classes, methods, etc.?
            Comments: Are the comments clear and useful?
            Style: If provided does it align with the style guide? If not, is it still clear and readable?
            Documentation: Did the developer also update relevant documentation?

            ## Instructions:
            - Favour blocking false: does this change improve code health versus the current state? It does not need to be perfect.
            - Favour blocking true: if there is a correctness bug, security vulnerability, or the change actively degrades code health.
            - Style/naming/preference points are "nits" — never block on these alone.

            ## File:
            ${JSON.stringify(file, null, 2)}

            ## Diff Analysis:
            ${JSON.stringify(analysis, null, 2)}

            ## Output Format (IMPORTANT):
            Respond ONLY with valid JSON. No markdown, no explanation, no backticks.
            Use exactly this structure:
            {
                "severity": "low" | "medium" | "high" | "none",
                "summary": "A brief summary that follows the Critieria",
                "patch" : "Optional: If you have a suggested patch, include it here. Otherwise, leave this field empty.",
                "securityFlags": ["...", "..."],
                "suggestions": [
                    {
                        "text": "...",
                        "blocking": true | false,
                    }
                ]
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

            if (!response.output_text) {
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
                approved: !(review.suggestions || []).some(s => s.blocking === true)
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
        const skipFiles = ["package-lock.json", "yarn.lock"];
        const skipExtensions = [".min.js", ".map", ".lock"];

        if (!file.patch) return false;
        if (file.additions === 0) return false;
        if (skipFiles.includes(file.filename)) return false;
        if (skipExtensions.some(ext => file.filename.endsWith(ext))) return false;

        return true;
    }
}

module.exports = AIReviewer;