import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

/**
 * The component list is whatever the last documentation fetch produced, so a repository
 * added to repos.yml appears here without anyone editing this page.
 */
function ComponentCard({repo}) {
  const latest = repo.versions[0];
  return (
    <li>
      <Link className="componentCard" to={`${repo.route}/`}>
        <h3 className="componentCard__title">{repo.label}</h3>
        <p className="componentCard__description">{repo.description || `Documentation for ${repo.repo}.`}</p>
        <div className="componentCard__meta">
          <span className="componentCard__badge">{latest ? `Latest ${latest}` : repo.branch}</span>
          <span className="componentCard__badge">{repo.docCount} pages</span>
        </div>
      </Link>
    </li>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  const repos = siteConfig.customFields.repos ?? [];

  return (
    <Layout description={siteConfig.tagline}>
      <header className="hero hero--radar">
        <div className="container text--center">
          <img
            className="hero__logo"
            src={useBaseUrl('img/logo_large.png')}
            alt="RADAR-base"
          />
          <h1 className="hero__title">RADAR-base Documentation</h1>
          {/* This site is still being built out; say so where nobody can miss it. */}
          <p className="hero__status">
            <span className="alphaBadge alphaBadge--onDark">Alpha</span>
            <span className="hero__statusText">
              This documentation site is a work in progress — pages and components are still
              being added.
            </span>
          </p>
          <p className="hero__subtitle">
            Documentation for every RADAR-base component, published straight from the repository
            that owns it and versioned with its releases.
          </p>
          <Link className="button button--secondary button--lg" to="/platform/">
            Platform overview
          </Link>
        </div>
      </header>

      <main className="container margin-vert--xl">
        <h2>Components</h2>
        {repos.length === 0 ? (
          <p className="emptyState">
            No component documentation has been fetched yet. Run <code>npm run fetch-docs</code> to
            build it from the repositories listed in <code>repos.yml</code>.
          </p>
        ) : (
          <ul className="componentGrid">
            {repos.map((repo) => (
              <ComponentCard key={repo.id} repo={repo} />
            ))}
          </ul>
        )}

        <h2 className="margin-top--xl">Questions and common issues</h2>
        <p>
          The <Link to="/platform/faq">FAQ and common issues</Link> page collects the places where
          RADAR-base questions are answered — GitHub Discussions for the components that use them,
          and each component's issue tracker — along with the problems people hit most often while
          the platform is being set up.
        </p>

        <h2 className="margin-top--xl">Adding your repository</h2>
        <p>
          Add a <code>docs/</code> folder to your repository and list the repository in{' '}
          <code>repos.yml</code> on this site. Your documentation is picked up on the next build,
          and a new version is published every time you tag a release. To control page order,
          grouping and titles, add a{' '}
          <Link to="https://github.com/RADAR-base/radar-base-docs/blob/main/templates/radar-docs.yml">
            <code>docs/radar-docs.yml</code>
          </Link>{' '}
          manifest to your repository — it stays under your control, alongside your code.
        </p>
      </main>
    </Layout>
  );
}
