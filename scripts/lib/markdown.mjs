import path from 'node:path';
import {dump as toYaml, load as parseYaml} from 'js-yaml';

/**
 * Source repositories write ordinary GitHub markdown: filenames with spaces and
 * ampersands, no front matter, links that point at files rather than URLs. These
 * helpers turn that into something Docusaurus can route, without asking maintainers
 * to learn Docusaurus conventions.
 */

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);

export function isMarkdown(relPath) {
  return MARKDOWN_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

function slugifySegment(segment) {
  return (
    segment
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|-+$/g, '')
      .toLowerCase() || 'untitled'
  );
}

/** `Guides/Radarpipeline & jupyter notebooks.md` -> `guides/radarpipeline-and-jupyter-notebooks.md` */
export function slugifyPath(relPath) {
  const segments = relPath.split('/').filter(Boolean);
  return segments
    .map((segment, index) => {
      const isLast = index === segments.length - 1;
      if (!isLast) return slugifySegment(segment);
      const extension = path.extname(segment);
      return slugifySegment(path.basename(segment, extension)) + extension.toLowerCase();
    })
    .join('/');
}

/** The Docusaurus document id for a published file: its path, minus the extension. */
export function docIdFor(slugPath) {
  return slugPath.replace(/\.mdx?$/i, '');
}

function splitFrontMatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!match) return {data: {}, body: content};
  let data = {};
  try {
    data = parseYaml(match[1]) ?? {};
  } catch {
    // Malformed front matter is left in the body rather than silently dropped.
    return {data: {}, body: content};
  }
  return {data, body: content.slice(match[0].length)};
}

function humanizeFilename(relPath) {
  const base = path.basename(relPath, path.extname(relPath));
  const spaced = base.replace(/[-_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Reads the leading `# Heading` to use as the page title, leaving it in the body.
 *
 * Docusaurus only renders the front-matter title as a heading when the body does not
 * already open with one, so this does not produce a duplicate — and keeping it means
 * a page's own table of contents, which links to `#that-heading`, still resolves.
 */
function leadingHeading(body) {
  const match = /^\s*#\s+(.+?)\s*$/m.exec(body);
  if (!match || body.slice(0, match.index).trim() !== '') return null;
  return match[1].trim();
}

/** Approximates GitHub's heading-to-anchor rule, enough to recognise self-links. */
function headingAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Rewrites markdown link and image targets.
 *
 * Link targets are resolved against the source file's real location in the repository,
 * which matters for pages published from outside the docs folder (a README, say): its
 * links are relative to the repository root, not to the docs folder.
 *
 * A target that lands on another published page becomes a relative link between the two
 * renamed files. Anything else — source code, a file the docs folder does not contain —
 * becomes a link to that file on GitHub at the revision being published, which is the
 * closest thing to what the author meant.
 *
 * @param {object} args
 * @param {string} args.sourceDir  Directory of this file relative to the repository root.
 * @param {Map<string, string>} args.slugMap  Docs-relative path -> slugified path.
 */
function rewriteLinks({body, slugPath, sourceDir, slugMap, blobBaseUrl, docsPathPrefix, titleAnchor}) {
  const slugFromDir = path.posix.dirname(slugPath);
  const docsPrefix = docsPathPrefix.replace(/\/+$/, '');

  const resolve = (target) => {
    // Docusaurus gives the page title no anchor id, so a README's own table of
    // contents linking back to its heading would dangle. Send it to the top instead.
    if (titleAnchor && target.toLowerCase() === `#${titleAnchor}`) return '#';

    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//') || target.startsWith('#')) {
      return null;
    }
    const suffix = (/[#?].*$/.exec(target) ?? [''])[0];
    const pathPart = target.slice(0, target.length - suffix.length);
    if (!pathPart) return null;

    let decoded;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      decoded = pathPart;
    }

    const fromRepoRoot = path.posix.normalize(path.posix.join(sourceDir, decoded));
    if (fromRepoRoot.startsWith('..')) return null;

    const inDocsFolder =
      docsPrefix === '' || docsPrefix === '.'
        ? fromRepoRoot
        : fromRepoRoot.startsWith(`${docsPrefix}/`)
          ? fromRepoRoot.slice(docsPrefix.length + 1)
          : null;

    const slugTarget = inDocsFolder === null ? undefined : slugMap.get(inDocsFolder);
    if (slugTarget) {
      const relative = path.posix.relative(slugFromDir, slugTarget);
      return (relative.startsWith('.') ? relative : `./${relative}`) + suffix;
    }

    return `${blobBaseUrl}/${fromRepoRoot.split('/').map(encodeURIComponent).join('/')}${suffix}`;
  };

  // Skip fenced code blocks so example markdown is not rewritten.
  const fences = [];
  const withoutFences = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (block) => {
    fences.push(block);
    return `\u0000FENCE${fences.length - 1}\u0000`;
  });

  // Link text may itself contain an image, which is how README badges are written:
  // [![build status](shields.io/...)](LICENSE). Without allowing for that, only the
  // inner image is seen and the outer link keeps pointing at a path that is not
  // published.
  const rewritten = withoutFences.replace(
    /(!?\[(?:[^[\]]|!\[[^\]]*\]\([^)]*\))*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g,
    (match, open, target, close) => {
      const next = resolve(target);
      return next === null ? match : `${open}${next}${close}`;
    },
  );

  return rewritten.replace(/\u0000FENCE(\d+)\u0000/g, (_, index) => fences[Number(index)]);
}

function serialize(frontMatter, body) {
  const serialized = toYaml(frontMatter, {lineWidth: -1, noRefs: true}).trimEnd();
  return `---\n${serialized}\n---\n\n${body.trimStart()}`;
}

/**
 * Produces the final file contents for one published markdown page: existing front
 * matter is preserved, anything missing is inferred.
 *
 * @param {object} args
 * @param {string} args.relPath    Path of the source file, relative to the docs folder.
 * @param {string} args.sourceDir  Directory of the source file, relative to the repo root.
 */
export function normalizeMarkdown({
  content,
  relPath,
  sourceDir,
  slugMap,
  blobBaseUrl,
  editUrl,
  docsPathPrefix,
  sidebarPosition,
  titleOverride,
}) {
  const {data, body} = splitFrontMatter(content);

  const heading = leadingHeading(body);
  const title = data.title ?? titleOverride ?? heading ?? humanizeFilename(relPath);

  const workingBody = rewriteLinks({
    body,
    slugPath: slugMap.get(relPath) ?? relPath,
    sourceDir,
    slugMap,
    blobBaseUrl,
    docsPathPrefix,
    titleAnchor: heading ? headingAnchor(heading) : null,
  });

  return serialize(
    {
      ...data,
      title,
      ...(data.sidebar_position === undefined && sidebarPosition !== undefined
        ? {sidebar_position: sidebarPosition}
        : {}),
      ...(editUrl && data.custom_edit_url === undefined ? {custom_edit_url: editUrl} : {}),
    },
    workingBody,
  );
}

/**
 * Adds a front-matter key to an already-normalised page, leaving an existing value of
 * that key alone. Used to mark a project's landing page, which can only be identified
 * once every page has been rendered.
 */
export function addFrontMatter(content, key, value) {
  const {data, body} = splitFrontMatter(content);
  if (data[key] !== undefined) return content;
  return serialize({...data, [key]: value}, body);
}
