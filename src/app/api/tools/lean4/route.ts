import { NextRequest, NextResponse } from "next/server";
import { runLean4Check, checkLeanAvailable } from "@/lib/lean4";

// Concurrency cap for native Lean execution to prevent CPU exhaustion.
// NOTE: This counter is maintained in-process at the module level, so in
// serverless or multi-instance deployments the effective global limit is
// MAX_CONCURRENT_LEAN * (number of instances). To enforce a true global
// concurrency limit across instances, use a shared store (e.g. Redis/DB) or
// a distributed rate limiter outside this handler.
const MAX_CONCURRENT_LEAN = 3;
let activeLeanProcesses = 0;

export async function POST(request: NextRequest) {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { code } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  // Input validation: limit code size to prevent abuse
  if (code.length > 50000) {
    return NextResponse.json({ error: "Code exceeds maximum length of 50000 characters" }, { status: 400 });
  }

  const leanAvailable = await checkLeanAvailable();
  if (leanAvailable) {
    if (activeLeanProcesses >= MAX_CONCURRENT_LEAN) {
      return NextResponse.json(
        { error: "Too many concurrent Lean processes. Please try again shortly." },
        { status: 429 }
      );
    }
    activeLeanProcesses++;
    try {
      const result = await runLean4Check(code, true);
      return NextResponse.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lean 4 verification failed";
      return NextResponse.json({ error: message }, { status: 503 });
    } finally {
      activeLeanProcesses--;
    }
  }

  try {
    const result = await runLean4Check(code, false);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lean 4 verification failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

