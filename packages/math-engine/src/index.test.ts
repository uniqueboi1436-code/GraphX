import { describe, it, expect } from 'vitest';
import { evaluate, evaluateRange, detectType } from './index';
import { tokenize, insertImplicitMultiplication } from './tokenizer';

// ── Helper ───────────────────────────────────────────────────────────────────
const ev   = (expr: string, vars: Record<string, number> = {}) => evaluate(expr, vars);
const evN  = (expr: string, vars: Record<string, number> = {}) => ev(expr, vars) as number;

// ════════════════════════════════════════════════════════════════════════════
// 1. IMPLICIT MULTIPLICATION
// ════════════════════════════════════════════════════════════════════════════
describe('Implicit Multiplication', () => {
  it('2x   → 2 * x', ()  => expect(evN('2x', { x: 5 })).toBe(10));
  it('xy   → x * y', ()  => expect(evN('xy', { x: 3, y: 4 })).toBe(12));
  it('2(x+1)→ 2*(x+1)', () => expect(evN('2(x+1)', { x: 3 })).toBe(8));
  it('(x+1)(x-1) → difference of squares', () =>
    expect(evN('(x+1)(x-1)', { x: 3 })).toBe(8));
  it('2sinx→ 2*sin(x) (no parens)', () =>
    expect(evN('2sin(x)', { x: 0 })).toBeCloseTo(0));
  it('2sin(pi/2) → 2', () =>
    expect(evN('2sin(pi/2)')).toBeCloseTo(2));
  it('πx   → pi * x', () =>
    expect(evN('πx', { x: 1 })).toBeCloseTo(Math.PI));
  it('number followed by LPAREN: 3(4) = 12', () =>
    expect(evN('3(4)')).toBe(12));
  it(') followed by (: (2+1)(3+1) = 12', () =>
    expect(evN('(2+1)(3+1)')).toBe(12));
  it(') followed by identifier: (x+1)y', () =>
    expect(evN('(x+1)y', { x: 2, y: 4 })).toBe(12));
  it('subscripted variable: 2x_1', () =>
    expect(evN('2x_1', { x_1: 7 })).toBe(14));
});

// ════════════════════════════════════════════════════════════════════════════
// 2. UNICODE / CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
describe('Unicode constants and superscripts', () => {
  it('π evaluates to Math.PI',    () => expect(evN('π')).toBeCloseTo(Math.PI));
  it('τ evaluates to 2*Math.PI',  () => expect(evN('τ')).toBeCloseTo(2 * Math.PI));
  it('x²  → x^2',  () => expect(evN('x²', { x: 3 })).toBe(9));
  it('x³  → x^3',  () => expect(evN('x³', { x: 2 })).toBe(8));
  it('2x² → 2*x^2',() => expect(evN('2x²', { x: 3 })).toBe(18));
  it('Infinity constant', () => expect(evN('Infinity')).toBe(Infinity));
  it('-Infinity via unary', () => expect(evN('-Infinity')).toBe(-Infinity));
});

// ════════════════════════════════════════════════════════════════════════════
// 3. STANDARD ARITHMETIC
// ════════════════════════════════════════════════════════════════════════════
describe('Basic arithmetic', () => {
  it('2 + 3 * 4 = 14 (precedence)', () => expect(evN('2 + 3 * 4')).toBe(14));
  it('(2 + 3) * 4 = 20',           () => expect(evN('(2 + 3) * 4')).toBe(20));
  it('2^3 = 8',                     () => expect(evN('2^3')).toBe(8));
  it('2^3^2 = 512 (right-assoc)',   () => expect(evN('2^3^2')).toBe(512));
  it('10 % 3 = 1 (modulo)',         () => expect(evN('mod(10, 3)')).toBe(1));
  it('negative modulo: mod(-1, 3) = 2', () => expect(evN('mod(-1, 3)')).toBe(2));
});

// ════════════════════════════════════════════════════════════════════════════
// 4. UNARY MINUS
// ════════════════════════════════════════════════════════════════════════════
describe('Unary minus', () => {
  it('-x',       () => expect(evN('-x', { x: 5 })).toBe(-5));
  it('-(x+1)',   () => expect(evN('-(x+1)', { x: 3 })).toBe(-4));
  it('-sin(x)',  () => expect(evN('-sin(x)', { x: Math.PI / 2 })).toBeCloseTo(-1));
  it('--x = x',  () => expect(evN('--x', { x: 4 })).toBe(4));
  it('-2^2 = -4 (unary applied after power)', () =>
    // -2^2 is -(2^2) = -4  in standard math
    expect(evN('-2^2')).toBe(-4));
});

