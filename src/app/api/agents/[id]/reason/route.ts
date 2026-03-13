import { NextRequest } from "next/server";
import { streamAgentReasoning } from "@/lib/gemini";
import { runLean4Check } from "@/lib/lean4";

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { prompt } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = await streamAgentReasoning(id, prompt);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      // For the HLRE agent we accumulate text so we can extract Lean 4 code
      // blocks and route them through the internal lean4_prover after the
      // Gemini stream completes.
      const accumulatedText = id === "irh-hlre" ? { value: "" } : null;

      try {
        for await (const chunk of stream) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts as Array<{
            text?: string;
            codeExecutionResult?: { output?: string };
          }>) {
            const text = part.text ?? part.codeExecutionResult?.output ?? "";
            if (text) {
              if (accumulatedText) accumulatedText.value += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
        }

        // HLRE post-processing: extract ```lean blocks and run through the
        // internal lean4_prover, injecting results before [DONE].
        if (accumulatedText) {
          // Match fenced Lean blocks that start at the beginning of a line:
          // ```lean
          // <code>
          // ```
          const lean4Blocks = [
            ...accumulatedText.value.matchAll(/^```lean[^\n]*\n([\s\S]*?)^```/gm),
          ];
          for (const match of lean4Blocks) {
            const code = match[1].trim();
            if (!code) continue;
            try {
              const result = await runLean4Check(code);
              const summary =
                `\n[lean4_prover] status=${result.status} | mode=${result.executionMode}` +
                (result.warnings.length ? ` | warnings: ${result.warnings.join("; ")}` : "") +
                (result.errors.length ? ` | errors: ${result.errors.join("; ")}` : "") +
                (result.goals.length ? ` | goals: ${result.goals.join("; ")}` : "") +
                ` | checkTime=${result.checkTime}`;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: summary })}\n\n`));
            } catch (leanErr: unknown) {
              // Non-fatal: lean4 tool error does not abort the stream
              const leanMsg = leanErr instanceof Error ? leanErr.message : "lean4_prover error";
              console.error("[irh-hlre lean4_prover]", leanMsg);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: `\n[lean4_prover] error: ${leanMsg}` })}\n\n`)
              );
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
