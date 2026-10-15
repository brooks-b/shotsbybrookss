/**
 * Builds synthetic Fujifilm JPEGs for tests and for trying the pipeline
 * before real originals arrive. Writes a real EXIF block (IFD0, Exif IFD,
 * GPS IFD and a Fuji maker note) so the ingest path runs exactly as it
 * would on a file straight off the X-T50.
 */
import sharp from "sharp";

type Field =
  | { tag: number; type: "ascii"; value: string }
  | { tag: number; type: "short"; value: number }
  | { tag: number; type: "long"; value: number }
  | { tag: number; type: "rational"; value: [number, number][] }
  | { tag: number; type: "undefined"; value: Uint8Array };

const TYPE_CODE = { ascii: 2, short: 3, long: 4, rational: 5, undefined: 7 } as const;

function payload(field: Field): Uint8Array {
  switch (field.type) {
    case "ascii":
      return new TextEncoder().encode(field.value + "\0");
    case "short": {
      const b = new Uint8Array(2);
      new DataView(b.buffer).setUint16(0, field.value, true);
      return b;
    }
    case "long": {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setUint32(0, field.value, true);
      return b;
    }
    case "rational": {
      const b = new Uint8Array(field.value.length * 8);
      const v = new DataView(b.buffer);
      field.value.forEach(([num, den], i) => {
        v.setUint32(i * 8, num, true);
        v.setUint32(i * 8 + 4, den, true);
      });
      return b;
    }
    case "undefined":
      return field.value;
  }
}

function count(field: Field, bytes: Uint8Array): number {
  if (field.type === "rational") return field.value.length;
  if (field.type === "short" || field.type === "long") return 1;
  return bytes.length;
}

/**
 * Serialises one IFD at `start` (an offset in the final TIFF buffer).
 * Values over 4 bytes go in a data area right after the entries.
 */
function writeIfd(fields: Field[], start: number): Uint8Array {
  const sorted = [...fields].sort((a, b) => a.tag - b.tag);
  const headerSize = 2 + sorted.length * 12 + 4;
  const blobs = sorted.map(payload);
  const dataSize = blobs.reduce((s, b) => s + (b.length > 4 ? b.length + (b.length % 2) : 0), 0);
  const out = new Uint8Array(headerSize + dataSize);
  const view = new DataView(out.buffer);

  view.setUint16(0, sorted.length, true);
  let data = headerSize;
  sorted.forEach((field, i) => {
    const entry = 2 + i * 12;
    const bytes = blobs[i];
    view.setUint16(entry, field.tag, true);
    view.setUint16(entry + 2, TYPE_CODE[field.type], true);
    view.setUint32(entry + 4, count(field, bytes), true);
    if (bytes.length <= 4) {
      out.set(bytes, entry + 8);
    } else {
      view.setUint32(entry + 8, start + data, true);
      out.set(bytes, data);
      data += bytes.length + (bytes.length % 2);
    }
  });
  view.setUint32(2 + sorted.length * 12, 0, true);
  return out;
}

/** A Fuji maker note with FilmMode and Saturation set. Offsets are note-relative. */
export function fujiMakerNote(opts: { filmMode?: number; saturation?: number }): Uint8Array {
  const fields: Field[] = [{ tag: 0x0000, type: "undefined", value: new TextEncoder().encode("0130") }];
  if (opts.saturation !== undefined) fields.push({ tag: 0x1003, type: "short", value: opts.saturation });
  if (opts.filmMode !== undefined) fields.push({ tag: 0x1401, type: "short", value: opts.filmMode });

  const ifd = writeIfd(fields, 12);
  const note = new Uint8Array(12 + ifd.length);
  note.set(new TextEncoder().encode("FUJIFILM"), 0);
  new DataView(note.buffer).setUint32(8, 12, true);
  note.set(ifd, 12);
  return note;
}

export type FixtureOptions = {
  width?: number;
  height?: number;
  /** Two hex colours for the gradient. */
  colors?: [string, string];
  exposure?: [number, number];
  fNumber?: [number, number];
  iso?: number;
  focalLength?: [number, number];
  lens?: string;
  takenAt?: string; // "YYYY:MM:DD HH:MM:SS"
  filmMode?: number;
  saturation?: number;
  gps?: { lat: number; lng: number };
};

