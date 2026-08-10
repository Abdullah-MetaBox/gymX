import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

/**
 * Translatable *content* — the text a gym types, as opposed to the UI chrome
 * the product ships.
 *
 * Two different problems, two different mechanisms. UI strings live in message
 * catalogues keyed by a stable id. Content like a plan name ("Lunch
 * membership" / "Abonnement midi") is data the gym owns, so it lives in the
 * row as a JSONB column shaped `{"en": "...", "fr": "..."}`.
 *
 * Phase 2 uses this for `plans.name_i18n` and `plans.description_i18n`. It is
 * built now so no later phase has to retrofit a column type.
 */
export type I18nText = Partial<Record<Locale, string>>;

export interface ResolveOptions {
  /** Tried after the requested locale. Usually the gym's default. */
  fallbackLocale?: Locale;
  /** Returned when nothing is set at all. */
  placeholder?: string;
}

/**
 * Read a translatable field.
 *
 * Falls back rather than rendering an empty cell: requested locale, then the
 * gym default, then English, then any populated value. A half-translated
 * catalogue should look unpolished, never broken.
 */
export function text(
  field: I18nText | null | undefined,
  locale: Locale,
  options: ResolveOptions = {},
): string {
  const { fallbackLocale, placeholder = '' } = options;
  if (!field) return placeholder;

  const candidates: (Locale | undefined)[] = [locale, fallbackLocale, DEFAULT_LOCALE];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const value = field[candidate];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }

  for (const value of Object.values(field)) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }

  return placeholder;
}

/** True when every enabled locale has a non-empty value. Drives "needs translation" badges. */
export function isComplete(
  field: I18nText | null | undefined,
  locales: readonly Locale[],
): boolean {
  if (!field) return false;
  return locales.every((locale) => (field[locale] ?? '').trim() !== '');
}

/** Locales still awaiting a translation. */
export function missingLocales(
  field: I18nText | null | undefined,
  locales: readonly Locale[],
): Locale[] {
  return locales.filter((locale) => (field?.[locale] ?? '').trim() === '');
}

/** Build an `I18nText` from a form submission, dropping blanks and unknown locales. */
export function fromEntries(entries: Record<string, unknown>): I18nText {
  const result: I18nText = {};
  for (const [key, value] of Object.entries(entries)) {
    if (isLocale(key) && typeof value === 'string' && value.trim() !== '') {
      result[key] = value.trim();
    }
  }
  return result;
}
