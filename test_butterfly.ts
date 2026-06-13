import { parse } from './packages/math-engine/src/parser';
import { evaluateAST } from './packages/math-engine/src/evaluator';

const eq = '(sin(t)*(e^cos(t) - 2*cos(4*t) - sin(t/12)^5), cos(t)*(e^cos(t) - 2*cos(4*t) - sin(t/12)^5))';
const ast = parse(eq);

console.log(`AST type: ${ast.type}, elements: ${(ast as any).elements?.length}`);

const tMin = 0;
const tMax = 24 * Math.PI;
const steps = 10;
for (let i = 0; i <= steps; i++) {
  const t = tMin + (i * (tMax - tMin)) / steps;
  const pt = evaluateAST(ast, { t }) as number[];
  console.log(`  t = ${t.toFixed(2)} -> x: ${pt[0].toFixed(2)}, y: ${pt[1].toFixed(2)}`);
}
