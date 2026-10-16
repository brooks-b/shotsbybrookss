import { site } from "@/lib/site";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 border-t border-line py-3">
      <dt className="text-paper-dim">{k}</dt>
      <dd className="hud text-[12px] text-paper">{v}</dd>
    </div>
  );
}

export function KitTeaser() {
  return (
    <section aria-label="Kit" className="gutter grid gap-16 py-24 md:grid-cols-12">
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
    </section>
  );
}
