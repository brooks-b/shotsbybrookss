# How to add photos

Five steps. You never have to touch code.

**1. Drop the originals in.** Put the full-size JPGs straight off the X-T50 into the chapter's folder, for example `content/collections/japan/photos/`. Keep the camera's filenames (`DSCF1234.JPG`). These files never get uploaded to GitHub.

**2. Run the pipeline.** In the project folder:

```bash
npm run ingest
```

It reads each photo's settings and film simulation, makes web-sized copies, strips GPS and personal metadata, uploads the copies, and updates `content/manifest.json`. At the end it lists anything that needs your attention.

> First time on a new computer? Run `vercel env pull .env.local` once so the pipeline can upload.

**3. Fill in the gaps it reports.** Each chapter's `collection.json` has a `"photos"` list keyed by filename. For any photo it listed, add or edit:

- `"alt"`: one sentence describing the photo, for screen readers. Claude can write these for you.
- `"stop"`: which place in the chapter it was taken (must match one of the chapter's `"stops"`), if the pipeline couldn't tell.
- `"people": true` on any photo with a recognizable person in it.

```json
"photos": {
  "DSCF2035.JPG": { "alt": "The Yasaka pagoda above Kyoto at sunset", "stop": "Kyoto" }
}
```

**4. Clear photos of people.** Photos of recognizable people stay hidden until you're OK with them going public. Nothing is uploaded for them.

- A single photo: in its chapter's `collection.json`, change `"people": true` to `"people": false`.
- A whole chapter (Montclair, Nashville, Church): change `"cleared": false` to `"cleared": true`.

Then run `npm run ingest` again.

**5. Publish.** Commit `content/manifest.json` (and any `collection.json` you changed) and push to `main`. Vercel rebuilds the site in about a minute.

---

**Picking a cover:** set `"cover": "DSCF1234.JPG"` in the chapter's `collection.json`.
**New chapter:** copy an existing chapter folder, rename it, and edit its `collection.json` (title, places, dates, order).
**Top 10:** list photo ids in `"picks"` in `content/collections/top-10-2025/collection.json`, e.g. `"japan-dscf1234"`.
