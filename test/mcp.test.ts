import { describe, expect, test } from "bun:test";
import type { CaptureOptions } from "../src/capture.ts";
import { handleMessage, type McpDependencies } from "../src/mcp.ts";
import type { UploadOptions } from "../src/upload.ts";

function fakeDependencies(): {
  dependencies: McpDependencies;
  captured: Array<CaptureOptions>;
  uploaded: Array<UploadOptions>;
} {
  const captured: Array<CaptureOptions> = [];
  const uploaded: Array<UploadOptions> = [];
  return {
    captured,
    uploaded,
    dependencies: {
      capture: async (options) => {
        captured.push(options);
      },
      upload: async (options) => {
        uploaded.push(options);
        return options.files.map((file) => ({
          file,
          key: `k/${file}`,
          url: `https://assets.example.com/k/${file}`,
          markdown: `![caption](https://assets.example.com/k/${file})`,
        }));
      },
    },
  };
}

function request(method: string, params?: Record<string, unknown>, id: number = 1) {
  return { jsonrpc: "2.0" as const, id, method, ...(params === undefined ? {} : { params }) };
}

function resultOf(response: Record<string, unknown> | null): Record<string, unknown> {
  expect(response).not.toBeNull();
  return (response as { result: Record<string, unknown> }).result;
}

function firstText(result: Record<string, unknown>): string {
  return (result.content as Array<{ text: string }>)[0]?.text ?? "";
}

describe("handleMessage", () => {
  test("initialize echoes the client's protocol version", async () => {
    const { dependencies } = fakeDependencies();
    const result = resultOf(
      await handleMessage(request("initialize", { protocolVersion: "2025-03-26" }), dependencies),
    );
    expect(result.protocolVersion).toBe("2025-03-26");
    expect((result.serverInfo as { name: string }).name).toBe("cliche");
  });

  test("notifications get no response", async () => {
    const { dependencies } = fakeDependencies();
    const response = await handleMessage(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      dependencies,
    );
    expect(response).toBeNull();
  });

  test("tools/list exposes screenshot and upload", async () => {
    const { dependencies } = fakeDependencies();
    const result = resultOf(await handleMessage(request("tools/list"), dependencies));
    expect((result.tools as Array<{ name: string }>).map((tool) => tool.name)).toEqual([
      "screenshot",
      "upload",
    ]);
  });

  test("screenshot with upload returns the bare URL by default", async () => {
    const { dependencies, captured } = fakeDependencies();
    const result = resultOf(
      await handleMessage(
        request("tools/call", {
          name: "screenshot",
          arguments: {
            url: "http://localhost:3000",
            out: "shot.png",
            viewport: "390x844",
            wait_for: "main",
            upload: true,
          },
        }),
        dependencies,
      ),
    );
    expect(captured[0]?.viewport).toEqual({ width: 390, height: 844 });
    expect(captured[0]?.waitFor).toBe("main");
    expect(firstText(result)).toBe("https://assets.example.com/k/shot.png");
  });

  test("markdown: true switches to markdown lines", async () => {
    const { dependencies } = fakeDependencies();
    const result = resultOf(
      await handleMessage(
        request("tools/call", {
          name: "upload",
          arguments: { files: ["a.png"], markdown: true },
        }),
        dependencies,
      ),
    );
    expect(firstText(result)).toBe("![caption](https://assets.example.com/k/a.png)");
  });

  test("tool failures come back as isError results, not crashes", async () => {
    const { dependencies } = fakeDependencies();
    const failing: McpDependencies = {
      ...dependencies,
      capture: async () => {
        throw new Error("no such host");
      },
    };
    const result = resultOf(
      await handleMessage(
        request("tools/call", { name: "screenshot", arguments: { url: "http://nope" } }),
        failing,
      ),
    );
    expect(result.isError).toBe(true);
    expect(firstText(result)).toBe("no such host");
  });

  test("unknown methods answer with a JSON-RPC error", async () => {
    const { dependencies } = fakeDependencies();
    const response = await handleMessage(request("resources/list"), dependencies);
    expect((response as { error: { code: number } }).error.code).toBe(-32601);
  });
});
