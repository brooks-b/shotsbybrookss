/**
 * Each place has its own weather: one or more particle layers drawn over the
 * arrival photo, and a colour the page leans toward. Kept sparse on purpose:
 * it should read as the place, not as decoration.
 */

export type ParticleKind =
  | "petal" // soft teardrop that tumbles: sakura, lavender
  | "leaf" // pointed leaf with a midrib, falling and turning
  | "streak" // rain
  | "droplet" // a raindrop beading on the lens, then sliding down
  | "flake" // snow
  | "lantern" // warm lights rising
  | "mote" // dust in sunlight
  | "star" // twinkling sky
  | "shooting" // the odd shooting star
  | "firefly" // wandering, blinking
  | "bubble"; // rising rings

export type Layer = {
  kind: ParticleKind;
  colors: string[];
  /** Particles on a 1440px-wide screen; scaled down on smaller ones. */
  count: number;
};

export type Atmosphere = {
  /** What it's called in the readout, e.g. "Sakura". */
  label: string;
  layers: Layer[];
  /** The colour the page leans toward. */
  tone: string;
  /** How it arrives: petals burst from the centre, lanterns lift off together, and so on. */
  entrance?: "burst" | "rise" | "fill";
  /** Rwanda: dark foliage that parts to reveal the photo and stays framing the edges. */
  foliage?: boolean;
};

export const ATMOSPHERES: Record<string, Atmosphere> = {
  japan: {
    label: "Sakura",
    layers: [{ kind: "petal", colors: ["#f6c9d3", "#f1aebf", "#fbe1e7", "#e994aa"], count: 60 }],
    tone: "#c97a8f",
    entrance: "burst",
  },
  rwanda: {
    label: "Forest",
    layers: [{ kind: "leaf", colors: ["#5d8a3e", "#7ea653", "#3f6a2e", "#a3c27a"], count: 26 }],
    tone: "#4f7a3a",
    foliage: true,
  },
  london: {
    label: "Rain",
    layers: [
      { kind: "streak", colors: ["#c3cdd4"], count: 110 },
      { kind: "droplet", colors: ["#e8eef2"], count: 18 },
    ],
    tone: "#5b6b78",
    entrance: "fill",
  },
  "central-europe": {
    label: "Snow",
    layers: [{ kind: "flake", colors: ["#f2f0ea", "#ffffff"], count: 120 }],
    tone: "#7d8894",
    entrance: "fill",
  },
  bangkok: {
    label: "Lanterns",
    layers: [{ kind: "lantern", colors: ["#f4a548", "#f7c26a", "#ee7f37"], count: 30 }],
    tone: "#c47b3a",
    entrance: "rise",
  },
  italy: {
    label: "Golden hour",
    layers: [{ kind: "mote", colors: ["#f3d9a0", "#e8c27a", "#fff1cc"], count: 80 }],
    tone: "#b88a45",
    entrance: "fill",
  },
  "south-of-france": {
    label: "Lavender",
    layers: [{ kind: "petal", colors: ["#b9a3d6", "#9d85c4", "#d4c4ea"], count: 46 }],
    tone: "#7d68a6",
    entrance: "fill",
  },
  wyoming: {
    label: "Big sky",
    layers: [
      { kind: "star", colors: ["#f1efe8", "#dfe6ef"], count: 140 },
      { kind: "shooting", colors: ["#ffffff"], count: 1 },
    ],
    tone: "#3e5568",
  },
  nashville: {
    label: "Fireflies",
    layers: [{ kind: "firefly", colors: ["#e6f28a", "#f5e27a"], count: 30 }],
    tone: "#5c6a2f",
  },
  montclair: {
    label: "Fall",
    layers: [{ kind: "leaf", colors: ["#c8642e", "#d88a3a", "#a8432a", "#e0b04a"], count: 30 }],
    tone: "#9a5530",
    entrance: "fill",
  },
  "dominican-republic": {
    label: "Sea",
    layers: [{ kind: "bubble", colors: ["#9fe0dc", "#6fc7c9"], count: 34 }],
    tone: "#2f8a8a",
    entrance: "rise",
  },
};
