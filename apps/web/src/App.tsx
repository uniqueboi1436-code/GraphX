import './App.css';
import { useMemo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { ExpressionList } from './components/ExpressionList';
import { GraphCanvas } from './components/GraphCanvas';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import type { Point2D, InequalityRegion } from '@graphx/math-engine';
import { useGraphStore } from './store/useGraphStore';
import {
  evaluateRange,
  evaluateParametricRange,
  parse,
  evaluateAST,
  findRoots,
  findExtrema,
  findIntersections,
  getYIntercept,
  evaluateInequality,
  detectInequalityOp,
} from '@graphx/math-engine';
import type { POI } from '@graphx/math-engine';

function cleanLatex(latex: string): string {
  let s = latex;

  // ── Delimiters ──────────────────────────────────────────────────────────
  s = s.replace(/\\left\s*\|/g, 'abs(');
  s = s.replace(/\\right\s*\|/g, ')');
  s = s.replace(/\\left\s*\(/g, '(');
  s = s.replace(/\\right\s*\)/g, ')');
  s = s.replace(/\\left\s*\[/g, '(');
  s = s.replace(/\\right\s*\]/g, ')');
  s = s.replace(/\\left\s*\{/g, '(');
  s = s.replace(/\\right\s*\}/g, ')');

  // ── Fractions (handle up to 2 levels of nesting greedily) ──────────────
  // Use iterative replacement so nested fracs resolve correctly
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  }

  // ── Roots ───────────────────────────────────────────────────────────────
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]*)\}/g, '($2)^(1/($1))'); // nth root
  s = s.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');

  // ── Operators ───────────────────────────────────────────────────────────
  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\times/g, '*');
  s = s.replace(/\\div/g, '/');

  // ── Trig & functions ────────────────────────────────────────────────────
  s = s.replace(/\\operatorname\{([^}]+)\}/g, '$1');
  
  // Inverse trig: \sin^{-1} notation (from MathQuill virtual keyboard)
  s = s.replace(/\\sin\^\{-1\}/g, 'asin');
  s = s.replace(/\\cos\^\{-1\}/g, 'acos');
  s = s.replace(/\\tan\^\{-1\}/g, 'atan');
  s = s.replace(/\\sec\^\{-1\}/g, 'asec');
  s = s.replace(/\\csc\^\{-1\}/g, 'acsc');
  s = s.replace(/\\cot\^\{-1\}/g, 'acot');

  // Inverse hyperbolic trig: \sinh^{-1} notation
  s = s.replace(/\\sinh\^\{-1\}/g, 'asinh');
  s = s.replace(/\\cosh\^\{-1\}/g, 'acosh');
  s = s.replace(/\\tanh\^\{-1\}/g, 'atanh');
  s = s.replace(/\\sech\^\{-1\}/g, 'asech');
  s = s.replace(/\\csch\^\{-1\}/g, 'acsch');
  s = s.replace(/\\coth\^\{-1\}/g, 'acoth');

  // arcXXX aliases → evaluator names (asin, acos, atan, ...)
  s = s.replace(/\\?arcsinh/g, 'asinh');
  s = s.replace(/\\?arccosh/g, 'acosh');
  s = s.replace(/\\?arctanh/g, 'atanh');
  s = s.replace(/\\?arcsech/g, 'asech');
  s = s.replace(/\\?arccsch/g, 'acsch');
  s = s.replace(/\\?arccoth/g, 'acoth');
  s = s.replace(/\\?arcsec/g,  'asec');
  s = s.replace(/\\?arccsc/g,  'acsc');
  s = s.replace(/\\?arccot/g,  'acot');
  s = s.replace(/\\?arcsin/g,  'asin');
  s = s.replace(/\\?arccos/g,  'acos');
  s = s.replace(/\\?arctan/g,  'atan');

  // Standard trig
  s = s.replace(/\\sin/g, 'sin');
  s = s.replace(/\\cos/g, 'cos');
  s = s.replace(/\\tan/g, 'tan');
  s = s.replace(/\\sec/g, 'sec');
  s = s.replace(/\\csc/g, 'csc');
  s = s.replace(/\\cot/g, 'cot');

  // Hyperbolic trig
  s = s.replace(/\\sinh/g, 'sinh');
  s = s.replace(/\\cosh/g, 'cosh');
  s = s.replace(/\\tanh/g, 'tanh');
  s = s.replace(/\\sech/g, 'sech');
  s = s.replace(/\\csch/g, 'csch');
  s = s.replace(/\\coth/g, 'coth');

  // Log / exp
  s = s.replace(/\\ln/g, 'ln');
  s = s.replace(/\\log/g, 'log');
  s = s.replace(/\\exp/g, 'exp');

  // Named math functions
  s = s.replace(/\\abs/g, 'abs');
  s = s.replace(/\\max/g, 'max');
  s = s.replace(/\\min/g, 'min');
  s = s.replace(/\\mod/g, 'mod');
  s = s.replace(/\\ceil/g, 'ceil');
  s = s.replace(/\\floor/g, 'floor');
  s = s.replace(/\\round/g, 'round');
  s = s.replace(/\\sign/g, 'sign');
  s = s.replace(/\\gcd/g, 'gcd');
  s = s.replace(/\\lcm/g, 'lcm');
  s = s.replace(/\\cbrt/g, 'cbrt');
  s = s.replace(/\\nthroot/g, 'nthroot');
  s = s.replace(/\\hypot/g, 'hypot');


  // ── Greek letters ───────────────────────────────────────────────────────
  s = s.replace(/\\pi/g, 'pi');
  s = s.replace(/\\theta/g, 'theta');
  s = s.replace(/\\alpha/g, 'alpha');
  s = s.replace(/\\beta/g, 'beta');
  s = s.replace(/\\gamma/g, 'gamma');
  s = s.replace(/\\delta/g, 'delta');
  s = s.replace(/\\epsilon/g, 'epsilon');
  s = s.replace(/\\zeta/g, 'zeta');
  s = s.replace(/\\eta/g, 'eta');
  s = s.replace(/\\iota/g, 'iota');
  s = s.replace(/\\kappa/g, 'kappa');
  s = s.replace(/\\lambda/g, 'lambda');
  s = s.replace(/\\mu/g, 'mu');
  s = s.replace(/\\nu/g, 'nu');
  s = s.replace(/\\xi/g, 'xi');
  s = s.replace(/\\rho/g, 'rho');
  s = s.replace(/\\sigma/g, 'sigma');
  s = s.replace(/\\tau/g, 'tau');
  s = s.replace(/\\upsilon/g, 'upsilon');
  s = s.replace(/\\phi/g, 'phi');
  s = s.replace(/\\psi/g, 'psi');
  s = s.replace(/\\omega/g, 'omega');

  // ── Constants ───────────────────────────────────────────────────────────
  s = s.replace(/\\infty/g, 'Infinity');
  s = s.replace(/\\infinity/g, 'Infinity');
  s = s.replace(/\\e(?![a-zA-Z])/g, 'e');

  // ── Comparison operators ─────────────────────────────────────────────
  s = s.replace(/\\le(?![a-zA-Z])/g, '<=');
  s = s.replace(/\\ge(?![a-zA-Z])/g, '>=');
  s = s.replace(/\\ne(?![a-zA-Z])/g, '!=');
  s = s.replace(/\\neq/g, '!=');
  s = s.replace(/\\leq/g, '<=');
  s = s.replace(/\\geq/g, '>=');

  // ── Integrals / sums / products ─────────────────────────────────────────
  // MathQuill outputs \int_{a}^{b} — the math-engine parser handles the full form
  // so we just strip backslashes from keywords that the parser recognizes
  s = s.replace(/\\int/g, 'int');
  s = s.replace(/\\sum/g, 'sum');
  s = s.replace(/\\prod/g, 'prod');
  s = s.replace(/\\_\{/g, '_{');
  s = s.replace(/\\\^\{/g, '^{');

  // ── Spaces ──────────────────────────────────────────────────────────────
  s = s.replace(/\\\s+/g, ' ');
  s = s.replace(/\\[ ,:;!]/g, ' ');

  // ── Strip remaining LaTeX backslash commands ────────────────────────────
  // Must come last so specific replacements above take precedence
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');

  return s;
}

/** Parse a cell value from a table — supports fractions like 1/3 */
function parseCell(raw: string): number {
  if (!raw.trim()) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + raw.replace(/pi/g, '3.14159265') + ')')();
    return typeof v === 'number' ? v : NaN;
  } catch { return NaN; }
}

