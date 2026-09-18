const mockAdd = jest.fn();
const mockError = jest.fn();

jest.mock("../../src/queue/reviewQueue", () => ({ add: mockAdd }));
jest.mock("../../src/utils/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: mockError,
}));

describe("WebhookHandler.queueReview", () => {
    const handler = require("../../src/webhooks/handler");
    const prInfo = { number: 42, repoName: "repo", repoOwner: "owner" };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("enqueues the complete worker payload", async () => {
        mockAdd.mockResolvedValue({ id: "job-1" });
        await handler.queueReview(prInfo);
        expect(mockAdd).toHaveBeenCalledWith("review", {
            owner: "owner",
            repo: "repo",
            prNumber: 42,
        });
    });

    it("logs queue failures with context and rethrows", async () => {
        const failure = new Error("Redis unavailable");
        mockAdd.mockRejectedValue(failure);

        await expect(handler.queueReview(prInfo)).rejects.toBe(failure);
        expect(mockError).toHaveBeenCalledWith("Failed to enqueue PR review job", {
            owner: "owner",
            repo: "repo",
            prNumber: 42,
            error: failure,
        });
    });
});
