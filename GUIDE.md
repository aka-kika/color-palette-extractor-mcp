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
| ⭐ `build_palette_folder` | **One-call deliverable:** window detect → extract → derive light → render → export → README → HTML guide → PNG screenshot |
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
- `output_dir` — optional, defaults to `color-palette-mcp/output/`

**What it does, in order:**

1. **Window detection** — scans row/column density of dim-and-desaturated pixels to find the rectangular app/UI region. Auto-detected, no manual coords.
2. **Palette extraction** — k-means on each region separately (foreground + background), with `min_population_ratio=0` so small accents (status dots, tag colors, icons) survive.
3. **Role assignment** — picks `background` / `surface` / `text` / `accent` from each region's clusters. Wallpaper gets semantic names (`primary`, `secondary`, `tertiary`, `mid_blue`, `deep_blue`, `ambient_purple`, …).
4. **Light theme derivation** — inverts each dark color's lightness while keeping hue, desaturating for neutral tones. Accent stays saturated.
5. **A11y scoring** — WCAG ratios for every non-background color in both themes.
6. **Visual previews** — PNG strips of swatches for dark, light, wallpaper, and a dark-vs-light pair.
7. **Exports** — writes 5 formats × 3 palettes (15 files) into `exports/`.
8. **README.md** — markdown summary with all the numbers.
9. **HTML design-system guide** — interactive page with cards, contrast tables, a11y badges. Dark-themed.
10. **PNG screenshot of the guide** — uses headless Chrome for Testing. Saved as `index.png`.

**Output folder name:** `{stem}_{ISO timestamp}_{8-char sha256}` where stem comes from the source filename. Example:

```
inbox_2026-06-29_13-10-00_a1b2c3d4/
```

**Returns (as JSON):** folder path, hash, window dimensions, app-dark/app-light/wallpaper palettes, a11y table, comparison ΔE, full file list.

**Limitations:**
- Headless screenshot requires Chrome for Testing installed at `~/Library/Caches/ms-playwright/...` (or one of the standard install paths). If none found, the HTML guide is still written, but `index.png` is skipped.
- ~2-3 seconds per invocation. Mostly k-means + PNG composition.

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
├── README.md                    ← markdown summary
├── index.html                   ← interactive design system guide
├── index.png                    ← headless Chrome screenshot of guide
├── source.{ext}                 ← original image (copied)
├── app-window-cropped.png       ← detected app region
├── preview-app-dark.png         ← 4-up swatch grid
├── preview-app-light.png
├── preview-wallpaper.png
├── preview-app-pair.png         ← dark vs light
├── preview-all.png              ← app + wallpaper combined
└── exports/
    ├── app-dark.{css_vars,scss,tailwind,json,figma}
    ├── app-light.{css_vars,scss,tailwind,json,figma}
    └── wallpaper.{css_vars,scss,tailwind,json,figma}
```

Open `index.html` in any browser for the interactive guide. The `index.png` is shareable as-is in Slack / PRs.

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

**Roles feel backwards** → palette lacks the lightness range. Add a near-white or near-black, or manually swap `role` fields.

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

## File layout

```
color-palette-mcp/
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