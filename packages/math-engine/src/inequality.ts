import { CustomFunction } from './types';
import { parse } from './parser';
import { evaluateAST } from './evaluator';
import { Point2D, GraphWindow } from './adaptive';

// ── Types ──────────────────────────────────────────────────────────────────

export type InequalityOp = '<' | '<=' | '>' | '>=';

export interface InequalityRegion {
  /** Grid dimensions */
  cols: number;
  rows: number;
  /** World bounds this mask was computed for */
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  /**
   * Binary mask in CANVAS order: row 0 = top of screen (yMax), row (rows-1) = bottom (yMin).
   * mask[row * cols + col] = 1 if that cell satisfies the inequality, else 0.
   */
  mask: Uint8Array;
  /**
   * Boundary segments (pairs of world-coordinate points) for rendering the edge curve.
   * Drawn as dashed line for strict (<, >) and solid for non-strict (<=, >=).
   */
  boundary: Array<[Point2D, Point2D]>;
  op: InequalityOp;
  isStrict: boolean;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Splits a formula string on the first inequality operator.
 * Handles <=, >=, <, > — must check two-char operators first.
 */
function parseInequalityFormula(
  formula: string
): { lhs: string; rhs: string; op: InequalityOp } | null {
  // Regex: lazily match lhs, then operator, then rhs
  // Order matters: check <= and >= before < and >
  const match = formula.match(/^([\s\S]+?)\s*(<=|>=|<|>)\s*([\s\S]+)$/);
  if (!match) return null;
  return {
    lhs: match[1].trim(),
    rhs: match[3].trim(),
    op: match[2] as InequalityOp,
  };
}

function satisfiesOp(diff: number, op: InequalityOp): boolean {
  switch (op) {
    case '<':  return diff < 0;
    case '<=': return diff <= 0;
    case '>':  return diff > 0;
    case '>=': return diff >= 0;
  }
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Evaluates an inequality expression over a viewport grid.
 *
 * Supports all forms:
 *  - Explicit:  y > ln(x),  y <= x^2,  y >= -x + 1
 *  - Implicit:  x^2 + y^2 < 9,  x^2/4 + y^2/9 >= 1
 *  - Vertical:  x > 2,  x <= -1
 *  - Mixed:     sqrt(x) + y^2 > 4
 *
 * @param formula  The inequality string, e.g. "x^2 + y^2 < 9"
 * @param window   Current viewport bounds
 * @param customFunctions  User-defined function definitions
 * @param variables  Current slider variable values
 * @param resolution  Grid resolution (default 300 — 300×300 cells)
 */
export function evaluateInequality(
  formula: string,
  window: GraphWindow,
  customFunctions: Record<string, CustomFunction> = {},
  variables: Record<string, number> = {},
  resolution = 300
): InequalityRegion | null {
  const parsed = parseInequalityFormula(formula);
  if (!parsed) return null;

  const { lhs, rhs, op } = parsed;
  const isStrict = op === '<' || op === '>';

  let lhsAst, rhsAst;
  try {
    lhsAst = parse(lhs);
    rhsAst = parse(rhs);
  } catch {
    return null;
  }

  const cols = resolution;
  const rows = resolution;
  const { xMin, xMax, yMin, yMax } = window;
  const dxCell = (xMax - xMin) / cols;
  const dyCell = (yMax - yMin) / rows;

  // ── Step 1: Evaluate diff = lhs - rhs at each grid point ──────────────────
  // Grid is in CANVAS order: row 0 = yMax (top), row rows-1 = yMin (bottom)
  const values = new Float32Array(rows * cols);

  for (let row = 0; row < rows; row++) {
    // Canvas row 0 = top = yMax; increase row → decrease y
    const y = yMax - (row + 0.5) * dyCell;
    for (let col = 0; col < cols; col++) {
      const x = xMin + (col + 0.5) * dxCell;
      const vars = { x, y, ...variables };
      const lv = evaluateAST(lhsAst, vars, customFunctions) as number;
      const rv = evaluateAST(rhsAst, vars, customFunctions) as number;
      values[row * cols + col] = lv - rv;
    }
  }

  // ── Step 2: Build binary mask ──────────────────────────────────────────────
  const mask = new Uint8Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    const v = values[i];
    mask[i] = isFinite(v) && satisfiesOp(v, op) ? 1 : 0;
  }

  // ── Step 3: Extract boundary segments via marching-squares ────────────────
  // We look at the zero-crossing of 'values' (where lhs - rhs = 0).
  // For each 2×2 cell quad, we find edge crossings via linear interpolation.
  const boundary: Array<[Point2D, Point2D]> = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const v00 = values[r * cols + c];           // top-left
      const v10 = values[r * cols + c + 1];       // top-right
      const v01 = values[(r + 1) * cols + c];     // bottom-left
      const v11 = values[(r + 1) * cols + c + 1]; // bottom-right

      if (!isFinite(v00) || !isFinite(v10) || !isFinite(v01) || !isFinite(v11)) continue;

      // World coords of the quad corners
      // row r → y = yMax - r * dyCell   (top edge)
      // row r+1 → y = yMax - (r+1)*dyCell (bottom edge)
      const wx0 = xMin + c * dxCell;
      const wx1 = xMin + (c + 1) * dxCell;
      const wy0 = yMax - r * dyCell;       // top y (larger)
      const wy1 = yMax - (r + 1) * dyCell; // bottom y (smaller)

      const crossings: Point2D[] = [];

      // Top edge: from (c,r) to (c+1,r), y = wy0
      if ((v00 > 0) !== (v10 > 0)) {
        const t = v00 / (v00 - v10);
        crossings.push({ x: wx0 + t * dxCell, y: wy0 });
      }
      // Bottom edge: from (c,r+1) to (c+1,r+1), y = wy1
      if ((v01 > 0) !== (v11 > 0)) {
        const t = v01 / (v01 - v11);
        crossings.push({ x: wx0 + t * dxCell, y: wy1 });
      }
      // Left edge: from (c,r) to (c,r+1), x = wx0; y goes wy0→wy1
      if ((v00 > 0) !== (v01 > 0)) {
        const t = v00 / (v00 - v01);
        crossings.push({ x: wx0, y: wy0 + t * (wy1 - wy0) });
      }
      // Right edge: from (c+1,r) to (c+1,r+1), x = wx1; y goes wy0→wy1
      if ((v10 > 0) !== (v11 > 0)) {
        const t = v10 / (v10 - v11);
        crossings.push({ x: wx1, y: wy0 + t * (wy1 - wy0) });
      }

      if (crossings.length >= 2) {
        boundary.push([crossings[0], crossings[1]]);
        // Saddle case: 4 crossings (rare but possible)
        if (crossings.length === 4) {
          boundary.push([crossings[2], crossings[3]]);
        }
      }
    }
  }

  return { cols, rows, xMin, xMax, yMin, yMax, mask, boundary, op, isStrict };
}

/**
 * Detects whether a formula string contains an inequality operator.
 * Returns the operator if found, null otherwise.
 */
export function detectInequalityOp(formula: string): InequalityOp | null {
  // Check <= and >= before < and >
  if (formula.includes('<=')) return '<=';
  if (formula.includes('>=')) return '>=';
  if (formula.includes('<'))  return '<';
  if (formula.includes('>'))  return '>';
  return null;
}
