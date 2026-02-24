# Open Insight — Debug Report & AI Studio Fork Prompt

---

## PART 1 — Local Build Failure: Debug Report

This section explains why `npm install && npm run build && npm start` fails in the
environment captured in `2026-02-23T13_34_21_393Z-debug-0.log`.

### Environment (from log)

| Field | Value |
|---|---|
| Command run | `npm update` |
| Node.js | v20.19.4 |
| npm | v9.2.0 |
| OS / kernel | Linux 6.17.0-**PRoot-Distro** (ARM64) |
| Working directory | `/root/Open_Insight` |

### Root Cause 1 — Wrong command: `npm update` instead of `npm install`

`npm update` re-resolves all packages to the latest semver-compatible version and
rewrites `package-lock.json`. On a fresh clone you should always run `npm install`
(or `npm ci`) which installs exactly what `package-lock.json` specifies.
Using `npm update` here caused npm to fetch dozens of additional manifest files and
attempt to update transitive dependencies, which is both slower and riskier than a
clean install.

### Root Cause 2 — npm v9.2.0 + PRoot filesystem ENOENT on atomic rename

The fatal error in the log is:

```
error code ENOENT
error syscall rename
error path   /root/.npm/_cacache/tmp/080ecaaa
error dest   /root/.npm/_cacache/content-v2/sha512/3f/0e/...
error enoent Invalid response body while trying to fetch
             https://registry.npmjs.org/cross-spawn: ENOENT: no such file
             or directory, rename '/root/.npm/_cacache/tmp/...' ->
             '/root/.npm/_cacache/content-v2/...'
```

npm writes downloaded packages to a temp file then **atomically renames** them into
the cache. The PRoot filesystem emulation layer (`Linux 6.17.0-PRoot-Distro`) does
not properly support `rename()` across the directory paths that npm v9.2.0 uses,
causing the cache write to fail mid-tree-build. The installation never actually
starts — it aborts during `idealTree` resolution.

npm v9.2.0 is also very old (current stable is v10.x). The system-installed npm at
`/usr/share/nodejs/npm` is the Debian package version, not the current upstream.

### Root Cause 3 — `better-sqlite3` requires native compilation (separate failure)

Even if npm install succeeds, `better-sqlite3` will fail on this PRoot/ARM64
environment because:

- **prebuild-install** times out: it tries to download a pre-compiled `.node` binary
  from GitHub Releases, but the network request times out in this environment.
- **node-gyp rebuild** then runs as a fallback, invoking `gyp_main.py`. The
  system-installed `node-gyp` at `/usr/share/nodejs/node-gyp` uses Python 3.13,
  which is incompatible with older gyp versions.
- No C++ build toolchain (or an incomplete one) is available inside PRoot.

### How to fix the local install

Apply these steps **in order**:

```bash
# 1. Upgrade npm to a current version (escapes the PRoot rename issue in many cases)
npm install -g npm@latest

# 2. Clear the corrupt cache
npm cache clean --force

# 3. Use a local cache directory that PRoot can write atomically
npm install --cache /tmp/npm-cache-oi

# 4. If better-sqlite3 still fails to compile, see Part 2.
#    The AI Studio port (Part 2) eliminates better-sqlite3 entirely,
#    which also fixes the local build permanently.

# 5. After a successful install, initialise the database:
npm run db:push
npm run db:seed

# 6. Create .env.local with your Gemini API key:
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 7. Start the dev server:
npm run dev
```

**Alternative (avoids PRoot rename entirely):** use `pnpm`, which uses hard-links
instead of renames for its cache:

```bash
npm install -g pnpm
pnpm install
```

---

## PART 2 — Copilot Agent Prompt: AI Studio Compatible Fork

> **How to use this section:**
> Fork this repository on GitHub, open a Copilot coding-agent session in the fork,
> and paste everything from the horizontal rule below to the end of this file as
> your prompt. The agent will make all the listed changes, commit them, and the
> resulting app will run out-of-the-box on
> [https://aistudio.google.com/apps/](https://aistudio.google.com/apps/) (or any
> standard Node.js host) with no native compilation required.

---

You are a GitHub Copilot coding agent working in a fork of the **Open Insight**
repository — a Next.js 16 multi-agent academic reasoning platform.

