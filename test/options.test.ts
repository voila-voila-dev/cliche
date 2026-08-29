import { describe, expect, test } from "bun:test";
import { parseCommand, parseLocalStorage, parseViewport } from "../src/options.ts";

describe("parseViewport", () => {
  test("parses WxH", () => {
    expect(parseViewport("390x844")).toEqual({ width: 390, height: 844 });
  });

  test("rejects malformed values", () => {
    expect(() => parseViewport("wide")).toThrow("Invalid --viewport");
  });
});

describe("parseLocalStorage", () => {
  test("splits on the first equals sign only", () => {
    expect(parseLocalStorage(["token=a=b", "theme=dark"])).toEqual({ token: "a=b", theme: "dark" });
  });

  test("rejects entries without a key", () => {
    expect(() => parseLocalStorage(["=nope"])).toThrow("Invalid --local-storage");
  });
});

describe("parseCommand", () => {
  test("no arguments means help", () => {
    expect(parseCommand([])).toEqual({ kind: "help" });
  });

  test("capture with every option", () => {
    const command = parseCommand([
      "http://localhost:4001/missions",
      "shot.png",
      "--viewport",
      "390x844",
      "--wait-for",
      "[data-testid=list]",
      "--scroll-to",
      "footer",
      "--settle",
      "2000",
      "--local-storage",
      "session=abc",
      "--upload",
      "--prefix",
      "pr-42",
    ]);
    expect(command).toEqual({
      kind: "capture",
      capture: {
        url: "http://localhost:4001/missions",
        out: "shot.png",
        viewport: { width: 390, height: 844 },
        waitFor: "[data-testid=list]",
        scrollTo: "footer",
        settleMilliseconds: 2000,
        localStorage: { session: "abc" },
      },
      upload: true,
      prefix: "pr-42",
    });
  });

  test("capture requires an output path", () => {
    expect(() => parseCommand(["http://localhost:4001"])).toThrow("capture: pass <url> <out.png>");
  });

  test("upload subcommand collects files", () => {
    expect(parseCommand(["upload", "--prefix", "pr-7", "a.png", "b.png"])).toEqual({
      kind: "upload",
      files: ["a.png", "b.png"],
      prefix: "pr-7",
    });
  });

  test("upload requires files", () => {
    expect(() => parseCommand(["upload"])).toThrow("at least one image");
  });
});
