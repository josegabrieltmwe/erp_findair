/**
 * Country flag helpers. The ERP stores country ISO-2 codes (IT, US, FR…)
 * and we render flags as Unicode regional-indicator pairs so we don't
 * have to ship a sprite/SVG bundle. Falls back to an empty string when
 * the input isn't a clean 2-letter code so callers can safely
 * concatenate.
 */

const REGIONAL_BASE = 0x1f1e6;
const A_CODEPOINT = "A".charCodeAt(0);

/** Convert an ISO-3166-1 alpha-2 code into the flag emoji. */
export function countryFlagEmoji(iso2: string | null | undefined): string {
  if (!iso2) return "";
  const code = String(iso2).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const first = REGIONAL_BASE + (code.charCodeAt(0) - A_CODEPOINT);
  const second = REGIONAL_BASE + (code.charCodeAt(1) - A_CODEPOINT);
  return String.fromCodePoint(first, second);
}

/** "IT" → "🇮🇹 IT". Empty string when the code is missing/invalid. */
export function countryWithFlag(iso2: string | null | undefined): string {
  const flag = countryFlagEmoji(iso2);
  if (!flag) return iso2 ? String(iso2).toUpperCase() : "";
  return `${flag} ${String(iso2).toUpperCase()}`;
}

/**
 * IATA airport → ISO-2 country (best effort, ~25 highest-traffic codes
 * we actually route through). Returns '' when unknown so callers fall
 * back gracefully. Extend as new lanes appear.
 */
const IATA_TO_COUNTRY: Record<string, string> = {
  // Italy
  MXP: "IT",
  LIN: "IT",
  FCO: "IT",
  BLQ: "IT",
  VCE: "IT",
  NAP: "IT",
  BGY: "IT",
  TRN: "IT",
  // Netherlands / Belgium / Germany / France / UK / Spain / Switzerland
  AMS: "NL",
  BRU: "BE",
  LGG: "BE",
  LUX: "LU",
  FRA: "DE",
  MUC: "DE",
  CGN: "DE",
  HHN: "DE",
  CDG: "FR",
  ORY: "FR",
  LYS: "FR",
  LHR: "GB",
  LGW: "GB",
  STN: "GB",
  MAN: "GB",
  EMA: "GB",
  MAD: "ES",
  BCN: "ES",
  VLC: "ES",
  ZRH: "CH",
  GVA: "CH",
  BSL: "CH",
  // Americas
  JFK: "US",
  EWR: "US",
  ORD: "US",
  MIA: "US",
  LAX: "US",
  ATL: "US",
  SFO: "US",
  BOS: "US",
  IAH: "US",
  YYZ: "CA",
  YVR: "CA",
  GRU: "BR",
  VCP: "BR",
  MEX: "MX",
  // Middle East / Asia / Africa / Oceania
  DXB: "AE",
  AUH: "AE",
  DOH: "QA",
  JED: "SA",
  RUH: "SA",
  TLV: "IL",
  HKG: "HK",
  PVG: "CN",
  PEK: "CN",
  CAN: "CN",
  SZX: "CN",
  NRT: "JP",
  HND: "JP",
  KIX: "JP",
  ICN: "KR",
  SIN: "SG",
  BKK: "TH",
  KUL: "MY",
  HAN: "VN",
  SGN: "VN",
  DEL: "IN",
  BOM: "IN",
  BLR: "IN",
  MAA: "IN",
  HYD: "IN",
  JNB: "ZA",
  NBO: "KE",
  CAI: "EG",
  ADD: "ET",
  SYD: "AU",
  MEL: "AU",
  AKL: "NZ",
};

/** Map an IATA airport code to the ISO-2 country. '' when unknown. */
export function iataToCountryIso(iata: string | null | undefined): string {
  if (!iata) return "";
  const code = String(iata).trim().toUpperCase();
  return IATA_TO_COUNTRY[code] ?? "";
}

/** Flag emoji for an IATA airport. Empty string when the IATA is unknown. */
export function iataFlagEmoji(iata: string | null | undefined): string {
  return countryFlagEmoji(iataToCountryIso(iata));
}
