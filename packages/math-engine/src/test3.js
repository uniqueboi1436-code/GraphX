import { parse } from './parser.js';
import { evaluateAST } from './evaluator.js';
import { evaluateRange } from './adaptive.js';

const window = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const expr = "ceil(x)";
const points = evaluateRange(expr, window);

const pointsAround1 = points.filter(p => p.x > 0.9 && p.x < 1.1);
console.log(pointsAround1);