**Your single goal:** make the app run out-of-the-box on
[Google AI Studio Apps](https://aistudio.google.com/apps/) with no native
compilation step. The app currently depends on `better-sqlite3`, a native Node.js
addon that requires C++ build tools. All the data the database holds is already
present as static TypeScript files in `src/data/`. Your job is to eliminate the
native database layer and wire everything directly to those static files.

### What you must NOT change

- `src/data/agents.ts`, `src/data/debates.ts`, `src/data/forums.ts`,
  `src/data/verifications.ts` — these are the source of truth; leave them exactly
  as-is.
- `src/lib/gemini.ts` — the Gemini streaming logic is correct; no changes needed.
- `src/lib/pyodide.ts` — Pyodide loads from CDN client-side; no changes needed.
- All UI components in `src/components/` and `src/app/` **except** the four API
  route files listed in Step 4.
- `src/app/globals.css`, `src/app/layout.tsx`, `next.config.ts`.

### Overview of changes

| Action | Files |
|---|---|
| **Rewrite** | `src/lib/queries.ts` |
| **Rewrite** | `src/app/api/verifications/[id]/stream/route.ts` |
| **Rewrite** | `src/app/api/verifications/route.ts` |
| **Rewrite** | `src/app/api/forums/[slug]/threads/route.ts` |
| **Rewrite** | `src/app/api/forums/[slug]/threads/[threadId]/upvote/route.ts` |
| **Update** | `package.json` |
| **Delete** | `src/db/` (entire directory) |
| **Delete** | `drizzle.config.ts` |
| **Create** | `.env.local.example` |

---

### Step 1 — Update `package.json`

Remove the native and database-related dependencies, and drop the database
maintenance scripts. Make **only** the changes shown; do not alter any other
field.

**In `dependencies`, remove these two entries:**

```diff
-    "better-sqlite3": "^12.6.2",
-    "drizzle-orm": "^0.45.1",
```

**In `devDependencies`, remove these two entries:**

```diff
-    "@types/better-sqlite3": "^7.6.13",
-    "drizzle-kit": "^0.31.9",
```

**In `scripts`, remove these three entries:**

```diff
-    "db:push": "drizzle-kit push",
-    "db:seed": "tsx src/db/seed.ts",
-    "db:reset": "rm -f open-insight.db && npm run db:push && npm run db:seed",
```

After editing, run `npm install` to regenerate `package-lock.json`.

---

### Step 2 — Rewrite `src/lib/queries.ts`

Replace the **entire file** with the following. This module now reads directly
from the static data files instead of hitting SQLite. Every function signature and
return shape is kept identical so no other file needs touching.

```typescript
// Static-data replacement for the SQLite/Drizzle queries layer.
// All data is sourced from src/data/*.ts; no database connection is needed.

import {
  agents as agentData,
  polarPairs as polarPairData,
  domainColors,
} from "@/data/agents";
import type { Agent } from "@/data/agents";
import { debates as debateData } from "@/data/debates";
import type { Debate } from "@/data/debates";
import { forums as forumData } from "@/data/forums";
import type { Forum, ForumThread } from "@/data/forums";
import { verifications as verificationData } from "@/data/verifications";
import type { VerificationEntry } from "@/data/verifications";

export { domainColors };

// --- Agents ---

export function getAgents(domain?: string): Agent[] {
  if (domain) return agentData.filter((a) => a.domain === domain);
  return agentData;
}

export function getAgentById(id: string): Agent | undefined {
  return agentData.find((a) => a.id === id);
}

// --- Polar Pairs ---

export function getPolarPairs() {
  return polarPairData.map((p) => ({
    domain: p.domain,
    agents: p.agents as [string, string],
    tension: p.tension,
  }));
}

// --- Debates ---

export function getDebates(status?: string) {
  const rows = status
    ? debateData.filter((d) => d.status === status)
    : debateData;
  return rows.map((d) => {
    const { messages, ...rest } = d;
    return {
      ...rest,
      messageCount: messages.length,
    };
  });
}

export function getDebateById(id: string): Debate | undefined {
  return debateData.find((d) => d.id === id);
}

// --- Forums ---

// In-memory store for threads created during this server instance.
// Next.js server-component re-renders will see these threads via
// getForums / getForumBySlug because both functions merge them in.
const _newThreads = new Map<string, ForumThread[]>();

export function addThread(forumSlug: string, thread: ForumThread): void {
  const existing = _newThreads.get(forumSlug) ?? [];
  _newThreads.set(forumSlug, [...existing, thread]);
}

export function getForums(): Forum[] {
  return forumData.map((f) => ({
    ...f,
    threads: [...f.threads, ...(_newThreads.get(f.slug) ?? [])],
  }));
}

export function getForumBySlug(slug: string): Forum | undefined {
  const f = forumData.find((f) => f.slug === slug);
  if (!f) return undefined;
  return {
    ...f,
    threads: [...f.threads, ...(_newThreads.get(slug) ?? [])],
  };
}

// --- Verifications ---

export function getVerifications(tier?: string, status?: string): VerificationEntry[] {
  let rows = verificationData as VerificationEntry[];
  if (tier) rows = rows.filter((v) => v.tier === tier);
  if (status) rows = rows.filter((v) => v.status === status);
  return rows;
}

// --- Stats ---

export function getStats() {
  const totalDebates = debateData.length;
  const liveDebates = debateData.filter((d) => d.status === "live").length;
  const totalRounds = debateData.reduce((sum, d) => sum + d.rounds, 0);
  const totalSpectators = debateData.reduce((sum, d) => sum + d.spectators, 0);
  const averageSpectators =
    totalDebates > 0 ? Math.round(totalSpectators / totalDebates) : 0;

  return {
    totalDebates,
    liveDebates,
    totalRounds,
    totalVerifications: verificationData.length,
    averageSpectators,
  };
}
```

---

### Step 3 — Rewrite `src/app/api/verifications/[id]/stream/route.ts`

Replace the **entire file**. Remove the `@/db` import and all database writes.
The simulation logic is preserved exactly; it just no longer persists state.

```typescript
import { NextRequest } from "next/server";
import { verifications as verificationData } from "@/data/verifications";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const verification = verificationData.find((v) => v.id === id);
  if (!verification) {
    return new Response(JSON.stringify({ error: "Verification not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Already completed — return final state immediately
  if (verification.status === "passed" || verification.status === "failed") {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              status: verification.status,
              details: verification.details,
              confidence: verification.confidence,
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Simulate a verification pipeline (no DB writes in the stateless port)
  const encoder = new TextEncoder();
  const tier = verification.tier;

  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ status: "running", details: `Starting ${tier} verification...`, confidence: null })}\n\n`,
        ),
      );
      await delay(tier === "Tier 1" ? 500 : tier === "Tier 2" ? 1500 : 4000);

      if (tier === "Tier 2" || tier === "Tier 3") {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "running", details: "Parsing claim structure...", confidence: null })}\n\n`,
          ),
        );
        await delay(1000);
      }
      if (tier === "Tier 3") {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "running", details: "Compiling formal proof...", confidence: null })}\n\n`,
          ),
        );
        await delay(2000);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "running", details: "Checking proof term against axioms...", confidence: null })}\n\n`,
          ),
        );
        await delay(1500);
      }

      const passed = Math.random() > 0.2;
      const confidence = passed
        ? tier === "Tier 3"
          ? 100
          : tier === "Tier 2"
            ? 90 + Math.floor(Math.random() * 8)
            : 99
        : 30 + Math.floor(Math.random() * 20);
      const finalStatus = passed ? "passed" : "failed";
      const duration =
        tier === "Tier 1"
          ? "<10ms"
          : tier === "Tier 2"
            ? `${500 + Math.floor(Math.random() * 500)}ms`
            : `${3 + Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}s`;
      const details = passed
        ? `${tier} verification completed successfully. Claim is consistent.`
        : `${tier} verification failed. Claim could not be confirmed.`;

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ status: finalStatus, details, confidence, duration })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

### Step 4 — Rewrite `src/app/api/verifications/route.ts`

Replace the **entire file**. The GET handler stays identical; the POST handler
returns a mock entry without writing to any database.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifications } from "@/lib/queries";

export function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get("tier") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const verifications = getVerifications(tier, status);
  return NextResponse.json({ verifications });
}

export async function POST(request: NextRequest) {
  let body: { claim?: string; tier?: string; tool?: string; agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { claim, tier, tool, agentId } = body;

  if (!claim || !tier || !tool || !agentId) {
    return NextResponse.json(
      { error: "claim, tier, tool, and agentId are required" },
      { status: 400 },
    );
  }

  // State is not persisted in the stateless port. Reuse an existing sample
  // verification id for this tier (if available) so that the streaming
  // endpoint, which only knows about the mock data set, can operate on it.
  const existingForTier = getVerifications(tier, undefined);
  const existing = existingForTier[0];
  const id = existing?.id ?? `v-${crypto.randomUUID()}`;
  const status = existing?.status ?? "queued";
  return NextResponse.json(
    { verification: { id, claim, tier, status } },
    { status: 201 },
  );
}
```

