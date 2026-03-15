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

## Phase 3b — Next steps for continuation (COMPLETE)

The following items were addressed in Phase 3c:
- [x] Add `page_fill` action explicitly to PLATFORM_ACTIONS (47 total actions now)
- [x] Updated agent prompt to document `page_fill` usage with concrete example
- [ ] Add `page_submit_form` composite action (navigate → fill → click submit) — deferred to Phase 4 followup
- [ ] Consider a persistent browser session per agent (currently each action creates a fresh context)

### Phase 4 — Full visual + UX overhaul (COMPLETE)
- [x] Applied dark teal glass aesthetic from oidesign.html reference
- [x] Dark teal gradient background (linear-gradient: #022c22 → #053d2a → #0a4f38)
- [x] Glass cards: `rgba(0,0,0,0.45)` with `backdrop-filter: blur(16px)` — dark glass effect
- [x] Switched all CSS variables to dark-mode values
  - `--bg-primary: #031a11` (dark teal)
  - `--text-primary: #e2e8f0` (slate-200)
  - `--text-secondary: #94a3b8` (slate-400)
  - `--border-primary: rgba(255,255,255,0.08)` (white-on-dark)
  - `--accent-gold: #fbbf24` (amber, matching oidesign.html)
- [x] Updated `.bg-mesh` to dark teal gradient with radial glows
- [x] Updated `.glass-card` to dark glass (dark background, white border, dark shadow)
- [x] Updated all component hover/active states for dark theme contrast
- [x] Build verified — all 33 routes compile successfully

### Phase 5 — Real MCP Server Integration (COMPLETE)
- [x] `src/lib/mcpClient.ts` created with full JSON-RPC 2.0 MCP protocol implementation
  - Lazy-initialized singleton subprocess per server ID
  - `initialize` handshake, `tools/call` invocation, 30s timeout, 3-restart crash recovery
  - `McpRpcResponse` named type; `callMcpTool()`, `listMcpTools()`, `isMcpServerAvailable()`
  - Binary resolution: `MCP_SERVERS_PATH` env → `~/.local/bin` → system PATH
  - Graceful Gemini fallback when binary unavailable
- [x] `npm run mcp:install` / `mcp:install:math` / `mcp:install:pdg` scripts added
- [x] `GET /api/tools/status` health endpoint live (all 12 routes, MCP + fallback modes)
- [x] `/api/tools/math` uses real `scicomp-math-mcp` (symbolic_integrate, symbolic_diff, etc.) + Gemini fallback
- [x] `/api/tools/quantum` uses real `scicomp-quantum-mcp` multi-step workflow + Gemini fallback
  - Workflow: `create_gaussian_wavepacket` → `create_custom_potential` → `solve_schrodinger`
- [x] `/api/tools/molecular` uses real `scicomp-molecular-mcp` multi-step workflow + Gemini fallback
  - Workflow: `create_particles` → `run_md`/`run_nvt` → optional `compute_rdf`/`compute_msd`
- [x] `/api/tools/neural` uses real `scicomp-neural-mcp` workflow + Gemini fallback
  - Workflow: `define_model` (resnet18/mobilenet/custom) → `get_model_summary`
- [x] `/api/tools/pdg` wired to `particlephysics-mcp` (git install) + Gemini fallback
- [x] `/api/tools/notebook` upgraded: real `python3 -` subprocess → Gemini → simulated
- [x] All 11 tool routes include `executionMode` field in every response
- [x] `check_tool_status` action added to PLATFORM_ACTIONS (48 total)
- [x] Agent prompt updated to reflect real MCP vs Gemini mode per tool
- [x] README.md — new "MCP Server Installation" section with install commands, mode table
- [x] TECHNICAL_SPECIFICATION.md — full MCP architecture, per-route executionMode, workflow docs
- [x] Build verified: 33 routes (34 including /api/tools/status), 0 TypeScript errors, 0 CodeQL alerts

## Continuation notes for next sessions

- Always validate with build/tests after each phase slice.
- Prefer minimal, shippable increments over large risky refactors.
- Keep this file updated with checked progress after each completed slice.
- The target design aesthetic is in `oidesign.html` at the repo root — Phase 4 visual overhaul is now COMPLETE matching this reference.
- Agent data (src/data/agents.ts) defines 12 agents with full academic profiles — these are the personas that drive autonomous behavior.

### Session 3b summary (2026-03-14)
- Installed `playwright@1.58.2` as a production dependency; chromium binary installed via `npx playwright install chromium`
- Created `src/lib/playwrightBrowser.ts`: lazy singleton Chromium manager, `isAvailable()`, `navigateAndSnapshot()`, `findInteractiveElements()`, `clickElement()`, `fillField()`, `captureScreenshot()`
- Updated `src/app/api/tools/playwright/route.ts`: real browser path first, Gemini URL-context fallback, `executionMode` field in response
- Added `page_snapshot` and `page_click` to `PLATFORM_ACTIONS` in `src/app/api/audit/stream/route.ts`
- Updated agent prompt with real browser capabilities and app URL patterns (localhost:3000 base)
- Added `npm run playwright:install` script to `package.json`
- **Verified**: real browser navigation works, returns `"executionMode":"playwright"` with real page content + accessibility tree

### Session 3c + 4 summary (2026-03-14)
- Added `page_fill` to `PLATFORM_ACTIONS` (47 total actions — 7 Playwright browser actions)
- Updated agent prompt: documented `page_fill` usage with concrete example
- **Phase 4 COMPLETE**: Rewrote `src/app/globals.css` with dark teal glass aesthetic from `oidesign.html`:
  - Dark teal background: `linear-gradient(135deg, #022c22 → #053d2a → #0a4f38)` + radial teal/violet/gold glows
  - Glass cards: `rgba(0,0,0,0.45)` + `backdrop-filter: blur(16px)` — dark glass panels
  - All CSS variables switched to dark-mode: `--text-primary: #e2e8f0`, `--border-primary: rgba(255,255,255,0.08)`, etc.
  - `--accent-gold: #fbbf24` (amber, matching oidesign.html), `--accent-amber: #f59e0b`
  - All component states (hover, active, skeleton, search-input, etc.) updated for dark theme
- **Build verified**: 33 routes compile, all pages render correctly with new dark theme

### Phase 6 — Comprehensive UX Overhaul + Real Metrics + MCP Tool Integration (MULTI-SESSION)

This is a massive overhaul broken into sub-phases. Each session should complete one sub-phase and update the checklist below.

#### Phase 6a — Vercel Deployment Fix + Critical UX Fixes (Session 1) ✅ COMPLETE
- [x] Fix Vercel build: add `serverExternalPackages: ["playwright"]` to `next.config.ts`
- [x] Make home page stat cards clickable (link to /agents, /debates, /verification, /formalism)
- [x] Add tooltips to sidebar platform stats explaining what each metric measures
- [x] Add tooltips to agent card stats (Reputation, Posts, Debate Wins, Verified) 
- [x] Make domain badges on agent cards clickable to filter by domain
- [x] Add tooltips to verification page confidence %, duration, pass rate
- [x] Add tooltips to debates page stats (Total Debates, Live Now, Total Rounds, Verifications, Avg Spectators)
- [x] Add tooltips to debates spectator counts and message counts
- [x] Knowledge Graph: added edge type legend (Cites, Verifies, Polar Tension, Domain Link) with descriptions
- [x] Forums page: tooltips on thread counts, active agents count, upvotes
- [x] Build verified: all routes compile

#### Phase 6b — Ambiguity Resolution + Info Icons (Session 2) ✅ COMPLETE
- [x] Add info (ⓘ) tooltips for all unexplained metrics across the app
- [x] Add forum verification status color legend explaining what status colors represent
- [x] Add tooltip to forum upvotes explaining what they represent (done in 6a)
- [x] Clarify "Efficiency Ratio" on formalism page with inline tooltip definition
- [x] Add Discovery Class explanation (Class 1/2/3) with tooltip help
- [x] Add "beta" badge tooltip on tools page explaining beta status
- [x] Add search source labels on tools page (OpenAlex vs Semantic Scholar tooltips)
- [x] Add debate format/domain badge tooltips (Adversarial/Collaborative/Socratic + domain)
- [x] Add debate round counter tooltip explaining what a "round" means
- [x] Add thread views count tooltip
- [x] Add confidence % tooltip on formalism page
- [x] Make forum thread counts clickable (link to forum thread list) — completed in Phase 6d
- [x] Make debate format/domain badges filterable (not just status) — completed in Phase 6d

#### Phase 6c — MCP Tool Integration Surfaces (Session 3) ✅ COMPLETE
- [x] Add "MCP Dashboard" link under RESEARCH in sidebar navigation
- [x] Add "MCP TOOLS" sub-section in sidebar with 5 MCP tool links (Math, Quantum, Molecular, Neural, PDG)
- [x] Add tool status indicators in sidebar (green dot = MCP active, yellow = Gemini fallback, gray = unavailable)
- [x] Sidebar fetches /api/tools/status on mount and shows per-tool execution mode (MCP/AI/—)
- [x] Create `/tools/mcp` dashboard page showing all MCP server statuses in real-time (auto-refresh 30s)
- [x] Overall status banner: Gemini API, Lean 4, Playwright availability
- [x] 5 MCP server cards with status indicators, binary availability, execution mode
- [x] "Try It" interactive panels per tool with quick examples connected to real endpoints
- [x] Tool result rendering: JSON syntax highlighting, LaTeX detection via MathRenderer
- [x] Execution history panel tracking recent tool calls with timestamps and modes
- [x] All-routes status table showing availability, execution mode, and required env vars

#### Phase 6d — Navigation + Menu Overhaul (Session 4) ✅ COMPLETE
- [x] Add collapsible sub-menus to sidebar for tool categories
- [x] Add "Scientific Computing" section with sub-items: Math, Quantum, Molecular, Neural, PDG
- [x] Add "Browser Tools" section: Playwright, Browse, Docs
- [x] Add "Verification" section: Lean 4, Formalism Engine, Verification
- [x] Update header features dropdown to include MCP tools
- [x] Add breadcrumb navigation to all pages
- [x] Make forum thread counts clickable (deferred from 6b)
- [x] Make debate format/domain badges filterable with dropdowns + clickable badges (deferred from 6b)
- [ ] Add "Quick Actions" floating panel for agents to invoke tools — deferred to Phase 6e
- [x] Ensure mobile responsiveness for new menu items

#### Phase 6e — Real Metrics + Seed Data Replacement (Session 5+6) ✅ COMPLETE
- [x] Replace hardcoded agent statistics with real computed values from activity
- [x] Make forum upvotes functional (add vote endpoint + UI click handler)
- [x] Add real verification duration tracking (measure actual Lean 4/Gemini execution time)
- [x] Compute "Active Agents" from recent autonomous activity timestamps
- [x] Show real MCP execution metrics (avg response time, success rate) on status page
- [x] Fix home page "Formal Proofs" stat to use correct data
- [x] Comprehensive UX audit: added tooltips to all remaining unlabeled metrics
- [x] Standardized "watching"→"spectators" terminology across entire app
- [x] Made debate tags clickable with tag filter dropdown
- [x] Made verification tier/status badges clickable to filter
- [x] Made agent status text clickable + added status filter dropdown
- [x] Made reply counts clickable (link to thread)
- [x] Added tooltips to formalism page parameter audit (Inputs/Outputs/Free Params)
- [x] Added tooltips to all tag badges, upvote displays, verdict explanations
- [x] Added debate message upvote tooltips and reply upvote tooltips
- [ ] Add real-time spectator tracking for debates (WebSocket or polling) — deferred to Phase 6g
- [ ] Replace hardcoded paper database with real OpenAlex/Semantic Scholar API — deferred to Phase 6g

#### Phase 6f — Logo Redesign + Branding (Session 6) ✅ COMPLETE
- [x] Replace globe icon with atom/neural-network motif SVG logo
- [x] Logo should represent "Open Insight" as scientific + AI research platform
- [x] Update favicon, apple-touch-icon, og:image with new logo
- [x] Update README header with new logo
- [x] Ensure logo works in dark teal theme and on light backgrounds

#### Phase 6g — Integration Testing + Polish (Session 7)
- [ ] End-to-end test: agent invokes MCP tool → result displays in UI → notification appears
- [ ] Audit all pages for remaining non-functional elements
- [ ] Performance audit: ensure tooltips/modals don't cause layout shifts
- [ ] Accessibility audit: all tooltips have aria labels, keyboard navigable
- [ ] Final Vercel deployment verification

### Session 6a summary (2026-03-14)
- Fixed Vercel build: added `serverExternalPackages: ["playwright"]` to `next.config.ts` to prevent bundling native Playwright binaries
- Wrote comprehensive Phase 6 multi-session plan in copilot-instructions.md
- Audited ALL UI elements for non-functional, ambiguous, or unexplained items (see audit findings above)
- Started Phase 6a critical UX fixes

---

## Phase 5 — Real MCP Server Integration (COMPLETE)

### Phase 5 Acceptance Criteria (all met ✅)

- [x] `src/lib/mcpClient.ts` created with full JSON-RPC MCP protocol implementation
- [x] `npm run mcp:install` installs all MCP server binaries
- [x] `GET /api/tools/status` returns live availability for all 12 tool routes
- [x] `/api/tools/math` uses real `scicomp-math-mcp` binary with Gemini fallback
- [x] `/api/tools/pdg` wired to `particlephysics-mcp` binary with Gemini fallback
- [x] `/api/tools/quantum` uses real `scicomp-quantum-mcp` with Gemini fallback
- [x] `/api/tools/molecular` uses real `scicomp-molecular-mcp` with Gemini fallback
- [x] `/api/tools/neural` uses real `scicomp-neural-mcp` with Gemini fallback
- [x] `/api/tools/notebook` upgraded to real python3 subprocess
- [x] All responses include `executionMode` field
- [x] Agent prompt updated to reflect real MCP capability
- [x] README.md and TECHNICAL_SPECIFICATION.md updated
- [x] Build passes: `npm run build`

### Session 5 summary (2026-03-14)
- Created `src/lib/mcpClient.ts`: full MCP JSON-RPC 2.0 client, lazy-init singleton subprocesses, `McpRpcResponse` named type, 30s timeout, 3-restart recovery, Gemini fallback, `MCP_SERVERS_PATH` env override
- Created `src/app/api/tools/status/route.ts`: `GET /api/tools/status` — live availability for all 12 routes
- Updated `src/app/api/tools/math/route.ts`: real `scicomp-math-mcp` (symbolic_integrate, symbolic_diff, etc.) + Gemini fallback + `executionMode` field
- Updated `src/app/api/tools/quantum/route.ts`: real `scicomp-quantum-mcp` multi-step (wavepacket → potential → Schrödinger solve) + Gemini fallback
- Updated `src/app/api/tools/molecular/route.ts`: real `scicomp-molecular-mcp` multi-step (create_particles → run_md → analysis) + Gemini fallback
- Updated `src/app/api/tools/neural/route.ts`: real `scicomp-neural-mcp` (define_model → get_model_summary) + Gemini fallback
- Updated `src/app/api/tools/pdg/route.ts`: wired to `particlephysics-mcp` + Gemini fallback + `executionMode`
- Updated `src/app/api/tools/notebook/route.ts`: real `python3 -` subprocess → Gemini → simulated (3-tier)
- Added `mcp:install`, `mcp:install:math`, `mcp:install:pdg` npm scripts
- Added `check_tool_status` to PLATFORM_ACTIONS (48 total); updated agent prompt with [MCP] vs [Gemini] annotations
- Updated README.md with "MCP Server Installation" section
- Updated TECHNICAL_SPECIFICATION.md with full MCP architecture, per-route mode table, workflow docs
- **Verified**: All 4 scicomp MCP servers running in production (`executionMode: "mcp"` confirmed via `/api/tools/status`), real `symbolic_integrate` call returns `{'integral': '-cos(x)', 'latex': '...', 'type': 'indefinite'}`, real `python3` subprocess returns `sqrt(2) = 1.414214`

### Context: Current State of MCP Tool Routes

All 11 tool routes at `src/app/api/tools/` exist and are **functional as Gemini-powered proxies**:

| Route | Current Implementation | Target: Real MCP |
|---|---|---|
| `/api/tools/arxiv` | ✅ **REAL** — direct arXiv Atom API (no Gemini needed) | Already real — no change needed |
| `/api/tools/browse` | Gemini `urlContext` | Keep as-is (URL context is appropriate) |
| `/api/tools/docs` | Gemini `googleSearch` | Keep as-is (search grounding is appropriate) |
| `/api/tools/lean4` | ✅ **REAL** — native `lean` binary + Gemini fallback | Already real — binary path in `src/lib/lean4.ts` |
| `/api/tools/playwright` | ✅ **REAL** — Chromium via `playwright@1.58.2` + Gemini fallback | Already real — `src/lib/playwrightBrowser.ts` |
| `/api/tools/math` | Gemini `codeExecution` simulating scicomp-math-mcp | **Phase 5a**: spawn real `scicomp-math-mcp` subprocess |
| `/api/tools/quantum` | Gemini `codeExecution` simulating psianimator-mcp | **Phase 5b**: spawn real `scicomp-quantum-mcp` or PsiAnimator |
| `/api/tools/molecular` | Gemini `codeExecution` simulating scicomp-molecular-mcp | **Phase 5c**: spawn real `scicomp-molecular-mcp` subprocess |
| `/api/tools/neural` | Gemini `codeExecution` simulating scicomp-neural-mcp | **Phase 5d**: spawn real `scicomp-neural-mcp` subprocess |
| `/api/tools/pdg` | Gemini `googleSearch` simulating ParticlePhysics MCP | **Phase 5e**: integrate real ParticlePhysics MCP Server |
| `/api/tools/notebook` | Gemini `codeExecution` + simulated fallback patterns | **Phase 5f**: direct Python subprocess execution |

### MCP Server Inventory

The real MCP servers to integrate (sources in physicsandmathmCP.md):

#### Group A — Math-Physics-ML MCP (Python/uvx, all 4 servers from one repo)
- **Install**: `uvx --from git+https://github.com/arathald/math-physics-ml-mcp.git scicomp-math-mcp`
- **Servers**:
  - `scicomp-math-mcp` — 14 tools: symbolic algebra (SymPy), differentiation, integration, equation solving, series, matrices
  - `scicomp-quantum-mcp` — 12 tools: Schrödinger equation, wave packets, harmonic oscillator, spin systems
  - `scicomp-molecular-mcp` — 15 tools: Lennard-Jones MD, RDF, MSD, thermodynamic ensembles
  - `scicomp-neural-mcp` — 16 tools: feedforward/convolutional/recurrent networks, training, evaluation
- **Protocol**: JSON-RPC over stdin/stdout (MCP standard)
- **Runtime**: Python 3.10+, dependencies auto-installed by uvx
- **Alternative install**: `pip install scicomp-math-mcp` (PyPI) then `python -m scicomp_math_mcp`

#### Group B — PsiAnimator-MCP (Python, QuTip + Manim)
- **Install**: `pip install psianimator-mcp` (requires QuTip, Manim, Python 3.10+)
- **Tools**: quantum state visualization, Bloch sphere animations, time-evolution animations, gate circuits
- **Protocol**: JSON-RPC over stdin/stdout
- **Note**: Heavy dependency (Manim, LaTeX). In serverless environments use scicomp-quantum-mcp instead.

#### Group C — ParticlePhysics MCP Server (Python, PDG data)
- **Install**: `uvx --from git+https://github.com/uzerone/ParticlePhysics-MCP-Server.git particlephysics-mcp`
- **Alternative**: `pip install particlephysics-mcp`
- **Tools**: particle lookup by name (400+ particles), properties (mass, lifetime, decay modes, quantum numbers), PDG IDs
- **Protocol**: JSON-RPC over stdin/stdout
- **Data source**: Embedded PDG particle database (offline, no API key needed)

#### Group D — @playwright/mcp (Official Playwright MCP from Microsoft)
- **Install**: `npm install @playwright/mcp` (already has Playwright as peer dep)
- **Run**: `npx @playwright/mcp --port 3333` or `npx @playwright/mcp --stdio`
- **Tools**: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_take_screenshot`, `browser_wait_for_text`, `browser_select_option`, `browser_check` (35+ tools)
- **Protocol**: MCP over HTTP (`--port`) or stdio (`--stdio`)
- **Note**: The official MCP server from Microsoft/Playwright team — this is the canonical Playwright MCP referenced in the PR documentation. Our `src/lib/playwrightBrowser.ts` duplicates a subset of this; see integration notes below.

### Phase 5 Implementation Plan

#### Phase 5a — MCP Process Manager (`src/lib/mcpClient.ts`) ← START HERE

Create a reusable MCP client library that:
1. Spawns an MCP server process (via `child_process.spawn`) with JSON-RPC over stdin/stdout
2. Sends `initialize` → tool `call` → reads response — follows the MCP protocol spec
3. Manages process lifecycle (lazy start, keep-alive, restart on crash, teardown on exit)
4. Has a **timeout** (30s default) and **fallback** callback per-tool for when the process is unavailable
5. Exports `callMcpTool(server, toolName, params)` as the primary API

**File**: `src/lib/mcpClient.ts`
**Pattern**: Same lazy-singleton approach as `src/lib/playwrightBrowser.ts`

```typescript
// Sketch — implement the full version
export async function callMcpTool(
  server: McpServerConfig,   // { command, args, env? }
  toolName: string,
  params: Record<string, unknown>,
  fallback?: () => Promise<unknown>
): Promise<unknown>
```

**Tests**: Create `src/lib/__tests__/mcpClient.test.ts` with mock stdin/stdout

#### Phase 5b — Install + verify MCP server binaries

Add npm scripts to `package.json`:
```json
"mcp:install:math":      "uvx --from git+https://github.com/arathald/math-physics-ml-mcp.git scicomp-math-mcp --help || pip install scicomp-math-mcp",
"mcp:install:pdg":       "uvx --from git+https://github.com/uzerone/ParticlePhysics-MCP-Server.git particlephysics-mcp --help || pip install particlephysics-mcp",
"mcp:install:playwright":"npm install @playwright/mcp",
"mcp:install":           "npm run mcp:install:math && npm run mcp:install:pdg && npm run mcp:install:playwright"
```

Add a health-check endpoint `GET /api/tools/status` that reports which MCP servers are available (binary found + responds to `initialize`).

#### Phase 5c — Wire real MCP into each tool route

**Priority order** (simplest first):

1. **`/api/tools/math`** — Use `callMcpTool("scicomp-math-mcp", "compute_symbolic", params)`. Fall back to Gemini `codeExecution` if process unavailable. Add `executionMode: "mcp" | "gemini"` to response.

2. **`/api/tools/pdg`** — Use `callMcpTool("particlephysics-mcp", "get_particle_properties", params)`. Fall back to Gemini `googleSearch`. Add `executionMode: "mcp" | "gemini"`.

3. **`/api/tools/quantum`** — Use `callMcpTool("scicomp-quantum-mcp", "simulate_quantum_system", params)`. Fall back to Gemini `codeExecution`.

4. **`/api/tools/molecular`** — Use `callMcpTool("scicomp-molecular-mcp", "run_md_simulation", params)`.

5. **`/api/tools/neural`** — Use `callMcpTool("scicomp-neural-mcp", "train_network", params)`.

6. **`/api/tools/notebook`** — Replace simulated fallback patterns with direct Python subprocess. Use `child_process.exec("python3 -c '<code>'")` or a Jupyter kernel. Fall back to Gemini.

7. **`/api/tools/playwright`** — Integrate `@playwright/mcp` as an alternative to `src/lib/playwrightBrowser.ts`. The official MCP server has 35+ tools; our custom lib covers the critical subset. Use official MCP first, fall back to custom lib, then Gemini URL-context.

**For each route**, the response must include:
```json
{ "executionMode": "mcp" | "gemini" | "subprocess", "mcpServer": "scicomp-math-mcp", ... }
```

#### Phase 5d — Expose MCP status to agents

1. Update `GET /api/tools/status` to return per-server availability
2. Update `PLATFORM_ACTIONS` descriptions in `src/app/api/audit/stream/route.ts` to note when real MCP is available vs Gemini fallback
3. Update agent prompt: "Tools marked [MCP] run real computation via native MCP servers. Tools marked [Gemini] use AI-backed computation."

#### Phase 5e — Documentation updates

Update `README.md`:
- New section: **MCP Server Installation** (`npm run mcp:install`)
- Per-tool `executionMode` field documentation
- System requirements: Python 3.10+, `uvx` (via `pip install uv`)

Update `TECHNICAL_SPECIFICATION.md`:
- MCP architecture diagram: Next.js route → `mcpClient.ts` → MCP subprocess → JSON-RPC
- Tool execution modes table: `mcp` / `gemini` / `subprocess` per route
- Environment variable: `MCP_SERVERS_PATH` (optional override for server binary locations)

### Phase 5 Acceptance Criteria (met ✅ — see completed section above)

- [x] `src/lib/mcpClient.ts` created with full JSON-RPC MCP protocol implementation
- [x] `npm run mcp:install` installs all MCP server binaries
- [x] `GET /api/tools/status` returns live availability for all 12 tool routes
- [x] `/api/tools/math` uses real `scicomp-math-mcp` binary with Gemini fallback
- [x] `/api/tools/pdg` wired to `particlephysics-mcp` binary with Gemini fallback
- [x] `/api/tools/quantum` uses real `scicomp-quantum-mcp` with Gemini fallback
- [x] `/api/tools/molecular` uses real `scicomp-molecular-mcp` with Gemini fallback
- [x] `/api/tools/neural` uses real `scicomp-neural-mcp` with Gemini fallback
- [x] `/api/tools/notebook` upgraded to real python3 subprocess
- [x] All responses include `executionMode` field
- [x] Agent prompt updated to reflect real MCP capability
- [x] README.md and TECHNICAL_SPECIFICATION.md updated
- [x] Build passes: `npm run build`

### Phase 5 Implementation Notes

**MCP Protocol (JSON-RPC 2.0 over stdio)**:
```
// 1. Initialize
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"open-insight","version":"1.0"}}}
← {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},...}}

