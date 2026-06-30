---
name: color-palette-mcp
description: Use when the user has an image (screenshot, design system page, brand sheet, photograph, mockup) and wants a usable color system out of it — design tokens, dark/light themes, WCAG scores, or an HTML guide. Triggers on phrases like "extract the palette from this screenshot", "build a color system from this image", "make this a design system", or when the user wants tokens/CSS/Tailwind/Figma colors. Do NOT use for: text editing, code refactoring, generic image processing, or just showing the colors of an image (use a simple picker instead).
---

# color-palette-mcp

Local MCP server that turns any image into a usable color system. No image leaves the machine. End-to-end deliverable: design tokens, dual themes, WCAG scores, interactive HTML guide.

## When to reach for it

Use `color-palette-mcp` when the user:
- Has a screenshot and wants the design tokens behind it
- Has a brand sheet / style guide / design system page and wants the tokens as code
- Wants dark and light themes generated from a single source
- Wants WCAG accessibility scores for a palette
- Wants a design-system guide (HTML) generated automatically
- Has a wallpaper in a screenshot and wants it separated from the app palette

Do **not** use it for:
- Generating a brand-new palette from scratch (use `harmonize` or `match_vibe` from the same MCP — but usually you just want a tool, not an MCP call)
- Modifying a color in an image
- Picking a single color out of a UI

## The one tool you actually need

**`build_palette_folder`** — one call, one folder, 25 files.

```
build_palette_folder(
  image_path: "/abs/path/to/screenshot.png",  // OR image_url
  // optional:
  target_mode: "auto" | "dark" | "light",   // which theme is "primary"
  brand_mode:  "auto" | "brand" | "ui",      // brand sheet vs UI screenshot
  output_dir:  "/some/output/path",          // defaults to color-palette-extractor-mcp/output/
)
```

Returns a JSON summary with `folder`, `hash`, `window`, `source_mode`, `brand_mode`, `primary`, `secondary`, `wallpaper`, `a11y`, `comparison`, `files`.

The folder contains:
- `index.html` — interactive design system guide with a LIGHT/DARK toggle
- `index.png` — headless Chrome screenshot of the guide (shareable in PRs)
- `preview-*.png` — swatch strips
- `exports/brand.{css_vars,scss,tailwind,json,figma}` (brand mode) OR `exports/app-{light,dark}.{...}` (UI mode)
- `README.md` — markdown summary

## Decision tree

```
Is the source an image of a UI / app / mockup / screenshot?
├── yes → use build_palette_folder
│         ├── Looks like a brand sheet (full image, no separate app window)?
│         │   └── brand_mode = "auto" (default will pick brand)
│         │       → exports use brand.* and demo-inverse.* filenames
│         ├── Looks like a real app on wallpaper?
│         │   └── brand_mode = "auto" (default will pick ui)
│         │       → exports use app-light.* and app-dark.* filenames
│         └── Want to force a specific mode?
│             └── pass brand_mode = "brand" or "ui" explicitly
└── no  → use the other tools (see "Other tools" below)
```

## Parameters cheat sheet

| Parameter | Default | What it does |
|---|---|---|
| `image_path` / `image_url` | (required, one) | Local file path or HTTP(S) URL |
| `target_mode` | `"auto"` | Which theme is "primary" in the deliverable. `"auto"` follows source luminance. |
| `brand_mode` | `"auto"` | `"auto"` uses heuristic (full-window + no wallpaper → brand). `"brand"` forces brand. `"ui"` forces UI. |
| `output_dir` | `./output/` | Where the folder goes |

## Auto-detection rules (the heuristic)

- `source_mode` is "light" if the dominant cluster has HSL lightness > 50, else "dark".
- `brand_mode` is "brand" if the detected window covers ≥ 95% of the image AND `wallpaper.length === 0`. Otherwise "ui".

When in doubt, use `"auto"`. Override only when the auto-detection is wrong.

## How to talk to the user about the result

