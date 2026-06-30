# Brand mode vs UI mode — worked examples

## The decision rule

`brand_mode: "auto"` is the heuristic. It returns `"brand"` when:
- the detected window covers ≥ 95% of the resized image, AND
- `wallpaper.length === 0`

Otherwise it returns `"ui"`.

You can override with `brand_mode: "brand"` or `brand_mode: "ui"`.

## Examples from real tests

### Example 1: KIKA design system (brand sheet)

A full-window screenshot of the KIKA design-system page (light background, 6 swatches in a grid, no surrounding app chrome).

- **Window detection:** window fills the entire 601×352 image
- **Wallpaper:** 0 pixels (no app chrome around the page)
- **Auto-detect:** `brand_mode: "brand"`
- **Output:** `brand.css_vars`, `brand.tailwind`, `brand.figma`, etc. + `demo-inverse.*` (labelled "demo inverse — for visual reference only")
- **HTML heading:** "Brand palette" with banner explaining the demo inverse
- **Tag labels:** "brand" / "demo inverse"

This is the right call: a brand sheet has no "dark mode" in the same sense a UI does, so the deliverable makes clear that `demo-inverse.*` is for visual reference, not for shipping.

### Example 2: Vincent's task app (real app on cream wallpaper)

A dark-themed app screenshot on a cream-colored background.

- **Window detection:** window covers the app, wallpaper covers the rest
- **Wallpaper:** 4 colors detected (cream, mid-cream, accent_cream, accent_warm)
- **Auto-detect:** `brand_mode: "ui"`
- **Output:** `app-light.css_vars`, `app-dark.css_vars`, `wallpaper.*`
- **HTML heading:** "App theme"
- **Tag labels:** "matches source" / "derived"

This is the right call: the dark app has a real alternative light theme, and the cream wallpaper is genuinely a separate palette to consider for the rest of the OS.

### Example 3: JEZ V photograph (full-bleed artwork)

A photograph with no UI — wall, blue sky panel, pink flowers, "JEZ V" lettering.

- **Window detection:** window covers the entire image (everything is the "app" in the heuristic's eyes)
- **Wallpaper:** 0 pixels
- **Auto-detect:** `brand_mode: "brand"`
- **Output:** `brand.*` + `demo-inverse.*`

This is a borderline case. A photograph is neither a brand nor a UI — it's source material. The auto-detect treats it as a brand because the heuristic can't tell the difference. **If the user says "this is a photo, not a brand", pass `brand_mode: "ui"`.** That'll give you `app-{light,dark}.*` exports with both themes being meaningful "this image inverted" vs "this image as-is".

### Example 4: Phone mockup on neutral page (IMG_0396)

A phone mockup floating on a flat light-grey background.

- **Window detection:** window covers the entire image (no separate app region in the heuristic's eyes)
- **Wallpaper:** 0 pixels
- **Auto-detect:** `brand_mode: "brand"`
- **Output:** `brand.*` + `demo-inverse.*`

The phone mockup's dominant color is the off-white background (`#D8D8D8`), so the "brand" extracted is the page chrome, not the phone's actual UI. **If the user wants the phone's UI palette, set `brand_mode: "ui"`** to force the inverse-as-real-theme path.

## When to override

| Situation | Override |
|---|---|
| User says "this is a brand" but auto-detected "ui" | `brand_mode: "brand"` |
| User says "I want a real dark mode, not just a demo" | `brand_mode: "ui"` |
| Source is a photograph or artwork | `brand_mode: "ui"` (so the inverse is a real alternative) |
| Source is a mockup on a neutral page | `brand_mode: "ui"` (so the inverse is meaningful) |
| Source is a brand sheet | `brand_mode: "brand"` (or trust auto) |
| Source is a real app on wallpaper | (trust auto) |

## Why the inverse matters

A brand's "dark mode" is a design problem, not an inversion problem. A designer looking at the brand wants to see what the brand looks like inverted — useful as a *reference*, but the actual dark mode needs human design choices. So in brand mode, the inverse is clearly labelled "demo inverse" and the deliverable explicitly tells readers to use `brand.*` for design tokens.

A UI app's dark mode is a real, shippable alternative theme. The user genuinely wants both `app-light.*` and `app-dark.*` exports that they can drop into a component library. So in UI mode, both themes are presented as real alternatives.
