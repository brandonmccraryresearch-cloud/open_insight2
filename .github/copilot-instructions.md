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

### Phase 3 — Playwright-backed interaction tooling + Scientific MCP servers (IN PROGRESS)
- [x] Add server-side Playwright capability behind controlled API/tool surface (`/api/tools/playwright`)
- [x] Expose safe action primitives to autonomous agents (navigate/read_page/find_elements/click/fill/screenshot)
- [x] Add permission and target allowlists for safe autonomous browser automation (same-origin + approved research sites)
- [x] Add arXiv search tool (`/api/tools/arxiv`) — direct arXiv API search with paper metadata, abstracts, PDF links
- [x] Add symbolic algebra tool (`/api/tools/symbolic`) — SymPy-powered via Gemini codeExecution (scicomp-math-mcp equivalent)
- [x] Add computational physics tool (`/api/tools/physics`) — NumPy/SciPy-powered via Gemini codeExecution
- [x] Add particle physics data tool (`/api/tools/pdg`) — PDG lookups via Gemini googleSearch (ParticlePhysics MCP equivalent)
- [x] Add quantum simulation tool (`/api/tools/quantum`) — quantum system simulation via Gemini codeExecution (PsiAnimator/scicomp-quantum-mcp equivalent)
- [x] Add molecular dynamics tool (`/api/tools/molecular`) — particle systems, Lennard-Jones, NVT ensembles, RDF, MSD via Gemini codeExecution (scicomp-molecular-mcp equivalent)
- [x] Add neural network tool (`/api/tools/neural`) — architecture definition, training, evaluation, gradient analysis via Gemini codeExecution (scicomp-neural-mcp equivalent)
- [x] Register all 12 new actions in PLATFORM_ACTIONS (search_arxiv, symbolic_algebra, compute_physics, lookup_pdg, simulate_quantum, simulate_molecular, run_neural_network, page_navigate, page_read, page_find_elements, page_screenshot)
- [x] Update agent prompt with detailed operational guides for Scientific Computing Tools and Playwright sections
- [x] Add "Take me there" routing for new tool actions in AuditClient
- [ ] Add full Playwright binary integration for dedicated server environments (non-Vercel)

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
