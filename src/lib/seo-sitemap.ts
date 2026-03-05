export function resolveSitemapLastModified(
    env: Record<string, string | undefined>,
    fallback: Date
): Date {
    const rawDate = env.SITEMAP_LASTMOD ?? env.VERCEL_GIT_COMMIT_DATE
    if (!rawDate) return fallback

    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) {
        return fallback
    }

    return parsed
}
