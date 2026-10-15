import type { Frame } from "@/lib/frames";
import { exifReadout, pad } from "@/lib/format";

/**
 * The X-T50 EVF overlay: corner brackets, a top status line and the
 * exposure readout along the bottom. Purely presentational.
 */
export function Hud({
  frame,
  className = "",
  topLeft,
  topRight,
  compact = false,
  counter,
}: {
  frame: Frame | null;
  className?: string;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  compact?: boolean;
  /** Overrides the frame's own [ index / total ] counter. */
  counter?: [number, number];
}) {
  // The viewfinder overlay belongs on real photos only.
  if (!frame || frame.kind !== "photo") return null;
  const readout = exifReadout(frame.exif);
  return (
    <div
      aria-hidden
      className={`hud-frame pointer-events-none absolute text-paper ${compact ? "inset-3 [--b:14px]" : "inset-[clamp(12px,2.4vw,32px)]"} ${className}`}
    >
      <div
        className={`hud absolute inset-x-0 top-0 flex items-start justify-between ${compact ? "p-2 text-[10px]" : "p-3 sm:p-4"}`}
      >
        <span className="flex items-center gap-2">{topLeft}</span>
        <span>{topRight}</span>
      </div>
      <div
        className={`hud absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 ${compact ? "p-2 text-[10px]" : "p-3 sm:p-4"}`}
      >
        <span className="flex flex-wrap gap-x-[1.4em] gap-y-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          {readout.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </span>
        <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          [ {pad(counter?.[0] ?? frame.index)} / {pad(counter?.[1] ?? frame.total)} ]
        </span>
      </div>
    </div>
  );
}
