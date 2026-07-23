const AIReviewer = require("../../src/services/aiReviewer");

describe("AIReviewer fallback", () => {
    it("marks reviews that could not be generated as failed", () => {
        const review = AIReviewer.prototype._fallbackReview("src/app.js");

        expect(review).toMatchObject({
            filename: "src/app.js",
            severity: "none",
            reviewFailed: true,
        });
    });
});
