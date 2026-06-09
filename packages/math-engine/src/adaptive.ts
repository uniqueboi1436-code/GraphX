import { Expr, CustomFunction } from './types';
import { evaluateAST } from './evaluator';
import { parse } from './parser';

export interface Point2D {
  x: number;
  y: number;
}

export interface GraphWindow {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const BLOW_UP_FACTOR = 20;

function isDiscontinuity(
  evalAt: (x: number) => number,
  xPrev: number,
  yPrev: number,
  xCurr: number,
  yCurr: number,
  visibleHeight: number
): boolean {
  if (!isFinite(yPrev) || !isFinite(yCurr)) return true;

  const threshold = visibleHeight * BLOW_UP_FACTOR;
  const dy = Math.abs(yCurr - yPrev);

  if (dy > threshold && Math.sign(yCurr) !== Math.sign(yPrev)) return true;

  const ym = evalAt((xPrev + xCurr) / 2);
  if (!isFinite(ym)) return true;

  // Jump discontinuity detection (floor, ceil, sign, piecewise, etc.)
  // The midpoint interpolation error for a true jump is always ~0.5, regardless of
  // zoom level. Only guard against division-by-zero with an absolute epsilon.
  if (dy > 1e-12) {
    const err_y = Math.abs(ym - (yPrev + yCurr) / 2);
    const err_y_norm = err_y / dy;
    if (err_y_norm > 0.48) {
      return true;
    }
  }

  if (Math.sign(yPrev) !== Math.sign(yCurr)) {
    const t = (0 - 1/yPrev) / (1/yCurr - 1/yPrev);
    if (t > 0 && t < 1 && yPrev !== 0 && yCurr !== 0 && ym !== 0) {
      const err_y = Math.abs(ym - (yPrev + yCurr) / 2);
      const dyInv = Math.abs(1/yCurr - 1/yPrev);
      if (dyInv !== 0 && dy !== 0) {
        const err_inv = Math.abs(1/ym - (1/yPrev + 1/yCurr) / 2);
        if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
          return true;
        }
      }
    }
  } else {
    const absInvM = Math.abs(1/ym);
    const absInv0 = Math.abs(1/yPrev);
    const absInv1 = Math.abs(1/yCurr);
    
    if (absInvM < absInv0 && absInvM < absInv1 && yPrev !== 0 && yCurr !== 0 && ym !== 0) {
      const err_y = Math.abs(ym - (yPrev + yCurr) / 2);
      const dyInv = Math.abs(1/yCurr - 1/yPrev);
      if (dyInv !== 0 && dy !== 0) {
        const err_inv = Math.abs(1/ym - (1/yPrev + 1/yCurr) / 2);
        if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
          return true;
        }
      }
    }
  }

  return false;
}

function findAsymptoteX(
  evalAt: (x: number) => number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visibleHeight: number,
  iterations = 12
): number {
  let lo = x0, hi = x1;
  let yLo = y0;

  for (let i = 0; i < iterations; i++) {
    const xm = (lo + hi) / 2;
    const ym = evalAt(xm);

    const isInvalid = (y: number) => isNaN(y) || !isFinite(y);

    if (isInvalid(yLo)) {
       if (isInvalid(ym)) {
          lo = xm;
          yLo = ym;
       } else {
          hi = xm;
       }
    } else if (isInvalid(y1)) {
       if (isInvalid(ym)) {
          hi = xm;
       } else {
          lo = xm;
          yLo = ym;
       }
    } else {
      if (isDiscontinuity(evalAt, lo, yLo, xm, ym, visibleHeight)) {
        hi = xm;
      } else {
        lo = xm;
        yLo = ym;
      }
    }
  }
  
  if (isNaN(y0) || !isFinite(y0)) return hi;
  if (isNaN(y1) || !isFinite(y1)) return lo;
  return (lo + hi) / 2;
}