function App() {
  const expressions  = useGraphStore((state) => state.expressions);
  const window       = useGraphStore((state) => state.window);
  const setWindow    = useGraphStore((state) => state.setWindow);
  const sliders      = useGraphStore((state) => state.sliders);
  const activeExpressionId = useGraphStore((state) => state.activeExpressionId);
  const theme        = useGraphStore((state) => state.theme);
  const setTheme     = useGraphStore((state) => state.setTheme);

  // Build a flat variable map from all active sliders
  const sliderVars = useMemo<Record<string, number>>(() => {
    const vars: Record<string, number> = {};
    for (const [name, cfg] of Object.entries(sliders)) vars[name] = cfg.value;
    return vars;
  }, [sliders]);

  const renderedExpressions = useMemo(() => {
    const result: Array<{ id: string; color: string; points: Point2D[]; type: 'curve' | 'point' | 'area' | 'segments' | 'integral_area' | 'inequality'; evalFn?: (x: number) => number; pois?: POI[]; inequalityRegion?: InequalityRegion }> = [];
    const customFunctions: Record<string, any> = {};

    // First pass: Extract function definitions
    expressions.forEach(expr => {
      if (expr.kind === 'table' || !expr.visible || !expr.latex) return;
      try {
        const formula = cleanLatex(expr.latex);
        if (formula.includes('=')) {
          const [lhs, rhs] = formula.split('=');
          const lhsAst = parse(lhs);
          const rhsAst = parse(rhs);
          if (lhsAst.type === 'function' && lhsAst.args.length === 1 && lhsAst.args[0].type === 'variable') {
             customFunctions[lhsAst.name] = { param: lhsAst.args[0].name, body: rhsAst };
          } else if (lhsAst.type === 'function' && lhsAst.args.length === 1 && lhsAst.args[0].type === 'number') {
             const funcName = lhsAst.name;
             const argVal = lhsAst.args[0].value;
             if (!customFunctions[funcName]) {
                customFunctions[funcName] = { 
                  param: 'n', 
                  body: { type: 'piecewise', conditions: [{ cond: { type: 'binary', op: '==', left: { type: 'variable', name: 'n' }, right: { type: 'number', value: argVal } }, expr: rhsAst }] }
                };
             } else {
                const existing = customFunctions[funcName];
                if (existing.body.type === 'piecewise') {
                   existing.body.conditions.unshift({ cond: { type: 'binary', op: '==', left: { type: 'variable', name: existing.param }, right: { type: 'number', value: argVal } }, expr: rhsAst });
                } else {
                   customFunctions[funcName] = {
                      param: existing.param,
                      body: {
                         type: 'piecewise',
                         conditions: [
                            { cond: { type: 'binary', op: '==', left: { type: 'variable', name: existing.param }, right: { type: 'number', value: argVal } }, expr: rhsAst },
                            { cond: { type: 'number', value: 1 }, expr: existing.body }
                         ]
                      }
                   }
                }
             }
          }
        }
      } catch {}
    });

    // We pass a shared memoCache for recursive function speedups during the render
    const memoCache = new Map<string, number | number[]>();

    const pairedIds = new Set<string>();

    for (let i = 0; i < expressions.length - 1; i++) {
      const expr1 = expressions[i];
      const expr2 = expressions[i+1];
      if (!expr1.visible || !expr2.visible || !expr1.latex || !expr2.latex) continue;
      if (expr1.kind === 'table' || expr2.kind === 'table') continue;

      const f1 = cleanLatex(expr1.latex).replace(/\s+/g, '');
      const f2 = cleanLatex(expr2.latex).replace(/\s+/g, '');

      if ((f1.startsWith('x=') && f2.startsWith('y=')) || (f1.startsWith('y=') && f2.startsWith('x='))) {
        const xFormula = f1.startsWith('x=') ? f1 : f2;
        const yFormula = f1.startsWith('y=') ? f2 : f1;

        try {
          const xAst = parse(xFormula.substring(2));
          const yAst = parse(yFormula.substring(2));
          
          const testX1 = evaluateAST(xAst, { ...sliderVars, t: 1.2345 }, customFunctions, memoCache) as number;
          const testX2 = evaluateAST(xAst, { ...sliderVars, t: 2.3456 }, customFunctions, memoCache) as number;
          const testY1 = evaluateAST(yAst, { ...sliderVars, t: 1.2345 }, customFunctions, memoCache) as number;
          const testY2 = evaluateAST(yAst, { ...sliderVars, t: 2.3456 }, customFunctions, memoCache) as number;
          
          if (!Number.isNaN(testX1) && !Number.isNaN(testY1)) {
            const isParametric = (testX1 !== testX2) || (testY1 !== testY2);
            if (isParametric) {
              const tMin = -24 * Math.PI;
              const tMax = 24 * Math.PI;
              const points = evaluateParametricRange(xAst, yAst, tMin, tMax, customFunctions, sliderVars);
              result.push({ id: expr1.id, color: expr1.color, points, type: 'curve' });
            } else {
              result.push({ id: expr1.id, color: expr1.color, points: [{ x: testX1, y: testY1 }], type: 'point' });
            }
            pairedIds.add(expr1.id);
            pairedIds.add(expr2.id);
            i++;
          }
        } catch {}
      }
    }

    expressions.forEach((expr) => {
      if (expr.kind === 'table') {
        if (!expr.visible || !expr.tableData) return;
        const pts: Point2D[] = (expr.tableData.rows ?? [])
          .map(r => ({ x: parseCell(r.x), y: parseCell(r.y) }))
          .filter(p => isFinite(p.x) && isFinite(p.y));
        if (pts.length > 0) result.push({ id: expr.id + '_pts', color: expr.color, points: pts, type: 'point' });

        const reg = expr.tableData.regression;
        if (reg?.formula) {
          try {
            const ast = parse(reg.formula);
            const steps = 400;
            const step  = (window.xMax - window.xMin) / steps;
            const regPts: Point2D[] = [];
            for (let i = 0; i <= steps; i++) {
              const x = window.xMin + i * step;
              const y = evaluateAST(ast, { x }, customFunctions, memoCache) as number;
              regPts.push({ x, y });
            }
            result.push({ id: expr.id + '_reg', color: expr.color, points: regPts, type: 'curve' });
          } catch { }
        }
        return;
      }

      if (pairedIds.has(expr.id)) return;

      if (!expr.visible || !expr.latex || expr.type === 'note' || expr.type === 'slider') {
        result.push({ id: expr.id, color: expr.color, points: [], type: 'curve' });
        return;
      }

      try {
        const formula = cleanLatex(expr.latex);
        const noSpaceFormula = formula.replace(/\s+/g, '');
        const points: Point2D[] = [];
        let type: 'curve' | 'point' | 'area' | 'segments' | 'integral_area' | 'inequality' = 'curve';

        // ── Inequality detection: intercept BEFORE implicit-equation check ────
        // Any formula with <, <=, >, >= is an inequality (not an equation).
        if (detectInequalityOp(noSpaceFormula) !== null) {
          const region = evaluateInequality(formula, window, customFunctions, sliderVars);
          if (region) {
            // Also push the boundary as a standard 'segments' layer so POI/hover still works
            result.push({
              id: expr.id,
              color: expr.color,
              points: [],
              type: 'inequality',
              inequalityRegion: region,
            });
          } else {
            result.push({ id: expr.id, color: expr.color, points: [], type: 'curve' });
          }
          return;
        }

        let isStandaloneParametric = false;
        let tAstX: any = null;
        let tAstY: any = null;
        let checkFormula = formula;
        let isXEquals = false;
        
        if (formula.includes('=')) {
          const parts = formula.split('=');
          if (parts[0].trim() === 'x') {
            checkFormula = parts[1];
            isXEquals = true;
          } else if (parts[0].trim() === 'y' || parts[0].includes('f')) {
            checkFormula = parts[1];
          }
        }

        try {
          const checkAst = parse(checkFormula);
          if (checkAst.type !== 'list') {
            const testT1 = evaluateAST(checkAst, { ...sliderVars, t: 1.2345 }, customFunctions, memoCache) as number;
            const testT2 = evaluateAST(checkAst, { ...sliderVars, t: 2.3456 }, customFunctions, memoCache) as number;
            const testX1 = evaluateAST(checkAst, { ...sliderVars, x: 1.2345 }, customFunctions, memoCache) as number;
            const testX2 = evaluateAST(checkAst, { ...sliderVars, x: 2.3456 }, customFunctions, memoCache) as number;

            const dependsOnT = !Number.isNaN(testT1) && testT1 !== testT2;
            const dependsOnX = !Number.isNaN(testX1) && testX1 !== testX2;

            if (dependsOnT && !dependsOnX) {
               isStandaloneParametric = true;
               if (isXEquals) {
                  tAstX = checkAst;
                  tAstY = parse('t');
               } else {
                  tAstX = parse('t');
                  tAstY = checkAst;
               }
            }
          }
        } catch {}

        if (isStandaloneParametric) {
          const tMin = -24 * Math.PI;
          const tMax = 24 * Math.PI;
          const points = evaluateParametricRange(tAstX, tAstY, tMin, tMax, customFunctions, sliderVars);
          result.push({ id: expr.id, color: expr.color, points, type: 'curve' });
          return;
        }

        const isImplicit = noSpaceFormula.includes('=') && (
          (noSpaceFormula.includes('y') && noSpaceFormula.includes('x') && !noSpaceFormula.startsWith('y=') && !noSpaceFormula.startsWith('f(x)=')) ||
          noSpaceFormula.startsWith('x=')
        );

        if (isImplicit) {
          const [lhs, rhs] = formula.split('=');
          const lhsAst = parse(lhs);
          const rhsAst = parse(rhs);
          
          const marchingSquares = (bounds: { xMin: number, xMax: number, yMin: number, yMax: number }, res: number) => {
            const dx = (bounds.xMax - bounds.xMin) / res;
            const dy = (bounds.yMax - bounds.yMin) / res;
            const grid = new Float32Array((res + 1) * (res + 1));
            let idx = 0;
            for (let iy = 0; iy <= res; iy++) {
              const y = bounds.yMin + iy * dy;
              for (let ix = 0; ix <= res; ix++) {
                const x = bounds.xMin + ix * dx;
                const vars = { x, y, ...sliderVars };
                grid[idx++] = (evaluateAST(lhsAst, vars, customFunctions, memoCache) as number) - (evaluateAST(rhsAst, vars, customFunctions, memoCache) as number);
              }
            }
            const pts: Point2D[] = [];
            const activeCells: { bounds: { xMin: number, xMax: number, yMin: number, yMax: number } }[] = [];
            
            for (let iy = 0; iy < res; iy++) {
              const y = bounds.yMin + iy * dy;
              for (let ix = 0; ix < res; ix++) {
                const x = bounds.xMin + ix * dx;
                const i00 = iy * (res + 1) + ix;
                const v00 = grid[i00], v10 = grid[i00 + 1], v01 = grid[(iy+1)*(res+1)+ix], v11 = grid[(iy+1)*(res+1)+ix+1];
                const cp: Point2D[] = [];
                if ((v00>0&&v10<=0)||(v00<=0&&v10>0)) cp.push({x:x+(v00/(v00-v10))*dx,y});
                if ((v10>0&&v11<=0)||(v10<=0&&v11>0)) cp.push({x:x+dx,y:y+(v10/(v10-v11))*dy});
                if ((v01>0&&v11<=0)||(v01<=0&&v11>0)) cp.push({x:x+(v01/(v01-v11))*dx,y:y+dy});
                if ((v00>0&&v01<=0)||(v00<=0&&v01>0)) cp.push({x,y:y+(v00/(v00-v01))*dy});
                if (cp.length >= 2) {
                  pts.push(cp[0], cp[1]);
                  activeCells.push({ bounds: { xMin: x, xMax: x + dx, yMin: y, yMax: y + dy } });
                }
              }
            }
            return { points: pts, activeCells };
          };

          const coarse = marchingSquares(window, 100);
          points.push(...coarse.points);
          for (const cell of coarse.activeCells) {
             const refined = marchingSquares(cell.bounds, 10);
             points.push(...refined.points);
          }
          type = 'segments';
        } else if (noSpaceFormula.startsWith('r=')) {
          const ast = parse(noSpaceFormula.substring(2));
          let crossings = 0;
          let lastR = evaluateAST(ast, { theta: 0, t: 0, ...sliderVars }, customFunctions, memoCache) as number;
          for (let i = 1; i <= 36; i++) {
             const th = (i / 36) * 2 * Math.PI;
             const currR = evaluateAST(ast, { theta: th, t: th, ...sliderVars }, customFunctions, memoCache) as number;
             if (Math.sign(currR) !== Math.sign(lastR) && Math.sign(lastR) !== 0) crossings++;
             lastR = currR;
          }
          const polarSteps = Math.max(1000, crossings * 50);
          const polarStep = (2 * Math.PI) / polarSteps;
          for (let t = 0; t <= 2 * Math.PI; t += polarStep) {
            const r = evaluateAST(ast, { theta: t, t, ...sliderVars }, customFunctions, memoCache) as number;
            points.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
          }
        } else {
          let rightSide = formula;
          if (formula.includes('=')) {
            const parts = formula.split('=');
            rightSide = parts[0].includes('y') || parts[0].includes('f') ? parts[1] : parts[0];
          }

          const ast = parse(rightSide);
          
          if (ast.type === 'integral') {
             const start = evaluateAST(ast.start, sliderVars, customFunctions, memoCache) as number;
             const end = evaluateAST(ast.end, sliderVars, customFunctions, memoCache) as number;
             const step = (end - start) / 200;
             const curvePoints = [];
             for (let i = 0; i <= 200; i++) {
                const x = start + i * step;
                const y = evaluateAST(ast.expr, { ...sliderVars, [ast.varName]: x }, customFunctions, memoCache) as number;
                curvePoints.push({ x, y });
             }
             result.push({ id: expr.id + '_area', color: expr.color + '40', points: curvePoints, type: 'integral_area' });
          }
          
          if (ast.type === 'list' && ast.elements.length === 2) {
            const testT1 = evaluateAST(ast, { ...sliderVars, t: 1.2345 }, customFunctions, memoCache) as number[];
            const testT2 = evaluateAST(ast, { ...sliderVars, t: 2.3456 }, customFunctions, memoCache) as number[];
            const isParametric = Array.isArray(testT1) && Array.isArray(testT2) && (testT1[0] !== testT2[0] || testT1[1] !== testT2[1]);

            if (isParametric) {
              const tMin = -24 * Math.PI;
              const tMax = 24 * Math.PI;
              const pts = evaluateParametricRange(ast.elements[0], ast.elements[1], tMin, tMax, customFunctions, sliderVars);
              points.push(...pts);
              type = 'curve';
            } else if (Array.isArray(testT1) && testT1.every(Number.isFinite)) {
              points.push({ x: testT1[0], y: testT1[1] });
              type = 'point';
            } else {
              const testVal = evaluateAST(ast, { x: 0, ...sliderVars }, customFunctions, memoCache);
              points.push(...(Array.isArray(testVal) ? testVal : []).map((val, i) => ({ x: i + 1, y: val })));
              type = 'point';
            }
          } else {
            const testVal = evaluateAST(ast, { x: 0, ...sliderVars }, customFunctions, memoCache);
            if (Array.isArray(testVal)) {
              points.push(...testVal.map((val, i) => ({ x: i + 1, y: val })));
              type = 'point';
            } else {
              points.push(...evaluateRange(ast, window, customFunctions, sliderVars));
            }
          }

          if (type === 'curve' && ast.type !== 'list') {
            const capturedAst = ast;
            const capturedSliderVars = { ...sliderVars };
            const evalFn = (x: number) =>
              evaluateAST(capturedAst, { x, ...capturedSliderVars }, customFunctions, memoCache) as number;
            result.push({ id: expr.id, color: expr.color, points, type, evalFn });
            return;
          }
        }

        result.push({ id: expr.id, color: expr.color, points, type });
      } catch {
        result.push({ id: expr.id, color: expr.color, points: [], type: 'curve' });
      }
    });

    // Third pass: POIs
    if (activeExpressionId) {
      const activeData = result.find(r => r.id === activeExpressionId && r.type === 'curve' && r.evalFn);
      if (activeData && activeData.evalFn) {
        const pois: POI[] = [];
        pois.push(...findRoots(activeData.points, activeData.evalFn));
        pois.push(...findExtrema(activeData.points, activeData.evalFn));
        const yInt = getYIntercept(activeData.evalFn, window.xMin, window.xMax);
        if (yInt) pois.push(yInt);
        
        // Intersections
        result.forEach(other => {
           if (other.id !== activeExpressionId && other.type === 'curve' && other.evalFn) {
              pois.push(...findIntersections(activeData.points, activeData.evalFn!, other.evalFn));
           }
        });
        
        activeData.pois = pois;
      }
    }

    return result;
  }, [expressions, window.xMin, window.xMax, window.yMin, window.yMax, sliderVars, activeExpressionId]);

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} flex h-screen w-full flex-col-reverse md:flex-row bg-white dark:bg-[#111827] text-gray-900 dark:text-white overflow-hidden`}>
      {/* Left panel */}
      <div className="w-full h-1/3 md:w-[320px] md:h-full flex-shrink-0 z-20 border-t md:border-t-0 md:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl transition-all">
        <ExpressionList />
      </div>

      {/* Graph area */}
      <div className="flex-1 relative h-full flex flex-col min-h-0">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-10 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">G</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
              GraphX
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center rounded-md border border-gray-200 bg-white p-0.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                aria-label="White theme"
                title="White theme"
                onClick={() => setTheme('white')}
                className={`rounded p-1.5 transition-colors ${theme === 'white' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                <Sun size={16} />
              </button>
              <button
                type="button"
                aria-label="Dark theme"
                title="Dark theme"
                onClick={() => setTheme('dark')}
                className={`rounded p-1.5 transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                <Moon size={16} />
              </button>
            </div>
            <button className="px-4 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
              Save
            </button>
            <button className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors shadow-sm">
              Share
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <GraphCanvas
            expressions={renderedExpressions as any}
            window={window}
            onWindowChange={setWindow}
          />
        </div>
        
        {/* Virtual Keyboard Overlay */}
        <VirtualKeyboard />
      </div>
    </div>
  );
}

export default App;
