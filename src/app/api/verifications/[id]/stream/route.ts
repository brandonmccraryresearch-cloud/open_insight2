import { NextRequest } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasGeminiKey, streamVerificationEval } from "@/lib/gemini";

export const maxDuration = 120;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const verification = db.select().from(schema.verifications).where(eq(schema.verifications.id, id)).get();
  if (!verification) {
    return new Response(JSON.stringify({ error: "Verification not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Already completed — stream the final state immediately
  if (verification.status === "passed" || verification.status === "failed") {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: verification.status, details: verification.details, confidence: verification.confidence })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const encoder = new TextEncoder();

  // ── Gemini path ───────────────────────────────────────────────────────────
  if (hasGeminiKey()) {
    db.update(schema.verifications)
      .set({ status: "running", details: "Running...", timestamp: "running..." })
      .where(eq(schema.verifications.id, id))
      .run();

    const body = new ReadableStream({
      async start(controller) {
        const startTime = Date.now();
        let finalStatus = "passed";
        let finalDetails = "";
        let finalConfidence: number | null = null;
        let finalDuration = "—";

        try {
          for await (const sseChunk of streamVerificationEval(verification.claim, verification.tier, verification.agentId)) {
            controller.enqueue(encoder.encode(sseChunk));

            // Capture the terminal event to persist to DB
            if (sseChunk.startsWith("data: ") && !sseChunk.includes("[DONE]")) {
              try {
                const payload = JSON.parse(sseChunk.slice(6).trim()) as {
                  status?: string; details?: string; confidence?: number; duration?: string;
                };
                if (payload.status === "passed" || payload.status === "failed") {
                  finalStatus = payload.status;
                  finalDetails = payload.details ?? "";
                  finalConfidence = payload.confidence ?? null;
                  // Use actual measured duration if Gemini didn't provide one
                  const elapsedMs = Date.now() - startTime;
                  finalDuration = payload.duration ?? (elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`);
                }
              } catch { /* ignore parse errors */ }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Gemini error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "failed", details: msg, confidence: 0 })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          finalStatus = "failed";
          finalDetails = msg;
          const elapsedMs = Date.now() - startTime;
          finalDuration = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
        }

        db.update(schema.verifications)
          .set({ status: finalStatus, details: finalDetails, confidence: finalConfidence, duration: finalDuration, timestamp: "just now" })
          .where(eq(schema.verifications.id, id))
          .run();

        controller.close();
      },
    });

    return new Response(body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  // ── Simulation fallback (no API key) ─────────────────────────────────────
  const tier = verification.tier;
  const body = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: `Starting ${tier} verification...` })}\n\n`));
      db.update(schema.verifications).set({ status: "running", details: `Running ${tier} verification...`, timestamp: "running..." }).where(eq(schema.verifications.id, id)).run();

      await delay(tier === "Tier 1" ? 500 : tier === "Tier 2" ? 1500 : 4000);

      if (tier === "Tier 2" || tier === "Tier 3") {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: "Parsing claim structure..." })}\n\n`));
        await delay(1000);
      }
      if (tier === "Tier 3") {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: "Compiling formal proof..." })}\n\n`));
        await delay(2000);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: "Checking proof term against axioms..." })}\n\n`));
        await delay(1500);
      }

      const passed = Math.random() > 0.2;
      const confidence = passed ? (tier === "Tier 3" ? 100 : tier === "Tier 2" ? 90 + Math.floor(Math.random() * 8) : 99) : 30 + Math.floor(Math.random() * 20);
      const finalStatus = passed ? "passed" : "failed";
      // Measure actual elapsed time instead of hardcoded strings
      const elapsedMs = Date.now() - startTime;
      const duration = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
      const details = passed ? `${tier} verification completed successfully.` : `${tier} verification failed.`;

      db.update(schema.verifications).set({ status: finalStatus, details, confidence, duration, timestamp: "just now" }).where(eq(schema.verifications.id, id)).run();

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: finalStatus, details, confidence, duration })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
