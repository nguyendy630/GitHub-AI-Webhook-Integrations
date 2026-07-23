const mockQueueConstructor = jest.fn();

jest.mock("bullmq", () => ({
    Queue: function Queue(...args) {
        mockQueueConstructor(...args);
        return { name: args[0], opts: args[1] };
    },
}));

jest.mock("../../src/queue/redisConnection", () => ({
    connection: { host: "localhost", port: 6379 },
}));

describe("reviewQueue", () => {
    beforeEach(() => {
        jest.resetModules();
        mockQueueConstructor.mockClear();
    });

    it("creates the queue with retry defaults and only valid Queue options", () => {
        const queue = require("../../src/queue/reviewQueue");
        const [name, options] = mockQueueConstructor.mock.calls[0];

        expect(queue.name).toBe("pr-review");
        expect(name).toBe("pr-review");
        expect(options.connection).toEqual({ host: "localhost", port: 6379 });
        expect(options.defaultJobOptions).toEqual({
            removeOnComplete: 1000,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
        });
        expect(options).not.toHaveProperty("timeout");
        expect(options).not.toHaveProperty("limiter");
        expect(options).not.toHaveProperty("concurrency");
    });

    it("fails fast when the Redis connection is missing", () => {
        jest.resetModules();
        jest.doMock("../../src/queue/redisConnection", () => ({ connection: null }));

        expect(() => require("../../src/queue/reviewQueue")).toThrow(
            "Redis connection must include a valid host and port.",
        );
    });
});