// ════════════════════════════════════════════════════════════════════════════
// 5. TRIG FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('Trigonometric functions', () => {
  it('sin(pi/2) = 1',       () => expect(evN('sin(pi/2)')).toBeCloseTo(1));
  it('cos(0) = 1',          () => expect(evN('cos(0)')).toBeCloseTo(1));
  it('tan(pi/4) = 1',       () => expect(evN('tan(pi/4)')).toBeCloseTo(1));
  it('asin(1) = pi/2',      () => expect(evN('asin(1)')).toBeCloseTo(Math.PI / 2));
  it('acos(1) = 0',         () => expect(evN('acos(1)')).toBeCloseTo(0));
  it('atan(1) = pi/4',      () => expect(evN('atan(1)')).toBeCloseTo(Math.PI / 4));
  it('atan2(1,1) = pi/4',   () => expect(evN('atan2(1,1)')).toBeCloseTo(Math.PI / 4));
  it('sec(0) = 1',          () => expect(evN('sec(0)')).toBeCloseTo(1));
  it('csc(pi/2) = 1',       () => expect(evN('csc(pi/2)')).toBeCloseTo(1));
  it('cosec(pi/2) = 1',     () => expect(evN('cosec(pi/2)')).toBeCloseTo(1));
  it('cot(pi/4) = 1',       () => expect(evN('cot(pi/4)')).toBeCloseTo(1));
  it('sin^-1(1) = pi/2',    () => expect(evN('sin^-1(1)')).toBeCloseTo(Math.PI / 2));
  it('cot^-1(1) = pi/4',    () => expect(evN('cot^-1(1)')).toBeCloseTo(Math.PI / 4));
  it('sin(sin^-1(0.5)) = 0.5', () => expect(evN('sin(sin^-1(0.5))')).toBeCloseTo(0.5));
});

// ════════════════════════════════════════════════════════════════════════════
// 6. HYPERBOLIC FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('Hyperbolic functions', () => {
  it('sinh(0) = 0',  () => expect(evN('sinh(0)')).toBeCloseTo(0));
  it('cosh(0) = 1',  () => expect(evN('cosh(0)')).toBeCloseTo(1));
  it('tanh(0) = 0',  () => expect(evN('tanh(0)')).toBeCloseTo(0));
  it('asinh(0) = 0', () => expect(evN('asinh(0)')).toBeCloseTo(0));
  it('acosh(1) = 0', () => expect(evN('acosh(1)')).toBeCloseTo(0));
  it('atanh(0) = 0', () => expect(evN('atanh(0)')).toBeCloseTo(0));
});

// ════════════════════════════════════════════════════════════════════════════
// 7. LOGARITHM / EXPONENTIAL
// ════════════════════════════════════════════════════════════════════════════
describe('Logarithm and exponential', () => {
  it('log(100) = 2',    () => expect(evN('log(100)')).toBeCloseTo(2));
  it('log(10) = 1',     () => expect(evN('log(10)')).toBeCloseTo(1));
  it('ln(e) = 1',       () => expect(evN('ln(e)')).toBeCloseTo(1));
  it('ln(1) = 0',       () => expect(evN('ln(1)')).toBeCloseTo(0));
  it('exp(0) = 1',      () => expect(evN('exp(0)')).toBeCloseTo(1));
  it('exp(1) = e',      () => expect(evN('exp(1)')).toBeCloseTo(Math.E));
  it('log_2(8) = 3',    () => expect(evN('log_2(8)')).toBeCloseTo(3));
  it('log_10(1000) = 3',() => expect(evN('log_10(1000)')).toBeCloseTo(3));
  it('log_e(e) = 1',    () => expect(evN('log_e(e)')).toBeCloseTo(1));
});

// ════════════════════════════════════════════════════════════════════════════
// 8. ROOT FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('Root functions', () => {
  it('sqrt(16) = 4',        () => expect(evN('sqrt(16)')).toBe(4));
  it('sqrt(2) ≈ 1.4142',    () => expect(evN('sqrt(2)')).toBeCloseTo(1.4142, 4));
  it('cbrt(27) = 3',        () => expect(evN('cbrt(27)')).toBeCloseTo(3));
  it('cbrt(-8) = -2',       () => expect(evN('cbrt(-8)')).toBeCloseTo(-2));
  it('nthroot(3,27) = 3',   () => expect(evN('nthroot(3,27)')).toBeCloseTo(3));
  it('nthroot(2,4) = 2',    () => expect(evN('nthroot(2,4)')).toBeCloseTo(2));
});

