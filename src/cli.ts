#!/usr/bin/env bun
import { capture } from "./capture.ts";
import { parseCommand } from "./options.ts";
import { upload } from "./upload.ts";

const HELP = `cliche — take a cliché of any page and get a shareable URL.

Usage:
  cliche <url> <out.png> [options]        Screenshot a page.
  cliche <url> <out.png> --upload         …and upload it, printing markdown.
  cliche upload [--prefix pr-123] <files> Upload images, printing markdown.

Capture options:
  --viewport <WxH>            Viewport, default 1440x900 (390x844 for mobile).
  --wait-for <css>            Wait for a selector before shooting (15s max).
  --scroll-to <css>           Scroll a selector into view before shooting.
  --settle <ms>               Let the page settle after load, default 1500.
  --local-storage key=value   Seed localStorage on the target origin
                              (repeatable; e.g. a session token).

Upload configuration (standard Bun.S3Client environment variables):
  S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (or AWS_*)
  CLICHE_PUBLIC_URL           Public base URL of the bucket (custom domain).

Markdown goes to stdout, progress to stderr. Ouistiti !`;

async function main(): Promise<void> {
  const command = parseCommand(Bun.argv.slice(2));
  switch (command.kind) {
    case "help":
      console.log(HELP);
      return;
    case "upload": {
      const uploaded = await upload({ files: command.files, ...(command.prefix === undefined ? {} : { prefix: command.prefix }) });
      console.log(uploaded.map((entry) => entry.markdown).join("\n"));
      return;
    }
    case "capture": {
      await capture(command.capture);
      console.error(`Captured ${command.capture.url} -> ${command.capture.out}`);
      if (command.upload) {
        const uploaded = await upload({ files: [command.capture.out], ...(command.prefix === undefined ? {} : { prefix: command.prefix }) });
        console.log(uploaded.map((entry) => entry.markdown).join("\n"));
      }
      return;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
