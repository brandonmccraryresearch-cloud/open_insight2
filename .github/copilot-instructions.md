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

### Next session priorities (Phase 5)
1. Add `page_submit_form` composite action in playwrightBrowser.ts (navigate → fill → submit)
2. Run agents in a live audit session and observe them use Playwright browser actions
3. Consider persistent browser session per agent for multi-step workflows
4. Continue Phase 2 remaining items: "take me there" routing, conflict/idempotency handling

---

## Phase 5 — Real MCP Server Integration (NEXT)

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

### Phase 5 Acceptance Criteria

- [ ] `src/lib/mcpClient.ts` created with full JSON-RPC MCP protocol implementation
- [ ] `npm run mcp:install` installs all MCP server binaries
- [ ] `GET /api/tools/status` returns live availability for all 11 tool routes
- [ ] `/api/tools/math` uses real `scicomp-math-mcp` binary with Gemini fallback
- [ ] `/api/tools/pdg` uses real `particlephysics-mcp` binary with Gemini fallback
- [ ] `/api/tools/quantum` uses real `scicomp-quantum-mcp` with Gemini fallback
- [ ] `/api/tools/molecular` uses real `scicomp-molecular-mcp` with Gemini fallback
- [ ] `/api/tools/neural` uses real `scicomp-neural-mcp` with Gemini fallback
- [ ] `/api/tools/playwright` integrates `@playwright/mcp` with existing lib fallback
- [ ] All responses include `executionMode` field
- [ ] Agent prompt updated to reflect real MCP capability
- [ ] README.md and TECHNICAL_SPECIFICATION.md updated
- [ ] Build passes: `npm run build`

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

