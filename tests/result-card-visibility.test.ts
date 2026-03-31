import { describe, expect, it } from 'vitest'

import {
    shouldHideSingleImagePreview,
    shouldShowVideoDownloadButton,
} from '../src/components/downloader/result-card-visibility.ts'

describe('result card visibility helpers', () => {
it('hides single-image preview after a load failure completes', () => {
    expect(
        shouldHideSingleImagePreview(true, {
            loading: false,
            error: true,
        })
    ).toBe(true)
})

it('keeps single-image preview visible while it is still loading', () => {
    expect(
        shouldHideSingleImagePreview(true, {
            loading: true,
            error: false,
        })
    ).toBe(false)
})

it('keeps multi-image previews visible even when one item fails', () => {
    expect(
        shouldHideSingleImagePreview(false, {
            loading: false,
            error: true,
        })
    ).toBe(false)
})

it('shows video download button for bilibili tv when a video url exists', () => {
    expect(shouldShowVideoDownloadButton('https://example.com/video.mp4')).toBe(true)
})

it('hides video download button when no video url exists', () => {
    expect(shouldShowVideoDownloadButton(null)).toBe(false)
})
})