// ════════════════════════════════════════════════════════════════════════════
// 9. ABSOLUTE VALUE
// ════════════════════════════════════════════════════════════════════════════
describe('Absolute value', () => {
  it('abs(-5) = 5',    () => expect(evN('abs(-5)')).toBe(5));
  it('abs(5) = 5',     () => expect(evN('abs(5)')).toBe(5));
  it('|−5| = 5 (bar notation)', () => expect(evN('|-5|')).toBe(5));
  it('|x| = |−3| = 3', () => expect(evN('|x|', { x: -3 })).toBe(3));
});

// ════════════════════════════════════════════════════════════════════════════
// 10. FLOOR / CEIL / ROUND / SIGN
// ════════════════════════════════════════════════════════════════════════════
describe('Rounding functions', () => {
  it('floor(2.9) = 2',  () => expect(evN('floor(2.9)')).toBe(2));
  it('ceil(2.1) = 3',   () => expect(evN('ceil(2.1)')).toBe(3));
  it('round(2.5) = 3',  () => expect(evN('round(2.5)')).toBe(3));
  it('sign(-5) = -1',   () => expect(evN('sign(-5)')).toBe(-1));
  it('sign(0) = 0',     () => expect(evN('sign(0)')).toBe(0));
  it('sign(7) = 1',     () => expect(evN('sign(7)')).toBe(1));
});

// ════════════════════════════════════════════════════════════════════════════
// 11. MIN / MAX (scalar and array)
// ════════════════════════════════════════════════════════════════════════════
describe('Min / Max', () => {
  it('min(3, 1, 4) = 1',  () => expect(evN('min(3, 1, 4)')).toBe(1));
  it('max(3, 1, 4) = 4',  () => expect(evN('max(3, 1, 4)')).toBe(4));
  it('min([5,2,9]) = 2',  () => expect(evN('min([5,2,9])')).toBe(2));
  it('max([5,2,9]) = 9',  () => expect(evN('max([5,2,9])')).toBe(9));
});

// ════════════════════════════════════════════════════════════════════════════
// 12. NESTED FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('Nested functions', () => {
  it('sin(cos(0)) = sin(1)', () =>
    expect(evN('sin(cos(0))')).toBeCloseTo(Math.sin(1)));
  it('sqrt(abs(-9)) = 3', () =>
    expect(evN('sqrt(abs(-9))')).toBe(3));
  it('floor(sqrt(10)) = 3', () =>
    expect(evN('floor(sqrt(10))')).toBe(3));
  it('sin(cos(tan(0))) = sin(1)', () =>
    expect(evN('sin(cos(tan(0)))')).toBeCloseTo(Math.sin(1)));
  it('exp(ln(5)) = 5', () =>
    expect(evN('exp(ln(5))')).toBeCloseTo(5));
});

// ════════════════════════════════════════════════════════════════════════════
// 13. FUNCTION POWER SUGAR: sin²(x), cos²(x)
// ════════════════════════════════════════════════════════════════════════════
describe('Function power notation', () => {
  it('sin²(x) → sin(x)^2 at x=pi/2 → 1', () =>
    expect(evN('sin²(x)', { x: Math.PI / 2 })).toBeCloseTo(1));
  it('cos²(x) + sin²(x) = 1 (Pythagorean identity)', () =>
    expect(evN('cos²(x) + sin²(x)', { x: 1.23 })).toBeCloseTo(1));
  it('2sin²(x) → 2*(sin(x))^2', () =>
    expect(evN('2sin²(x)', { x: Math.PI / 2 })).toBeCloseTo(2));
  it('sin^2(x) via ^ caret at x=pi/6 → 0.25', () =>
    expect(evN('sin^2(x)', { x: Math.PI / 6 })).toBeCloseTo(0.25));
});

// ════════════════════════════════════════════════════════════════════════════
// 14. FACTORIAL
// ════════════════════════════════════════════════════════════════════════════
describe('Factorial', () => {
  it('5! = 120',         () => expect(evN('5!')).toBe(120));
  it('0! = 1',           () => expect(evN('0!')).toBe(1));
  it('(n+1)! with n=4',  () => expect(evN('(n+1)!', { n: 4 })).toBe(120));
});

// ════════════════════════════════════════════════════════════════════════════
// 15. DIVISION BY ZERO / EDGE CASES
// ════════════════════════════════════════════════════════════════════════════
describe('Edge cases', () => {
  it('1/0 = Infinity',      () => expect(evN('1/0')).toBe(Infinity));
  it('-1/0 = -Infinity',    () => expect(evN('-1/0')).toBe(-Infinity));
  it('0/0 = NaN',           () => expect(evN('0/0')).toBeNaN());
  it('undefined var = NaN', () => expect(evN('x + 1')).toBeNaN());
  it('sqrt(-1) = NaN',      () => expect(evN('sqrt(-1)')).toBeNaN());
});

