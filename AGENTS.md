# AGENTS — Agent Guidance for this Repo

# GitHub AI Webhook Integrations — Project Summary (Previous Conversation History)
**Repo:** https://github.com/nguyendy630/GitHub-AI-Webhook-Integrations

---

## Project Overview
A Node.js webhook server that listens for GitHub PR events, analyzes code diffs, and posts AI-generated code reviews back to the PR. Deployed on Vercel.

---

## Tech Stack
- **Runtime:** Node.js (CommonJS — no `"type": "module"`)
- **Framework:** Express
- **AI:** OpenAI (switched from Gemini mid-session)
- **GitHub API:** Octokit
- **Logging:** Winston
- **Deployment:** Vercel (serverless functions in `api/` folder)
- **Local Dev:** nodemon
---

## File Structure
```
GitHub-AI-Webhook-Integrations/
├── .github/
│   ├── workflows       ← Vercel serverless entry, Express app, webhook endpoints
│   │   ├── ci.yml  ← AI review logic (PRIMARY FOCUS THIS SESSION)
│   │   ├── pr-labeler.yml  ← AI review logic (PRIMARY FOCUS THIS SESSION)
│   ├── labeler.yml       ← Vercel serverless entry, Express app, webhook endpoints
├── api/
│   ├── webhooks.js        ← Vercel serverless entry, Express app, webhook endpoint
│   ├── health.js          ← GET /health
│   └── stats.js           ← GET /stats (stubbed)
├── src/
│   ├── server.js          ← Local dev server
│   ├── services/
│   │   ├── aiReviewer.js  ← AI review logic (PRIMARY FOCUS THIS SESSION)
│   │   ├── diffParser.js  ← Parses unified diffs
│   │   └── services.js    ← Octokit GitHub API wrapper
│   ├── webhooks/
│   │   ├── handler.js     ← Routes events, queueReview() lives here
│   │   └── validator.js   ← Empty placeholder
│   └── utils/
│       └── logger.js      ← Winston logger
├── .env                   ← OPENAI_API_KEY, GH_WEBHOOK secret
├── package.json
└── vercel.json
```

---

## Phase Status

### ✅ Phase 1 — Complete (already in repo)
- Webhook receiving + HMAC signature verification
- Event routing (pull_request, push, ping, pull_request_review)
- PR metadata extraction
- GitHub API service (getPullRequest, getPRFiles, getPRDiff, getFileContent)
- Diff parsing (addedLines, deletedLines, language detection, test file detection, new functions, import changes)
- Winston logging

### 🔄 Phase 2 — In Progress
`aiReviewer.js` is complete. `queueReview()` in `handler.js` still needs to be rewritten.

### ⬜ Phase 3 — Not Started
Post AI review as a GitHub PR comment (one summary comment covering all files).

---

## aiReviewer.js — COMPLETE (built this session, not yet committed)

This is where the next conversation picks up. Current `queueReview()`:
```js
async queueReview(prInfo) {
    const diff = await services.getPRDiff(prInfo.repoOwner, prInfo.repoName, prInfo.number);
    const diffAnalysis = await diffParser.analyzeDiff(diff);
    console.log(diffAnalysis); // ← end of the line
}
```

Needs to become:
```js
async queueReview(prInfo) {
    // 1. getPRFiles() instead of getPRDiff()
    // 2. Filter with aiReviewer.shouldReviewFile()
    // 3. Promise.allSettled() — parallel loop: analyzeDiff() + reviewCode() per file
    // 4. Collect fulfilled results
    // 5. Log reviews array (Phase 3 will post to GitHub)
}
```

Also add to top of handler.js:
```js
const AIReviewer = require("../services/aiReviewer");
const aiReviewer = new AIReviewer();
```

---

## Key Decisions Made
- **One summary PR comment** (not inline per-file comments) for Phase 3
- **Parallel processing** with `Promise.allSettled()` — each file fails independently
- **Export the class**, not an instance: `module.exports = AIReviewer`
- **CommonJS throughout** — no `"type": "module"` in package.json

---

## Known Bugs in Existing Code (not yet fixed)
These are in the original repo files, not in `aiReviewer.js`:

| File | Bug |
|---|---|
| `diffParser.js` | `containsNewFunctions` uses `.context` — should be `.content` |
| `diffParser.js` | `hasTestChanges()` missing return statement, `language` not in scope |
| `services.js` | `getFileContent()` passes `path` instead of `filePath` to Octokit |
| `webhooks/validator.js` | Completely empty |
| `api/stats.js` | `module.export` typo — should be `module.exports` |
---

## Environment Variables Needed
```
OPENAI_API_KEY=your_key
GH_WEBHOOK=your_github_webhook_secret
GITHUB_TOKEN=your_github_token
```

Purpose: short, actionable instructions for AI coding agents working in this repository.

**How to run tests:**
- Install: `npm install`
- Run tests: `npm test` (uses `jest`)

**Key files & folders:**
- `api/` — webhook endpoints used by Vercel serverless routes.
- `src/` — main server and services (see `src/services/`).
- `src/services/diffParser.js` — diff parsing and analysis logic.
- `src/webhooks/handler.js` — orchestration that calls `diffParser.analyzeDiff`.
- `tests/` — unit tests run by CI and `npm test`.

**Important conventions and pitfalls**
- Exports: `src/services/diffParser.js` exports a single instance (`module.exports = new DiffParser()`). Prefer `const diffParser = require('./src/services/diffParser')` instead of destructuring (`const { analyzeDiff } = ...`) because destructuring loses the instance `this` context and can break methods.
- Diff parsing: `getAddedLines()` and `getDeletedLines()` parse unified diffs; hunk header parsing is sensitive to `@@ -a,b +c,d @@` coordinates — be careful which side (`-` vs `+`) you read for old vs new file line numbers.
- Tests: existing tests live in `tests/` and sometimes mock simple diff strings; prefer small, focused fixtures.

**Agent behavior guidance**
- Keep changes small and targeted. When editing core utilities like `diffParser`, update or add focused unit tests in `tests/`.
- If modifying exports/signatures, update callers (`src/webhooks/handler.js`) and tests to match.
- Log and warn rather than throwing for non-critical failures so the webhook pipeline remains resilient.

If you want, I can add more targeted agent instructions (e.g., separate instructions for `AIReviewer`, testing patterns, or CI hooks). Reply with which area to expand.
