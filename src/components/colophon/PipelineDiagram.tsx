const STEPS = [
  { title: "Originals", detail: "content/collections/*/photos (git-ignored)" },
  { title: "Read EXIF", detail: "exifr + Fuji maker-note parser" },
  { title: "Derivatives", detail: "sharp: AVIF + WebP at 5 widths, max 2560px" },
  { title: "Placeholder", detail: "thumbhash + dominant colour" },
  { title: "Privacy", detail: "metadata stripped, GPS rounded to city" },
  { title: "Upload", detail: "Vercel Blob, immutable cache" },
  { title: "Manifest", detail: "content/manifest.json (committed)" },
  { title: "Static build", detail: "Next.js prerenders every page" },
];

/** The ingest pipeline as a numbered flow. Horizontal on wide screens, vertical on phones. */
export function PipelineDiagram() {
  return (
    <figure>
      <ol className="grid grid-cols-1 border-l border-line sm:grid-cols-2 lg:grid-cols-4 lg:border-l-0 lg:border-t">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative pb-8 pl-6 lg:pb-10 lg:pl-0 lg:pr-6 lg:pt-6">
            <span
              aria-hidden
              className={`absolute -left-[3.5px] top-1.5 h-[6px] w-[6px] rounded-full lg:-top-[3.5px] lg:left-0 ${i === 0 ? "bg-signal" : "bg-paper-faint"}`}
            />
            <p className="hud text-paper-faint">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-2 text-paper">{s.title}</p>
            <p className="mt-1 text-[13px] text-paper-dim">{s.detail}</p>
          </li>
        ))}
      </ol>
      <figcaption className="micro text-paper-faint">npm run ingest</figcaption>
    </figure>
  );
}
