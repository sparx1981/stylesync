import { converter, formatHex, type Oklch } from 'culori';

const toOklch = converter('oklch');

export interface ColorSample {
  color: string;
  weight: number;
}

export interface Cluster {
  centroid: Oklch;
  weight: number;
  members: Oklch[];
}

export function parseToOklch(cssColor: string): Oklch | undefined {
  const c = toOklch(cssColor);
  if (!c || Number.isNaN(c.l)) return undefined;
  return c;
}

export function clusterColors(samples: ColorSample[], kMin = 4, kMax = 8): Cluster[] {
  const points = samples
    .map((s) => ({ o: parseToOklch(s.color), w: s.weight }))
    .filter((p): p is { o: Oklch; w: number } => !!p.o && p.w > 0);

  if (points.length === 0) return [];

  const vectors = points.map((p) => toCartesian(p.o));

  let best: { k: number; assignment: number[]; centroids: number[][]; score: number } | undefined;

  const maxK = Math.min(kMax, points.length);
  for (let k = Math.min(kMin, maxK); k <= maxK; k++) {
    const { assignment, centroids } = weightedKMeans(
      vectors,
      points.map((p) => p.w),
      k
    );
    const score = silhouetteScore(vectors, assignment, k);
    if (!best || score > best.score) best = { k, assignment, centroids, score };
  }

  if (!best) return [];

  const clusters: Cluster[] = best.centroids.map(() => ({ centroid: { mode: 'oklch', l: 0, c: 0, h: 0 }, weight: 0, members: [] }));
  for (let i = 0; i < points.length; i++) {
    const ci = best.assignment[i];
    clusters[ci].members.push(points[i].o);
    clusters[ci].weight += points[i].w;
  }
  for (let i = 0; i < clusters.length; i++) {
    clusters[i].centroid = fromCartesian(best.centroids[i]);
  }

  return clusters.filter((c) => c.members.length > 0).sort((a, b) => b.weight - a.weight);
}

function toCartesian(o: Oklch): number[] {
  const c = o.c ?? 0;
  const h = ((o.h ?? 0) * Math.PI) / 180;
  return [o.l, c * Math.cos(h), c * Math.sin(h)];
}

function fromCartesian([l, x, y]: number[]): Oklch {
  const c = Math.sqrt(x * x + y * y);
  const h = (Math.atan2(y, x) * 180) / Math.PI;
  return { mode: 'oklch', l, c, h: h < 0 ? h + 360 : h };
}

function weightedKMeans(vectors: number[][], weights: number[], k: number, iterations = 25) {
  const centroids: number[][] = [vectors[Math.floor(Math.random() * vectors.length)]];
  while (centroids.length < k) {
    const dists = vectors.map((v) => Math.min(...centroids.map((c) => sqDist(v, c))));
    const totalWeight = dists.reduce((sum, d, i) => sum + d * weights[i], 0) || 1;
    let r = Math.random() * totalWeight;
    let chosen = vectors[0];
    for (let i = 0; i < vectors.length; i++) {
      r -= dists[i] * weights[i];
      if (r <= 0) {
        chosen = vectors[i];
        break;
      }
    }
    centroids.push(chosen);
  }

  let assignment = new Array(vectors.length).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    assignment = vectors.map((v) => nearestCentroid(v, centroids));
    const sums: number[][] = centroids.map(() => [0, 0, 0]);
    const wsum: number[] = centroids.map(() => 0);
    for (let i = 0; i < vectors.length; i++) {
      const ci = assignment[i];
      const w = weights[i];
      sums[ci][0] += vectors[i][0] * w;
      sums[ci][1] += vectors[i][1] * w;
      sums[ci][2] += vectors[i][2] * w;
      wsum[ci] += w;
    }
    for (let ci = 0; ci < centroids.length; ci++) {
      if (wsum[ci] > 0) {
        centroids[ci] = [sums[ci][0] / wsum[ci], sums[ci][1] / wsum[ci], sums[ci][2] / wsum[ci]];
      }
    }
  }

  return { assignment, centroids };
}

function nearestCentroid(v: number[], centroids: number[][]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = sqDist(v, centroids[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function sqDist(a: number[], b: number[]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function silhouetteScore(vectors: number[][], assignment: number[], k: number): number {
  if (k <= 1 || vectors.length <= k) return -1;
  let total = 0;
  let count = 0;
  const sampleSize = Math.min(vectors.length, 300);
  const step = Math.max(1, Math.floor(vectors.length / sampleSize));

  for (let i = 0; i < vectors.length; i += step) {
    const ci = assignment[i];
    let aSum = 0,
      aCount = 0;
    const bByCluster: Record<number, { sum: number; count: number }> = {};

    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      const d = Math.sqrt(sqDist(vectors[i], vectors[j]));
      const cj = assignment[j];
      if (cj === ci) {
        aSum += d;
        aCount++;
      } else {
        bByCluster[cj] ??= { sum: 0, count: 0 };
        bByCluster[cj].sum += d;
        bByCluster[cj].count++;
      }
    }

    const a = aCount > 0 ? aSum / aCount : 0;
    const bValues = Object.values(bByCluster)
      .filter((c) => c.count > 0)
      .map((c) => c.sum / c.count);
    if (bValues.length === 0) continue;
    const b = Math.min(...bValues);
    const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
    total += s;
    count++;
  }

  return count > 0 ? total / count : -1;
}

export function generateRamp(centroid: Oklch): Record<string, string> {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const baseC = centroid.c ?? 0;
  const h = centroid.h ?? 0;
  const ramp: Record<string, string> = {};

  for (const step of steps) {
    const t = step / 950;
    const l = 0.98 - t * 0.88;
    const chromaScale = 0.35 + 0.65 * Math.sin(Math.PI * (1 - Math.abs(step - 500) / 500) * 0.5) ** 0.5;
    const c = Math.max(0, Math.min(baseC * chromaScale, 0.37));
    ramp[String(step)] = formatHex({ mode: 'oklch', l: clamp01(l), c, h });
  }
  return ramp;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export { formatHex };
