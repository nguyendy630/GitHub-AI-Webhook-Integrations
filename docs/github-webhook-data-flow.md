# GitHub Webhook Data Flow

This document describes how a pull request event moves from GitHub through the server and into the review pipeline.

## High-Level Flow

```text
GitHub Pull Request event
  → POST /api/webhooks (server.js)
  → HMAC signature verification
  → 200 OK sent to GitHub immediately
  → webhookHandler.handleEvent() called asynchronously
  → handlePullRequest() — filters to relevant actions
  → queueReview() — fetches files, filters, reviews, posts comment
  → getPRFiles() via GitHub API
  → aiReviewer.shouldReviewFile() — filters files
  → parallel: diffParser.analyzeDiff() + aiReviewer.reviewCode() per file
  → commentFormatter.formatReviewsAsMarkdown()
  → postPRComment() via GitHub API
```

## Step-by-Step

### 1. GitHub sends the webhook

When a PR is opened, reopened, or synchronized, GitHub sends a `POST` to `/api/webhooks` with a `pull_request` event payload and an HMAC signature in the `x-hub-signature-256` header.

Payload data used downstream:
- `pull_request.number`
- `pull_request.title`
- `pull_request.body`
- `repository.name`
- `repository.owner.login`

### 2. `server.js` verifies the signature and responds

[`src/server.js`](../src/server.js) reads the raw request body (captured via `express.json`'s `verify` callback) and calls `webhooks.verify()` from `@octokit/webhooks`.

If verification passes, it sends `200 OK` to GitHub immediately so GitHub does not time out waiting on the review work.

### 3. Processing continues asynchronously

After the response is sent, `server.js` calls `webhookHandler.handleEvent(event, req.body)` in a try/catch. Any error here is only logged — a second response would cause a headers-already-sent crash.

### 4. `handler.js` routes the event

[`src/webhooks/handler.js`](../src/webhooks/handler.js) (`WebhookHandler` singleton) dispatches on event type. Only `pull_request` events with actions `opened`, `synchronize`, or `reopened` proceed to `queueReview()`. Other event types (`push`, `ping`, `pull_request_review`) are logged and counted but not processed further.

### 5. `queueReview()` fetches and filters files

`queueReview()` calls `services.getPRFiles()` from [`src/services/services.js`](../src/services/services.js), which uses the Octokit REST API to list changed files and their unified diff patches.

The file list is then filtered with `aiReviewer.shouldReviewFile()`, which skips lock files, binary files, and files without a usable patch.

### 6. Each file is analyzed and reviewed in parallel

For each file that passes the filter, two operations run:

1. `diffParser.analyzeDiff(file.patch, file.filename)` — parses the unified diff to extract added lines, deleted lines, detected language, new function signatures, import changes, and whether the file is a test file.
2. `aiReviewer.reviewCode(file, analysis)` — sends the file patch and analysis to OpenAI and returns structured JSON: `{ filename, severity, summary, suggestions[], securityFlags[], approved }`.

Both run per-file in parallel via `Promise.allSettled()`. A failure on one file does not block the rest.

### 7. Reviews are formatted

Fulfilled results are passed to `commentFormatter.formatReviewsAsMarkdown()` in [`src/utils/commentFormatter.js`](../src/utils/commentFormatter.js), which builds a collapsible GitHub Markdown comment. If all files returned severity `none`, an empty string is returned and no comment is posted.

### 8. The summary comment is posted back to GitHub

`services.postPRComment()` calls the GitHub Issues API (`octokit.issues.createComment`) to post the formatted comment on the PR.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GH_WEBHOOK` | Webhook secret for HMAC signature verification |
| `GH_TOKEN` | GitHub personal access token for Octokit API calls |
| `OPENAI_API_KEY` | OpenAI key for AI review generation |

## Why async after 200?

GitHub expects a webhook response within 10 seconds. The full review pipeline — fetching files, running OpenAI per file, posting a comment — can take longer. Sending `200 OK` first and processing afterward keeps GitHub happy and avoids delivery retries.
