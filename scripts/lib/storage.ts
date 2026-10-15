import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type Storage = {
  kind: "local" | "blob";
  /** Stores a derivative and returns its public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
};

/** Writes into public/media so `next dev` can serve it. Git-ignored: dev only. */
export function localStorage(publicDir: string): Storage {
  return {
    kind: "local",
    async put(key, body) {
      const file = path.join(publicDir, "media", key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      return `/media/${key}`;
    },
  };
}

/** Vercel Blob. Needs BLOB_READ_WRITE_TOKEN (from `vercel env pull`). */
export function blobStorage(token: string): Storage {
  return {
    kind: "blob",
    async put(key, body, contentType) {
      const { put } = await import("@vercel/blob");
      const res = await put(key, body, {
        access: "public",
        token,
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      return res.url;
    },
  };
}
