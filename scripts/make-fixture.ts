/**
 * npm run fixture -- <collection> [filmMode hex]
 *
 * Drops a synthetic X-T50 JPEG (full EXIF + Fuji maker note) into a
 * collection's photos folder so the pipeline can be tried end to end
 * before real originals arrive. Delete it afterwards.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { makeFixtureJpeg } from "./lib/fixture";

async function main() {
  const [collection = "japan", mode = "600"] = process.argv.slice(2);
  const file = path.resolve(__dirname, "..", "content/collections", collection, "photos", "FIXTURE01.jpg");
  await writeFile(file, await makeFixtureJpeg({ filmMode: parseInt(mode, 16) }));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
