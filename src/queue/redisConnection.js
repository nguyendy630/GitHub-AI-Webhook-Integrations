const logger = require("../utils/logger");

try {
    // Parse the Redis connection URL.
    // Falls back to a local Redis instance if REDIS_URL is not set.
    const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");

    // Ensure a hostname is present (e.g. "localhost" or "redis.example.com").
    if (!url.hostname) {
        throw new Error("Invalid REDIS_URL: Hostname is required.");
    }

    let port;

    if (url.port) {
        // If a port is explicitly provided, validate it.
        port = Number(url.port);

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error("Invalid REDIS_URL: Port must be between 1 and 65535.");
        }
    } else {
        // No port was provided, so use the default based on the protocol.
        // - redis://  -> 6379
        // - rediss:// -> 6380
        port = url.protocol === "rediss:" ? 6380 : 6379;
    }

    module.exports = {
        // Redis server hostname.
        host: url.hostname,

        // Redis server port (either provided or defaulted).
        port,

        // Indicates whether a secure (TLS) connection should be used.
        tls: url.protocol === "rediss:",

        // Include the username only if one was specified.
        ...(url.username && {
            username: decodeURIComponent(url.username),
        }),

        // Include the password only if one was specified.
        ...(url.password && {
            password: decodeURIComponent(url.password),
        }),
    };
} catch (error) {
    // Log any parsing or validation errors.
    logger.error("Invalid REDIS_URL:", error);
}