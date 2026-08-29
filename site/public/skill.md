---
name: pr-screenshots
description: Capture before/after screenshots of UI changes with @voila.dev/cliche and embed them in the pull request. Use whenever a PR touches something user-visible, right before opening or updating the PR. Also on request.
---

# PR screenshots

A PR that changes what users see should show it. Capture the changed screens
with `cliche`, upload them, and embed the markdown in the PR body.

## When (and when not)

- Any PR whose diff changes rendered UI: screens, components, layout, states,
  copy with visual impact. Skip for pure logic/backend/refactor PRs where
  pixels are provably identical.
- Capture **after** shots always. Add **before** shots (production or a
  deployed preview) only when the change modifies an existing screen —
  before/after is what makes redesigns reviewable.

## 1. Capture

Run the branch locally, then:

```sh
bunx @voila.dev/cliche http://localhost:3000/changed-screen \
  qa-screenshots/changed-screen-after.png \
  --wait-for '[data-testid=changed-screen]'
```

- `--local-storage <key>=<token>` seeds a session token for authenticated
  screens; `--scroll-to <css>` reaches below-the-fold components;
  `--viewport 390x844` for responsive changes (default is 1440x900).
- Use demo/seed data only — never real user data, the bucket is public.
- Name files as captions: `mission-detail-after.png` reads as
  "mission detail after".
- Keep it curated: at most ~8 images per PR, one per meaningfully distinct
  screen/state.

## 2. Upload

```sh
bunx @voila.dev/cliche upload --prefix pr-<number> --markdown qa-screenshots/*.png
```

Prints one `![caption](url)` line per file on stdout (without `--markdown`,
bare URLs). Bucket configuration
comes from the standard `S3_*` environment variables plus
`CLICHE_PUBLIC_URL` (see the package README).

## 3. Embed in the PR

Add a `## Screenshots` section to the PR body (`gh pr edit <n> --body ...`):

```markdown
## Screenshots

| Before | After |
| --- | --- |
| ![mission detail before](url) | ![mission detail after](url) |
```

After-only shots go as plain images with a one-line caption above each. When
updating after review changes: re-capture, re-upload (keys are
content-hashed, old links keep working), replace the section.
