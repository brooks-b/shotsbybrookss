# Decisions

Design and engineering calls made during the build, one line each.

## Design

- **The globe is the opening.** The hero is a full-screen globe instead of a cycling photo, at Brooks's request; scrolling pins it and runs the travel tour. The EVF photo card in the readout shows each stop's cover once real photos exist.
- **Type:** Inter Tight 500 (tight grotesk, uppercase titles), Geist (body), Geist Mono (data, EXIF, labels). All SIL OFL via Google Fonts. Replaced Archivo Condensed, which read as generic.
- **No gradients over images.** No vignettes, scrims or glows. Placeholders are flat tiles in the right aspect ratio.
- **Accent:** safelight orange `#f0602f`, used only for the REC dot, pins, arcs and focus rings.
- **Label grey** `#8a847a` passes WCAG AA (5.2:1 on the background, 4.6:1 on film-strip grey).
- **Preloader:** a hairline progress bar with a 000–100 counter that waits for fonts and the globe, then lifts away. Once per session. No sound.
- **Viewfinder HUD only on real photos.** Placeholders get no corner brackets or EXIF readout.
- **Film grain** at 3.5% opacity; it stops animating under reduced motion.
- **Dial:** the chapter index's dial is an ARIA slider (arrow keys, Home/End, Enter, drag/touch). Hidden on phones, where the list itself is the control.
- **Copy:** plain and factual. No invented taglines or chapter blurbs; the only notes are facts from the brief and Brooks's own London caption.
- **Dates shown as years** in the index, since most months are still estimates.

## Engineering

- **Static everywhere.** Cache Components and Partial Prefetching are off: every page is prerendered and there's no request-time data, and their `<Activity>`-based route hiding fights with pinned ScrollTrigger sections.
- **Phones get a 2D-canvas globe** (same route, arcs, pins, tap targets) and never load three.js. That took mobile Lighthouse performance from 50 to about 90.
- **Desktop globe:** React Three Fiber with custom shaders, with one draw call for ~18k land dots. Boots after browser idle so it never competes with first paint.
- **Land dots** are precomputed from Natural Earth 50m on a Fibonacci lattice and stored as packed Int16 (72 KB desktop, 25 KB phone).
- **Fuji film simulation** is read by a small custom maker-note parser (`src/lib/exif/fuji.ts`); exifr handles the standard EXIF.
- **Storage:** Vercel Blob (same vendor as hosting; one token). `--storage=local` exists for offline dev only.
- **Derivatives:** AVIF (q55) + WebP (q78) at 480/960/1440/1920/2560px, never upscaled, never larger than 2560px. `<picture>` with srcset instead of Next's on-demand optimizer.
- **Placeholders:** thumbhash, decoded to a tiny PNG at build time.
- **Privacy:** sharp drops all metadata from derivatives; coordinates are rounded to 0.1° (~11 km) before reaching the manifest.
- **People gate:** chapters marked as containing people stay withheld (nothing uploaded) until `cleared: true`.
- **Incremental ingest:** photos are skipped when their SHA-1, storage target and clearance haven't changed; hand-edited alt text survives re-runs.
- **Colophon numbers** come from `content/manifest.json` and `src/data/build-stats.json` (written by `npm run stats`: timed build + Lighthouse). The code excerpts are pulled from the live source at build time.
- **Analytics** load only on Vercel (`process.env.VERCEL`), so local runs don't log 404s.
- **Domain:** using `shotsbybrookss.vercel.app` until Brooks picks one.

## Content

- **Lead chapter:** Japan (the index lists newest first). The globe follows travel order, oldest first.
- **Geocoding** is city level. Dominican Republic uses Santo Domingo, and Wind River Range uses Pinedale, WY, until Brooks confirms.
- **Approximate dates** (`datesApprox`) for Montclair, Dominican Republic, Italy, South of France, Central Europe, Wyoming and Nashville.
- **Church** has no location yet, so it stays off the globe (`locationPending`). The Earth Day 2024 photo isn't placed in any chapter yet.
