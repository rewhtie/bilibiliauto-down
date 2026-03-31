import { describe, expect, it } from 'vitest'

import { resolveSitemapLastModified } from '../src/lib/seo-sitemap.ts'

const fallback = new Date('2026-03-05T00:00:00.000Z')

describe('resolveSitemapLastModified', () => {
it('uses SITEMAP_LASTMOD when present and valid', () => {
    const value = resolveSitemapLastModified(
        {
            SITEMAP_LASTMOD: '2026-03-01T12:00:00.000Z',
            VERCEL_GIT_COMMIT_DATE: '2026-02-20T00:00:00.000Z',
        },
        fallback
    )
    expect(value.toISOString()).toBe('2026-03-01T12:00:00.000Z')
})

it('uses VERCEL_GIT_COMMIT_DATE when SITEMAP_LASTMOD is missing', () => {
    const value = resolveSitemapLastModified(
        {
            VERCEL_GIT_COMMIT_DATE: '2026-02-20T00:00:00.000Z',
        },
        fallback
    )
    expect(value.toISOString()).toBe('2026-02-20T00:00:00.000Z')
})

it('falls back when env date is invalid', () => {
    const value = resolveSitemapLastModified(
        {
            SITEMAP_LASTMOD: 'invalid-date',
            VERCEL_GIT_COMMIT_DATE: 'also-invalid',
        },
        fallback
    )
    expect(value.toISOString()).toBe(fallback.toISOString())
})
})
