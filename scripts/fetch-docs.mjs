#!/usr/bin/env node
/**
 * Collects documentation from every repository listed in repos.yml and lays it out
 * the way Docusaurus expects, including one published version per release tag.
 *
 * Nothing this script writes is committed: `docs/`, `*_versioned_docs/`,
 * `*_versioned_sidebars/`, `*_versions.json` and `.generated/` are all build output.
 *
 * Usage: node scripts/fetch-docs.mjs [--repo <id>] [--no-cache] [--current-only]
 */
import fs from 'node:fs';
import path from 'node:path';
import {load as parseYaml} from 'js-yaml';

import {GENERATED_FILE, SITE_DIR, loadRegistry, normalizeDocsPaths} from './lib/config.mjs';
import {checkoutRef, compareVersions, listRemoteTags} from './lib/git.mjs';
import {addFrontMatter, docIdFor, isMarkdown, normalizeMarkdown, slugifyPath} from './lib/markdown.mjs';
import {buildSidebar} from './lib/sidebar.mjs';

const CACHE_DIR = path.join(SITE_DIR, '.cache');
const MANIFEST_CANDIDATES = ['radar-docs.yml', 'radar-docs.yaml', '.radar-docs.yml'];
const README_CANDIDATES = ['README.md', 'README.MD', 'Readme.md', 'readme.md'];
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.json']);

const args = process.argv.slice(2);
const options = {
  only: args.includes('--repo') ? args[args.indexOf('--repo') + 1] : null,
  noCache: args.includes('--no-cache'),
  currentOnly: args.includes('--current-only'),
};

