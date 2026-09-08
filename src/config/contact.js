/**
 * Single source of truth for how buyers reach The Collectors Exchange.
 *
 * Two different numbers used to be live at once — one on the floating
 * WhatsApp button and the product page, another in the footer, and a third
 * listed as the business phone in Terms. The owner has settled on
 * +91 97407 99109 as the one public number, so every call site imports it
 * from here instead of hard-coding a string.
 */

/** Human-readable form, for display in copy. */
export const SUPPORT_PHONE_DISPLAY = '+91 97407 99109';

/** E.164 form, for `tel:` hrefs. */
export const SUPPORT_PHONE_E164 = '+919740799109';

/** Digits only, no `+` — the shape wa.me expects in its path. */
export const SUPPORT_PHONE_WHATSAPP = '919740799109';

export const SUPPORT_EMAIL = 'support@thecollectorsexchange.in';

/** `tel:` href for the single public number. */
export const TEL_HREF = `tel:${SUPPORT_PHONE_E164}`;

/** `mailto:` href for the support inbox. */
export const MAILTO_HREF = `mailto:${SUPPORT_EMAIL}`;

/**
 * Build a wa.me link, optionally prefilled with a message.
 * @param {string} [message] Plain text; encoded here so callers don't have to.
 * @returns {string} A wa.me URL for the single public number.
 */
export const whatsAppHref = (message) =>
  message
    ? `https://wa.me/${SUPPORT_PHONE_WHATSAPP}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${SUPPORT_PHONE_WHATSAPP}`;

/**
 * Build a mailto: link with a subject and body.
 * @param {string} subject
 * @param {string} [body]
 * @returns {string}
 */
export const mailtoHref = (subject, body) => {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}?${params.join('&')}`;
};
