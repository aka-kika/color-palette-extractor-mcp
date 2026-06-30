# color-palette-mcp

[![build](https://github.com/aka-kika/color-palette-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/aka-kika/color-palette-mcp/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-7c3aed)](https://modelcontextprotocol.io)

MCP server that turns images into accessible, export-ready color palettes. Fully local — no image leaves the box. Includes window detection so screenshots get app + wallpaper palettes **separated**, plus a one-call deliverable generator that builds a complete per-image folder with previews, exports, README, and an HTML design-system guide.

**9 tools** · Window-aware extraction · End-to-end deliverable generator · Fully local processing.

## Tools

- **`build_palette_folder`** ⭐ — *the headline tool.* End-to-end pipeline: detect app window → extract app + wallpaper palettes separately → **detect source mode (dark/light) and derive the inverse** → render previews → write exports in 5 formats → write README.md → generate HTML design-system guide **with a dark/light toggle and themed page chrome** → screenshot the guide with headless Chrome. One call, one folder, 25 files.
- `target_mode` parameter (`"auto"` / `"dark"` / `"light"`): controls which theme is labelled primary in the deliverable. Both themes are always produced; auto-detect picks primary to match the source luminance.
- `brand_mode` parameter (`"auto"` / `"brand"` / `"ui"`): controls whether the source is treated as a brand palette or a UI screenshot. In **brand** mode, exports are `brand.{...}` (the tokens to ship) plus `demo-inverse.{...}` (a preview of the brand inverted — clearly labelled, *not* a recommended UI theme). The HTML guide uses "Brand palette" headings and a banner explaining the inverse is for reference only. **Auto** picks brand mode when the window fills the image and there's no wallpaper (e.g. design-system sheets, mockups on neutral); otherwise UI mode (current behaviour, `app-{light,dark}.{...}` exports).
- The HTML guide's chrome (page background, panels, header, footer, table, toggle button) is themed to match the palette — LIGHT theme renders on an off-white page, DARK theme renders on a deep-navy page, both with the brand's extracted accent as the toggle highlight. 250ms cross-fade between the two states.
- Chrome is tinted from the brand accent (not hardcoded blue) — the dark-mode tag pill, toggle button highlight, and section labels all use shades of the brand's accent. On a warm-grey palette the page reads warm-grey, on a slate palette it reads slate, on a pink palette it reads pink.
- The App pair preview swaps with the toggle (two static PNGs, one light, one dark, swapped via CSS). Section titles stay bold and dark on light chrome, bold and light on dark chrome.
- **`extract_palette`** — k-means / median-cut extraction from an image URL or path. Optional `min_population_ratio` (default `0.001`) keeps tiny accents alive.
- **`extract_app_palette`** — auto-detects the app window in a screenshot and returns *separate* foreground (app) and background (wallpaper) palettes.
- **`score_accessibility`** — WCAG AA/AAA contrast ratios between palette pairs.
- **`suggest_role`** — assigns `background` / `text` / `accent` / `surface` / `muted` for a chosen purpose.
- **`export_palette`** — outputs `css_vars` / `scss` / `tailwind` / `figma_tokens` / `json` / `ase`.
- **`harmonize`** — analogous / triadic / complementary / split / tetradic / monochrome from a seed.
- **`match_vibe`** — curated palette for a mood description ("forest dusk", "tokyo neon", …).
- **`compare_palettes`** — ΔE2000 perceptual diff between two palettes.

## Resources

- `palette://recent` — last 20 extracted palettes in this session.

## Prompts

- `design_system_audit` — audit a palette for a11y + structural quality.
- `a11y_fixer` — propose a re-tuned palette that passes WCAG AA.

## Install

```bash
cd color-palette-mcp
npm ci              # reproducible install (matches CI)
npm run build
```

**Requirements:** Node ≥ 18. CI is verified on Node 18 and 22 (dropped Node 20 because GitHub deprecated it on runners). Runs on `macos-26` runner — your dev machine should be the same for parity.

### Install as a published package (once released to npm)

```bash
npm install -g color-palette-extractor-mcp   # then use the bin name in any MCP client
# or
npx color-palette-extractor-mcp              # one-off invocation
```

**Publishing yourself:** this repo's source is published under the name `color-palette-extractor-mcp` (the original `color-palette-mcp` is taken on npm by another author). To release a new version:

```bash
npm login                # one-time
npm version patch        # or minor / major
npm publish              # runs `prepublishOnly` → `npm run build` first
```

## Run locally

```bash
npm run dev
```

## Wire into an MCP client

Add to your MCP config (e.g. Claude Desktop):

**Local install (current setup):**
```json
{
  "mcpServers": {
    "color-palette": {
      "command": "node",
      "args": ["/Users/gamba/Documents/gooooose/color-palette-mcp/dist/server.js"]
    }
  }
}
```

**After `npm install -g color-palette-extractor-mcp`:**
```json
{
  "mcpServers": {
    "color-palette": {
      "command": "color-palette-extractor-mcp"
    }
  }
}
```

## Example conversation

> *"Build me a palette folder from `/Users/me/Screenshots/inbox.png`."*

The model calls `build_palette_folder` once and you get a folder like `inbox_2026-06-29_13-10-00_a1b2c3d4/` containing:

```
README.md                 ← palettes, roles, populations, a11y, comparisons
index.html                ← interactive design system guide
index.png                 ← 1200×1600 screenshot of the guide
source.png                ← original image
app-window-cropped.png    ← detected app region
preview-app-dark.png      ← visual swatches
preview-app-light.png
preview-wallpaper.png
preview-app-pair.png      ← dark vs light
preview-all.png
exports/
  app-dark.{css_vars,scss,tailwind,json,figma}
  app-light.{css_vars,scss,tailwind,json,figma}
  wallpaper.{css_vars,scss,tailwind,json,figma}
```

Folder name is `{stem}_{ISO timestamp}_{8-char sha256 of file contents}` so re-running on the same image at a different time still creates a new folder.

## See also

- **`GUIDE.md`** — full operator's manual: when to use each tool, common workflows, troubleshooting, limitations.