/**
 * The 28 states and 8 union territories of India, as a shared module.
 *
 * Checkout used to collect the state as free text with "Maharashtra" as a
 * placeholder, so "MH", "maharastra" and "Mahrashtra" all went straight onto
 * the courier label. A closed list is the only way that stops.
 *
 * Plain ESM, no React and no imports, so a Node build script can load it too.
 *
 * Names are the official English spellings used by India Post, which matters:
 * `api.postalpincode.in` returns its `State` field in exactly these strings, so
 * a PIN-code lookup result can be matched against this list without a fuzzy
 * compare. If you edit a name here, check it still matches what India Post
 * returns for a PIN in that state.
 *
 * Ordered alphabetically within each group, states first — the same order the
 * <select> renders, so the list reads the way a form-filler expects.
 */

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const INDIAN_UNION_TERRITORIES = [
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

/** Every state and union territory, flat. 36 entries. */
export const INDIAN_STATES_AND_UTS = [...INDIAN_STATES, ...INDIAN_UNION_TERRITORIES];

/**
 * Match a state name from an outside source (India Post's PIN lookup) against
 * the canonical list, case- and spacing-insensitively. Returns the canonical
 * spelling, or null when there is no match — a null must never be written into
 * the form, because a <select> cannot hold a value that is not one of its
 * options and would silently blank the field.
 */
export function canonicalIndianState(name) {
  if (!name || typeof name !== 'string') return null;
  const needle = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return INDIAN_STATES_AND_UTS.find((s) => s.toLowerCase() === needle) || null;
}
