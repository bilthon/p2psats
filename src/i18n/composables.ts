import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { INTL_LOCALE, type AppLocale } from './index'

export function useIntlLocale() {
  const { locale } = useI18n()
  return computed(() => INTL_LOCALE[locale.value as AppLocale] ?? 'en-US')
}
