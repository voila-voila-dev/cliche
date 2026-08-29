import { describe, expect, test } from "bun:test";
import { captionOf, objectKeyOf, slugOf } from "../src/keys.ts";

describe("slugOf", () => {
  test("keeps safe characters", () => {
    expect(slugOf("pr-123_a")).toBe("pr-123_a");
  });

  test("replaces everything else", () => {
    expect(slugOf("feat/chat médias!")).toBe("feat-chat-m-dias-");
  });
});

describe("captionOf", () => {
  test("turns a file name into readable words", () => {
    expect(captionOf("qa/mission-detail_after.png")).toBe("mission detail after");
  });
});

describe("objectKeyOf", () => {
  test("prefix, date, basename, content hash, extension", () => {
    const bytes = new TextEncoder().encode("cliché");
    const key = objectKeyOf("pr-9", "shots/login-after.PNG", bytes, "2026-08-29");
    expect(key).toMatch(/^pr-9\/2026-08-29-login-after-[0-9a-f]{8}\.png$/);
  });

  test("same bytes, same key", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(objectKeyOf("p", "a.png", bytes, "2026-08-29")).toBe(
      objectKeyOf("p", "a.png", bytes, "2026-08-29"),
    );
  });
});
