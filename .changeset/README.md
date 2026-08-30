# Changesets

Every change that should ship writes a changeset here: a small markdown file
saying which bump it deserves (patch, minor, major) and what to tell users.

```sh
bun run changeset            # describe your change, commit the file it writes
```

To release, consume the pending changesets and push:

```sh
GITHUB_TOKEN=$(gh auth token) bun run version-packages
git commit -am "Version packages"
git push
```

That bumps `package.json`, writes `CHANGELOG.md`, and deletes the changesets
it consumed. CI then publishes the new version to npm over OIDC, tags the
commit and creates the GitHub release from the changelog.

The token is only needed locally: the changelog links each entry to its
commit and author on GitHub.
