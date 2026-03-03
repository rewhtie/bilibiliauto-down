'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Globe, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n/config'
import type { HomeDictionary } from '@/lib/i18n/types'

const LanguageSwitcher = dynamic(
    () => import('@/components/language-switcher').then((m) => m.LanguageSwitcher),
    { ssr: false }
)

interface DeferredLanguageSwitcherProps {
    currentLocale: Locale
    dict: HomeDictionary
    compact?: boolean
}

export function DeferredLanguageSwitcher({
    currentLocale,
    dict,
    compact = false,
}: DeferredLanguageSwitcherProps) {
    const [mounted, setMounted] = useState(false)

    if (mounted) {
        return (
            <LanguageSwitcher
                currentLocale={currentLocale}
                dict={dict}
                compact={compact}
                defaultOpen
            />
        )
    }

    return (
        <Button
            variant="ghost"
            size={compact ? 'icon' : 'sm'}
            onClick={() => setMounted(true)}
            className={cn('flex items-center gap-2 text-sm', compact && 'h-9 w-9 p-0')}
            aria-label={dict.languages[currentLocale]}
        >
            <Globe className="h-4 w-4" />
            {compact ? (
                <span className="sr-only">{dict.languages[currentLocale]}</span>
            ) : (
                <>
                    <span>{dict.languages[currentLocale]}</span>
                    <ChevronDown className="h-4 w-4" />
                </>
            )}
        </Button>
    )
}
