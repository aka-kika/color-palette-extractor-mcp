// Compare two palettes via perceptual ΔE2000.
import { hexToRgb, deltaE2000, type RGB } from "./color.js";

export type PairwiseDiff = {
  a: string;
  b: string;
  deltaE: number;
  similarity: number; // 0–1, higher = closer
};

export function comparePalettes(aHexes: string[], bHexes: string[]): {
  pairs: PairwiseDiff[];
  meanDeltaE: number;
  meanSimilarity: number;
} {
  const a = aHexes.map(hexToRgb);
  const b = bHexes.map(hexToRgb);

  // For each color in A, find the closest color in B.
  const pairs: PairwiseDiff[] = [];
  for (let i = 0; i < a.length; i++) {
    let best: { idx: number; d: number } = { idx: 0, d: Infinity };
    for (let j = 0; j < b.length; j++) {
      const d = deltaE2000(a[i], b[j]);
      if (d < best.d) best = { idx: j, d };
    }
    pairs.push({
      a: aHexes[i],
      b: bHexes[best.idx],
      deltaE: round(best.d, 2),
      similarity: round(1 - Math.min(best.d, 100) / 100, 3),
    });
  }

  const meanDeltaE = pairs.reduce((acc, p) => acc + p.deltaE, 0) / pairs.length;
  const meanSimilarity = pairs.reduce((acc, p) => acc + p.similarity, 0) / pairs.length;

  return {
    pairs,
    meanDeltaE: round(meanDeltaE, 2),
    meanSimilarity: round(meanSimilarity, 3),
  };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

void ({} as RGB); // keep import intent visible