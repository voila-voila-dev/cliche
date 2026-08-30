import { describe, expect, test } from "bun:test";
import { assertWebViewAvailable, capture } from "../src/capture.ts";

const PNG_MAGIC = [137, 80, 78, 71];

describe("assertWebViewAvailable", () => {
  test("an older Bun gets a message naming both versions", () => {
    expect(() => assertWebViewAvailable(undefined, "1.2.23")).toThrow(
      "cliche needs Bun 1.4.0 or newer for Bun.WebView, and this is Bun 1.2.23.",
    );
  });

  test("a runtime that has it passes", () => {
    expect(() => assertWebViewAvailable(() => {}, "1.4.0")).not.toThrow();
  });
});

describe("capture", () => {
  test(
    "screenshots a data: URL page to a PNG file",
    async () => {
      const out = `${import.meta.dir}/tmp-capture-smoke.png`;
      try {
        await capture({
          url: "data:text/html,<body style='background:%23ff6600'><h1 id='hello'>Ouistiti</h1></body>",
          out,
          viewport: { width: 320, height: 240 },
          waitFor: "#hello",
          settleMilliseconds: 100,
        });
        const bytes = await Bun.file(out).bytes();
        expect([...bytes.slice(0, 4)]).toEqual(PNG_MAGIC);
      } finally {
        await Bun.file(out).delete().catch(() => {});
      }
    },
    30_000,
  );
});
