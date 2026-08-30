# Changesets

Every change that should ship writes a changeset here: a small markdown file
saying which bump it deserves (patch, minor, major) and what to tell users.

```sh
bun run changeset            # describe your change, commit the file it writes
```

On `main`, CI turns the pending changesets into a "Version packages" pull
request: it bumps the version, writes `CHANGELOG.md` and deletes the
changesets it consumed. Merging that PR publishes to npm over OIDC, tags the
commit and creates the GitHub release from the changelog.
