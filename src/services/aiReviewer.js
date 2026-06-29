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
            You are a senior software engineer conducting a thorough, educational code review on a GitHub pull request.

            Your review must serve TWO audiences simultaneously:
            - A JUNIOR developer learning software engineering fundamentals
            - A SENIOR engineer who wants precise, high-signal technical feedback

            ---

            ## Review Philosophy

            Good code review teaches. For every issue you find:
            1. Name what's wrong (the WHAT)
            2. Explain the underlying principle that's violated (the WHY)
            3. Show a concrete fix or direction (the HOW)

            Don't just flag problems. If a pattern is done well, say so briefly — junior devs need to know what to keep doing.

            ---

            ## Review Priorities (in order of severity)

            **1. Correctness & Security**
            - Race conditions, null/undefined access, off-by-one errors
            - Injection risks, unvalidated inputs, exposed secrets, improper auth checks
            - Unsafe use of eval, dangling async calls, missing error handling
            - For juniors: briefly explain *why* security issues are dangerous, not just that they exist

            **2. Architecture & Design**
            - Does this code belong here? (separation of concerns, single responsibility)
            - Are abstractions at the right level? Too specific? Too generic?
            - Is state managed clearly? Are side effects predictable?
            - For juniors: connect the issue to a named principle (SRP, DRY, YAGNI, etc.) when applicable

            **3. Performance**
            - Unnecessary re-computation, missing memoization, N+1 patterns
            - Blocking calls in hot paths, memory leaks, inefficient data structures
            - For juniors: explain what the cost actually is (CPU, memory, latency)

            **4. Readability & Maintainability**
            - Ambiguous naming, inconsistent conventions, magic numbers/strings
            - Functions doing more than one thing, deeply nested logic, missing edge case handling
            - For juniors: distinguish between "style preference" and "genuine readability problem"

            **5. Test Coverage (if applicable)**
            - Missing assertions, testing implementation vs behavior, flaky test patterns
            - For juniors: explain the difference between unit, integration, and end-to-end testing context when relevant

            ---

            ## Test File Rule

            If isTestFile is true: skip the full review. Set approved to true and note in the summary that test files are excluded from automated review. Do not penalize test-specific patterns like mocking.

            ---

            ## New Function Detection

            Pay close attention to any new functions in the diff. For each:
            - Check for missing input validation
            - Check for undocumented assumptions (e.g., "caller must ensure X is not null")
            - Check whether the function name accurately describes what it does
            - For juniors: if a function is complex, note whether it should be broken down

            ---

            ## Language & Convention Awareness

            Match feedback to the idioms and conventions of the detected language:
            - Don't flag idiomatic patterns as wrong just because they look unfamiliar
            - Do flag anti-patterns specific to this language's ecosystem
            - Mention the language-specific convention being violated when you flag something

            ---

            ## File Context

            ${JSON.stringify(file, null, 2)}

            ## Diff Analysis

            ${JSON.stringify(analysis, null, 2)}

            ---

            ## Output Format (IMPORTANT)

            Respond ONLY with valid JSON. No markdown, no explanation, no backticks.

            Use exactly this structure:
            {
                "severity": "none" | "low" | "medium" | "high" | "critical",
                "summary": "One sentence: the single most important thing about this diff",
                "patch": "The exact code snippet from the diff most relevant to your feedback, in markdown format. Empty string if not applicable.",
                "keyPrinciple": "The core software engineering concept at stake in this review (e.g., 'Input Validation', 'Single Responsibility', 'Error Propagation'). One short phrase.",
                "suggestions": [
                    {
                        "level": "junior" | "senior" | "both",
                        "issue": "What is wrong or could be improved",
                        "why": "The underlying principle or risk",
                        "fix": "Concrete actionable suggestion or example"
                    }
                ],
                "securityFlags": ["..."],
                "didWell": "One thing done well in this diff worth reinforcing (or empty string if nothing notable)",
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