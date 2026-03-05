import type { Locale } from '@/lib/i18n/config'

export type ApiLanguage = 'zh-CN' | 'zh-TW' | 'en'

export function localeToApiLanguage(locale: Locale): ApiLanguage {
    if (locale === 'en') return 'en'
    if (locale === 'zh-tw') return 'zh-TW'
    return 'zh-CN'
}

export function buildApiAcceptLanguage(locale: Locale): string {
    const lang = localeToApiLanguage(locale)
    if (lang === 'en') return 'en-US,en;q=0.9,zh-CN;q=0.6'
    if (lang === 'zh-TW') return 'zh-TW,zh;q=0.9,zh-CN;q=0.8,en;q=0.6'
    return 'zh-CN,zh;q=0.9,en;q=0.6'
}

export function buildApiI18nHeaders(locale: Locale): Record<'x-lang' | 'Accept-Language', string> {
    return {
        'x-lang': localeToApiLanguage(locale),
        'Accept-Language': buildApiAcceptLanguage(locale),
    }
}

export function appendLangQuery(url: string, locale: Locale): string {
    const lang = localeToApiLanguage(locale)
    const hasQuery = url.includes('?')
    const separator = hasQuery ? '&' : '?'
    return `${url}${separator}lang=${encodeURIComponent(lang)}`
}
