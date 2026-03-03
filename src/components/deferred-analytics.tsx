'use client'

import { useEffect, useState, type ComponentType } from 'react'

type AnalyticsComponent = ComponentType<Record<string, never>>

export function DeferredAnalytics() {
    const [Analytics, setAnalytics] = useState<AnalyticsComponent | null>(null)

    useEffect(() => {
        let cancelled = false
        let timerId: ReturnType<typeof setTimeout> | null = null
        let idleId: number | null = null

        const loadAnalytics = async () => {
            try {
                const mod = await import('@vercel/analytics/next')
                if (!cancelled) {
                    setAnalytics(() => mod.Analytics as AnalyticsComponent)
                }
            } catch {
                // Ignore analytics load failures to keep primary UX unaffected.
            }
        }

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            idleId = window.requestIdleCallback(() => {
                void loadAnalytics()
            }, { timeout: 2000 })
        } else {
            timerId = setTimeout(() => {
                void loadAnalytics()
            }, 1000)
        }

        return () => {
            cancelled = true
            if (idleId !== null && 'cancelIdleCallback' in window) {
                window.cancelIdleCallback(idleId)
            }
            if (timerId !== null) {
                clearTimeout(timerId)
            }
        }
    }, [])

    if (!Analytics) {
        return null
    }

    return <Analytics />
}
