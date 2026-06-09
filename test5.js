import { parse } from './packages/math-engine/src/parser.js';
import { evaluateAST } from './packages/math-engine/src/evaluator.js';
import { evaluateRange } from './packages/math-engine/src/adaptive.js';

const window = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const expr = "ceil(x)";
const ast = parse(expr);
const customFunctions = {};
const points = evaluateRange(ast, window, customFunctions);

let drawnLines = [];
let currentLine = null;

points.forEach(p => {
  if (!isFinite(p.y)) {
    if (currentLine) drawnLines.push(currentLine);
    currentLine = null;
    return;
  }
  if (!currentLine) {
    currentLine = [p];
  } else {
    currentLine.push(p);
  }
});
if (currentLine) drawnLines.push(currentLine);

// See if there's any vertical-like line
for (let line of drawnLines) {
  for (let i = 1; i < line.length; i++) {
    const p1 = line[i-1];
    const p2 = line[i];
    if (Math.abs(p2.x - p1.x) < 0.1 && Math.abs(p2.y - p1.y) > 0.5) {
      console.log(`Vertical line drawn between x=${p1.x},y=${p1.y} and x=${p2.x},y=${p2.y}`);
    }
  }
}
console.log(`Total lines: ${drawnLines.length}`);
