/**
 * npm run ingest
 *
 * Reads every original in content/collections/{slug}/photos, parses EXIF and
 * the Fuji film simulation, makes AVIF + WebP derivatives and a thumbhash,
 * uploads them, and writes content/manifest.json.
 *
 *   --storage=blob   upload to Vercel Blob (default when BLOB_READ_WRITE_TOKEN is set)
 *   --storage=local  write to public/media for local dev only (not deployable)
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { ingest } from "./lib/ingest-core";
import { blobStorage, localStorage, type Storage } from "./lib/storage";

const root = path.resolve(__dirname, "..");
for (const env of [".env.local", ".env"]) {
  const file = path.join(root, env);
  if (existsSync(file)) process.loadEnvFile(file);
}

function pickStorage(): Storage {
  const flag = process.argv.find((a) => a.startsWith("--storage="))?.split("=")[1];
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (flag === "local") return localStorage(path.join(root, "public"));
  if (flag === "blob" || (!flag && token)) {
    if (!token) throw new Error("--storage=blob needs BLOB_READ_WRITE_TOKEN. Run `vercel env pull .env.local`.");
    return blobStorage(token);
  }
  console.warn("! No BLOB_READ_WRITE_TOKEN: writing to public/media (local dev only, not deployable).\n");
  return localStorage(path.join(root, "public"));
}

const list = (label: string, ids: string[]) => {
  if (ids.length === 0) return;
  console.log(`\n${label} [${ids.length}]`);
  for (const id of ids) console.log(`  · ${id}`);
};

async function main() {
  const storage = pickStorage();
  const started = Date.now();
  console.log(`ingest → ${storage.kind}`);

  const { manifest, summary } = await ingest({
    contentDir: path.join(root, "content"),
    storage,
    log: console.log,
  });

  const mb = (n: number) => (n / 1e6).toFixed(1) + " MB";
  console.log(
    `\n${manifest.stats.photos} photos · ${manifest.stats.derivatives} derivatives · ` +
      `${mb(manifest.stats.bytesSaved)} saved · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  list("New", summary.added);
  list("Updated", summary.updated);
  list("Removed from manifest", summary.removed);
  list("Withheld (people not cleared, nothing uploaded)", summary.withheld);
  list("Missing location (set `stop` in manifest.json)", summary.missingLocation);
  list("Missing alt text (edit `alt` in manifest.json)", summary.missingAlt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
