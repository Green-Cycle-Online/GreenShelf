// Generates the iOS app icon and splash from assets/logo.png using sharp.
// Apple requires an opaque icon (no alpha), so the leaf is flattened onto a
// solid brand-cream background. Run: node scripts/make-icons.cjs
const sharp = require('sharp')
const path = require('path')

const ROOT = path.dirname(__dirname)
// Original transparent leaf. sharp preserves the alpha channel on resize
// (sips flattens it to white, which is why we do not use assets/logo.png here).
const LOGO = path.join(ROOT, 'icon-512.png')
const ICON_SET = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const SPLASH_SET = path.join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset')

// The source leaf sits on an opaque white margin, so we build on white: the leaf
// blends seamlessly and we get a clean colored-logo-on-white icon (Apple-friendly,
// no transparency). Cream/dark would show a visible white square behind the leaf.
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

async function icon() {
  // 1024 icon: leaf at ~80% of the canvas, centred, full-bleed white, no alpha.
  const inner = 812
  const leaf = await sharp(LOGO).resize(inner, inner, { fit: 'contain', background: WHITE }).flatten({ background: WHITE }).toBuffer()
  const out = path.join(ICON_SET, 'AppIcon-512@2x.png')
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: WHITE } })
    .composite([{ input: leaf, gravity: 'centre' }])
    .removeAlpha()
    .png()
    .toFile(out)
  console.log('icon ->', out)
}

async function splash(file) {
  const size = 2732
  const inner = 760
  const leaf = await sharp(LOGO).resize(inner, inner, { fit: 'contain', background: WHITE }).flatten({ background: WHITE }).toBuffer()
  const out = path.join(SPLASH_SET, file)
  await sharp({ create: { width: size, height: size, channels: 3, background: WHITE } })
    .composite([{ input: leaf, gravity: 'centre' }])
    .png()
    .toFile(out)
  console.log('splash ->', out)
}

async function main() {
  await icon()
  // All three splash slots exist in the imageset; keep them consistent white.
  await splash('splash-2732x2732.png')
  await splash('splash-2732x2732-1.png')
  await splash('splash-2732x2732-2.png')
  console.log('done')
}
main().catch((e) => { console.error(e); process.exit(1) })