function dms(deg: number): [number, number][] {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60 * 1000);
  return [
    [d, 1],
    [m, 1],
    [s, 1000],
  ];
}

/** Builds the APP1 "Exif" segment body (without the FFE1 marker and length). */
export function buildExif(opts: FixtureOptions): Uint8Array {
  const note = fujiMakerNote({ filmMode: opts.filmMode, saturation: opts.saturation });

  const exifFields: Field[] = [
    { tag: 0x829a, type: "rational", value: [opts.exposure ?? [1, 250]] },
    { tag: 0x829d, type: "rational", value: [opts.fNumber ?? [28, 10]] },
    { tag: 0x8827, type: "short", value: opts.iso ?? 200 },
    { tag: 0x9003, type: "ascii", value: opts.takenAt ?? "2026:05:12 17:42:08" },
    { tag: 0x920a, type: "rational", value: [opts.focalLength ?? [23, 1]] },
    { tag: 0x927c, type: "undefined", value: note },
    { tag: 0xa433, type: "ascii", value: "FUJIFILM" },
    { tag: 0xa434, type: "ascii", value: opts.lens ?? "XF23mmF2 R WR" },
  ];
  const gpsFields: Field[] | null = opts.gps
    ? [
        { tag: 0x0001, type: "ascii", value: opts.gps.lat >= 0 ? "N" : "S" },
        { tag: 0x0002, type: "rational", value: dms(opts.gps.lat) },
        { tag: 0x0003, type: "ascii", value: opts.gps.lng >= 0 ? "E" : "W" },
        { tag: 0x0004, type: "rational", value: dms(opts.gps.lng) },
      ]
    : null;

  // IFD0 has fixed fields; pointer values are filled after we know sizes.
  const ifd0 = (exifAt: number, gpsAt: number): Field[] => {
    const f: Field[] = [
      { tag: 0x010f, type: "ascii", value: "FUJIFILM" },
      { tag: 0x0110, type: "ascii", value: "X-T50" },
      { tag: 0x0112, type: "short", value: 1 },
      { tag: 0x8769, type: "long", value: exifAt },
    ];
    if (gpsFields) f.push({ tag: 0x8825, type: "long", value: gpsAt });
    return f;
  };

  const ifd0Size = writeIfd(ifd0(0, 0), 8).length;
  const exifAt = 8 + ifd0Size;
  const exifIfd = writeIfd(exifFields, exifAt);
  const gpsAt = exifAt + exifIfd.length;
  const gpsIfd = gpsFields ? writeIfd(gpsFields, gpsAt) : new Uint8Array(0);
  const ifd0Bytes = writeIfd(ifd0(exifAt, gpsAt), 8);

  const tiff = new Uint8Array(8 + ifd0Bytes.length + exifIfd.length + gpsIfd.length);
  const v = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49], 0); // "II": little-endian
  v.setUint16(2, 42, true);
  v.setUint32(4, 8, true);
  tiff.set(ifd0Bytes, 8);
  tiff.set(exifIfd, exifAt);
  tiff.set(gpsIfd, gpsAt);

  const header = new TextEncoder().encode("Exif\0\0");
  const out = new Uint8Array(header.length + tiff.length);
  out.set(header, 0);
  out.set(tiff, header.length);
  return out;
}

/** Inserts an APP1 segment straight after the JPEG SOI marker. */
export function injectExif(jpeg: Uint8Array, exif: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("not a JPEG");
  const length = exif.length + 2;
  const segment = new Uint8Array(4 + exif.length);
  segment.set([0xff, 0xe1, length >> 8, length & 0xff], 0);
  segment.set(exif, 4);
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(segment, 2);
  out.set(jpeg.subarray(2), 2 + segment.length);
  return out;
}

/** A gradient JPEG with full Fuji EXIF. Defaults to 4:5 portrait. */
export async function makeFixtureJpeg(opts: FixtureOptions = {}): Promise<Buffer> {
  const width = opts.width ?? 1600;
  const height = opts.height ?? 2000;
  const [a, b] = opts.colors ?? ["#c98a4b", "#2b2421"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width * 0.62}" cy="${height * 0.34}" r="${width * 0.16}" fill="#f2d7a8" opacity="0.55"/>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  return Buffer.from(injectExif(jpeg, buildExif(opts)));
}
