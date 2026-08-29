import { parseArgs } from "node:util";
import type { CaptureOptions, Viewport } from "./capture.ts";

export interface CaptureCommand {
  readonly kind: "capture";
  readonly capture: CaptureOptions;
  /** Upload the shot right after capturing it. */
  readonly upload: boolean;
  readonly prefix: string | undefined;
  /** Print `![caption](url)` lines instead of the bare URLs. */
  readonly markdown: boolean;
}

export interface UploadCommand {
  readonly kind: "upload";
  readonly files: ReadonlyArray<string>;
  readonly prefix: string | undefined;
  readonly markdown: boolean;
}

export interface McpCommand {
  readonly kind: "mcp";
}

export interface SkillCommand {
  readonly kind: "skill";
}

export interface SetupCommand {
  readonly kind: "setup";
  readonly bucket: string;
}

export interface AlbumCommand {
  readonly kind: "album";
  readonly port: number | undefined;
}

export interface HelpCommand {
  readonly kind: "help";
}

export type Command =
  | CaptureCommand
  | UploadCommand
  | McpCommand
  | SkillCommand
  | SetupCommand
  | AlbumCommand
  | HelpCommand;

export function parseViewport(value: string): Viewport {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (match === null) {
    throw new Error(`Invalid --viewport ${value}: expected <width>x<height>, e.g. 1440x900.`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseLocalStorage(entries: ReadonlyArray<string>): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid --local-storage ${entry}: expected key=value.`);
    }
    parsed[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return parsed;
}

export function parseCommand(argv: ReadonlyArray<string>): Command {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      viewport: { type: "string" },
      "wait-for": { type: "string" },
      "scroll-to": { type: "string" },
      settle: { type: "string" },
      "local-storage": { type: "string", multiple: true },
      "full-page": { type: "boolean" },
      upload: { type: "boolean" },
      prefix: { type: "string" },
      markdown: { type: "boolean" },
      bucket: { type: "string" },
      port: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help === true || positionals.length === 0) {
    return { kind: "help" };
  }
  if (positionals[0] === "mcp") {
    return { kind: "mcp" };
  }
  if (positionals[0] === "skill") {
    return { kind: "skill" };
  }
  if (positionals[0] === "setup") {
    return { kind: "setup", bucket: values.bucket ?? "cliche-shots" };
  }
  if (positionals[0] === "album") {
    const port = values.port === undefined ? undefined : Number(values.port);
    if (port !== undefined && !Number.isInteger(port)) {
      throw new Error(`Invalid --port ${values.port}: expected a number.`);
    }
    return { kind: "album", port };
  }
  if (positionals[0] === "upload") {
    const files = positionals.slice(1);
    if (files.length === 0) throw new Error("upload: pass at least one image file.");
    return { kind: "upload", files, prefix: values.prefix, markdown: values.markdown === true };
  }
  const [url, out] = positionals;
  if (url === undefined || out === undefined) {
    throw new Error("capture: pass <url> <out.png> (or see --help).");
  }
  const settle = values.settle === undefined ? undefined : Number(values.settle);
  if (settle !== undefined && !Number.isFinite(settle)) {
    throw new Error(`Invalid --settle ${values.settle}: expected milliseconds.`);
  }
  return {
    kind: "capture",
    capture: {
      url,
      out,
      ...(values.viewport === undefined ? {} : { viewport: parseViewport(values.viewport) }),
      ...(values["wait-for"] === undefined ? {} : { waitFor: values["wait-for"] }),
      ...(values["scroll-to"] === undefined ? {} : { scrollTo: values["scroll-to"] }),
      ...(settle === undefined ? {} : { settleMilliseconds: settle }),
      ...(values["local-storage"] === undefined
        ? {}
        : { localStorage: parseLocalStorage(values["local-storage"]) }),
      ...(values["full-page"] === true ? { fullPage: true } : {}),
    },
    upload: values.upload === true,
    prefix: values.prefix,
    markdown: values.markdown === true,
  };
}
