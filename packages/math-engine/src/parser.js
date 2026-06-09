"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
exports.parse = parse;
var tokenizer_1 = require("./tokenizer");
var Parser = /** @class */ (function () {
    function Parser(input) {
        this.pos = 0;
        this.tokens = (0, tokenizer_1.insertImplicitMultiplication)((0, tokenizer_1.tokenize)(input));
    }
    Parser.prototype.peek = function () {
        if (this.pos >= this.tokens.length)
            return null;
        return this.tokens[this.pos];
    };
    Parser.prototype.consume = function (expectedType, expectedValue) {
        var token = this.peek();
        if (!token) {
            throw new Error('Unexpected end of input');
        }
        if (expectedType && token.type !== expectedType) {
            throw new Error("Expected token type ".concat(expectedType, ", got ").concat(token.type, " (\"").concat(token.value, "\")"));
        }
        if (expectedValue && token.value !== expectedValue) {
            throw new Error("Expected token value \"".concat(expectedValue, "\", got \"").concat(token.value, "\""));
        }
        this.pos++;
        return token;
    };
    Parser.prototype.match = function (type, value) {
        var token = this.peek();
        if (token && token.type === type && (value === undefined || token.value === value)) {
            this.consume();
            return true;
        }
        return false;
    };
    Parser.prototype.parse = function () {
        var _a;
        var expr = this.parseExpression();
        if (this.pos < this.tokens.length) {
            throw new Error("Unexpected token at end: \"".concat((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.value, "\""));
        }
        return expr;
    };
    Parser.prototype.parseExpression = function () {
        var expr = this.parseAddSub();
        while (true) {
            var token = this.peek();
            if (token && token.type === 'OPERATOR' && ['<', '>', '<=', '>=', '==', '!='].includes(token.value)) {
                this.consume();
                var right = this.parseAddSub();
                expr = { type: 'binary', op: token.value, left: expr, right: right };
            }
            else {
                break;
            }
        }
        return expr;
    };
    Parser.prototype.parseAddSub = function () {
        var expr = this.parseTerm();
        while (true) {
            var token = this.peek();
            if (token && token.type === 'OPERATOR' && (token.value === '+' || token.value === '-')) {
                this.consume();
                var right = this.parseTerm();
                expr = { type: 'binary', op: token.value, left: expr, right: right };
            }
            else {
                break;
            }
        }
        return expr;
    };
    Parser.prototype.parseTerm = function () {
        var expr = this.parseUnary();
        while (true) {
            var token = this.peek();
            if (token && token.type === 'OPERATOR' && (token.value === '*' || token.value === '/' || token.value === 'mod')) {
                this.consume();
                var right = this.parseUnary();
                expr = { type: 'binary', op: token.value, left: expr, right: right };
            }
            else {
                break;
            }
        }
        return expr;
    };
    Parser.prototype.parseUnary = function () {
        var token = this.peek();
        if (token && token.type === 'OPERATOR' && (token.value === '+' || token.value === '-')) {
            this.consume();
            var operand = this.parseUnary();
            // Optimization: +x → x
            if (token.value === '+')
                return operand;
            return { type: 'unary', op: token.value, operand: operand };
        }
        return this.parsePower();
    };
    Parser.prototype.parsePower = function () {
        var expr = this.parsePostfix();
        var token = this.peek();
        if (token && token.type === 'OPERATOR' && token.value === '^') {
            this.consume();
            var right = this.parseUnary(); // right-associative power
            return { type: 'binary', op: '^', left: expr, right: right };
        }
        return expr;
    };
    Parser.prototype.parsePostfix = function () {
        var _a, _b;
        var expr = this.parsePrimary();
        // Factorial: expr!
        while (((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.type) === 'OPERATOR' && ((_b = this.peek()) === null || _b === void 0 ? void 0 : _b.value) === '!') {
            this.consume();
            expr = { type: 'unary', op: '!', operand: expr };
        }
        return expr;
    };
    Parser.prototype.parsePrimary = function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        var token = this.peek();
        if (!token)
            throw new Error('Unexpected end of input in primary expression');
        if (token.type === 'NUMBER') {
            this.consume();
            return { type: 'number', value: parseFloat(token.value) };
        }
        // ── FUNCTION token: sin, cos, sqrt, log_2, etc. ──────────────────────────
        if (token.type === 'FUNCTION') {
            this.consume();
            var name_1 = token.value;
            // Calculus keywords
            if (name_1 === 'integral')
                return this.parseIntegral();
            if (name_1 === 'limit')
                return this.parseLimit();
            // Derivative notation: d/dx
            if (name_1.startsWith('d/d')) {
                this.consume('LPAREN');
                var inner = this.parseExpression();
                this.consume('RPAREN');
                return { type: 'derivative', varName: name_1.substring(3), expr: inner, degree: 1 };
            }
            // Prime notation: f'(x)
            var primes = 0;
            while (this.match('OPERATOR', "'"))
                primes++;
            // sin^2(x) sugar: capture ^N BEFORE the ( — only when followed by NUMBER
            // Also handle sin^-1(x) -> map to asin(x)
            var funcPow = null;
            var isInverse = false;
            if (((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.type) === 'OPERATOR' && ((_b = this.peek()) === null || _b === void 0 ? void 0 : _b.value) === '^') {
                // Look two ahead: must be NUMBER or IDENTIFIER that can be an exponent
                var afterCaret = this.tokens[this.pos + 1];
                if ((afterCaret === null || afterCaret === void 0 ? void 0 : afterCaret.type) === 'NUMBER') {
                    this.consume(); // ^
                    funcPow = { type: 'number', value: parseFloat(this.consume('NUMBER').value) };
                    // Implicit multiplication might have inserted a '*' between the number and '('
                    if (((_c = this.peek()) === null || _c === void 0 ? void 0 : _c.type) === 'OPERATOR' && ((_d = this.peek()) === null || _d === void 0 ? void 0 : _d.value) === '*') {
                        this.consume();
                    }
                }
                else if ((afterCaret === null || afterCaret === void 0 ? void 0 : afterCaret.type) === 'OPERATOR' && (afterCaret === null || afterCaret === void 0 ? void 0 : afterCaret.value) === '-') {
                    var numToken = this.tokens[this.pos + 2];
                    if ((numToken === null || numToken === void 0 ? void 0 : numToken.type) === 'NUMBER') {
                        this.consume(); // ^
                        this.consume(); // -
                        var val = parseFloat(this.consume('NUMBER').value);
                        if (val === 1) {
                            isInverse = true;
                        }
                        else {
                            funcPow = { type: 'unary', op: '-', operand: { type: 'number', value: val } };
                        }
                        if (((_e = this.peek()) === null || _e === void 0 ? void 0 : _e.type) === 'OPERATOR' && ((_f = this.peek()) === null || _f === void 0 ? void 0 : _f.value) === '*') {
                            this.consume();
                        }
                    }
                }
            }
            var funcName = name_1;
            if (isInverse) {
                if (!funcName.startsWith('a') && funcName !== 'integral' && funcName !== 'limit' && funcName !== 'log' && funcName !== 'ln' && funcName !== 'exp') {
                    funcName = 'a' + funcName;
                }
                else if (funcName === 'ln' || funcName === 'exp') {
                    // If they do ln^-1 or exp^-1, let's just make it a negative power
                    funcPow = { type: 'number', value: -1 };
                    isInverse = false;
                }
            }
            if (this.match('LPAREN')) {
                var args = [];
                if (((_g = this.peek()) === null || _g === void 0 ? void 0 : _g.type) !== 'RPAREN') {
                    args.push(this.parseExpression());
                    while (this.match('COMMA'))
                        args.push(this.parseExpression());
                }
                this.consume('RPAREN');
                if (name_1 === 'sum' || name_1 === 'product') {
                    if (args.length === 4) {
                        var varArg = args[1];
                        if (varArg.type !== 'variable')
                            throw new Error('Second arg to sum/product must be a variable');
                        return {
                            type: name_1 === 'sum' ? 'summation' : 'product',
                            varName: varArg.name,
                            expr: args[0],
                            start: args[2],
                            end: args[3],
                        };
                    }
                }
                var funcExpr = { type: 'function', name: funcName, args: args };
                if (primes > 0) {
                    var vn = ((_h = args[0]) === null || _h === void 0 ? void 0 : _h.type) === 'variable' ? args[0].name : 'x';
                    return { type: 'derivative', varName: vn, expr: funcExpr, degree: primes };
                }
                // sin^2(x) → sin(x)^2
                if (funcPow)
                    return { type: 'binary', op: '^', left: funcExpr, right: funcPow };
                // sin(x)^2 — exponent AFTER the call
                if (((_j = this.peek()) === null || _j === void 0 ? void 0 : _j.type) === 'OPERATOR' && ((_k = this.peek()) === null || _k === void 0 ? void 0 : _k.value) === '^') {
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
            var name_2 = token.value;
            // Special calculus keywords
            if (name_2 === 'integral')
                return this.parseIntegral();
            if (name_2 === 'limit')
                return this.parseLimit();
            // Derivative: d/dx — handled by tokenizer emitting it as FUNCTION, but just in case
            if (name_2.startsWith('d/d')) {
                this.consume('LPAREN');
                var inner = this.parseExpression();
                this.consume('RPAREN');
                return { type: 'derivative', varName: name_2.substring(3), expr: inner, degree: 1 };
            }
            // Prime: f'(x)
            var primes = 0;
            while (this.match('OPERATOR', "'"))
                primes++;
            // Is this a custom function call? (identifier followed by LPAREN)
            if (((_l = this.peek()) === null || _l === void 0 ? void 0 : _l.type) === 'LPAREN') {
                this.consume('LPAREN');
                var args = [];
                if (((_m = this.peek()) === null || _m === void 0 ? void 0 : _m.type) !== 'RPAREN') {
                    args.push(this.parseExpression());
                    while (this.match('COMMA'))
                        args.push(this.parseExpression());
                }
                this.consume('RPAREN');
                var funcExpr = { type: 'function', name: name_2, args: args };
                if (primes > 0) {
                    var vn = ((_o = args[0]) === null || _o === void 0 ? void 0 : _o.type) === 'variable' ? args[0].name : 'x';
                    return { type: 'derivative', varName: vn, expr: funcExpr, degree: primes };
                }
                // f(x)^2 after call
                if (((_p = this.peek()) === null || _p === void 0 ? void 0 : _p.type) === 'OPERATOR' && ((_q = this.peek()) === null || _q === void 0 ? void 0 : _q.value) === '^') {
                    this.consume();
                    return { type: 'binary', op: '^', left: funcExpr, right: this.parseUnary() };
                }
                return funcExpr;
            }
            var varExpr = { type: 'variable', name: name_2 };
            if (primes > 0) {
                return { type: 'derivative', varName: 'x', expr: varExpr, degree: primes };
            }
            return varExpr;
        }
        if (token.type === 'LPAREN') {
            this.consume();
            var expr = this.parseExpression();
            this.consume('RPAREN');
            return expr;
        }
        if (token.type === 'LBRACE') {
            this.consume();
            var conditions = [];
            while (((_r = this.peek()) === null || _r === void 0 ? void 0 : _r.type) !== 'RBRACE') {
                var cond = this.parseExpression();
                this.consume('COLON');
                var expr = this.parseExpression();
                conditions.push({ cond: cond, expr: expr });
                if (!this.match('COMMA'))
                    break;
            }
            this.consume('RBRACE');
            return { type: 'piecewise', conditions: conditions };
        }
        if (token.type === 'LBRACKET') {
            this.consume();
            var elements = [];
            if (((_s = this.peek()) === null || _s === void 0 ? void 0 : _s.type) !== 'RBRACKET') {
                elements.push(this.parseExpression());
                if (elements.length === 1 && this.match('IDENTIFIER', 'for')) {
                    var varToken = this.consume('IDENTIFIER');
                    this.consume('IDENTIFIER', 'from');
                    var start = this.parseExpression();
                    this.consume('IDENTIFIER', 'to');
                    var end = this.parseExpression();
                    this.consume('RBRACKET');
                    return { type: 'list_comprehension', expr: elements[0], varName: varToken.value, start: start, end: end };
                }
                while (this.match('COMMA')) {
                    elements.push(this.parseExpression());
                }
            }
            this.consume('RBRACKET');
            return { type: 'list', elements: elements };
        }
        throw new Error("Unexpected token in primary expression: \"".concat(token.value, "\" (type: ").concat(token.type, ")"));
    };
    Parser.prototype.parseIntegral = function () {
        this.consume('IDENTIFIER', 'from');
        var start = this.parseExpression();
        this.consume('IDENTIFIER', 'to');
        var end = this.parseExpression();
        this.match('IDENTIFIER', 'of'); // optional 'of'
        var expr = this.parseExpression();
        var dVar = this.consume('IDENTIFIER');
        var varName = 'x';
        if (dVar.value.startsWith('d') && dVar.value.length > 1) {
            varName = dVar.value.substring(1);
        }
        else {
            throw new Error('Expected dx, dy, etc. after integral');
        }
        return { type: 'integral', varName: varName, start: start, end: end, expr: expr };
    };
    Parser.prototype.parseLimit = function () {
        this.consume('LPAREN');
        var expr = this.parseExpression();
        this.consume('COMMA');
        var varToken = this.consume('IDENTIFIER');
        this.consume('COMMA');
        var target = this.parseExpression();
        this.consume('RPAREN');
        return { type: 'limit', varName: varToken.value, target: target, expr: expr };
    };
    return Parser;
}());
exports.Parser = Parser;
function parse(input) {
    var parser = new Parser(input);
    return parser.parse();
}
