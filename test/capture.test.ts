import { describe, expect, test } from "bun:test";
import { capture } from "../src/capture.ts";

const PNG_MAGIC = [137, 80, 78, 71];

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
