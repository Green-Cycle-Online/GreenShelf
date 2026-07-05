// Copies the live web app into www/ so Capacitor can bundle it into the iOS app.
// Whitelist only: node_modules, .git, ios/, and dev/planning files never get in.
// Run with: npm run build:www  (or npm run sync to also push into the iOS project)
import { cp, rm, mkdir, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'www')

// Explicit files the app shell needs. Everything the browser loads for index.html.
const FILES = [
  'index.html',
  'app.js',
  'native.js',
  'config.js',
  'styles.css',
  'landing.js',
  'landing-new.html',
  'privacy.html',
  'terms.html',
  '404.html',
  'manifest.json',
  'sw.js',
  'motion.js',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'og-image.png',
  'screenshot-mobile.png',
  'screenshot-desktop.png',
  'hitesh.jpeg',
  'anshul.jpeg',
]
// Whole folders copied as-is.
const DIRS = ['fonts', 'vendor']
// Any other loose image at the repo root (in case new listings/brand art appear).
const EXTRA_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'])

async function main() {
  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const copied = []
  const missing = []

  for (const f of FILES) {
    const src = join(ROOT, f)
    if (existsSync(src)) { await cp(src, join(OUT, f)); copied.push(f) }
    else missing.push(f)
  }
  for (const d of DIRS) {
    const src = join(ROOT, d)
    if (existsSync(src)) { await cp(src, join(OUT, d), { recursive: true }); copied.push(d + '/') }
    else missing.push(d + '/')
  }

  // Sweep root-level images not already listed, so nothing visual is left behind.
  const known = new Set([...FILES, ...DIRS])
  for (const name of await readdir(ROOT)) {
    if (known.has(name)) continue
    if (!EXTRA_EXT.has(extname(name).toLowerCase())) continue
    const src = join(ROOT, name)
    if ((await stat(src)).isFile()) { await cp(src, join(OUT, name)); copied.push(name) }
  }

  if (!existsSync(join(OUT, 'index.html'))) {
    console.error('FATAL: www/index.html missing, the app would be blank.')
    process.exit(1)
  }
  console.log('build:www copied ' + copied.length + ' items into www/')
  if (missing.length) console.log('note: not found (skipped): ' + missing.join(', '))
}

main().catch((e) => { console.error(e); process.exit(1) })