The result is a folder path. Tell the user:
- The folder location
- The detected source mode (light/dark)
- Whether brand mode was auto-detected
- The ΔE between primary and secondary themes (similarity)
- Any a11y failures (which color pairs don't meet WCAG AA)

The `a11y` field in the JSON has rows like `Primary — text on background, ratio 14.73, level AAA`. Surface the Fail rows explicitly.

## When the auto-detection is wrong

If the user says "this is a brand sheet" but the tool emitted `app-light.*` files, set `brand_mode: "brand"` explicitly.

If the user wants the inverse as a real theme (not "demo inverse"), they're treating a brand as a UI. Set `brand_mode: "ui"`.

If the window detection is off (the cropped window doesn't match the app), the user can either:
1. Crop the image manually first
2. Live with the result — the k-means clustering is robust to slightly wrong bounds

## Reading the JSON response

```json
{
  "folder": "/path/to/folder",
  "hash": "abc12345",
  "window": { "x": 0, "y": 0, "width": 601, "height": 218 },
  "source_mode": "light",
  "brand_mode": true,
  "primary":   [{ "role": "background", "hex": "#...", "population": 23008 }, ...],
  "secondary": [{ "role": "background", "hex": "#..." }, ...],
  "wallpaper": [],
  "a11y": [
    { "label": "Primary — text on background", "fg": "...", "bg": "...", "ratio": 14.73, "level": "AAA" },
    ...
  ],
  "comparison": { "meanDeltaE": 4.31, "meanSimilarity": 0.957 },
  "files": ["README.md", "index.html", ...]
}
```

`primary` is the palette matching the source (or whichever mode `target_mode` requested). `secondary` is the inverse. `wallpaper` is the background-only palette (empty if window fills the image).

## Other tools (when the user has a specific question)

The MCP exposes 8 more tools, each useful in a specific scenario:

| Tool | Use it when... |
|---|---|
| `extract_palette` | You only want the swatches, not the whole deliverable folder. |
| `extract_app_palette` | You want foreground + wallpaper as separate data, no previews. |
| `score_accessibility` | You have a palette already, want WCAG scores. |
| `suggest_role` | You have raw swatches, need to know which is bg vs accent. |
| `export_palette` | You want CSS/SCSS/Tailwind/Figma/JSON/ASE for an existing palette. |
| `harmonize` | You want a palette generated from one seed color (analogous, triadic, etc). |
| `match_vibe` | You have a mood description ("forest dusk") and want a curated palette. |
| `compare_palettes` | You want to know if two palettes are similar (ΔE2000). |

`build_palette_folder` is the only one that creates a folder. The others return JSON.

## Resources

- `palette://recent` — last 20 extracted palettes in the session. Use this to recall a palette without re-extracting.

## Prompts (model can invoke without copy-paste)

- `design_system_audit` — audit a palette for a11y + structural quality.
- `a11y_fixer` — propose a re-tuned palette that passes WCAG AA.

## Failure modes the agent should watch for

- **No wallpaper colors returned** → mockup on a neutral background. Don't promise a wallpaper palette.
- **Window detection wrong** → check `app-window-cropped.png` in the output folder. If wrong, suggest manual cropping.
- **A11y Fail on `text on background`** → the brand's text color is too close to its background. The `a11y_fixer` prompt can re-tune it.
- **`build_palette_folder` doesn't generate `index.png`** → Chrome for Testing wasn't found. The HTML is still there; PNG is the only thing skipped. Tell the user to install via `npx playwright install chromium` or set `CHROME_PATH`.
- **`build_palette_folder` errors on URL fetch** → needs network access. For local files, use `image_path`.
- **The inverse doesn't look like a real theme** → that's by design in brand mode. The HTML guide banner says so. Use `brand_mode: "ui"` to force a real inverse.

## References

- `references/full-tool-reference.md` — every parameter of every tool, exhaustively
- `references/brand-vs-ui-examples.md` — worked examples of brand_mode decisions on real images
- `references/output-folder-shape.md` — exactly what files are emitted in each mode
