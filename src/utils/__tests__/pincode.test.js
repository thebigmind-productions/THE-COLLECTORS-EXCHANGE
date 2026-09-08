import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupPincode, PIN_CODE_PATTERN } from '../pincode';

const successBody = (overrides = {}) => [
  {
    Message: 'Number of pincode(s) found:1',
    Status: 'Success',
    PostOffice: [
      {
        Name: 'Fort Bazar S.O',
        District: 'Mumbai',
        State: 'Maharashtra',
        Country: 'India',
        ...overrides,
      },
    ],
  },
];

const mockFetch = (impl) => {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
};

describe('PIN_CODE_PATTERN', () => {
  it('accepts exactly six digits and nothing else', () => {
    expect(PIN_CODE_PATTERN.test('400001')).toBe(true);
    expect(PIN_CODE_PATTERN.test('4')).toBe(false);
    expect(PIN_CODE_PATTERN.test('40000')).toBe(false);
    expect(PIN_CODE_PATTERN.test('4000012')).toBe(false);
    expect(PIN_CODE_PATTERN.test('40000a')).toBe(false);
    expect(PIN_CODE_PATTERN.test('400 001')).toBe(false);
    expect(PIN_CODE_PATTERN.test('')).toBe(false);
  });
});

describe('lookupPincode', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the district as the city and the canonical state', async () => {
    mockFetch(async () => ({ ok: true, json: async () => successBody() }));
    await expect(lookupPincode('400001')).resolves.toEqual({
      city: 'Mumbai',
      state: 'Maharashtra',
    });
  });

  it('calls India Post with the PIN in the path', async () => {
    const spy = mockFetch(async () => ({ ok: true, json: async () => successBody() }));
    await lookupPincode('560001');
    expect(spy).toHaveBeenCalledWith(
      'https://api.postalpincode.in/pincode/560001',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('never calls the network for a PIN that cannot be one', async () => {
    const spy = mockFetch(async () => ({ ok: true, json: async () => successBody() }));
    expect(await lookupPincode('4')).toBeNull();
    expect(await lookupPincode('')).toBeNull();
    expect(await lookupPincode(undefined)).toBeNull();
    expect(await lookupPincode('abcdef')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  // Everything below is the degradation contract: the buyer types city and
  // state themselves and checkout is completely unaffected.
  it('returns null when the network is unreachable, and does not throw', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(lookupPincode('400001')).resolves.toBeNull();
  });

  it('returns null on a non-2xx response', async () => {
    mockFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(lookupPincode('400001')).resolves.toBeNull();
  });

  it('returns null when the API reports Error for an unknown PIN', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => [{ Message: 'No records found', Status: 'Error', PostOffice: null }],
    }));
    await expect(lookupPincode('999999')).resolves.toBeNull();
  });

  it('returns null on a body shape it does not recognise', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ unexpected: true }) }));
    await expect(lookupPincode('400001')).resolves.toBeNull();
  });

  it('returns null when the JSON is malformed', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));
    await expect(lookupPincode('400001')).resolves.toBeNull();
  });

  it('returns null when the caller aborts', async () => {
    mockFetch(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    const controller = new AbortController();
    const promise = lookupPincode('400001', { signal: controller.signal });
    controller.abort();
    await expect(promise).resolves.toBeNull();
  });

  it('gives up rather than hanging when the API never answers', async () => {
    vi.useFakeTimers();
    try {
      mockFetch(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            );
          }),
      );
      const promise = lookupPincode('400001', { timeoutMs: 5000 });
      await vi.advanceTimersByTimeAsync(5000);
      await expect(promise).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still returns the city when the state name cannot be matched to an option', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => successBody({ State: 'Bombay Presidency' }),
    }));
    await expect(lookupPincode('400001')).resolves.toEqual({
      city: 'Mumbai',
      state: null,
    });
  });

  it('never uses the post office Name as the city', async () => {
    mockFetch(async () => ({ ok: true, json: async () => successBody({ District: '   ' }) }));
    await expect(lookupPincode('400001')).resolves.toEqual({
      city: null,
      state: 'Maharashtra',
    });
  });
});
