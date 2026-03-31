export interface SingleImageLoadState {
    loading: boolean;
    error: boolean;
}

export function shouldHideSingleImagePreview(
    singleImageMode: boolean,
    state?: SingleImageLoadState | null
): boolean {
    return singleImageMode && !!state && !state.loading && state.error;
}

export function shouldShowVideoDownloadButton(videoDownloadUrl: string | null | undefined): boolean {
    return typeof videoDownloadUrl === 'string' && videoDownloadUrl.length > 0
}
