// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const {themes} = require('prism-react-renderer');

/**
 * One published project, as written to .generated/repos.json by scripts/fetch-docs.mjs.
 *
 * @typedef {object} PublishedRepo
 * @property {string} id            Docs plugin instance id, e.g. "radarpipeline".
 * @property {string} label         Display name, from the project's own manifest.
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
 * Every project's documentation section is generated from the results of
 * `npm run fetch-docs`, which writes .generated/repos.json. Adding a project to the
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

/** One docs plugin instance per project, each with its own versions. */
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
        docsDir: ['content/platform', ...repos.map((repo) => `docs/${repo.id}`)],
        docsRouteBasePath: ['/platform', ...repos.map((repo) => repo.route)],
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
  favicon: 'img/favicon.svg',
  organizationName: 'RADAR-base',
  projectName: 'radar-base-docs',
  trailingSlash: false,

  // Aggregated documentation regularly links to files that live outside the site.
  onBrokenLinks: 'warn',

  markdown: {
    // Projects write their documentation for GitHub, not for MDX: bare `<img>` tags,
    // unescaped `<` and `{`, HTML blocks. Parsing `.md` as CommonMark accepts all of
    // that, while a project that genuinely wants JSX can still add an `.mdx` file.
    format: 'detect',
    hooks: {onBrokenMarkdownLinks: 'warn'},
  },

  // Makes the fetched project list available to React components such as the home page.
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

  plugins: [...docsPlugins, ...searchPlugin],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {respectPrefersColorScheme: true},
      navbar: {
        title: 'RADAR-base',
        logo: {alt: 'RADAR-base', src: 'img/logo.svg'},
        items: [
          {to: '/platform/', label: 'Platform', position: 'left'},
          {
            type: 'dropdown',
            label: 'Projects',
            position: 'left',
            items: repos.map((repo) => ({to: `${repo.route}/`, label: repo.label})),
          },
          // Shows the version picker for whichever project the reader is in.
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
