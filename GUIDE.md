# Color Palette MCP — Usage Guide

An MCP server that turns images into accessible, export-ready color palettes. Fully local — images never leave your machine. Includes **window detection** for screenshots (separates app from wallpaper) and a **one-call deliverable generator** that builds a complete per-image folder with previews, exports, README, and an HTML design-system guide.

---

## Quick Start

The server is pre-registered in goose as the `Color Palette` extension. Just start a session:

```bash
goose session        # interactive
goose tui            # terminal UI
```

All 9 tools appear alongside your other MCP servers. No setup required.

---

## Tool overview

| Tool | One-line summary |
|---|---|
| ⭐ `build_palette_folder` | **One-call deliverable:** window detect → extract → detect source mode → derive both themes → render → export → README → HTML guide (with toggle) → PNG screenshot |
| `extract_app_palette` | Window-aware extraction: returns app + wallpaper palettes separately |
| `extract_palette` | Whole-image extraction with optional `min_population_ratio` |
| `score_accessibility` | WCAG AA/AAA contrast checks |
| `suggest_role` | Assigns `background` / `text` / `accent` / `surface` / `muted` |
| `export_palette` | Convert to css_vars / scss / tailwind / figma_tokens / json / ase |
| `harmonize` | Generate palette from a single seed via HSL rotations |
| `match_vibe` | Curated palette for a mood/description |
| `compare_palettes` | ΔE2000 perceptual diff between two palettes |

---

## ⭐ `build_palette_folder` — the headline tool

**When to use:** you have an image (especially a screenshot of an app) and want a complete, presentable output without chaining tools yourself.

**Inputs:**
- `image_url` *or* `image_path` — exactly one required
- `output_dir` — optional, defaults to `color-palette-extractor-mcp/output/`
- `target_mode` — `"auto"` (default) | `"dark"` | `"light"`. Controls which theme is labelled *primary* in the deliverable. Both themes are always produced.
- `brand_mode` — `"auto"` (default) | `"brand"` | `"ui"`. Controls whether the source is treated as a brand palette or a UI screenshot. See the **Brand mode vs UI mode** section below.

**What it does, in order:**

