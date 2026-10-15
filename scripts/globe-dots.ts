/**
 * npm run globe:dots
 *
 * Builds the halftone earth: spreads points evenly over a sphere (Fibonacci
 * lattice), keeps the ones that land on Natural Earth land polygons, and
 * writes them as packed Int16 lat/lng pairs (×100) to public/globe/.
 * Run once; the output is committed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land50 from "world-atlas/land-50m.json";

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function landDots(samples: number) {
  const topo = land50 as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const theta = GOLDEN * i;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lng = (((((theta * 180) / Math.PI) % 360) + 540) % 360) - 180;
    if (geoContains(land, [lng, lat])) out.push(Math.round(lat * 100), Math.round(lng * 100));
  }
  return Int16Array.from(out);
}

async function main() {
  const dir = path.resolve(__dirname, "..", "public/globe");
  await mkdir(dir, { recursive: true });
  for (const [name, samples] of [
    ["land.bin", 64000],
    ["land-lite.bin", 22000],
  ] as const) {
    const dots = landDots(samples);
    await writeFile(path.join(dir, name), Buffer.from(dots.buffer));
    console.log(`${name}: ${dots.length / 2} dots, ${(dots.byteLength / 1024).toFixed(0)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
