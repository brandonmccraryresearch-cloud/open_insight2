import { execFile } from "child_process";
import { writeFile, unlink, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { verifyLean4WithGemini, hasGeminiKey } from "@/lib/gemini";

export interface Lean4Result {
  status: "success" | "warning" | "error" | "incomplete";
  goals: string[];
  hypotheses: string[];
  warnings: string[];
  errors: string[];
  checkTime: string;
  executionMode: "native" | "gemini";
  leanVersion?: string;
  mathlibVersion?: string;
}

function runLean(
  filePath: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile("lean", [filePath], { timeout: 30000 }, (error, stdout, stderr) => {
      let exitCode = 0;
      if (error) {
        const errWithStatus = error as NodeJS.ErrnoException & { status?: number; code?: number | string };
        if (typeof errWithStatus.code === "number") {
          exitCode = errWithStatus.code;
        } else if (typeof errWithStatus.status === "number") {
          exitCode = errWithStatus.status;
        } else {
          exitCode = 1;
        }
      }
      resolve({ stdout: stdout || "", stderr: stderr || "", exitCode });
    });
  });
}

export function checkLeanAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("lean", ["--version"], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Run a Lean 4 check using the native binary when available, otherwise fall
 * back to Gemini semantic verification. The simulation fallback has been
 * removed — every path produces real verification output.
 *
 * Throws if neither the native binary nor a Gemini API key is available.
 */
export async function runLean4Check(code: string): Promise<Lean4Result> {
  const startTime = Date.now();
  const leanAvailable = await checkLeanAvailable();

  if (leanAvailable) {
    const workDir = join(tmpdir(), `lean4-${randomUUID()}`);
    const filePath = join(workDir, "check.lean");

    try {
      await mkdir(workDir, { recursive: true });
      await writeFile(filePath, code, "utf-8");

      const result = await runLean(filePath);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      const warnings: string[] = [];
      const errors: string[] = [];
      const goals: string[] = [];
      const hypotheses: string[] = [];

      const lines = (result.stdout + "\n" + result.stderr).split("\n").filter(Boolean);
      for (const line of lines) {
        if (line.includes("warning:")) {
          warnings.push(line.replace(/^.*warning:\s*/, "").trim());
        } else if (line.includes("error:")) {
          errors.push(line.replace(/^.*error:\s*/, "").trim());
        } else if (line.startsWith("⊢") || line.includes("⊢")) {
          goals.push(line.trim());
        }
      }

      const hMatches = code.matchAll(/\((\w+)\s*:\s*([^)]+)\)/g);
      for (const m of hMatches) {
        hypotheses.push(`${m[1]} : ${m[2]}`);
      }

      const hasSorry = /\bsorry\b/.test(code);
      const status =
        errors.length > 0 ? "error" : hasSorry ? "warning" : result.exitCode === 0 ? "success" : "error";

      return { status, goals, hypotheses, warnings, errors, checkTime: `${elapsed}s`, executionMode: "native" };
    } finally {
      await unlink(filePath).catch((err) => {
        console.error("Failed to delete Lean temporary file:", filePath, err);
      });
      await rm(workDir, { recursive: true, force: true }).catch((err) => {
        console.error("Failed to remove Lean temporary directory:", workDir, err);
      });
    }
  }

  // Native binary not available — use Gemini semantic verification (real, not simulated).
  if (!hasGeminiKey()) {
    throw new Error(
      "Lean 4 is unavailable: neither the lean binary nor a GEMINI_API_KEY is configured."
    );
  }

  const geminiResult = await verifyLean4WithGemini(code);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  return { ...geminiResult, checkTime: `${elapsed}s`, executionMode: "gemini" };
}

