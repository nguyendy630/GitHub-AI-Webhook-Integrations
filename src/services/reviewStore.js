const { neon } = require("@neondatabase/serverless");
const logger = require("../utils/logger");

const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3 };

let sql = null;
function getSql() {
    if (!sql) {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL is required to record reviews.");
        }
        sql = neon(process.env.DATABASE_URL);
    }
    return sql;
}

async function ensureSchema() {
    const db = getSql();
    await db`
        CREATE TABLE IF NOT EXISTS pr_reviews (
            id BIGSERIAL PRIMARY KEY,
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            pr_number INTEGER NOT NULL,
            severity TEXT NOT NULL,
            approved BOOLEAN NOT NULL,
            issue_count INTEGER NOT NULL DEFAULT 0,
            security_flag_count INTEGER NOT NULL DEFAULT 0,
            reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;
    await db`
        CREATE INDEX IF NOT EXISTS pr_reviews_owner_idx ON pr_reviews (owner)
    `;
}

function worstSeverity(reviews) {
    return reviews.reduce((worst, review) => {
        const rank = SEVERITY_RANK[review.severity] ?? 0;
        return rank > SEVERITY_RANK[worst] ? review.severity : worst;
    }, "none");
}

/**
 * Persists a summary row for one completed PR review pass.
 * @param {{owner: string, repo: string, prNumber: number}} job
 * @param {object[]} reviews - per-file review results from AIReviewer.reviewCode
 */
async function recordReview(job, reviews) {
    const { owner, repo, prNumber } = job;
    const severity = worstSeverity(reviews);
    const approved = reviews.every(review => review.approved !== false);
    const issueCount = reviews.reduce((sum, review) => sum + (review.suggestions?.length || 0), 0);
    const securityFlagCount = reviews.reduce((sum, review) => sum + (review.securityFlags?.length || 0), 0);

    const db = getSql();
    await db`
        INSERT INTO pr_reviews (owner, repo, pr_number, severity, approved, issue_count, security_flag_count)
        VALUES (${owner}, ${repo}, ${prNumber}, ${severity}, ${approved}, ${issueCount}, ${securityFlagCount})
    `;

    logger.info("Review recorded", { owner, repo, prNumber, severity, approved, issueCount, securityFlagCount });
}

async function getStats(owner) {
    const db = getSql();
    const rows = await db.query(
        `SELECT
            COUNT(*)::int AS total_reviews,
            COUNT(*) FILTER (WHERE approved)::int AS approved_count,
            COALESCE(AVG(issue_count), 0)::float AS avg_issue_count,
            COALESCE(SUM(security_flag_count), 0)::int AS security_flag_count
        FROM pr_reviews
        ${owner ? "WHERE owner = $1" : ""}`,
        owner ? [owner] : []
    );

    const row = rows[0];
    return {
        totalReviews: row.total_reviews,
        approvalRate: row.total_reviews > 0 ? row.approved_count / row.total_reviews : 0,
        avgIssueCount: row.avg_issue_count,
        securityFlagCount: row.security_flag_count,
    };
}

async function listReviews({ owner, limit = 50, offset = 0 } = {}) {
    const db = getSql();
    const params = owner ? [owner, limit, offset] : [limit, offset];
    const rows = await db.query(
        `SELECT owner, repo, pr_number, severity, approved, issue_count, security_flag_count, reviewed_at
        FROM pr_reviews
        ${owner ? "WHERE owner = $1" : ""}
        ORDER BY reviewed_at DESC LIMIT $${owner ? 2 : 1} OFFSET $${owner ? 3 : 2}`,
        params
    );

    return rows.map(row => ({
        owner: row.owner,
        repo: row.repo,
        prNumber: row.pr_number,
        severity: row.severity,
        approved: row.approved,
        issueCount: row.issue_count,
        securityFlagCount: row.security_flag_count,
        reviewedAt: row.reviewed_at,
    }));
}

async function listOwners() {
    const db = getSql();
    const rows = await db`SELECT DISTINCT owner FROM pr_reviews ORDER BY owner`;
    return rows.map(row => row.owner);
}

module.exports = {
    ensureSchema,
    recordReview,
    getStats,
    listReviews,
    listOwners,
};
