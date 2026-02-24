"use client";
import { useState, useRef, useCallback, useEffect } from "react";

export type PyodideStatus = "idle" | "loading" | "ready" | "error";

const PYODIDE_VERSION = "0.27.5";

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
}

export function usePyodide() {
  const [status, setStatus] = useState<PyodideStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pyodideRef = useRef<PyodideInstance | null>(null);
  const loadingRef = useRef(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const mountedRef = useRef(true);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current || loadingRef.current) return;
    loadingRef.current = true;
    if (mountedRef.current) {
      setStatus("loading");
      setError(null);
    }

    try {
      // Load Pyodide from CDN
      const script = document.createElement("script");
      script.src = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
      script.async = true;
      scriptRef.current = script;

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide script"));
        document.head.appendChild(script);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pyodide = await (window as any).loadPyodide({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
      }) as PyodideInstance;

      pyodideRef.current = pyodide;
      if (mountedRef.current) setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize Pyodide";
      if (mountedRef.current) {
        setError(message);
        setStatus("error");
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Mutex to serialize Python execution and prevent stdout/stderr interleaving
  const executionLockRef = useRef<Promise<void>>(Promise.resolve());

  const runPython = useCallback(async (code: string): Promise<{ output: string; error: string | null }> => {
    const pyodide = pyodideRef.current;
    if (!pyodide) {
      return { output: "", error: "Pyodide is not loaded" };
    }

    // Chain execution to serialize concurrent calls
    const resultPromise = executionLockRef.current.then(async () => {
      try {
        // Auto-load packages referenced in the code
        await pyodide.loadPackagesFromImports(code);

        // Capture stdout/stderr
        await pyodide.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);

        let result: unknown;
        let stdout = "";
        let stderr = "";

        try {
          result = await pyodide.runPythonAsync(code);
          stdout = await pyodide.runPythonAsync("sys.stdout.getvalue()") as string;
          stderr = await pyodide.runPythonAsync("sys.stderr.getvalue()") as string;
        } finally {
          // Reset stdout/stderr even if an error occurs while running code or capturing output
          await pyodide.runPythonAsync(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
        }

        let output = stdout || "";
        if (result !== undefined && result !== null && String(result) !== "None") {
          output += (output ? "\n" : "") + String(result);
        }
        if (stderr) {
          output += (output ? "\n" : "") + stderr;
        }

        return { output: output || "# No output", error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { output: "", error: message };
      }
    });

    // Update the lock to wait for this execution to finish
    executionLockRef.current = resultPromise.then(() => {}, () => {});

    return resultPromise;
  }, []);

  // Auto-load on mount and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    loadPyodide();
    return () => {
      mountedRef.current = false;
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, [loadPyodide]);

  return { status, error, runPython, loadPyodide };
}
