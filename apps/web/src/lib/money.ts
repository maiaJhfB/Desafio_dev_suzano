const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(centavos: number): string {
  return formatter.format(centavos / 100);
}

/** Convert decimal text directly to integer cents, without floating point rounding. */
export function parseMoney(input: string): number | null {
  const value = input.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const [integer, decimal = ''] = value.replaceAll('.', '').split(',');
  const cents = Number(integer) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100000000 ? cents : null;
}

export function moneyInput(centavos: number | undefined): string {
  return centavos === undefined ? '' : (centavos / 100).toFixed(2).replace('.', ',');
}
