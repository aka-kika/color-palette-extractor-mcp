// Color harmony schemes — generate palettes from a seed via HSL rotations.
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, type HSL } from "./color.js";

export type Scheme = "analogous" | "triadic" | "complementary" | "split" | "tetradic" | "monochrome";

const rotations: Record<Scheme, number[]> = {
  analogous: [-30, -15, 0, 15, 30],
  triadic: [0, 120, 240, 60, 180],
  complementary: [0, 180, -15, 15, 150],
  split: [0, 150, 210, -10, 30],
  tetradic: [0, 90, 180, 270, 45],
  monochrome: [0, 0, 0, 0, 0],
};

export function harmonize(seedHex: string, scheme: Scheme): string[] {
  const rgb = hexToRgb(seedHex);
  const hsl = rgbToHsl(rgb);
  const rots = rotations[scheme];

  return rots.map((rot, i) => {
    let s = hsl.s, l = hsl.l;
    if (scheme === "monochrome") {
      // Vary lightness, keep hue + saturation similar.
      l = Math.min(90, Math.max(10, hsl.l + (i - 2) * 15));
      s = Math.min(100, hsl.s + (i % 2 === 0 ? 0 : 5));
    } else {
      // Slight saturation boost on alternates for visual variety.
      if (i % 2 === 1) s = Math.min(100, hsl.s * 1.1);
    }
    const next: HSL = { h: hsl.h + rot, s, l };
    return rgbToHex(hslToRgb(next));
  });
}