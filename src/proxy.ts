import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Negotiator from 'negotiator'
import { i18n } from './lib/i18n/config'
import {
    isBotUserAgent,
    normalizeCookieLocale,
    resolveLocaleForRequest,
} from './lib/seo-routing'

function getLocaleFromCookie(request: NextRequest): string | null {
    const cookieLocale = request.cookies.get('preferred-locale')?.value
    return normalizeCookieLocale(cookieLocale ?? null, i18n.locales)
}

function getAcceptedLanguages(request: NextRequest): string[] {
    const negotiatorHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => (negotiatorHeaders[key] = value))

    return new Negotiator({ headers: negotiatorHeaders }).languages()
}

function getLocale(request: NextRequest): string {
    return resolveLocaleForRequest({
        pathname: request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent') || '',
        cookieLocale: getLocaleFromCookie(request),
        acceptLanguages: getAcceptedLanguages(request),
        locales: i18n.locales,
        defaultLocale: i18n.defaultLocale,
    })
}

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // 跳过 API 路由和静态文件
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.includes('.')
    ) {
        return
    }

    // 检查路径名中是否有任何支持的区域设置
    const pathnameHasLocale = i18n.locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    )

    if (pathnameHasLocale) return

    // 如果没有区域设置则重定向
    const locale = getLocale(request)
    request.nextUrl.pathname = `/${locale}${pathname}`

    const response = NextResponse.redirect(request.nextUrl)

    // 设置 Cookie 记住用户语言偏好（仅在真实用户请求且非已有 cookie 时设置）
    if (!isBotUserAgent(request.headers.get('user-agent') || '') && !getLocaleFromCookie(request)) {
        response.cookies.set('preferred-locale', locale, {
            path: '/',
            maxAge: 31536000, // 1年
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        })
    }

    return response
}

export const config = {
    matcher: [
        // 匹配所有路径除了以下情况：
        // - api 路由
        // - _next 静态文件
        // - 包含点的文件 (如 .ico, .png 等)
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
    ],
} 
