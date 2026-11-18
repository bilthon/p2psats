import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const DEFAULT_ORIGIN = 'https://p2psats.app'

export function siteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.VITE_SITE_URL?.trim() || DEFAULT_ORIGIN
  return raw.replace(/\/+$/, '')
}

/** Map prerendered HTML paths (flat `about.html` or nested `about/index.html`) to URL paths. */
export function htmlFilesToPaths(files: readonly string[]): string[] {
  const paths = files
    .filter((file) => file.endsWith('.html'))
    .map((file) => {
      const normalized = file.split(sep).join('/')
      if (normalized === 'index.html') return '/'
      if (normalized.endsWith('/index.html')) {
        return `/${normalized.slice(0, -'/index.html'.length)}`
      }
      return `/${normalized.slice(0, -'.html'.length)}`
    })
  return [...new Set(paths)].sort((a, b) => {
    if (a === '/') return -1
    if (b === '/') return 1
    return a.localeCompare(b)
  })
}

function walkHtml(dir: string, root: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'assets' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkHtml(full, root, out)
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(relative(root, full))
  }
}

export function collectPrerenderedPaths(outDir: string): string[] {
  const files: string[] = []
  walkHtml(outDir, outDir, files)
  return htmlFilesToPaths(files)
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function renderRobotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

export function renderSitemap(origin: string, paths: readonly string[]): string {
  const urls = paths
    .map((routePath) => {
      const loc = routePath === '/' ? `${origin}/` : `${origin}${routePath}`
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** Write robots.txt and sitemap.xml next to the prerendered pages. Returns the URL paths listed. */
export function writeSeoFiles(outDir: string): string[] {
  const paths = collectPrerenderedPaths(outDir)
  if (paths.length === 0) {
    throw new Error(`No prerendered HTML found in ${outDir}; refusing to write an empty sitemap.`)
  }
  const origin = siteOrigin()
  writeFileSync(join(outDir, 'robots.txt'), renderRobotsTxt(origin))
  writeFileSync(join(outDir, 'sitemap.xml'), renderSitemap(origin, paths))
  return paths
}
