import { parse } from './parser.js';
import { evaluateAST } from './evaluator.js';
import { evaluateRange } from './adaptive.js';

const window = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const expr = "ceil(x)";
const points = evaluateRange(expr, window);

const pointsAround0 = points.filter(p => p.x > -0.5 && p.x < 0.5);
console.log(pointsAround0);
