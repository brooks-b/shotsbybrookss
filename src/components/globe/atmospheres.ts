/**
 * Each place gets a quiet atmosphere: a few dozen particles drifting over the
 * globe while you're there, and a colour the page leans toward. Kept sparse
 * and low-opacity on purpose: it should read as weather, not decoration.
 */

export type ParticleKind =
  | "petal" // sakura: soft pink, falling, flipping
  | "leaf" // a pointed leaf with a midrib, falling and turning
  | "streak" // rain
  | "flake" // snow
  | "lantern" // warm lights rising
  | "mote" // dust in sunlight
  | "star" // twinkling night sky, the odd shooting star
  | "firefly" // wandering, blinking
  | "bubble"; // rising rings

export type Atmosphere = {
  /** What it's called in the readout, e.g. "Sakura". */
  label: string;
  kind: ParticleKind;
  colors: string[];
  /** Particles on a 1440px-wide screen; scaled down on smaller ones. */
  count: number;
  /** The colour the page background leans toward. */
  tone: string;
};

export const ATMOSPHERES: Record<string, Atmosphere> = {
  japan: { label: "Sakura", kind: "petal", colors: ["#f6c9d3", "#f1aebf", "#fbe1e7"], count: 46, tone: "#c97a8f" },
  rwanda: {
    label: "Forest",
    kind: "leaf",
    colors: ["#5d8a3e", "#7ea653", "#3f6a2e", "#a3c27a"],
    count: 30,
    tone: "#4f7a3a",
  },
  london: { label: "Rain", kind: "streak", colors: ["#b9c4cc"], count: 90, tone: "#5b6b78" },
  "central-europe": { label: "Snow", kind: "flake", colors: ["#f2f0ea"], count: 80, tone: "#7d8894" },
  bangkok: {
    label: "Lanterns",
    kind: "lantern",
    colors: ["#f4a548", "#f7c26a", "#ee7f37"],
    count: 22,
    tone: "#c47b3a",
  },
  italy: { label: "Golden hour", kind: "mote", colors: ["#f3d9a0", "#e8c27a"], count: 60, tone: "#b88a45" },
  "south-of-france": {
    label: "Lavender",
    kind: "petal",
    colors: ["#b9a3d6", "#9d85c4", "#d4c4ea"],
    count: 40,
    tone: "#7d68a6",
  },
  wyoming: { label: "Night sky", kind: "star", colors: ["#f1efe8", "#dfe6ef"], count: 110, tone: "#3e5568" },
  nashville: { label: "Fireflies", kind: "firefly", colors: ["#e6f28a", "#f5e27a"], count: 26, tone: "#5c6a2f" },
  montclair: {
    label: "Fall",
    kind: "leaf",
    colors: ["#c8642e", "#d88a3a", "#a8432a", "#e0b04a"],
    count: 26,
    tone: "#9a5530",
  },
  "dominican-republic": { label: "Sea", kind: "bubble", colors: ["#9fe0dc", "#6fc7c9"], count: 30, tone: "#2f8a8a" },
};
