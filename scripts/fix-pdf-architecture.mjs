// Vercel now defaults new Functions to arm64, but @sparticuz/chromium's
// npm package ships x64-only Chromium binaries (arm64 support requires a
// separate remote pack, see @sparticuz/chromium-min) — so the PDF function
// fails every invocation with "cannot execute binary file" (wrong ELF
// architecture) unless pinned back to x86_64.
//
// vercel.json's `functions.*.architecture` key is honored by `vercel build`
// but rejected by `vercel deploy`'s vercel.json schema validator ("should
// NOT have additional property `architecture`") — a gap in Vercel's own
// tooling as of this writing. Patching the already-built function config
// directly sidesteps that: `vercel build` still writes the effective
// (arm64) config, then this script overwrites just this one function's
// architecture before `vercel deploy --prebuilt` picks it up. See
// memory/decisions.md D14.
//
// Run after every `vercel build`, before `vercel deploy --prebuilt`:
//   vercel build --yes && node scripts/fix-pdf-architecture.mjs && vercel deploy --prebuilt --prod --yes

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const CONFIG_PATH = '.vercel/output/functions/api/invoices/[id]/pdf.func/.vc-config.json'

if (!existsSync(CONFIG_PATH)) {
  throw new Error(`${CONFIG_PATH} not found — run "vercel build" first`)
}

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
config.architecture = 'x86_64'
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
console.log(`Patched ${CONFIG_PATH} -> architecture: x86_64`)
