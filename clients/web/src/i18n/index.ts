// Job: messages in en and vi; the browser language picks (vi for vi*, else en).
import { createI18n } from 'vue-i18n';
import en from './en.json';
import vi from './vi.json';

export type Locale = 'en' | 'vi';

export const messages = { en, vi };

export function pickLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function createAppI18n(locale: Locale = pickLocale(navigator.language)) {
  return createI18n({ legacy: false, locale, fallbackLocale: 'en', messages });
}
