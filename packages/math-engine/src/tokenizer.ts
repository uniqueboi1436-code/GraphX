import { Token, TokenType } from './types';

// ── Full set of recognised function names ────────────────────────────────────
const FUNCTIONS = new Set([
  // Trig
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sec', 'csc', 'cosec', 'cot', 'asec', 'acsc', 'acosec', 'acot',
  // Hyperbolic
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sech', 'csch', 'cosech', 'coth', 'asech', 'acsch', 'acosech', 'acoth',
  // Logarithmic / exponential
  'log', 'ln', 'exp', 'log2', 'log10',
  // Root
  'sqrt', 'cbrt', 'nthroot',
  // Rounding / sign
  'abs', 'floor', 'ceil', 'round', 'sign',
  // Multi-arg
  'min', 'max', 'mod', 'gcd', 'lcm', 'hypot', 'pow',
  // Stats / list
  'sum', 'product', 'mean', 'length',
  // Calculus keywords (parsed specially)
  'integral', 'limit',
]);

// Unicode superscript digit → ASCII digit
const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

// Unicode constants — map to their ASCII equivalents
const UNICODE_CONSTANTS: Record<string, string> = {
  'π': 'pi',
  'τ': 'tau',
  'ℯ': 'e',
  '∞': 'Infinity',
};

/** Pre-process input: replace Unicode math symbols before tokenising */
function preprocess(input: string): string {
  // Replace unicode superscripts with ^N  e.g. x² → x^2, sin²(x) → sin^2(x)
  // Do this BEFORE replacing unicode constants so π² works
  let out = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    // Unicode constant substitution
    if (ch in UNICODE_CONSTANTS) {
      // Add space padding so "πx" becomes "pi x" not "pix"
      out += ' ' + UNICODE_CONSTANTS[ch] + ' ';
      i++;
    } else if (ch in SUPERSCRIPT_MAP) {
      out += '^';
      // Collect consecutive superscript digits
      while (i < input.length && input[i] in SUPERSCRIPT_MAP) {
        out += SUPERSCRIPT_MAP[input[i]];
        i++;
      }
    } else {
      out += ch;
      i++;
    }
  }

  return out;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  input = preprocess(input);
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // Skip whitespace
    if (/\s/.test(char)) { i++; continue; }

    // d/dx, d/dy, d/dz, d/dt — derivative operator
    if (/^d\/d[a-zA-Z]/.test(input.slice(i))) {
      tokens.push({ type: 'FUNCTION', value: input.substring(i, i + 4) });
      i += 4;
      continue;
    }

    // Numbers (including decimals and scientific notation)
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let numStr = '';
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i++];
      }
      // Scientific notation: 1e10, 2.5e-3
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        const savedI = i;
        let sci = input[i++]; // 'e'
        if (i < input.length && (input[i] === '+' || input[i] === '-')) sci += input[i++];
        if (/[0-9]/.test(input[i] ?? '')) {
          while (i < input.length && /[0-9]/.test(input[i])) sci += input[i++];
          numStr += sci;
        } else {
          i = savedI; // not scientific notation, backtrack
        }
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i++];
      }

      // log with base: log_2(x), log_e(x), log_10(x)
      if (ident.startsWith('log_')) {
        tokens.push({ type: 'FUNCTION', value: ident });
        continue;
      }

      // Known multi-letter function? (check longest match first)
      if (FUNCTIONS.has(ident)) {
        tokens.push({ type: 'FUNCTION', value: ident });
        continue;
      }

      // Known keyword / constant?
      const KEYWORDS = [
        'pi', 'e', 'tau', 'Infinity', 'inf',
        'from', 'to', 'of', 'for',
        'dx', 'dy', 'dz', 'dt', 'dtheta',
        // Greek letters used in parametric/polar equations
        'theta', 'phi', 'psi', 'omega', 'alpha', 'beta', 'gamma', 'delta',
        'epsilon', 'lambda', 'sigma', 'mu', 'nu', 'rho', 'chi', 'eta', 'kappa',
      ];
      if (KEYWORDS.includes(ident)) {
        tokens.push({ type: 'IDENTIFIER', value: ident });
        continue;
      }

      // d-variable (dx, dy, etc.) captured above — handle d-prefixed multi-char here
      if (ident.startsWith('d') && ident.length > 1 && !ident.includes('_')) {
        tokens.push({ type: 'IDENTIFIER', value: ident });
        continue;
      }

      // Otherwise: try to match known multi-char functions greedily from the START
      // e.g. "sinx" → sin + x, "asinx" → asin + x, "coshx" → cosh + x
      let remaining = ident;
      while (remaining.length > 0) {
        // Try to match a function name at the start (longest first)
        let matched = false;
        // Sort by length descending to get longest match
        const funcNames = [...FUNCTIONS].sort((a, b) => b.length - a.length);
        for (const fn of funcNames) {
          if (remaining.startsWith(fn)) {
            tokens.push({ type: 'FUNCTION', value: fn });
            remaining = remaining.slice(fn.length);
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Try to match a keyword/constant at the start
          const kwNames = ['Infinity', 'pi', 'tau', 'inf', 'e'];
          let kwMatched = false;
          for (const kw of kwNames) {
            if (remaining.startsWith(kw) && (remaining.length === kw.length || !/[a-zA-Z0-9]/.test(remaining[kw.length]))) {
              tokens.push({ type: 'IDENTIFIER', value: kw });
              remaining = remaining.slice(kw.length);
              kwMatched = true;
              break;
            }
          }
          if (!kwMatched) {
            // Single character variable (with optional subscript)
            let varName = remaining[0];
            remaining = remaining.slice(1);
            if (remaining.startsWith('_')) {
              varName += '_';
              remaining = remaining.slice(1);
              while (remaining.length > 0 && /[a-zA-Z0-9]/.test(remaining[0])) {
                varName += remaining[0];
                remaining = remaining.slice(1);
              }
            }
            tokens.push({ type: 'IDENTIFIER', value: varName });
          }
        }
      }
      continue;
    }

    // Grouping
    if (char === '(') { tokens.push({ type: 'LPAREN',   value: char }); i++; continue; }
    if (char === ')') { tokens.push({ type: 'RPAREN',   value: char }); i++; continue; }
    if (char === '{') { tokens.push({ type: 'LBRACE',   value: char }); i++; continue; }
    if (char === '}') { tokens.push({ type: 'RBRACE',   value: char }); i++; continue; }
    if (char === '[') { tokens.push({ type: 'LBRACKET', value: char }); i++; continue; }
    if (char === ']') { tokens.push({ type: 'RBRACKET', value: char }); i++; continue; }
    if (char === ':') { tokens.push({ type: 'COLON',    value: char }); i++; continue; }
    if (char === ',') { tokens.push({ type: 'COMMA',    value: char }); i++; continue; }
    if (char === "'") { tokens.push({ type: 'OPERATOR', value: char }); i++; continue; }

    // Operators (multi-char first)
    if (/[+\-*/^!=<>%]/.test(char)) {
      if (i + 1 < input.length && input[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: char + '=' });
        i += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: char });
        i++;
      }
      continue;
    }

    // Absolute value bars: |x| → abs(x) — treat | as special delimiter
    if (char === '|') {
      tokens.push({ type: 'OPERATOR', value: '|' });
      i++;
      continue;
    }

    throw new Error(`Unknown character at position ${i}: '${char}' (U+${char.charCodeAt(0).toString(16).padStart(4, '0')})`);
  }

  return tokens;
}

