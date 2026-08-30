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

/**
 * Every setting is read from a CLICHE_-prefixed variable and handed to
 * Bun.S3Client explicitly, so cliche never picks up the S3_/AWS_ variables
 * a shell may already carry for something else.
 */
export function s3Options(): Bun.S3Options {
  const bucket = process.env.CLICHE_BUCKET;
  if (bucket === undefined) {
    throw new Error(
      "No bucket configured: set CLICHE_BUCKET (plus CLICHE_ENDPOINT, CLICHE_ACCESS_KEY_ID and CLICHE_SECRET_ACCESS_KEY). Run `cliche setup` to create one on Cloudflare R2.",
    );
  }
  const endpoint = process.env.CLICHE_ENDPOINT;
  const accessKeyId = process.env.CLICHE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLICHE_SECRET_ACCESS_KEY;
  const region = process.env.CLICHE_REGION;
  return {
    bucket,
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(accessKeyId === undefined ? {} : { accessKeyId }),
    ...(secretAccessKey === undefined ? {} : { secretAccessKey }),
    ...(region === undefined ? {} : { region }),
  };
}

/** An S3 client for the configured bucket. */
export function createClient(): Bun.S3Client {
  return new Bun.S3Client(s3Options());
}

export function publicBaseUrl(): string {
  const configured = process.env.CLICHE_PUBLIC_URL;
  if (configured !== undefined) return configured.replace(/\/$/, "");
  const { bucket, endpoint, region } = s3Options();
  if (endpoint !== undefined) return `${endpoint.replace(/\/$/, "")}/${bucket}`;
  return `https://${bucket}.s3.${region ?? "us-east-1"}.amazonaws.com`;
}

/**
 * Upload images to the S3-compatible bucket described by the CLICHE_
 * environment variables, and return one entry per file. `CLICHE_PUBLIC_URL`
 * sets the public base URL (custom domains, R2 public buckets).
 */
export async function upload(options: UploadOptions, writer?: ObjectWriter): Promise<Array<UploadedFile>> {
  const baseUrl = publicBaseUrl();
  const client = writer ?? createClient();
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
