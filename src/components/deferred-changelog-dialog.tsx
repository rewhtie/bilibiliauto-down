'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n/config'
import type { HomeDictionary } from '@/lib/i18n/types'

const ChangelogDialog = dynamic(
    () => import('@/components/changelog-dialog').then((m) => m.ChangelogDialog),
    { ssr: false }
)

interface DeferredChangelogDialogProps {
    locale: Locale
    dict: HomeDictionary
    triggerClassName?: string
    triggerIconOnly?: boolean
}

export function DeferredChangelogDialog({
    locale,
    dict,
    triggerClassName,
    triggerIconOnly = false,
}: DeferredChangelogDialogProps) {
    const [mounted, setMounted] = useState(false)
    const title = dict.changelog.title

    if (mounted) {
        return (
            <ChangelogDialog
                locale={locale}
                dict={dict}
                triggerClassName={triggerClassName}
                triggerIconOnly={triggerIconOnly}
                defaultOpen
            />
        )
    }

    return (
        <Button
            variant="ghost"
            size={triggerIconOnly ? 'icon' : 'sm'}
            className={cn('text-sm', triggerClassName)}
            onClick={() => setMounted(true)}
            aria-label={title}
        >
            <ScrollText className={cn('h-4 w-4', !triggerIconOnly && 'mr-1')} />
            {triggerIconOnly ? <span className="sr-only">{title}</span> : title}
        </Button>
    )
}
