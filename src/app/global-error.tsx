"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-mesh" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            color: "#e2e8f0",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem", maxWidth: 480, textAlign: "center" }}>
            An unexpected error occurred. Please try again or contact the platform administrator.
          </p>
          {error?.digest && (
            <p style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "1rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.1)",
              backgroundColor: "rgba(0,0,0,0.4)",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
