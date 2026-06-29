const logger = require("../utils/logger");

const ALLOWED_PROTOCOLS = new Set(["redis:", "rediss:"]);

function safeDecode(str) {
    try { return decodeURIComponent(str); }
    catch { return str; }
}

try {
    const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
        throw new Error(`Invalid REDIS_URL: Unsupported protocol "${url.protocol}".`);
    }

    if (!url.hostname) {
        throw new Error("Invalid REDIS_URL: Hostname is required.");
    }

    let port;

    if (url.port) {
        port = Number(url.port);

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error("Invalid REDIS_URL: Port must be between 1 and 65535.");
        }
    } else {
        port = url.protocol === "rediss:" ? 6380 : 6379;
    }

    module.exports = {
        host: url.hostname,
        port,
        tls: url.protocol === "rediss:",
        ...(url.username && { username: safeDecode(url.username) }),
        ...(url.password && { password: safeDecode(url.password) }),
    };
} catch (error) {
    logger.error("Invalid REDIS_URL: " + error.message);
    throw error;
}