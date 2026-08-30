# Changesets

Every change that should ship writes a changeset here: a small markdown file
saying which bump it deserves (patch, minor, major) and what to tell users.

```sh
bun run changeset          # describe your change
```

On `main`, CI turns pending changesets into a "Version Packages" pull
request. Merging that PR publishes to npm, tags the commit, and creates the
GitHub release with the changelog.
