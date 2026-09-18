describe("validateRedisUrl", () => {
    let validateRedisUrl;

    beforeAll(() => {
        process.env.REDIS_URL = "redis://localhost:6379";
        ({ validateRedisUrl } = require("../../src/queue/redisConnection"));
    });

    it.each([
        ["redis://example.com", 6379, undefined],
        ["rediss://example.com", 6380, {}],
    ])("parses %s with the expected defaults", (value, port, tls) => {
        expect(validateRedisUrl(value)).toEqual({
            host: "example.com",
            port,
            ...(tls && { tls }),
        });
    });

    it("decodes URL-encoded credentials for ioredis", () => {
        expect(validateRedisUrl("redis://user%40name:p%40ss%2Fword@example.com")).toMatchObject({
            username: "user@name",
            password: "p@ss/word",
        });
    });

    it("keeps malformed encoded credentials when decoding fails", () => {
        expect(validateRedisUrl("redis://user:%E0%A4%A@example.com")).toMatchObject({
            username: "user",
            password: "%E0%A4%A",
        });
    });

    it.each([
        "http://example.com:6379",
        "redis:///",
        "redis://example.com:notaport",
        "redis://example.com:-1",
        "redis://example.com:0",
        "redis://example.com:65536",
    ])("rejects invalid URL %s", (value) => {
        expect(() => validateRedisUrl(value)).toThrow("Invalid REDIS_URL");
    });
});
