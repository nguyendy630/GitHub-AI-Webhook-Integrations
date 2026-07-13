const { formatReviewsAsMarkdown } = require("../../src/utils/commentFormatter");

describe("commentFormatter", () => {
    describe("formatReviewsAsMarkdown", () => {
        it("should return empty string when no reviews provided", () => {
            const result = formatReviewsAsMarkdown([]);
            expect(result).toBe("");
        });

        it("should return empty string when all reviews have severity 'none'", () => {
            const reviews = [
                {
                    filename: "src/app.js",
                    severity: "none",
                    summary: "All good",
                    suggestions: [],
                    securityFlags: [],
                    approved: true,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).toBe("");
        });

        it("should format reviews with issues into markdown with collapsible details", () => {
            const reviews = [
                {
                    filename: "src/auth.js",
                    severity: "high",
                    summary: "Security vulnerability detected",
                    suggestions: [
                        "Use bcrypt for password hashing",
                        "Add input validation",
                    ],
                    securityFlags: [
                        "Hardcoded credentials",
                        "SQL injection risk",
                    ],
                    approved: false,
                },
                {
                    filename: "src/utils.js",
                    severity: "low",
                    summary: "Minor code style issue",
                    suggestions: ["Use const instead of var"],
                    securityFlags: [],
                    approved: true,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);

            // Check for expected structure and content
            expect(result).toContain("## AI Code Review");
            expect(result).toContain("Found **2** file(s) with issues:");
            expect(result).toContain("src/auth.js");
            expect(result).toContain("src/utils.js");
            expect(result).toContain("Security vulnerability detected");
            expect(result).toContain("Minor code style issue");
            expect(result).toContain("<details>");
            expect(result).toContain("</details>");
            expect(result).toContain("**Suggestions:**");
        });

        it("should filter out files with severity 'none'", () => {
            const reviews = [
                {
                    filename: "src/good.js",
                    severity: "none",
                    summary: "Approved",
                    suggestions: [],
                    securityFlags: [],
                    approved: true,
                },
                {
                    filename: "src/bad.js",
                    severity: "medium",
                    summary: "Has issues",
                    suggestions: ["Fix this"],
                    securityFlags: [],
                    approved: false,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);

            expect(result).toContain("src/bad.js");
            expect(result).not.toContain("src/good.js");
            expect(result).toContain("Found **1** file(s) with issues:");
        });

        it("should indicate rejection when approved is false", () => {
            const reviews = [
                {
                    filename: "src/test.js",
                    severity: "high",
                    summary: "Critical issue",
                    suggestions: [],
                    securityFlags: [],
                    approved: false,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).toContain("Rejected");
        });

        it("should indicate approval when approved is true", () => {
            const reviews = [
                {
                    filename: "src/test.js",
                    severity: "low",
                    summary: "Minor issue",
                    suggestions: [],
                    securityFlags: [],
                    approved: true,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).toContain("Approved");
        });

        it("should omit suggestions section if empty", () => {
            const reviews = [
                {
                    filename: "src/test.js",
                    severity: "medium",
                    summary: "Issue found",
                    suggestions: [],
                    securityFlags: ["Some flag"],
                    approved: false,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).not.toContain("**Suggestions:**");
        });

        it("should handle null reviews gracefully", () => {
            const result = formatReviewsAsMarkdown(null);
            expect(result).toBe("");
        });

        it("should handle reviews without optional fields", () => {
            const reviews = [
                {
                    filename: "src/test.js",
                    severity: "high",
                    summary: "Issue",
                    approved: false,
                    // Missing suggestions and securityFlags
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).toContain("src/test.js");
            expect(result).toContain("Issue");
            expect(result).not.toContain("**Suggestions:**");
            expect(result).not.toContain("**Security Flags:**");
        });

        it("should render the patch as a markdown code block when present", () => {
            const reviews = [
                {
                    filename: "src/test.js",
                    severity: "medium",
                    summary: "Issue found",
                    patch: "const x = 1;",
                    suggestions: [],
                    securityFlags: [],
                    approved: true,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).toContain("**Relevant Code:**");
            expect(result).toContain("```\nconst x = 1;\n```");
        });

        it("should omit the relevant code section if patch is absent", () => {
            const reviews = [
                {
                    filename: "src/test.js",
                    severity: "medium",
                    summary: "Issue found",
                    suggestions: [],
                    securityFlags: [],
                    approved: true,
                },
            ];
            const result = formatReviewsAsMarkdown(reviews);
            expect(result).not.toContain("**Relevant Code:**");
        });
    });
});
