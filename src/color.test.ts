import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  contrastRatio,
  deltaE2000,
  wcagLevel,
} from "./color.js";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#1a2b3c")).toEqual({ r: 26, g: 43, b: 60 });
  });

  it("accepts hex without a leading #", () => {
    expect(hexToRgb("ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("expands 3-digit shorthand", () => {
    expect(hexToRgb("#abc")).toEqual(hexToRgb("#aabbcc"));
    expect(hexToRgb("fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("throws on invalid input", () => {
    expect(() => hexToRgb("#12")).toThrow();
    expect(() => hexToRgb("#xyzxyz")).toThrow();
    expect(() => hexToRgb("not-a-color")).toThrow();
  });
});

describe("rgbToHex", () => {
  it("round-trips with hexToRgb", () => {
    for (const hex of ["#000000", "#ffffff", "#1a2b3c", "#ff8800"]) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    }
  });

  it("clamps and rounds out-of-range channels", () => {
    expect(rgbToHex({ r: -10, g: 300, b: 127.6 })).toBe("#00ff80");
  });
});

describe("rgb/hsl round trip", () => {
  it("recovers the original rgb within rounding error", () => {
    for (const rgb of [
      { r: 10, g: 20, b: 30 },
      { r: 200, g: 100, b: 50 },
      { r: 128, g: 128, b: 128 },
      { r: 255, g: 0, b: 0 },
    ]) {
      const back = hslToRgb(rgbToHsl(rgb));
      expect(back.r).toBeCloseTo(rgb.r, 0);
      expect(back.g).toBeCloseTo(rgb.g, 0);
      expect(back.b).toBeCloseTo(rgb.b, 0);
    }
  });

  it("reports zero saturation for grays", () => {
    expect(rgbToHsl({ r: 100, g: 100, b: 100 }).s).toBe(0);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it("is 1 for identical colors and symmetric", () => {
    const a = { r: 50, g: 80, b: 120 };
    const b = { r: 200, g: 30, b: 90 };
    expect(contrastRatio(a, a)).toBeCloseTo(1, 5);
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });
});

describe("wcagLevel", () => {
  it("applies normal-text thresholds", () => {
    expect(wcagLevel(21)).toBe("AAA");
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(4.49)).toBe("Fail");
    expect(wcagLevel(3)).toBe("Fail");
  });

  it("applies large-text thresholds", () => {
    expect(wcagLevel(4.5, true)).toBe("AAA");
    expect(wcagLevel(3, true)).toBe("AA");
    expect(wcagLevel(2.9, true)).toBe("Fail");
  });
});

describe("deltaE2000", () => {
  it("is 0 for identical colors", () => {
    expect(deltaE2000({ r: 120, g: 60, b: 200 }, { r: 120, g: 60, b: 200 })).toBeCloseTo(0, 5);
  });

  it("is positive and grows with perceptual distance", () => {
    const ref = { r: 255, g: 0, b: 0 };
    const near = deltaE2000(ref, { r: 250, g: 10, b: 5 });
    const far = deltaE2000(ref, { r: 0, g: 0, b: 255 });
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });
});
