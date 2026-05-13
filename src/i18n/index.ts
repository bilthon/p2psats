import { createI18n } from 'vue-i18n'
import type { Ref } from 'vue'
import en from './locales/en.json'
import es from './locales/es.json'
import ptBR from './locales/pt-BR.json'

export type AppLocale = 'en' | 'es' | 'pt-BR'
export const SUPPORTED: AppLocale[] = ['en', 'es', 'pt-BR']
export const STORAGE_KEY = 'pe.locale'

export const INTL_LOCALE: Record<AppLocale, string> = {
  en: 'en-US',
  es: 'es-419',
  'pt-BR': 'pt-BR',
}

// OG locale codes — Open Graph spec requires language_TERRITORY with an
// ISO-3166-1 alpha-2 country (not UN M.49 region codes like 419). Facebook
// rejects unsupported values; es_ES is the broadest supported Spanish locale.
export const OG_LOCALE: Record<AppLocale, string> = {
  en: 'en_US',
  es: 'es_ES',
  'pt-BR': 'pt_BR',
}

export function detectInitialLocale(): AppLocale {
  // Guard: during SSG prerender there is no window/localStorage/navigator
  if (typeof window === 'undefined') return 'en'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if ((SUPPORTED as string[]).includes(parsed)) return parsed as AppLocale
    }
  } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en'
  if (/^pt/i.test(nav)) return 'pt-BR'
  if (/^es/i.test(nav)) return 'es'
  return 'en'
}

type MessageSchema = typeof en

export const i18n = createI18n<[MessageSchema], AppLocale>({
  legacy: false,
  globalInjection: true,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  missingWarn: import.meta.env.DEV,
  fallbackWarn: false,
  messages: { en, es, 'pt-BR': ptBR },
})

function localeRef(): Ref<AppLocale> {
  return (i18n.global.locale as unknown) as Ref<AppLocale>
}

export function setLocale(locale: AppLocale): void {
  localeRef().value = locale
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(locale)) } catch { /* */ }
  // Guard: only touch DOM on the client
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
}

export function getIntlLocale(): string {
  return INTL_LOCALE[localeRef().value] ?? 'en-US'
}

export function getLocaleRef(): Ref<AppLocale> {
  return localeRef()
}
