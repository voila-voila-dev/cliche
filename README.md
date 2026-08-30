<img src="https://raw.githubusercontent.com/voila-voila-dev/cliche/main/assets/og.png" alt="cliche: screenshot any page, get a URL. Just Bun." width="100%">

# cliche 📸

Screenshot any page, get a URL. No Playwright, no browser download, no
dependencies. Just Bun. Ouistiti ! 🐒

Capture runs on [`Bun.WebView`](https://bun.com/docs/runtime/webview), upload
on `Bun.S3Client`. Everything happens on your machine; the only thing that
leaves it is the upload to your own bucket. Requires Bun 1.4.0 or newer.

[cliche.voila.dev](https://cliche.voila.dev)

```sh
bunx @voila.dev/cliche http://localhost:3000/missions shot.png --upload --prefix pr-123
```

```
Captured http://localhost:3000/missions -> shot.png
Uploaded shot.png -> pr-123/2026-08-29-shot-d1cf773c.png
https://assets.example.com/pr-123/2026-08-29-shot-d1cf773c.png
```

Paste the URL anywhere, or add `--markdown` for an `![shot](…)` line.

## Why

A diff shows the code. A screenshot shows what the user gets. Put both in the
PR and review stops being guesswork.

Keys are content-hashed and dated, so nothing overwrites anything. Your bucket
ends up holding what your app looked like, release by release.

## Capture

```sh
cliche <url> <out.png> [options]
```

| Option | What it does |
| --- | --- |
| `--viewport <WxH>` | Viewport, default `1440x900` (`390x844` for mobile). |
| `--full-page` | Grow the viewport to the full page height. |
| `--wait-for <css>` | Hold the shot until a selector exists. SPAs render late. |
| `--scroll-to <css>` | Scroll a component into view before shooting. |
| `--settle <ms>` | Let fonts, images and animations finish. Default `1500`. |
| `--local-storage k=v` | Seed the target origin's localStorage (repeatable). |

`--local-storage` is how you shoot logged-in screens: seed the session token
and the page boots authenticated, no login form to script.

```sh
cliche http://localhost:3000/admin dashboard.png \
  --local-storage "myapp.session-token=$TOKEN" \
  --wait-for '[data-testid=dashboard]'
```

## Upload

```sh
cliche upload [--prefix pr-123] [--markdown] *.png
```

Every setting is read from a `CLICHE_`-prefixed variable and passed to
`Bun.S3Client` explicitly, so cliche never picks up `S3_*` or `AWS_*`
variables your shell carries for something else.

| Variable | Example |
| --- | --- |
| `CLICHE_BUCKET` | `assets-dev` |
| `CLICHE_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` (omit on AWS) |
| `CLICHE_ACCESS_KEY_ID` | your access key |
| `CLICHE_SECRET_ACCESS_KEY` | your secret key |
| `CLICHE_REGION` | `auto` (defaults to `us-east-1` on AWS) |
| `CLICHE_PUBLIC_URL` | `https://assets.example.com`, the bucket's public domain |

Objects are keyed `<prefix>/<yyyy-mm-dd>-<name>-<content-hash>.<ext>`. The
caption comes from the file name, so name files the way you want them read:
`mission-detail-after.png` becomes `![mission detail after](…)`.

> [!WARNING]
> Point cliche at a bucket you're happy to have public: PR descriptions live
> forever. Never capture real user data.

### R2 in one command

```sh
bunx @voila.dev/cliche setup [--bucket my-shots]
```

Through your existing `wrangler login`, this creates the bucket, enables its
public `r2.dev` URL and writes the `CLICHE_*` block to `.env`. Wrangler can't
mint API keys, so the command prints the dashboard link for the two you paste
back in. Any other S3-compatible service works with the same variables.

## MCP server

```sh
claude mcp add cliche -- bunx @voila.dev/cliche mcp
```

Two tools over stdio:

- **`screenshot`**: `url` (required), `out`, `viewport`, `full_page`,
  `wait_for`, `scroll_to`, `settle_ms`, `local_storage`, `upload`, `prefix`,
  `markdown`. Without `out` the shot lands in a temp file; with `upload: true`
  the result is the public URL.
- **`upload`**: `files` (required), `prefix`, `markdown`.

Or in a project's `.mcp.json`:

```json
{
  "mcpServers": {
    "cliche": { "command": "bunx", "args": ["@voila.dev/cliche", "mcp"] }
  }
}
```

## The album 📔

```sh
bunx @voila.dev/cliche album
```

Opens your bucket as a photo album: every cliché, grouped by month, with a
filter and a lightbox. A small Bun app that ships in the package; source in
`apps/album`.

<img src="https://raw.githubusercontent.com/voila-voila-dev/cliche/main/assets/album-preview.png" alt="album: real tries.care pages captured by cliche, grouped by month" width="100%">

Running on [tries.care](https://tries.care)'s screenshots bucket.

## Claude Code skill

```sh
bunx @voila.dev/cliche skill
```

Writes a PR-screenshots skill to `.claude/skills/pr-screenshots/SKILL.md`, so
Claude captures, uploads and embeds before/after shots whenever a PR touches
something visible. Also served at
[cliche.voila.dev/skill.md](https://cliche.voila.dev/skill.md).

## Programmatic API

```ts
import { capture, upload } from "@voila.dev/cliche";

await capture({
  url: "http://localhost:3000",
  out: "home.png",
  viewport: { width: 390, height: 844 },
  waitFor: "main",
});

const [shot] = await upload({ files: ["home.png"], prefix: "pr-7" });
console.log(shot.url);
```

## Platform notes

macOS uses the system WKWebView, nothing to install, and shots come out at the
display's scale factor. Linux and Windows drive an installed Chrome, Chromium,
Edge or Brave over the DevTools Protocol, which is why capture also works on
GitHub Actions runners.

`Bun.WebView` is marked experimental by Bun, and cliche tracks it as it
settles.

## License

MIT
