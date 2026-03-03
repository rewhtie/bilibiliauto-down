'use client';

import dynamic from "next/dynamic";
import type { Dictionary } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/config";

const UnifiedDownloaderDynamic = dynamic(
    () => import("./unified-downloader").then((m) => m.UnifiedDownloader),
    { ssr: false }
);

interface Props {
    dict: Dictionary;
    locale: Locale;
}

export function UnifiedDownloaderClient({ dict, locale }: Props) {
    return <UnifiedDownloaderDynamic dict={dict} locale={locale} />;
}
