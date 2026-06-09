import { Expr, CustomFunction } from './types';

// Lanczos approximation for Gamma function
function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  let g = 7;
  let p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278220812,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (z + i);
  }
  let t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function factorial(n: number): number {
  if (n < 0) return NaN;
  if (!Number.isInteger(n)) return gamma(n + 1);
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export const CONSTANTS: Record<string, number> = {
  pi:       Math.PI,
  tau:      2 * Math.PI,
  e:        Math.E,
  Infinity: Infinity,
  inf:      Infinity,
};

export const MATH_FUNCS: Record<string, (...args: number[]) => number> = {
  // Trig
  sin:   Math.sin,   cos:  Math.cos,  tan:  Math.tan,
  asin:  Math.asin,  acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sec:   (x) => 1 / Math.cos(x),
  csc:   (x) => 1 / Math.sin(x),
  cosec: (x) => 1 / Math.sin(x),
  cot:   (x) => 1 / Math.tan(x),
  asec:  (x) => Math.acos(1 / x),
  acsc:  (x) => Math.asin(1 / x),
  acosec:(x) => Math.asin(1 / x),
  acot:  (x) => Math.PI / 2 - Math.atan(x),
  // Hyperbolic
  sinh:  Math.sinh,  cosh: Math.cosh, tanh: Math.tanh,
  asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  sech:  (x) => 1 / Math.cosh(x),
  csch:  (x) => 1 / Math.sinh(x),
  cosech:(x) => 1 / Math.sinh(x),
  coth:  (x) => 1 / Math.tanh(x),
  asech: (x) => Math.acosh(1 / x),
  acsch: (x) => Math.asinh(1 / x),
  acosech:(x) => Math.asinh(1 / x),
  acoth: (x) => Math.atanh(1 / x),
  // Exponential / log
  log:   Math.log10, ln: Math.log, exp: Math.exp,
  // Roots
  sqrt:  Math.sqrt,
  cbrt:  Math.cbrt,
  nthroot: (n, x) => Math.pow(x, 1 / n),
  // Rounding / sign
  abs:   Math.abs, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sign: Math.sign,
  // Two-arg
  mod:   (a, b) => ((a % b) + b) % b,   // always positive modulo
  hypot: Math.hypot,
  pow:   Math.pow,
  gcd:   (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; },
  lcm:   (a, b) => { const g = (x: number, y: number): number => y ? g(y, x % y) : x; return Math.abs(a * b) / g(Math.abs(a), Math.abs(b)); },
  // Scalar min / max (also handles arrays below)
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  // Utility
  log2:  Math.log2,
  log10: Math.log10,
};

export function evaluateAST(
  expr: Expr,
  vars: Record<string, number | number[]> = {},
  customFunctions: Record<string, CustomFunction> = {},
  memoCache?: Map<string, number | number[]>
): number | number[] {
  const ev = (e: Expr, v: Record<string, number | number[]> = vars) => evaluateAST(e, v, customFunctions, memoCache);

  switch (expr.type) {
    case 'number':
      return expr.value;
    case 'variable': {
      if (expr.name in CONSTANTS) return CONSTANTS[expr.name];
      if (expr.name in vars) return vars[expr.name];
      return NaN;
    }
    case 'binary': {
      const left = ev(expr.left) as number;
      const right = ev(expr.right) as number;
      switch (expr.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '^': return Math.pow(left, right);
        case 'mod': return ((left % right) + right) % right;
        case '<':  return left < right  ? 1 : 0;
        case '<=': return left <= right ? 1 : 0;
        case '>':  return left > right  ? 1 : 0;
        case '>=': return left >= right ? 1 : 0;
        case '==': return left === right ? 1 : 0;
        case '!=': return left !== right ? 1 : 0;
      }
      return NaN;
    }
    case 'unary': {
      const operand = ev(expr.operand) as number;
      switch (expr.op) {
        case '-': return -operand;
        case '+': return operand;
        case '!': return factorial(operand);
      }
      return NaN;
    }
    case 'function': {
      // ── List aggregate functions ────────────────────────────────────────
      if (['sum', 'mean', 'length'].includes(expr.name)) {
        const arr = ev(expr.args[0]);
        if (!Array.isArray(arr)) {
          // sum(expr, var, start, end) is handled in parser → summation node
          // but if called directly as a function with 1 arg that isn't an array, return NaN
          return NaN;
        }
        if (expr.name === 'length') return arr.length;
        if (arr.length === 0) return NaN;
        const s = arr.reduce((a, b) => a + b, 0);
        if (expr.name === 'sum') return s;
        return s / arr.length;
      }

      // min / max: handle both scalar multi-arg and single array arg
      if (expr.name === 'min' || expr.name === 'max') {
        if (expr.args.length === 1) {
          const v = ev(expr.args[0]);
          if (Array.isArray(v)) return expr.name === 'min' ? Math.min(...v) : Math.max(...v);
          return v as number;
        }
        const vals = expr.args.map(a => ev(a) as number);
        return expr.name === 'min' ? Math.min(...vals) : Math.max(...vals);
      }

      // ── log_base(x) dynamic base ────────────────────────────────────────
      if (expr.name.startsWith('log_')) {
        const baseStr = expr.name.slice(4);
        let base = parseFloat(baseStr);
        if (isNaN(base)) {
          // Try resolving as a constant/variable (e.g. log_e)
          if (baseStr in CONSTANTS) {
            base = CONSTANTS[baseStr];
          } else {
            base = ev({ type: 'variable', name: baseStr }) as number;
          }
        }
        const arg  = ev(expr.args[0]) as number;
        return Math.log(arg) / Math.log(base);
      }

      if (expr.name in MATH_FUNCS) {
        const args = expr.args.map(a => ev(a) as number);
        return MATH_FUNCS[expr.name](...args);
      }

      if (expr.name in customFunctions) {
        const funcDef = customFunctions[expr.name];
        const argVal = ev(expr.args[0]);
        const cacheKey = `${expr.name}(${argVal})`;
        if (memoCache && memoCache.has(cacheKey)) return memoCache.get(cacheKey)!;

        const newVars = { ...vars, [funcDef.param]: argVal };
        const result = evaluateAST(funcDef.body, newVars, customFunctions, memoCache);
        if (memoCache) memoCache.set(cacheKey, result);
        return result;
      }

      // Fallback: treat as implicit multiplication if not a known function
      const fallbackVal = ev({ type: 'variable', name: expr.name }) as number;
      if (expr.args.length > 0) {
        return fallbackVal * (ev(expr.args[0]) as number);
      }
      return fallbackVal;
    }
    case 'derivative': {
      const h = 1e-4;
      const x = (expr.varName in vars ? vars[expr.varName] : NaN) as number;
      if (isNaN(x)) return NaN;
      
      const vRight = { ...vars, [expr.varName]: x + h };
      const vLeft  = { ...vars, [expr.varName]: x - h };
      
      const f1 = evaluateAST(expr.expr, vRight, customFunctions, memoCache) as number;
      const f2 = evaluateAST(expr.expr, vLeft,  customFunctions, memoCache) as number;
      
      if (expr.degree === 1) {
        return (f1 - f2) / (2 * h);
      } else {
        const f0 = evaluateAST(expr.expr, vars, customFunctions, memoCache) as number;
        return (f1 - 2 * f0 + f2) / (h * h);
      }
    }
    case 'limit': {
      const target = ev(expr.target) as number;
      if (isNaN(target)) return NaN;
      const h = 1e-9;
      const vRight = { ...vars, [expr.varName]: target + h };
      const vLeft  = { ...vars, [expr.varName]: target - h };
      const f1 = evaluateAST(expr.expr, vRight, customFunctions, memoCache) as number;
      const f2 = evaluateAST(expr.expr, vLeft,  customFunctions, memoCache) as number;
      if (isNaN(f1)) return f2;
      if (isNaN(f2)) return f1;
      return (f1 + f2) / 2;
    }
    case 'integral': {
      const start = ev(expr.start) as number;
      const end   = ev(expr.end)   as number;
      if (isNaN(start) || isNaN(end)) return NaN;
      
      const n = 1000;
      const h = (end - start) / n;
      let sum = (evaluateAST(expr.expr, { ...vars, [expr.varName]: start }, customFunctions, memoCache) as number) + 
                (evaluateAST(expr.expr, { ...vars, [expr.varName]: end   }, customFunctions, memoCache) as number);
                
      for (let i = 1; i < n; i++) {
        const x = start + i * h;
        const fx = evaluateAST(expr.expr, { ...vars, [expr.varName]: x }, customFunctions, memoCache) as number;
        sum += (i % 2 === 0 ? 2 : 4) * fx;
      }
      return (sum * h) / 3;
    }
    case 'summation':
    case 'product': {
      const start = ev(expr.start) as number;
      const end   = ev(expr.end)   as number;
      if (isNaN(start) || isNaN(end)) return NaN;
      
      let res = expr.type === 'summation' ? 0 : 1;
      for (let i = start; i <= end; i++) {
        const val = evaluateAST(expr.expr, { ...vars, [expr.varName]: i }, customFunctions, memoCache) as number;
        if (expr.type === 'summation') res += val;
        else res *= val;
      }
      return res;
    }
    case 'piecewise': {
      for (const { cond, expr: retExpr } of expr.conditions) {
        const c = ev(cond) as number;
        if (c > 0) return ev(retExpr);
      }
      return NaN;
    }
    case 'list': {
      return expr.elements.map(e => ev(e) as number);
    }
    case 'list_comprehension': {
      const start = ev(expr.start) as number;
      const end   = ev(expr.end)   as number;
      const res: number[] = [];
      if (isNaN(start) || isNaN(end)) return res;
      for (let i = start; i <= end; i++) {
        res.push(evaluateAST(expr.expr, { ...vars, [expr.varName]: i }, customFunctions, memoCache) as number);
      }
      return res;
    }
  }
}
