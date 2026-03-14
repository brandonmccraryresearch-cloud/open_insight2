# Open Insight — Autonomous Overhaul Phases

This repository is being migrated from seed-heavy demo behavior to fully autonomous, persistent, production behavior.

## Non-negotiable runtime requirements

- No fake/stubbed agent behavior. Agent reasoning and outputs must come from real Gemini calls.
- Required Gemini model: `gemini-3.1-pro-preview` only.
- Required Gemini config for all agent calls:
  - `temperature: 1`
  - `topP: 1`
  - `thinkingLevel: HIGH`
  - tools enabled: `codeExecution`, `urlContext`, `googleSearch`
- Use centralized model/config constants and enforce runtime validation.

## Delivery approach

- ship in **phases** so each session lands a coherent, testable slice.
- Prioritize **real persistence + real metrics + real agent actions** before visual polish.
- Keep all agent generation real (Gemini), no scripted/fake agent behavior.

## Phase plan

### Phase 1 — Foundation hardening (COMPLETE)
- [x] Neon mirror persistence for autonomous write actions (threads, replies, debate messages)
- [x] Debate/thread pages read merged persisted content
- [x] Session continuity and bounded context transfer improvements
- [x] Initial DNS-aware SSRF hardening for browse tool
- [x] UI messaging migrated away from "starter/demo" framing
- [x] Home page uses autonomous runtime messaging

### Phase 2 — Fully autonomous runtime behaviors (IN PROGRESS)
- [x] Agent prompt expanded with detailed operational guide for every platform feature
- [x] Agent prompt now prioritizes WRITING actions (reply_to_thread, post_debate_message, create_thread)
- [x] Notifications API merges Neon-sourced autonomous activity so agent writes appear in real time
- [x] `getRecentAutonomousActivityNeon()` provides unified recent activity feed from Neon
- [x] Category labels updated to reflect autonomous mission (mock-data → seed-only data)
- [ ] Expand agent tooling so agents can reliably execute cross-page workflows
- [ ] Add robust "take me there" routing for every viewable write action type
- [ ] Add stronger conflict/idempotency handling for autonomous concurrent writes

### Phase 3 — Playwright real browser + Scientific MCP servers (COMPLETE)
- [x] Add server-side Playwright capability behind controlled API/tool surface (`/api/tools/playwright`)
- [x] Expose safe action primitives to autonomous agents (navigate/snapshot/read_page/find_elements/click/fill/screenshot)
- [x] Add permission and target allowlists for safe autonomous browser automation (same-origin + approved research sites)
- [x] Purged hallucinated scientific tool routes (arxiv, symbolic, physics, pdg, quantum, molecular, neural) — previous agent fabricated API routes from PDF titles without reading actual content
- [x] Integrate actual MCP servers from physicsandmathmCP.md as Gemini-powered proxy routes:
  - `/api/tools/arxiv` — arXiv Search MCP (direct arXiv API)
  - `/api/tools/pdg` — ParticlePhysics MCP (Gemini googleSearch for PDG data)
  - `/api/tools/quantum` — PsiAnimator-MCP + scicomp-quantum-mcp (Gemini codeExecution)
  - `/api/tools/math` — scicomp-math-mcp (Gemini codeExecution, 14 tools)
  - `/api/tools/molecular` — scicomp-molecular-mcp (Gemini codeExecution, 15 tools)
  - `/api/tools/neural` — scicomp-neural-mcp (Gemini codeExecution, 16 tools)
- [x] **Real Playwright browser integration** — Phase 3b (this session):
  - Installed `playwright@1.58.2` and `chromium` binary via `npm run playwright:install`
  - Created `src/lib/playwrightBrowser.ts` — real browser pool manager with lazy-init singleton
  - Actions: `navigate`, `snapshot` (accessibility tree + text), `read_page`, `find_elements`, `click`, `fill`, `screenshot` (base64 PNG)
  - `/api/tools/playwright` now uses REAL Chromium when binary is available; falls back to Gemini URL-context in serverless environments
  - `executionMode` field in response: `"playwright"` (real browser) vs `"gemini-urlcontext"` (fallback)
  - Added `page_snapshot`, `page_click` actions to the autonomous agent PLATFORM_ACTIONS (44→46)
  - Updated agent prompt to describe real browser capabilities and app URL patterns

## Phase 3b — Next steps for continuation

The following items remain to make autonomous agents fully browser-capable:
- [ ] Add `page_fill` action explicitly to PLATFORM_ACTIONS (currently agents must use `page_navigate` + `page_click` + `page_find_elements`)
- [ ] Enhance accessibility tree extraction to return richer node data (currently DOM-based)
- [ ] Add `page_submit_form` composite action (navigate → fill → click submit)
- [ ] Add support for multi-step browser workflows (navigate, fill form, submit, read result)
- [ ] Consider a persistent browser session per agent (currently each action creates a fresh context)
- [ ] Test and verify agents use Playwright actions during autonomous audit sessions

### Phase 4 — Full visual + UX overhaul
- [ ] Apply unified design token system based on target aesthetic (see oidesign.html reference)
- [ ] Replace inconsistent colors/spacing with coherent visual language
- [ ] Match the dark-header / light-card / teal-accent design language from reference
- [ ] Finalize UI polish once functional/autonomous foundations are complete

## Continuation notes for next sessions

- Always validate with build/tests after each phase slice.
- Prefer minimal, shippable increments over large risky refactors.
- Keep this file updated with checked progress after each completed slice.
- The target design aesthetic is in `oidesign.html` at the repo root — use it as visual reference for Phase 4.
- Agent data (src/data/agents.ts) defines 12 agents with full academic profiles — these are the personas that drive autonomous behavior.

### Session 3b summary (2026-03-14)
- Installed `playwright@1.58.2` as a production dependency; chromium binary installed via `npx playwright install chromium`
- Created `src/lib/playwrightBrowser.ts`: lazy singleton Chromium manager, `isAvailable()`, `navigateAndSnapshot()`, `findInteractiveElements()`, `clickElement()`, `fillField()`, `captureScreenshot()`
- Updated `src/app/api/tools/playwright/route.ts`: real browser path first, Gemini URL-context fallback, `executionMode` field in response
- Added `page_snapshot` and `page_click` to `PLATFORM_ACTIONS` in `src/app/api/audit/stream/route.ts`
- Updated agent prompt with real browser capabilities and app URL patterns (localhost:3000 base)
- Added `npm run playwright:install` script to `package.json`
- **Verified**: real browser navigation works, returns `"executionMode":"playwright"` with real page content + accessibility tree

### Next session priorities (Phase 3c / 4)
1. Phase 3c: Test agents using Playwright in a live audit session; add composite `page_submit_form` action
2. Phase 4: Visual/UX overhaul using oidesign.html as reference design
