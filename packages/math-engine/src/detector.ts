export type ExpressionType = 
  | 'equation' 
  | 'inequality' 
  | 'point' 
  | 'parametric' 
  | 'polar' 
  | 'list' 
  | 'assignment' 
  | 'function_def';

export function detectType(exprStr: string): ExpressionType {
  const trimmed = exprStr.trim();
  
  // Point: (a, b)
  if (/^\(.*\)$/.test(trimmed) && trimmed.includes(',')) {
    // Basic parametric vs point check can be tricky. Usually a point is numeric, but parametric uses `t`.
    if (trimmed.includes('t')) return 'parametric';
    return 'point';
  }

  // List: [a, b, c]
  if (/^\[.*\]$/.test(trimmed)) {
    return 'list';
  }

  // Inequality: <, <=, >, >=
  if (/<|<=|>|>=/.test(trimmed)) {
    return 'inequality';
  }

  // Function Def: f(x) = ...
  if (/^[a-zA-Z]+\s*\([^)]*\)\s*=/.test(trimmed)) {
    return 'function_def';
  }

  // Assignment: a = ... (single variable, not x or y which are usually equations)
  if (/^[a-zA-Z]+(_[a-zA-Z0-9]+)?\s*=/.test(trimmed)) {
    const leftSide = trimmed.split('=')[0].trim();
    if (leftSide !== 'x' && leftSide !== 'y' && leftSide !== 'r' && leftSide !== 'theta') {
      return 'assignment';
    }
  }

  // Polar: r = ... or contains theta
  if (trimmed.startsWith('r=') || trimmed.startsWith('r =') || trimmed.includes('theta')) {
    return 'polar';
  }

  // Equation: contains =
  if (trimmed.includes('=')) {
    return 'equation';
  }

  // Default to equation if no other match (e.g., standard f(x) = expression)
  return 'equation';
}
