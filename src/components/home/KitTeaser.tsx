import Link from "next/link";
import { formatBytes } from "@/lib/format";
import { site } from "@/lib/site";
import { getBuildStats } from "@/lib/stats";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 border-t border-line py-3">
      <dt className="text-paper-dim">{k}</dt>
      <dd className="hud text-[12px] text-paper">{v}</dd>
    </div>
  );
}

export function KitTeaser() {
  const stats = getBuildStats();
  return (
    <section aria-label="Kit and colophon" className="gutter grid gap-16 py-24 md:grid-cols-12">
      <div className="md:col-span-5">
        <h2 className="micro mb-8 text-paper-dim">Kit</h2>
        <dl>
          <Row k="Camera" v={site.camera} />
          {site.lenses.length > 0 ? (
            site.lenses.map((l, i) => <Row key={l} k={`Lens ${i + 1}`} v={l} />)
          ) : (
            <Row k="Lenses" v="To be added" />
          )}
        </dl>
      </div>
      <div className="md:col-span-5 md:col-start-8">
        <h2 className="micro mb-8 text-paper-dim">Colophon</h2>
        <dl>
          <Row k="Photos" v={String(stats.frames)} />
          <Row k="Saved by image pipeline" v={formatBytes(stats.bytesSaved)} />
          <Row k="Lighthouse (mobile)" v={stats.lighthouse ? String(stats.lighthouse.performance) : "Pending"} />
        </dl>
        <Link href="/colophon" className="micro mt-6 inline-block text-paper-dim transition-colors hover:text-paper">
          How it&apos;s built →
        </Link>
      </div>
    </section>
  );
}
