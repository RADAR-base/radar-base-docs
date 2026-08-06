import fs from 'node:fs';
import path from 'node:path';
import {load as parseYaml} from 'js-yaml';

export const SITE_DIR = path.resolve(import.meta.dirname, '../..');

/** Where the fetch step leaves machine-readable results for docusaurus.config.js. */
export const GENERATED_FILE = path.join(SITE_DIR, '.generated', 'repos.json');

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }
  const merged = {...base};
  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

/**
 * Reads repos.yml and returns one fully-resolved entry per repository, with the
 * `defaults` block folded into each. Fields owned by the project's own repository
 * (labels, page order, ...) are not resolved here — they come from its manifest.
 */
export function loadRegistry(registryPath = path.join(SITE_DIR, 'repos.yml')) {
  const registry = parseYaml(fs.readFileSync(registryPath, 'utf8')) ?? {};
  const defaults = registry.defaults ?? {};
  const organization = registry.site?.organization ?? 'RADAR-base';

  const seen = new Set();
  const repos = (registry.repos ?? []).map((entry) => {
    const resolved = deepMerge(defaults, entry);

    for (const required of ['id', 'repo', 'route']) {
      if (!resolved[required]) {
        throw new Error(`repos.yml: entry ${JSON.stringify(entry)} is missing "${required}"`);
      }
    }
    if (!/^[a-z0-9-]+$/.test(resolved.id)) {
      throw new Error(`repos.yml: id "${resolved.id}" must be lowercase letters, digits and dashes`);
    }
    if (seen.has(resolved.id)) {
      throw new Error(`repos.yml: duplicate id "${resolved.id}"`);
    }
    seen.add(resolved.id);

    return {
      ...resolved,
      label: resolved.label ?? resolved.id,
      route: resolved.route.startsWith('/') ? resolved.route : `/${resolved.route}`,
      cloneUrl: `https://github.com/${resolved.repo}.git`,
      htmlUrl: `https://github.com/${resolved.repo}`,
      versions: {mode: 'none', ...(resolved.versions ?? {})},
    };
  });

  return {organization, repos};
}
