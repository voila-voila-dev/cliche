import { basename, extname } from "node:path";

/** S3 object keys only tolerate a narrow character set. */
export function slugOf(rawPrefix: string): string {
  return rawPrefix.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/** The image's caption in the generated markdown. */
export function captionOf(file: string): string {
  return basename(file, extname(file)).replace(/[-_]+/g, " ");
}

function contentHash(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex").slice(0, 8);
}

/**
 * `<prefix>/<yyyy-mm-dd>-<basename>-<content-hash>.<ext>`: the hash makes
 * re-uploads cache-safe, the date keeps the bucket browsable.
 */
export function objectKeyOf(prefix: string, file: string, bytes: Uint8Array, date: string): string {
  const extension = extname(file);
  return `${slugOf(prefix)}/${date}-${basename(file, extension)}-${contentHash(bytes)}${extension.toLowerCase()}`;
}
