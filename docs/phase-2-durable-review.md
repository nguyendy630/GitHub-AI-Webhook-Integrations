# Phase 2 — Durable Background Review Processing (Future Work)

This document describes a potential future architecture for making review processing more durable. The current implementation processes reviews inline (asynchronously after the 200 response) inside the same server process. That works, but has failure and observability trade-offs.

## Current Implementation

`server.js` responds `200 OK` to GitHub immediately, then calls `webhookHandler.handleEvent()` in the same process. If the server restarts mid-review, the job is lost silently. There is no retry mechanism.

## Proposed Durable Architecture

Move expensive review work into a separate, retryable job path.

### Components

**1. Review job queue or endpoint**

Options:
- A managed queue (BullMQ + Redis, Vercel Queues, etc.) that persists the job and retries on failure
- A separate internal HTTP endpoint (`POST /api/review-jobs`) that can be called by the webhook handler and retried independently

**2. Webhook handler change**

After verifying the signature and sending `200 OK`, dispatch to the queue/endpoint instead of calling `webhookHandler.handleEvent()` directly. Keep a fallback to the current inline path while migrating.

**3. Timeout guards**

Wrap long-running network calls in `Promise.race()` with a configurable timeout:

```js
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
}
```

Apply to `getPRFiles()`, `postPRComment()`, and the OpenAI call.

**4. Persistence for retries**

Persist incoming webhook payloads before dispatching so that failed jobs can be replayed.

### Rollout Strategy

1. Implement the job endpoint/queue alongside the existing inline flow
2. Route new traffic to the job path
3. Once the job path is stable, remove the inline call from `server.js`

### Testing

- Use ngrok (`npx ngrok http 3000`) or a staging deployment to receive real GitHub webhook deliveries
- Confirm `200 OK` is returned before the review completes
- Confirm the review job processes independently and posts the comment
- Simulate a failure mid-review and confirm the retry picks up correctly

## Why This Isn't Done Yet

The current inline-async approach is simple and sufficient for low-volume use. A durable queue adds operational complexity (Redis, queue infrastructure, dead-letter handling) that isn't justified until reliability at scale becomes a requirement.
