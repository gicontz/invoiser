# Engineering — Invoiser

Project-specific engineering patterns, gotchas, and best practices for this codebase.

---

## Print & PDF Generation

### One template, three consumers: preview, print, PDF

`src/designs/index.js#renderInvoiceHtml` builds one full HTML document string (fonts + CSS + body) from `src/designs/templates.js`. That single string is:
1. Set as an `<iframe>`'s `srcdoc` for the on-screen preview and native Print (`iframe.contentWindow.print()`)
2. Captured element-by-element via `html2canvas` for PDF/email export (`src/utils/pdf.js`)

**How to apply:** any change to the invoice's look or content goes through `templates.js`/`themes.css`/`document.css` — never patch the preview, print, or PDF output separately, they're the same source.

### `aspect-ratio` forces a short page to still fill a full A4 page

```css
.doc-page {
  aspect-ratio: 210 / 297;   /* A4's own ratio */
  display: flex;
  flex-direction: column;
}
.doc-footer {
  margin-top: auto;          /* pins to the bottom of the column */
}
```

A short invoice (few line items) was only as tall as its content, leaving a large dead-white gap below it when printed/exported. `aspect-ratio` on a block whose height is otherwise `auto` gives it a *preferred* height computed from its width — but doesn't clip content that's genuinely taller (many items, a long second page), which just grows past it. Combined with `display:flex; flex-direction:column` on the page and `margin-top:auto` on the last child, a footer (bank + signature) anchors to the true bottom instead of sitting right under the totals with empty space beneath.

**How to apply:** any "make this box always look like a full page even with little content" need — reach for `aspect-ratio` + flex `auto`-margin before reaching for a hardcoded min-height in px.

### `break-before: page` is invisible on screen — a real page break needs real visual separation

`break-before: page` (and its `page-break-before: always` fallback) only takes visual effect once the browser is actually paginating (print preview, print-to-PDF). In a normal scrolling on-screen view, it does nothing — a dashed divider line *within one shared container* still reads as "one continuous card," not two separate pages.

**Fix that actually reads as separate pages on screen:** give each logical page (`.doc-page`) its own card styling (background/shadow/radius) instead of one shared container styling the whole stack, and lay them out with a real visual `gap` between them (`.preview-sheet { display:flex; flex-direction:column; gap:28px }`). Then `break-before:page` handles the *print* pagination, and the gap + separate cards handle the *on-screen* page-boundary cue — two different mechanisms for two different rendering contexts, both needed.

### Scaling a captured canvas into a PDF page without cropping

```js
const canvasRatio = canvas.width / canvas.height
const availableRatio = availableWidth / availableHeight
let renderWidth, renderHeight
if (canvasRatio > availableRatio) {
  renderWidth = availableWidth
  renderHeight = availableWidth / canvasRatio
} else {
  renderHeight = availableHeight
  renderWidth = availableHeight * canvasRatio
}
// center renderWidth × renderHeight within the page
```

This is a standard "contain" fit (like CSS `object-fit: contain`), computed by hand because `jsPDF.addImage` doesn't do aspect-ratio-aware fitting itself. Guarantees the whole captured page is visible on the PDF page, never cropped, using the maximum space either dimension allows.

**How to apply:** any time a variable-size raster (screenshot, canvas, uploaded image) needs to be placed into a fixed-size page/frame without distortion or cropping.

### Vite bundle: dynamic `import()` for on-demand-only libraries

```js
// pdf.js
const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
  import('jspdf'),
  import('html2canvas'),
])
```

Static top-level `import jsPDF from 'jspdf'` pulled both libraries (plus their own dependency, DOMPurify) into the *main* bundle, even though most page loads never touch PDF export — main chunk grew from ~200KB to bundling everything eagerly, re-triggering Vite's "chunk larger than 500KB" warning. Dynamic `import()` inside the function that actually needs them keeps them in their own lazily-fetched chunks.

**How to apply:** any heavy library used only behind a specific user action (export, print, a rarely-opened modal) — dynamic `import()`, not a static top-level import.

---

## Dates

### Parsing `YYYY-MM-DD` strings: avoid the UTC-parse/local-format shift

