# Lean 4 Support in Open Insight

Lean 4 is integrated into the Open Insight platform as the Tier 3 formal verification engine. **Lean 4 execution is never simulated** — every verification path produces real output, either from the native `lean` binary or from Gemini semantic proof reasoning.

---

## Architecture

All Lean 4 verification flows through a single shared module:

```
src/lib/lean4.ts          ← Core: runLean4Check(), checkLeanAvailable(), resolveLeanBinary()
  ├─ Native path           execFile(lean, [file]) → parse stdout/stderr
  └─ Gemini fallback       verifyLean4WithGemini() in src/lib/gemini.ts
```

### Execution modes (field: `executionMode`)

| Mode | How it works | When it runs |
|------|-------------|--------------|
| `"native"` | Writes code to a temp file, runs the resolved `lean` binary, parses stdout/stderr for goals/warnings/errors | `lean --version` succeeds |
| `"gemini"` | Sends code to Gemini (`gemini-3.1-pro-preview`) at `ThinkingLevel.HIGH` with a structured Lean 4 type-theory system prompt; returns structured JSON verdict | Native binary not found and `GEMINI_API_KEY` is set |

If neither path is available, `runLean4Check` throws an error (surfaced as HTTP 503 by the API route).

There is no `"simulated"` mode. The regex-based `simulateLeanCheck` fallback was removed in PR #4.

---

## Binary resolution (`resolveLeanBinary` in `src/lib/lean4.ts`)

The lean binary is resolved in this order:

1. **`LEAN4_PATH`** environment variable — explicit path to the `lean` binary
2. **`~/.elan/bin/lean`** — elan-managed installation
3. **`lean`** on system `PATH`

The resolved path is cached for the lifetime of the process.

---

## Setup

### Install via elan

The project includes a `lean-toolchain` file at the repository root specifying the Lean 4 version (`leanprover/lean4:v4.15.0`). To install:

```bash
# Use the included install script
./scripts/install-lean4.sh

# Or install elan manually (it reads lean-toolchain automatically)
curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y
```

### Files

| File | Purpose |
|------|---------|
| `lean-toolchain` | Specifies `leanprover/lean4:v4.15.0` for elan |
| `scripts/install-lean4.sh` | Installs elan + the toolchain specified in `lean-toolchain` |

---

## API endpoint — `POST /api/tools/lean4`

**Source:** `src/app/api/tools/lean4/route.ts`

### Request

```json
{ "code": "theorem example : 1 + 1 = 2 := rfl" }
```

Code size is capped at 50,000 characters (HTTP 400 if exceeded).

### Response (success)

```json
{
  "status": "success",
  "goals": [],
  "hypotheses": [],
  "warnings": [],
  "errors": [],
  "checkTime": "1.2s",
  "executionMode": "native"
}
```

| Field | Type | Values |
|-------|------|--------|
| `status` | string | `"success"` · `"warning"` · `"error"` · `"incomplete"` |
| `goals` | string[] | Remaining proof obligations (e.g., `"⊢ ℕ"`) |
| `hypotheses` | string[] | Named hypotheses in scope (e.g., `"n : ℕ"`) |
| `warnings` | string[] | `sorry` usage, deprecated tactics |
| `errors` | string[] | Type errors, unresolved metavariables |
| `checkTime` | string | Elapsed time (e.g., `"1.2s"`) |
| `executionMode` | string | `"native"` or `"gemini"` |

### Error responses

| Status | When |
|--------|------|
| 400 | Missing/invalid `code`, or code exceeds 50,000 characters |
| 429 | Too many concurrent native Lean processes (limit: `MAX_CONCURRENT_LEAN = 3`) |
| 503 | Neither the lean binary nor `GEMINI_API_KEY` is configured |

### Concurrency

Up to `MAX_CONCURRENT_LEAN = 3` concurrent native Lean processes are allowed. This counter is per-process (module-level `let activeLeanProcesses`); in serverless deployments the effective limit is 3 × number of instances.

---

## Interactive UI — `/tools` page

**Source:** `src/app/tools/page.tsx`

The **Lean 4 Proof Assistant** tab provides:
- A **code editor** (textarea with monospace font) pre-populated with a constructive IVT proof sketch
- A **"Check Proof"** button that POSTs to `/api/tools/lean4`
- A **proof state panel** showing goals, hypotheses, warnings, errors, and check time from the API response

The tools page does **not** display `executionMode` in the UI.

---

## Step-by-step proof viewer

**Source:** `src/components/LeanProofStepper.tsx`

Exports `useLeanProofStepper(proofKey)` hook and two built-in proofs:

| Key | Name | Goals |
|-----|------|-------|
| `"ivt-constructive"` | Constructive Intermediate Value Theorem (Approximate) | 7/7 proved |
| `"dimensional-hawking"` | Hawking Temperature Dimensional Derivation | 4/4 proved |

Each proof has step-by-step tactic display with goals-before/goals-after and auto-play animation.

---

## Agent integration — IRH-HLRE lean4_prover

**Source:** `src/app/api/agents/[id]/reason/route.ts`