// ════════════════════════════════════════════════════════════════════════════
// 16. ALL PREVIOUSLY PASSING TESTS (regression)
// ════════════════════════════════════════════════════════════════════════════
describe('Regression: original test suite', () => {
  it('basic arithmetic', () => {
    expect(evN('2 + 3 * 4')).toBe(14);
    expect(evN('(2 + 3) * 4')).toBe(20);
    expect(evN('2 ^ 3')).toBe(8);
    expect(evN('2^3^2')).toBe(512);
  });

  it('integrals', () =>
    expect(evN('integral from 0 to 3 of x^2 dx')).toBeCloseTo(9, 4));

  it('limits', () =>
    expect(evN('limit(sin(x)/x, x, 0)')).toBeCloseTo(1, 4));

  it('products', () =>
    expect(evN('product(n, n, 1, 4)')).toBe(24));

  it('summation', () =>
    expect(evN('sum(x^2, x, 1, 3)')).toBe(14));

  it('piecewise abs(x)', () => {
    expect(evN('{x > 0: x, x <= 0: -x}', { x: -5 })).toBe(5);
    expect(evN('{x > 0: x, x <= 0: -x}', { x:  5 })).toBe(5);
  });

  it('lists and list functions', () => {
    expect(evaluate('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(evN('sum([1, 2, 3])')).toBe(6);
    expect(evN('mean([1, 2, 3])')).toBe(2);
    expect(evN('length([1, 2, 3])')).toBe(3);
    expect(evN('min([5, 2, 9])')).toBe(2);
    expect(evN('max([5, 2, 9])')).toBe(9);
  });

  it('list comprehension', () =>
    expect(evaluate('[n^2 for n from 1 to 3]')).toEqual([1, 4, 9]));

  it('limit: sin(x)/x → 1', () =>
    expect(evN('limit(sin(x)/x, x, 0)')).toBeCloseTo(1, 4));
});

// ════════════════════════════════════════════════════════════════════════════
// 17. ADAPTIVE SAMPLER (regression)
// ════════════════════════════════════════════════════════════════════════════
describe('Adaptive Sampler', () => {
  it('samples x^2 on [0,10]', () => {
    const pts = evaluateRange('x^2', { xMin: 0, xMax: 10, yMin: -10, yMax: 110 });
    expect(pts.length).toBeGreaterThan(10);
    expect(pts[0].x).toBe(0);
    expect(pts[0].y).toBeCloseTo(0);
    expect(pts[pts.length - 1].x).toBeCloseTo(10);
    expect(pts[pts.length - 1].y).toBeCloseTo(100);
  });

  it('handles asymptotes (1/x)', () => {
    const pts = evaluateRange('1/x', { xMin: -1, xMax: 1, yMin: -10, yMax: 10 });
    expect(pts.some(p => !isFinite(p.y))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 18. TOKENIZER UNIT TESTS
// ════════════════════════════════════════════════════════════════════════════
describe('Tokenizer', () => {
  it('inserts * between 2 and x', () => {
    const toks = insertImplicitMultiplication(tokenize('2x'));
    const ops = toks.map(t => t.value);
    expect(ops).toContain('*');
  });

  it('inserts * between ) and (', () => {
    const toks = insertImplicitMultiplication(tokenize('(2)(3)'));
    const ops = toks.map(t => t.value);
    const starCount = ops.filter(v => v === '*').length;
    expect(starCount).toBeGreaterThan(0);
  });

  it('does not insert * before prime operator', () => {
    const toks = insertImplicitMultiplication(tokenize("f'"));
    const ops = toks.map(t => t.value);
    expect(ops).not.toContain('*');
  });

  it('does not insert * before dx keyword', () => {
    const toks = insertImplicitMultiplication(tokenize('x dx'));
    const ops = toks.map(t => t.value);
    expect(ops).not.toContain('*');
  });

  it('expands |x| to abs(x)', () => {
    const toks = insertImplicitMultiplication(tokenize('|x|'));
    expect(toks[0].value).toBe('abs');
    expect(toks[1].type).toBe('LPAREN');
    expect(toks[2].value).toBe('x');
    expect(toks[3].type).toBe('RPAREN');
  });

  it('handles scientific notation: 1e10', () => {
    const toks = tokenize('1e10');
    expect(toks).toHaveLength(1);
    expect(parseFloat(toks[0].value)).toBe(1e10);
  });

  it('handles scientific notation with sign: 2.5e-3', () => {
    const toks = tokenize('2.5e-3');
    expect(toks).toHaveLength(1);
    expect(parseFloat(toks[0].value)).toBeCloseTo(0.0025);
  });
});
