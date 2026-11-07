// This is an arbitrary string that we use to replace the dot of the extension.
export const ASTRO_PAGE_EXTENSION_POST_PATTERN = "@_@";
// This is an arbitrary string that we use to make a pageData key
// Has to be an invalid character for a route, to avoid conflicts.
const ASTRO_PAGE_KEY_SEPARATOR = "&";
/**
* Generate a unique key to identify each page in the build process.
* @param route Usually pageData.route.route
* @param componentPath Usually pageData.component
*/
export function makePageDataKey(route, componentPath) {
	return route + ASTRO_PAGE_KEY_SEPARATOR + componentPath;
}
export function shouldInlineAsset(assetContent, assetPath, assetsInlineLimit) {
	if (typeof assetsInlineLimit === "function") {
		const result = assetsInlineLimit(assetPath, Buffer.from(assetContent));
		if (result != null) {
			return result;
		} else {
			return Buffer.byteLength(assetContent) < 4096;
		}
	}
	return Buffer.byteLength(assetContent) < Number(assetsInlineLimit);
}