export function evaluateRange(
  expr: string | Expr,
  window: GraphWindow,
  customFunctions: Record<string, CustomFunction> = {},
  variables: Record<string, number> = {}
): Point2D[] {
  const ast = typeof expr === 'string' ? parse(expr) : expr;
  const evalAt = (x: number): number => evaluateAST(ast, { x, ...variables }, customFunctions) as number;

  const { xMin, xMax, yMin, yMax } = window;
  const width  = xMax - xMin;
  const height = yMax - yMin;

  const scanSamples = 20;
  let zeroCrossings = 0;
  let lastScanY = evalAt(xMin);

  for (let i = 1; i <= scanSamples; i++) {
    const x = xMin + (i / scanSamples) * width;
    const y = evalAt(x);
    if (isFinite(lastScanY) && isFinite(y)) {
      if (Math.sign(y) !== Math.sign(lastScanY) && Math.sign(lastScanY) !== 0) {
        zeroCrossings++;
      }
    }
    lastScanY = y;
  }

  const estimatedFrequency = zeroCrossings / width;
  const steps = Math.min(5000, Math.max(500, Math.floor(estimatedFrequency * 20 * width)));
  const initialStep = width / steps;

  const rawPoints: Point2D[] = [];

  for (let i = 0; i <= steps; i++) {
    const x0 = xMin + i * initialStep;
    const y0 = evalAt(x0);
    rawPoints.push({ x: x0, y: y0 });

    if (i < steps) {
      const x1 = xMin + (i + 1) * initialStep;
      const y1 = evalAt(x1);
      
      const dx1 = initialStep / width;
      const dy1 = (y1 - y0) / height;
      const angle = Math.atan2(dy1, dx1);
      
      adaptiveSample(x0, y0, x1, y1, rawPoints, 0, evalAt, angle, width, height);
    }
  }

  rawPoints.sort((a, b) => a.x - b.x);

  const clampY = (y: number): number => {
    if (!isFinite(y) || isNaN(y)) return NaN;
    const limit = height * BLOW_UP_FACTOR;
    if (y > yMax + limit || y < yMin - limit) return NaN;
    return y;
  };

  const finalPoints: Point2D[] = [];

  for (let i = 0; i < rawPoints.length; i++) {
    const raw = rawPoints[i];

    if (i === 0) {
      finalPoints.push({ x: raw.x, y: clampY(raw.y) });
      continue;
    }

    const prevRaw = rawPoints[i - 1];

    if (isDiscontinuity(evalAt, prevRaw.x, prevRaw.y, raw.x, raw.y, height)) {
      const xBreak = findAsymptoteX(evalAt, prevRaw.x, prevRaw.y, raw.x, raw.y, height);
      const yBreak = evalAt(xBreak);

      if (!isFinite(prevRaw.y) && isFinite(yBreak)) {
        finalPoints.push({ x: xBreak, y: clampY(yBreak) });
      } else if (!isFinite(raw.y) && isFinite(yBreak)) {
        finalPoints.push({ x: xBreak, y: clampY(yBreak) });
        finalPoints.push({ x: xBreak, y: NaN });
      } else {
        finalPoints.push({ x: xBreak, y: NaN });
      }
    }

    finalPoints.push({ x: raw.x, y: clampY(raw.y) });
  }

  return finalPoints;
}

function adaptiveSample(
  x0: number, y0: number,
  x1: number, y1: number,
  points: Point2D[],
  depth: number,
  evalAt: (x: number) => number,
  prevAngle: number,
  width: number,
  height: number
) {
  const MAX_DEPTH = 6;
  if (depth >= MAX_DEPTH) return;

  const xm = (x0 + x1) / 2;
  const ym = evalAt(xm);

  let shouldSubdivide = false;
  const isInvalid = (y: number) => isNaN(y) || !isFinite(y);

  if (isInvalid(y0) && isInvalid(y1) && isInvalid(ym)) {
    points.push({ x: xm, y: ym });
    return;
  }

  if (isInvalid(y0) !== isInvalid(y1) || isInvalid(y0) !== isInvalid(ym)) {
    shouldSubdivide = true;
  }

  if (!shouldSubdivide) {
    const dx1 = (xm - x0) / width;
    const dy1 = (ym - y0) / height;
    const angle1 = Math.atan2(dy1, dx1);
    
    const dx2 = (x1 - xm) / width;
    const dy2 = (y1 - ym) / height;
    const angle2 = Math.atan2(dy2, dx2);

    if (Math.abs(angle1 - prevAngle) > 0.05 || Math.abs(angle2 - angle1) > 0.05) {
      shouldSubdivide = true;
    }

    if (!shouldSubdivide && y0 !== 0 && y1 !== 0 && ym !== 0) {
      const dy = Math.abs(y1 - y0);
      if (dy !== 0) {
        if (Math.sign(y0) !== Math.sign(y1)) {
          const t = (0 - 1/y0) / (1/y1 - 1/y0);
          if (t > 0 && t < 1) {
            const err_y = Math.abs(ym - (y0 + y1) / 2);
            const dyInv = Math.abs(1/y1 - 1/y0);
            if (dyInv !== 0) {
              const err_inv = Math.abs(1/ym - (1/y0 + 1/y1) / 2);
              if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
                shouldSubdivide = true;
              }
            }
          }
        } else {
          const absInvM = Math.abs(1/ym);
          const absInv0 = Math.abs(1/y0);
          const absInv1 = Math.abs(1/y1);
          if (absInvM < absInv0 && absInvM < absInv1) {
            const err_y = Math.abs(ym - (y0 + y1) / 2);
            const dyInv = Math.abs(1/y1 - 1/y0);
            if (dyInv !== 0) {
              const err_inv = Math.abs(1/ym - (1/y0 + 1/y1) / 2);
              if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
                shouldSubdivide = true;
              }
            }
          }
        }
      }
    }

    if (shouldSubdivide) {
      points.push({ x: xm, y: ym });
      adaptiveSample(x0, y0, xm, ym, points, depth + 1, evalAt, angle1, width, height);
      adaptiveSample(xm, ym, x1, y1, points, depth + 1, evalAt, angle2, width, height);
    }
  } else {
    points.push({ x: xm, y: ym });
    adaptiveSample(x0, y0, xm, ym, points, depth + 1, evalAt, prevAngle, width, height);
    adaptiveSample(xm, ym, x1, y1, points, depth + 1, evalAt, prevAngle, width, height);
  }
}
