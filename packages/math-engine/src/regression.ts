/** Gauss-Jordan elimination on an augmented matrix to solve Ax = b */
function gaussElim(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let p = 0; p < n; p++) {
    // Partial pivoting
    let maxRow = p;
    for (let i = p + 1; i < n; i++) {
      if (Math.abs(M[i][p]) > Math.abs(M[maxRow][p])) maxRow = i;
    }
    [M[p], M[maxRow]] = [M[maxRow], M[p]];
    if (Math.abs(M[p][p]) < 1e-14) continue;

    // Eliminate all other rows
    for (let i = 0; i < n; i++) {
      if (i === p) continue;
      const f = M[i][p] / M[p][p];
      for (let j = p; j <= n; j++) M[i][j] -= f * M[p][j];
    }
  }
  return M.map((row, i) => row[n] / (Math.abs(row[i]) < 1e-14 ? 1e-14 : row[i]));
}

function rSq(ys: number[], yPred: number[]): number {
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const ssTot = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - yPred[i]) ** 2, 0);
  return ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

function f(n: number, digits = 4): string {
  const v = parseFloat(n.toFixed(digits));
  return String(v);
}

export type RegressionType = 'linear' | 'quadratic' | 'exponential' | 'power' | 'sinusoidal';

export interface RegressionResult {
  type: RegressionType;
  params: number[];
  equation: string;
  /** Parseable formula string for graphing (variables: x) */
  formula: string;
  r2: number;
}

// ── Linear  y = mx + b ─────────────────────────────────────────────────────
export function fitLinear(xs: number[], ys: number[]): RegressionResult {
  const n = xs.length;
  const sx  = xs.reduce((a, x) => a + x, 0);
  const sy  = ys.reduce((a, y) => a + y, 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);

  const [b, m] = gaussElim([[n, sx], [sx, sx2]], [sy, sxy]);
  const yPred  = xs.map(x => m * x + b);
  const r2     = rSq(ys, yPred);

  const sign = b >= 0 ? '+' : '-';
  return {
    type: 'linear',
    params: [m, b],
    equation: `y = ${f(m)}x ${sign} ${f(Math.abs(b))}`,
    formula: `${m}*x+(${b})`,
    r2,
  };
}

// ── Quadratic  y = ax² + bx + c ────────────────────────────────────────────
export function fitQuadratic(xs: number[], ys: number[]): RegressionResult {
  const n = xs.length;
  let sx1=0, sx2=0, sx3=0, sx4=0, sy=0, sxy=0, sx2y=0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    const x2 = x*x, x3 = x2*x, x4 = x3*x;
    sx1 += x; sx2 += x2; sx3 += x3; sx4 += x4;
    sy  += y; sxy  += x*y; sx2y += x2*y;
  }

  const [a, b, c] = gaussElim(
    [[sx4, sx3, sx2], [sx3, sx2, sx1], [sx2, sx1, n]],
    [sx2y, sxy, sy],
  );

  const yPred = xs.map(x => a*x*x + b*x + c);
  const r2    = rSq(ys, yPred);

  return {
    type: 'quadratic',
    params: [a, b, c],
    equation: `y = ${f(a)}x² + ${f(b)}x + ${f(c)}`,
    formula: `(${a})*x^2+(${b})*x+(${c})`,
    r2,
  };
}

// ── Exponential  y = a·bˣ ──────────────────────────────────────────────────
export function fitExponential(xs: number[], ys: number[]): RegressionResult {
  const valid = xs.map((x, i) => [x, ys[i]] as [number, number]).filter(([, y]) => y > 0);
  if (valid.length < 2)
    return { type: 'exponential', params: [1, 1], equation: 'y = 1', formula: '1', r2: 0 };

  const lx = valid.map(([x]) => x);
  const ly = valid.map(([, y]) => Math.log(y));
  const lin = fitLinear(lx, ly);
  const a = Math.exp(lin.params[1]);
  const b = Math.exp(lin.params[0]);
  const yPred = xs.map(x => a * Math.pow(b, x));
  const r2    = rSq(ys, yPred);

  return {
    type: 'exponential',
    params: [a, b],
    equation: `y = ${f(a)}·${f(b)}^x`,
    formula: `(${a})*(${b})^x`,
    r2,
  };
}

