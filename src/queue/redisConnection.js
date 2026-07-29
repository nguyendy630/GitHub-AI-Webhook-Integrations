const logger = require("../utils/logger");
const ALLOWED_PROTOCOLS = new Set(["redis:", "rediss:"]);

function safeDecode(str) {
    try { return decodeURIComponent(str); }

    catch {
        logger.warn("Failed to decode URL component. Using raw value instead.");
        return str;
    }
}

function validateRedisUrl(value) {
    let url;

    try {
        url = value instanceof URL ? value : new URL(value);
    } catch {
        throw new Error("Invalid REDIS_URL: URL could not be parsed.");
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
        throw new Error(`Invalid REDIS_URL: Unsupported protocol "${url.protocol}".`);
    }

    if (!url.hostname) {
        throw new Error("Invalid REDIS_URL: Hostname is required.");
    }

    let port;

    if (url.port) {
        port = Number(url.port);

        if (isNaN(port)) {
            throw new Error("Invalid REDIS_URL: Port must be a number.");
        }

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error("Invalid REDIS_URL: Port must be between 1 and 65535.");
        }
    } else {
        port = url.protocol === "rediss:" ? 6380 : 6379;
    }

    return {
        host: url.hostname,
        port,
        ...(url.protocol === "rediss:" && { tls: {} }),
        ...(url.username !== "" && { username: safeDecode(url.username) }),
        ...(url.password !== "" && { password: safeDecode(url.password) }),
    };
}

try {
    const connection = validateRedisUrl(process.env.REDIS_URL || "redis://localhost:6379");
    module.exports = { connection, validateRedisUrl };

} catch (error) {
    logger.error("Invalid REDIS_URL configuration", { error });
    throw error;
}
