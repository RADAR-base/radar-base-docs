// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const {themes} = require('prism-react-renderer');
const {guideSections, platformGuides} = require('./src/data/guides');

/**
 * One published component, as written to .generated/repos.json by scripts/fetch-docs.mjs.
 *
 * @typedef {object} PublishedRepo
 * @property {string} id            Docs plugin instance id, e.g. "radarpipeline".
 * @property {string} label         Display name, from the component's own manifest.
 * @property {string} description   One-line summary shown on the home page.
 * @property {string} route         URL prefix, e.g. "/pipeline".
 * @property {string} repo          "owner/name" on GitHub.
 * @property {string} htmlUrl       Repository URL.
 * @property {string} branch        Branch the "current" documentation tracks.
 * @property {string[]} versions    Published release versions, newest first.
 * @property {boolean} releasedIsDefault  Whether readers land on the newest release.
 * @property {string} currentLabel  Label for the docs built from `branch`.
 * @property {number} docCount      Number of pages in the current documentation.
 */

/**
 * Every component's documentation section is generated from the results of
 * `npm run fetch-docs`, which writes .generated/repos.json. Adding a component to the
 * site means adding it to repos.yml — never editing this file.
 *
 * @returns {PublishedRepo[]}
 */
function loadGeneratedRepos() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.generated', 'repos.json'), 'utf8');
    return JSON.parse(raw).repos ?? [];
  } catch {
    console.warn('[radar-docs] .generated/repos.json is missing — run `npm run fetch-docs` first.');
    return [];
  }
}

const repos = loadGeneratedRepos();

// Deployment target. Defaults to GitHub Pages for RADAR-base/radar-base-docs; set
// SITE_URL and SITE_BASE_URL to publish under a custom domain instead.
const url = process.env.SITE_URL ?? 'https://radar-base.github.io';
const baseUrl = process.env.SITE_BASE_URL ?? '/radar-base-docs/';

/** One docs plugin instance per component, each with its own versions. */
const docsPlugins = repos.map((repo) => [
  '@docusaurus/plugin-content-docs',
  {
    id: repo.id,
    path: `docs/${repo.id}`,
    routeBasePath: repo.route,
    sidebarPath: require.resolve(`./.generated/sidebars/${repo.id}.json`),
    // With released versions present, visitors land on the newest release and the
    // branch docs live under /next/.
    ...(repo.releasedIsDefault
      ? {
          lastVersion: repo.versions[0],
          versions: {current: {label: repo.currentLabel, path: 'next', banner: 'unreleased'}},
        }
      : {versions: {current: {label: repo.currentLabel, path: ''}}}),
  },
]);

/**
 * Documentation written in this repository that is not about one component: the client and
 * participant guides, copied from radar-base.org. Each is a docs section of its own so it
 * gets its own sidebar and route, the same as the platform section.
 */
const guidePlugins = [
  ['client', 'Client'],
  ['participant', 'Participant'],
].map(([id, name]) => [
  '@docusaurus/plugin-content-docs',
  {
    id,
    path: `content/${id}`,
    routeBasePath: `/${id}`,
    sidebarPath: require.resolve(`./sidebars${name}.js`),
    editUrl: 'https://github.com/RADAR-base/radar-base-docs/edit/main/',
  },
]);

const searchPlugin = (() => {
  try {
    require.resolve('@easyops-cn/docusaurus-search-local');
  } catch {
    return [];
  }
  return [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        docsDir: [
          'content/platform',
          'content/client',
          'content/participant',
          ...repos.map((repo) => `docs/${repo.id}`),
        ],
        docsRouteBasePath: [
          '/platform',
          '/client',
          '/participant',
          ...repos.map((repo) => repo.route),
        ],
      },
    ],
  ];
})();

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'RADAR-base Documentation',
  tagline: 'Documentation for the RADAR-base remote data collection platform',
  url,
  baseUrl,
  favicon: 'img/logo.png',
  organizationName: 'RADAR-base',
  projectName: 'radar-base-docs',
  // Every route becomes a directory with an index.html. Besides suiting GitHub Pages,
  // this keeps a docs version that contains a single page (a component whose docs are
  // just its README) from rendering as a bare .html file with no directory, which the
  // search indexer cannot write into.
  trailingSlash: true,

  // Aggregated documentation regularly links to files that live outside the site.
  onBrokenLinks: 'warn',

  markdown: {
    // Projects write their documentation for GitHub, not for MDX: bare `<img>` tags,
    // unescaped `<` and `{`, HTML blocks. Parsing `.md` as CommonMark accepts all of
    // that, while a project that genuinely wants JSX can still add an `.mdx` file.
    format: 'detect',
    hooks: {onBrokenMarkdownLinks: 'warn'},
  },

  // Makes the fetched component list available to React components such as the home page.
  customFields: {repos},

  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        // Platform-wide documentation, written and reviewed in this repository.
        docs: {
          path: 'content/platform',
          routeBasePath: '/platform',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/RADAR-base/radar-base-docs/edit/main/',
        },
        blog: false,
        theme: {customCss: require.resolve('./src/css/custom.css')},
      }),
    ],
  ],

  plugins: [...docsPlugins, ...guidePlugins, ...searchPlugin],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {respectPrefersColorScheme: true},
      navbar: {
        title: 'RADAR-base',
        logo: {alt: 'RADAR-base', src: 'img/logo.png'},
        items: [
          // The site is incomplete and published anyway; the badge says so on every page.
          {type: 'html', position: 'left', value: '<span class="alphaBadge">Alpha</span>'},
          {to: '/platform/', label: 'Platform', position: 'left'},
          {
            type: 'dropdown',
            label: 'Components',
            position: 'left',
            items: repos.map((repo) => ({to: `${repo.route}/`, label: repo.label})),
          },
          // The client and participant guides. See src/data/guides.js.
          ...guideSections.map((section) =>
            section.pages.length > 1
              ? {
                  type: 'dropdown',
                  label: section.navLabel,
                  position: 'left',
                  items: section.pages.map((page) => ({to: page.to, label: page.label})),
                }
              : {to: section.route, label: section.navLabel, position: 'left'},
          ),
          {to: '/platform/faq', label: 'FAQ', position: 'left'},
          // Shows the version picker for whichever component the reader is in.
          {type: 'custom-activeDocsVersionDropdown', position: 'right'},
          {href: 'https://github.com/RADAR-base', label: 'GitHub', position: 'right'},
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {label: 'Platform', to: '/platform/'},
              ...repos.map((repo) => ({label: repo.label, to: `${repo.route}/`})),
            ],
          },
          {
            title: 'Guides',
            items: [
              ...guideSections.flatMap((section) =>
                section.pages.map((page) => ({label: page.label, to: page.to})),
              ),
              ...platformGuides.map((page) => ({label: page.label, to: page.to})),
            ],
          },
          {
            title: 'Help',
            items: [
              {label: 'FAQ and common issues', to: '/platform/faq'},
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/orgs/RADAR-base/discussions',
              },
              {
                label: 'Open an issue',
                href: 'https://github.com/RADAR-base/radar-base-docs/issues',
              },
            ],
          },
          {
            title: 'Project',
            items: [
              {label: 'GitHub organisation', href: 'https://github.com/RADAR-base'},
              {label: 'RADAR-base website', href: 'https://radar-base.org'},
              {
                label: 'Add your repository',
                href: 'https://github.com/RADAR-base/radar-base-docs#adding-a-repository',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} RADAR-base. Built with Docusaurus.`,
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
        additionalLanguages: ['bash', 'python', 'yaml', 'json', 'java', 'kotlin', 'docker'],
      },
    }),
};

module.exports = config;
