import { parse } from './packages/math-engine/src/parser';
console.log(JSON.stringify(parse('2cos(4t)')));
console.log(JSON.stringify(parse('sin^5(t/12)')));
console.log(JSON.stringify(parse('2cos(4*t)')));
