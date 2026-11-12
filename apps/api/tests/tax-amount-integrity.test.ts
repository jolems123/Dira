import { describe, expect, it } from 'vitest';
import { resolveTax } from '../src/lib/procurement-rules';

describe('tax amount integrity', () => {
  it('rejects negative taxable amounts instead of silently treating them as zero', () => {
    expect(() => resolveTax(-1)).toThrow(RangeError);
    expect(() => resolveTax(-1, 0)).toThrow(RangeError);
  });
  it('rejects tax results that exceed safe JavaScript monetary representation', () => {
    expect(() => resolveTax(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(() => resolveTax(0, Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
  it('accepts zero-rated and ordinary positive tax', () => {
    expect(resolveTax(100, 0)).toBe(0);
    expect(resolveTax(100)).toBe(18);
  });
});
