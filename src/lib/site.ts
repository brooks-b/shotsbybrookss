/** Site-wide copy and links. Brooks: edit anything in here freely. */
export const site = {
  name: "Brooks Barrett",
  handle: "shotsbybrookss",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://shotsbybrookss.vercel.app",
  instagram: "https://www.instagram.com/shotsbybrookss/",
  github: "https://github.com/brooks-b/shotsbybrookss",
  /** Open item: Brooks to confirm a public contact email. */
  email: null as string | null,
  description: "Photography by Brooks Barrett. Shot on a Fujifilm X-T50.",

  /** Draft. Brooks to edit. */
  statement:
    "I started out shooting high school sports. In 2025 I started taking the camera with me when I traveled. This is where it's been since.",
  arc: "From the sideline to the world",

  /** Draft. Brooks to edit. */
  bio: [
    "Vanderbilt, class of 2029. Minors in National Security, Business, and Generative AI.",
    "Based between Nashville and the New York area.",
    "Everything here is shot on a Fujifilm X-T50.",
  ],

  camera: "Fujifilm X-T50",
  /** Open item: Brooks to supply the lens list. */
  lenses: [] as string[],

  clocks: [
    { label: "Nashville", tz: "America/Chicago" },
    { label: "New York", tz: "America/New_York" },
  ],
} as const;
