# AGENTS — Agent Guidance for this Repo

## Project Overview

A Node.js/Express webhook server that listens for GitHub PR events, analyzes code diffs with OpenAI, and posts an AI-generated code review comment back to the PR.

**Repo:** https://github.com/nguyendy630/GitHub-AI-Webhook-Integrations

---

## Tech Stack

- **Runtime:** Node.js (CommonJS — no `"type": "module"`)
- **Framework:** Express 5
- **AI:** OpenAI (Responses API)
- **GitHub API:** `@octokit/rest` + `@octokit/webhooks`
- **Job Queue:** BullMQ + Redis (review jobs)
- **Logging:** Winston
- **Local Dev:** nodemon + ngrok

---

## File Structure

```
GitHub-AI-Webhook-Integrations/
├── .github/
│   ├── labeler.yml
│   └── workflows/
│       ├── ci.yaml
│       └── pr-labeler.yaml
├── src/
│   ├── server.js              ← Express app; entry point
│   ├── services/
│   │   ├── aiReviewer.js      ← Filters files + calls OpenAI for per-file reviews
│   │   ├── diffParser.js      ← Parses unified diffs
│   │   └── services.js        ← GithubService singleton wrapping Octokit
│   ├── queue/
│   │   ├── reviewQueue.js     ← BullMQ Queue instance (producer); exports the queue
│   │   └── reviewWorker.js    ← BullMQ Worker (consumer); processes review jobs
│   ├── webhooks/
│   │   ├── handler.js         ← WebhookHandler singleton; event routing + queueReview()
│   │   └── validator.js       ← Empty placeholder (not yet implemented)
│   └── utils/
│       ├── commentFormatter.js ← Formats reviews into a GitHub Markdown comment
│       └── logger.js          ← Winston logger
├── tests/
│   ├── diffParser_test/       ← Unit tests for each DiffParser method
│   └── utils_test/            ← Unit tests for commentFormatter
├── .env                       ← OPENAI_API_KEY, GH_WEBHOOK, GH_TOKEN
├── .env.template
└── package.json
```

---

## Phase Status

### ✅ Phase 1 — Complete
- Webhook receiving + HMAC signature verification (`server.js` + `@octokit/webhooks`)
- Event routing — only `pull_request` with `opened`, `synchronize`, `reopened` proceed
- GitHub API service: `getPullRequest`, `getPRFiles`, `getPRDiff`, `getFileContent`
- Diff parsing: added/deleted lines, language detection, test file detection, new functions, import changes
- Winston logging throughout

### ✅ Phase 2 — Complete
- `aiReviewer.shouldReviewFile()` filters out lock files and unpatchable files
- `diffParser.analyzeDiff()` + `aiReviewer.reviewCode()` run in parallel per file via `Promise.allSettled()`
- Failed per-file reviews are isolated and logged; the pipeline continues

### ✅ Phase 3 — Complete
- `commentFormatter.formatReviewsAsMarkdown()` builds a collapsible Markdown summary
- `services.postPRComment()` posts the comment to the PR via GitHub Issues API
- If no issues are found (all files return severity `none`), no comment is posted

### ✅ Phase 4 — Job Queue (Redis + BullMQ)
- `handler.js` `queueReview()` enqueues a job to the BullMQ `pr-review` queue instead of running review inline
- Job payload: `{ owner, repo, prNumber }` — minimal identifiers; worker fetches everything it needs
- `src/queue/redisConnection.js` parses `REDIS_URL` into a connection-options object shared by Queue and Worker
- `src/queue/reviewQueue.js` creates and exports the BullMQ `Queue` instance; retry config: 3 attempts, exponential backoff at 5s
- `src/queue/reviewWorker.js` creates the BullMQ `Worker` (concurrency 2); each job runs the full review pipeline (fetch files → filter → analyzeDiff + reviewCode → formatReviews → postPRComment)
- Worker started alongside the Express server in `src/server.js` (same process); gracefully shut down via `worker.close()` on SIGINT/SIGTERM
- Redis connection config read from `REDIS_URL` env var; falls back to `redis://localhost:6379`
- Failed jobs are retried up to 3 times with exponential backoff; terminal failures are logged via `worker.on("failed")` and moved to the BullMQ failed set

---

## Key Conventions

- **CommonJS throughout** — no `"type": "module"`. Do not add ESM `import`/`export` syntax.
- **Singleton vs. class exports:**
  - `DiffParser` and `GithubService` export singleton instances (`module.exports = new X()`)
  - `AIReviewer` exports the class itself (`module.exports = AIReviewer`); instantiated by `handler.js`
  - `WebhookHandler` also exports a singleton
- **Octokit lazy init:** `@octokit/rest` is ESM and must be dynamically `import()`ed inside CJS. `getOctoKit()` in `services.js` handles this.
- **Async error isolation:** `server.js` sends `200` before processing begins. Any error during async processing must only be logged — a second `res.send()` will crash with headers-already-sent.
- **BullMQ queue/worker split:** `reviewQueue.js` only creates the `Queue` (producer); `reviewWorker.js` only creates the `Worker` (consumer). Never import the worker from handler code — that would start a second worker accidentally.
- **Redis connection:** both queue and worker must share the same Redis connection config from `REDIS_URL`. Create a shared `redisConnection` object (`{ host, port }` or a full `ioredis` instance) and pass it to both `Queue` and `Worker` constructors.
- **Job data is minimal:** store only the identifiers needed to reconstruct the work (`owner`, `repo`, `prNumber`). Do not serialize large objects (diffs, file contents) into the queue.
- **Logging:** use the Winston logger (`src/utils/logger.js`). Avoid `console.log` in `src/`.

---

## DiffParser Notes

- Export is a singleton instance — use `const diffParser = require('./services/diffParser')`. Do not destructure (`const { analyzeDiff } = ...`) as it loses the `this` context.
- All methods are bound in the constructor, so passing them as callbacks is safe.
- `analyzeDiff(patch, filename)` is the main entry point.
- Hunk header parsing is sensitive to `@@ -a,b +c,d @@` coordinates — be careful which side you read for old vs new file line numbers.

---

## Known Incomplete Areas

<!-- - `src/webhooks/validator.js` — empty placeholder, not yet implemented. -->
- `src/services/services.js` `postInLineComment()` — stub, not implemented.
---

## How to Run Tests

```bash
npm install
npm test                                                        # all tests
npx jest tests/diffParser_test/getAddedLines.test.js           # single file
```

---

## Agent Behavior Guidance

- Keep changes small and targeted.
- When editing `diffParser.js`, update or add focused unit tests in `tests/diffParser_test/`.
- If modifying exports or method signatures, update callers (`handler.js`) and tests.
- Log and warn rather than throw for non-critical failures to keep the webhook pipeline resilient.
- Do not add `async` error handling that sends a response after `200 OK` has already been sent.
- When working on Phase 4 queue code, always test with a local Redis instance (`redis-server` or Docker `redis:alpine`). Do not mock Redis in integration tests for the queue — use a real connection on a separate test DB index.
- BullMQ workers must be gracefully shut down (`worker.close()`) on `SIGTERM`/`SIGINT` so in-flight jobs finish before the process exits.
