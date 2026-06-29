// Suggest semantic roles for a palette based on lightness + saturation.
import type { Swatch } from "./color.js";

export type Purpose = "light_theme" | "dark_theme" | "data_viz" | "branding";

export function suggestRole(palette: Swatch[], purpose: Purpose): Swatch[] {
  if (palette.length === 0) return palette;

  const sorted = [...palette].sort((a, b) => a.hsl.l - b.hsl.l);

  const roles: string[] = [];
  switch (purpose) {
    case "light_theme":
      // Need a very light background, a dark text, mid tones for surface/border,
      // and the most saturated swatch as accent.
      roles.push("background", "text", "surface", "muted", "accent");
      break;
    case "dark_theme":
      // Need a dark background, light text, mid tones for surface/border, accent.
      roles.push("background", "text", "surface", "muted", "accent");
      break;
    case "data_viz":
      roles.push("series_1", "series_2", "series_3", "series_4", "series_5");
      break;
    case "branding":
      roles.push("primary", "secondary", "tertiary", "neutral", "accent");
      break;
  }

  const result: Swatch[] = [];
  if (purpose === "light_theme" || purpose === "dark_theme") {
    const bgIdx = purpose === "light_theme" ? sorted.length - 1 : 0;
    const textIdx = purpose === "light_theme" ? 0 : sorted.length - 1;
    const accentIdx = findMostSaturatedIndex(palette);
    const others = palette.map((_, i) => i).filter((i) => i !== bgIdx && i !== textIdx && i !== accentIdx);
    const fillOrder: (string | number)[] = [bgIdx, textIdx, others[0] ?? accentIdx, others[1] ?? accentIdx, accentIdx];
    result.push(...fillOrder.slice(0, palette.length).map((i, k) => ({ ...palette[i as number], role: roles[k] })));
  } else {
    palette.forEach((sw, i) => result.push({ ...sw, role: roles[i] ?? `color_${i + 1}` }));
  }
  return result;
}

function findMostSaturatedIndex(palette: Swatch[]): number {
  let best = 0, bestSat = -1;
  palette.forEach((sw, i) => { if (sw.hsl.s > bestSat) { bestSat = sw.hsl.s; best = i; } });
  return best;
}