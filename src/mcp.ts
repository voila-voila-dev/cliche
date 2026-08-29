import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture as captureImplementation, type CaptureOptions } from "./capture.ts";
import { parseLocalStorage, parseViewport } from "./options.ts";
import { upload as uploadImplementation, type UploadedFile, type UploadOptions } from "./upload.ts";

/**
 * A hand-rolled MCP server: the stdio transport is newline-delimited JSON-RPC
 * 2.0, and this server only needs initialize + tools, so the protocol fits in
 * this file and the package stays zero-dependency.
 */

const PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcMessage {
  readonly jsonrpc: "2.0";
  readonly id?: number | string;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
}

/** The implementations, injectable for tests. */
export interface McpDependencies {
  readonly capture: (options: CaptureOptions) => Promise<void>;
  readonly upload: (options: UploadOptions) => Promise<Array<UploadedFile>>;
}

const TOOLS = [
  {
    name: "screenshot",
    description:
      "Screenshot a web page locally with Bun.WebView (no browser install). Optionally upload it to the configured S3-compatible bucket and return its public URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The page to screenshot." },
        out: {
          type: "string",
          description: "Where to write the PNG. Defaults to a temporary file.",
        },
        viewport: {
          type: "string",
          description: "Viewport as <width>x<height>. Defaults to 1440x900 (use 390x844 for mobile).",
        },
        wait_for: {
          type: "string",
          description: "CSS selector to wait for before shooting (15s timeout).",
        },
        scroll_to: {
          type: "string",
          description: "CSS selector scrolled into view before shooting.",
        },
        settle_ms: {
          type: "number",
          description: "Milliseconds to let the page settle after load. Defaults to 1500.",
        },
        full_page: {
          type: "boolean",
          description: "Grow the viewport to the full page height before shooting.",
        },
        local_storage: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
            "Entries seeded into the target origin's localStorage before the page loads (e.g. a session token for authenticated screens).",
        },
        upload: {
          type: "boolean",
          description: "Upload the shot and return its public URL.",
        },
        prefix: {
          type: "string",
          description: "Object key prefix for the upload, e.g. pr-123.",
        },
        markdown: {
          type: "boolean",
          description: "Return a ![caption](url) markdown line instead of the bare URL.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "upload",
    description:
      "Upload local images to the configured S3-compatible bucket and return their public URLs (content-hashed keys, safe to re-upload).",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: { type: "string" },
          description: "Paths of the images to upload.",
        },
        prefix: {
          type: "string",
          description: "Object key prefix, e.g. pr-123.",
        },
        markdown: {
          type: "boolean",
          description: "Return ![caption](url) markdown lines instead of the bare URLs.",
        },
      },
      required: ["files"],
    },
  },
];

function textResult(text: string, isError = false): Record<string, unknown> {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

function renderUploads(uploaded: ReadonlyArray<UploadedFile>, markdown: boolean): string {
  return uploaded.map((entry) => (markdown ? entry.markdown : entry.url)).join("\n");
}

function temporaryOut(): string {
  return join(tmpdir(), `cliche-${Date.now().toString(36)}.png`);
}

async function callTool(
  name: string,
  input: Record<string, unknown>,
  dependencies: McpDependencies,
): Promise<Record<string, unknown>> {
  if (name === "screenshot") {
    const out = typeof input.out === "string" ? input.out : temporaryOut();
    await dependencies.capture({
      url: String(input.url),
      out,
      ...(typeof input.viewport === "string" ? { viewport: parseViewport(input.viewport) } : {}),
      ...(typeof input.wait_for === "string" ? { waitFor: input.wait_for } : {}),
      ...(typeof input.scroll_to === "string" ? { scrollTo: input.scroll_to } : {}),
      ...(typeof input.settle_ms === "number" ? { settleMilliseconds: input.settle_ms } : {}),
      ...(input.full_page === true ? { fullPage: true } : {}),
      ...(input.local_storage !== undefined && typeof input.local_storage === "object"
        ? { localStorage: input.local_storage as Record<string, string> }
        : {}),
    });
    if (input.upload !== true) {
      return textResult(`Captured ${String(input.url)} -> ${out}`);
    }
    const uploaded = await dependencies.upload({
      files: [out],
      ...(typeof input.prefix === "string" ? { prefix: input.prefix } : {}),
    });
    return textResult(renderUploads(uploaded, input.markdown === true));
  }
  if (name === "upload") {
    const uploaded = await dependencies.upload({
      files: (input.files as Array<string>) ?? [],
      ...(typeof input.prefix === "string" ? { prefix: input.prefix } : {}),
    });
    return textResult(renderUploads(uploaded, input.markdown === true));
  }
  return textResult(`Unknown tool: ${name}`, true);
}

/** Handle one JSON-RPC message; null means nothing to send back. */
export async function handleMessage(
  message: JsonRpcMessage,
  dependencies: McpDependencies,
): Promise<Record<string, unknown> | null> {
  // Notifications carry no id and expect no response.
  if (message.id === undefined) return null;
  const reply = (result: Record<string, unknown>) => ({
    jsonrpc: "2.0",
    id: message.id,
    result,
  });
  switch (message.method) {
    case "initialize":
      return reply({
        protocolVersion:
          typeof message.params?.protocolVersion === "string"
            ? message.params.protocolVersion
            : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "cliche", version: "0.1.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(message.params?.name);
      const input = (message.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        return reply(await callTool(name, input, dependencies));
      } catch (error) {
        return reply(textResult(error instanceof Error ? error.message : String(error), true));
      }
    }
    default:
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Method not found: ${message.method}` },
      };
  }
}

/** Serve MCP over stdio until stdin closes. */
export async function runMcpServer(): Promise<void> {
  const dependencies: McpDependencies = {
    capture: captureImplementation,
    upload: uploadImplementation,
  };
  for await (const line of console) {
    if (line.trim() === "") continue;
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      continue;
    }
    const response = await handleMessage(message, dependencies);
    if (response !== null) console.log(JSON.stringify(response));
  }
}
