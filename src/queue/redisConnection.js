const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");

module.exports = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
};
