import { afterEach, describe, expect, test } from "bun:test";
import { upload } from "../src/upload.ts";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of ["CLICHE_PUBLIC_URL", "CLICHE_BUCKET", "CLICHE_ENDPOINT", "CLICHE_REGION"]) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

async function withTemporaryPng(run: (file: string) => Promise<void>): Promise<void> {
  const file = `${import.meta.dir}/tmp-upload-fixture.png`;
  await Bun.write(file, new Uint8Array([137, 80, 78, 71]));
  try {
    await run(file);
  } finally {
    await Bun.file(file).delete();
  }
}

describe("upload", () => {
  test("writes through the client and returns markdown lines", async () => {
    process.env.CLICHE_PUBLIC_URL = "https://assets.example.com/";
    const written: Array<{ key: string; type: string }> = [];
    await withTemporaryPng(async (file) => {
      const [uploaded] = await upload({ files: [file], prefix: "pr-1" }, {
        write: async (key, _bytes, options) => written.push({ key, type: options.type }),
      });
      expect(written).toHaveLength(1);
      expect(written[0]?.type).toBe("image/png");
      expect(uploaded?.url).toBe(`https://assets.example.com/${written[0]?.key}`);
      expect(uploaded?.markdown).toBe(`![tmp upload fixture](${uploaded?.url})`);
    });
  });

  test("builds the public URL from the endpoint when not overridden", async () => {
    delete process.env.CLICHE_PUBLIC_URL;
    process.env.CLICHE_BUCKET = "shots";
    process.env.CLICHE_ENDPOINT = "https://accountid.r2.cloudflarestorage.com";
    await withTemporaryPng(async (file) => {
      const [uploaded] = await upload({ files: [file] }, { write: async () => {} });
      expect(uploaded?.url).toStartWith("https://accountid.r2.cloudflarestorage.com/shots/cliche/");
    });
  });

  test("fails with a helpful message when nothing is configured", async () => {
    delete process.env.CLICHE_PUBLIC_URL;
    delete process.env.CLICHE_BUCKET;
    expect(upload({ files: ["a.png"] }, { write: async () => {} })).rejects.toThrow(
      "set CLICHE_BUCKET",
    );
  });

  test("ignores an ambient S3_BUCKET meant for something else", async () => {
    delete process.env.CLICHE_PUBLIC_URL;
    delete process.env.CLICHE_BUCKET;
    process.env.S3_BUCKET = "someone-elses-bucket";
    try {
      expect(upload({ files: ["a.png"] }, { write: async () => {} })).rejects.toThrow(
        "set CLICHE_BUCKET",
      );
    } finally {
      delete process.env.S3_BUCKET;
    }
  });

  test("skips unsupported extensions", async () => {
    process.env.CLICHE_PUBLIC_URL = "https://assets.example.com";
    const uploaded = await upload({ files: ["notes.txt"] }, { write: async () => {} });
    expect(uploaded).toEqual([]);
  });
});
