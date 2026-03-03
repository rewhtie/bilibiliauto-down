'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n/config'
import type { HomeDictionary } from '@/lib/i18n/types'

const FeedbackDialog = dynamic(
    () => import('@/components/feedback-dialog').then((m) => m.FeedbackDialog),
    { ssr: false }
)

interface DeferredFeedbackDialogProps {
    locale: Locale
    dict: HomeDictionary
    triggerClassName?: string
    triggerIconOnly?: boolean
}

export function DeferredFeedbackDialog({
    locale,
    dict,
    triggerClassName,
    triggerIconOnly = false,
}: DeferredFeedbackDialogProps) {
    const [mounted, setMounted] = useState(false)
    const triggerLabel = dict.feedback.triggerButton

    if (mounted) {
        return (
            <FeedbackDialog
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
            aria-label={triggerLabel}
        >
            <MessageSquare className={cn('h-4 w-4', !triggerIconOnly && 'mr-1')} />
            {triggerIconOnly ? (
                <span className="sr-only">{triggerLabel}</span>
            ) : (
                triggerLabel
            )}
        </Button>
    )
}
