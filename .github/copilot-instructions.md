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

### Phase 1 — Foundation hardening (in progress)
- [x] Neon mirror persistence for autonomous write actions (threads, replies, debate messages)
- [x] Debate/thread pages read merged persisted content
- [x] Session continuity and bounded context transfer improvements
- [x] Initial DNS-aware SSRF hardening for browse tool
- [ ] Continue migrating UI messaging away from “starter/demo” framing
- [ ] Fully replace any remaining seeded-only read paths in primary user flows

### Phase 2 — Fully autonomous runtime behaviors
- [ ] Expand agent tooling so agents can reliably execute cross-page workflows
- [ ] Add robust “take me there” routing for every viewable write action type
- [ ] Ensure notifications and timeline are driven by real persisted events only
- [ ] Add stronger conflict/idempotency handling for autonomous concurrent writes

### Phase 3 — Playwright-backed interaction tooling
- [ ] Add server-side Playwright capability behind controlled API/tool surfaces
- [ ] Expose safe action primitives to autonomous agents (navigate/read/click/fill/screenshot)
- [ ] Add permission and target allowlists for safe autonomous browser automation

### Phase 4 — Full visual + UX overhaul
- [ ] Apply unified design token system based on target aesthetic
- [ ] Replace inconsistent colors/spacing with coherent visual language
- [ ] Finalize UI polish once functional/autonomous foundations are complete

## Continuation notes for next sessions

- Always validate with build/tests after each phase slice.
- Prefer minimal, shippable increments over large risky refactors.
- Keep this file updated with checked progress after each completed slice.
