import { parse } from './packages/math-engine/src/parser';
import { evaluateAST } from './packages/math-engine/src/evaluator';

const eqns = [
  '(cos(t), sin(t))',
  '(t*cos(t), t*sin(t))',
  '(16*sin(t)^3, 13*cos(t)-5*cos(2*t)-2*cos(3*t)-cos(4*t))'
];

for (const eq of eqns) {
  console.log(`\nEquation: ${eq}`);
  const ast = parse(eq);
  console.log(`AST type: ${ast.type}, elements: ${(ast as any).elements?.length}`);
  
  // Parametric preview
  console.log('Preview points (t from 0 to 2*PI, 5 steps):');
  const tMin = 0;
  const tMax = 2 * Math.PI;
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const t = tMin + (i * (tMax - tMin)) / steps;
    const pt = evaluateAST(ast, { t }) as number[];
    console.log(`  t = ${t.toFixed(2)} -> x: ${pt[0].toFixed(2)}, y: ${pt[1].toFixed(2)}`);
  }
}
