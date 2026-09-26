export function normalizeTerm(value: string, locale?: string): string {
  return value.trim().normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase(
    locale,
  );
}
