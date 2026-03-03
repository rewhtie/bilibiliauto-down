'use client'

import { useEffect, useState, type ComponentType } from 'react'

type TrackerComponent = ComponentType<Record<string, never>>

export function DeferredWebVitalsTracker() {
    const [Tracker, setTracker] = useState<TrackerComponent | null>(null)

    useEffect(() => {
        let cancelled = false
        let timerId: ReturnType<typeof setTimeout> | null = null
        let idleId: number | null = null

        const loadTracker = async () => {
            try {
                const mod = await import('@/components/web-vitals-tracker')
                if (!cancelled) {
                    setTracker(() => mod.WebVitalsTracker as TrackerComponent)
                }
            } catch {
                // Ignore tracker load failures to avoid impacting user actions.
            }
        }

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            idleId = window.requestIdleCallback(() => {
                void loadTracker()
            }, { timeout: 2000 })
        } else {
            timerId = setTimeout(() => {
                void loadTracker()
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

    if (!Tracker) {
        return null
    }

    return <Tracker />
}