---

### Step 5 — Rewrite `src/app/api/forums/[slug]/threads/route.ts`

Replace the **entire file**. Calls `addThread` from `queries.ts` so that
`router.refresh()` in the forum client picks up newly created threads via
`getForumBySlug`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { addThread } from "@/lib/queries";
import type { ForumThread } from "@/data/forums";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let body: {
    title?: string;
    authorId?: string;
    author?: string;
    tags?: string[];
    excerpt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { title, authorId, author, tags, excerpt } = body;

  if (!title || !authorId || !author) {
    return NextResponse.json(
      { error: "title, authorId, and author are required" },
      { status: 400 },
    );
  }

  const thread: ForumThread = {
    id: `thread-${crypto.randomUUID()}`,
    title,
    author,
    authorId,
    timestamp: new Date().toISOString(),
    replyCount: 0,
    verificationStatus: "unverified",
    tags: tags ?? [],
    excerpt: excerpt ?? "",
    upvotes: 0,
    views: 0,
  };

  // Store in the in-memory map so getForumBySlug reflects the new thread
  // immediately after the client calls router.refresh().
  addThread(slug, thread);

  return NextResponse.json({ thread }, { status: 201 });
}
```

---

### Step 6 — Rewrite `src/app/api/forums/[slug]/threads/[threadId]/upvote/route.ts`

Replace the **entire file**. Removes the DB update; upvote count is maintained
client-side in the stateless port.

```typescript
import { NextRequest, NextResponse } from "next/server";

