"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATH_FUNCS = exports.CONSTANTS = void 0;
exports.evaluateAST = evaluateAST;
// Lanczos approximation for Gamma function
function gamma(z) {
    if (z < 0.5)
        return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    var g = 7;
    var p = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278220812,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    z -= 1;
    var x = p[0];
    for (var i = 1; i < g + 2; i++) {
        x += p[i] / (z + i);
    }
    var t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}
function factorial(n) {
    if (n < 0)
        return NaN;
    if (!Number.isInteger(n))
        return gamma(n + 1);
    var res = 1;
    for (var i = 2; i <= n; i++)
        res *= i;
    return res;
}
exports.CONSTANTS = {
    pi: Math.PI,
    tau: 2 * Math.PI,
    e: Math.E,
    Infinity: Infinity,
    inf: Infinity,
};
exports.MATH_FUNCS = {
    // Trig
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sec: function (x) { return 1 / Math.cos(x); },
    csc: function (x) { return 1 / Math.sin(x); },
    cosec: function (x) { return 1 / Math.sin(x); },
    cot: function (x) { return 1 / Math.tan(x); },
    asec: function (x) { return Math.acos(1 / x); },
    acsc: function (x) { return Math.asin(1 / x); },
    acosec: function (x) { return Math.asin(1 / x); },
    acot: function (x) { return Math.PI / 2 - Math.atan(x); },
    // Hyperbolic
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    sech: function (x) { return 1 / Math.cosh(x); },
    csch: function (x) { return 1 / Math.sinh(x); },
    cosech: function (x) { return 1 / Math.sinh(x); },
    coth: function (x) { return 1 / Math.tanh(x); },
    asech: function (x) { return Math.acosh(1 / x); },
    acsch: function (x) { return Math.asinh(1 / x); },
    acosech: function (x) { return Math.asinh(1 / x); },
    acoth: function (x) { return Math.atanh(1 / x); },
    // Exponential / log
    log: Math.log10, ln: Math.log, exp: Math.exp,
    // Roots
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    nthroot: function (n, x) { return Math.pow(x, 1 / n); },
    // Rounding / sign
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
    round: Math.round, sign: Math.sign,
    // Two-arg
    mod: function (a, b) { return ((a % b) + b) % b; }, // always positive modulo
    hypot: Math.hypot,
    pow: Math.pow,
    gcd: function (a, b) {
        var _a;
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) {
            _a = [b, a % b], a = _a[0], b = _a[1];
        }
        return a;
    },
    lcm: function (a, b) { var g = function (x, y) { return y ? g(y, x % y) : x; }; return Math.abs(a * b) / g(Math.abs(a), Math.abs(b)); },
    // Scalar min / max (also handles arrays below)
    min: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return Math.min.apply(Math, args);
    },
    max: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return Math.max.apply(Math, args);
    },
    // Utility
    log2: Math.log2,
    log10: Math.log10,
};
function evaluateAST(expr, vars, customFunctions, memoCache) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (vars === void 0) { vars = {}; }
    if (customFunctions === void 0) { customFunctions = {}; }
    var ev = function (e, v) {
        if (v === void 0) { v = vars; }
        return evaluateAST(e, v, customFunctions, memoCache);
    };
    switch (expr.type) {
        case 'number':
            return expr.value;
        case 'variable': {
            if (expr.name in exports.CONSTANTS)
                return exports.CONSTANTS[expr.name];
            if (expr.name in vars)
                return vars[expr.name];
            return NaN;
        }
        case 'binary': {
            var left = ev(expr.left);
            var right = ev(expr.right);
            switch (expr.op) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/': return left / right;
                case '^': return Math.pow(left, right);
                case 'mod': return ((left % right) + right) % right;
                case '<': return left < right ? 1 : 0;
                case '<=': return left <= right ? 1 : 0;
                case '>': return left > right ? 1 : 0;
                case '>=': return left >= right ? 1 : 0;
                case '==': return left === right ? 1 : 0;
                case '!=': return left !== right ? 1 : 0;
            }
            return NaN;
        }
        case 'unary': {
            var operand = ev(expr.operand);
            switch (expr.op) {
                case '-': return -operand;
                case '+': return operand;
                case '!': return factorial(operand);
            }
            return NaN;
        }
        case 'function': {
            // ── List aggregate functions ────────────────────────────────────────
            if (['sum', 'mean', 'length'].includes(expr.name)) {
                var arr = ev(expr.args[0]);
                if (!Array.isArray(arr)) {
                    // sum(expr, var, start, end) is handled in parser → summation node
                    // but if called directly as a function with 1 arg that isn't an array, return NaN
                    return NaN;
                }
                if (expr.name === 'length')
                    return arr.length;
                if (arr.length === 0)
                    return NaN;
                var s = arr.reduce(function (a, b) { return a + b; }, 0);
                if (expr.name === 'sum')
                    return s;
                return s / arr.length;
            }
            // min / max: handle both scalar multi-arg and single array arg
            if (expr.name === 'min' || expr.name === 'max') {
                if (expr.args.length === 1) {
                    var v = ev(expr.args[0]);
                    if (Array.isArray(v))
                        return expr.name === 'min' ? Math.min.apply(Math, v) : Math.max.apply(Math, v);
                    return v;
                }
                var vals = expr.args.map(function (a) { return ev(a); });
                return expr.name === 'min' ? Math.min.apply(Math, vals) : Math.max.apply(Math, vals);
            }
            // ── log_base(x) dynamic base ────────────────────────────────────────
            if (expr.name.startsWith('log_')) {
                var baseStr = expr.name.slice(4);
                var base = parseFloat(baseStr);
                if (isNaN(base)) {
                    // Try resolving as a constant/variable (e.g. log_e)
                    if (baseStr in exports.CONSTANTS) {
                        base = exports.CONSTANTS[baseStr];
                    }
                    else {
                        base = ev({ type: 'variable', name: baseStr });
                    }
                }
                var arg = ev(expr.args[0]);
                return Math.log(arg) / Math.log(base);
            }
            if (expr.name in exports.MATH_FUNCS) {
                var args = expr.args.map(function (a) { return ev(a); });
                return exports.MATH_FUNCS[expr.name].apply(exports.MATH_FUNCS, args);
            }
            if (expr.name in customFunctions) {
                var funcDef = customFunctions[expr.name];
                var argVal = ev(expr.args[0]);
                var cacheKey = "".concat(expr.name, "(").concat(argVal, ")");
                if (memoCache && memoCache.has(cacheKey))
                    return memoCache.get(cacheKey);
                var newVars = __assign(__assign({}, vars), (_a = {}, _a[funcDef.param] = argVal, _a));
                var result = evaluateAST(funcDef.body, newVars, customFunctions, memoCache);
                if (memoCache)
                    memoCache.set(cacheKey, result);
                return result;
            }
            // Fallback: treat as implicit multiplication if not a known function
            var fallbackVal = ev({ type: 'variable', name: expr.name });
            if (expr.args.length > 0) {
                return fallbackVal * ev(expr.args[0]);
            }
            return fallbackVal;
        }
        case 'derivative': {
            var h = 1e-4;
            var x = (expr.varName in vars ? vars[expr.varName] : NaN);
            if (isNaN(x))
                return NaN;
            var vRight = __assign(__assign({}, vars), (_b = {}, _b[expr.varName] = x + h, _b));
            var vLeft = __assign(__assign({}, vars), (_c = {}, _c[expr.varName] = x - h, _c));
            var f1 = evaluateAST(expr.expr, vRight, customFunctions, memoCache);
            var f2 = evaluateAST(expr.expr, vLeft, customFunctions, memoCache);
            if (expr.degree === 1) {
                return (f1 - f2) / (2 * h);
            }
            else {
                var f0 = evaluateAST(expr.expr, vars, customFunctions, memoCache);
                return (f1 - 2 * f0 + f2) / (h * h);
            }
        }
        case 'limit': {
            var target = ev(expr.target);
            if (isNaN(target))
                return NaN;
            var h = 1e-9;
            var vRight = __assign(__assign({}, vars), (_d = {}, _d[expr.varName] = target + h, _d));
            var vLeft = __assign(__assign({}, vars), (_e = {}, _e[expr.varName] = target - h, _e));
            var f1 = evaluateAST(expr.expr, vRight, customFunctions, memoCache);
            var f2 = evaluateAST(expr.expr, vLeft, customFunctions, memoCache);
            if (isNaN(f1))
                return f2;
            if (isNaN(f2))
                return f1;
            return (f1 + f2) / 2;
        }
        case 'integral': {
            var start = ev(expr.start);
            var end = ev(expr.end);
            if (isNaN(start) || isNaN(end))
                return NaN;
            var n = 1000;
            var h = (end - start) / n;
            var sum = evaluateAST(expr.expr, __assign(__assign({}, vars), (_f = {}, _f[expr.varName] = start, _f)), customFunctions, memoCache) +
                evaluateAST(expr.expr, __assign(__assign({}, vars), (_g = {}, _g[expr.varName] = end, _g)), customFunctions, memoCache);
            for (var i = 1; i < n; i++) {
                var x = start + i * h;
                var fx = evaluateAST(expr.expr, __assign(__assign({}, vars), (_h = {}, _h[expr.varName] = x, _h)), customFunctions, memoCache);
                sum += (i % 2 === 0 ? 2 : 4) * fx;
            }
            return (sum * h) / 3;
        }
        case 'summation':
        case 'product': {
            var start = ev(expr.start);
            var end = ev(expr.end);
            if (isNaN(start) || isNaN(end))
                return NaN;
            var res = expr.type === 'summation' ? 0 : 1;
            for (var i = start; i <= end; i++) {
                var val = evaluateAST(expr.expr, __assign(__assign({}, vars), (_j = {}, _j[expr.varName] = i, _j)), customFunctions, memoCache);
                if (expr.type === 'summation')
                    res += val;
                else
                    res *= val;
            }
            return res;
        }
        case 'piecewise': {
            for (var _i = 0, _l = expr.conditions; _i < _l.length; _i++) {
                var _m = _l[_i], cond = _m.cond, retExpr = _m.expr;
                var c = ev(cond);
                if (c > 0)
                    return ev(retExpr);
            }
            return NaN;
        }
        case 'list': {
            return expr.elements.map(function (e) { return ev(e); });
        }
        case 'list_comprehension': {
            var start = ev(expr.start);
            var end = ev(expr.end);
            var res = [];
            if (isNaN(start) || isNaN(end))
                return res;
            for (var i = start; i <= end; i++) {
                res.push(evaluateAST(expr.expr, __assign(__assign({}, vars), (_k = {}, _k[expr.varName] = i, _k)), customFunctions, memoCache));
            }
            return res;
        }
    }
}
