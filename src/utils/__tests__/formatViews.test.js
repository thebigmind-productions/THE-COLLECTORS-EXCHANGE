import { describe, it, expect } from 'vitest';
import { formatViewCount } from '../formatViews';

describe('formatViewCount', () => {
  it('returns null for zero, negative, or invalid input', () => {
    expect(formatViewCount(0)).toBeNull();
    expect(formatViewCount(-5)).toBeNull();
    expect(formatViewCount(undefined)).toBeNull();
    expect(formatViewCount(null)).toBeNull();
    expect(formatViewCount('abc')).toBeNull();
  });

  it('returns plain number under 1000', () => {
    expect(formatViewCount(1)).toBe('1');
    expect(formatViewCount(42)).toBe('42');
    expect(formatViewCount(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatViewCount(1000)).toBe('1K');
    expect(formatViewCount(1234)).toBe('1.2K');
    expect(formatViewCount(15000)).toBe('15K');
    expect(formatViewCount(999999)).toBe('1000K');
  });

  it('formats millions with M suffix', () => {
    expect(formatViewCount(1000000)).toBe('1M');
    expect(formatViewCount(2500000)).toBe('2.5M');
    expect(formatViewCount(12000000)).toBe('12M');
  });

  it('accepts numeric strings', () => {
    expect(formatViewCount('1234')).toBe('1.2K');
  });
});