export function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; threadId: string }> },
) {
  return params.then(({ threadId }) => {
    return NextResponse.json({ success: true, threadId });
  });
}
```

---

### Step 7 — Delete the database directory and Drizzle config

Delete the following files and directory entirely. Nothing in the app will import
from them after the changes above.

```
src/db/index.ts
src/db/schema.ts
src/db/seed.ts
drizzle.config.ts
```

If the `src/db/` directory becomes empty, remove the directory itself too.
Also delete any `*.db`, `*.db-shm`, or `*.db-wal` files in the repository root
(e.g. `open-insight.db`) if present.

---

### Step 8 — Create `.env.local.example` and update `.gitignore`

First, add an exception to `.gitignore` so that the example file can be committed.
The existing `.env*` rule would otherwise swallow it. Add this line immediately
after the existing `.env*` entry:

```diff
 # env files (can opt-in for committing if needed)
 .env*
+!.env.local.example
```

Then create a new file at the repository root named `.env.local.example` with this
exact content:

```
# Copy this file to .env.local and fill in your Gemini API key.
# When deploying to Google AI Studio Apps, the platform injects
# GEMINI_API_KEY automatically — no manual setup required.
GEMINI_API_KEY=your_gemini_api_key_here
```

---

### Step 9 — Verify the build

Run the following commands in order. All must succeed with no errors.

```bash
# Install dependencies (no native compilation now)
npm install

# TypeScript type-check
npx tsc --noEmit

# Production build
npm run build

# Optional: smoke-test the dev server
npm run dev
```

Expected result: `npm run build` completes with output similar to:
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
```

If the TypeScript check reports an error about a missing import in `queries.ts`,
verify that `src/data/agents.ts` exports `domainColors` (it does — confirmed in
the source). If it reports an error about `VerificationEntry` tier type mismatch,
add an explicit cast `as VerificationEntry[]` in `getVerifications`.

---

### Step 10 — Set your Gemini API key

For local development:

```bash
cp .env.local.example .env.local
# Edit .env.local and replace 'your_gemini_api_key_here' with your real key
# from https://aistudio.google.com/apikey
```

For Google AI Studio Apps deployment:
- The platform injects `GEMINI_API_KEY` into the runtime environment automatically.
- No `.env.local` file is needed when deploying there.

---

### What the completed fork provides

| Feature | Status after port |
|---|---|
| All pages (home, agents, debates, forums, verification, tools, knowledge, formalism) | ✅ Fully functional |
| Gemini streaming agent reasoning (`/api/agents/[id]/reason`) | ✅ Unchanged |
| Lean 4 proof checker (simulated fallback) | ✅ Unchanged |
| Python notebook (Pyodide from CDN) | ✅ Unchanged |
| Knowledge graph (D3.js) | ✅ Unchanged |
| Paper search | ✅ Unchanged |
| Forum upvotes / new threads / new verifications | ✅ In-memory (not persisted across page reloads — acceptable for a demo) |
| `better-sqlite3` native compilation | ✅ **Eliminated** |
| `drizzle-orm` / `drizzle-kit` | ✅ **Eliminated** |
| Runs on AI Studio Apps / Vercel / Railway / any Node.js host | ✅ Yes |
| Runs on PRoot/ARM64/Termux without build tools | ✅ Yes |
