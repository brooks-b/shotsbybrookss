/**
 * npm run stats
 *
 * Measures the site and writes src/data/build-stats.json for the colophon:
 *   1. times a production `next build` and counts prerendered pages
 *   2. serves it locally and runs Lighthouse (mobile + desktop) on the home page
 *
 * Commit the JSON afterwards. Needs Google Chrome installed.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const root = path.resolve(import.meta.dirname, "..");
const PORT = 3123;

function run(cmd: string, args: string[], opts: { wait?: boolean } = {}): Promise<number> | ChildProcess {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  if (opts.wait === false) return child;
  return new Promise((resolve, reject) =>
    child.on("exit", (code) =>
      code === 0 ? resolve(code) : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    ),
  );
}

async function waitFor(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server never came up at ${url}`);
}

async function audit(url: string, formFactor: "mobile" | "desktop", port: number) {
  const result = await lighthouse(
    url,
    {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    },
    formFactor === "desktop"
      ? {
          extends: "lighthouse:default",
          settings: {
            formFactor: "desktop",
            screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
            throttling: {
              rttMs: 40,
              throughputKbps: 10240,
              cpuSlowdownMultiplier: 1,
              requestLatencyMs: 0,
              downloadThroughputKbps: 0,
              uploadThroughputKbps: 0,
            },
          },
        }
      : undefined,
  );
  const c = result!.lhr.categories;
  const score = (k: string) => Math.round((c[k]?.score ?? 0) * 100);
  return {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    formFactor,
    url: "/",
  };
}

async function main() {
  const started = Date.now();
  await run("npx", ["next", "build"]);
  const buildSeconds = (Date.now() - started) / 1000;

  const prerender = JSON.parse(await readFile(path.join(root, ".next/prerender-manifest.json"), "utf8"));
  const routes = Object.keys(prerender.routes).filter(
    (r) => !/\.(png|xml|txt|ico)$|opengraph-image|_not-found|_global-error/.test(r),
  ).length;

  const server = run("npx", ["next", "start", "-p", String(PORT)], { wait: false }) as ChildProcess;
  let chrome: chromeLauncher.LaunchedChrome | undefined;
  try {
    await waitFor(`http://localhost:${PORT}/`);
    chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--use-angle=swiftshader"] });
    const url = `http://localhost:${PORT}/`;
    // A throwaway pass warms the server and caches, then the median of three
    // mobile runs smooths out Lighthouse's run-to-run noise.
    await audit(url, "mobile", chrome.port);
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await audit(url, "mobile", chrome.port));
    const mobile = runs.sort((x, y) => x.performance - y.performance)[1];
    const desktop = await audit(url, "desktop", chrome.port);

    const stats = {
      generatedAt: new Date().toISOString(),
      buildSeconds: Math.round(buildSeconds * 10) / 10,
      routes,
      firstLoadJsKb: null,
      lighthouse: { mobile, desktop },
    };
    await writeFile(path.join(root, "src/data/build-stats.json"), JSON.stringify(stats, null, 2) + "\n");
    console.log("\nwrote src/data/build-stats.json", stats);
  } finally {
    await chrome?.kill();
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
