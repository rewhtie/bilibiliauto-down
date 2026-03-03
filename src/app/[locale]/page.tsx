import { getDictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { StructuredData } from "@/components/structured-data"
import { HomeFaqStructuredData } from "@/components/home-faq-structured-data"
import { UnifiedDownloaderClient } from "./unified-downloader-client"

export default async function HomePage({
    params,
}: {
    params: Promise<{ locale: Locale }>
}) {
    const { locale } = await params
    const dict = await getDictionary(locale)

    return (
        <>
            <StructuredData locale={locale} dict={dict} />
            <HomeFaqStructuredData locale={locale} dict={dict} />
            <UnifiedDownloaderClient dict={dict} locale={locale} />
        </>
    )
} 
