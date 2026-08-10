/**
 * Locale configuration.
 *
 * The architecture ships in Phase 0; the French *strings* land as one
 * dedicated pass in Phase 10. That was a deliberate call: translating as we go
 * spreads a 10-15% tax across every screen in every phase, where it becomes
 * invisible and unrecoverable. Doing it once, late, costs the same and is
 * visible on the plan.
 *
 * Adding Kreol Morisien — or any locale for a gym outside Mauritius — is a
 * data change plus a message file. No code change, by design.
 */

export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the locale to render in.
 *
 * Precedence: the user's own preference, then the gym's default, then English.
 * A user preference that the gym has not enabled is ignored rather than
 * honoured — otherwise a member could receive mail in a language the gym
 * cannot write.
 */
export function resolveLocale(input: {
  userLocale?: string | null;
  gymDefaultLocale?: string | null;
  gymLocales?: readonly string[] | null;
}): Locale {
  const enabled = (input.gymLocales?.filter(isLocale) ?? LOCALES) as readonly Locale[];
  const available = enabled.length > 0 ? enabled : LOCALES;

  if (isLocale(input.userLocale) && available.includes(input.userLocale)) {
    return input.userLocale;
  }
  if (isLocale(input.gymDefaultLocale) && available.includes(input.gymDefaultLocale)) {
    return input.gymDefaultLocale;
  }
  return available[0] ?? DEFAULT_LOCALE;
}