1. **Window detection** — scans row/column density of dim-and-desaturated pixels to find the rectangular app/UI region. Auto-detected, no manual coords.
2. **Palette extraction** — k-means on each region separately (foreground + background), with `min_population_ratio=0` so small accents (status dots, tag colors, icons) survive. Deterministic via `mulberry32` seed — same image gives the same palette every time.
3. **Source mode detection** — luminance of the dominant cluster decides whether the source is `dark` or `light`. Returned in the JSON response as `source_mode`.
4. **Role assignment** — mode-aware: `pickRolesForMode(swatches, mode)` picks `background` / `surface` / `text` / `accent` from the clusters. `text` is always the lightness extreme *opposite* to `background`. Wallpaper clusters get hue-agnostic semantic names (`primary`, `secondary`, `tertiary`, `accent_warm`, `accent_cool`, …).
5. **Dual theme generation** — both a primary theme (matching the source's mode, or whichever mode `target_mode` requested) and a secondary theme (the inverse, derived via `deriveOtherMode`). Symmetric: dark sources yield light derivations and vice versa.
6. **A11y scoring** — WCAG ratios for every non-background color in both themes.
7. **Visual previews** — PNG strips of swatches for primary, secondary, wallpaper, and a primary-vs-secondary pair.
8. **Exports** — writes 5 formats × 3 palettes (15 files) into `exports/`. File slugs are `app-light.*` or `app-dark.*` based on which theme they represent.
9. **README.md** — markdown summary with all the numbers.
10. **HTML design-system guide** — interactive page with cards, contrast tables, a11y badges, and a **LIGHT/DARK toggle** in the header that swaps both the swatch content *and* the page chrome (light or dark mood). Toggle state persists in `localStorage`. Active button highlights in the brand's extracted accent color.
11. **PNG screenshot of the guide** — uses headless Chrome for Testing. Saved as `index.png`.

**Output folder name:** `{stem}_{ISO timestamp}_{8-char sha256}` where stem comes from the source filename. Example:

```
inbox_2026-06-29_13-10-00_a1b2c3d4/
```

**Returns (as JSON):** `folder`, `hash`, `window` dimensions, `source_mode`, `primary`, `secondary`, `wallpaper`, `a11y` table, `comparison` ΔE, full `files` list.

**Limitations:**
- Headless screenshot requires Chrome for Testing installed at `~/Library/Caches/ms-playwright/...` (or one of the standard install paths). If none found, the HTML guide is still written, but `index.png` is skipped.
- ~2-3 seconds per invocation. Mostly k-means + PNG composition.

---

## Brand mode vs UI mode

`build_palette_folder` has two distinct output shapes depending on what you point it at:

| Aspect | UI mode (default for real apps) | Brand mode (design-system sheets, mockups on neutral) |
|---|---|---|
| Triggered by | `wallpaper.length > 0` OR the window doesn't fill the image | `wallpaper.length === 0` AND the window fills the image |
| Primary export | `app-{light,dark}.{...}` | `brand.{...}` |
| Inverse export | `app-{dark,light}.{...}` (a real alternative UI theme) | `demo-inverse.{...}` (clearly labelled, NOT a recommended UI theme) |
| HTML section heading | "App theme" | "Brand palette" |
| Banner paragraph | (none) | Explains the inverse is for reference only; use `brand.*` for design tokens |
| Tag labels | "matches source" / "derived" | "brand" / "demo inverse" |
| Strip / preview titles | "APP LIGHT" / "APP DARK" | "BRAND" / "DEMO INVERSE" |
| Pair-preview title | "APP THEME — light vs dark" | "BRAND vs INVERSE — demo only" |

Auto-detection: `brand_mode: "auto"` (the default) picks brand mode when the detected window covers ≥ 95% of the image AND `wallpaper.length === 0`. So a real app screenshot with a wallpaper falls back to UI mode automatically; a brand sheet or mockup on a neutral background gets brand mode automatically.

Override: pass `brand_mode: "brand"` to force brand mode regardless of structure (e.g. you have a real app screenshot but only want the brand tokens), or `brand_mode: "ui"` to force UI mode for a brand sheet (e.g. you want to see what the brand looks like inverted as a *real* dark-mode UI candidate).

The key design decision: **in brand mode the inverse is generated for visual reference only**, not as a recommended theme. A brand's "dark mode" is a *design* problem, not an inversion problem — letting designers see what an inverted brand looks like is useful, but the deliverable makes clear it shouldn't be shipped as-is.

---

## When to reach for which tool

| You want to... | Use this tool |
|---|---|
| Get a complete deliverable folder with everything | ⭐ `build_palette_folder` |
| Just the data (palettes, contrast), no files | `extract_app_palette` |
| Pull a palette from a photo / artwork | `extract_palette` |
| Check if your existing colors meet WCAG AA | `score_accessibility` |
| Decide which color is bg vs accent | `suggest_role` |
| Get Tailwind / CSS / Figma tokens / ASE | `export_palette` |
| Build a palette from one seed | `harmonize` |
| Translate a mood into a palette | `match_vibe` |
| See how different two palettes are | `compare_palettes` |

---

## Window detection: app vs wallpaper

`build_palette_folder` and `extract_app_palette` use the same auto-detection:

1. Resize image to ≤ 600px on the long side.
2. Classify each pixel: **app** = `luma < 75 AND saturation < 35` (typical dark UI panel), else **wallpaper**.
3. Compute per-row and per-column density of "app" pixels.
4. Find the bounding box where density exceeds 50%.
5. Extract foreground (inside box) and background (outside box) as separate buffers.
6. Run k-means on each independently.

**When the heuristic fails:**
- **Light-mode apps** (white panels on dark wallpaper): invert the threshold or pass the image manually cropped.
- **Transparent / floating UI** without a clear background: may not detect.
- **Highly textured wallpaper** that happens to be dim: may pull wallpaper pixels into the app region. Check `app-window-cropped.png` in the output folder to verify.

If the detection is wrong, the bounding box is included in the tool response, so you can debug.

---

## Tool reference

### `extract_palette`
Pulls a palette from an image using perceptual clustering.

**Inputs:**
- `image_url` *or* `image_path` — exactly one required
- `count` — 2–12 (default `5`)
- `method` — `kmeans` (default) or `mediancut`
- `ignore_near_white` / `ignore_near_black` — strip backgrounds (default `false`)
- `min_population_ratio` — drop clusters below this fraction of the largest cluster (default `0.001`, set `0` to keep everything)

**Returns:** array of swatches `{ hex, rgb, hsl, population }` sorted by visual weight.

**When to use:** photos, screenshots, mockup images, mood boards. **Don't** use on logos or small icons (need ≥ ~50×50 px of distinct color regions).

**Pro tip:** for screenshots where small accents matter (status dots, tag colors), set `min_population_ratio: 0` to keep all clusters.

---

### `extract_app_palette`
Window-aware extraction. Returns two palettes:

**Inputs:**
- `image_url` *or* `image_path`
- `count` — 2–12 (default `6`)
- `min_population_ratio` — default `0.001`

**Returns:**
```json
{
  "window": { "x": 54, "y": 53, "width": 546, "height": 397 },
  "foreground": { "label": "app", "palette": [...] },
  "background": { "label": "wallpaper", "count": 53238, "palette": [...] }
}
```

**When to use:** any screenshot of an app on a wallpaper. Without this, kmeans mixes the two and you get useless palettes dominated by whichever is largest.

---

### `score_accessibility`
WCAG AA/AAA contrast check between palette pairs.

**Inputs:**
- `palette` — array of `{ hex, role? }`
- `pairs` — optional list of `[foreground, background]` pairs; defaults to `first` vs `last`

**Returns:** contrast ratio + AA / AA-Large / AAA / AAA-Large booleans + level label.

**Levels to remember:**
- `4.5` → AA body text
- `3.0` → AA large text (≥ 18pt or 14pt bold)
- `7.0` → AAA body text

---

### `suggest_role`
Assigns semantic roles (`background`, `text`, `surface`, `muted`, `accent`) to a palette.

**Inputs:**
- `palette` — must have `hex`, `rgb`, `hsl`, `population` (output of `extract_palette` or `harmonize`)
- `purpose` — `light_theme` | `dark_theme` | `data_viz` | `branding`

**Returns:** same swatches with a `role` field added.

**Caveat:** role assignment is heuristic — `light_theme` uses the lightest swatch as background, `dark_theme` uses the darkest. If your palette lacks a near-white or near-black, manually swap roles and re-score.

---

### `export_palette`
Outputs the palette as developer/designer-ready code.

**Inputs:**
- `palette` — must include `role`
- `name` — used as the namespace
- `format` — `css_vars` | `scss` | `tailwind` | `figma_tokens` | `json` | `ase`

| Format | Drop into |
|---|---|
| `css_vars` | Any CSS file |
| `scss` | SCSS partial |
| `tailwind` | `tailwind.config.js` |
| `figma_tokens` | Figma Tokens plugin |
| `json` | Anywhere |
| `ase` | Photoshop / Illustrator (drag file in) |

---

### `harmonize`
Generates a palette from a single seed via HSL rotations.

**Schemes:**
- `analogous` — adjacent hues, calm
- `triadic` — three hues evenly spaced, vibrant
- `complementary` — seed + opposite hue
- `split` — seed + two near-opposites
- `tetradic` — four hues
- `monochrome` — same hue, varied lightness

**When to use:** you have one brand color and need a coherent system around it.

---

### `match_vibe`
Curated palette for a mood.

**Inputs:**
- `description` — free text
- `count` — 3–7 (default `5`)

**Built-in vibes:** `forest dusk`, `sunset desert`, `ocean morning`, `tokyo neon`, `coffee shop`, `midnight lavender`, `pastel spring`, `industrial concrete`, `autumn harvest`.

**Caveat:** keyword-matched, not LLM-driven. "Cozy autumn reading nook" won't match `autumn harvest` unless "autumn" appears. For novel descriptions, use `harmonize` from a representative hex.

---

### `compare_palettes`
ΔE2000 perceptual difference between two palettes.

**Interpretation:**
- `ΔE < 2` — visually identical
- `ΔE 2–10` — perceptible on close inspection
- `ΔE 10–25` — clearly different
- `ΔE > 25` — opposite ends of the spectrum

---

## Common workflows

### 1. Screenshot → complete deliverable folder ⭐
```
build_palette_folder(image_path=/Users/me/Screenshots/inbox.png)
```
One call. ~3 seconds. 25 files including the HTML design-system guide.

### 2. Image → Tailwind theme (manual control)
```
extract_app_palette(image_path=...)        → window + palettes
suggest_role(purpose=light_theme)          → assign roles
score_accessibility(...)                   → verify AA passes
export_palette(format=tailwind, name=...)
```

### 3. One brand color → full system
```
harmonize(seed_hex=#3b82f6, scheme=triadic)  → palette
suggest_role(purpose=dark_theme)              → assign roles
export_palette(format=css_vars, name=brand)   → ship
```

### 4. Validate an existing palette
```
score_accessibility(palette=[...], pairs=[[text, bg], [accent, bg]])
```

### 5. Mood board → Figma tokens
```
match_vibe(description="tokyo neon at 2am")   → palette
export_palette(format=figma_tokens, name=neon)
```

### 6. Detect brand drift
```
extract_app_palette(image_path=new_logo.png)   → palette A
compare_palettes(a=[...old hexes], b=[...A hexes])
```

---

## Output folder structure

When you call `build_palette_folder`, you get a folder named `{stem}_{timestamp}_{hash}`:

```
{inbox}_2026-06-29_13-10-00_a1b2c3d4/
├── README.md                       ← markdown summary (shows BOTH themes)
├── index.html                      ← interactive design system guide (themed chrome + LIGHT/DARK toggle)
├── index.png                       ← headless Chrome screenshot of guide
├── source.{ext}                    ← original image (copied)
├── app-window-cropped.png          ← detected window
├── preview-app-{light|dark}.png    ← swatch grid (UI mode — filename reflects theme mode)
├── preview-brand.png               ← swatch grid (BRAND mode — brand swatches)
├── preview-demo-inverse.png        ← swatch grid (BRAND mode — for visual reference only)
├── preview-app-pair-light.png      ← primary vs secondary, on light bg (swap with toggle)
├── preview-app-pair-dark.png       ← primary vs secondary, on dark bg (swap with toggle)
├── preview-app-pair.png            ← static fallback (light variant) for README contexts
├── preview-wallpaper.png           ← omitted when wallpaper.length === 0
└── exports/
    ├── app-{light|dark}.{css_vars,scss,tailwind,json,figma}    ← UI mode
    ├── brand.{css_vars,scss,tailwind,json,figma}                ← BRAND mode (the tokens to ship)
    ├── demo-inverse.{css_vars,scss,tailwind,json,figma}         ← BRAND mode (preview only, NOT a UI theme)
    └── wallpaper.{css_vars,scss,tailwind,json,figma}
```

**Note:** `preview-app-light.*` or `preview-app-dark.*` are emitted based on which theme is the primary for this source (auto-detected from luminance). On a light source like KIKA's design-system page, the primary is the light theme and the secondary (derived dark) is exported as `app-dark.*`.

**Conditional rendering in HTML:**
- The `Wallpaper (excluded from app)` section is omitted entirely when no wallpaper colors were extracted. For a mockup on a neutral page (no separate wallpaper region) the section just doesn't render.
- `preview-wallpaper.png` is only written when wallpaper is non-empty; otherwise it's omitted to avoid a broken image icon.

**Themed page chrome (v0.3.2–v0.3.4):**
- The page chrome is themed to match the palette, not hardcoded navy. LIGHT theme renders on an off-white page, DARK theme on a deep-navy page.
- Chrome tints (tag pill, toggle button highlight, section labels) are derived from the brand's extracted accent RGB, not from a hardcoded blue. On a warm-grey palette the dark-mode tag reads warm-grey; on a slate palette it reads slate.
- The toggle button has a 250ms cross-fade and persists its state in `localStorage`.
- Section titles (h2) stay bold and high-contrast on either chrome — explicit `font-weight: 600` for h2 and `700` for theme-block h2, with color bound to `--text`.

Open `index.html` in any browser for the interactive guide. Click `LIGHT` / `DARK` in the header to flip both the swatch content, the page chrome, AND the app pair preview background. The `index.png` is shareable as-is in Slack / PRs.

---

## Resources & prompts

**Resources:**
- `palette://recent` — last 20 palettes extracted in this session. The model can reference this to recall a palette without re-running extraction.

**Prompts (model can invoke without copy-pasting instructions):**
- `design_system_audit` — flags a11y issues, duplicates, missing roles, muddy colors.
- `a11y_fixer` — proposes a re-tuned palette that passes WCAG AA.

---

## Troubleshooting

**Palette is all one color** → image too small or uniform. Try a larger image, or `count: 3`.

**Roles feel backwards** → palette lacks the lightness range. The mode detector may have flipped source mode — check `source_mode` in the response. Add a near-white or near-black, or manually swap `role` fields.

**Contrast fails AA** → run `suggest_role` again with the opposite purpose, or use `harmonize` from a darker/lighter seed.

**Window detection wrong (app region too big or too small)** → check `app-window-cropped.png` in the output. If wrong, the app may have a light background (heuristic tuned for dark UI) or be on a dark wallpaper (heuristic may merge them). Workaround: crop the image manually before calling the tool.

**Beta/Ideas-tag-style accents missing from palette** → the default `min_population_ratio=0.001` filters out clusters under 0.1% of the largest. Set it to `0` to keep everything.

**Server not appearing in goose** → check `goose info --verbose | grep palette`. If missing, the config entry was overwritten — restore from backup or re-add.

**Image fetch fails** → the server uses `fetch()` for URLs, so it needs network access. For local files, use `image_path` instead.

**`build_palette_folder` doesn't generate `index.png`** → Chrome for Testing wasn't found. The HTML guide is still written. Install via `npx playwright install chromium` or set `CHROME_PATH`.

---

## Limitations

- **RGB-space k-means** — clusters in RGB, which can mis-cluster perceptually-distant colors that happen to be close in RGB. For 99% of cases fine; for picky color work, extract multiple seeds and reconcile.
- **No named-color matching** — doesn't recognize "this is Crayola Red". Use hex codes if you need that precision.
- **Window detection tuned for dark UI** — apps with white panels on dark backgrounds may not separate cleanly. The cropped preview tells you.
- **`match_vibe` is keyword-matched** — see the caveat in its section.
- **`ase` export writes Adobe Swatch Exchange v1.0** — verified against the spec but not every Photoshop version.
- **No async/streaming** — every tool runs to completion before returning. For very large images (>5MB), expect ~1-3s latency.

---

## CI & build verification

The repo ships with a GitHub Actions workflow at `.github/workflows/build.yml`. On every push to `main` and every PR:

| Step | What it does |
|---|---|
| Install | `npm ci` — reproducible install from `package-lock.json` |
| Type-check | `npx tsc --noEmit` — catches type errors without emitting JS |
| Build | `npm run build` — compiles to `dist/` |
| Verify build output | Asserts every expected `dist/*.js` file exists |
| Smoke-test | Spawns the server, sends a real JSON-RPC `initialize` request, parses the response, asserts `serverInfo.name === "color-palette-mcp"` |

**Runner matrix:**
- OS: `macos-26`
- Node: `[18, 22]`

The build badge in `README.md` reflects the latest run status. Latest green run: see https://github.com/aka-kika/color-palette-extractor-mcp/actions.

**Reproducing CI locally:**

```bash
npm ci
npm run build
node dist/server.js   # then send a JSON-RPC initialize from another terminal
```

The smoke-test step uses `actions/github-script@v7` to drive the server. If you want to test locally without GitHub, the `mcp_smoke.mjs` pattern in this project's commit history is the model.

---

## File layout

```
color-palette-extractor-mcp/
├── README.md             ← install blurb + headline tool teaser
├── GUIDE.md              ← you are here — full operator's manual
├── GUIDE.html            ← rendered version of this guide (built from GUIDE.md)
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts         ← MCP entry: 9 tools + 1 resource + 2 prompts
│   ├── extract.ts        ← kmeans + median-cut, auto-detect RGB vs RGBA
│   ├── window.ts         ← window/foreground detection (NEW)
│   ├── build.ts          ← per-image deliverable folder generator (NEW)
│   ├── color.ts          ← hex/RGB/HSL/Lab + WCAG + ΔE2000
│   ├── harmonize.ts
│   ├── roles.ts
│   ├── export.ts         ← CSS / SCSS / Tailwind / Figma / JSON / ASE
│   └── compare.ts
├── dist/                 ← compiled JS, what goose actually runs
└── output/               ← default output dir for build_palette_folder
    └── {stem}_{timestamp}_{hash}/
        └── …25 files per invocation…
```

Rebuild with `npm run build` from inside this folder.