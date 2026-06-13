import { Expr } from './types';
import { parse } from './parser';

const BUILTIN_CONSTANTS = new Set(['pi', 'e', 'Infinity']);
const BUILTIN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sec', 'csc', 'cosec', 'cot', 'asec', 'acsc', 'acosec', 'acot',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sech', 'csch', 'cosech', 'coth', 'asech', 'acsch', 'acosech', 'acoth',
  'log', 'ln', 'exp', 'log2', 'log10', 'log_2', 'log_10',
  'sqrt', 'cbrt', 'nthroot',
  'abs', 'floor', 'ceil', 'round', 'sign',
  'min', 'max', 'mod', 'gcd', 'lcm', 'hypot', 'pow',
  'sum', 'product', 'mean', 'length', 'integral', 'limit'
]);

/** Recursively collect every free variable name referenced in the AST */
export function collectVariables(expr: Expr, found: Set<string> = new Set()): Set<string> {
  switch (expr.type) {
    case 'variable':
      if (!BUILTIN_CONSTANTS.has(expr.name) && !BUILTIN_FUNCTIONS.has(expr.name)) {
        found.add(expr.name);
      }
      break;
    case 'binary':
      collectVariables(expr.left, found);
      collectVariables(expr.right, found);
      break;
    case 'unary':
      collectVariables(expr.operand, found);
      break;
    case 'function':
      expr.args.forEach(a => collectVariables(a, found));
      break;
    case 'derivative':
      collectVariables(expr.expr, found);
      break;
    case 'summation':
      collectVariables(expr.expr, found);
      collectVariables(expr.start, found);
      collectVariables(expr.end, found);
      break;
  }
  return found;
}

/**
 * Given a raw formula string, return variable names that are NOT in the
 * knownVars list (i.e., candidates for slider auto-creation).
 */
export function getUndefinedVariables(
  formula: string,
  knownVars: string[] = ['x', 'y', 't', 'theta', 'r']
): string[] {
  try {
    // Parse only the RHS if there's an equals sign
    let rhs = formula;
    if (formula.includes('=')) {
      const parts = formula.split('=');
      rhs = parts[1] ?? parts[0];
    }
    const ast = parse(rhs);
    const all = collectVariables(ast);
    const known = new Set(knownVars);
    return [...all].filter(v => !known.has(v)).sort();
  } catch {
    return [];
  }
}
