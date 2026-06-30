# Output folder shape

Every `build_palette_folder` invocation creates a folder named `{stem}_{timestamp}_{hash}`:

```
{stem}_{ISO timestamp}_{8-char sha256}/
```

- `stem` comes from the source filename, lowercased, non-alphanumerics replaced with `-`
- `timestamp` is `2026-06-29_23-41-43` (date + time, no colons)
- `hash` is the first 8 chars of the SHA-256 of the source file

## Files inside (UI mode)

```
{inbox}_2026-06-29_13-10-00_a1b2c3d4/
├── README.md                       ← markdown summary
├── index.html                      ← interactive design system guide
├── index.png                       ← headless Chrome screenshot of guide
├── source.{ext}                    ← original image (copied)
├── app-window-cropped.png          ← detected app region
├── preview-app-{light|dark}.png    ← swatch grid
├── preview-app-pair-light.png      ← primary vs secondary, on light bg
├── preview-app-pair-dark.png       ← primary vs secondary, on dark bg
├── preview-app-pair.png            ← static fallback (light variant)
├── preview-wallpaper.png           ← omitted when wallpaper.length === 0
├── preview-all.png                 ← combined view
└── exports/
    ├── app-{light|dark}.{css_vars,scss,tailwind,json,figma}
    └── wallpaper.{css_vars,scss,tailwind,json,figma}
```

## Files inside (BRAND mode)

```
{kika}_2026-06-29_13-10-00_f4c24ac4/
├── README.md                       ← markdown summary with banner explaining the mode
├── index.html                      ← "Brand palette" heading, demo inverse banner
├── index.png
├── source.{ext}
├── app-window-cropped.png
├── preview-brand.png               ← swatch grid (BRAND)
├── preview-demo-inverse.png        ← swatch grid (DEMO INVERSE — for reference only)
├── preview-app-pair-light.png
├── preview-app-pair-dark.png
├── preview-app-pair.png
├── preview-wallpaper.png           ← omitted when wallpaper.length === 0
├── preview-all.png
└── exports/
    ├── brand.{css_vars,scss,tailwind,json,figma}              ← the tokens to ship
    ├── demo-inverse.{css_vars,scss,tailwind,json,figma}       ← preview only, NOT a UI theme
    └── wallpaper.{css_vars,scss,tailwind,json,figma}
```

## Conditional rendering

Three things are omitted when their trigger is empty:
- The `Wallpaper (excluded from app)` section in `index.html` is omitted when `wallpaper.length === 0`
- `preview-wallpaper.png` is only written when wallpaper is non-empty
- `app-window-cropped.png` is always written (the window region, even if it fills the whole image)

## Export format details

| Format | File ext | Example |
|---|---|---|
| CSS variables | `.css_vars` | `--bg: #f7f7f7; --text: #1a1d27;` |
| SCSS variables | `.scss` | `$bg: #f7f7f7; $text: #1a1d27;` |
| Tailwind config | `.tailwind` | `'brand': { 'bg': '#f7f7f7', 'text': '#1a1d27' }` |
| JSON | `.json` | `{ "brand": { "bg": "#f7f7f7", "text": "#1a1d27" } }` |
| Figma tokens | `.figma` | `{ "brand": { "bg": { "value": "#f7f7f7", "type": "color" } } }` |
| Adobe Swatch Exchange (whole palette as one file) | `.ase` | binary |

## How to share the result

- **PR comment:** paste `index.png` and the markdown `README.md` excerpt
- **Slack:** share the folder path; team members can open `index.html` locally
- **Live preview:** the `index.html` is fully self-contained; open it from the file system (it has inline CSS, no external deps)
- **CI:** the `index.png` is what reviewers will see most often; make sure it renders correctly before tagging a release

## The "open this file to get the full experience" mental model

The single most important file in the deliverable is `index.html`. It's a self-contained page with:
- A working LIGHT/DARK toggle in the header
- The page chrome that swaps with the toggle (light theme = off-white, dark theme = deep navy)
- The pair preview that swaps (light bg / dark bg)
- The "Brand palette" or "App theme" section with both palettes and their swatches
- The accessibility table with WCAG ratios
- The "Wallpaper (excluded from app)" section (when applicable)

Open it in any browser. Click the toggle. That's the experience.
