/**
 * The currencies a property can price in.
 *
 * Short on purpose. The reference design offers two; this offers the ones a
 * host in this region actually quotes in, and no more. A currency in the list
 * is a currency every price format, every OTA export and every payment
 * provider has to handle, so adding one is a decision rather than a line.
 *
 * Amounts are stored as whole numbers of the MAJOR unit — đồng, and dollars.
 * Not cents.
 *
 * This comment used to say the opposite, and described a `minorUnits` field
 * that no code ever read. Everything that actually runs disagrees with it:
 * stripeAmount() multiplies a USD amount by 100 to reach cents, paypalAmount()
 * writes it as "76.00", and every screen prints the stored integer as-is. A
 * reader who believed the old comment and stored 5323 for $53.23 would have
 * charged a guest $5,323. The field is gone rather than corrected, because an
 * unused number that has to be right is a trap with no upside.
 *
 * `symbolAfter` is the one real formatting difference between the two: 76 ₫
 * puts the symbol last, $76 puts it first.
 */

export type Currency = {
  code: string;
  symbol: string;
  /** Whether the symbol trails the number, as ₫ does and $ does not. */
  symbolAfter: boolean;
};

export const CURRENCIES: readonly Currency[] = [
  { code: "VND", symbol: "₫", symbolAfter: true },
  { code: "USD", symbol: "$", symbolAfter: false },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function isCurrencyCode(code: string): boolean {
  return BY_CODE.has(code);
}

export function currencySymbol(code: string): string {
  return BY_CODE.get(code)?.symbol ?? code;
}

/** Whether this currency writes its symbol after the number. */
export function currencySymbolAfter(code: string): boolean {
  return BY_CODE.get(code)?.symbolAfter ?? true;
}
