/**
 * `npm run review`: a local page for choosing which photos go on the site.
 *
 * Every photo in the manifest, grouped by chapter, with a checkbox. Unchecking
 * one sets `"hidden": true` on it in that chapter's collection.json; the site
 * leaves hidden photos out. Nothing is deleted or re-uploaded, so a photo can
 * be checked again at any time. Photos not yet committed are listed first.
 *
 * Runs on 127.0.0.1 only. Commit and push the collection.json changes to publish.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const content = path.join(root, "content");
const PORT = Number(process.env.PORT ?? 4317);

type Override = { alt?: string; hidden?: boolean; [k: string]: unknown };
type CollectionFile = { slug: string; title: string; order?: number; photos?: Record<string, Override> };
type Photo = {
  id: string;
  collection: string;
  file: string;
  alt: string;
  withheld?: boolean;
  sources: { webp: { url: string; width: number }[] };
};

const collectionPath = (slug: string) => path.join(content, "collections", slug, "collection.json");

function load() {
  const collections = readdirSync(path.join(content, "collections"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => JSON.parse(readFileSync(collectionPath(d.name), "utf8")) as CollectionFile)
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
  const photos = (JSON.parse(readFileSync(path.join(content, "manifest.json"), "utf8")) as { photos: Photo[] }).photos;
  // "New" = not in the last commit's manifest.
  let committed = new Set<string>();
  try {
    const head = execFileSync("git", ["show", "HEAD:content/manifest.json"], { cwd: root, encoding: "utf8" });
    committed = new Set((JSON.parse(head) as { photos: Photo[] }).photos.map((p) => p.id));
  } catch {}
  return { collections, photos, committed };
}

const findOverride = (c: CollectionFile, file: string) => {
  const key = Object.keys(c.photos ?? {}).find((k) => k.toLowerCase() === file.toLowerCase());
  return key ? { key, value: c.photos![key] } : undefined;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

function page() {
  const { collections, photos, committed } = load();
  const tile = (p: Photo, c: CollectionFile) => {
    const hidden = Boolean(findOverride(c, p.file)?.value.hidden);
    const small = [...p.sources.webp].sort((a, b) => a.width - b.width)[0];
    const big = [...p.sources.webp].sort((a, b) => b.width - a.width)[0];
    const img = small
      ? `<img loading="lazy" src="${small.url}" data-big="${big.url}" alt="${esc(p.alt)}">`
      : `<span class="held">Held back: has people</span>`;
    return `<label class="tile${hidden ? " off" : ""}" title="${esc(p.alt)}">
      ${img}
      <span class="bar"><input type="checkbox" data-id="${p.id}" ${hidden ? "" : "checked"} ${p.withheld ? "disabled" : ""}>
      <span>${esc(p.file.replace(/\.jpe?g$/i, ""))}</span></span></label>`;
  };
  const section = (title: string, list: { p: Photo; c: CollectionFile }[]) =>
    list.length
      ? `<section><h2>${esc(title)} <span>${list.length}</span></h2><div class="grid">${list.map(({ p, c }) => tile(p, c)).join("")}</div></section>`
      : "";
  const bySlug = new Map(collections.map((c) => [c.slug, c]));
  const fresh = photos.filter((p) => !committed.has(p.id));
  const body = [
    ...collections.map((c) =>
      section(
        fresh.some((p) => p.collection === c.slug) ? `${c.title}: new` : "",
        fresh.filter((p) => p.collection === c.slug).map((p) => ({ p, c })),
      ),
    ),
    ...collections.map((c) =>
      section(
        c.title,
        photos
          .filter((p) => p.collection === c.slug && committed.has(p.id))
          .map((p) => ({ p, c: bySlug.get(p.collection)! })),
      ),
    ),
  ].join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photo review</title><style>
:root{--bg:#11100e;--fg:#ede8df;--dim:#8f897f;--line:#2a2724;--accent:#f0602f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
header p{margin:0;color:var(--dim)}button{font:inherit;background:var(--fg);color:var(--bg);border:0;padding:8px 16px;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
section{padding:24px 16px 8px}h2{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px}h2 span{color:var(--dim);font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.tile{position:relative;display:block;aspect-ratio:4/5;background:#1a1816;cursor:pointer;overflow:hidden}
.tile img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .15s,filter .15s}
.tile.off img{opacity:.25;filter:grayscale(1)}.tile.off{outline:1px solid var(--accent)}
.bar{position:absolute;inset:auto 0 0 0;display:flex;gap:6px;align-items:center;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:12px}
.bar input{width:16px;height:16px;accent-color:var(--fg)}
.held{display:grid;place-items:center;height:100%;color:var(--dim);font-size:12px;padding:12px;text-align:center}
dialog{border:0;padding:0;background:transparent;max-width:92vw;max-height:92vh}dialog img{max-width:92vw;max-height:92vh;display:block}
dialog::backdrop{background:rgba(0,0,0,.85)}
</style></head><body>
<header><p><span id="count"></span>. Uncheck a photo to take it off the site. Shift-click a photo to see it large.</p><button id="save" disabled>Save</button></header>
${body}
<dialog id="big"><img alt=""></dialog>
<script>
const boxes=[...document.querySelectorAll("input[data-id]")];
const save=document.getElementById("save"),count=document.getElementById("count");
const show=()=>{const off=boxes.filter(b=>!b.checked).length;count.textContent=(boxes.length-off)+" on the site, "+off+" unchecked"};
boxes.forEach(b=>b.addEventListener("change",()=>{b.closest(".tile").classList.toggle("off",!b.checked);save.disabled=false;save.textContent="Save";show()}));
show();
save.onclick=async()=>{save.disabled=true;
  const r=await fetch("/save",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({hidden:boxes.filter(b=>!b.checked).map(b=>b.dataset.id)})});
  save.textContent=r.ok?"Saved":"Couldn't save";save.disabled=r.ok;};
const dlg=document.getElementById("big");
document.querySelectorAll(".tile img").forEach(img=>img.addEventListener("click",e=>{if(!e.shiftKey)return;e.preventDefault();dlg.querySelector("img").src=img.dataset.big;dlg.showModal()}));
dlg.addEventListener("click",()=>dlg.close());
window.addEventListener("beforeunload",e=>{if(!save.disabled)e.preventDefault()});
</script></body></html>`;
}

/** Writes `hidden` for every photo: true for the listed ids, removed for the rest. */
function saveHidden(ids: Set<string>) {
  const { collections, photos } = load();
  for (const c of collections) {
    let changed = false;
    for (const p of photos.filter((p) => p.collection === c.slug)) {
      const want = ids.has(p.id);
      const found = findOverride(c, p.file);
      if (want && !found?.value.hidden) {
        c.photos ??= {};
        c.photos[found?.key ?? p.file] = { ...found?.value, hidden: true };
        changed = true;
      } else if (!want && found?.value.hidden) {
        delete found.value.hidden;
        changed = true;
      }
    }
    if (changed) writeFileSync(collectionPath(c.slug), JSON.stringify(c, null, 2) + "\n");
  }
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page());
  } else if (req.method === "POST" && req.url === "/save") {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      try {
        const { hidden } = JSON.parse(raw) as { hidden: string[] };
        saveHidden(new Set(hidden));
        res.writeHead(204).end();
      } catch (err) {
        res.writeHead(400).end(String(err));
      }
    });
  } else {
    res.writeHead(404).end();
  }
})
  .on("error", (err: NodeJS.ErrnoException) => {
    // Already open from an earlier run: just point at it.
    if (err.code !== "EADDRINUSE") throw err;
    console.log(`Photo review is already running: http://127.0.0.1:${PORT}`);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Photo review: http://127.0.0.1:${PORT}`));
