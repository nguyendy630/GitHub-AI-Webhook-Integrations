# GitHub AI Webhook Integration

A Node.js/Express webhook server that receives GitHub pull request events, analyzes changed files with AI, and posts a summary code review comment back to the PR.

## Setup

```bash
git clone https://github.com/nguyendy630/GitHub-AI-Webhook-Integrations.git .
npm install
```

Copy `.env.template` to `.env` and fill in the required values:

```
OPENAI_API_KEY=   # OpenAI key for AI reviews
GH_WEBHOOK=       # GitHub webhook secret (for HMAC signature verification)
GH_TOKEN=         # GitHub personal access token (for Octokit API calls)
```

## Running

```bash
npm run dev    # Start with nodemon (auto-reload)
npm run prod   # Start without nodemon
npm test       # Run all Jest tests
```

The server listens on port 3000 by default (`PORT` env var overrides this).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/webhooks` | GitHub webhook receiver |

## Architecture

```
src/
├── server.js              ← Express app; verifies webhook signature, responds 200, then processes async
├── services/
│   ├── aiReviewer.js      ← Filters files and calls OpenAI for per-file review
│   ├── diffParser.js      ← Parses unified diffs (added/deleted lines, language, functions, imports)
│   └── services.js        ← GithubService singleton; wraps Octokit REST API
├── webhooks/
│   ├── handler.js         ← WebhookHandler singleton; routes events and runs queueReview()
│   └── validator.js       ← Empty placeholder
└── utils/
    ├── commentFormatter.js ← Formats review array into a collapsible GitHub Markdown comment
    └── logger.js          ← Winston logger

tests/
├── diffParser_test/       ← Unit tests for each DiffParser method
└── utils_test/            ← Unit tests for commentFormatter
```

## Request Flow

1. GitHub sends `POST /api/webhooks`
2. `server.js` verifies the HMAC signature via `@octokit/webhooks` and responds `200 OK` immediately
3. Processing continues asynchronously — `webhookHandler.handleEvent()` is called after the response is sent
4. `handler.js` routes the event; only `pull_request` events with actions `opened`, `synchronize`, or `reopened` proceed
5. `queueReview()` fetches changed files via `services.getPRFiles()` and filters them with `aiReviewer.shouldReviewFile()`
6. Each file is analyzed with `diffParser.analyzeDiff()` and reviewed with `aiReviewer.reviewCode()` in parallel via `Promise.allSettled()`
7. Results are formatted by `commentFormatter.formatReviewsAsMarkdown()` and posted as a single PR comment via `services.postPRComment()`

## Local Webhook Testing

Use ngrok to expose the local server to GitHub:

```bash
npm run dev
npx ngrok http 3000
```

Point your GitHub repository webhook at the ngrok URL with path `/api/webhooks`.

## CI

`.github/workflows/ci.yaml` runs lint → test → security audit → build check on pushes to `master`/`main`/`feature/**` and on PRs targeting those branches.
