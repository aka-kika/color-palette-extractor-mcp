# color-palette-extractor-mcp

[![build](https://github.com/aka-kika/color-palette-extractor-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/aka-kika/color-palette-extractor-mcp/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-7c3aed)](https://modelcontextprotocol.io)

MCP server that turns images into accessible, export-ready color palettes. Fully local — no image leaves the box. Includes window detection so screenshots get app + wallpaper palettes **separated**, plus a one-call deliverable generator that builds a complete per-image folder with previews, exports, README, and an HTML design-system guide.

**9 tools** · Window-aware extraction · End-to-end deliverable generator · Fully local processing.

## Tools

### `build_palette_folder` — the headline tool

End-to-end pipeline: detect app window → extract app + wallpaper palettes separately → detect source mode (dark/light) and derive the inverse → render previews → write exports in 5 formats → write README.md → generate HTML design-system guide with a dark/light toggle and themed page chrome → screenshot the guide with headless Chrome. One call, one folder, 25 files.

Parameters:
- `target_mode` (`"auto"` / `"dark"` / `"light"`) — controls which theme is labelled primary in the deliverable. Both themes are always produced; auto-detect picks primary to match the source luminance.
- `brand_mode` (`"auto"` / `"brand"` / `"ui"`) — controls whether the source is treated as a brand palette or a UI screenshot. In **brand** mode, exports are `brand.{...}` (the tokens to ship) plus `demo-inverse.{...}` (a preview of the brand inverted — clearly labelled, *not* a recommended UI theme). The HTML guide uses "Brand palette" headings and a banner explaining the inverse is for reference only. **Auto** picks brand mode when the window fills the image and there's no wallpaper (e.g. design-system sheets, mockups on neutral); otherwise UI mode (current behaviour, `app-{light,dark}.{...}` exports).

What you get:
- The HTML guide's chrome (page background, panels, header, footer, table, toggle button) is themed to match the palette — LIGHT theme renders on an off-white page, DARK theme renders on a deep-navy page, both with the brand's extracted accent as the toggle highlight. 250ms cross-fade between the two states.
- Chrome is tinted from the brand accent (not hardcoded blue) — the dark-mode tag pill, toggle button highlight, and section labels all use shades of the brand's accent. On a warm-grey palette the page reads warm-grey, on a slate palette it reads slate, on a pink palette it reads pink.
- The App pair preview swaps with the toggle (two static PNGs, one light, one dark, swapped via CSS). Section titles stay bold and dark on light chrome, bold and light on dark chrome.

### The other eight tools

- `extract_palette` — k-means / median-cut extraction from an image URL or path. Optional `min_population_ratio` (default `0.001`) keeps tiny accents alive.

- `extract_app_palette` — auto-detects the app window in a screenshot and returns *separate* foreground (app) and background (wallpaper) palettes.

- `score_accessibility` — WCAG AA/AAA contrast ratios between palette pairs.

- `suggest_role` — assigns `background` / `text` / `accent` / `surface` / `muted` for a chosen purpose.

- `export_palette` — outputs `css_vars` / `scss` / `tailwind` / `figma_tokens` / `json` / `ase`.

- `harmonize` — analogous / triadic / complementary / split / tetradic / monochrome from a seed.

- `match_vibe` — curated palette for a mood description ("forest dusk", "tokyo neon", …).

- `compare_palettes` — ΔE2000 perceptual diff between two palettes.

## Resources

- `palette://recent` — last 20 extracted palettes in this session.

## Prompts

- `design_system_audit` — audit a palette for a11y + structural quality.
- `a11y_fixer` — propose a re-tuned palette that passes WCAG AA.

## Agent skill

A ready-to-use `color-palette-mcp` skill is bundled with the repo at `.skills/color-palette-mcp/`. It includes:

- `SKILL.md` — entry point: when to use the tool, the one tool you actually need (`build_palette_folder`), the decision tree for `brand_mode` (auto / brand / ui), parameter cheat sheet, auto-detection rules, JSON response shape, and failure modes the agent should watch for
- `references/full-tool-reference.md` — every parameter of every tool, exhaustively
- `references/brand-vs-ui-examples.md` — worked examples on real images of when each mode is right
- `references/output-folder-shape.md` — exactly what files are emitted in each mode

Other agents (goose, Claude, Codex, etc.) can `load_skill color-palette-mcp` to immediately know how to use this MCP without reading the full README. The skill is not part of the npm tarball — it's bundled in the GitHub source for direct cloning.

## Install

```bash
cd color-palette-mcp
npm ci              # reproducible install (matches CI)
npm test            # 18 unit tests (color math + SSRF guard)
npm run build
```

**Requirements:** Node ≥ 18. CI runs on `ubuntu-latest` across Node 18 and 22 (dropped Node 20 because GitHub deprecated it on runners), and gates on type-check, the test suite, and a runtime-dependency `npm audit`.

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
      "args": ["/absolute/path/to/color-palette-extractor-mcp/dist/server.js"]
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

## Configuration

Both are optional environment variables:

- `PALETTE_OUTPUT_DIR` — where `build_palette_folder` writes its deliverable folders. Defaults to `<cwd>/output`. When wiring into an always-on MCP client, set this to a fixed, writable path so output doesn't land in whatever directory the client happens to launch from.
- `CHROME_PATH` — path to a Chrome/Chromium binary for the design-guide screenshot. Defaults to a system Google Chrome install on macOS; if unset and no Chrome is found, the HTML guide is still written, just without `index.png`.

## Security

Fully local — no image data leaves the machine. The server is hardened for the case where tool arguments come from an untrusted source (e.g. an agent acting on injected content):

- **No shell** — the headless-Chrome screenshot is spawned with an argument array, so `output_dir` can't be turned into a shell command.
- **Escaped HTML** — every dynamic value rendered into the design-system guide is HTML-escaped before headless Chrome renders it.
- **SSRF-guarded fetch** — `image_url` downloads reject private/loopback/link-local hosts and non-http(s) schemes, re-validate each redirect, time out after 10s, and are size-capped at 25 MB.

`image_path` reads and `PALETTE_OUTPUT_DIR` writes are unrestricted by design — run the server with the privileges you'd give any local file tool.

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

## Example output

A real deliverable is checked in at [`examples/akakika-com/`](examples/akakika-com/) — generated by running `build_palette_folder` on a screenshot of [akakika.com](https://akakika.com). Open [`examples/akakika-com/index.html`](examples/akakika-com/index.html) for the interactive guide, or `index.png` for a static preview of what one call produces.

## See also

- **`GUIDE.md`** — full operator's manual: when to use each tool, common workflows, troubleshooting, limitations.