const log = (...parts) => console.log(...parts);
const warn = (...parts) => console.warn('  !', ...parts);
/** Supports the subset of glob syntax people actually put in an `exclude:` list. */
function globToRegExp(pattern) {
  const source = pattern.replaceAll(/\*\*\/?|\*|\?|[^*?]+/g, (token) => {
    if (token === '**' || token === '**/') return '(?:.*/)?';
    if (token === '*') return '[^/]*';
    if (token === '?') return '[^/]';
    return token.replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`);
  });
  return new RegExp(`^${source}$`);
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** Path of a docs-folder-relative file from the repository root. */
function repoPathFor(docsPath, relPath) {
  return docsPath === '.' ? relPath : `${docsPath}/${relPath}`;
}

/** Directory a docs folder's pages are published under, empty when it is the only one. */
function outputPrefixFor(docsPath, nested) {
  if (!nested) return '';
  return slugifyPath(docsPath === '.' ? 'root' : docsPath);
}

/**
 * Assigns each file its place in the published output, dropping anything whose target is
 * already taken — two source files that slugify to the same name, most often.
 *
 * @returns {{publishable: object[], slugMap: Map<string, string>}} repo path -> published path.
 */
function resolveTargets(entries, ref) {
  const slugMap = new Map();
  const claimedBy = new Map();
  const publishable = entries.filter((entry) => {
    const owner = claimedBy.get(entry.slugPath);
    if (owner !== undefined) {
      warn(`${entry.repoPath} would overwrite ${owner} at ${ref} — skipped`);
      return false;
    }
    claimedBy.set(entry.slugPath, entry.repoPath);
    slugMap.set(entry.repoPath, entry.slugPath);
    return true;
  });
  return {publishable, slugMap};
}

function readManifest(checkoutDir, docsPaths) {
  const candidates = [
    ...docsPaths.flatMap((docsPath) =>
      MANIFEST_CANDIDATES.map((name) => path.join(checkoutDir, docsPath, name)),
    ),
    ...MANIFEST_CANDIDATES.map((name) => path.join(checkoutDir, name)),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return {manifest: parseYaml(fs.readFileSync(candidate, 'utf8')) ?? {}, manifestPath: candidate};
    } catch (error) {
      warn(`ignoring unreadable manifest ${path.relative(checkoutDir, candidate)}: ${error.message}`);
    }
  }
  return {manifest: {}, manifestPath: null};
}

/**
 * A manifest kept in this repository under `overrides/<id>/radar-docs.yml`, used only
 * for keys the project itself has not defined. It exists so a project can be added to
 * the site before its maintainers have adopted a manifest of their own; once they ship
 * one, their file takes precedence key by key and the override can be deleted.
 */
function readFallbackManifest(repoId) {
  for (const name of MANIFEST_CANDIDATES) {
    const candidate = path.join(SITE_DIR, 'overrides', repoId, name);
    if (!fs.existsSync(candidate)) continue;
    try {
      return parseYaml(fs.readFileSync(candidate, 'utf8')) ?? {};
    } catch (error) {
      warn(`ignoring unreadable override overrides/${repoId}/${name}: ${error.message}`);
    }
  }
  return {};
}

/**
 * Works out whether to publish the repository's README as a page, and under what name.
 *
 * Off when the manifest says `readme: false`, or when the manifest already publishes
 * the same file through `extraDocs`. The target name gives way to the docs folder: a
 * repository that already has its own `overview.md` keeps it.
 */
function resolveReadme({checkoutDir, manifest, repo, extras, sources}) {
  const setting = manifest.readme ?? repo.includeReadme ?? true;
  if (setting === false) return null;

  const candidates = typeof setting === 'string' ? [setting] : README_CANDIDATES;
  const source = candidates.find((name) => fs.existsSync(path.join(checkoutDir, name)));
  if (!source) {
    if (typeof setting === 'string') warn(`readme: "${setting}" not found`);
    return null;
  }

  // Already published deliberately, with the maintainer's own title and placement.
  if (extras.some((extra) => extra.repoPath === source)) return null;

  const taken = new Set([...sources, ...extras].map((entry) => entry.slugPath));
  const target = ['overview.md', 'readme.md', 'project-readme.md'].find((name) => !taken.has(name));
  if (!target) return null;

  return {
    repoPath: source,
    absolute: path.join(checkoutDir, source),
    relPath: target,
    slugPath: slugifyPath(target),
    title: 'Overview',
  };
}

/**
 * Chooses the page served at the project's root URL: the manifest's `homepage:`, else
 * the first page of a manifest-defined sidebar, else a conventionally-named entry
 * point, else whatever comes first — which is rarely the page to open a project with.
 */
function pickHomepage({manifest, sidebar, docs}) {
  if (manifest.homepage) {
    const named = docs.find(
      (doc) =>
        [doc.relPath, doc.repoPath, doc.slugPath, doc.docId].includes(manifest.homepage) ||
        doc.slugPath === slugifyPath(manifest.homepage),
    );
    if (named) return named;
  }

  if (Array.isArray(manifest.sidebar) && typeof sidebar.docs[0] === 'string') {
    const first = docs.find((doc) => doc.docId === sidebar.docs[0]);
    if (first) return first;
  }

  const preferred = ['index', 'introduction', 'intro', 'overview', 'readme', 'getting-started', 'home'];
  for (const name of preferred) {
    const match = docs.find((doc) => doc.docId.toLowerCase() === name);
    if (match) return match;
  }

  return docs[0];
}

/**
 * Renders one revision of one repository into `outputDir`, returning the sidebar and
 * the metadata the site needs. `ref` is a branch or tag; `blobRef` is what edit links
 * should point at.
 */
function renderDocs({checkoutDir, outputDir, repo, manifest, docsPaths, ref, editable}) {
  const present = docsPaths.filter((docsPath) => fs.existsSync(path.join(checkoutDir, docsPath)));
  for (const absent of docsPaths.filter((docsPath) => !present.includes(docsPath))) {
    warn(`no "${absent}" folder at ${ref}`);
  }

  const excludes = (manifest.exclude ?? []).map(globToRegExp);
  // Exclude patterns are matched against the path within a docs folder, which is how a
  // project with one folder writes them, and against the path from the repository root,
  // which is the only way to name one of several folders.
  const isExcluded = (relPath, repoPath) =>
    MANIFEST_CANDIDATES.includes(path.posix.basename(relPath)) ||
    excludes.some((pattern) => pattern.test(relPath) || pattern.test(repoPath));

  // Several docs folders are published side by side, each under a directory named after
  // it, so that files sharing a name across folders do not collide. A single folder is
  // published flat at the docs root, which is where its pages have always lived.
  const nested = docsPaths.length > 1;

  const sources = present.flatMap((docsPath) => {
    const prefix = outputPrefixFor(docsPath, nested);
    return walk(path.join(checkoutDir, docsPath))
      .sort()
      .map((relPath) => ({
        relPath,
        repoPath: repoPathFor(docsPath, relPath),
        absolute: path.join(checkoutDir, docsPath, relPath),
        slugPath: path.posix.join(prefix, slugifyPath(relPath)),
      }))
      .filter((entry) => !isExcluded(entry.relPath, entry.repoPath))
      .filter(
        (entry) =>
          isMarkdown(entry.relPath) ||
          ASSET_EXTENSIONS.has(path.extname(entry.relPath).toLowerCase()),
      );
  });

  // Files outside the docs folders that the manifest asks to publish. These name their
  // own target, so they are published at the docs root even when the folders are nested.
  const extras = (manifest.extraDocs ?? [])
    .map((entry) => {
      const source = path.join(checkoutDir, entry.source ?? '');
      if (!entry.source || !fs.existsSync(source)) {
        warn(`extraDocs: "${entry.source}" not found at ${ref}`);
        return null;
      }
      const relPath = entry.target ?? path.posix.basename(entry.source);
      return {...entry, repoPath: entry.source, absolute: source, relPath, slugPath: slugifyPath(relPath)};
    })
    .filter(Boolean);

  // The README is a project's front page on GitHub, and is very often the only
  // documentation a repository has, so it is published unless asked not to. A
  // repository with no docs folder is therefore still publishable.
  const readme = resolveReadme({checkoutDir, manifest, repo, extras, sources});
  if (readme) extras.unshift(readme);

  if (present.length === 0 && !readme) {
    const folders = docsPaths.map((docsPath) => `"${docsPath}"`).join(', ');
    throw new Error(`no ${folders} folder and no README at ${ref}`);
  }

  // `slugMap` is keyed by path from the repository root, so a link can be followed from
  // any page to any other regardless of which folder either was published from.
  const {publishable, slugMap} = resolveTargets([...extras, ...sources], ref);

  const blobBaseUrl = `${repo.htmlUrl}/blob/${ref}`;
  const editBaseUrl = editable ? `${repo.htmlUrl}/edit/${ref}` : null;

  const docs = [];
  fs.rmSync(outputDir, {recursive: true, force: true});
  fs.mkdirSync(outputDir, {recursive: true});

  for (const entry of publishable) {
    const {relPath, repoPath, slugPath, absolute} = entry;
    const target = path.join(outputDir, slugPath);
    fs.mkdirSync(path.dirname(target), {recursive: true});

    if (!isMarkdown(relPath)) {
      fs.copyFileSync(absolute, target);
      continue;
    }

    const encodedSource = repoPath.split('/').map(encodeURIComponent).join('/');
    fs.writeFileSync(
      target,
      normalizeMarkdown({
        content: fs.readFileSync(absolute, 'utf8'),
        relPath,
        slugPath,
        sourceDir: path.posix.dirname(repoPath),
        slugMap,
        blobBaseUrl,
        editUrl: editBaseUrl ? `${editBaseUrl}/${encodedSource}` : `${blobBaseUrl}/${encodedSource}`,
        sidebarPosition: entry.position,
        titleOverride: entry.title,
      }),
    );
    docs.push({relPath, repoPath, slugPath, docId: docIdFor(slugPath)});
  }

  if (docs.length === 0) throw new Error(`no publishable markdown at ${ref}`);

  const {sidebar, missing} = buildSidebar({
    manifestSidebar: manifest.sidebar,
    docs,
    pinned: readme ? [docIdFor(readme.slugPath)] : [],
  });
  // A ref with no docs folder publishes only the README, so every sidebar entry is
  // trivially missing; warning about each one would bury anything worth reading.
  if (present.length > 0) {
    for (const entry of missing) {
      warn(`sidebar entry "${entry}" does not match a published page at ${ref}`);
    }
  } else if (missing.length > 0) {
    warn(`${ref} has no docs folder — published its README only`);
  }

  const homepageDoc = pickHomepage({manifest, sidebar, docs});
  if (homepageDoc) {
    const target = path.join(outputDir, homepageDoc.slugPath);
    fs.writeFileSync(target, addFrontMatter(fs.readFileSync(target, 'utf8'), 'slug', '/'));
  }

  return {sidebar, docCount: docs.length};
}

/** The paths a checkout of `docsPaths` needs to download. */
function sparsePathsFor(docsPaths) {
  return [
    ...docsPaths.map((docsPath) => (docsPath === '.' ? '/*' : `/${docsPath}/`)),
    ...MANIFEST_CANDIDATES.map((name) => `/${name}`),
    ...README_CANDIDATES.map((name) => `/${name}`),
    '/CHANGELOG.md',
    '/CONTRIBUTING.md',
  ];
}

async function materializeRef({repo, ref, versionName, staging}) {
  const cacheKey = `${repo.id}/${ref.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const checkoutDir = path.join(CACHE_DIR, 'git', cacheKey);
  const marker = path.join(checkoutDir, '.radar-docs-fetched');
  const isTag = versionName !== null;

  const fetchPaths = async (docsPaths) => {
    const sparsePaths = sparsePathsFor(docsPaths);
    await checkoutRef({cloneUrl: repo.cloneUrl, ref, destination: checkoutDir, sparsePaths});
    fs.writeFileSync(marker, `${ref}\n${sparsePaths.join('\n')}\n`);
  };

  // A tag is immutable, so a cached checkout of one is current — but only for the paths
  // it was told to download. When repos.yml or a manifest names a different `docsPath`,
  // the cached checkout is missing the new folders and has to be fetched again. A
  // checkout of more paths than are needed still counts: a manifest asking for folders
  // of its own leaves a wider checkout behind, which the next run can reuse.
  const cachedFor = (docsPaths) => {
    if (!fs.existsSync(marker)) return false;
    const [cachedRef, ...cachedPaths] = fs.readFileSync(marker, 'utf8').trim().split('\n');
    return cachedRef === ref && sparsePathsFor(docsPaths).every((p) => cachedPaths.includes(p));
  };

  if (!(isTag && !options.noCache && cachedFor(repo.docsPaths))) await fetchPaths(repo.docsPaths);

  const {manifest} = readManifest(checkoutDir, repo.docsPaths);
  const manifestWithFallback = {...readFallbackManifest(repo.id), ...manifest};
  const docsPaths =
    manifestWithFallback.docsPath === undefined
      ? repo.docsPaths
      : normalizeDocsPaths(manifestWithFallback.docsPath, `${repo.id} manifest`);

  // A project's own manifest may name folders repos.yml did not, which the sparse
  // checkout above therefore left out; fetch again, for those as well.
  const unfetched = docsPaths.filter(
    (docsPath) => !repo.docsPaths.includes(docsPath) && !fs.existsSync(path.join(checkoutDir, docsPath)),
  );
  if (unfetched.length > 0) await fetchPaths([...new Set([...repo.docsPaths, ...docsPaths])]);

  const outputDir = path.join(staging, versionName === null ? 'current' : `version-${versionName}`);

  const rendered = renderDocs({
    checkoutDir,
    outputDir,
    repo,
    manifest: manifestWithFallback,
    docsPaths,
    ref,
    editable: !isTag,
  });

  return {...rendered, manifest: manifestWithFallback};
}

async function processRepo(repo) {
  log(`\n${repo.label}  (${repo.repo})`);
  const staging = path.join(CACHE_DIR, 'staging', repo.id);
  fs.rmSync(staging, {recursive: true, force: true});
  fs.mkdirSync(staging, {recursive: true});

  let versions = [];
  if (repo.versions.mode === 'tags' && !options.currentOnly) {
    const pattern = new RegExp(repo.versions.pattern ?? '^v?\\d+\\.\\d+\\.\\d+$');
    versions = (await listRemoteTags(repo.cloneUrl))
      .filter((tag) => pattern.test(tag))
      .sort((a, b) => compareVersions(b, a))
      .slice(0, repo.versions.max ?? 4);
  }

  const current = await materializeRef({repo, ref: repo.branch, versionName: null, staging});
  log(`  ${repo.branch}: ${current.docCount} pages`);

  const built = [];
  for (const tag of versions) {
    try {
      const result = await materializeRef({repo, ref: tag, versionName: tag, staging});
      built.push({name: tag, ...result});
      log(`  ${tag}: ${result.docCount} pages`);
    } catch (error) {
      warn(`skipping version ${tag}: ${error.message}`);
    }
  }

  // Only now that every ref rendered do we replace the previous output.
  const docsDir = path.join(SITE_DIR, 'docs', repo.id);
  const versionedDocsDir = path.join(SITE_DIR, `${repo.id}_versioned_docs`);
  const versionedSidebarsDir = path.join(SITE_DIR, `${repo.id}_versioned_sidebars`);
  const generatedSidebarsDir = path.join(SITE_DIR, '.generated', 'sidebars');

  for (const dir of [docsDir, versionedDocsDir, versionedSidebarsDir]) {
    fs.rmSync(dir, {recursive: true, force: true});
  }
  fs.mkdirSync(path.dirname(docsDir), {recursive: true});
  fs.mkdirSync(generatedSidebarsDir, {recursive: true});
  fs.renameSync(path.join(staging, 'current'), docsDir);
  fs.writeFileSync(
    path.join(generatedSidebarsDir, `${repo.id}.json`),
    JSON.stringify(current.sidebar, null, 2),
  );

  if (built.length > 0) {
    fs.mkdirSync(versionedDocsDir, {recursive: true});
    fs.mkdirSync(versionedSidebarsDir, {recursive: true});
    for (const version of built) {
      fs.renameSync(
        path.join(staging, `version-${version.name}`),
        path.join(versionedDocsDir, `version-${version.name}`),
      );
      fs.writeFileSync(
        path.join(versionedSidebarsDir, `version-${version.name}-sidebars.json`),
        JSON.stringify(version.sidebar, null, 2),
      );
    }
  }

  fs.writeFileSync(
    path.join(SITE_DIR, `${repo.id}_versions.json`),
    JSON.stringify(built.map((version) => version.name), null, 2),
  );
  fs.rmSync(staging, {recursive: true, force: true});

  return {
    id: repo.id,
    // The project's own manifest wins over the central registry for anything
    // describing the project itself.
    label: current.manifest.label ?? repo.label,
    description: current.manifest.description ?? repo.description ?? '',
    route: repo.route,
    repo: repo.repo,
    htmlUrl: repo.htmlUrl,
    branch: repo.branch,
    versions: built.map((version) => version.name),
    releasedIsDefault: Boolean(repo.versions.releasedIsDefault) && built.length > 0,
    currentLabel: repo.versions.currentLabel ?? 'Next',
    docCount: current.docCount,
  };
}

async function main() {
  const {organization, repos} = loadRegistry();
  const selected = options.only ? repos.filter((repo) => repo.id === options.only) : repos;

  if (selected.length === 0) {
    throw new Error(options.only ? `no repo with id "${options.only}" in repos.yml` : 'repos.yml lists no repositories');
  }

  log(`Fetching documentation for ${selected.length} repositor${selected.length === 1 ? 'y' : 'ies'}`);

  const results = [];
  const failures = [];
  for (const repo of selected) {
    try {
      results.push(await processRepo(repo));
    } catch (error) {
      failures.push({repo: repo.id, message: error.message});
      warn(`${repo.id} failed: ${error.message}`);
    }
  }

  // Repos that failed this run keep whatever they published last time.
  const previous = fs.existsSync(GENERATED_FILE)
    ? JSON.parse(fs.readFileSync(GENERATED_FILE, 'utf8')).repos ?? []
    : [];
  const merged = [...results];
  for (const repo of previous) {
    const stillListed = repos.some((entry) => entry.id === repo.id);
    const alreadyBuilt = merged.some((entry) => entry.id === repo.id);
    const outputExists = fs.existsSync(path.join(SITE_DIR, 'docs', repo.id));
    if (stillListed && !alreadyBuilt && outputExists) merged.push(repo);
  }
  merged.sort((a, b) => a.label.localeCompare(b.label));

  fs.mkdirSync(path.dirname(GENERATED_FILE), {recursive: true});
  fs.writeFileSync(
    GENERATED_FILE,
    JSON.stringify({organization, generatedAt: new Date().toISOString(), repos: merged}, null, 2),
  );

  log(`\nPublished ${merged.length} project(s): ${merged.map((repo) => repo.id).join(', ') || 'none'}`);

  if (failures.length > 0 && process.env.CI) {
    throw new Error(`${failures.length} repository fetch(es) failed`);
  }
  if (merged.length === 0) {
    throw new Error('no documentation could be fetched');
  }
}

main().catch((error) => {
  console.error(`\nfetch-docs failed: ${error.message}`);
  process.exit(1);
});
