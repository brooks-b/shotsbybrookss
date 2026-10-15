/** Open Graph cards in the HUD style. Rendered at build time. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { Frame } from "./frames";

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#0e0d0b";
const PAPER = "#ede8df";
const DIM = "#a8a196";
const FAINT = "#77726a";
const SIGNAL = "#f0602f";

async function fonts() {
  const dir = path.join(process.cwd(), "node_modules/@fontsource");
  const [display, mono] = await Promise.all([
    readFile(path.join(dir, "inter-tight/files/inter-tight-latin-500-normal.woff")),
    readFile(path.join(dir, "geist-mono/files/geist-mono-latin-400-normal.woff")),
  ]);
  return [
    { name: "Inter Tight", data: display, weight: 500 as const, style: "normal" as const },
    { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
  ];
}

/** Satori can't read AVIF/WebP, so re-encode the cover as a JPEG data URL. */
async function coverDataUrl(frame: Frame | undefined) {
  if (!frame || frame.kind !== "photo" || !frame.src?.startsWith("http")) return null;
  try {
    const res = await fetch(frame.src);
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(480, 600, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

function Bracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const v = pos[0] === "t" ? { top: 14 } : { bottom: 14 };
  const h = pos[1] === "l" ? { left: 14 } : { right: 14 };
  return (
    <div
      style={{
        position: "absolute",
        width: 22,
        height: 22,
        ...v,
        ...h,
        borderColor: PAPER,
        borderStyle: "solid",
        borderWidth: 0,
        ...(pos[0] === "t" ? { borderTopWidth: 1.5 } : { borderBottomWidth: 1.5 }),
        ...(pos[1] === "l" ? { borderLeftWidth: 1.5 } : { borderRightWidth: 1.5 }),
      }}
    />
  );
}

export async function ogCard(opts: { title: string; lines: string[]; cover?: Frame; kicker?: string }) {
  const cover = await coverDataUrl(opts.cover);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: INK, color: PAPER, padding: 56 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Geist Mono", fontSize: 18, color: DIM }}
        >
          <div style={{ width: 9, height: 9, borderRadius: 9, background: SIGNAL }} />
          {opts.kicker ?? "SHOTSBYBROOKSS"}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Inter Tight",
              fontSize: opts.title.length > 12 ? 92 : 128,
              letterSpacing: "-0.045em",
              lineHeight: 0.92,
              textTransform: "uppercase",
            }}
          >
            {opts.title}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 28,
              fontFamily: "Geist Mono",
              fontSize: 20,
              color: DIM,
            }}
          >
            {opts.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 414,
          height: 518,
          background: "#151411",
          marginLeft: 40,
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
          <img src={cover} width={414} height={518} style={{ objectFit: "cover" }} alt="" />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              padding: 44,
              width: "100%",
              fontFamily: "Geist Mono",
              fontSize: 16,
              color: FAINT,
            }}
          >
            BROOKS BARRETT
          </div>
        )}
        <Bracket pos="tl" />
        <Bracket pos="tr" />
        <Bracket pos="bl" />
        <Bracket pos="br" />
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}
