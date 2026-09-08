import { z } from 'zod';

/**
 * Vendor payout destination.
 *
 * UPI-only, deliberately. A UPI ID ("name@bank") is a payment *address*, not an
 * account number + IFSC, so it stays clear of the heavier obligations that
 * storing full bank credentials would attract — while still covering the large
 * majority of Indian sellers. See docs/migrations/2026-09-04-payout-upi-and-outbox.sql.
 *
 * Validation is deliberately loose about the local part and strict about exactly
 * one thing: the PSP handle. Real handles vary a lot (`ybl`, `okhdfcbank`,
 * `paytm`, `apl`, `axl`, `upi`, `jio`, `abfspay`, `idfcbank`…), so anything
 * alphanumeric is accepted there — but no NPCI handle contains a dot, and that
 * single rule is what stops the most common mistake by far: a seller typing
 * their email address (`someone@gmail.com`) into the payout field and then
 * waiting for money that can never arrive.
 */

// local part: what the PSP knows you by — a phone number, a name, an id.
// 2-256 chars of letters/digits/dot/hyphen/underscore, not starting or ending
// on a separator.
const UPI_LOCAL = /^[a-z0-9]([a-z0-9._-]{0,254}[a-z0-9])?$/;

// handle: the PSP itself. Letters and digits only — never a dot, which is what
// makes `foo@gmail.com` fail here rather than silently becoming a payout target.
const UPI_HANDLE = /^[a-z0-9]{2,64}$/;

export const UPI_FORMAT_MESSAGE =
  'Enter a valid UPI ID like 9876543210@ybl or yourname@okhdfcbank — not an email address';

/**
 * Is this a plausible UPI ID? Input is expected already trimmed + lowercased.
 * @param {string} value
 */
export function isValidUpiId(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 5 || value.length > 255) return false;
  // Exactly one '@'. `a@b@c` is not a VPA, and splitting on the last '@' would
  // quietly accept it.
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, handle] = parts;
  return UPI_LOCAL.test(local) && UPI_HANDLE.test(handle);
}

/** Trim + lowercase. UPI IDs are case-insensitive, so this is a safe normalisation. */
export const normalizeUpiId = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Mask a UPI ID for display: `9876543210@ybl` -> `98******10@ybl`.
 *
 * The handle is kept whole and the first/last two characters of the local part
 * survive, which is enough for a seller to recognise *which* of their UPI IDs is
 * on file without the full address being echoed back into logs, screenshots or
 * a support chat.
 *
 * @param {string|null|undefined} upi
 * @returns {string|null}
 */
export function maskUpiId(upi) {
  if (typeof upi !== 'string' || !upi.includes('@')) return null;
  const at = upi.indexOf('@');
  const local = upi.slice(0, at);
  const handle = upi.slice(at); // includes the '@'
  if (local.length <= 4) {
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 1))}${handle}`;
  }
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 4)}${local.slice(-2)}${handle}`;
}

export const PayoutDetailsSchema = z.object({
  payoutUpi: z
    .string()
    .transform(normalizeUpiId)
    .refine(isValidUpiId, { message: UPI_FORMAT_MESSAGE }),
  // The name the UPI app shows for that ID. Optional — most apps display it on
  // their own — but when present it is what the operator checks the transfer
  // against before sending money.
  payoutUpiName: z
    .string()
    .trim()
    .max(100, 'Name is too long')
    .optional()
    .transform((v) => (v ? v : null)),
});