// ── Power  y = a·xᵇ ────────────────────────────────────────────────────────
export function fitPower(xs: number[], ys: number[]): RegressionResult {
  const valid = xs.map((x, i) => [x, ys[i]] as [number, number]).filter(([x, y]) => x > 0 && y > 0);
  if (valid.length < 2)
    return { type: 'power', params: [1, 1], equation: 'y = x', formula: 'x', r2: 0 };

  const lx = valid.map(([x]) => Math.log(x));
  const ly = valid.map(([, y]) => Math.log(y));
  const lin = fitLinear(lx, ly);
  const b = lin.params[0];
  const a = Math.exp(lin.params[1]);
  const yPred = xs.map(x => a * Math.pow(Math.abs(x) || 1e-14, b));
  const r2    = rSq(ys, yPred);

  return {
    type: 'power',
    params: [a, b],
    equation: `y = ${f(a)}·x^${f(b)}`,
    formula: `(${a})*x^(${b})`,
    r2,
  };
}

// ── Sinusoidal  y = a·sin(bx+c) + d ────────────────────────────────────────
export function fitSinusoidal(xs: number[], ys: number[]): RegressionResult {
  const n = xs.length;
  if (n < 4)
    return { type: 'sinusoidal', params: [1,1,0,0], equation: 'y = sin(x)', formula: 'sin(x)', r2: 0 };

  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = (Math.max(...xs) - Math.min(...xs)) || 1;
  const bMin = 0.1;
  const bMax = 4 * Math.PI / xRange;

  let bestR2 = -Infinity;
  let bestP  = [1, 1, 0, 0];
  const bSteps = 24, cSteps = 8;

  for (let bi = 0; bi <= bSteps; bi++) {
    const b = bMin + (bi / bSteps) * (bMax - bMin);
    for (let ci = 0; ci < cSteps; ci++) {
      const c    = (ci / cSteps) * 2 * Math.PI;
      const sins = xs.map(x => Math.sin(b * x + c));
      const S2   = sins.reduce((s, v) => s + v*v, 0);
      const S1   = sins.reduce((s, v) => s + v,   0);
      const Sy   = ys.reduce( (s, y) => s + y,    0);
      const Ssy  = sins.reduce((s, v, i) => s + v*ys[i], 0);
      const det  = S2 * n - S1 * S1;
      if (Math.abs(det) < 1e-10) continue;
      const a  = (Ssy * n - Sy  * S1) / det;
      const d  = (Sy  * S2 - Ssy * S1) / det;
      const yp = xs.map((x, i) => a * sins[i] + d);
      const r2 = rSq(ys, yp);
      if (r2 > bestR2) { bestR2 = r2; bestP = [a, b, c, d]; }
    }
  }

  const [a, b, c, d] = bestP;
  return {
    type: 'sinusoidal',
    params: bestP,
    equation: `y = ${f(a)}·sin(${f(b)}x + ${f(c)}) + ${f(d)}`,
    formula: `(${a})*sin((${b})*x+(${c}))+(${d})`,
    r2: bestR2,
  };
}

export function fitRegression(type: RegressionType, xs: number[], ys: number[]): RegressionResult {
  switch (type) {
    case 'linear':      return fitLinear(xs, ys);
    case 'quadratic':   return fitQuadratic(xs, ys);
    case 'exponential': return fitExponential(xs, ys);
    case 'power':       return fitPower(xs, ys);
    case 'sinusoidal':  return fitSinusoidal(xs, ys);
  }
}
