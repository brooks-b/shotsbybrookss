# Decisions

Design and engineering calls made during the build, one line each.

## Design

- **The opening is an aperture.** The page starts on a contact sheet: ~30 photos in staggered columns, one from each chapter in turn, with the name over it and an EVF focus point in the middle. Scrolling opens a hard-edged circular aperture from the focus point onto the globe, with the f-number counting down F16 → F2 on the ring while the columns drift apart. Then the globe tour runs. One pinned scroll drives the whole sequence via a single `--open` CSS variable. Under reduced motion the contact sheet is skipped.
- **"Where do you want to go?" is a photo board.** The aperture opens onto a strip of tall photo panels, one per place in travel order; hover (or tap on phones) widens a panel and the page takes on that place's colour. The black globe no longer opens the site: it didn't match the colour of the photos.
- **Arriving somewhere.** Clicking a panel grows it to fill the screen: a full-bleed photo pushing in slowly, the place's name, coordinates and local time, its cities as photo cards (each swaps the backdrop), a small locator globe, and a link into the chapter. Esc or "All places" goes back. Some places use a different backdrop from their cover where it suits the weather (dusk for Wyoming, sunset for Bangkok).
- **Each place has its own weather**, drawn over its arrival photo with depth (far particles small and slow, the nearest ones large and out of focus): sakura bursting out then falling (Japan), drifting forest leaves (Rwanda), rain with droplets beading and sliding down the lens (London), snow (Central Europe), lanterns lifting off (Bangkok), golden dust (Italy), lavender (South of France), stars and the odd shooting star (Wyoming), fireflies (Nashville), fall leaves (Montclair), bubbles (Dominican Republic). Off under reduced motion.
- **The globe is now "The route"**, further down the page: every trip on one globe, the route drawing itself the first time it's seen. Its pins open the same arrival as the board.
- **Contact-sheet photos load after the page does.** Tiles paint from their blur placeholder first, so the name, fonts and globe come first (mobile Lighthouse stays ~92).
- **Blur placeholders are decoded in the browser** from each photo's ~30-byte thumbhash, rather than inlined as data URLs; that cut the home page HTML from 433 KB to 274 KB.
- **Tour steps by place, not by city.** Each chapter is one step (11 instead of 23), with about 0.9 screens of scroll; the globe holds still for the first ~60% of each step before moving on. Each place shows a strip of photo cards, one per city; picking one turns the globe, zooms in a little, draws the route to it and tags the city's pin by name. The current place's pins stay bright while the rest dim.
- **Photo reveal:** a 0.25s fade that starts just before each photo scrolls in, so photos are usually already there. Chapter pages use a slower 1.1s fade that starts once the photo is in view. Both replaced the shutter wipe at Brooks's request.
- **Type:** Inter Tight 500 (tight grotesk, uppercase titles), Geist (body), Geist Mono (data, EXIF, labels). All SIL OFL via Google Fonts. Replaced Archivo Condensed, which read as generic.
- **No gradients over images.** No vignettes, scrims or glows. Placeholders are flat tiles in the right aspect ratio.
- **Ambient tone:** the page's near-black surfaces lean toward the dominant colour of the photo filling the middle of the screen (or the open lightbox), and ease back to neutral otherwise. It brings the colour to full brightness (keeping its hue), mixes in 13–15%, then darkens until label text keeps ≥ 4.6:1 contrast. The background animates through registered CSS custom properties; under reduced motion it changes instantly.
- **Accent:** safelight orange `#f0602f`, used only for the REC dot, pins, arcs and focus rings.
- **Label grey** `#8a847a` passes WCAG AA (5.2:1 on the background, 4.6:1 on film-strip grey).
- **Preloader:** a hairline progress bar with a 000–100 counter that waits for fonts and the globe, then lifts away. Once per session. No sound.
- **Viewfinder HUD only on real photos.** Placeholders get no corner brackets or EXIF readout.
- **Film grain** at 3.5% opacity; it stops animating under reduced motion.
- **Dial:** the chapter index's dial is an ARIA slider (arrow keys, Home/End, Enter, drag/touch). Hidden on phones, where the list itself is the control.
- **No statement section and no theme names.** Brooks removed the "From the sideline to the world" statement block, and the weather isn't labelled anywhere (no "Sakura", "Rain"); it just plays.
- **Copy:** plain and factual. No invented taglines or chapter blurbs; the only notes are facts from the brief and Brooks's own London caption.
- **Dates shown as years** in the index; chapter pages show months.

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

- **First photo batch (81 originals):** sorted into chapters by EXIF date and by what's in the frame. Added Bangkok (Wat Arun, May 2026) and Rwanda (Volcanoes National Park, Jul 2026), and Nara and Osaka stops in Japan. Dates from EXIF replaced the estimates for Wyoming (Jul 2025), Italy, South of France and Central Europe (Dec 2025).
- **Held back pending Brooks's OK:** London `DSCF1575.jpg` (woman feeding pigeons), Japan `DSCF1672.JPG` (Shibuya crowd, faces in foreground) and `DSCF1744.jpg` (two people at teamLab). Distant figures, backs and silhouettes were not flagged.
- **Top 10 of 2025** is a draft selection from the 2025 photos, for Brooks to replace with his real top 10.
- **Lenses** come from EXIF: XF35mmF2 R WR and XF50-140mmF2.8 R LM OIS WR.
- **Per-photo details** (alt text, stop, people flag) live in each chapter's `collection.json` under `"photos"`.
- **Lead chapter:** Japan (the index lists newest first). The globe follows travel order, oldest first.
- **Geocoding** is city level. Dominican Republic uses Santo Domingo, and Wind River Range uses Pinedale, WY, until Brooks confirms.
- **Approximate dates** (`datesApprox`) remain only for Montclair, Dominican Republic and Nashville, which have no photos yet.
- **Church** has no location yet, so it stays off the globe (`locationPending`). The Earth Day 2024 photo isn't placed in any chapter yet.
