---
"@voila.dev/cliche": minor
---

Read every upload setting from a `CLICHE_`-prefixed variable

`Bun.S3Client` picks up `S3_*` and `AWS_*` from the environment on its own,
so cliche could silently write to a bucket meant for something else. Settings
now come from `CLICHE_BUCKET`, `CLICHE_ENDPOINT`, `CLICHE_ACCESS_KEY_ID`,
`CLICHE_SECRET_ACCESS_KEY` and `CLICHE_REGION`, and are passed to the client
explicitly. `cliche setup` writes that block to `.env`.

**Breaking for early adopters**: rename your `S3_*` variables to `CLICHE_*`.
