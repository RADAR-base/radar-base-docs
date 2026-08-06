import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';

const run = promisify(execFile);

async function git(args, options = {}) {
  const {stdout} = await run('git', args, {maxBuffer: 64 * 1024 * 1024, ...options});
  return stdout;
}

/** Tag names on the remote, without dereferencing suffixes, newest-last order not guaranteed. */
export async function listRemoteTags(cloneUrl) {
  const stdout = await git(['ls-remote', '--tags', '--refs', cloneUrl]);
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1]?.replace('refs/tags/', ''))
    .filter(Boolean);
}

/** Compares `v1.10.0` above `v1.9.0`; falls back to string order for non-numeric tags. */
export function compareVersions(a, b) {
  const parse = (tag) => (tag.replace(/^v/, '').match(/\d+/g) ?? []).map(Number);
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

/**
 * Checks out `ref` of `cloneUrl` into `destination`, downloading only the paths in
 * `sparsePaths`. Uses a blobless, single-commit fetch: for these repositories that is
 * a few hundred kilobytes rather than the full history.
 */
export async function checkoutRef({cloneUrl, ref, destination, sparsePaths}) {
  fs.rmSync(destination, {recursive: true, force: true});
  fs.mkdirSync(destination, {recursive: true});

  await git(['init', '--quiet'], {cwd: destination});
  await git(['remote', 'add', 'origin', cloneUrl], {cwd: destination});
  await git(['config', 'core.sparseCheckout', 'true'], {cwd: destination});

  // Legacy (non-cone) sparse-checkout: supports globs and individual root files,
  // which cone mode does not.
  fs.mkdirSync(path.join(destination, '.git', 'info'), {recursive: true});
  fs.writeFileSync(
    path.join(destination, '.git', 'info', 'sparse-checkout'),
    `${sparsePaths.join('\n')}\n`,
  );

  await git(['fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', ref], {
    cwd: destination,
  });
  await git(['checkout', '--quiet', 'FETCH_HEAD'], {cwd: destination});

  const commit = (await git(['rev-parse', 'FETCH_HEAD'], {cwd: destination})).trim();
  return {commit};
}
