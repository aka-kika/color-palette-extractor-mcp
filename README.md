# color-palette-mcp

[![build](https://github.com/aka-kika/color-palette-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/aka-kika/color-palette-mcp/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-7c3aed)](https://modelcontextprotocol.io)

MCP server that turns images into accessible, export-ready color palettes. Fully local — no image leaves the box. Includes window detection so screenshots get app + wallpaper palettes **separated**, plus a one-call deliverable generator that builds a complete per-image folder with previews, exports, README, and an HTML design-system guide.

**9 tools** · Window-aware extraction · End-to-end deliverable generator · Fully local processing.

## Tools

- **`build_palette_folder`** ⭐ — *the headline tool.* End-to-end pipeline: detect app window → extract app + wallpaper palettes separately → derive neutral light theme → render previews → write exports in 5 formats → write README.md → generate HTML design-system guide → screenshot the guide with headless Chrome. One call, one folder, 25 files.
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

## Run locally

```bash
npm run dev
```

## Wire into an MCP client

Add to your MCP config (e.g. Claude Desktop):

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