import { Token, Expr } from './types';
import { tokenize, insertImplicitMultiplication } from './tokenizer';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(input: string) {
    this.tokens = insertImplicitMultiplication(tokenize(input));
  }

  private peek(): Token | null {
    if (this.pos >= this.tokens.length) return null;
    return this.tokens[this.pos];
  }

  private consume(expectedType?: string, expectedValue?: string): Token {
    const token = this.peek();
    if (!token) {
      throw new Error('Unexpected end of input');
    }
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected token type ${expectedType}, got ${token.type} ("${token.value}")`);
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(`Expected token value "${expectedValue}", got "${token.value}"`);
    }
    this.pos++;
    return token;
  }

  private match(type: string, value?: string): boolean {
    const token = this.peek();
    if (token && token.type === type && (value === undefined || token.value === value)) {
      this.consume();
      return true;
    }
    return false;
  }

  public parse(): Expr {
    const expr = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at end: "${this.peek()?.value}"`);
    }
    return expr;
  }

  private parseExpression(): Expr {
    let expr = this.parseAddSub();
    while (true) {
      const token = this.peek();
      if (token && token.type === 'OPERATOR' && ['<', '>', '<=', '>=', '==', '!='].includes(token.value)) {
        this.consume();
        const right = this.parseAddSub();
        expr = { type: 'binary', op: token.value, left: expr, right };
      } else {
        break;
      }
    }
    return expr;
  }

  private parseAddSub(): Expr {
    let expr = this.parseTerm();

    while (true) {
      const token = this.peek();
      if (token && token.type === 'OPERATOR' && (token.value === '+' || token.value === '-')) {
        this.consume();
        const right = this.parseTerm();
        expr = { type: 'binary', op: token.value, left: expr, right };
      } else {
        break;
      }
    }

    return expr;
  }

  private parseTerm(): Expr {
    let expr = this.parseUnary();

    while (true) {
      const token = this.peek();
      if (token && token.type === 'OPERATOR' && (token.value === '*' || token.value === '/' || token.value === 'mod')) {
        this.consume();
        const right = this.parseUnary();
        expr = { type: 'binary', op: token.value, left: expr, right };
      } else {
        break;
      }
    }

    return expr;
  }

  private parseUnary(): Expr {
    const token = this.peek();
    if (token && token.type === 'OPERATOR' && (token.value === '+' || token.value === '-')) {
      this.consume();
      const operand = this.parseUnary();
      // Optimization: +x → x
      if (token.value === '+') return operand;
      return { type: 'unary', op: token.value, operand };
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const expr = this.parsePostfix();

    const token = this.peek();
    if (token && token.type === 'OPERATOR' && token.value === '^') {
      this.consume();
      const right = this.parseUnary(); // right-associative power
      return { type: 'binary', op: '^', left: expr, right };
    }

    return expr;
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();

    // Factorial: expr!
    while (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '!') {
      this.consume();
      expr = { type: 'unary', op: '!', operand: expr };
    }

    return expr;
  }

  private parsePrimary(): Expr {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of input in primary expression');

    if (token.type === 'NUMBER') {
      this.consume();
      return { type: 'number', value: parseFloat(token.value) };
    }

    // ── FUNCTION token: sin, cos, sqrt, log_2, etc. ──────────────────────────
    if (token.type === 'FUNCTION') {
      this.consume();
      const name = token.value;

      // Calculus keywords
      if (name === 'integral') return this.parseIntegral();
      if (name === 'limit')    return this.parseLimit();

      // Derivative notation: d/dx
      if (name.startsWith('d/d')) {
        this.consume('LPAREN');
        const inner = this.parseExpression();
        this.consume('RPAREN');
        return { type: 'derivative', varName: name.substring(3), expr: inner, degree: 1 };
      }

      // Prime notation: f'(x)
      let primes = 0;
      while (this.match('OPERATOR', "'")) primes++;

      // sin^2(x) sugar: capture ^N BEFORE the ( — only when followed by NUMBER
      // Also handle sin^-1(x) -> map to asin(x)
      let funcPow: Expr | null = null;
      let isInverse = false;
      if (
        this.peek()?.type === 'OPERATOR' && this.peek()?.value === '^'
      ) {
        // Look two ahead: must be NUMBER or IDENTIFIER that can be an exponent
        const afterCaret = this.tokens[this.pos + 1];
        if (afterCaret?.type === 'NUMBER') {
          this.consume(); // ^
          funcPow = { type: 'number', value: parseFloat(this.consume('NUMBER').value) };
          // Implicit multiplication might have inserted a '*' between the number and '('
          if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '*') {
            this.consume();
          }
        } else if (afterCaret?.type === 'OPERATOR' && afterCaret?.value === '-') {
          const numToken = this.tokens[this.pos + 2];
          if (numToken?.type === 'NUMBER') {
            this.consume(); // ^
            this.consume(); // -
            const val = parseFloat(this.consume('NUMBER').value);
            if (val === 1) {
              isInverse = true;
            } else {
              funcPow = { type: 'unary', op: '-', operand: { type: 'number', value: val } };
            }
            if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '*') {
              this.consume();
            }
          }
        }
      }

      let funcName = name;
      if (isInverse) {
        if (!funcName.startsWith('a') && funcName !== 'integral' && funcName !== 'limit' && funcName !== 'log' && funcName !== 'ln' && funcName !== 'exp') {
          funcName = 'a' + funcName;
        } else if (funcName === 'ln' || funcName === 'exp') {
          // If they do ln^-1 or exp^-1, let's just make it a negative power
          funcPow = { type: 'number', value: -1 };
          isInverse = false;
        }
      }

      if (this.match('LPAREN')) {
        const args: Expr[] = [];
        if (this.peek()?.type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.match('COMMA')) args.push(this.parseExpression());
        }
        this.consume('RPAREN');

        if (name === 'sum' || name === 'product') {
          if (args.length === 4) {
            const varArg = args[1];
            if (varArg.type !== 'variable') throw new Error('Second arg to sum/product must be a variable');
            return {
              type: name === 'sum' ? 'summation' : 'product',
              varName: varArg.name,
              expr: args[0],
              start: args[2],
              end: args[3],
            };
          }
        }

        const funcExpr: Expr = { type: 'function', name: funcName, args };

        if (primes > 0) {
          const vn = args[0]?.type === 'variable' ? args[0].name : 'x';
          return { type: 'derivative', varName: vn, expr: funcExpr, degree: primes };
        }

        // sin^2(x) → sin(x)^2
        if (funcPow) return { type: 'binary', op: '^', left: funcExpr, right: funcPow };

        // sin(x)^2 — exponent AFTER the call
        if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '^') {
          this.consume();
          return { type: 'binary', op: '^', left: funcExpr, right: this.parseUnary() };
        }

        return funcExpr;
      }

      // Function used without parens (e.g. sin x — treat next token as argument)
      // Only do this if followed by an identifier or number that forms a valid argument
      if (funcPow || isInverse) {
        // sin^2 with no parens — unusual, just return the function as variable
        return { type: 'variable', name: funcName };
      }
      return { type: 'variable', name: funcName };
    }

    // ── IDENTIFIER token: variable, constant, or keyword ─────────────────────
    if (token.type === 'IDENTIFIER') {
      this.consume();
      const name = token.value;

      // Special calculus keywords
      if (name === 'integral') return this.parseIntegral();
      if (name === 'limit')    return this.parseLimit();

      // Derivative: d/dx — handled by tokenizer emitting it as FUNCTION, but just in case
      if (name.startsWith('d/d')) {
        this.consume('LPAREN');
        const inner = this.parseExpression();
        this.consume('RPAREN');
        return { type: 'derivative', varName: name.substring(3), expr: inner, degree: 1 };
      }

      // Prime: f'(x)
      let primes = 0;
      while (this.match('OPERATOR', "'")) primes++;

      // Is this a custom function call? (identifier followed by LPAREN)
      if (this.peek()?.type === 'LPAREN') {
        this.consume('LPAREN');
        const args: Expr[] = [];
        if (this.peek()?.type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.match('COMMA')) args.push(this.parseExpression());
        }
        this.consume('RPAREN');

        const funcExpr: Expr = { type: 'function', name, args };
        if (primes > 0) {
          const vn = args[0]?.type === 'variable' ? args[0].name : 'x';
          return { type: 'derivative', varName: vn, expr: funcExpr, degree: primes };
        }

        // f(x)^2 after call
        if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '^') {
          this.consume();
          return { type: 'binary', op: '^', left: funcExpr, right: this.parseUnary() };
        }

        return funcExpr;
      }

      const varExpr: Expr = { type: 'variable', name };
      if (primes > 0) {
        return { type: 'derivative', varName: 'x', expr: varExpr, degree: primes };
      }
      return varExpr;
    }

    if (token.type === 'LPAREN') {
      this.consume();
      const expr = this.parseExpression();

      if (this.peek()?.type === 'COMMA') {
        const elements: Expr[] = [expr];
        while (this.match('COMMA')) {
          elements.push(this.parseExpression());
        }
        this.consume('RPAREN');
        return { type: 'list', elements };
      }

      this.consume('RPAREN');
      return expr;
    }

    if (token.type === 'LBRACE') {
      this.consume();
      const conditions: {cond: Expr, expr: Expr}[] = [];
      while (this.peek()?.type !== 'RBRACE') {
        const cond = this.parseExpression();
        this.consume('COLON');
        const expr = this.parseExpression();
        conditions.push({ cond, expr });
        if (!this.match('COMMA')) break;
      }
      this.consume('RBRACE');
      return { type: 'piecewise', conditions };
    }

    if (token.type === 'LBRACKET') {
      this.consume();
      const elements: Expr[] = [];
      if (this.peek()?.type !== 'RBRACKET') {
        elements.push(this.parseExpression());
        if (elements.length === 1 && this.match('IDENTIFIER', 'for')) {
          const varToken = this.consume('IDENTIFIER');
          this.consume('IDENTIFIER', 'from');
          const start = this.parseExpression();
          this.consume('IDENTIFIER', 'to');
          const end = this.parseExpression();
          this.consume('RBRACKET');
          return { type: 'list_comprehension', expr: elements[0], varName: varToken.value, start, end };
        }
        while (this.match('COMMA')) {
          elements.push(this.parseExpression());
        }
      }
      this.consume('RBRACKET');
      return { type: 'list', elements };
    }

    throw new Error(`Unexpected token in primary expression: "${token.value}" (type: ${token.type})`);
  }

  private parseIntegral(): Expr {
    this.consume('IDENTIFIER', 'from');
    const start = this.parseExpression();
    this.consume('IDENTIFIER', 'to');
    const end = this.parseExpression();
    this.match('IDENTIFIER', 'of'); // optional 'of'
    const expr = this.parseExpression();
    const dVar = this.consume('IDENTIFIER');
    let varName = 'x';
    if (dVar.value.startsWith('d') && dVar.value.length > 1) {
      varName = dVar.value.substring(1);
    } else {
      throw new Error('Expected dx, dy, etc. after integral');
    }
    return { type: 'integral', varName, start, end, expr };
  }

  private parseLimit(): Expr {
    this.consume('LPAREN');
    const expr = this.parseExpression();
    this.consume('COMMA');
    const varToken = this.consume('IDENTIFIER');
    this.consume('COMMA');
    const target = this.parseExpression();
    this.consume('RPAREN');
    return { type: 'limit', varName: varToken.value, target, expr };
  }
}

export function parse(input: string): Expr {
  const parser = new Parser(input);
  return parser.parse();
}