```js
// Risky — new Date('2026-09-20') parses as UTC midnight; formatting it in a
// timezone behind UTC can display Sept 19, not Sept 20.
new Date(iso)

// Safe — appending T00:00:00 (no "Z") forces local-midnight parsing.
new Date(`${iso}T00:00:00`)

// Also safe, and used for both formatting (templates.js#formatDate) and
// day-count math (App.jsx#daysBetween) in this codebase: parse the parts
// directly, no Date object at all.
const [year, month, day] = iso.split('-').map(Number)
```

`<input type="date">` values are plain `YYYY-MM-DD` strings with no time/timezone component. `new Date(iso)` parses them as UTC midnight; formatting or diffing that Date object in any timezone behind UTC can silently shift by a day.

**How to apply:** any time a `YYYY-MM-DD` string from a date input is parsed, formatted, or diffed — never pass it bare to `new Date()`.

---

## Forms & File Inputs

### `<label htmlFor>` + hidden file input can silently fail to open the picker

```jsx
// Unreliable in this codebase — reported as "Upload button does nothing"
<label htmlFor="signatureUpload">Upload</label>
<input id="signatureUpload" type="file" className="visually-hidden" />

// Reliable — same pattern the working "Import JSON" button already used
const inputRef = useRef(null)
<button onClick={() => inputRef.current?.click()}>Upload</button>
<input ref={inputRef} type="file" className="visually-hidden" />
```

**How to apply:** any custom-styled file-upload button — use an explicit ref + programmatic `.click()`, not implicit `label[for]` delegation to a visually-hidden input.

---

## Serverless Backend (Vercel)

### No writable persistent filesystem in a serverless function

Vercel serverless functions can write only to `/tmp`, which is ephemeral (wiped between invocations) and not shared across function instances/regions. A literal "write a JSON file to disk and read it back next request" approach silently fails to persist anything in production — it might appear to work locally (`vercel dev` can behave differently) and then lose all data once deployed.

**How to apply:** any "save this data somewhere the next request can read it" need on Vercel — reach for Vercel Blob, Vercel KV, or a real database; never a local file write outside `/tmp`. See decisions.md D4 for which one this project picked and why.

### Stale Vite dependency-optimizer cache after removing a package

```
error while updating dependencies:
Error: ENOENT: no such file or directory, open '.../node_modules/html2pdf.js/dist/html2pdf.js'
```

Seen recurring in the dev server log well after `html2pdf.js` had been fully removed from `package.json` and no source file imported it anymore. Vite's dependency pre-bundler (`node_modules/.vite`) had cached a reference to the now-deleted package and kept retrying to re-optimize against it.

**Fix:** `rm -rf node_modules/.vite` and restart the dev server (`npm run dev`) for a clean re-optimize.

**How to apply:** if the dev server logs an `ENOENT` for a package you're confident is no longer imported anywhere, suspect the Vite optimizer cache before suspecting your own source code — clear it and restart before debugging further.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why | Do instead |
|---|---|---|
| Patching preview/print/PDF output separately | They're meant to be the same source; patches drift apart silently | Change `templates.js`/`themes.css`/`document.css` once — see "One template, three consumers" above |
| Relying on `break-before:page` alone for an on-screen "looks like separate pages" effect | It's invisible outside actual pagination (print/PDF) | Give each page its own styled container + a real visual gap for the on-screen view |
| Static top-level `import` of a heavy, action-gated library (PDF/canvas libs, etc.) | Bloats the main bundle for users who never trigger that action | Dynamic `import()` inside the handler that needs it |
| `new Date('YYYY-MM-DD')` for display or day-math | UTC-parse/local-format shift can be off by a day | Parse the string manually, or force local midnight with a `T00:00:00` suffix |
| `<label htmlFor>` as the *only* trigger for a hidden file input | Has silently failed to open the picker in this codebase | Explicit `ref` + `.click()` |
| Writing a "flat file" directly to a Vercel serverless function's filesystem | Only `/tmp` is writable, and it doesn't persist across invocations | Vercel Blob / KV / a real DB behind a small storage interface |
