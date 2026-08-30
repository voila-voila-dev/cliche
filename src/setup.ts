/**
 * One-command S3 setup on Cloudflare R2, riding the user's `wrangler login`
 * session: create the bucket, enable its managed public r2.dev URL, and
 * write the resulting configuration to `.env`. The only step wrangler cannot
 * do is minting S3 API keys — the dashboard link for that is printed (and
 * left as a comment in `.env`).
 */

const DASHBOARD_TOKENS_URL = "https://dash.cloudflare.com/?to=/:account/r2/api-tokens";

async function wrangler(
  args: Array<string>,
  options: { interactive?: boolean } = {},
): Promise<{ exitCode: number; output: string }> {
  const subprocess = Bun.spawn(["bunx", "wrangler", ...args], {
    stdin: "inherit",
    stdout: options.interactive === true ? "inherit" : "pipe",
    stderr: options.interactive === true ? "inherit" : "pipe",
  });
  const exitCode = await subprocess.exited;
  const output =
    options.interactive === true
      ? ""
      : (await new Response(subprocess.stdout).text()) +
        (await new Response(subprocess.stderr).text());
  return { exitCode, output };
}

export function parseAccountId(whoamiOutput: string): string | null {
  // `wrangler whoami` prints an account table; a lone account is unambiguous.
  const ids = [...new Set(whoamiOutput.match(/\b[0-9a-f]{32}\b/g) ?? [])];
  return ids.length === 1 ? (ids[0] ?? null) : null;
}

export function parsePublicUrl(devUrlOutput: string): string | null {
  return devUrlOutput.match(/https:\/\/[a-z0-9-]+\.r2\.dev/)?.[0] ?? null;
}

function environmentBlock(
  bucket: string,
  publicUrl: string | null,
  accountId: string | null,
): string {
  const lines = [
    "",
    "# cliche, added by `cliche setup` (https://cliche.voila.dev)",
    `CLICHE_BUCKET=${bucket}`,
    accountId === null
      ? "# CLICHE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com"
      : `CLICHE_ENDPOINT=https://${accountId}.r2.cloudflarestorage.com`,
    ...(publicUrl === null ? [] : [`CLICHE_PUBLIC_URL=${publicUrl}`]),
    `# Mint the two keys at ${DASHBOARD_TOKENS_URL} (Object Read & Write on ${bucket}):`,
    "# CLICHE_ACCESS_KEY_ID=",
    "# CLICHE_SECRET_ACCESS_KEY=",
    "",
  ];
  return lines.join("\n");
}

export async function setup(bucket: string): Promise<void> {
  console.error(`Setting up Cloudflare R2 bucket "${bucket}" via wrangler…`);

  const whoami = await wrangler(["whoami"]);
  if (whoami.exitCode !== 0 || whoami.output.includes("You are not authenticated")) {
    throw new Error("wrangler is not logged in — run `bunx wrangler login` first.");
  }
  const accountId = parseAccountId(whoami.output);
  if (accountId === null) {
    console.error(
      "Several Cloudflare accounts found: wrangler will ask which one to use (set CLOUDFLARE_ACCOUNT_ID to skip the prompt).",
    );
  }

  const create = await wrangler(["r2", "bucket", "create", bucket], { interactive: true });
  if (create.exitCode !== 0) {
    // Most likely the bucket already exists, which is fine for reruns; the
    // dev-url step below fails loudly if the bucket truly is not there.
    console.error(`(bucket create exited ${create.exitCode} — continuing, it probably already exists)`);
  }

  console.error("Enabling the managed public r2.dev URL…");
  await wrangler(["r2", "bucket", "dev-url", "enable", bucket, "--force"], { interactive: true });
  const devUrl = await wrangler(["r2", "bucket", "dev-url", "get", bucket]);
  const publicUrl = parsePublicUrl(devUrl.output);

  const environmentFile = Bun.file(".env");
  const existing = (await environmentFile.exists()) ? await environmentFile.text() : "";
  if (existing.includes("CLICHE_BUCKET=")) {
    console.error(".env already has a CLICHE_BUCKET. Printing the block instead of appending:");
    console.log(environmentBlock(bucket, publicUrl, accountId));
  } else {
    await Bun.write(".env", existing + environmentBlock(bucket, publicUrl, accountId));
    console.error("Wrote the configuration to .env.");
  }

  console.error(`
Almost there — one last step wrangler cannot do:
  1. Open ${DASHBOARD_TOKENS_URL}
  2. Create an API token with "Object Read & Write" on "${bucket}"
  3. Put the two values in .env as CLICHE_ACCESS_KEY_ID / CLICHE_SECRET_ACCESS_KEY

Then take your first cliché:
  bunx @voila.dev/cliche https://example.com shot.png --upload`);
}
