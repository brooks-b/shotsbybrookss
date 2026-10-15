import Link from "next/link";

export default function NotFound() {
  return (
    <div className="gutter flex min-h-[80svh] flex-col justify-end pb-16 pt-[var(--header-h)]">
      <p className="micro text-paper-faint">404</p>
      <h1 className="display mt-6 text-[clamp(52px,9vw,160px)]">No frame here</h1>
      <Link href="/" className="micro mt-10 text-paper-dim transition-colors hover:text-paper">
        ← Back home
      </Link>
    </div>
  );
}
