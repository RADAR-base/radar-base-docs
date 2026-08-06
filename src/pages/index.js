import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

/**
 * The project list is whatever the last documentation fetch produced, so a repository
 * added to repos.yml appears here without anyone editing this page.
 */
function ProjectCard({repo}) {
  const latest = repo.versions[0];
  return (
    <li>
      <Link className="projectCard" to={`${repo.route}/`}>
        <h3 className="projectCard__title">{repo.label}</h3>
        <p className="projectCard__description">{repo.description || `Documentation for ${repo.repo}.`}</p>
        <div className="projectCard__meta">
          <span className="projectCard__badge">{latest ? `Latest ${latest}` : repo.branch}</span>
          <span className="projectCard__badge">{repo.docCount} pages</span>
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
          <h1 className="hero__title">RADAR-base Documentation</h1>
          <p className="hero__subtitle">
            Documentation for every RADAR-base project, published straight from the repository
            that owns it and versioned with its releases.
          </p>
          <Link className="button button--secondary button--lg" to="/platform/">
            Platform overview
          </Link>
        </div>
      </header>

      <main className="container margin-vert--xl">
        <h2>Projects</h2>
        {repos.length === 0 ? (
          <p className="emptyState">
            No project documentation has been fetched yet. Run <code>npm run fetch-docs</code> to
            build it from the repositories listed in <code>repos.yml</code>.
          </p>
        ) : (
          <ul className="projectGrid">
            {repos.map((repo) => (
              <ProjectCard key={repo.id} repo={repo} />
            ))}
          </ul>
        )}

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
