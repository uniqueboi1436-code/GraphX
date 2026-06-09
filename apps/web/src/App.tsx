import { useMemo } from 'react';
import { ExpressionList } from './components/ExpressionList';
import { GraphCanvas } from './components/GraphCanvas';
import type { Point2D, InequalityRegion } from '@graphcalc/math-engine';
import { useGraphStore } from './store/useGraphStore';
import { evaluateRange, parse, evaluateAST, findRoots, findExtrema, findIntersections, getYIntercept, evaluateInequality, detectInequalityOp } from '@graphcalc/math-engine';
import type { POI } from '@graphcalc/math-engine';

function cleanLatex(latex: string): string {
  return latex
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\cdot/g, '*')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\pi/g, 'pi')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\le/g, '<=')
    .replace(/\\ge/g, '>=')
    .replace(/\\/g, '');
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

        if (noSpaceFormula.includes('=') && noSpaceFormula.includes('y') && noSpaceFormula.includes('x') && !noSpaceFormula.startsWith('y=') && !noSpaceFormula.startsWith('f(x)=')) {
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
             
             // Still plot the scalar value as a horizontal line if desired, or skip it.
             // Actually Desmos doesn't plot the horizontal line for an integral unless it's y=integral.
             // But if we plot it, we should plot it. Wait, the evaluator handles integrals too.
             // Let's just fall through to the scalar plot.
          }
          
          const testVal = evaluateAST(ast, { x: 0, ...sliderVars }, customFunctions, memoCache);
          if (Array.isArray(testVal)) {
            points.push(...testVal.map((val, i) => ({ x: i + 1, y: val })));
            type = 'point';
          } else {
            points.push(...evaluateRange(ast, window, customFunctions, sliderVars));
          }

          if (type === 'curve') {
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
    <div className="flex h-screen w-full flex-col-reverse md:flex-row bg-white dark:bg-[#111827] text-gray-900 dark:text-white overflow-hidden">
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
              GraphCalc
            </span>
          </div>
          <div className="flex gap-2">
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
      </div>
    </div>
  );
}

export default App;
