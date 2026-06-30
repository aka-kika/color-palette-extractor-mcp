# Full tool reference

All 9 tools, all parameters, all return shapes.

## `build_palette_folder` — the headline tool

**Description:** End-to-end pipeline. Detect app window → extract app + wallpaper palettes separately → detect source mode and derive the inverse theme → render visual previews → write exports in 5 formats → write README.md → generate HTML design-system guide with a dark/light toggle and themed page chrome → screenshot the guide with headless Chrome. Each invocation creates a unique folder.

**Inputs:**
- `image_url` (optional, string URL) — HTTP(S) image URL
- `image_path` (optional, string) — local file path
- `output_dir` (optional, string) — defaults to `color-palette-extractor-mcp/output/`
- `target_mode` (optional, `"auto"` | `"dark"` | `"light"`) — which theme is "primary"
- `brand_mode` (optional, `"auto"` | `"brand"` | `"ui"`) — brand sheet vs UI screenshot

**Returns:** JSON string with:
```json
{
  "folder": "string",
  "hash": "string (8 chars)",
  "window": { "x": number, "y": number, "width": number, "height": number },
  "source_mode": "dark" | "light",
  "brand_mode": boolean,
  "primary": [{ "hex": "#...", "role": "string", "population": number }, ...],
  "secondary": [{ "hex": "#...", "role": "string" }, ...],
  "wallpaper": [{ "hex": "#...", "role": "string" }, ...],
  "a11y": [{ "label": "string", "fg": "#...", "bg": "#...", "ratio": number, "level": "AAA" | "AA" | "AA Large" | "Fail" }, ...],
  "comparison": { "meanDeltaE": number, "meanSimilarity": number },
  "files": ["string", ...]
}
```

**Output folder:**
- `README.md`
- `index.html` (interactive design system guide)
- `index.png` (headless Chrome screenshot)
- `source.{ext}` (copy of input)
- `app-window-cropped.png`
- `preview-{primary-slug}.png`, `preview-{secondary-slug}.png`, `preview-wallpaper.png`
- `preview-app-pair-light.png`, `preview-app-pair-dark.png`, `preview-app-pair.png`
- `preview-all.png`
- `exports/{primary-slug}.{css_vars,scss,tailwind,json,figma}`
- `exports/{secondary-slug}.{css_vars,scss,tailwind,json,figma}`
- `exports/wallpaper.{css_vars,scss,tailwind,json,figma}`

Where `{primary-slug}` and `{secondary-slug}` are:
- `brand` and `demo-inverse` when `brand_mode === "brand"`
- `app-light` and `app-dark` (or vice versa) when `brand_mode === "ui"`

---

## `extract_palette`

**Description:** k-means / median-cut extraction from an image.

**Inputs:**
- `image_url` (optional, string URL)
- `image_path` (optional, string)
- `count` (optional, number, default 5) — number of swatches
- `method` (optional, `"kmeans"` | `"mediancut"`, default `"kmeans"`)
- `ignore_near_white` / `ignore_near_black` (optional, boolean) — strip background colors

**Returns:** JSON array of swatches with `hex`, `rgb`, `hsl`, `population`, `role`.

---

## `extract_app_palette`

**Description:** Window-aware extraction. Returns foreground (app) and background (wallpaper) palettes separately.

**Inputs:**
- `image_url` (optional, string URL)
- `image_path` (optional, string)
- `count` (optional, number, default 5) — per region

**Returns:** JSON with `foreground` and `background` arrays of swatches.

---

## `score_accessibility`

**Description:** WCAG AA/AAA contrast checks for a palette.

**Inputs:**
- `palette` (required, array of `{hex, role}`) — the colors to score
- `pairs` (optional, array of `{fg, bg}`) — specific pairs to check; defaults to "every non-bg against bg"

**Returns:** JSON array of `{fg, bg, ratio, level}` where `level` is one of `AAA` / `AA` / `AA Large` / `Fail`.

---

## `suggest_role`

**Description:** Assign semantic roles to raw swatches.

**Inputs:**
- `palette` (required, array of `{hex}`) — raw swatches
- `purpose` (required, `"light_theme"` | `"dark_theme"` | `"data_viz"` | `"branding"`)

**Returns:** JSON array of `{hex, role, rgb, hsl}`.

---

## `export_palette`

**Description:** Convert a palette to design-token formats.

**Inputs:**
- `palette` (required)
- `name` (required, string) — used as variable prefix
- `format` (required, `"css_vars"` | `"scss"` | `"tailwind"` | `"figma_tokens"` | `"json"` | `"ase"`)

**Returns:** The formatted token output as a string.

---

## `harmonize`

**Description:** Generate a palette from one seed color using color theory.

**Inputs:**
- `seed_hex` (required, string) — e.g. `"#3b82f6"`
- `scheme` (required, `"analogous"` | `"triadic"` | `"complementary"` | `"split"` | `"tetradic"` | `"monochrome"`)
- `count` (optional, number, default 5)

**Returns:** JSON array of swatches.

---

## `match_vibe`

**Description:** Curated palette for a mood description. Local anchor-palette lookup, no LLM call required.

**Inputs:**
- `description` (required, string) — e.g. `"forest dusk"`, `"tokyo neon"`, `"apple store morning"`

**Returns:** JSON array of swatches.

---

## `compare_palettes`

**Description:** Perceptual diff between two palettes using ΔE2000.

**Inputs:**
- `palette_a` (required, array of hex strings)
- `palette_b` (required, array of hex strings)

**Returns:** JSON with `pairs` (per-swatch ΔE), `meanDeltaE`, `meanSimilarity` (1 - meanΔE/100, clamped).
