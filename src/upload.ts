import { extname } from "node:path";
import { captionOf, objectKeyOf } from "./keys.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export interface UploadOptions {
  readonly files: ReadonlyArray<string>;
  /** Object key prefix, e.g. `pr-123`. Defaults to `cliche`. */
  readonly prefix?: string;
}

export interface UploadedFile {
  readonly file: string;
  readonly key: string;
  readonly url: string;
  /** A ready-to-paste `![caption](url)` line. */
  readonly markdown: string;
}

/** The subset of Bun.S3Client the upload needs; injectable for tests. */
export interface ObjectWriter {
  write(key: string, bytes: Uint8Array, options: { type: string }): Promise<unknown>;
}

function publicBaseUrl(): string {
  const configured = process.env.CLICHE_PUBLIC_URL;
  if (configured !== undefined) return configured.replace(/\/$/, "");
  const bucket = process.env.S3_BUCKET ?? process.env.AWS_BUCKET;
  if (bucket === undefined) {
    throw new Error(
      "No bucket configured: set S3_BUCKET (and S3_ENDPOINT + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY), or CLICHE_PUBLIC_URL alone if the bucket is resolved elsewhere.",
    );
  }
  const endpoint = process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT;
  if (endpoint !== undefined) return `${endpoint.replace(/\/$/, "")}/${bucket}`;
  const region = process.env.AWS_REGION ?? process.env.S3_REGION ?? "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

/**
 * Upload images to the S3-compatible bucket described by the standard
 * environment variables Bun.S3Client already reads (S3_* / AWS_*), and
 * return one markdown line per file. `CLICHE_PUBLIC_URL` overrides the
 * public base URL (custom domains, R2 public buckets).
 */
export async function upload(options: UploadOptions, writer?: ObjectWriter): Promise<Array<UploadedFile>> {
  const baseUrl = publicBaseUrl();
  const client = writer ?? new Bun.S3Client();
  const prefix = options.prefix ?? "cliche";
  const date = new Date().toISOString().slice(0, 10);
  const uploaded: Array<UploadedFile> = [];
  for (const file of options.files) {
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
    if (contentType === undefined) {
      console.error(`Skipping ${file}: unsupported extension`);
      continue;
    }
    const bytes = await Bun.file(file).bytes();
    const key = objectKeyOf(prefix, file, bytes, date);
    await client.write(key, bytes, { type: contentType });
    console.error(`Uploaded ${file} -> ${key}`);
    const url = `${baseUrl}/${key}`;
    uploaded.push({ file, key, url, markdown: `![${captionOf(file)}](${url})` });
  }
  return uploaded;
}
