import { parse } from './parser';
import { evaluateAST } from './evaluator';
import { evaluateRange, Point2D, GraphWindow } from './adaptive';
import { detectType, ExpressionType } from './detector';
import { getUndefinedVariables, collectVariables } from './variables';
import { fitRegression, fitLinear, fitQuadratic, fitExponential, fitPower, fitSinusoidal } from './regression';
import type { RegressionResult, RegressionType } from './regression';
import { findRoots, findExtrema, findIntersections, getYIntercept, formatFraction, formatCoordinates } from './poi';
import type { POI } from './poi';
import { evaluateInequality, detectInequalityOp } from './inequality';
import type { InequalityRegion, InequalityOp } from './inequality';

export function evaluate(expression: string, variables: Record<string, number> = {}): number | number[] {
  const ast = parse(expression);
  return evaluateAST(ast, variables);
}

export {
  evaluateRange, detectType, parse, evaluateAST,
  getUndefinedVariables, collectVariables,
  fitRegression, fitLinear, fitQuadratic, fitExponential, fitPower, fitSinusoidal,
  findRoots, findExtrema, findIntersections, getYIntercept, formatFraction, formatCoordinates,
  evaluateInequality, detectInequalityOp,
};
export type { Point2D, GraphWindow, ExpressionType, RegressionResult, RegressionType, POI, InequalityRegion, InequalityOp };
