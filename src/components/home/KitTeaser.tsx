import { site } from "@/lib/site";

function Row({ k, v, children }: { k: string; v?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-t border-line py-3">
      <dt className="text-paper-dim">{k}</dt>
      <dd className="hud text-right text-[12px] text-paper">{children ?? v}</dd>
    </div>
  );
}

export function KitTeaser() {
  return (
    <section aria-label="Kit and contact" className="gutter grid gap-16 py-24 md:grid-cols-12">
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
        <h2 className="micro mb-8 text-paper-dim">Contact</h2>
        <dl>
          <Row k="Instagram">
            <a href={site.instagram} target="_blank" rel="noreferrer" className="transition-colors hover:text-signal">
              @{site.handle}
            </a>
          </Row>
          {site.email && (
            <Row k="Email">
              <a href={`mailto:${site.email}`} className="break-all normal-case transition-colors hover:text-signal">
                {site.email}
              </a>
            </Row>
          )}
        </dl>
      </div>
    </section>
  );
}
