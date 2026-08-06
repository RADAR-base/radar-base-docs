# Overrides

A stand-in `radar-docs.yml` for a project that has not yet added one of its own.

`overrides/<repo-id>/radar-docs.yml` is read using exactly the same schema as
[`templates/radar-docs.yml`](../templates/radar-docs.yml), but it is merged **underneath**
the manifest in the project's own repository: any key the project defines wins.

This exists so a repository can be published on the documentation site straight away,
with a sensible page order, before its maintainers have adopted a manifest. It is a
bootstrap, not the intended end state — once a project ships `docs/radar-docs.yml`, delete
the corresponding override so that its documentation is described in exactly one place.
