// test.js
const { isFinite, isNaN } = Number;
const BLOW_UP_FACTOR = 20;

function isDiscontinuity(
  evalAt,
  xPrev,
  yPrev,
  xCurr,
  yCurr,
  visibleHeight
) {
  if (!isFinite(yPrev) || !isFinite(yCurr)) return true;

  const threshold = visibleHeight * BLOW_UP_FACTOR;
  const dy = Math.abs(yCurr - yPrev);

  if (dy > threshold && Math.sign(yCurr) !== Math.sign(yPrev)) return true;

  const ym = evalAt((xPrev + xCurr) / 2);
  if (!isFinite(ym)) return true;

  if (dy > 1e-12) {
    const err_y = Math.abs(ym - (yPrev + yCurr) / 2);
    const err_y_norm = err_y / dy;
    if (err_y_norm > 0.48) {
      return true;
    }
  }

  // ... rest of logic for asymptotes ...
  return false;
}

const evalAt = (x) => Math.ceil(x);
console.log(isDiscontinuity(evalAt, 0.99, evalAt(0.99), 1.01, evalAt(1.01), 10)); // Should be true

