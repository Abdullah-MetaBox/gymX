import { DEFAULT_LOCALE, isLocale } from '@gymx/i18n';
import en from '@gymx/i18n/messages/en.json';
import fr from '@gymx/i18n/messages/fr.json';
import { cookies } from 'next/headers';
import type { AbstractIntlMessages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE } from '../lib/session';

const CATALOGUES: Record<string, Record<string, unknown>> = { en, fr };

/**
 * Deep-merge the requested catalogue over English.
 *
 * This is what makes a partially translated locale usable: an untranslated key
 * renders its English string rather than the raw key or an exception. French
 * ships as one pass in Phase 10, so until then most of `fr` is intentionally
 * absent and this merge carries the app.
 */
function withFallback(locale: string): AbstractIntlMessages {
  const base = CATALOGUES[DEFAULT_LOCALE] ?? {};
  const requested = CATALOGUES[locale];
  const merged = !requested || locale === DEFAULT_LOCALE ? base : deepMerge(base, requested);
  return merged as AbstractIntlMessages;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
    } else if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: withFallback(locale),
    timeZone: 'Indian/Mauritius',
    onError() {
      // Missing keys are expected until the Phase 10 translation pass. The
      // fallback above already resolved them; do not shout in the console.
    },
    getMessageFallback({ key }) {
      return key.split('.').pop() ?? key;
    },
  };
});
