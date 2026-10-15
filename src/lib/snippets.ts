/**
 * Pulls real functions out of the source tree at build time, so the code on
 * the colophon is always the code that's running.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeToHtml } from "shiki";

/** Returns `start` through the brace (or backtick) that closes it. */
export function extract(source: string, start: string): string {
  const from = source.indexOf(start);
  if (from === -1) throw new Error(`snippet start not found: ${start}`);
  // Include the doc comment directly above, if any.
  const before = source.lastIndexOf("/**", from);
  const commentEnd = before === -1 ? -1 : source.indexOf("*/", before);
  const begin = before !== -1 && source.slice(commentEnd + 2, from).trim() === "" ? before : from;

  if (/=\s*\/\*\s*glsl\s*\*\/\s*`/.test(source.slice(from, from + 200))) {
    const open = source.indexOf("`", from);
    const close = source.indexOf("`;", open + 1);
    return source.slice(begin, close + 2);
  }
  let depth = 0;
  for (let i = source.indexOf("{", from); i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(begin, i + 1);
  }
  throw new Error(`unbalanced snippet: ${start}`);
}

export async function snippet(file: string, start: string, lang: "ts" | "tsx" = "ts") {
  const source = readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), file), "utf8");
  const code = extract(source, start);
  const html = await codeToHtml(code, { lang, theme: "vesper" });
  return { file, html, lines: code.split("\n").length };
}
