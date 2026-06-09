export type TokenType = 
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COLON'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

export type Expr =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'binary'; op: string; left: Expr; right: Expr }
  | { type: 'unary'; op: string; operand: Expr }
  | { type: 'function'; name: string; args: Expr[] }
  | { type: 'derivative'; varName: string; expr: Expr; degree: number }
  | { type: 'integral'; varName: string; start: Expr; end: Expr; expr: Expr }
  | { type: 'summation'; varName: string; start: Expr; end: Expr; expr: Expr }
  | { type: 'product'; varName: string; start: Expr; end: Expr; expr: Expr }
  | { type: 'piecewise'; conditions: { cond: Expr; expr: Expr }[] }
  | { type: 'list'; elements: Expr[] }
  | { type: 'list_comprehension'; varName: string; start: Expr; end: Expr; expr: Expr }
  | { type: 'limit'; varName: string; target: Expr; expr: Expr };

export interface CustomFunction {
  param: string;
  body: Expr;
}
