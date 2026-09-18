const originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "test-key";

const AIReviewer = require("../../src/services/aiReviewer");

afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
});

describe("AIReviewer.parseReview", () => {
    let reviewer;

    beforeEach(() => {
        reviewer = new AIReviewer();
    });

    it("marks a high severity review as not approved even with no suggestions", () => {
        const raw = JSON.stringify({
            severity: "high",
            summary: "Introduces a SQL injection vulnerability",
            suggestions: [],
            securityFlags: ["SQL injection"],
        });

        const result = reviewer.parseReview(raw, "src/db.js");

        expect(result.approved).toBe(false);
    });

    it("marks a high severity review as not approved when suggestions are missing entirely", () => {
        const raw = JSON.stringify({
            severity: "high",
            summary: "Introduces a SQL injection vulnerability",
        });

        const result = reviewer.parseReview(raw, "src/db.js");

        expect(result.approved).toBe(false);
        expect(result.suggestions).toEqual([]);
    });

    it("approves a low severity review with only non-blocking suggestions", () => {
        const raw = JSON.stringify({
            severity: "low",
            summary: "Minor style nit",
            suggestions: [{ text: "Use const instead of let", blocking: false }],
        });

        const result = reviewer.parseReview(raw, "src/utils.js");

        expect(result.approved).toBe(true);
    });

    it("does not approve when any suggestion is marked blocking, regardless of severity", () => {
        const raw = JSON.stringify({
            severity: "medium",
            summary: "Missing test coverage",
            suggestions: [{ text: "Add a test for the empty-input case", blocking: true }],
        });

        const result = reviewer.parseReview(raw, "src/parser.js");

        expect(result.approved).toBe(false);
    });

    it("drops malformed suggestion entries instead of trusting them", () => {
        const raw = JSON.stringify({
            severity: "medium",
            summary: "Mixed suggestion quality",
            suggestions: [
                { text: "Valid suggestion", blocking: true },
                { text: "Missing blocking flag" },
                "a bare string suggestion",
                null,
            ],
        });

        const result = reviewer.parseReview(raw, "src/mixed.js");

        expect(result.suggestions).toEqual([{ text: "Valid suggestion", blocking: true }]);
        expect(result.approved).toBe(false);
    });

    it("falls back to a safe unapproved review on invalid JSON", () => {
        const result = reviewer.parseReview("not json", "src/broken.js");

        expect(result.severity).toBe("none");
        expect(result.approved).toBe(false);
    });

    it("falls back to a safe unapproved review when required fields are missing", () => {
        const raw = JSON.stringify({ summary: "No severity field" });

        const result = reviewer.parseReview(raw, "src/incomplete.js");

        expect(result.severity).toBe("none");
        expect(result.approved).toBe(false);
    });
});
