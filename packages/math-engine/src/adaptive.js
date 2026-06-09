"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRange = evaluateRange;
var evaluator_1 = require("./evaluator");
var parser_1 = require("./parser");
var BLOW_UP_FACTOR = 20;
function isDiscontinuity(evalAt, xPrev, yPrev, xCurr, yCurr, visibleHeight) {
    if (!isFinite(yPrev) || !isFinite(yCurr))
        return true;
    var threshold = visibleHeight * BLOW_UP_FACTOR;
    var dy = Math.abs(yCurr - yPrev);
    if (dy > threshold && Math.sign(yCurr) !== Math.sign(yPrev))
        return true;
    var ym = evalAt((xPrev + xCurr) / 2);
    if (!isFinite(ym))
        return true;
    if (dy > visibleHeight * 0.005) {
        var err_y = Math.abs(ym - (yPrev + yCurr) / 2);
        var err_y_norm = err_y / dy;
        if (err_y_norm > 0.48) {
            return true;
        }
    }
    if (Math.sign(yPrev) !== Math.sign(yCurr)) {
        var t = (0 - 1 / yPrev) / (1 / yCurr - 1 / yPrev);
        if (t > 0 && t < 1 && yPrev !== 0 && yCurr !== 0 && ym !== 0) {
            var err_y = Math.abs(ym - (yPrev + yCurr) / 2);
            var dyInv = Math.abs(1 / yCurr - 1 / yPrev);
            if (dyInv !== 0 && dy !== 0) {
                var err_inv = Math.abs(1 / ym - (1 / yPrev + 1 / yCurr) / 2);
                if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
                    return true;
                }
            }
        }
    }
    else {
        var absInvM = Math.abs(1 / ym);
        var absInv0 = Math.abs(1 / yPrev);
        var absInv1 = Math.abs(1 / yCurr);
        if (absInvM < absInv0 && absInvM < absInv1 && yPrev !== 0 && yCurr !== 0 && ym !== 0) {
            var err_y = Math.abs(ym - (yPrev + yCurr) / 2);
            var dyInv = Math.abs(1 / yCurr - 1 / yPrev);
            if (dyInv !== 0 && dy !== 0) {
                var err_inv = Math.abs(1 / ym - (1 / yPrev + 1 / yCurr) / 2);
                if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
                    return true;
                }
            }
        }
    }
    return false;
}
function findAsymptoteX(evalAt, x0, y0, x1, y1, visibleHeight, iterations) {
    if (iterations === void 0) { iterations = 12; }
    var lo = x0, hi = x1;
    var yLo = y0;
    for (var i = 0; i < iterations; i++) {
        var xm = (lo + hi) / 2;
        var ym = evalAt(xm);
        var isInvalid = function (y) { return isNaN(y) || !isFinite(y); };
        if (isInvalid(yLo)) {
            if (isInvalid(ym)) {
                lo = xm;
                yLo = ym;
            }
            else {
                hi = xm;
            }
        }
        else if (isInvalid(y1)) {
            if (isInvalid(ym)) {
                hi = xm;
            }
            else {
                lo = xm;
                yLo = ym;
            }
        }
        else {
            if (isDiscontinuity(evalAt, lo, yLo, xm, ym, visibleHeight)) {
                hi = xm;
            }
            else {
                lo = xm;
                yLo = ym;
            }
        }
    }
    if (isNaN(y0) || !isFinite(y0))
        return hi;
    if (isNaN(y1) || !isFinite(y1))
        return lo;
    return (lo + hi) / 2;
}
function evaluateRange(expr, window, customFunctions) {
    if (customFunctions === void 0) { customFunctions = {}; }
    var ast = typeof expr === 'string' ? (0, parser_1.parse)(expr) : expr;
    var evalAt = function (x) { return (0, evaluator_1.evaluateAST)(ast, { x: x }, customFunctions); };
    var xMin = window.xMin, xMax = window.xMax, yMin = window.yMin, yMax = window.yMax;
    var width = xMax - xMin;
    var height = yMax - yMin;
    var scanSamples = 20;
    var zeroCrossings = 0;
    var lastScanY = evalAt(xMin);
    for (var i = 1; i <= scanSamples; i++) {
        var x = xMin + (i / scanSamples) * width;
        var y = evalAt(x);
        if (isFinite(lastScanY) && isFinite(y)) {
            if (Math.sign(y) !== Math.sign(lastScanY) && Math.sign(lastScanY) !== 0) {
                zeroCrossings++;
            }
        }
        lastScanY = y;
    }
    var estimatedFrequency = zeroCrossings / width;
    var steps = Math.min(5000, Math.max(500, Math.floor(estimatedFrequency * 20 * width)));
    var initialStep = width / steps;
    var rawPoints = [];
    for (var i = 0; i <= steps; i++) {
        var x0 = xMin + i * initialStep;
        var y0 = evalAt(x0);
        rawPoints.push({ x: x0, y: y0 });
        if (i < steps) {
            var x1 = xMin + (i + 1) * initialStep;
            var y1 = evalAt(x1);
            var dx1 = initialStep / width;
            var dy1 = (y1 - y0) / height;
            var angle = Math.atan2(dy1, dx1);
            adaptiveSample(x0, y0, x1, y1, rawPoints, 0, evalAt, angle, width, height);
        }
    }
    rawPoints.sort(function (a, b) { return a.x - b.x; });
    var clampY = function (y) {
        if (!isFinite(y) || isNaN(y))
            return NaN;
        var limit = height * BLOW_UP_FACTOR;
        if (y > yMax + limit || y < yMin - limit)
            return NaN;
        return y;
    };
    var finalPoints = [];
    for (var i = 0; i < rawPoints.length; i++) {
        var raw = rawPoints[i];
        if (i === 0) {
            finalPoints.push({ x: raw.x, y: clampY(raw.y) });
            continue;
        }
        var prevRaw = rawPoints[i - 1];
        if (isDiscontinuity(evalAt, prevRaw.x, prevRaw.y, raw.x, raw.y, height)) {
            var xBreak = findAsymptoteX(evalAt, prevRaw.x, prevRaw.y, raw.x, raw.y, height);
            var yBreak = evalAt(xBreak);
            if (!isFinite(prevRaw.y) && isFinite(yBreak)) {
                finalPoints.push({ x: xBreak, y: clampY(yBreak) });
            }
            else if (!isFinite(raw.y) && isFinite(yBreak)) {
                finalPoints.push({ x: xBreak, y: clampY(yBreak) });
                finalPoints.push({ x: xBreak, y: NaN });
            }
            else {
                finalPoints.push({ x: xBreak, y: NaN });
            }
        }
        finalPoints.push({ x: raw.x, y: clampY(raw.y) });
    }
    return finalPoints;
}
function adaptiveSample(x0, y0, x1, y1, points, depth, evalAt, prevAngle, width, height) {
    var MAX_DEPTH = 6;
    if (depth >= MAX_DEPTH)
        return;
    var xm = (x0 + x1) / 2;
    var ym = evalAt(xm);
    var shouldSubdivide = false;
    var isInvalid = function (y) { return isNaN(y) || !isFinite(y); };
    if (isInvalid(y0) && isInvalid(y1) && isInvalid(ym)) {
        points.push({ x: xm, y: ym });
        return;
    }
    if (isInvalid(y0) !== isInvalid(y1) || isInvalid(y0) !== isInvalid(ym)) {
        shouldSubdivide = true;
    }
    if (!shouldSubdivide) {
        var dx1 = (xm - x0) / width;
        var dy1 = (ym - y0) / height;
        var angle1 = Math.atan2(dy1, dx1);
        var dx2 = (x1 - xm) / width;
        var dy2 = (y1 - ym) / height;
        var angle2 = Math.atan2(dy2, dx2);
        if (Math.abs(angle1 - prevAngle) > 0.05 || Math.abs(angle2 - angle1) > 0.05) {
            shouldSubdivide = true;
        }
        if (!shouldSubdivide && y0 !== 0 && y1 !== 0 && ym !== 0) {
            var dy = Math.abs(y1 - y0);
            if (dy !== 0) {
                if (Math.sign(y0) !== Math.sign(y1)) {
                    var t = (0 - 1 / y0) / (1 / y1 - 1 / y0);
                    if (t > 0 && t < 1) {
                        var err_y = Math.abs(ym - (y0 + y1) / 2);
                        var dyInv = Math.abs(1 / y1 - 1 / y0);
                        if (dyInv !== 0) {
                            var err_inv = Math.abs(1 / ym - (1 / y0 + 1 / y1) / 2);
                            if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
                                shouldSubdivide = true;
                            }
                        }
                    }
                }
                else {
                    var absInvM = Math.abs(1 / ym);
                    var absInv0 = Math.abs(1 / y0);
                    var absInv1 = Math.abs(1 / y1);
                    if (absInvM < absInv0 && absInvM < absInv1) {
                        var err_y = Math.abs(ym - (y0 + y1) / 2);
                        var dyInv = Math.abs(1 / y1 - 1 / y0);
                        if (dyInv !== 0) {
                            var err_inv = Math.abs(1 / ym - (1 / y0 + 1 / y1) / 2);
                            if (err_inv / dyInv < err_y / dy && err_y / dy > 0.01) {
                                shouldSubdivide = true;
                            }
                        }
                    }
                }
            }
        }
        if (shouldSubdivide) {
            points.push({ x: xm, y: ym });
            adaptiveSample(x0, y0, xm, ym, points, depth + 1, evalAt, angle1, width, height);
            adaptiveSample(xm, ym, x1, y1, points, depth + 1, evalAt, angle2, width, height);
        }
    }
    else {
        points.push({ x: xm, y: ym });
        adaptiveSample(x0, y0, xm, ym, points, depth + 1, evalAt, prevAngle, width, height);
        adaptiveSample(xm, ym, x1, y1, points, depth + 1, evalAt, prevAngle, width, height);
    }
}
