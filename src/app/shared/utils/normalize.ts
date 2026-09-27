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

export function uniqueByNormalizedTerm<T extends { term: string; normalizedTerm?: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeTerm(item.normalizedTerm || item.term);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
