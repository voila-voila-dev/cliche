#!/usr/bin/env bun
import { capture } from "./capture.ts";
import { runMcpServer } from "./mcp.ts";
import { parseCommand } from "./options.ts";
import { upload, type UploadedFile } from "./upload.ts";

const HELP = `cliche — take a cliché of any page and get a shareable URL.

Usage:
  cliche <url> <out.png> [options]        Screenshot a page.
  cliche <url> <out.png> --upload         …and upload it, printing its URL.
  cliche upload [--prefix pr-123] <files> Upload images, printing their URLs.
  cliche mcp                              Serve the tools over MCP (stdio).

Capture options:
  --viewport <WxH>            Viewport, default 1440x900 (390x844 for mobile).
  --wait-for <css>            Wait for a selector before shooting (15s max).
  --scroll-to <css>           Scroll a selector into view before shooting.
  --settle <ms>               Let the page settle after load, default 1500.
  --local-storage key=value   Seed localStorage on the target origin
                              (repeatable; e.g. a session token).

Upload options:
  --prefix <name>             Object key prefix, e.g. pr-123.
  --markdown                  Print ![caption](url) lines instead of URLs.

Upload configuration (standard Bun.S3Client environment variables):
  S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (or AWS_*)
  CLICHE_PUBLIC_URL           Public base URL of the bucket (custom domain).

URLs go to stdout, progress to stderr. Ouistiti !`;

function printUploads(uploaded: ReadonlyArray<UploadedFile>, markdown: boolean): void {
  console.log(uploaded.map((entry) => (markdown ? entry.markdown : entry.url)).join("\n"));
}

async function main(): Promise<void> {
  const command = parseCommand(Bun.argv.slice(2));
  switch (command.kind) {
    case "help":
      console.log(HELP);
      return;
    case "mcp":
      await runMcpServer();
      return;
    case "upload": {
      const uploaded = await upload({
        files: command.files,
        ...(command.prefix === undefined ? {} : { prefix: command.prefix }),
      });
      printUploads(uploaded, command.markdown);
      return;
    }
    case "capture": {
      await capture(command.capture);
      console.error(`Captured ${command.capture.url} -> ${command.capture.out}`);
      if (command.upload) {
        const uploaded = await upload({
          files: [command.capture.out],
          ...(command.prefix === undefined ? {} : { prefix: command.prefix }),
        });
        printUploads(uploaded, command.markdown);
      }
      return;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
