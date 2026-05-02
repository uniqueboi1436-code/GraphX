import { describe, it, expect } from 'vitest';
import { evaluate } from './index';

describe('math-engine', () => {
  it('should evaluate', () => {
    expect(evaluate('2 + 2')).toBe(42);
  });
});
