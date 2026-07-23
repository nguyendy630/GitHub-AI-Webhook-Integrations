const mockWorkerConstructor = jest.fn();
const mockGetPRFiles = jest.fn();
const mockPostPRComment = jest.fn();
const mockAnalyzeDiff = jest.fn();
const mockShouldReviewFile = jest.fn();
const mockReviewCode = jest.fn();
const mockFormatReviewsAsMarkdown = jest.fn();

jest.mock("bullmq", () => ({
    Worker: function Worker(...args) {
        mockWorkerConstructor(...args);
        return { on: jest.fn() };
    },
}));
jest.mock("../../src/queue/redisConnection", () => ({ connection: { host: "localhost", port: 6379 } }));
jest.mock("../../src/services/services", () => ({ getPRFiles: mockGetPRFiles, postPRComment: mockPostPRComment }));
jest.mock("../../src/services/diffParser", () => ({ analyzeDiff: mockAnalyzeDiff }));
jest.mock("../../src/services/aiReviewer", () => jest.fn().mockImplementation(() => ({
    shouldReviewFile: mockShouldReviewFile,
    reviewCode: mockReviewCode,
})));
jest.mock("../../src/utils/commentFormatter", () => ({ formatReviewsAsMarkdown: mockFormatReviewsAsMarkdown }));
jest.mock("../../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

describe("reviewWorker", () => {
    let processReview;
    let workerOptions;

    beforeAll(() => {
        const worker = require("../../src/queue/reviewWorker");
        processReview = worker.processReview;
        workerOptions = mockWorkerConstructor.mock.calls[0][2];
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockShouldReviewFile.mockReturnValue(true);
        mockAnalyzeDiff.mockReturnValue({});
    });

    it("configures concurrency and rate limiting on the Worker", () => {
        expect(workerOptions).toMatchObject({
            connection: { host: "localhost", port: 6379 },
            concurrency: 2,
            limiter: { max: 100, duration: 60000 },
        });
    });

    it("rejects invalid job data before calling GitHub", async () => {
        await expect(processReview({ id: "1", data: { owner: "me" } })).rejects.toThrow("Invalid review job data");
        expect(mockGetPRFiles).not.toHaveBeenCalled();
    });

    it("does not post when no valid files are selected", async () => {
        mockGetPRFiles.mockResolvedValue([{ filename: "missing-patch.js", additions: 1 }]);

        await processReview({ id: "1", data: { owner: "me", repo: "project", prNumber: 2 } });

        expect(mockShouldReviewFile).not.toHaveBeenCalled();
        expect(mockPostPRComment).not.toHaveBeenCalled();
    });

    it("posts successful reviews and reports per-file failures", async () => {
        const files = [
            { filename: "good.js", patch: "+ok", additions: 1 },
            { filename: "bad.js", patch: "+bad", additions: 1 },
        ];
        mockGetPRFiles.mockResolvedValue(files);
        mockReviewCode
            .mockResolvedValueOnce({ filename: "good.js", severity: "high" })
            .mockRejectedValueOnce(new Error("AI unavailable"));
        mockFormatReviewsAsMarkdown.mockReturnValue("review body");

        await processReview({ id: "1", data: { owner: "me", repo: "project", prNumber: 2 } });

        expect(mockFormatReviewsAsMarkdown).toHaveBeenCalledWith([{ filename: "good.js", severity: "high" }]);
        expect(mockPostPRComment).toHaveBeenCalledWith(
            "me",
            "project",
            2,
            expect.stringContaining("1 file(s) could not be reviewed"),
        );
    });

    it("does not post when formatting is empty and no file failed", async () => {
        mockGetPRFiles.mockResolvedValue([{ filename: "good.js", patch: "+ok", additions: 1 }]);
        mockReviewCode.mockResolvedValue({ filename: "good.js", severity: "none" });
        mockFormatReviewsAsMarkdown.mockReturnValue("");

        await processReview({ id: "1", data: { owner: "me", repo: "project", prNumber: 2 } });

        expect(mockPostPRComment).not.toHaveBeenCalled();
    });

    it("reports AI fallback reviews as failures", async () => {
        mockGetPRFiles.mockResolvedValue([{ filename: "failed.js", patch: "+ok", additions: 1 }]);
        mockReviewCode.mockResolvedValue({
            filename: "failed.js",
            severity: "none",
            reviewFailed: true,
        });
        mockFormatReviewsAsMarkdown.mockReturnValue("");

        await processReview({ id: "1", data: { owner: "me", repo: "project", prNumber: 2 } });

        expect(mockFormatReviewsAsMarkdown).toHaveBeenCalledWith([]);
        expect(mockPostPRComment).toHaveBeenCalledWith(
            "me",
            "project",
            2,
            expect.stringContaining("1 file(s) could not be reviewed"),
        );
    });

    it("caps comments below GitHub's maximum body size", async () => {
        mockGetPRFiles.mockResolvedValue([{ filename: "large.js", patch: "+ok", additions: 1 }]);
        mockReviewCode.mockResolvedValue({ filename: "large.js", severity: "high" });
        mockFormatReviewsAsMarkdown.mockReturnValue("x".repeat(70000));

        await processReview({ id: "1", data: { owner: "me", repo: "project", prNumber: 2 } });

        const postedBody = mockPostPRComment.mock.calls[0][3];
        expect(postedBody.length).toBeLessThanOrEqual(60000);
        expect(postedBody).toContain("Review truncated");
    });
});
