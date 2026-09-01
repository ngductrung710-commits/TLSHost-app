/**
 * The currencies a property can price in.
 *
 * Short on purpose. The reference design offers two; this offers the ones a
 * host in this region actually quotes in, and no more. A currency in the list
 * is a currency every price format, every OTA export and every payment
 * provider has to handle, so adding one is a decision rather than a line.
 *
 * `minorUnits` is what stops VND from growing two decimal places it does not
 * have: prices are stored as whole numbers of the smallest unit, which for VND
 * is the đồng itself and for USD is the cent.
 */

export type Currency = {
  code: string;
  symbol: string;
  minorUnits: number;
};

export const CURRENCIES: readonly Currency[] = [
  { code: "VND", symbol: "₫", minorUnits: 0 },
  { code: "USD", symbol: "$", minorUnits: 2 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function isCurrencyCode(code: string): boolean {
  return BY_CODE.has(code);
}

export function currencySymbol(code: string): string {
  return BY_CODE.get(code)?.symbol ?? code;
}
