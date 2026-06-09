"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var adaptive_1 = require("./src/adaptive");
var window = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
var pts = (0, adaptive_1.evaluateRange)('floor(x)', window);
console.log('Points near x=1:');
console.log(pts.filter(function (p) { return p.x > 0.9 && p.x < 1.1; }));
