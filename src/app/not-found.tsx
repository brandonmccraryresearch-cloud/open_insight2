import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-enter p-6 max-w-2xl mx-auto text-center" style={{ marginTop: "10vh" }}>
      <div className="glass-card p-8">
        <h2 className="text-4xl font-bold font-mono text-[var(--accent-teal)] mb-4">404</h2>
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Page Not Found</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl bg-[var(--accent-teal)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
