# Decisions

Design and engineering calls made during the build, one line each.

## Design

- **The opening is an aperture.** The page starts on a contact sheet: ~30 photos in staggered columns, one from each chapter in turn, with the name over it and an EVF focus point in the middle. Scrolling opens a hard-edged circular aperture from the focus point onto the globe, a thin ring tracing its edge while the columns drift apart (the F16 → F2 label on the ring was removed at Brooks's request). Then the globe tour runs. One pinned scroll drives the whole sequence via a single `--open` CSS variable. Under reduced motion the contact sheet is skipped.
- **"Where do you want to go?" is a photo board.** The aperture opens onto a strip of tall photo panels, one per place in travel order; hover (or tap on phones) widens a panel and the page takes on that place's colour. The black globe no longer opens the site: it didn't match the colour of the photos.
- **Arriving somewhere.** Clicking a panel grows it to fill the screen: a full-bleed photo pushing in slowly, the place's name, coordinates and local time, its cities as photo cards (each swaps the backdrop), a small locator globe, and a link into the chapter. Esc or "All places" goes back. Some places use a different backdrop from their cover where it suits the weather (dusk for Wyoming, sunset for Bangkok).
- **Each place has its own weather**, drawn over its arrival photo with depth (far particles small and slow, the nearest ones large and out of focus): sakura bursting out then falling (Japan), drifting forest leaves (Rwanda), rain with droplets beading and sliding down the lens (London), snow (Central Europe), lanterns lifting off (Bangkok), golden dust (Italy), lavender (South of France), stars and the odd shooting star (Wyoming), fireflies (Nashville), fall leaves (New Jersey), bubbles (Dominican Republic). Off under reduced motion.
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
- **No chapter index (and so no dial).** Brooks removed the home page's chapter list as redundant with the photo board; the dial went with it. "Work" in the header now goes to the open board (`/#places`).
- **Copy is labels, not sentences.** Brooks asked to cut the explanatory filler: the globe's "in the order they happened" line, the place and city count over the board, the tagline under the name, the build stats on the home page, the extra line in the bio, and the colophon's stack blurbs. What's left is names, places, dates, kit and Brooks's own chapter notes.
- **The archive opens on one mosaic.** Every photo in a single square-tiled field with the places mixed together (a stable shuffle, so it never reorders between visits). Each place's cover is set four times larger, spread evenly through the field, and leads into its chapter; every other photo opens the viewer. Brooks wanted it to read as one body of work rather than separate collections. Grid and Contact sheet are still there, and the filters apply to all three.
- **The route globe turns by hand.** Drag to turn it; let go mid-swipe and it keeps spinning, then slows. After a pause it goes back to its slow drift. On touch only sideways drags turn it, so the page still scrolls, and a drag that ends on a pin doesn't count as a click.
- **No statement section and no theme names.** Brooks removed the "From the sideline to the world" statement block, and the weather isn't labelled anywhere (no "Sakura", "Rain"); it just plays.
- **Copy:** plain and factual. No invented taglines or chapter blurbs; the only notes are facts from the brief and Brooks's own London caption.
- **Dates shown as years** in the index; chapter pages show months.

## Engineering

- **Battery: an idle page does no per-frame work.** Measured in Chrome: 0 animation frames per second when idle on every page (was ~60), and no running CSS animations. How: Lenis's frame loop only runs while a scroll is easing; GSAP ScrollTrigger is gone (it keeps an empty frame loop alive forever) and the opening pins with CSS `position: sticky`; scroll-linked effects only work on frames where the page scrolled; the film grain is static; the route globe renders at a fixed 30fps from a timer (no frame requests), on the low-power GPU, at most 1.5× resolution, and only while on screen; the 2D globes cap at 30fps; arrival particles fake their out-of-focus look instead of running a canvas blur each frame.

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
- **SD card batch (Oct 2026):** 1,586 JPEGs reviewed from the card (read only; nothing on the card was changed). 88 added: 37 Japan, 17 Bangkok, 34 Rwanda, with near-duplicates of each other and of photos already on the site left out.
- **`npm run review`** is a local page of every photo with a checkbox. Unchecking sets `hidden` in collection.json; the site filters hidden photos out when it reads the manifest, so they stay uploaded and can come back without re-running the pipeline.
- **London `DSCF1575.jpg`** (woman feeding pigeons) cleared by Brooks in Oct 2026, his favourite photo; now London's cover.
- **Brooks's follow-ups (Oct 2026):** Japan's cover is now Tokyo Tower (`DSCF1758`). Added Osaka Castle (`DSCF2211`) and, in Bangkok, the Wat Paknam Buddha through a glass roof (`DSCF2412`); the Muay Thai photo is now the winner's raised arm (`DSCF2409`) instead of `DSCF2410`. The June 7 car show is in Montclair (7 photos, cover `DSCF2450`), which extends that chapter's dates to June 2026.
- **First review pass:** Brooks unchecked 68 photos in `npm run review`. That hid the Rwanda and Bangkok covers, so they're now the silverback close-up (`DSCF2950`) and the Buddha through glass (`DSCF2412`). Montclair's note (about MKA sports) was removed since the chapter is the car show for now, and the chapter was renamed New Jersey (slug `new-jersey`; `/chapters/montclair` redirects).
- **More follow-ups:** Italy's cover is `DSCF0886 2.JPG` (covers now match by photo id, so file names with spaces work), and the teamLab photo `DSCF1723` is hidden.
- **Order within a chapter:** stops in the order visited, but inside each stop photos are dealt out one scene at a time (shots within 5 minutes of each other form a scene), so similar frames don't sit together. Rwanda went from 8 same-scene neighbours to 1.
- **Empty chapters can be hidden:** `"hidden": true` on a collection takes it off the site entirely. Dominican Republic and Nashville are hidden until they have photos. Rwanda's cover is `DSCF2644`.
- **People photos all cleared (Oct 2026):** Brooks cleared the four that were still held back: Japan `DSCF1672` (Shibuya crowd) and `DSCF1744` (teamLab), Bangkok `DSCF2410` (Muay Thai fighter), Rwanda `DSCF2562` (rangers). Nothing is withheld now; the gate still applies to new photos marked `people: true`.
- **Top 10 of 2025** is a draft selection from the 2025 photos, for Brooks to replace with his real top 10.
- **Lenses** come from EXIF: XF35mmF2 R WR and XF50-140mmF2.8 R LM OIS WR.
- **Per-photo details** (alt text, stop, people flag) live in each chapter's `collection.json` under `"photos"`.
- **Lead chapter:** Japan (the index lists newest first). The globe follows travel order, oldest first.
- **Geocoding** is city level. Dominican Republic uses Santo Domingo, and Wind River Range uses Pinedale, WY, until Brooks confirms.
- **Approximate dates** (`datesApprox`) remain only for New Jersey, Dominican Republic and Nashville, which have no photos yet.
- **Church** has no location yet, so it stays off the globe (`locationPending`). The Earth Day 2024 photo isn't placed in any chapter yet.
