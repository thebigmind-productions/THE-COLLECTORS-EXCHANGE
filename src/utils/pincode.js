import { canonicalIndianState } from '../config/indianStates';

/** Six digits, nothing else. Mirrors the server-side rule in backend/schemas/checkout.js. */
export const PIN_CODE_PATTERN = /^\d{6}$/;

const ENDPOINT = 'https://api.postalpincode.in/pincode';

/**
 * Look a six-digit Indian PIN code up against India Post's free public API and
 * return `{ city, state }`, or `null` if anything at all goes wrong.
 *
 * This is a CONVENIENCE, never a gate. It is a third-party service with no SLA,
 * no key and no uptime guarantee, reached over the network from a phone that may
 * be on 2G in a lift. Every failure path — offline, DNS failure, CORS, 500,
 * timeout, a PIN it does not know, a shape it did not used to return — resolves
 * to `null` and the buyer simply types the city and state themselves, exactly as
 * they did before this existed. Nothing here ever throws, and nothing here ever
 * blocks or fails a checkout.
 *
 * `state` is run through `canonicalIndianState` so the caller can put it
 * straight into the <select>: India Post's spelling occasionally differs in case
 * or spacing, and a value that is not one of the options would blank the field.
 * If it cannot be matched, `state` comes back null while `city` is still usable.
 *
 * @param {string} pin  six-digit PIN code
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<{ city: string|null, state: string|null }|null>}
 */
export async function lookupPincode(pin, { signal, timeoutMs = 5000 } = {}) {
  if (!PIN_CODE_PATTERN.test(String(pin || ''))) return null;

  // The API has no timeout of its own; a request left hanging would leave the
  // "Looking up..." hint on screen forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const res = await fetch(`${ENDPOINT}/${pin}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const body = await res.json();
    const entry = Array.isArray(body) ? body[0] : null;
    if (!entry || entry.Status !== 'Success') return null;

    const office = Array.isArray(entry.PostOffice) ? entry.PostOffice[0] : null;
    if (!office) return null;

    // District is what belongs on a courier label. `Name` is the individual post
    // office ("Fort Bazar S.O"), which is not a city and must not be used.
    const city =
      typeof office.District === 'string' && office.District.trim() ? office.District.trim() : null;

    return { city, state: canonicalIndianState(office.State) };
  } catch {
    // Includes AbortError, network failure, CORS and malformed JSON. All the
    // same to the buyer: they type it themselves.
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
