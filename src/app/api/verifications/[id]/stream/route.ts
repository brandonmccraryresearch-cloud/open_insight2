import { NextRequest } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const verification = db.select().from(schema.verifications).where(eq(schema.verifications.id, id)).get();
  if (!verification) {
    return new Response(JSON.stringify({ error: "Verification not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If already completed, return the final state immediately
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

  // Simulate a verification pipeline with status transitions
  const encoder = new TextEncoder();
  const tier = verification.tier;
  const body = new ReadableStream({
    async start(controller) {
      // Transition: queued → running
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: `Starting ${tier} verification...`, confidence: null })}\n\n`));
      db.update(schema.verifications).set({ status: "running", details: `Running ${tier} verification...`, timestamp: "running..." }).where(eq(schema.verifications.id, id)).run();

      await delay(tier === "Tier 1" ? 500 : tier === "Tier 2" ? 1500 : 4000);

      // Progress updates
      if (tier === "Tier 2" || tier === "Tier 3") {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: "Parsing claim structure...", confidence: null })}\n\n`));
        await delay(1000);
      }
      if (tier === "Tier 3") {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: "Compiling formal proof...", confidence: null })}\n\n`));
        await delay(2000);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "running", details: "Checking proof term against axioms...", confidence: null })}\n\n`));
        await delay(1500);
      }

      // Final result (simulate pass/fail based on tier)
      const passed = Math.random() > 0.2; // 80% pass rate
      const confidence = passed ? (tier === "Tier 3" ? 100 : tier === "Tier 2" ? 90 + Math.floor(Math.random() * 8) : 99) : 30 + Math.floor(Math.random() * 20);
      const finalStatus = passed ? "passed" : "failed";
      const duration = tier === "Tier 1" ? "<10ms" : tier === "Tier 2" ? `${500 + Math.floor(Math.random() * 500)}ms` : `${3 + Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}s`;
      const details = passed
        ? `${tier} verification completed successfully. Claim is consistent.`
        : `${tier} verification failed. Claim could not be confirmed.`;

      db.update(schema.verifications).set({
        status: finalStatus,
        details,
        confidence,
        duration,
        timestamp: "just now",
      }).where(eq(schema.verifications.id, id)).run();

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
