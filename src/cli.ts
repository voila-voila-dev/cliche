#!/usr/bin/env bun
import { capture } from "./capture.ts";
import { runMcpServer } from "./mcp.ts";
import { parseCommand } from "./options.ts";
import { setup } from "./setup.ts";
import { installSkill } from "./skill.ts";
import { upload, type UploadedFile } from "./upload.ts";

const HELP = `cliche — take a cliché of any page and get a shareable URL.

Usage:
  cliche <url> <out.png> [options]        Screenshot a page.
  cliche <url> <out.png> --upload         …and upload it, printing its URL.
  cliche upload [--prefix pr-123] <files> Upload images, printing their URLs.
  cliche mcp                              Serve the tools over MCP (stdio).
  cliche setup [--bucket name]            Create an R2 bucket via wrangler and
                                          write the S3 config to .env.
  cliche album [--port 4949]              Browse the bucket as a photo album.
  cliche skill                            Install the PR-screenshots skill into
                                          .claude/skills/ (Claude Code).

Capture options:
  --viewport <WxH>            Viewport, default 1440x900 (390x844 for mobile).
  --wait-for <css>            Wait for a selector before shooting (15s max).
  --scroll-to <css>           Scroll a selector into view before shooting.
  --settle <ms>               Let the page settle after load, default 1500.
  --full-page                 Grow the viewport to the full page height.
  --local-storage key=value   Seed localStorage on the target origin
                              (repeatable; e.g. a session token).

Upload options:
  --prefix <name>             Object key prefix, e.g. pr-123.
  --markdown                  Print ![caption](url) lines instead of URLs.

Upload configuration (environment, all prefixed so nothing else collides):
  CLICHE_BUCKET               Bucket name.
  CLICHE_ENDPOINT             S3 endpoint (omit on AWS).
  CLICHE_ACCESS_KEY_ID        Access key.
  CLICHE_SECRET_ACCESS_KEY    Secret key.
  CLICHE_REGION               Region (defaults to us-east-1 on AWS).
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
    case "skill": {
      const target = await installSkill();
      console.error(`Installed the PR-screenshots skill at ${target}`);
      return;
    }
    case "setup":
      await setup(command.bucket);
      return;
    case "album": {
      if (command.port !== undefined) process.env.PORT = String(command.port);
      // Dynamic with a computed specifier so tsc ships it untouched: the album
      // is TS + HTML imports that Bun resolves at runtime from the package.
      const albumEntry = "../apps/album/src/index.ts";
      await import(albumEntry);
      const url = `http://localhost:${process.env.PORT ?? 4949}`;
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      Bun.spawn([opener, url], { stdout: "ignore", stderr: "ignore" });
      // Keep the process alive for the server.
      await new Promise(() => {});
      return;
    }
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
