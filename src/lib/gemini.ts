import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import { getAgentById } from "@/lib/queries";

function getGenAI() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. Please configure a valid Gemini API key before using the Gemini client.",
    );
  }
  return new GoogleGenAI({ apiKey: geminiApiKey });
}

export interface ReasoningRequest {
  agentId: string;
  prompt: string;
}

function buildSystemPrompt(agent: ReturnType<typeof getAgentById>) {
  if (!agent) return "You are a research agent.";

  return `You are ${agent.name}, ${agent.title}.

Domain: ${agent.domain} — ${agent.subfield}
Epistemic Stance: ${agent.epistemicStance}
Verification Standard: ${agent.verificationStandard}
Ontological Commitment: ${agent.ontologicalCommitment}
Falsifiability Threshold: ${agent.falsifiabilityThreshold}
Approach: ${agent.approach}
Methodological Priors: ${((agent.methodologicalPriors ?? []) as string[]).join(", ")}
Formalisms: ${((agent.formalisms ?? []) as string[]).join(", ")}
Energy Scale: ${agent.energyScale}

You reason through problems in 4 phases. For EACH phase, output a JSON object on its own line in this exact format:

{"phase":"decomposition","content":"your analysis here"}
{"phase":"tool-thinking","content":"your computation here","tool":"tool name"}
{"phase":"critique","content":"your self-review here"}
{"phase":"synthesis","content":"your final result here"}

After all 4 phases, output a final summary line:
{"final":true,"answer":"one sentence answer","confidence":85,"verificationMethod":"method used"}

Rules:
- Use LaTeX notation with $...$ for inline and $$...$$ for display math
- Be rigorous and precise — cite specific formulas, theorems, papers
- In tool-thinking, show dimensional analysis, symbolic computation, or formal proof steps
- In critique, genuinely check your work and flag uncertainties
- Stay in character: your epistemic stance shapes how you frame results
- Keep each phase to 2-4 paragraphs maximum`;
}

const MODEL = "gemini-3.1-pro-preview";

export async function streamAgentReasoning(agentId: string, prompt: string) {
  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  const systemPrompt = buildSystemPrompt(agent);

  return getGenAI().models.generateContentStream({
    model: MODEL,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ urlContext: {} }, { codeExecution: {} }, { googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      topP: 1,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
}
