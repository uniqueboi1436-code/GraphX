import * as fs from 'fs';

function cleanLatex(latex: string): string {
  let s = latex;

  // ── Delimiters ──────────────────────────────────────────────────────────
  s = s.replace(/\\left\s*\|/g, 'abs(');
  s = s.replace(/\\right\s*\|/g, ')');
  s = s.replace(/\\left\s*\(/g, '(');
  s = s.replace(/\\right\s*\)/g, ')');
  s = s.replace(/\\left\s*\[/g, '(');
  s = s.replace(/\\right\s*\]/g, ')');
  s = s.replace(/\\left\s*\{/g, '(');
  s = s.replace(/\\right\s*\}/g, ')');

  // ── Fractions (handle up to 2 levels of nesting greedily) ──────────────
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  }

  // ── Roots ───────────────────────────────────────────────────────────────
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]*)\}/g, '($2)^(1/($1))'); // nth root
  s = s.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');

  // ── Operators ───────────────────────────────────────────────────────────
  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\times/g, '*');
  s = s.replace(/\\div/g, '/');

  // ── Trig & functions ────────────────────────────────────────────────────
  s = s.replace(/\\operatorname\{([^}]+)\}/g, '$1');
  s = s.replace(/\\sin/g, 'sin');
  s = s.replace(/\\cos/g, 'cos');
  s = s.replace(/\\tan/g, 'tan');
  s = s.replace(/\\sec/g, 'sec');
  s = s.replace(/\\csc/g, 'csc');
  s = s.replace(/\\cot/g, 'cot');
  s = s.replace(/\\arcsin/g, 'arcsin');
  s = s.replace(/\\arccos/g, 'arccos');
  s = s.replace(/\\arctan/g, 'arctan');
  s = s.replace(/\\sinh/g, 'sinh');
  s = s.replace(/\\cosh/g, 'cosh');
  s = s.replace(/\\tanh/g, 'tanh');
  s = s.replace(/\\ln/g, 'ln');
  s = s.replace(/\\log/g, 'log');
  s = s.replace(/\\exp/g, 'exp');
  s = s.replace(/\\abs/g, 'abs');
  s = s.replace(/\\max/g, 'max');
  s = s.replace(/\\min/g, 'min');
  s = s.replace(/\\mod/g, 'mod');
  s = s.replace(/\\ceil/g, 'ceil');
  s = s.replace(/\\floor/g, 'floor');
  s = s.replace(/\\sign/g, 'sign');

  // ── Greek letters ───────────────────────────────────────────────────────
  s = s.replace(/\\pi/g, 'pi');
  s = s.replace(/\\theta/g, 'theta');

  // ── Constants ───────────────────────────────────────────────────────────
  s = s.replace(/\\infty/g, 'Infinity');
  s = s.replace(/\\infinity/g, 'Infinity');
  s = s.replace(/\\e(?![a-zA-Z])/g, 'e');

  // ── Comparison operators ─────────────────────────────────────────────
  s = s.replace(/\\le(?![a-zA-Z])/g, '<=');
  s = s.replace(/\\ge(?![a-zA-Z])/g, '>=');
  s = s.replace(/\\ne(?![a-zA-Z])/g, '!=');
  s = s.replace(/\\neq/g, '!=');
  s = s.replace(/\\leq/g, '<=');
  s = s.replace(/\\geq/g, '>=');

  s = s.replace(/\\int/g, 'int');
  s = s.replace(/\\sum/g, 'sum');
  s = s.replace(/\\prod/g, 'prod');
  s = s.replace(/\\_\{/g, '_{');
  s = s.replace(/\\\^\{/g, '^{');

  // ── Strip remaining LaTeX backslash commands ────────────────────────────
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');

  return s;
}

const q = "\\left(\\cos\\left(t\\right),\\ \\sin\\left(t\\right)\\right)";
console.log("Original:", q);
console.log("Cleaned:", cleanLatex(q));

