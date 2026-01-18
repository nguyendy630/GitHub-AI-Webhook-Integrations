const logger = require("../utils/logger");

class AIReviewer {
    constructor() {
        this.apiEndpoint = "https://api.anthropic.com/v1/messages";
        this.model = "claude-sonnet-4-20250514";
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error("Anthropic API key is required")
        }
        this.apiKey = process.env.ANTHROPIC_API_KEY
    }

    /**
     * Initiate file review.
     * @param {*} file
     * @param {*} analysis
     */
    async reviewCode(file, analysis) {
        try {
            logger.info("Generating Review", {
                file,
                analysis,
            });

            // Building Prompt
            let prompt = this.buildReviewPrompt(file, analysis);

            // Claude API
            const response = await fetch(this.apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 2000,
                    messages: [
                        {
                            role: "User",
                            content: prompt,
                        },
                    ],
                }),
            });

            // Handle Response
            const data = await response.json();

            if (!response.ok) {
                logger.error("Error generating review", response.statusText);
            }

            // Extract review from response
            const reviewText = data.content[0].text;

            logger.info("AI review generated", {
                filename: file.filename,
                reviewLength: reviewText.length,
            });

            return this.parseReview(reviewText);
        } catch (error) {
            logger.error("Error generating review", error.message);
        }
    }

    /**
     * Prompt for AI to follow
     * @param file
     * @param analysis
     */
    buildReviewPrompt(file, analysis) {
        const prompt = `
            You are a software engineer tasked with reviewing code. A file metadata ANALYSIS is given with the actual CODE CHANGES.
            
            ### 1. ANALYSIS METADATA ###
            ${JSON.stringify(analysis, null, 2)}
            
            ### 2. INSTRUCTIONS ###
            1. Use the ANALYSIS METADATA to understand the context:
               - Review the 'addedLines' and "deletedLines" content.
               - If "isTestFile" is True, DO NOT REVIEW TEST FILES; FOCUS on production code instead. Warn the user of the TEST FILE. ( ALSO CHECK IF THERE ARE ANY OTHER TEST FILES )
               - If "hasNewFunctions" has content, pay CLOSE ATTENTION to the logic in those functions
               - Check if "hasImportChanges", has imports that are NECESSARY, or could they introduce PERFORMANCE or SECURITY issues.
            2. MAKE SURE that code aligns with the style conventions of the LANGUAGE the file is in.
            3. Review the "CODE CHANGES" for security, performance and readability.
            4. Be CONCISE, and provide actionable feedback.
        `.trim()

        return prompt
    }

}