// ── Keywords that should NOT trigger implicit multiplication before them ──────
const NO_MULT_BEFORE = new Set([
  "'", 'dx', 'dy', 'dz', 'dt', 'dtheta', 'for', 'from', 'to', 'of',
]);
const NO_MULT_AFTER = new Set(['for', 'from', 'to', 'of']);

export function insertImplicitMultiplication(tokens: Token[]): Token[] {
  // First pass: handle pipe |…| pairs as abs(…)
  const pipeExpanded = expandAbsoluteBars(tokens);

  const result: Token[] = [];

  for (let i = 0; i < pipeExpanded.length; i++) {
    const curr = pipeExpanded[i];
    const prev = result[result.length - 1];

    if (prev) {
      const currIsVal =
        curr.type === 'IDENTIFIER' ||
        curr.type === 'FUNCTION' ||
        curr.type === 'LPAREN' ||
        curr.type === 'LBRACKET' ||
        curr.type === 'NUMBER';

      let needsMult =
        (prev.type === 'NUMBER'     && currIsVal) ||
        (prev.type === 'IDENTIFIER' && (curr.type === 'IDENTIFIER' || curr.type === 'FUNCTION' || curr.type === 'LPAREN' || curr.type === 'NUMBER')) ||
        (prev.type === 'RPAREN'     && currIsVal) ||
        (prev.type === 'RBRACKET'   && currIsVal) ||
        (prev.type === 'RBRACE'     && currIsVal);

      // Suppress before special tokens
      if (NO_MULT_BEFORE.has(curr.value)) needsMult = false;
      if (prev.type === 'IDENTIFIER' && NO_MULT_AFTER.has(prev.value)) needsMult = false;

      // Don't insert * between FUNCTION and its opening paren
      // (that's a normal function call handled by parser)
      if (prev.type === 'FUNCTION' && curr.type === 'LPAREN') needsMult = false;

      // Don't insert * between FUNCTION and ^ (power notation like sin^2)
      if (prev.type === 'FUNCTION' && curr.type === 'OPERATOR' && curr.value === '^') needsMult = false;

      if (needsMult) {
        result.push({ type: 'OPERATOR', value: '*' });
      }
    }

    result.push(curr);
  }

  return result;
}

/**
 * Convert |expr| pairs into abs(expr) at the token level.
 * Handles nesting by tracking depth.
 */
function expandAbsoluteBars(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'OPERATOR' && t.value === '|') {
      // Find matching closing |
      let depth = 1;
      let j = i + 1;
      while (j < tokens.length) {
        if (tokens[j].type === 'OPERATOR' && tokens[j].value === '|') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth === 0) {
        // Replace |...| with abs(...)
        const inner = expandAbsoluteBars(tokens.slice(i + 1, j));
        result.push(
          { type: 'FUNCTION', value: 'abs' },
          { type: 'LPAREN',   value: '(' },
          ...inner,
          { type: 'RPAREN',   value: ')' },
        );
        i = j + 1;
        continue;
      }
    }
    result.push(t);
    i++;
  }
  return result;
}
