import type { Point2D } from './adaptive';

export interface POI {
  x: number;
  y: number;
  type: 'root' | 'y-intercept' | 'extrema' | 'intersection' | 'hover';
  label?: string; // Optional label or formatted fraction
}

const TOLERANCE = 1e-6;
const MAX_ITER = 50;

// Bisection method for finding root of f(x) = 0 between a and b
function bisection(f: (x: number) => number, a: number, b: number): number | null {
  let fa = f(a);
  let fb = f(b);
  if (Math.sign(fa) === Math.sign(fb)) return null;

  let left = a;
  let right = b;
  let mid = (left + right) / 2;

  for (let i = 0; i < MAX_ITER; i++) {
    mid = (left + right) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < TOLERANCE || (right - left) / 2 < TOLERANCE) {
      return mid;
    }
    if (Math.sign(fmid) === Math.sign(fa)) {
      left = mid;
      fa = fmid;
    } else {
      right = mid;
      fb = fmid;
    }
  }
  return mid;
}

export function findRoots(points: Point2D[], evalFn: (x: number) => number): POI[] {
  const pois: POI[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!isFinite(p1.y) || !isFinite(p2.y)) continue;

    if (Math.sign(p1.y) !== Math.sign(p2.y) && Math.sign(p1.y) !== 0) {
      const rootX = bisection(evalFn, p1.x, p2.x);
      if (rootX !== null) {
        pois.push({ x: rootX, y: 0, type: 'root' });
      }
    } else if (Math.abs(p1.y) < TOLERANCE) {
      // Direct hit
      if (pois.length === 0 || Math.abs(pois[pois.length - 1].x - p1.x) > TOLERANCE) {
         pois.push({ x: p1.x, y: 0, type: 'root' });
      }
    }
  }
  return pois;
}

export function findExtrema(points: Point2D[], evalFn: (x: number) => number): POI[] {
  const pois: POI[] = [];
  const h = 1e-5;
  const evalPrime = (x: number) => (evalFn(x + h) - evalFn(x - h)) / (2 * h);

  let prevPrime = evalPrime(points[0]?.x ?? 0);

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!isFinite(p.y)) {
      prevPrime = evalPrime(p.x);
      continue;
    }

    const currPrime = evalPrime(p.x);
    if (isFinite(prevPrime) && isFinite(currPrime) && Math.sign(prevPrime) !== Math.sign(currPrime) && Math.sign(prevPrime) !== 0) {
      const extremaX = bisection(evalPrime, points[i - 1].x, p.x);
      if (extremaX !== null) {
        const y = evalFn(extremaX);
        if (isFinite(y)) {
          pois.push({ x: extremaX, y, type: 'extrema' });
        }
      }
    }
    prevPrime = currPrime;
  }
  return pois;
}

export function findIntersections(points: Point2D[], evalFn1: (x: number) => number, evalFn2: (x: number) => number): POI[] {
  const pois: POI[] = [];
  const diffFn = (x: number) => evalFn1(x) - evalFn2(x);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const d1 = diffFn(p1.x);
    const d2 = diffFn(p2.x);
    
    if (!isFinite(d1) || !isFinite(d2)) continue;

    if (Math.sign(d1) !== Math.sign(d2) && Math.sign(d1) !== 0) {
      const intersectX = bisection(diffFn, p1.x, p2.x);
      if (intersectX !== null) {
        const y = evalFn1(intersectX);
        if (isFinite(y)) {
          pois.push({ x: intersectX, y, type: 'intersection' });
        }
      }
    } else if (Math.abs(d1) < TOLERANCE) {
      if (pois.length === 0 || Math.abs(pois[pois.length - 1].x - p1.x) > TOLERANCE) {
         pois.push({ x: p1.x, y: evalFn1(p1.x), type: 'intersection' });
      }
    }
  }
  return pois;
}

export function getYIntercept(evalFn: (x: number) => number, xMin: number, xMax: number): POI | null {
  if (0 >= xMin && 0 <= xMax) {
    const y = evalFn(0);
    if (isFinite(y)) {
      return { x: 0, y, type: 'y-intercept' };
    }
  }
  return null;
}

export function formatFraction(val: number): string {
  if (Math.abs(val) < 1e-10) return '0';
  if (Math.abs(Math.round(val) - val) < 1e-6) return Math.round(val).toString();

  const maxDenominator = 1000;
  for (let d = 2; d <= maxDenominator; d++) {
    const n = Math.round(val * d);
    if (Math.abs(val - n / d) < 1e-6) {
      // Simplify fraction
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(Math.abs(n), d);
      return `${n / divisor}/${d / divisor}`;
    }
  }
  
  // Format standard decimals (max 4 significant figures / decimal places)
  // Return fixed decimals, e.g. 0.3333 -> 0.3333
  // Strip trailing zeros
  const rounded = parseFloat(val.toFixed(4));
  return rounded.toString();
}

export function formatCoordinates(x: number, y: number): string {
  return `(${formatFraction(x)}, ${formatFraction(y)})`;
}
