# Phase 2 — Durable Background Review Processing

Goal: move expensive review work out of the webhook invocation into a durable background path (endpoint, queue, or worker) so serverless lifecycle does not cause hangs or lost work.

Overview
- Keep `POST /api/webhooks` as a fast verify-and-ack endpoint.
- Hand off job to a separate durable processor that owns `getPRFiles()`, diff analysis, AI review, and posting the summary comment.

Steps

1) Create `api/review-jobs.js` (Review Job Endpoint)
- Purpose: receive POST requests with PR metadata and run the review flow.
- Implementation sketch:
  - Validate incoming payload and HMAC (optional if already validated by webhook)
  - Call `const webhookHandler = require('../src/webhooks/handler'); await webhookHandler.handleEvent(event, payload);
- Deployment: Vercel serverless route.

2) Add `src/services/reviewDispatcher.js` (optional)
- Purpose: centralize job dispatch logic (POST to `/api/review-jobs` or enqueue to queue).
- When used by `api/webhooks.js`, this keeps the webhook code simple and testable.
- Implementation sketch:
  - Export `dispatchReviewJob(prInfo)` which POSTs to `${APP_BASE_URL}/api/review-jobs` or writes to persistence.

3) Update `api/webhooks.js` to dispatch jobs (and remove `setImmediate()`)
- After verifying signature and responding `200 OK`, call the dispatcher asynchronously (non-blocking):
  - `await dispatchReviewJob(prInfo)` OR `fetch(...)` in a try/catch with no await (best-effort)
- Keep a temporary fallback to `setImmediate()` only while migrating.

4) Implement `api/review-jobs.js` to invoke the handler
- This route should be authoritative and have full execution budget to run `webhookHandler.handleEvent()`.
- Add logging and error handling. If job fails, return a 5xx to enable retries if called directly, or record the failure for retry if enqueued.

5) Add timeouts and fail-fast guards in `src/services/services.js` and OpenAI calls
- Wrap network calls in a `Promise.race()` with a configurable timeout (e.g., 10s):
```js
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}
```
- Use for `getPRFiles()`, `postPRComment()`, and the OpenAI request.

6) Optional: Add persistence or a queue for retries (S3, Redis, or managed queue)
- Persist incoming webhook payloads before dispatching so you can retry failed jobs.
- Worker(s) consume the queue and run `webhookHandler.handleEvent()`.

7) Update docs and agent guidance
- `AGENTS.md` and `README.md` should describe the new durable flow and the reasons it was added.
- Add test/integration instructions.

8) Deploy and test
- Deploy to Vercel (or staging) and run an end-to-end PR:
  - Confirm webhook `200 OK` returned quickly
  - Confirm review job accepted and processed independently
  - Verify `getPRFiles()` completes and reviews are posted

Testing tips
- Use `ngrok` or Vercel preview deployments for webhook delivery. Example local dev flow:
  - `npm run dev` (local server)
  - `npx ngrok http 3000` (create public URL)
  - Configure GitHub webhook to use the ngrok URL
- Add logs around job dispatch and review processor to verify handoff.

Rollout strategy
- Implement `api/review-jobs.js` and dispatcher in parallel with the existing `setImmediate()` flow.
- Once the job endpoint is stable, switch webhook to dispatch-only and remove `setImmediate()`.

Notes
- This change prioritizes reliability and observability over minimal code edits.
- If you want, I can implement `api/review-jobs.js` and the dispatcher now with tests and a small integration script.