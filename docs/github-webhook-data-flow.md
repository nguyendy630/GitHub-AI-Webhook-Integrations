# GitHub to Vercel Data Flow

This document shows how a pull request event moves from GitHub into Vercel and through the review pipeline in this repository.

## High-Level Flow

```text
GitHub Pull Request event
  -> Vercel webhook endpoint
  -> signature verification
  -> immediate HTTP response to GitHub
  -> review job dispatch
  -> review job endpoint
  -> fetch PR files from GitHub API
  -> filter files for review
  -> parse diff and run AI review
  -> format summary comment
  -> post comment back to GitHub
```

## Step-by-Step Flow

### 1. GitHub sends the webhook

When a pull request is opened, reopened, or synchronized, GitHub sends a `pull_request` webhook payload to the Vercel app.

Payload data used by this repo includes:
- PR number
- repository owner and name
- PR title
- base branch
- head branch
- changed file count
- pull request URL

### 2. Vercel receives the request

The request lands in [api/webhooks.js](../api/webhooks.js).

That handler:
- reads the GitHub signature headers
- verifies the request body with `GH_WEBHOOK`
- returns `200 OK` quickly so GitHub does not wait on the review work

### 3. The webhook payload is handed off

After verification, the webhook handler sends the PR metadata to the separate review job endpoint instead of doing the review work inline.

That handoff uses [src/services/reviewDispatcher.js](../src/services/reviewDispatcher.js).

### 4. The review job endpoint processes the payload

The separate worker-style endpoint lives in [api/review-jobs.js](../api/review-jobs.js).

It receives the PR data and calls the main review orchestration in [src/webhooks/handler.js](../src/webhooks/handler.js).

### 5. GitHub file data is fetched

The review flow calls `getPRFiles()` from [src/services/services.js](../src/services/services.js).

This step uses the GitHub API to fetch the list of changed files and their patches.

### 6. Files are filtered for review

The file list is passed through `aiReviewer.shouldReviewFile()` in [src/services/aiReviewer.js](../src/services/aiReviewer.js).

This skips files that should not be reviewed, such as lock files or files without a usable patch.

### 7. Each file is analyzed and reviewed

For each file that remains:
- the diff is analyzed with `diffParser.analyzeDiff()`
- the file and analysis are sent to OpenAI through `aiReviewer.reviewCode()`

### 8. Reviews are formatted into a GitHub comment

The collected review results are converted into Markdown with [src/utils/commentFormatter.js](../src/utils/commentFormatter.js).

### 9. The summary comment is posted back to GitHub

The final comment is sent to the pull request using the GitHub API through `postPRComment()` in [src/services/services.js](../src/services/services.js).

## Why the split exists

The webhook endpoint only handles ingress and verification. The expensive review work happens after handoff so the GitHub delivery does not depend on the full review pipeline completing inside the webhook request lifecycle.

## Environment variables involved

- `GH_WEBHOOK` for webhook signature verification
- `GH_TOKEN` for GitHub API access
- `OPENAI_API_KEY` for AI review generation
- `APP_BASE_URL` or `VERCEL_URL` for dispatching the review job

## Short version

GitHub sends the event to Vercel, Vercel verifies it, the webhook hands off the work to a separate review endpoint, the endpoint fetches and reviews the PR files, and the review summary is posted back to GitHub.