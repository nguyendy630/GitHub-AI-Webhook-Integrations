const mockRoutes = {};
const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn((path, handler) => { mockRoutes[path] = handler; }),
    listen: jest.fn(() => ({ close: jest.fn() })),
};
const mockVerify = jest.fn();
const mockHandleEvent = jest.fn();

jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("express", () => {
    const express = jest.fn(() => mockApp);
    express.json = jest.fn(() => jest.fn());
    return express;
});
jest.mock("@octokit/webhooks", () => ({
    Webhooks: jest.fn().mockImplementation(() => ({ verify: mockVerify })),
}));
jest.mock("../../src/webhooks/handler", () => ({ handleEvent: mockHandleEvent }));
jest.mock("../../src/queue/reviewWorker", () => ({ close: jest.fn() }));
jest.mock("../../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

describe("webhook endpoint", () => {
    let processOnSpy;

    beforeAll(() => {
        processOnSpy = jest.spyOn(process, "on").mockImplementation(() => process);
        require("../../src/server");
    });

    afterAll(() => {
        processOnSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockVerify.mockResolvedValue(true);
    });

    it("finishes the request handler without waiting for asynchronous event handling", async () => {
        let finishHandling;
        mockHandleEvent.mockReturnValue(new Promise(resolve => { finishHandling = resolve; }));
        const req = {
            headers: {
                "x-hub-signature-256": "sha256=valid",
                "x-github-event": "pull_request",
                "x-github-delivery": "delivery-1",
            },
            rawBody: "{}",
            body: {},
        };
        const res = {
            headersSent: false,
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        let routeFinished = false;
        const routePromise = mockRoutes["/api/webhooks"](req, res).then(() => { routeFinished = true; });
        await new Promise(resolve => setImmediate(resolve));

        expect(res.status).toHaveBeenCalledWith(200);
        expect(routeFinished).toBe(true);

        finishHandling();
        await routePromise;
    });
});
