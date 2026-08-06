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

import {GENERATED_FILE, SITE_DIR, loadRegistry} from './lib/config.mjs';
import {checkoutRef, compareVersions, listRemoteTags} from './lib/git.mjs';
import {addFrontMatter, docIdFor, isMarkdown, normalizeMarkdown, slugifyPath} from './lib/markdown.mjs';
import {buildSidebar} from './lib/sidebar.mjs';

const CACHE_DIR = path.join(SITE_DIR, '.cache');
const MANIFEST_CANDIDATES = ['radar-docs.yml', 'radar-docs.yaml', '.radar-docs.yml'];
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

function readManifest(checkoutDir, docsPath) {
  const candidates = [
    ...MANIFEST_CANDIDATES.map((name) => path.join(checkoutDir, docsPath, name)),
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
 * Renders one revision of one repository into `outputDir`, returning the sidebar and
 * the metadata the site needs. `ref` is a branch or tag; `blobRef` is what edit links
 * should point at.
 */
function renderDocs({checkoutDir, outputDir, repo, manifest, docsPath, ref, editable}) {
  const docsRoot = path.join(checkoutDir, docsPath);
  if (!fs.existsSync(docsRoot)) {
    throw new Error(`no "${docsPath}" folder at ${ref}`);
  }

  const excludes = (manifest.exclude ?? []).map(globToRegExp);
  const isExcluded = (relPath) =>
    MANIFEST_CANDIDATES.includes(path.posix.basename(relPath)) ||
    excludes.some((pattern) => pattern.test(relPath));

  const sources = walk(docsRoot)
    .filter((relPath) => !isExcluded(relPath))
    .filter((relPath) => isMarkdown(relPath) || ASSET_EXTENSIONS.has(path.extname(relPath).toLowerCase()))
    .sort();

  // Files outside the docs folder that the manifest asks to publish (typically README).
  const extras = (manifest.extraDocs ?? [])
    .map((entry) => {
      const source = path.join(checkoutDir, entry.source ?? '');
      if (!entry.source || !fs.existsSync(source)) {
        warn(`extraDocs: "${entry.source}" not found at ${ref}`);
        return null;
      }
      return {...entry, absolute: source, relPath: entry.target ?? path.posix.basename(entry.source)};
    })
    .filter(Boolean);

  const slugMap = new Map();
  for (const relPath of sources) slugMap.set(relPath, slugifyPath(relPath));
  for (const extra of extras) slugMap.set(extra.relPath, slugifyPath(extra.relPath));

  const blobBaseUrl = `${repo.htmlUrl}/blob/${ref}`;
  const editBaseUrl = editable ? `${repo.htmlUrl}/edit/${ref}` : null;

  const docs = [];
  fs.rmSync(outputDir, {recursive: true, force: true});
  fs.mkdirSync(outputDir, {recursive: true});

  const emit = ({relPath, absolute, sourceInRepo, titleOverride, position}) => {
    const slugPath = slugMap.get(relPath);
    const target = path.join(outputDir, slugPath);
    fs.mkdirSync(path.dirname(target), {recursive: true});

    if (!isMarkdown(relPath)) {
      fs.copyFileSync(absolute, target);
      return;
    }

    const encodedSource = sourceInRepo.split('/').map(encodeURIComponent).join('/');
    fs.writeFileSync(
      target,
      normalizeMarkdown({
        content: fs.readFileSync(absolute, 'utf8'),
        relPath,
        sourceDir: path.posix.dirname(sourceInRepo),
        slugMap,
        blobBaseUrl,
        editUrl: editBaseUrl ? `${editBaseUrl}/${encodedSource}` : `${blobBaseUrl}/${encodedSource}`,
        docsPathPrefix: docsPath,
        sidebarPosition: position,
        titleOverride,
      }),
    );
    docs.push({relPath, slugPath, docId: docIdFor(slugPath)});
  };

  for (const extra of extras) {
    emit({
      relPath: extra.relPath,
      absolute: extra.absolute,
      sourceInRepo: extra.source,
      titleOverride: extra.title,
      position: extra.position,
    });
  }
  for (const relPath of sources) {
    emit({
      relPath,
      absolute: path.join(docsRoot, relPath),
      sourceInRepo: `${docsPath}/${relPath}`,
    });
  }

  if (docs.length === 0) throw new Error(`no publishable markdown at ${ref}`);

  const {sidebar, missing} = buildSidebar({manifestSidebar: manifest.sidebar, docs});
  for (const entry of missing) warn(`sidebar entry "${entry}" does not match a published page at ${ref}`);

  // Give the project's landing page the instance root URL. Without an explicit
  // `homepage:` we prefer a conventionally-named entry point over the first page
  // alphabetically, which is rarely the one to open a project with.
  const preferredNames = ['index', 'introduction', 'intro', 'overview', 'readme', 'getting-started', 'home'];
  const homepageDoc =
    (manifest.homepage &&
      docs.find(
        (doc) =>
          [doc.relPath, doc.slugPath, doc.docId].includes(manifest.homepage) ||
          doc.slugPath === slugifyPath(manifest.homepage),
      )) ||
    (Array.isArray(manifest.sidebar) && typeof sidebar.docs[0] === 'string'
      ? docs.find((doc) => doc.docId === sidebar.docs[0])
      : null) ||
    preferredNames.reduce(
      (found, name) => found ?? docs.find((doc) => doc.docId.toLowerCase() === name),
      null,
    ) ||
    docs[0];

  if (homepageDoc) {
    const target = path.join(outputDir, homepageDoc.slugPath);
    fs.writeFileSync(target, addFrontMatter(fs.readFileSync(target, 'utf8'), 'slug', '/'));
  }

  return {sidebar, docCount: docs.length};
}

async function materializeRef({repo, ref, versionName, staging}) {
  const cacheKey = `${repo.id}/${ref.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const checkoutDir = path.join(CACHE_DIR, 'git', cacheKey);
  const marker = path.join(checkoutDir, '.radar-docs-fetched');
  const isTag = versionName !== null;

  // Tags are immutable, so a cached checkout of one is always current.
  if (!(isTag && !options.noCache && fs.existsSync(marker))) {
    await checkoutRef({
      cloneUrl: repo.cloneUrl,
      ref,
      destination: checkoutDir,
      sparsePaths: [
        `/${repo.docsPath}/`,
        ...MANIFEST_CANDIDATES.map((name) => `/${name}`),
        '/README.md',
        '/CHANGELOG.md',
        '/CONTRIBUTING.md',
      ],
    });
    fs.writeFileSync(marker, ref);
  }

  const {manifest} = readManifest(checkoutDir, repo.docsPath);
  const manifestWithFallback = {...readFallbackManifest(repo.id), ...manifest};
  const docsPath = manifestWithFallback.docsPath ?? repo.docsPath;
  const outputDir = path.join(staging, versionName === null ? 'current' : `version-${versionName}`);

  const rendered = renderDocs({
    checkoutDir,
    outputDir,
    repo,
    manifest: manifestWithFallback,
    docsPath,
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