// 2. List tools (optional, for health check)
→ {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
← {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"compute_symbolic",...}]}}

// 3. Call tool
→ {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"compute_symbolic","arguments":{"operation":"integrate","expression":"sin(x)"}}}
← {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Result: -cos(x) + C"}]}}
```

**Deployment strategy**:
- On Vercel/serverless: all routes fall back to Gemini automatically (MCP processes can't run in serverless)
- On dedicated server (Docker/VPS): `npm run mcp:install` pre-installs all binaries at container build time
- Environment variable `MCP_AVAILABLE=true` can be set to skip the availability check overhead
- Add `mcp:install` to `vercel-build` script only if Vercel adds Python support

**Error handling**:
- MCP process crash → restart (up to 3 times) → fall back to Gemini
- MCP timeout (30s) → fall back to Gemini
- MCP binary not found → fall back to Gemini immediately (no retry)
- Always log `executionMode` so operators can see which path was taken


### Session 6b summary (2026-03-14)
- Fixed Vercel build: Next.js 16 required custom `global-error.tsx` for prerendering; also added `not-found.tsx` and made `getHeaderData()` resilient to missing DB tables during build (try/catch with safe defaults)
- Added tooltips to formalism page: Efficiency Ratio (definition + threshold explanation), Discovery Class (Class 1/2/3 meanings), Confidence % (what it measures)
- Added tooltips to tools page: BETA badge (feature incomplete/API may change), relevance score (SPECTER2 embeddings), source labels (OpenAlex vs Semantic Scholar descriptions)
- Added verification status color legend to forums page (Verified/Disputed/Pending/Unverified with colored dots)
- Added tooltips to forums: thread views count
- Added tooltips to debates page: format badge (Adversarial/Collaborative/Socratic), domain badge, round counter (what constitutes a round)
- **Build verified**: all 33 routes compile, 0 TypeScript errors, 0 CodeQL alerts
- **Files changed**: `global-error.tsx` (new), `not-found.tsx` (new), `queries.ts` (getHeaderData resilience), `formalism/page.tsx`, `tools/page.tsx`, `ForumsClient.tsx`, `DebatesClient.tsx`
- **Deferred to Phase 6d**: Make forum thread counts clickable, make debate format/domain badges filterable

### Session 6c summary (2026-03-14)
- Added "MCP Dashboard" link to sidebar under RESEARCH navigation section
- Added "MCP TOOLS" sidebar section with 5 tool links (Math, Quantum, Molecular, Neural, PDG) — each with live status indicators fetched from /api/tools/status
- Created `/tools/mcp` dashboard page (`src/app/tools/mcp/page.tsx`) with:
  - Overall status banner (Gemini API, Lean 4, Playwright)
  - 5 MCP server status cards with binary availability, execution mode (MCP/Gemini/offline)
  - "Try It" interactive panels with quick examples for each tool type
  - Result rendering with JSON syntax highlighting and LaTeX detection
  - Execution history panel tracking recent tool calls
  - All-routes status table showing 11 tool route availability and modes
- Sidebar status indicators: green = MCP active, yellow = Gemini fallback, gray = unavailable
- Auto-refresh every 30s on the MCP dashboard
- **Build verified**: all 34 routes compile (33 + /tools/mcp), 0 TypeScript errors
- **Files changed**: `Sidebar.tsx` (MCP tools section + status fetch), `src/app/tools/mcp/page.tsx` (new)

### Session 6d summary (2026-03-14)
- **Sidebar overhaul**: Refactored from flat navigation to collapsible `SidebarSection` components with expand/collapse toggles
  - DISCOVER (Home, Forums, Debates, Agents) — expanded by default
  - VERIFICATION (Verification, Formalism Engine, Knowledge Graph) — expanded by default
  - TOOLS & COMPUTE (Tools, MCP Dashboard, MathMark2PDF) — expanded by default
  - SCIENTIFIC COMPUTING (Math, Quantum, Molecular, Neural, PDG with live MCP status) — collapsed by default
  - BROWSER TOOLS (Playwright, Browse, Docs with live status) — collapsed by default
  - FORUMS (6 forum shortcuts) — collapsed by default
- **Header features dropdown**: Added "MCP SCIENTIFIC TOOLS" section with 6 links (Dashboard, Math, Quantum, Molecular, Neural, PDG)
- **Breadcrumbs**: New `Breadcrumbs.tsx` component added to `layout.tsx`, renders on all pages except Home with route-aware labels
- **Forum thread counts**: Made clickable — clicking "N threads" navigates to the forum's thread list (deferred from 6b)
- **Debate format/domain filters**: Added format and domain dropdown filters to Debates page; format/domain badges on debate cards are now clickable buttons that set the respective filter (deferred from 6b)
- **Build verified**: all 34 routes compile, 0 TypeScript errors
- **Files changed**: `Sidebar.tsx` (collapsible sections, browser tools), `Header.tsx` (MCP tools dropdown section), `Breadcrumbs.tsx` (new), `layout.tsx` (breadcrumbs), `ForumsClient.tsx` (clickable thread counts), `DebatesClient.tsx` (format/domain filters + clickable badges), `copilot-instructions.md`

### Session 6e summary (2026-03-14)
- **Computed agent stats**: New `getComputedAgentStats()` in `src/lib/queries.ts` replaces seed stats with real computed values:
  - `postCount` = threads + replies + debate messages per agent
  - `debateWins` = debates won (most upvotes on messages in completed debates)
  - `verificationsSubmitted` / `verifiedClaims` = from verifications table
  - `reputationScore` = weighted formula (50 base + posts 0.5ea + verified claims 2ea + debate wins 3ea, max 99)
- **Active Agents from real activity**: `getStats()` now computes "active agents" from agents with any DB activity (threads, replies, debate messages, live debate participation)
- **Fixed home page "Formal Proofs"**: Was using `stats.totalRounds` (debate rounds), now correctly uses `stats.lean4Proofs` (Tier 3 passed verifications)
- **Forum upvotes functional**: `ForumsClient.tsx` overview page upvote arrows are now clickable buttons calling `POST /api/forums/[slug]/threads/[threadId]/upvote`
- **MCP response time tracking**: `tools/mcp/page.tsx` now measures `performance.now()` for each tool call, shows response time in result panel + execution history; metrics summary shows total calls, success rate, average response time
- **Real verification durations**: Both Gemini and simulation paths in `verifications/[id]/stream/route.ts` now measure actual `Date.now()` elapsed time instead of hardcoded duration strings
- **Tooltips on agent detail stats**: Each stat on agent profile has tooltip explaining computation method
- **Build verified**: all 34 routes compile, 0 TypeScript errors
- **Files changed**: `queries.ts`, `page.tsx` (home), `agents/page.tsx`, `agents/[id]/page.tsx`, `ForumsClient.tsx`, `tools/mcp/page.tsx`, `verifications/[id]/stream/route.ts`, `copilot-instructions.md`

### Session 6e continuation summary (2026-03-14)
- **Comprehensive UX audit**: Found and fixed 32+ remaining issues across all pages
- **Missing tooltips fixed**: Round tooltips (home + debate detail), views tooltips (thread detail + ForumThreadsClient), spectators tooltips (home + debate detail), reply count tooltips (all 3 locations), upvote tooltips (thread detail + ForumThreadsClient + reply upvotes + debate message upvotes), formalism parameter audit tooltips (Inputs/Outputs/Free Params), verdict determination tooltip, format/domain badge tooltips on debate detail, all tag badges across app
- **Terminology standardized**: "watching" → "spectators" on home page (matches debates page)
- **Debate tags clickable**: Added `tagFilter` state + dropdown filter + clickable tag buttons in DebatesClient (consistent with format/domain badge pattern)
- **Verification badges clickable**: Tier and status badges in VerificationClient now click to set the corresponding filter
- **Agent status filter**: Added `statusFilter` state + dropdown + clickable status text in AgentsClient (extends existing domain filter pattern)
- **Reply counts clickable**: ForumsClient + ForumThreadsClient reply counts are now Link elements to thread detail
- **Debate detail tags**: Have tooltips explaining topic tags
- **Build verified**: all 34 routes compile, 0 TypeScript errors
- **Files changed**: `page.tsx` (home), `DebatesClient.tsx`, `debates/[id]/page.tsx`, `ForumsClient.tsx`, `ForumThreadsClient.tsx`, `threads/[threadId]/page.tsx`, `VerificationClient.tsx`, `AgentsClient.tsx`, `formalism/page.tsx`, `copilot-instructions.md`

### Session 6f summary (2026-03-15)
- **Logo redesign**: Replaced globe icon with atom/neural-network motif SVG logo
  - Three intersecting electron orbits (ellipses at -30°, +30°, 90°) represent scientific rigor
  - Six neural network nodes positioned on orbits with subtle cross-connections represent AI reasoning
  - Central nucleus with gradient fill represents core knowledge synthesis
- **New assets created**:
  - `public/logo.svg` — 512×512 full logo with teal→gold gradient background, rounded corners
  - `public/logo-icon.svg` — 256×256 white-only icon version for use on colored backgrounds
  - `public/favicon.svg` — 32×32 compact favicon version with gradient background
- **Header.tsx updated**: Replaced globe SVG with inline atom/neural-network motif (22×22 viewBox)
- **layout.tsx updated**: Added favicon, apple-touch-icon, and OpenGraph image metadata
- **README.md updated**: Added centered logo image at top of file
- **Logo verified**: Works on dark teal theme background AND light/white backgrounds
- **Build verified**: all 34 routes compile, 0 TypeScript errors
- **Files changed**: `Header.tsx`, `layout.tsx`, `README.md`, `public/logo.svg`, `public/logo-icon.svg`, `public/favicon.svg`, `copilot-instructions.md`
