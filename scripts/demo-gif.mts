/**
 * npm run demo-gif   (with `npm run build && npx next start -p 3123` running)
 *
 * Scrolls through the home page in headless Chrome and stitches the frames
 * into docs/demo.gif for the README.
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import * as chromeLauncher from "chrome-launcher";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const URL = process.env.DEMO_URL ?? "http://localhost:3123/";
const W = 1280;
const H = 800;
const OUT_W = 640;

async function main() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", `--window-size=${W},${H}`, "--enable-unsafe-swiftshader"],
  });
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    await page.evaluateOnNewDocument(() => sessionStorage.setItem("sbb-loaded", "1"));
    await page.goto(URL, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2500));

    const frames: Uint8Array[] = [];
    const grab = async (count: number, gap: number) => {
      for (let i = 0; i < count; i++) {
        frames.push(await page.screenshot({ type: "png" }));
        await new Promise((r) => setTimeout(r, gap));
      }
    };

    await grab(6, 180);
    // Walk the pinned globe tour, then down the page.
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const steps = 36;
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round((total * 0.62 * i) / steps));
      await new Promise((r) => setTimeout(r, 220));
      frames.push(await page.screenshot({ type: "png" }));
    }
    await grab(4, 200);

    // Every other scroll frame keeps the GIF small enough for a README.
    const kept = frames.filter((_, i) => i < 6 || i % 2 === 0);
    const resized = await Promise.all(
      kept.map((f) => sharp(f).resize(OUT_W).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
    );
    const h = resized[0].info.height;
    const strip = Buffer.concat(resized.map((r) => r.data));
    await mkdir(path.join(root, "docs"), { recursive: true });
    await sharp(strip, { raw: { width: OUT_W, height: h * resized.length, channels: 4, pageHeight: h } })
      .gif({ delay: resized.map(() => 160), loop: 0, effort: 10, colours: 48, dither: 0 })
      .toFile(path.join(root, "docs/demo.gif"));
    await sharp(frames[3]).resize(1600).png().toFile(path.join(root, "docs/home.png"));
    console.log(`docs/demo.gif: ${resized.length} frames`);
  } finally {
    await browser.disconnect();
    await chrome.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