When the `irh-hlre` agent reasons, the streaming route:
1. Accumulates all streamed text from Gemini
2. After the stream completes, extracts all `` ```lean ... ``` `` fenced code blocks
3. Calls `runLean4Check(code)` directly for each block (no HTTP round-trip)
4. Injects the prover result (status, mode, warnings, errors, goals, checkTime) into the SSE stream before `[DONE]`
5. Lean 4 errors are logged to the server console and streamed to the client (non-fatal — they do not abort the stream)

The HLRE system prompt (in `src/lib/gemini.ts`) instructs the model to emit `` ```lean ... ``` `` blocks and labels this tool `lean4_prover` in its tool-thinking phase.

---

## Verification tiers

**Source:** `src/app/verification/VerificationClient.tsx`

| Tier | Tool | Description |
|------|------|-------------|
| Tier 1 | Dimensional Analysis | Unit consistency checking |
| Tier 2 | Symbolic Computation | Numerical/symbolic validation |
| Tier 3 | **Lean 4** | Machine-checked formal proofs |

The verification page shows a Lean 4 Proofs count (`Tier 3 && status === "passed"`).

---

## Navigation

**Source:** `src/components/Header.tsx`

The site header's Settings section includes a **"Lean 4 Prover"** link (navigates to `/tools`).

---

## Knowledge graph

**Source:** `src/app/knowledge/KnowledgeClient.tsx`

The knowledge graph includes a **Lean 4** concept node (`id: "c-lean4"`, domain: `"Foundations of Mathematics"`). It does not directly link to proof artifacts.

---

## All components using Lean 4

| Component | Path | What it does |
|-----------|------|--------------|
| Shared library | `src/lib/lean4.ts` | `runLean4Check()`, `checkLeanAvailable()`, `resolveLeanBinary()` |
| Gemini verification | `src/lib/gemini.ts` → `verifyLean4WithGemini()` | Structured Lean 4 proof analysis via Gemini at `ThinkingLevel.HIGH` |
| API route | `src/app/api/tools/lean4/route.ts` | `POST /api/tools/lean4` — concurrency-capped endpoint |
| Reason route | `src/app/api/agents/[id]/reason/route.ts` | Extracts `` ```lean ``` `` blocks from HLRE agent output and runs them |
| Tools page | `src/app/tools/page.tsx` | Interactive Lean 4 editor with "Check Proof" button |
| Proof stepper | `src/components/LeanProofStepper.tsx` | Step-by-step proof viewer with 2 built-in proofs |
| Verification page | `src/app/verification/VerificationClient.tsx` | Tier 3 = Lean 4 formal proof |
| Header | `src/components/Header.tsx` | "Lean 4 Prover" link in Settings |
| Knowledge graph | `src/app/knowledge/KnowledgeClient.tsx` | "Lean 4" concept node |

---

## Security considerations

The native Lean 4 execution path writes user-supplied code to a temporary file and runs the `lean` binary on it. While Lean 4 code is not a general-purpose scripting language, the following risks should be considered for production deployments:

- **`import` statements**: Lean 4 code can use `import` to access Lean source files readable by the process. A malicious user could craft imports to probe the local filesystem for Lean modules or, if the working directory contains sensitive files, potentially read them via error messages.
- **Resource exhaustion**: A malicious proof can consume unbounded CPU or memory. The current 30-second `execFile` timeout (`src/lib/lean4.ts`) limits CPU time but does not cap memory usage.
- **Recommended mitigations** for production:
  - Run the `lean` binary inside a sandboxed container (e.g., Docker, gVisor) or chroot with minimal filesystem permissions
  - Restrict outbound network access
  - Apply memory limits via cgroups or container resource constraints
  - Use a dedicated unprivileged user for the Lean process

The Gemini fallback path (`verifyLean4WithGemini`) sends code to the Gemini API and does not execute anything locally, so it carries no local execution risk.

---

## Changes in PR #4

The following changes were made to Lean 4 support in this pull request:

1. **Extracted `src/lib/lean4.ts`** — shared module with `runLean4Check()`, replacing inline code in the API route
2. **Removed `simulateLeanCheck`** — the regex-based simulation fallback is gone; `executionMode` is now `"native" | "gemini"` only
3. **Added `verifyLean4WithGemini()`** in `src/lib/gemini.ts` — sends Lean 4 code to Gemini at `ThinkingLevel.HIGH` with a structured type-theory system prompt for real semantic analysis
4. **Added binary resolution** — `resolveLeanBinary()` checks `LEAN4_PATH` → `~/.elan/bin/lean` → system PATH (cached)
5. **Added `lean-toolchain`** — specifies `leanprover/lean4:v4.15.0` for elan
6. **Added `scripts/install-lean4.sh`** — installs elan and the toolchain
7. **Added error handling** — API route returns HTTP 503 when neither backend is available; reason route logs and streams lean4 errors to the client
8. **Added IRH-HLRE agent integration** — reason route extracts `` ```lean ``` `` blocks and runs `runLean4Check` directly, injecting results into the SSE stream
