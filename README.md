# radar-base-docs

The documentation site for [RADAR-base](https://github.com/RADAR-base), published to
GitHub Pages at <https://radar-base.github.io/radar-base-docs/>.

Component documentation is **not written here**. Each component's pages live in that
component's own repository, next to the code they describe. This site fetches them at build
time, so:

- maintainers decide what their project's documentation contains, in their own repository,
  reviewed in their own pull requests;
- every tagged release gets its own published version of the documentation, and readers
  can switch between versions;
- the site rebuilds itself when a project releases, when its docs change, and nightly.

The exception is the material that does not belong to any one component — the platform
overview and FAQ, and the client and participant guides in `content/client` and
`content/participant`. Those pages are written and reviewed here. The guides were copied from
[radar-base.org/docs](https://radar-base.org/docs/) on 3 September 2026, and each one ends with
a line naming the page it came from, so a change made on either site can be carried to the
other.

## Adding a repository

**1. Put the documentation in your repository.** Create a `docs/` folder and write ordinary
markdown. Filenames become page URLs, and a page's title comes from its first `#` heading.
No Docusaurus-specific syntax or front matter is required — links to other pages, to files
elsewhere in your repository, and to images all keep working.

Your `README.md` is published too, as a page titled **Overview**. A repository that has no
`docs/` folder is still publishable: its README becomes its documentation, a single page,
and stays that way until there is more to say. Opt out with `readme: false` in the manifest
described in step 3.

**2. List the repository here.** Add an entry to [`repos.yml`](repos.yml):

```yaml
repos:
  - id: my-project              # URL-safe id, unique across the site
    label: My Project           # shown in the navigation
    repo: RADAR-base/my-project
    route: /my-project          # documentation is served from this path
    description: One line about what this project does.
```

Open a pull request. Once merged, your documentation is live.

**3. Optionally, take control of the details.** Add [`docs/radar-docs.yml`](templates/radar-docs.yml)
to your repository to set the page order, group pages into categories, choose the landing
page, exclude drafts, or publish your `README.md` as a page. That file lives in your
repository, so changing your documentation's structure never requires a change here.

**4. Optionally, publish immediately on release.** Copy
[`templates/notify-radar-docs.yml`](templates/notify-radar-docs.yml) into your repository's
`.github/workflows/`. Without it your documentation still appears — on the next nightly
build instead of within minutes.

## How versions work

For each repository, the site publishes:

- the documentation from every git tag matching `defaults.versions.pattern` in `repos.yml`
  (by default `v1.2.3`-style tags), newest `max` of them;
- the documentation from the default branch, labelled **Next**.

Readers land on the newest release. A tag from before the repository had a `docs/` folder
still publishes, from the README as it stood at that release, so the version picker does
not have holes in it.

If a project does not tag releases, set `versions: {mode: none}` on its entry and only the
branch documentation is published.

## Running the site locally

```bash
npm install
npm start          # fetches documentation, then serves the site with hot reload
```

Other useful commands:

```bash
npm run fetch-docs -- --repo radarpipeline   # fetch a single project
npm run fetch-docs -- --current-only         # skip release versions (much faster)
npm run fetch-docs -- --no-cache             # ignore cached release checkouts
npm run start:offline                        # serve what was last fetched, no network
npm run build                                # production build into build/
npm run clear                                # delete all fetched and generated output
```

Everything the fetch step writes is generated output and is not committed: `docs/`,
`.generated/`, `.cache/`, `*_versioned_docs/`, `*_versioned_sidebars/`, `*_versions.json`.

## What lives in this repository

| Path | Purpose |
| --- | --- |
| [`repos.yml`](repos.yml) | Which repositories are published, and where |
| [`content/platform/`](content/platform/) | Cross-component documentation, written here |
| [`content/client/`](content/client/) | Client documentation — the apps and devices a study runs on |
| [`content/participant/`](content/participant/) | Participant-facing guides |
| [`scripts/fetch-docs.mjs`](scripts/fetch-docs.mjs) | Fetches and normalises each project's docs |
| [`templates/`](templates/) | Files that project repositories copy into their own repo |
| [`overrides/`](overrides/) | Optional stand-in manifest for a project that has not adopted one |
| [`docusaurus.config.js`](docusaurus.config.js) | Site config; builds one docs section per project |

`docusaurus.config.js` derives the navigation, the version pickers and the home page from
whatever the fetch produced, so adding a project never means editing it.

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and deploys
it to GitHub Pages. Enable it once, under **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

To publish under a custom domain, set the `SITE_URL` and `SITE_BASE_URL` environment
variables for the build step (for example `SITE_URL=https://docs.radar-base.org` and
`SITE_BASE_URL=/`).

For a project's release to trigger a rebuild, create a token with
`Contents: read and write` on this repository and add it to the project's repository — or
to the RADAR-base organisation — as the secret `RADAR_DOCS_DISPATCH_TOKEN`.
