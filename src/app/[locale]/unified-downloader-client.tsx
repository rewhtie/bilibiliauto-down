'use client';

import dynamic from "next/dynamic";
import type { ReactNode } from 'react';
import type { HomeDictionary } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/config";

const UnifiedDownloaderDynamic = dynamic(
    () => import("./unified-downloader").then((m) => m.UnifiedDownloader)
);

interface Props {
    dict: HomeDictionary;
    locale: Locale;
    leftRail?: ReactNode;
    rightRail?: ReactNode;
    mobileAd?: ReactNode;
    mobileGuides?: ReactNode;
    heroMeta?: ReactNode;
    footer?: ReactNode;
}

export function UnifiedDownloaderClient({
    dict,
    locale,
    leftRail,
    rightRail,
    mobileAd,
    mobileGuides,
    heroMeta,
    footer,
}: Props) {
    return (
        <UnifiedDownloaderDynamic
            dict={dict}
            locale={locale}
            leftRail={leftRail}
            rightRail={rightRail}
            mobileAd={mobileAd}
            mobileGuides={mobileGuides}
            heroMeta={heroMeta}
            footer={footer}
        />
    );
}
