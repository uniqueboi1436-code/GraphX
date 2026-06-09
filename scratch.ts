import { evaluateRange } from './packages/math-engine/src/adaptive';
import { parse } from './packages/math-engine/src/parser';
import { evaluateAST } from './packages/math-engine/src/evaluator';

const window = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const expr = "ceil(x)";
const points = evaluateRange(expr, window);

const discontinuities = points.filter(p => isNaN(p.y));
console.log(`Found ${discontinuities.length} discontinuities`);

const around1 = points.filter(p => p.x > 0.9 && p.x < 1.1);
console.log(around1);
