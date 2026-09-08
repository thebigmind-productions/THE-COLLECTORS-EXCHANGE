import { describe, it, expect } from 'vitest';
import {
  INDIAN_STATES,
  INDIAN_UNION_TERRITORIES,
  INDIAN_STATES_AND_UTS,
  canonicalIndianState,
} from '../indianStates';

describe('indianStates', () => {
  it('has all 28 states and all 8 union territories', () => {
    expect(INDIAN_STATES).toHaveLength(28);
    expect(INDIAN_UNION_TERRITORIES).toHaveLength(8);
    expect(INDIAN_STATES_AND_UTS).toHaveLength(36);
  });

  it('has no duplicates', () => {
    expect(new Set(INDIAN_STATES_AND_UTS).size).toBe(36);
  });

  it('lists states alphabetically, so the <select> reads the way it is scanned', () => {
    expect([...INDIAN_STATES].sort()).toEqual(INDIAN_STATES);
    expect([...INDIAN_UNION_TERRITORIES].sort()).toEqual(INDIAN_UNION_TERRITORIES);
  });

  it('carries the post-2019/2020 reorganisation, not the old list', () => {
    // Telangana is a state, J&K and Ladakh are UTs, and Dadra & Nagar Haveli
    // merged with Daman & Diu. A stale list here puts a dead state on a label.
    expect(INDIAN_STATES).toContain('Telangana');
    expect(INDIAN_UNION_TERRITORIES).toContain('Jammu and Kashmir');
    expect(INDIAN_UNION_TERRITORIES).toContain('Ladakh');
    expect(INDIAN_UNION_TERRITORIES).toContain('Dadra and Nagar Haveli and Daman and Diu');
    expect(INDIAN_STATES).not.toContain('Orissa');
    expect(INDIAN_STATES).toContain('Odisha');
  });
});

describe('canonicalIndianState', () => {
  it('returns the canonical spelling for an exact match', () => {
    expect(canonicalIndianState('Maharashtra')).toBe('Maharashtra');
  });

  it('is case- and whitespace-insensitive, because India Post is not consistent', () => {
    expect(canonicalIndianState('  maharashtra ')).toBe('Maharashtra');
    expect(canonicalIndianState('TAMIL   NADU')).toBe('Tamil Nadu');
  });

  it('returns null for anything it cannot place', () => {
    // A <select> cannot hold a value that is not one of its options, so an
    // unmatched name has to become null rather than silently blanking the field.
    expect(canonicalIndianState('MH')).toBeNull();
    expect(canonicalIndianState('Bombay')).toBeNull();
    expect(canonicalIndianState('')).toBeNull();
    expect(canonicalIndianState(null)).toBeNull();
    expect(canonicalIndianState(undefined)).toBeNull();
    expect(canonicalIndianState(400001)).toBeNull();
  });
});
