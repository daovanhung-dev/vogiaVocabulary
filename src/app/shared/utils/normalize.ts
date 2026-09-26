export function normalizeTerm(value: string, locale?: string): string {
  return value
    .trim()
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase(locale);
}

export function parseBatchInput(value: string): string[] {
  const tokens = value
    .split(/[\n,;]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  return Array.from(new Set(tokens.map((token) => normalizeTerm(token))));
}
