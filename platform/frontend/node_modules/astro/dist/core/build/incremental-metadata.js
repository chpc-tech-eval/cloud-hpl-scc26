export const ASTRO_INCREMENTAL_META_KEY = "astroIncremental";
export function createContentDataIncrementalMetadata() {
	return { [ASTRO_INCREMENTAL_META_KEY]: { kind: "content-data" } };
}
export function isContentDataIncrementalModule(info) {
	const metadata = info?.meta?.[ASTRO_INCREMENTAL_META_KEY];
	return metadata?.kind === "content-data";
}
